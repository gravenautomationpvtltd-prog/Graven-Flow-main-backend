import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantStatus } from '@/hooks/useTenantStatus';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, Mail, LogOut, Minus, Plus, Users } from 'lucide-react';
import { RazorpayCheckout } from '@/components/payments/RazorpayCheckout';

type PlanType = 'monthly' | 'half_yearly' | 'annual';

const PLAN_PRICES: Record<PlanType, number> = {
  monthly: 1500,
  half_yearly: 1200,
  annual: 750,
};

const PLAN_OPTIONS: { id: PlanType; label: string; pricePerUser: number; discount?: string }[] = [
  { id: 'monthly', label: 'Monthly', pricePerUser: 1500 },
  { id: 'half_yearly', label: 'Half-Yearly', pricePerUser: 1200, discount: '20% off' },
  { id: 'annual', label: 'Annual', pricePerUser: 750, discount: '50% off' },
];

export default function SubscriptionExpired() {
  const { tenant, tenantUser } = useTenantStatus();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('half_yearly');
  const [userCount, setUserCount] = useState(1);

  const isOwnerOrAdmin = tenantUser?.role === 'owner' || tenantUser?.role === 'admin';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const pricePerUser = PLAN_PRICES[selectedPlan];
  const totalMonthly = pricePerUser * userCount;
  const billingMultiplier = selectedPlan === 'annual' ? 12 : selectedPlan === 'half_yearly' ? 6 : 1;
  const totalBilling = totalMonthly * billingMultiplier;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">
            {tenant?.subscription_status === 'trial'
              ? 'Your Free Trial Has Ended'
              : 'Subscription Expired'}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {tenant?.company_name
              ? `Access for ${tenant.company_name} has been suspended.`
              : 'Your access has been suspended.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isOwnerOrAdmin ? (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Choose a plan and number of users to restore access.
              </p>

              {/* User Count Selector */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Number of Users</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setUserCount(Math.max(1, userCount - 1))}
                      disabled={userCount <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-lg font-bold text-foreground w-8 text-center">{userCount}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setUserCount(userCount + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Plan Selection */}
              <div className="space-y-2">
                {PLAN_OPTIONS.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                      selectedPlan === plan.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{plan.label}</span>
                      {plan.discount && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{plan.discount}</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">₹{plan.pricePerUser.toLocaleString('en-IN')}/user/mo</span>
                  </button>
                ))}
              </div>

              {/* Price Summary */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>₹{pricePerUser.toLocaleString('en-IN')} × {userCount} user{userCount > 1 ? 's' : ''} × {billingMultiplier} month{billingMultiplier > 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-foreground">
                  <span>Total</span>
                  <span>₹{totalBilling.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {tenant?.id && (
                  <RazorpayCheckout
                    planType={selectedPlan}
                    userCount={userCount}
                    tenantId={tenant.id}
                    onSuccess={() => navigate('/dashboard')}
                    buttonLabel="Subscribe Now"
                    className="w-full"
                  />
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <Mail className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Please contact your organization administrator to renew the subscription.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
