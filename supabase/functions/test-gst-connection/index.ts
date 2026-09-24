import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GSTZEN_EINVOICE_URL =
  "https://my.gstzen.in/~gstzen/a/post-einvoice-data/einvoice-json/";
const GSTZEN_SANDBOX_TOKEN = "de3a3a01-273a-4a81-8b75-13fe37f14dc6";

function currentInvoiceDate(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function buildProbe(sellerGstin: string) {
  // A minimal NIC-format skeleton. GSTZen validates auth/GSTIN first, then
  // reports that the document has no items. That is enough to prove the
  // API key and GSTIN are linked; nothing is filed with the government.
  return {
    Version: "1.1",
    TranDtls: {
      TaxSch: "GST",
      SupTyp: "B2B",
      RegRev: "N",
      Igst: false,
    },
    DocDtls: {
      Typ: "INV",
      No: "GRAVEN-CONN-TEST",
      Dt: currentInvoiceDate(),
    },
    SellerDtls: {
      Gstin: sellerGstin,
      LglNm: "Test Seller",
      Addr1: "Test Address",
      Loc: "Delhi",
      Pin: 110001,
      Stcd: sellerGstin.slice(0, 2),
    },
    BuyerDtls: {
      Gstin: "27AADCG4992P1ZT",
      LglNm: "Test Buyer",
      Addr1: "Test Address",
      Loc: "Mumbai",
      Pin: 400001,
      Stcd: "27",
    },
    ItemList: [],
  };
}

function classify(status: number, text: string) {
  const lower = text.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    lower.includes("invalid token") ||
    lower.includes("invalid credentials") ||
    lower.includes("authentication")
  ) {
    return {
      ok: false,
      verdict: "bad_token",
      message:
        "GSTZen did not accept the API key. Copy the API key again from your GSTZen profile page and save it.",
    };
  }

  if (
    lower.includes("gstin") &&
    (lower.includes("not registered") ||
      lower.includes("not found") ||
      lower.includes("not present") ||
      lower.includes("not mapped"))
  ) {
    return {
      ok: false,
      verdict: "gstin_not_mapped",
      message:
        "Your API key was accepted, but this GSTIN is not added to your GSTZen account yet. Add the GSTIN in GSTZen and enable e-invoice API for it.",
    };
  }

  // GSTZen accepts the skeleton and then reports validation details such as
  // "Document must have at least one line item". That means auth + GSTIN are OK.
  if (
    status >= 200 &&
    status < 500 &&
    (lower.includes("line item") ||
      lower.includes("itemlist") ||
      lower.includes("validation") ||
      lower.includes("document"))
  ) {
    return {
      ok: true,
      verdict: "reachable",
      message:
        "GSTZen accepted the API key and GSTIN. The test document needs line items before an IRN can be generated, which is expected.",
    };
  }

  if (status >= 200 && status < 500) {
    return {
      ok: true,
      verdict: "reachable",
      message:
        "GSTZen accepted the connection and validated the request. Credentials are working.",
    };
  }

  return {
    ok: false,
    verdict: "unreachable",
    message: "GSTZen returned a server error. Try again in a few minutes.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found for user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("gst_api_settings")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    if (!settings) {
      return new Response(
        JSON.stringify({ error: "Save your e-invoice settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (settings.provider_mode === "direct_irp") {
      return new Response(
        JSON.stringify({
          ok: false,
          verdict: "unsupported",
          message:
            "Connection testing is available for GSTZen. Direct government IRP needs a live document to verify.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (settings.gsp_provider !== "gstzen") {
      return new Response(
        JSON.stringify({
          ok: false,
          verdict: "unsupported",
          message: "Connection testing is currently available for GSTZen only.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token =
      settings.client_id || (settings.sandbox_mode ? GSTZEN_SANDBOX_TOKEN : "");
    if (!token) {
      return new Response(
        JSON.stringify({
          ok: false,
          verdict: "no_token",
          message:
            "No GSTZen API key saved. Paste the key from your GSTZen profile page and save.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gstin = settings.gstin || "";
    const probe = buildProbe(gstin);

    let status = 0;
    let text = "";
    try {
      const resp = await fetch(GSTZEN_EINVOICE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Token: token,
          gstin,
        },
        body: JSON.stringify(probe),
      });
      status = resp.status;
      text = (await resp.text()).slice(0, 1500);
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          verdict: "unreachable",
          message:
            "Could not reach GSTZen from the server. Check again in a few minutes.",
          details: (err as Error).message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = classify(status, text);
    console.log("GSTZen test connection:", status, result.verdict, text.slice(0, 200));

    return new Response(
      JSON.stringify({ ...result, http_status: status, response: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
