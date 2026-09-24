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
    const { coupon_code, plan_type, user_count } = await req.json();

    if (!coupon_code || !plan_type || !user_count) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing coupon_code, plan_type, or user_count" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pricing = PRICING[plan_type];
    if (!pricing) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid plan_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", coupon_code.trim().toUpperCase())
      .eq("is_active", true)
      .single();

    if (error || !coupon) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid or expired coupon code" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check date validity
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return new Response(
        JSON.stringify({ valid: false, error: "Coupon is not yet active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return new Response(
        JSON.stringify({ valid: false, error: "Coupon has expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max uses against BOTH current_uses counter AND actual subscription count
    if (coupon.max_uses !== null) {
      const { count: subCount } = await supabase
        .from("tenant_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("coupon_code", coupon.code)
        .in("payment_status", ["pending", "active"]);

      const effectiveUses = Math.max(coupon.current_uses, subCount || 0);
      if (effectiveUses >= coupon.max_uses) {
        return new Response(
          JSON.stringify({ valid: false, error: "Coupon usage limit reached" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check plan applicability
    if (coupon.applicable_plans && coupon.applicable_plans.length > 0 && !coupon.applicable_plans.includes(plan_type)) {
      return new Response(
        JSON.stringify({ valid: false, error: "Coupon is not applicable to this plan" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate discount
    const subtotal = user_count * pricing.perUser * pricing.months;
    let discountAmount = 0;

    if (coupon.discount_type === "percentage") {
      discountAmount = Math.round((subtotal * coupon.discount_value) / 100);
    } else {
      discountAmount = Math.round(coupon.discount_value);
    }

    discountAmount = Math.min(discountAmount, subtotal);
    const finalAmount = subtotal - discountAmount;

    return new Response(
      JSON.stringify({
        valid: true,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: discountAmount,
        subtotal,
        final_amount: finalAmount,
        description: coupon.description || `${coupon.discount_type === "percentage" ? coupon.discount_value + "%" : "₹" + coupon.discount_value} off`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("validate-coupon error:", err);
    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
