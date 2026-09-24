import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import CryptoJS from "https://esm.sh/crypto-js@4.2.0";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  dispatch_id: z.string().uuid(),
  transporter_name: z.string().min(1).max(100),
  transporter_id: z.string().max(15).optional(),
  vehicle_number: z.string().min(1).max(20),
  vehicle_type: z.enum(["R", "O"]).default("R"),
  transport_mode: z.enum(["1", "2", "3", "4"]).default("1"),
  distance: z.number().min(0).max(9999),
  invoice_id: z.string().uuid().optional(),
});

// Legacy IRIS GSP endpoints
const IRIS_SANDBOX_URL = "https://einv-apisandbox.nic.in";
const IRIS_PROD_URL = "https://einv-api.nic.in";
const EWAY_SANDBOX_URL = "https://gsp.adaaboroje.com/test";
const EWAY_PROD_URL = "https://gsp.adaaboroje.com";
// GSTZen GSP endpoints
const GSTZEN_EWAY_URL = "https://my.gstzen.in/~gstzen/a/ewbapi/generate/";
const GSTZEN_SANDBOX_TOKEN = "de3a3a01-273a-4a81-8b75-13fe37f14dc6";

const IRP_API_VERSION = "v1.04";

interface DirectIrpAuthResponse {
  Status: number;
  Data?: {
    AuthToken?: string;
    Sek?: string;
    TokenExpiry?: number;
  };
  ErrorDetails?: { ErrorCode: string; ErrorMessage: string }[] | null;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function generateAppKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64Encode(arr);
}

function encryptAesEcb(plainText: string, keyBase64: string): string {
  const key = CryptoJS.enc.Base64.parse(keyBase64);
  const encrypted = CryptoJS.AES.encrypt(plainText, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
}

function decryptAesEcb(cipherBase64: string, keyBase64: string): string {
  const key = CryptoJS.enc.Base64.parse(keyBase64);
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(cipherBase64),
  });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

function encryptRsaPkcs1(appKeyBase64: string, publicKeyPem: string): string {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const encrypted = publicKey.encrypt(appKeyBase64, "RSAES-PKCS1-V1_5");
  return forge.util.encode64(encrypted);
}

async function authenticateDirectIRP(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
  username: string,
  password: string,
  gstin: string,
  publicKeyPem: string
): Promise<{ authToken: string; sek: string; tokenExpiry: number }> {
  const appKey = generateAppKey();
  const encryptedAppKey = encryptRsaPkcs1(appKey, publicKeyPem);
  const encryptedPassword = encryptAesEcb(password, appKey);

  const payload = {
    UserName: username,
    Password: encryptedPassword,
    AppKey: appKey,
    EncryptedAppKey: encryptedAppKey,
    ClientId: clientId,
    ClientSecret: clientSecret,
  };

  const resp = await fetch(`${baseUrl}/eivital/${IRP_API_VERSION}/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "client-id": clientId,
      "client-secret": clientSecret,
      gstin,
    },
    body: JSON.stringify(payload),
  });

  const body: DirectIrpAuthResponse = await resp.json();
  if (body.Status !== 1 || !body.Data?.AuthToken || !body.Data?.Sek) {
    const errMsg =
      body.ErrorDetails?.map((e) => e.ErrorMessage).join(", ") ||
      `Direct IRP authentication failed (status ${body.Status})`;
    throw new Error(errMsg);
  }

  const sek = decryptAesEcb(body.Data.Sek, appKey);
  return {
    authToken: body.Data.AuthToken,
    sek,
    tokenExpiry: body.Data.TokenExpiry || 0,
  };
}

async function getIrisAuthToken(
  username: string,
  password: string,
  sandboxMode: boolean
): Promise<string> {
  const baseUrl = sandboxMode ? IRIS_SANDBOX_URL : IRIS_PROD_URL;
  const resp = await fetch(`${baseUrl}/eivital/v1.04/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      user_name: username,
      password: password,
      client_id: username,
      client_secret: password,
      gstin: "",
    },
  });

  const body = await resp.json();
  if (body.Status !== 1 || !body.Data?.AuthToken) {
    const errMsg =
      body.ErrorDetails?.map((e: { ErrorMessage: string }) => e.ErrorMessage).join(", ") ||
      "Authentication failed";
    throw new Error(`IRIS Auth failed: ${errMsg}`);
  }
  return body.Data.AuthToken;
}

const stateCodeMap: Record<string, string> = {
  "Andhra Pradesh": "37", "Arunachal Pradesh": "12", "Assam": "18",
  "Bihar": "10", "Chhattisgarh": "22", "Goa": "30", "Gujarat": "24",
  "Haryana": "06", "Himachal Pradesh": "02", "Jharkhand": "20",
  "Karnataka": "29", "Kerala": "32", "Madhya Pradesh": "23",
  "Maharashtra": "27", "Manipur": "14", "Meghalaya": "17",
  "Mizoram": "15", "Nagaland": "13", "Odisha": "21", "Punjab": "03",
  "Rajasthan": "08", "Sikkim": "11", "Tamil Nadu": "33",
  "Telangana": "36", "Tripura": "16", "Uttar Pradesh": "09",
  "Uttarakhand": "05", "West Bengal": "19", "Delhi": "07",
  "Jammu and Kashmir": "01", "Ladakh": "38", "Chandigarh": "04",
};

