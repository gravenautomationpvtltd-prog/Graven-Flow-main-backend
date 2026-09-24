import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { usePricingKPIs } from '@/hooks/usePricingIntelligence';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessDenied } from '@/components/ui/access-denied';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { ProductPricingTable } from '@/components/pricing-intelligence/ProductPricingTable';
import { SupplierPerformanceAnalytics } from '@/components/pricing-intelligence/SupplierPerformanceAnalytics';
import { SupplierCorrelationChart } from '@/components/pricing-intelligence/SupplierCorrelationChart';
import { WinLossBreakdown } from '@/components/pricing-intelligence/WinLossBreakdown';
import { PricingTrendsChart } from '@/components/pricing-intelligence/PricingTrendsChart';
import { PricingAlertsPanel } from '@/components/pricing-intelligence/PricingAlertsPanel';
import { KPIDetailDialog } from '@/components/pricing-intelligence/KPIDetailDialog';
import { CustomerBehaviorTab } from '@/components/pricing-intelligence/CustomerBehaviorTab';
import { AnimatedPercentage, AnimatedCurrency } from '@/components/ui/animated-counter';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  XCircle,
  BarChart3,
  Users,
  LineChart,
  PieChart
} from 'lucide-react';

type DatePreset = 'all_time' | 'this_month' | 'last_month' | 'last_30_days' | 'last_90_days' | 'this_year' | 'last_year' | 'custom';

function getDateRange(preset: DatePreset, customFrom?: Date, customTo?: Date): { from: Date | null; to: Date | null } {
  if (preset === 'custom') {
    return { from: customFrom || null, to: customTo || null };
  }
  if (preset === 'all_time') {
    return { from: null, to: null };
  }
  
  const today = new Date();
  switch (preset) {
    case 'this_month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
    case 'last_month':
      return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: new Date(today.getFullYear(), today.getMonth(), 0) };
    case 'last_30_days':
      return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), to: today };
    case 'last_90_days':
      return { from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), to: today };
    case 'this_year':
      return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear(), 11, 31) };
    case 'last_year':
      return { from: new Date(today.getFullYear() - 1, 0, 1), to: new Date(today.getFullYear() - 1, 11, 31) };
    default:
      return { from: null, to: null };
  }
}

