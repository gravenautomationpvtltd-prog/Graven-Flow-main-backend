import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLAN_MONTHS: Record<string, number> = {
  monthly: 1,
  half_yearly: 6,
  annual: 12,
};

async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const message = `${orderId}|${paymentId}`;
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    const isValid = await verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      console.error("Invalid payment signature");
      return new Response(
        JSON.stringify({ error: "Invalid payment signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the pending subscription by order ID
    const { data: sub, error: subErr } = await adminClient
      .from("tenant_subscriptions")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .single();

    if (subErr || !sub) {
      console.error("Subscription not found for order:", razorpay_order_id, subErr);
      return new Response(
        JSON.stringify({ error: "Subscription not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already paid, return success (idempotent)
    if (sub.payment_status === "active") {
      console.log("Subscription already active, returning success");
      return new Response(
        JSON.stringify({ status: "already_active", subscription_id: sub.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const months = PLAN_MONTHS[sub.plan_type] || 1;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    // Update subscription to paid
    const { error: updateErr } = await adminClient
      .from("tenant_subscriptions")
      .update({
        payment_status: "active",
        razorpay_payment_id: razorpay_payment_id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })
      .eq("id", sub.id);

    if (updateErr) {
      console.error("Failed to update subscription:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to update subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update tenant status and max_users
    await adminClient
      .from("tenants")
      .update({
        subscription_status: "active",
        max_users: sub.user_count,
      })
      .eq("id", sub.tenant_id);

    // Increment coupon usage if applicable
    if (sub.coupon_code) {
      const { data: coupon } = await adminClient
        .from("coupons")
        .select("id, current_uses")
        .eq("code", sub.coupon_code)
        .eq("is_active", true)
        .single();

      if (coupon) {
        await adminClient
          .from("coupons")
          .update({ current_uses: coupon.current_uses + 1 })
          .eq("id", coupon.id);
        console.log(`Coupon ${sub.coupon_code} usage incremented to ${coupon.current_uses + 1}`);
      }
    }

    console.log(
      `Payment verified for tenant ${sub.tenant_id}, plan ${sub.plan_type}, users ${sub.user_count}`
    );

    return new Response(
      JSON.stringify({ status: "ok", subscription_id: sub.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Verify payment error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
