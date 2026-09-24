import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Check, Zap, Shield, Users, BarChart3, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenantStatus } from '@/hooks/useTenantStatus';
import { RazorpayCheckout } from '@/components/payments/RazorpayCheckout';

type PlanType = 'monthly' | 'half_yearly' | 'annual';

const plans: { name: string; price: number; perUser: string; billing: string; discount: string | null; popular: boolean; planType: PlanType }[] = [
  { name: 'Monthly', price: 1500, perUser: '/user/month', billing: 'Billed monthly', discount: null, popular: false, planType: 'monthly' },
  { name: 'Half-Yearly', price: 1200, perUser: '/user/month', billing: 'Billed every 6 months', discount: '20% OFF', popular: true, planType: 'half_yearly' },
  { name: 'Annual', price: 750, perUser: '/user/month', billing: 'Billed annually', discount: '50% OFF', popular: false, planType: 'annual' },
];

const features = [
  'Lead & Customer Management',
  'Quotation & Sales Orders',
  'Procurement & Inventory',
  'Invoicing & Accounts',
  'Attendance & Payroll',
  'Team Chat & Collaboration',
  'Role-based Access Control',
  'Multi-office Support',
  'Reports & Analytics',
  'Email Integration',
];

export default function Pricing() {
  const { user } = useAuth();
  const { tenant } = useTenantStatus();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);

  const isLoggedIn = !!user;
  const tenantId = tenant?.id;

  const handlePlanClick = (planType: PlanType) => {
    if (!isLoggedIn) {
      navigate('/auth?tab=signup');
      return;
    }
    setSelectedPlan(planType);
  };

  // Count active users for the tenant (default 1 for pricing page)
  const userCount = 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Graven</span>
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Button asChild>
                <Link to="/">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth?tab=signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Start with a <span className="text-primary font-semibold">30-day free demo</span>. No credit card required. Scale your team as you grow.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${
                plan.popular
                  ? 'border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                  : 'border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              {plan.discount && (
                <div className="absolute top-4 right-4 bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded">
                  {plan.discount}
                </div>
              )}
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.billing}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">₹{plan.price.toLocaleString('en-IN')}</span>
                  <span className="text-muted-foreground text-sm">{plan.perUser}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2.5 mb-8 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isLoggedIn && tenantId && selectedPlan === plan.planType ? (
                  <RazorpayCheckout
                    planType={plan.planType}
                    userCount={userCount}
                    tenantId={tenantId}
                    onSuccess={() => navigate('/dashboard')}
                    onCancel={() => setSelectedPlan(null)}
                    buttonLabel="Pay Now"
                    buttonVariant={plan.popular ? 'default' : 'outline'}
                    className="w-full"
                  />
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => handlePlanClick(plan.planType)}
                  >
                    {isLoggedIn ? 'Subscribe' : 'Start Free Demo'} <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features highlights */}
      <section className="py-16 px-6 border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-2">Everything you need to run your business</h2>
          <p className="text-muted-foreground">All plans include every feature. Pay only for the users you need.</p>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Zap, title: 'Real-time Analytics', desc: 'Live dashboards & KPIs' },
            { icon: Shield, title: 'Role-based Access', desc: 'Secure multi-level perms' },
            { icon: Users, title: 'Team Management', desc: 'Multi-office support' },
            { icon: BarChart3, title: 'Full Reports', desc: 'Export & share insights' },
          ].map((item) => (
            <div key={item.title} className="text-center p-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground text-sm">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border text-center text-sm text-muted-foreground">
        © 2024 Graven Automation. All rights reserved.
      </footer>
    </div>
  );
}
