import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDecisionDeckStats } from '@/hooks/useDecisionDeckStats';
import { AccessDenied } from '@/components/ui/access-denied';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Target, 
  CheckSquare, 
  DollarSign, 
  Trophy, 
  AlertTriangle, 
  Users, 
  Box,
  Zap,
  ShoppingCart
} from 'lucide-react';
import { ApprovalsHub } from '@/components/decision-deck/ApprovalsHub';
import { FinancialSnapshot } from '@/components/decision-deck/FinancialSnapshot';
import { PerformanceScoreboard } from '@/components/decision-deck/PerformanceScoreboard';
import { StrategicAlerts } from '@/components/decision-deck/StrategicAlerts';
import { CustomerIntelligencePanel } from '@/components/decision-deck/CustomerIntelligencePanel';
import { SKUIntelligencePanel } from '@/components/decision-deck/SKUIntelligencePanel';
import { QuickActionsPanel } from '@/components/decision-deck/QuickActionsPanel';
import { ProcurementPerformanceBoard } from '@/components/procurement/ProcurementPerformanceBoard';
import { DateRangeFilter, type DatePreset, getDateRangeFromPreset } from '@/components/ui/date-range-filter';

export default function DecisionDeck() {
  const { isAdmin } = useAuth();
  const { data: stats, isLoading } = useDecisionDeckStats();
  
  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  if (!isAdmin) {
    return <AccessDenied message="Decision Deck is only available to CEO & COO." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Executive Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Decision Deck</h1>
                <p className="text-sm text-muted-foreground">CEO War Room • Executive Command Center</p>
              </div>
            </div>
            <DateRangeFilter
              datePreset={datePreset}
              onDatePresetChange={setDatePreset}
              customFrom={customFrom}
              customTo={customTo}
              onCustomFromChange={setCustomFrom}
              onCustomToChange={setCustomTo}
            />
          </div>

          {/* Executive KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <KPICard
            label="Pending Approvals"
            value={stats?.totalPendingApprovals || 0}
            icon={CheckSquare}
            isLoading={isLoading}
            variant={(stats?.totalPendingApprovals || 0) > 0 ? 'warning' : 'default'}
          />
          <KPICard
            label="MTD Revenue"
            value={stats?.mtdRevenue || 0}
            icon={DollarSign}
            isLoading={isLoading}
            format="currency"
          />
          <KPICard
            label="High Risk Customers"
            value={stats?.dropRiskCustomers || 0}
            icon={Users}
            isLoading={isLoading}
            variant={(stats?.dropRiskCustomers || 0) > 0 ? 'danger' : 'default'}
          />
          <KPICard
            label="Dead Stock SKUs"
            value={stats?.highDeadStockRiskSKUs || 0}
            icon={Box}
            isLoading={isLoading}
            variant={(stats?.highDeadStockRiskSKUs || 0) > 0 ? 'warning' : 'default'}
          />
          <KPICard
            label="Critical Alerts"
            value={stats?.criticalAlerts || 0}
            icon={AlertTriangle}
            isLoading={isLoading}
            variant={(stats?.criticalAlerts || 0) > 0 ? 'danger' : 'default'}
          />
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="container py-6">
        <Tabs defaultValue="approvals" className="space-y-6">
          <TabsList className="grid grid-cols-4 lg:grid-cols-7 h-auto gap-2 bg-muted/50 p-1">
            <TabsTrigger value="approvals" className="flex items-center gap-2 data-[state=active]:bg-background">
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Approvals</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2 data-[state=active]:bg-background">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financial</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Sales</span>
            </TabsTrigger>
            <TabsTrigger value="procurement" className="flex items-center gap-2 data-[state=active]:bg-background">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Procurement</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2 data-[state=active]:bg-background">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Customers</span>
            </TabsTrigger>
            <TabsTrigger value="skus" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Box className="h-4 w-4" />
              <span className="hidden sm:inline">SKUs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approvals">
            <ApprovalsHub />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialSnapshot />
          </TabsContent>

          <TabsContent value="performance">
            <PerformanceScoreboard />
          </TabsContent>

          <TabsContent value="procurement">
            <ProcurementPerformanceBoard />
          </TabsContent>

          <TabsContent value="alerts">
            <StrategicAlerts />
          </TabsContent>

          <TabsContent value="customers">
            <CustomerIntelligencePanel />
          </TabsContent>

          <TabsContent value="skus">
            <SKUIntelligencePanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Actions Floating Panel */}
      <QuickActionsPanel />
    </div>
  );
}

interface KPICardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  format?: 'number' | 'currency';
  variant?: 'default' | 'warning' | 'danger';
}

function KPICard({ label, value, icon: Icon, isLoading, format = 'number', variant = 'default' }: KPICardProps) {
  const formatValue = (val: number) => {
    if (format === 'currency') {
      if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
      if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
      if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
      return `₹${val.toLocaleString()}`;
    }
    return val.toLocaleString();
  };

  const variantStyles = {
    default: 'bg-card',
    warning: 'bg-amber-500/10 border-amber-500/30',
    danger: 'bg-destructive/10 border-destructive/30'
  };

  return (
    <Card className={`${variantStyles[variant]} transition-all hover:shadow-md`}>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold">{formatValue(value)}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
