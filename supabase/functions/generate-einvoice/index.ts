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
  invoice_id: z.string().uuid(),
});

// Legacy IRIS GSP endpoints (kept for existing GSP mode)
const IRIS_SANDBOX_URL = "https://einv-apisandbox.nic.in";
const IRIS_PROD_URL = "https://einv-api.nic.in";
// GSTZen GSP endpoints (no encryption needed - GSTZen handles IRP communication)
const GSTZEN_EINVOICE_URL = "https://my.gstzen.in/~gstzen/a/post-einvoice-data/einvoice-json/";
const GSTZEN_SANDBOX_TOKEN = "de3a3a01-273a-4a81-8b75-13fe37f14dc6";

// Direct Government IRP endpoints
const IRP_API_VERSION = "v1.04";

interface DirectIrpAuthResponse {
  Status: number;
  Data?: {
    ClientId?: string;
    UserName?: string;
    AuthToken?: string;
    Sek?: string;
    TokenExpiry?: number;
  };
  ErrorDetails?: { ErrorCode: string; ErrorMessage: string }[] | null;
}

interface IrisAuthResponse {
  Status: number;
  Data: {
    AuthToken: string;
    TokenExpiry: string;
  };
  ErrorDetails: { ErrorCode: string; ErrorMessage: string }[] | null;
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

  const body: IrisAuthResponse = await resp.json();
  if (body.Status !== 1 || !body.Data?.AuthToken) {
    const errMsg =
      body.ErrorDetails?.map((e) => e.ErrorMessage).join(", ") ||
      "Authentication failed";
    throw new Error(`IRIS Auth failed: ${errMsg}`);
  }
  return body.Data.AuthToken;
}

const stateCodeMap: Record<string, string> = {
  "Andhra Pradesh": "37",
  "Arunachal Pradesh": "12",
  Assam: "18",
  Bihar: "10",
  Chhattisgarh: "22",
  Goa: "30",
  Gujarat: "24",
  Haryana: "06",
  "Himachal Pradesh": "02",
  Jharkhand: "20",
  Karnataka: "29",
  Kerala: "32",
  "Madhya Pradesh": "23",
  Maharashtra: "27",
  Manipur: "14",
  Meghalaya: "17",
  Mizoram: "15",
  Nagaland: "13",
  Odisha: "21",
  Punjab: "03",
  Rajasthan: "08",
  Sikkim: "11",
  "Tamil Nadu": "33",
  Telangana: "36",
  Tripura: "16",
  "Uttar Pradesh": "09",
  Uttarakhand: "05",
  "West Bengal": "19",
  Delhi: "07",
  "Jammu and Kashmir": "01",
  Ladakh: "38",
  Chandigarh: "04",
};

// Common spelling variants seen in customer records
const stateAliases: Record<string, string> = {
  "west bengal": "19",
  westbengal: "19",
  wb: "19",
  tamilnadu: "33",
  "tamil nadu": "33",
  tn: "33",
  maharastra: "27",
  maharashtra: "27",
  mh: "27",
  up: "09",
  "uttar pradesh": "09",
  delhi: "07",
  "new delhi": "07",
  gujrat: "24",
  gujarat: "24",
  karnataka: "29",
  telengana: "36",
  telangana: "36",
  odisha: "21",
  orissa: "21",
  pondicherry: "34",
  puducherry: "34",
  "andhra pradesh": "37",
  "jammu and kashmir": "01",
  "jammu & kashmir": "01",
};

/**
 * Resolve a 2-digit GST state code. The GSTIN prefix is authoritative;
 * the state name is only a fallback. Returns null when it cannot be resolved.
 */
