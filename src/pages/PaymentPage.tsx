import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, CreditCard, AlertCircle, Loader2, Tag, Minus, Plus } from "lucide-react";
import gravenLogo from "@/assets/graven-logo.png";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PLAN_LABELS: Record<string, string> = {
  monthly: "Monthly",
  half_yearly: "Half-Yearly",
  annual: "Annual",
};

const PRICING: Record<string, { perUser: number; months: number }> = {
  monthly: { perUser: 1500, months: 1 },
  half_yearly: { perUser: 1200, months: 6 },
  annual: { perUser: 750, months: 12 },
};

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const keyId = searchParams.get("key");
  const planType = searchParams.get("plan") || "";
  const defaultUsers = Number(searchParams.get("users") || "1");
  const tenantName = decodeURIComponent(searchParams.get("tenant") || "");
  const tenantId = searchParams.get("tenant_id") || "";

  // Legacy support: if order_id + amount present (old links), use them directly
  const legacyOrderId = searchParams.get("order_id");
  const legacyAmount = Number(searchParams.get("amount") || 0);

  const [userCount, setUserCount] = useState(defaultUsers);
  const [couponCode, setCouponCode] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<{ valid: boolean; discount_amount: number; description: string; error?: string } | null>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const pricing = PRICING[planType];
  const isLegacy = !!legacyOrderId && !!legacyAmount;
  const isValid = isLegacy ? (!!legacyOrderId && !!keyId && !!legacyAmount) : (!!keyId && !!planType && !!tenantId && !!pricing);

  if (!isValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground">Invalid Payment Link</p>
            <p className="text-muted-foreground text-sm mt-2">This payment link is missing required information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subtotal = pricing ? userCount * pricing.perUser * pricing.months : legacyAmount;
  const discountAmount = couponResult?.valid ? couponResult.discount_amount : 0;
  const displayAmount = isLegacy ? legacyAmount : (subtotal - discountAmount);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim() || !planType) return;
    setCouponValidating(true);
    setCouponResult(null);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/validate-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ coupon_code: couponCode, plan_type: planType, user_count: userCount }),
      });
      const data = await res.json();
      setCouponResult(data);
    } catch {
      setCouponResult({ valid: false, discount_amount: 0, description: "", error: "Failed to validate" });
    } finally {
      setCouponValidating(false);
    }
  };

  const handlePay = async () => {
    if (!window.Razorpay) {
      setErrorMsg("Payment gateway is loading. Please try again.");
      setStatus("error");
      return;
    }

    setStatus("loading");

    // For legacy links, use the pre-baked order
    if (isLegacy) {
      openRazorpay(legacyOrderId!, legacyAmount * 100, keyId!);
      return;
    }

    // For new links, create order dynamically
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/razorpay-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          plan_type: planType,
          user_count: userCount,
          tenant_id: tenantId,
          coupon_code: couponResult?.valid ? couponCode : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.order_id) {
        throw new Error(data.error || "Failed to create order");
      }
      // Strict coupon guard: if coupon was applied in UI but server didn't confirm, block
      if (couponResult?.valid && !data.coupon_applied) {
        throw new Error("Coupon could not be applied to this order. Please try again.");
      }
      openRazorpay(data.order_id, data.amount, data.key_id);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
      setStatus("error");
    }
  };

  const openRazorpay = (orderId: string, amountPaise: number, key: string) => {
    const options = {
      key,
      amount: amountPaise,
      currency: "INR",
      name: "Graven OneDesk",
      description: `${PLAN_LABELS[planType] || planType} Plan — ${userCount} user(s)`,
      order_id: orderId,
      handler: () => {
        setStatus("success");
      },
      modal: {
        ondismiss: () => {
          setStatus("idle");
        },
      },
      theme: { color: "#10b981" },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", (response: any) => {
      setErrorMsg(response?.error?.description || "Payment failed. Please try again.");
      setStatus("error");
    });
    rzp.open();
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground">Your subscription has been activated. You can close this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2.5">
            <img src={gravenLogo} alt="Graven OneDesk" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-foreground">Graven OneDesk</span>
          </div>
          <CardTitle className="text-2xl">Complete Your Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Order Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            {tenantName && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Organization</span>
                <span className="font-medium text-foreground">{tenantName}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium text-foreground">{PLAN_LABELS[planType] || planType}</span>
            </div>

            {/* User Count — editable for new links */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Users</span>
              {isLegacy ? (
                <span className="font-medium text-foreground">{userCount}</span>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { setUserCount(Math.max(1, userCount - 1)); setCouponResult(null); }} disabled={userCount <= 1}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={userCount}
                    onChange={(e) => { setUserCount(Math.max(1, parseInt(e.target.value) || 1)); setCouponResult(null); }}
                    className="w-14 h-7 text-center text-sm p-0"
                  />
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { setUserCount(userCount + 1); setCouponResult(null); }}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Subtotal */}
            {!isLegacy && pricing && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{userCount} × ₹{pricing.perUser.toLocaleString()} × {pricing.months}mo</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
            )}

            {/* Discount line */}
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount ({couponCode})</span>
                <span>-₹{discountAmount.toLocaleString()}</span>
              </div>
            )}

            <div className="border-t border-border pt-3 flex justify-between">
              <span className="font-semibold text-foreground">Total</span>
              <span className="font-bold text-lg text-foreground">₹{displayAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Promo Code — only for new links */}
          {!isLegacy && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Promo Code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                    placeholder="Enter code"
                    className="pl-9 uppercase"
                    disabled={couponResult?.valid}
                  />
                </div>
                {couponResult?.valid ? (
                  <Button variant="outline" size="sm" onClick={() => { setCouponCode(""); setCouponResult(null); }}>Remove</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleValidateCoupon} disabled={couponValidating || !couponCode.trim()}>
                    {couponValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                )}
              </div>
              {couponResult?.valid && (
                <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {couponResult.description}
                </p>
              )}
              {couponResult && !couponResult.valid && couponResult.error && (
                <p className="mt-1.5 text-xs text-destructive">{couponResult.error}</p>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Button onClick={handlePay} disabled={status === "loading"} className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700">
            {status === "loading" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
            ) : (
              <><CreditCard className="h-4 w-4 mr-2" />Pay ₹{displayAmount.toLocaleString()}</>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">Secured by Razorpay · 256-bit SSL encryption</p>
        </CardContent>
      </Card>
    </div>
  );
}
