import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTenantStatus } from '@/hooks/useTenantStatus';
import { useTenantSubscriptions } from '@/hooks/useTenantSubscriptions';
import { RazorpayCheckout } from '@/components/payments/RazorpayCheckout';
import { CreditCard, Calendar, Users, AlertTriangle, Tag, Loader2, CheckCircle2, Minus, Plus } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type PlanType = 'monthly' | 'half_yearly' | 'annual';

const PLAN_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  half_yearly: 'Half-Yearly',
  annual: 'Annual',
};

const PRICING: Record<PlanType, { perUser: number; months: number }> = {
  monthly: { perUser: 1500, months: 1 },
  half_yearly: { perUser: 1200, months: 6 },
  annual: { perUser: 750, months: 12 },
};

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  trial: { label: 'Free Trial', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  expired: { label: 'Expired', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
};

export function SubscriptionManagement() {
  const { tenant, isExpired } = useTenantStatus();
  const { subscriptions, loading } = useTenantSubscriptions();
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [userCount, setUserCount] = useState<number>(0);
  const [userCountInitialized, setUserCountInitialized] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<{ valid: boolean; discount_amount: number; description: string; final_amount: number; subtotal: number } | null>(null);

  // Initialize user count from tenant
  if (tenant && !userCountInitialized) {
    setUserCount(tenant.max_users || 1);
    setUserCountInitialized(true);
  }

  if (!tenant) return null;

  const status = tenant.subscription_status;
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.expired;
  const trialEnd = new Date(tenant.trial_end_date);
  const daysRemaining = Math.max(0, differenceInDays(trialEnd, new Date()));
  const isTrial = status === 'trial';
  const needsUpgrade = isExpired || status === 'cancelled';

  const selectedPricing = selectedPlan ? PRICING[selectedPlan] : null;
  const subtotal = selectedPricing ? userCount * selectedPricing.perUser * selectedPricing.months : 0;
  const discountAmount = couponResult?.valid ? couponResult.discount_amount : 0;
  const finalAmount = subtotal - discountAmount;

  const handleValidateCoupon = async () => {
    if (!couponCode.trim() || !selectedPlan) {
      toast.error('Please select a plan and enter a coupon code');
      return;
    }
    setCouponValidating(true);
    setCouponResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: { coupon_code: couponCode, plan_type: selectedPlan, user_count: userCount },
      });
      if (error) throw error;
      setCouponResult(data);
      if (!data.valid) {
        toast.error(data.error || 'Invalid coupon');
      }
    } catch {
      toast.error('Failed to validate coupon');
    } finally {
      setCouponValidating(false);
    }
  };

  const handleClearCoupon = () => {
    setCouponCode('');
    setCouponResult(null);
  };

  // Reset coupon when plan or user count changes
  const handlePlanChange = (plan: PlanType) => {
    setSelectedPlan(plan);
    setCouponResult(null);
  };

  const handleUserCountChange = (delta: number) => {
    const newCount = Math.max(1, userCount + delta);
    setUserCount(newCount);
    setCouponResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription Status
              </CardTitle>
              <CardDescription>{tenant.company_name}</CardDescription>
            </div>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {isTrial ? 'Trial Ends' : 'Status'}
                </p>
                <p className="font-medium">
                  {isTrial
                    ? `${format(trialEnd, 'dd MMM yyyy')} (${daysRemaining} days left)`
                    : badge.label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Max Users</p>
                <p className="font-medium">{tenant.max_users}</p>
              </div>
            </div>
          </div>

          {needsUpgrade && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">
                Your subscription has expired. Please upgrade to continue using the platform.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade / Change Plan */}
      <Card>
        <CardHeader>
          <CardTitle>{needsUpgrade ? 'Subscribe Now' : 'Change Plan'}</CardTitle>
          <CardDescription>Select a plan, choose user count, and apply promo codes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Selection */}
          <div className="grid gap-3 sm:grid-cols-3">
            {(['monthly', 'half_yearly', 'annual'] as PlanType[]).map((plan) => (
              <Button
                key={plan}
                variant={selectedPlan === plan ? 'default' : 'outline'}
                className="h-auto flex-col py-4"
                onClick={() => handlePlanChange(plan)}
              >
                <span className="font-semibold">{PLAN_LABELS[plan]}</span>
                <span className="text-xs text-muted-foreground">
                  {plan === 'monthly' && '₹1,500/user/mo'}
                  {plan === 'half_yearly' && '₹1,200/user/mo'}
                  {plan === 'annual' && '₹750/user/mo'}
                </span>
              </Button>
            ))}
          </div>

          {selectedPlan && (
            <>
              {/* User Count */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Number of Users</label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" onClick={() => handleUserCountChange(-1)} disabled={userCount <= 1}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={userCount}
                    onChange={(e) => { setUserCount(Math.max(1, parseInt(e.target.value) || 1)); setCouponResult(null); }}
                    className="w-20 text-center"
                  />
                  <Button variant="outline" size="icon" onClick={() => handleUserCountChange(1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">user(s)</span>
                </div>
              </div>

              {/* Coupon Code */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Promo Code</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                      placeholder="Enter promo code"
                      className="pl-9 uppercase"
                      disabled={couponResult?.valid}
                    />
                  </div>
                  {couponResult?.valid ? (
                    <Button variant="outline" size="sm" onClick={handleClearCoupon}>Remove</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleValidateCoupon} disabled={couponValidating || !couponCode.trim()}>
                      {couponValidating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Apply
                    </Button>
                  )}
                </div>
                {couponResult?.valid && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{couponResult.description} — You save ₹{couponResult.discount_amount.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{PLAN_LABELS[selectedPlan]} × {userCount} user(s) × {PRICING[selectedPlan].months} month(s)</span>
                  <span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Discount ({couponCode})</span>
                    <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">₹{finalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Pay Button */}
              <RazorpayCheckout
                planType={selectedPlan}
                userCount={userCount}
                tenantId={tenant.id}
                couponCode={couponResult?.valid ? couponCode : undefined}
                discountAmount={discountAmount}
                buttonLabel={needsUpgrade ? 'Subscribe Now' : 'Upgrade Plan'}
                onSuccess={() => window.location.reload()}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>{format(new Date(sub.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{PLAN_LABELS[sub.plan_type] ?? sub.plan_type}</TableCell>
                    <TableCell>{sub.user_count}</TableCell>
                    <TableCell>₹{Number(sub.total_amount).toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Badge variant={sub.payment_status === 'paid' ? 'default' : 'outline'}>
                        {sub.payment_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