function resolveStateCode(
  gstin?: string | null,
  stateName?: string | null
): string | null {
  const g = (gstin || "").trim().toUpperCase();
  if (/^\d{2}[A-Z0-9]{13}$/.test(g)) return g.slice(0, 2);
  const raw = (stateName || "").trim();
  if (!raw) return null;
  if (stateCodeMap[raw]) return stateCodeMap[raw];
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  if (stateAliases[key]) return stateAliases[key];
  const match = Object.keys(stateCodeMap).find(
    (k) => k.toLowerCase() === key
  );
  return match ? stateCodeMap[match] : null;
}

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

    // Validate JWT
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

    const { invoice_id } = parsed.data;

    // Fetch invoice with related data
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select(
        `*, 
        customer:customers(id, company_name, gst_number, address, city, state, pincode),
        items:invoice_items(*)`
      )
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (invoice.irn) {
      return new Response(
        JSON.stringify({
          error: "E-Invoice already generated",
          irn: invoice.irn,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get tenant GST settings
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
          error:
            "GST API credentials not configured. Please set up GST credentials in Settings.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get seller (tenant) details
    const { data: tenant } = await supabase
      .from("tenants")
      .select("company_name, gst_number, address, city, state, pincode")
      .eq("id", profile.tenant_id)
      .single();

    if (!tenant?.gst_number) {
      return new Response(
        JSON.stringify({
          error: "Seller GSTIN not configured in company settings",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const sellerGstin = (tenant.gst_number || "").trim().toUpperCase();
    const buyerGstinRaw = (invoice.customer?.gst_number || "").trim().toUpperCase();
    const buyerIsRegistered = /^\d{2}[A-Z0-9]{13}$/.test(buyerGstinRaw);

    const sellerStateCode = resolveStateCode(sellerGstin, tenant.state);
    const buyerStateCode = resolveStateCode(
      buyerIsRegistered ? buyerGstinRaw : null,
      invoice.customer?.state
    );

    // Pre-flight checks so the user gets a plain-English fix instead of a portal error
    const problems: string[] = [];
    if (!sellerStateCode)
      problems.push("Your company state is missing or not recognised in Settings → Company.");
    if (!/^\d{6}$/.test(String(tenant.pincode || "").trim()))
      problems.push("Your company pincode must be 6 digits (Settings → Company).");
    if (!buyerStateCode)
      problems.push(
        `The customer's state is missing or not recognised (${invoice.customer?.company_name || "customer"}). Add the correct state on the customer.`
      );
    if (!/^\d{6}$/.test(String(invoice.customer?.pincode || "").trim()))
      problems.push("The customer's pincode must be 6 digits.");
    if (buyerIsRegistered && buyerGstinRaw === sellerGstin)
      problems.push("The customer has your own GSTIN saved. Correct the customer's GSTIN first.");
    const items = (invoice.items || []) as Record<string, unknown>[];
    if (items.length === 0) problems.push("The invoice has no line items.");
    const badHsn = items.filter(
      (i) => !/^\d{6,8}$/.test(String(i.hsn_code || "").trim())
    );
    if (badHsn.length > 0)
      problems.push(
        `${badHsn.length} line item(s) have a missing or short HSN code. HSN must be 6 to 8 digits.`
      );
    if (!(Number(invoice.grand_total) > 0))
      problems.push("The invoice total is zero.");

    if (problems.length > 0) {
      return new Response(
        JSON.stringify({
          error: "This invoice is not ready for e-invoicing yet.",
          problems,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const einvoicePayload = {
      Version: "1.1",
      TranDtls: {
        TaxSch: "GST",
        SupTyp: buyerIsRegistered ? "B2B" : "B2C",
        RegRev: "N",
        IgstOnIntra: "N",
      },
      DocDtls: {
        Typ: "INV",
        No: invoice.invoice_number,
        Dt: formatDateDDMMYYYY(invoice.invoice_date || invoice.created_at),
      },
      SellerDtls: {
        Gstin: sellerGstin,
        LglNm: tenant.company_name,
        Addr1: (tenant.address || "").substring(0, 100) || "Address",
        Loc: tenant.city || "City",
        Pin: parseInt(String(tenant.pincode)) || 110001,
        Stcd: sellerStateCode,
      },
      BuyerDtls: {
        Gstin: buyerIsRegistered ? buyerGstinRaw : "URP",
        LglNm: invoice.customer?.company_name || "Buyer",
        Addr1:
          (invoice.customer?.address || "").substring(0, 100) || "Address",
        Loc: invoice.customer?.city || "City",
        Pin: parseInt(String(invoice.customer?.pincode)) || 110001,
        Stcd: buyerStateCode,
        Pos: buyerStateCode,
      },
      ItemList: (invoice.items || []).map(
        (item: Record<string, unknown>, idx: number) => {
          const qty = Number(item.quantity) || 1;
          const rate = Number(item.rate) || 0;
          const discount = Number(item.discount_amount) || 0;
          const taxable = qty * rate - discount;
          const taxRate = Number(item.tax_percent) || 18;
          const taxAmt = (taxable * taxRate) / 100;
          const isIgst = sellerStateCode !== buyerStateCode;
          const hsn = String(item.hsn_code || "").trim() || "84099900";
          const isService = hsn.startsWith("99");
          return {
            SlNo: String(idx + 1),
            PrdDesc: ((item.description as string) || "Item").substring(0, 300),
            IsServc: isService ? "Y" : "N",
            HsnCd: hsn,
            Qty: isService ? 0 : qty,
            Unit: isService ? undefined : (item.unit as string) || "NOS",
            UnitPrice: rate,
            TotAmt: qty * rate,
            Discount: discount,
            AssAmt: taxable,
            GstRt: taxRate,
            IgstAmt: isIgst ? taxAmt : 0,
            CgstAmt: isIgst ? 0 : taxAmt / 2,
            SgstAmt: isIgst ? 0 : taxAmt / 2,
            TotItemVal: taxable + taxAmt,
          };
        }
      ),
      ValDtls: {
        AssVal: Number(invoice.subtotal) || 0,
        CgstVal: sellerStateCode === buyerStateCode ? (Number(invoice.total_tax) || 0) / 2 : 0,
        SgstVal: sellerStateCode === buyerStateCode ? (Number(invoice.total_tax) || 0) / 2 : 0,
        IgstVal: sellerStateCode !== buyerStateCode ? Number(invoice.total_tax) || 0 : 0,
        TotInvVal: Number(invoice.grand_total) || 0,
      },
    };

    let irnBody: any;

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
          JSON.stringify(einvoicePayload),
          base64Encode(new TextEncoder().encode(sek))
        );

        const irnResp = await fetch(
          `${gstSettings.irp_base_url}/eicore/${IRP_API_VERSION}/Invoice/Generate`,
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

        irnBody = await irnResp.json();
      } catch (err: any) {
        await supabase
          .from("invoices")
          .update({ einvoice_status: "failed" })
          .eq("id", invoice_id);
        return new Response(
          JSON.stringify({
            error:
              "Direct IRP e-invoice generation failed. Ensure your Client ID/Secret, username/password and IRP portal are correct, and that the app server IP is whitelisted in the IRP portal.",
            details: err.message,
          }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else if (gstSettings.gsp_provider === "gstzen") {
      // GSTZen path: plain NIC JSON, Token header, GSTZen handles IRP auth & encryption
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
        const irnResp = await fetch(GSTZEN_EINVOICE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Token: token,
            gstin: tenant.gst_number,
          },
          body: JSON.stringify(einvoicePayload),
        });
        irnBody = await irnResp.json();
      } catch (err: any) {
        console.log("GSTZen fetch error:", err?.message);
        await supabase
          .from("invoices")
          .update({ einvoice_status: "failed" })
          .eq("id", invoice_id);
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

      const baseUrl = gstSettings.sandbox_mode ? IRIS_SANDBOX_URL : IRIS_PROD_URL;
      const irnResp = await fetch(`${baseUrl}/eivital/v1.04/Invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          AuthToken: authToken,
          gstin: tenant.gst_number,
        },
        body: JSON.stringify(einvoicePayload),
      });

      irnBody = await irnResp.json();
    }

    // Normalise across providers: NIC/IRIS nest under Data, GSTZen returns top-level
    const irn = irnBody.Data?.Irn || irnBody.Irn;
    const ackNo = irnBody.Data?.AckNo || irnBody.AckNo;
    const ackDt = irnBody.Data?.AckDt || irnBody.AckDt;
    const signedQr = irnBody.Data?.SignedQRCode || irnBody.SignedQRCode;

    if (!irn) {
      const errMsg =
        irnBody.ErrorDetails?.map(
          (e: { ErrorMessage: string }) => e.ErrorMessage
        ).join(", ") ||
        irnBody.message ||
        irnBody.error ||
        "IRN generation failed";

      await supabase
        .from("invoices")
        .update({ einvoice_status: "failed" })
        .eq("id", invoice_id);

      return new Response(
        JSON.stringify({ error: errMsg, details: irnBody }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Success - update invoice with IRN details
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        irn,
        irn_date: new Date().toISOString(),
        ack_number: String(ackNo || ""),
        qr_code_data: signedQr || "",
        einvoice_status: "generated",
      })
      .eq("id", invoice_id);

    if (updateError) {
      console.error("Failed to update invoice:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        irn,
        ack_number: ackNo,
        ack_date: ackDt,
        qr_code: signedQr,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("E-Invoice generation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