function formatDateDDMMYYYY(dateStr: string) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: corsHeaders }
      );
    }

    const {
      dispatch_id,
      transporter_name,
      transporter_id,
      vehicle_number,
      vehicle_type,
      transport_mode,
      distance,
      invoice_id,
    } = parsed.data;

    // Fetch dispatch with customer
    const { data: dispatch, error: dispError } = await supabase
      .from("dispatches")
      .select(
        `*, 
        customer:customers(id, company_name, gst_number, address, city, state, pincode),
        items:dispatch_items(*, product:products(name, hsn_code))`
      )
      .eq("id", dispatch_id)
      .single();

    if (dispError || !dispatch) {
      return new Response(
        JSON.stringify({ error: "Dispatch not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (dispatch.eway_bill_number) {
      return new Response(
        JSON.stringify({
          error: "E-Way Bill already generated",
          eway_bill_number: dispatch.eway_bill_number,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get tenant info
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: gstSettings } = await supabase
      .from("gst_api_settings")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .single();

    const isGstzen = gstSettings?.gsp_provider === "gstzen";
    const gstzenReady = isGstzen && (gstSettings?.client_id || gstSettings?.sandbox_mode);
    if (!gstzenReady && (!gstSettings?.api_username || !gstSettings?.api_password)) {
      return new Response(
        JSON.stringify({
          error: "GST API credentials not configured",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("company_name, gst_number, address, city, state, pincode")
      .eq("id", profile.tenant_id)
      .single();

    if (!tenant?.gst_number) {
      return new Response(
        JSON.stringify({ error: "Seller GSTIN not configured" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get invoice if provided (for HSN/value details)
    let invoiceData = null;
    if (invoice_id) {
      const { data } = await supabase
        .from("invoices")
        .select("*, items:invoice_items(*)")
        .eq("id", invoice_id)
        .single();
      invoiceData = data;
    }

    const fromStateCode = stateCodeMap[tenant.state || ""] || "09";
    const toStateCode = stateCodeMap[dispatch.customer?.state || ""] || "09";

    const itemList = (invoiceData?.items || dispatch.items || []).map(
      (item: Record<string, unknown>, idx: number) => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.rate) || 100;
        const taxable = qty * rate;
        const isIgst = fromStateCode !== toStateCode;
        return {
          productName: ((item.description as string) || "Item").substring(0, 100),
          productDesc: ((item.description as string) || "Item").substring(0, 100),
          hsnCode: (item.hsn_code as string) || (item.product as Record<string, unknown>)?.hsn_code || "84099900",
          quantity: qty,
          qtyUnit: (item.unit as string) || "NOS",
          taxableAmount: taxable,
          sgstRate: isIgst ? 0 : 9,
          cgstRate: isIgst ? 0 : 9,
          igstRate: isIgst ? 18 : 0,
          cessRate: 0,
        };
      }
    );

    const totalValue = itemList.reduce((sum: number, it: any) => sum + it.taxableAmount, 0);
    const taxRate = fromStateCode === toStateCode ? 0.18 : 0.18;
    const taxAmount = totalValue * taxRate;

    const ewayPayload = {
      supplyType: "O",
      subSupplyType: "1",
      docType: "INV",
      docNo: invoiceData?.invoice_number || dispatch.dispatch_number,
      docDate: formatDateDDMMYYYY(invoiceData?.invoice_date || dispatch.created_at || new Date().toISOString()),
      fromGstin: tenant.gst_number,
      fromTrdName: tenant.company_name,
      fromAddr1: (tenant.address || "").substring(0, 120) || "Address",
      fromPlace: tenant.city || "City",
      fromPincode: parseInt(tenant.pincode || "000000") || 110001,
      fromStateCode: parseInt(fromStateCode),
      toGstin: dispatch.customer?.gst_number || "URP",
      toTrdName: dispatch.customer?.company_name || "Customer",
      toAddr1: (dispatch.shipping_address || dispatch.customer?.address || "").substring(0, 120) || "Address",
      toPlace: dispatch.customer?.city || "City",
      toPincode: parseInt(dispatch.customer?.pincode || "0") || 110001,
      toStateCode: parseInt(toStateCode),
      totalValue: totalValue,
      cgstValue: fromStateCode === toStateCode ? taxAmount / 2 : 0,
      sgstValue: fromStateCode === toStateCode ? taxAmount / 2 : 0,
      igstValue: fromStateCode !== toStateCode ? taxAmount : 0,
      cessValue: 0,
      totInvValue: totalValue + taxAmount,
      transporterId: transporter_id || "",
      transporterName: transporter_name,
      transMode: transport_mode,
      transDistance: String(distance),
      vehicleNo: vehicle_number.replace(/\s/g, "").toUpperCase(),
      vehicleType: vehicle_type,
      itemList,
    };

    let ewayBody: any;

    if (gstSettings.provider_mode === "direct_irp") {
      if (!gstSettings.irp_base_url || !gstSettings.client_id || !gstSettings.client_secret) {
        return new Response(
          JSON.stringify({
            error:
              "Direct IRP mode selected but IRP portal, Client ID or Client Secret is missing. Complete GST settings first.",
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      const irpPublicKeyPem = Deno.env.get("IRP_PUBLIC_KEY_PEM");
      if (!irpPublicKeyPem) {
        return new Response(
          JSON.stringify({
            error:
              "Direct IRP public key is not configured on the backend. Contact support to add IRP_PUBLIC_KEY_PEM.",
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      try {
        const { authToken, sek } = await authenticateDirectIRP(
          gstSettings.irp_base_url,
          gstSettings.client_id,
          gstSettings.client_secret,
          gstSettings.api_username,
          gstSettings.api_password,
          tenant.gst_number,
          irpPublicKeyPem
        );

        const encryptedPayload = encryptAesEcb(
          JSON.stringify(ewayPayload),
          base64Encode(new TextEncoder().encode(sek))
        );

        const ewayResp = await fetch(
          `${gstSettings.irp_base_url}/eiewb/${IRP_API_VERSION}/ewaybill`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
              "client-id": gstSettings.client_id,
              "client-secret": gstSettings.client_secret,
              gstin: tenant.gst_number,
            },
            body: JSON.stringify({ Data: encryptedPayload }),
          }
        );

        ewayBody = await ewayResp.json();
      } catch (err: any) {
        await supabase
          .from("dispatches")
          .update({ eway_bill_status: "failed" })
          .eq("id", dispatch_id);
        return new Response(
          JSON.stringify({
            error:
              "Direct IRP e-way bill generation failed. Ensure your Client ID/Secret, username/password and IRP portal are correct, and that the app server IP is whitelisted in the IRP portal.",
            details: err.message,
          }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else if (gstSettings.gsp_provider === "gstzen") {
      // GSTZen path: plain JSON, Token header, GSTZen handles e-way bill API auth
      const token =
        gstSettings.client_id ||
        (gstSettings.sandbox_mode ? GSTZEN_SANDBOX_TOKEN : "");
      if (!token) {
        return new Response(
          JSON.stringify({
            error:
              "GSTZen API token is missing. Paste your GSTZen API key in Settings → E-Invoice.",
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      try {
        const ewayResp = await fetch(GSTZEN_EWAY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Token: token,
            gstin: tenant.gst_number,
          },
          body: JSON.stringify(ewayPayload),
        });
        ewayBody = await ewayResp.json();
      } catch (err: any) {
        await supabase
          .from("dispatches")
          .update({ eway_bill_status: "failed" })
          .eq("id", dispatch_id);
        return new Response(
          JSON.stringify({
            error:
              "Could not reach GSTZen. Check your internet connectivity and GSTZen API token.",
            details: err.message,
          }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      // GSP / legacy IRIS path
      const authToken = await getIrisAuthToken(
        gstSettings.api_username,
        gstSettings.api_password,
        gstSettings.sandbox_mode
      );

      const baseUrl = gstSettings.sandbox_mode ? EWAY_SANDBOX_URL : EWAY_PROD_URL;
      const ewayResp = await fetch(`${baseUrl}/enriched/ewb/ewayapi?action=GENEWAYBILL`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authtoken: authToken,
          gstin: tenant.gst_number,
        },
        body: JSON.stringify(ewayPayload),
      });

      ewayBody = await ewayResp.json();
    }

    if (!ewayBody.ewayBillNo && !ewayBody.Data?.EwbNo) {
      const errMsg = ewayBody.errorMessages || ewayBody.message || ewayBody.error || ewayBody.ErrorDetails?.map((e: any) => e.ErrorMessage).join(", ") || "E-Way Bill generation failed";
      
      await supabase
        .from("dispatches")
        .update({ eway_bill_status: "failed" })
        .eq("id", dispatch_id);

      return new Response(
        JSON.stringify({ error: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), details: ewayBody }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Success - update dispatch
    const ewbNo = ewayBody.ewayBillNo || ewayBody.Data?.EwbNo;
    const validUntilRaw = ewayBody.validUpto || ewayBody.Data?.EwbValidTill;
    const validUntil = validUntilRaw
      ? new Date(validUntilRaw).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("dispatches")
      .update({
        eway_bill_number: String(ewbNo),
        eway_bill_date: new Date().toISOString(),
        eway_bill_valid_until: validUntil,
        eway_bill_status: "generated",
      })
      .eq("id", dispatch_id);

    return new Response(
      JSON.stringify({
        success: true,
        eway_bill_number: ewbNo,
        valid_until: validUntil,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("E-Way Bill generation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
