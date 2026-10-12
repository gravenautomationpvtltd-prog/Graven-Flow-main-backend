import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  CreditCard, 
  Building2, 
  Phone, 
  Calendar, 
  Check,
  User
} from "lucide-react";
import gravenLogo from "@/assets/graven-logo.png";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentDetails {
  id: string;
  amount: number;
  purpose: string;
  description: string;
  status: "pending" | "paid" | "processing" | "failed" | "cancelled";
  payment_reference: string;
  payment_link?: string;
  is_test_mode?: boolean;
  provider?: string;
  provider_order_id?: string;
  provider_payment_id?: string;
  paid_at?: string;
  created_at?: string;
  customer_name?: string;
  company_name?: string;
  phone?: string;
  email?: string;
  lead_title?: string;
}

export default function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ref = searchParams.get("ref");

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);

  // Dynamically load Razorpay checkout script
  useEffect(() => {
    if (window.Razorpay) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const fetchPaymentDetails = async () => {
    if (!ref) {
      setErrorMsg("No payment reference provided in the link.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch from secure database RPC
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
        "get_payment_request_by_ref",
        { p_reference: ref.trim() }
      );

      if (!rpcErr && rpcData) {
        setPayment(rpcData);
        setLoading(false);
        return;
      }

      // 2. Fallback to direct query
      const { data: directData, error: directErr } = await (supabase as any)
        .from("payment_requests")
        .select(`
          id,
          amount,
          purpose,
          description,
          status,
          payment_reference,
          payment_link,
          is_test_mode,
          provider,
          provider_payment_id,
          paid_at,
          created_at,
          customer_id,
          lead_id
        `)
        .eq("payment_reference", ref.trim())
        .maybeSingle();

      if (directErr || !directData) {
        setErrorMsg("Payment request not found or reference link has expired.");
      } else {
        setPayment(directData);
      }
    } catch (err: any) {
      console.error("Error fetching payment:", err);
      setErrorMsg(err.message || "Unable to retrieve payment information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentDetails();
  }, [ref]);

  // Razorpay payment verification on server
  const handleVerifyRazorpayPayment = async (razorpayResponse: {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }) => {
    if (!payment || !ref) return;

    if (!razorpayResponse.razorpay_payment_id) {
      alert("Payment verification failed: Missing Razorpay Payment ID.");
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await (supabase as any).rpc("verify_razorpay_payment", {
        p_reference: ref.trim(),
        p_payment_id: razorpayResponse.razorpay_payment_id,
        p_order_id: razorpayResponse.razorpay_order_id || null,
        p_signature: razorpayResponse.razorpay_signature || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.success) {
        if (data.case_id) {
          setCreatedCaseId(data.case_id);
        }
        await fetchPaymentDetails();
      } else {
        throw new Error(data?.error || "Failed to finalize payment status.");
      }
    } catch (err: any) {
      console.error("Payment verification error:", err);
      alert("Payment verification error: " + (err.message || "Unknown error"));
    } finally {
      setProcessing(false);
    }
  };

  // Launch Razorpay standard checkout modal
  const handlePay = () => {
    if (!payment) return;

    // Use Razorpay public key ID
    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_live_RmLnK3dmvybEVK";

    if (!window.Razorpay) {
      alert("Razorpay checkout is loading. Please try again in a few seconds.");
      return;
    }

    const amountInPaise = Math.round(Number(payment.amount) * 100);

    const options = {
      key: razorpayKey,
      amount: amountInPaise,
      currency: "INR",
      name: "Graven OneDesk",
      description: payment.purpose || "Technical Consultation / TST Service",
      image: gravenLogo,
      handler: async (response: any) => {
        // Customer actually completed payment in Razorpay modal
        await handleVerifyRazorpayPayment({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        });
      },
      prefill: {
        name: payment.customer_name || payment.company_name || "",
        contact: payment.phone || "",
        email: payment.email || "",
      },
      notes: {
        payment_reference: payment.payment_reference,
        lead_id: (payment as any).lead_id || "",
        customer_id: (payment as any).customer_id || "",
      },
      theme: {
        color: "#0f766e",
      },
      modal: {
        ondismiss: () => {
          console.log("Customer closed Razorpay checkout modal without completing payment");
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (errResp: any) => {
        console.error("Razorpay Payment Failed:", errResp);
        alert(
          "Payment failed: " +
            (errResp?.error?.description || "Payment was declined or cancelled")
        );
      });
      rzp.open();
    } catch (e: any) {
      console.error("Error opening Razorpay modal:", e);
      alert("Unable to open Razorpay payment gateway: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">
            Loading payment details...
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !payment) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-destructive/20">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <img src={gravenLogo} alt="Graven OneDesk" className="h-7 w-7 rounded object-contain" />
              <span className="font-bold tracking-tight text-foreground">Graven OneDesk</span>
            </div>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Payment Link Not Found</CardTitle>
            <CardDescription className="text-xs">
              {errorMsg || "The requested payment reference is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="bg-muted p-3 rounded-lg text-xs font-mono break-all text-center">
              Ref: {ref || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Please check your payment link or contact your Graven support executive.
            </p>
            <Button
              variant="outline"
              className="w-full text-xs"
              onClick={() => navigate("/")}
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = payment.status === "paid";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6">
      <Card className="max-w-lg w-full shadow-xl border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
        {/* Top Header */}
        <div className="bg-primary/5 border-b border-primary/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={gravenLogo} alt="Graven OneDesk" className="h-8 w-8 rounded-lg object-contain" />
            <div>
              <h1 className="font-bold text-base text-foreground leading-none">Graven OneDesk</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Secure Customer Payment Gateway</p>
            </div>
          </div>
          <Badge
            variant={isPaid ? "default" : "secondary"}
            className={
              isPaid
                ? "bg-emerald-600 hover:bg-emerald-600 text-white font-semibold text-xs px-2.5 py-0.5"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300 font-medium text-xs px-2.5 py-0.5"
            }
          >
            {isPaid ? "PAID & VERIFIED" : "PENDING PAYMENT"}
          </Badge>
        </div>

        <CardContent className="p-6 space-y-5">
          {/* PAID & VERIFIED STATE */}
          {isPaid && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/60 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                Payment Successful!
              </h2>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed max-w-sm mx-auto">
                Thank you! Your payment has been confirmed. A dedicated Technical Solutions & Testing (TST) case has been created and assigned to our engineering desk.
              </p>
              {createdCaseId && (
                <div className="inline-block bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-emerald-300 text-[11px] font-mono text-emerald-700">
                  Case ID: #{createdCaseId.slice(0, 8)}
                </div>
              )}
            </div>
          )}

          {/* PAYMENT DETAILS SUMMARY */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b text-xs">
              <span className="text-muted-foreground">Payment Reference</span>
              <span className="font-mono font-semibold text-foreground">{payment.payment_reference}</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Service Purpose:</span>
                <span className="font-medium text-right text-foreground max-w-[220px]">
                  {payment.purpose || "Technical Consultation & TST Support"}
                </span>
              </div>

              {payment.customer_name && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Customer Name:
                  </span>
                  <span className="font-medium text-foreground">{payment.customer_name}</span>
                </div>
              )}

              {payment.company_name && payment.company_name !== payment.customer_name && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Company:
                  </span>
                  <span className="font-medium text-foreground">{payment.company_name}</span>
                </div>
              )}

              {payment.phone && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Contact Phone:
                  </span>
                  <span className="font-mono text-foreground">{payment.phone}</span>
                </div>
              )}

              {payment.created_at && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Generated:
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(payment.created_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              )}

              {isPaid && payment.paid_at && (
                <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3" /> Paid At:
                  </span>
                  <span>
                    {new Date(payment.paid_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              )}

              {isPaid && payment.provider_payment_id && (
                <div className="flex justify-between items-center pt-1 border-t text-[11px]">
                  <span className="text-muted-foreground">Transaction ID:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {payment.provider_payment_id}
                  </span>
                </div>
              )}
            </div>

            {/* Total Amount Row */}
            <div className="pt-2 border-t flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">
                  {isPaid ? "Total Paid" : "Total Amount Due"}
                </span>
                <span className="text-[10px] text-muted-foreground">Inclusive of GST</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{Number(payment.amount).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS IF NOT PAID */}
          {!isPaid ? (
            <div className="space-y-3 pt-1">
              <Button
                onClick={handlePay}
                disabled={processing}
                className="w-full h-11 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Pay ₹{Number(payment.amount).toLocaleString("en-IN")} via Razorpay
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>100% Secure Checkout · Razorpay 256-bit Encryption</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <Button
                variant="outline"
                className="w-full text-xs gap-1.5 h-10 border-slate-300"
                onClick={() => window.print()}
              >
                Print / Save Receipt
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
