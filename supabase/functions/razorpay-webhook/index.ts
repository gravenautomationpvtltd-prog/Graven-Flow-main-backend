import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

async function verifySignature(
  body: string,
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
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

const PLAN_MONTHS: Record<string, number> = {
  monthly: 1,
  half_yearly: 6,
  annual: 12,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-razorpay-signature");
    const body = await req.text();

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RAZORPAY_KEY_SECRET =
      Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ||
      Deno.env.get("RAZORPAY_KEY_SECRET")!;

    const isValid = await verifySignature(body, signature, RAZORPAY_KEY_SECRET);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);

    if (event.event !== "payment.captured") {
      return new Response(JSON.stringify({ status: "ignored", event: event.event }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = event.payload?.payment?.entity;
    if (!payment) {
      return new Response(JSON.stringify({ error: "No payment entity" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderId = payment.order_id;
    const paymentId = payment.id;
    const notes = payment.notes || {};
    const paymentRef = notes.payment_reference || notes.reference;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Check if this payment belongs to a customer lead payment request
    let paymentReqQuery = adminClient.from("payment_requests").select("*");
    if (paymentRef) {
      paymentReqQuery = paymentReqQuery.eq("payment_reference", paymentRef);
    } else if (orderId) {
      paymentReqQuery = paymentReqQuery.eq("provider_order_id", orderId);
    } else {
      paymentReqQuery = paymentReqQuery.eq("provider_payment_id", paymentId);
    }

    const { data: payReqList } = await paymentReqQuery.limit(1);
    const payReq = payReqList && payReqList.length > 0 ? payReqList[0] : null;

    if (payReq) {
      // Idempotency: If already paid, return 200 immediately
      if (payReq.status === "paid") {
        console.log(`Payment request ${payReq.payment_reference} already paid. Skipping duplicate.`);
        return new Response(JSON.stringify({ status: "already_processed", reference: payReq.payment_reference }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update payment_requests to paid
      const { error: updErr } = await adminClient
        .from("payment_requests")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          provider_payment_id: paymentId,
          provider_order_id: orderId || payReq.provider_order_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payReq.id);

      if (updErr) {
        console.error("Failed to update payment_request:", updErr);
        return new Response(JSON.stringify({ error: "Database update error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Payment request ${payReq.payment_reference} successfully marked as PAID via webhook.`);
      return new Response(JSON.stringify({ status: "ok", type: "customer_payment", reference: payReq.payment_reference }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fallback: Check tenant subscriptions (SaaS plan purchase)
    if (orderId) {
      const { data: sub, error: subErr } = await adminClient
        .from("tenant_subscriptions")
        .select("*")
        .eq("razorpay_order_id", orderId)
        .eq("payment_status", "pending")
        .single();

      if (!subErr && sub) {
        const months = PLAN_MONTHS[sub.plan_type] || 1;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + months);

        await adminClient
          .from("tenant_subscriptions")
          .update({
            payment_status: "active",
            razorpay_payment_id: paymentId,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          })
          .eq("id", sub.id);

        await adminClient
          .from("tenants")
          .update({
            subscription_status: "active",
            max_users: sub.user_count,
          })
          .eq("id", sub.tenant_id);

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
          }
        }

        console.log(`Tenant subscription activated for ${sub.tenant_id}`);
        return new Response(JSON.stringify({ status: "ok", type: "tenant_subscription" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.warn(`Unmatched payment entity: ${paymentId}, order: ${orderId}`);
    return new Response(JSON.stringify({ status: "ignored_unmatched", paymentId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
