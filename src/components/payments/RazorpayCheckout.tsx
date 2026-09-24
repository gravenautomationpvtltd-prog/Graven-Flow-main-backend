import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard } from 'lucide-react';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { useAuth } from '@/hooks/useAuth';
import { PaymentSuccessDialog } from './PaymentSuccessDialog';
import type { PaymentReceiptData } from './generatePaymentReceipt';

type PlanType = 'monthly' | 'half_yearly' | 'annual';

interface RazorpayCheckoutProps {
  planType: PlanType;
  userCount: number;
  tenantId: string;
  couponCode?: string;
  discountAmount?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  buttonLabel?: string;
  buttonVariant?: 'default' | 'outline';
  className?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

const PLAN_LABELS: Record<PlanType, string> = {
  monthly: 'Monthly',
  half_yearly: 'Half-Yearly',
  annual: 'Annual',
};

const PRICING: Record<PlanType, { perUser: number; months: number }> = {
  monthly: { perUser: 1500, months: 1 },
  half_yearly: { perUser: 1200, months: 6 },
  annual: { perUser: 750, months: 12 },
};

export function RazorpayCheckout({
  planType,
  userCount,
  tenantId,
  couponCode,
  discountAmount: propDiscountAmount,
  onSuccess,
  onCancel,
  buttonLabel = 'Pay Now',
  buttonVariant = 'default',
  className,
}: RazorpayCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null);
  const { branding } = useTenantBranding();
  const { user, profile } = useAuth();

  const handleCheckout = async () => {
    setLoading(true);
    try {
      await loadRazorpayScript();

      const { data, error } = await supabase.functions.invoke('razorpay-checkout', {
        body: { plan_type: planType, user_count: userCount, tenant_id: tenantId, coupon_code: couponCode || null },
      });

      if (error || !data?.order_id) {
        throw new Error(error?.message || data?.error || 'Failed to create order');
      }

      // Strict coupon guard: if coupon was submitted but server didn't apply it, block checkout
      if (couponCode && !data.coupon_applied) {
        throw new Error('Coupon could not be applied. Please remove or change the coupon code.');
      }

      const pricing = PRICING[planType];
      const totalAmount = data.final_amount || (userCount * pricing.perUser * pricing.months);
      const discount = data.discount_amount || 0;

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: branding.companyName,
        description: `${PLAN_LABELS[planType]} Plan - ${userCount} user(s)`,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            // Verify payment and activate subscription server-side
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              'razorpay-verify-payment',
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id || data.order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
              }
            );

            if (verifyError || (verifyData?.error)) {
              console.error('Payment verification failed:', verifyError || verifyData?.error);
              toast.error('Payment received but activation failed. Please contact support.');
            }
          } catch (verifyErr) {
            console.error('Payment verification call failed:', verifyErr);
            toast.error('Payment received but activation failed. Please contact support.');
          }

          const now = new Date();
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + pricing.months);

          const receipt: PaymentReceiptData = {
            receiptNumber: `RCP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            paymentDate: now,
            paymentId: response.razorpay_payment_id || 'N/A',
            orderId: response.razorpay_order_id || data.order_id,
            companyName: branding.companyName,
            planType,
            userCount,
            pricePerUser: pricing.perUser,
            totalAmount,
            currency: 'INR',
            customerName: profile?.full_name || undefined,
            customerEmail: user?.email || undefined,
            periodStart: now,
            periodEnd,
            discountAmount: discount,
            couponCode: data.coupon_applied ? couponCode : undefined,
          };

          setReceiptData(receipt);
          setShowSuccess(true);
        },
        modal: {
          ondismiss: () => {
            onCancel?.();
          },
        },
        theme: { color: '#2563eb' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        console.error('Payment failed:', response.error);
        toast.error(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    toast.success('Payment successful! Your subscription is now active.');
    onSuccess?.();
  };

  return (
    <>
      <Button
        onClick={handleCheckout}
        disabled={loading}
        variant={buttonVariant}
        className={className}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <CreditCard className="h-4 w-4 mr-2" />
        )}
        {loading ? 'Processing...' : buttonLabel}
      </Button>

      <PaymentSuccessDialog
        open={showSuccess}
        onOpenChange={setShowSuccess}
        receiptData={receiptData}
        onContinue={handleContinue}
      />
    </>
  );
}