const PricingIntelligence = () => {
  const { profile, isAdmin, isManager, isProcurement } = useAuth();
  const [activeTab, setActiveTab] = useState('products');
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [kpiDialogType, setKpiDialogType] = useState<'won' | 'lost'>('won');
  
  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>('last_90_days');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  
  const dateRange = getDateRange(datePreset, customFrom, customTo);
  
  const { data: kpis, isLoading: kpisLoading } = usePricingKPIs(dateRange);

  // Check if user has access (admin, manager, or procurement)
  const hasAccess = isAdmin || isManager || isProcurement;

  if (!hasAccess) {
    return <AccessDenied />;
  }

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return 'text-green-500';
    if (rate >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const handleKPICardClick = (type: 'winRate' | 'priceMatch' | 'won' | 'lost') => {
    switch (type) {
      case 'winRate':
        setActiveTab('winloss');
        break;
      case 'priceMatch':
        setActiveTab('products');
        break;
      case 'won':
        setKpiDialogType('won');
        setKpiDialogOpen(true);
        break;
      case 'lost':
        setKpiDialogType('lost');
        setKpiDialogOpen(true);
        break;
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: 'spring' as const, stiffness: 300, damping: 24 }
    },
  };

  const tabContentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
  };

  const kpiCards = [
    {
      id: 'winRate',
      title: 'Overall Win Rate',
      description: 'Deals won vs total deals',
      icon: Target,
      value: kpis?.overall_win_rate || 0,
      type: 'percentage' as const,
      colorClass: getWinRateColor(kpis?.overall_win_rate || 0),
      trend: '+2.3%',
      trendUp: true,
      hoverClass: 'hover:border-primary/50 hover:shadow-primary/10',
    },
    {
      id: 'priceMatch',
      title: 'Price Match Rate',
      description: 'Within 5% of target price',
      icon: BarChart3,
      value: kpis?.price_match_rate || 0,
      type: 'percentage' as const,
      colorClass: 'text-blue-500',
      trend: '+1.8%',
      trendUp: true,
      hoverClass: 'hover:border-blue-500/50 hover:shadow-blue-500/10',
    },
    {
      id: 'won',
      title: 'Revenue Won',
      description: 'Total value of won deals',
      icon: DollarSign,
      value: kpis?.total_revenue_won || 0,
      type: 'currency' as const,
      colorClass: 'text-green-500',
      trend: '+₹2.4L',
      trendUp: true,
      hoverClass: 'hover:border-green-500/50 hover:shadow-green-500/10',
    },
    {
      id: 'lost',
      title: 'Revenue Lost',
      description: 'Total value of lost deals',
      icon: XCircle,
      value: kpis?.total_revenue_lost || 0,
      type: 'currency' as const,
      colorClass: 'text-red-500',
      trend: '-₹50K',
      trendUp: true,
      hoverClass: 'hover:border-red-500/50 hover:shadow-red-500/10',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold">Pricing Intelligence</h1>
          <p className="text-muted-foreground">
            Analyze pricing performance, identify trends, and understand supplier impact on deal outcomes
          </p>
        </div>
        <DateRangeFilter
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {kpiCards.map((kpi) => (
          <motion.div
            key={kpi.id}
            variants={cardVariants}
            whileHover={{ 
              scale: 1.03, 
              y: -4,
              transition: { type: 'spring', stiffness: 400, damping: 17 }
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleKPICardClick(kpi.id as 'winRate' | 'priceMatch' | 'won' | 'lost')}
            className="cursor-pointer"
          >
            <Card className={`transition-all duration-300 hover:shadow-lg ${kpi.hoverClass}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                <motion.div
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <kpi.icon className={`h-4 w-4 ${kpi.colorClass}`} />
                </motion.div>
              </CardHeader>
              <CardContent>
                {kpisLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className={`text-2xl font-bold ${kpi.colorClass}`}>
                      {kpi.type === 'percentage' ? (
                        <AnimatedPercentage value={kpi.value} className="" />
                      ) : (
                        <AnimatedCurrency value={kpi.value} className="" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">{kpi.description}</p>
                      <div className={`flex items-center gap-1 text-xs ${kpi.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                        {kpi.trendUp ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span>{kpi.trend}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Alerts Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <PricingAlertsPanel />
      </motion.div>

      {/* Tabs Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="products" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Customers</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Suppliers</span>
            </TabsTrigger>
            <TabsTrigger value="correlation" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Correlation</span>
            </TabsTrigger>
            <TabsTrigger value="winloss" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Win/Loss</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <LineChart className="h-4 w-4" />
              <span className="hidden sm:inline">Trends</span>
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="products" className="space-y-4">
              <motion.div
                key="products"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <ProductPricingTable />
              </motion.div>
            </TabsContent>

            <TabsContent value="customers" className="space-y-4">
              <motion.div
                key="customers"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <CustomerBehaviorTab />
              </motion.div>
            </TabsContent>

            <TabsContent value="suppliers" className="space-y-4">
              <motion.div
                key="suppliers"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <SupplierPerformanceAnalytics />
              </motion.div>
            </TabsContent>

            <TabsContent value="correlation" className="space-y-4">
              <motion.div
                key="correlation"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Supplier-Product Correlation</CardTitle>
                    <CardDescription>
                      Understand which suppliers perform best for specific product categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SupplierCorrelationChart />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="winloss" className="space-y-4">
              <motion.div
                key="winloss"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Win/Loss Breakdown</CardTitle>
                    <CardDescription>
                      Detailed analysis of won and lost deals with key metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <WinLossBreakdown dateRange={dateRange} />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              <motion.div
                key="trends"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Pricing Trends</CardTitle>
                    <CardDescription>
                      Historical pricing patterns and market trends over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PricingTrendsChart />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </motion.div>

      {/* KPI Detail Dialog */}
      <KPIDetailDialog
        open={kpiDialogOpen}
        onOpenChange={setKpiDialogOpen}
        type={kpiDialogType}
        totalValue={kpiDialogType === 'won' ? (kpis?.total_revenue_won || 0) : (kpis?.total_revenue_lost || 0)}
      />
    </div>
  );
};

export default PricingIntelligence;
