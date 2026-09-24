import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICING: Record<string, { perUser: number; months: number }> = {
  monthly: { perUser: 1500, months: 1 },
  half_yearly: { perUser: 1200, months: 6 },
  annual: { perUser: 750, months: 12 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_type, user_count, tenant_id, coupon_code } = await req.json();

    if (!plan_type || !user_count || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "Missing plan_type, user_count, or tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pricing = PRICING[plan_type];
    if (!pricing) {
      return new Response(
        JSON.stringify({ error: "Invalid plan_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subtotal = user_count * pricing.perUser * pricing.months;
    let discountAmount = 0;
    let validCouponCode: string | null = null;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Strict coupon validation — if coupon_code provided but invalid, return 400
    if (coupon_code) {
      const { data: coupon, error: couponErr } = await adminClient
        .from("coupons")
        .select("*")
        .eq("code", coupon_code.trim().toUpperCase())
        .eq("is_active", true)
        .single();

      if (couponErr || !coupon) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired coupon code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const now = new Date();
      const dateValid = (!coupon.valid_from || new Date(coupon.valid_from) <= now) &&
                        (!coupon.valid_until || new Date(coupon.valid_until) >= now);
      if (!dateValid) {
        return new Response(
          JSON.stringify({ error: "Coupon has expired or is not yet active" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check max_uses against BOTH current_uses counter AND actual subscription count
      if (coupon.max_uses !== null) {
        const { count: subCount } = await adminClient
          .from("tenant_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("coupon_code", coupon.code)
          .in("payment_status", ["pending", "active"]);

        const effectiveUses = Math.max(coupon.current_uses, subCount || 0);
        if (effectiveUses >= coupon.max_uses) {
          return new Response(
            JSON.stringify({ error: "Coupon usage limit reached" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const planValid = !coupon.applicable_plans || coupon.applicable_plans.length === 0 || coupon.applicable_plans.includes(plan_type);
      if (!planValid) {
        return new Response(
          JSON.stringify({ error: "Coupon is not applicable to this plan" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calculate discount
      if (coupon.discount_type === "percentage") {
        discountAmount = Math.round((subtotal * coupon.discount_value) / 100);
      } else {
        discountAmount = Math.round(coupon.discount_value);
      }
      discountAmount = Math.min(discountAmount, subtotal);
      validCouponCode = coupon.code;

      // NOTE: Do NOT increment current_uses here — moved to webhook on payment.captured
    }

    const totalAmount = subtotal - discountAmount;
    const amountInPaise = totalAmount * 100;

    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: tenant_id,
        notes: { plan_type, user_count: String(user_count), tenant_id, coupon_code: validCouponCode || "" },
      }),
    });

    if (!razorpayRes.ok) {
      const err = await razorpayRes.text();
      console.error("Razorpay order error:", err);
      return new Response(
        JSON.stringify({ error: "Failed to create payment order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const order = await razorpayRes.json();

    await adminClient.from("tenant_subscriptions").insert({
      tenant_id,
      plan_type,
      user_count,
      price_per_user: pricing.perUser,
      total_amount: totalAmount,
      payment_status: "pending",
      razorpay_order_id: order.id,
      coupon_code: validCouponCode,
      discount_amount: discountAmount,
    });

    console.log(`Order created: ${order.id}, subtotal: ${subtotal}, discount: ${discountAmount}, total: ${totalAmount}, coupon: ${validCouponCode || 'none'}`);

    return new Response(
      JSON.stringify({
        order_id: order.id,
        amount: amountInPaise,
        currency: "INR",
        key_id: RAZORPAY_KEY_ID,
        subtotal,
        discount_amount: discountAmount,
        final_amount: totalAmount,
        coupon_applied: !!validCouponCode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
