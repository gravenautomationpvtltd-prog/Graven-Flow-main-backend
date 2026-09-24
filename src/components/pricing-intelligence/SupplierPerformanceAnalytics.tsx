import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Star,
  CheckCircle2,
  XCircle,
  Package,
  ChevronRight,
  Target,
  DollarSign,
  Search,
  ArrowUpDown,
  Download,
  BarChart3,
  Eye,
  Sparkles,
  Filter,
  X,
} from 'lucide-react';
import { useSupplierPerformanceAnalytics, type SupplierPerformanceDetail } from '@/hooks/usePricingIntelligence';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};

const cardHoverVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2 } },
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

type SortField = 'win_rate' | 'total_enquiries' | 'total_revenue_won' | 'total_revenue_lost';
type SortDirection = 'asc' | 'desc';
type FilterCategory = 'all' | 'top_performer' | 'good' | 'needs_review' | 'renegotiate';

export function SupplierPerformanceAnalytics() {
  const { data: suppliers, isLoading } = useSupplierPerformanceAnalytics();
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierPerformanceDetail | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_enquiries');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [dialogTab, setDialogTab] = useState<'overview' | 'products'>('overview');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRecommendationBadge = (recommendation: SupplierPerformanceDetail['recommendation'], animate = false) => {
    const badges = {
      top_performer: (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          <Star className={`h-3 w-3 mr-1 ${animate ? 'animate-pulse' : ''}`} />
          Top Performer
        </Badge>
      ),
      good: (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Good
        </Badge>
      ),
      needs_review: (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Needs Review
        </Badge>
      ),
      renegotiate: (
        <Badge className={`bg-red-500/10 text-red-500 border-red-500/20 ${animate ? 'animate-pulse' : ''}`}>
          <XCircle className="h-3 w-3 mr-1" />
          Renegotiate
        </Badge>
      ),
    };
    return badges[recommendation];
  };

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return 'hsl(var(--chart-2))';
    if (rate >= 40) return 'hsl(var(--chart-4))';
    return 'hsl(var(--chart-5))';
  };

  const getRowBgClass = (recommendation: SupplierPerformanceDetail['recommendation']) => {
    switch (recommendation) {
      case 'top_performer':
        return 'bg-green-500/5 hover:bg-green-500/10';
      case 'renegotiate':
        return 'bg-red-500/5 hover:bg-red-500/10';
      default:
        return 'hover:bg-muted/50';
    }
  };

  // Filtered and sorted suppliers
  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];

    let result = [...suppliers];

    // Apply search filter
    if (searchQuery) {
      result = result.filter(s =>
        s.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (activeFilter !== 'all') {
      result = result.filter(s => s.recommendation === activeFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const modifier = sortDirection === 'desc' ? -1 : 1;
      return ((aValue || 0) - (bValue || 0)) * modifier;
    });

    return result;
  }, [suppliers, searchQuery, activeFilter, sortField, sortDirection]);

  // Summary stats
  const stats = useMemo(() => {
    if (!suppliers) return { topPerformers: 0, needsRenegotiation: 0, totalRevenueWon: 0, totalRevenueLost: 0 };
    return {
      topPerformers: suppliers.filter(s => s.recommendation === 'top_performer').length,
      needsRenegotiation: suppliers.filter(s => s.recommendation === 'renegotiate').length,
      totalRevenueWon: suppliers.reduce((sum, s) => sum + s.total_revenue_won, 0),
      totalRevenueLost: suppliers.reduce((sum, s) => sum + s.total_revenue_lost, 0),
    };
  }, [suppliers]);

  // Chart data
  const chartData = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.slice(0, 10).map(s => ({
      name: s.supplier_name.length > 12 ? s.supplier_name.substring(0, 12) + '...' : s.supplier_name,
      fullName: s.supplier_name,
      supplierId: s.supplier_id,
      winRate: s.win_rate,
      won: s.enquiries_won,
      lost: s.enquiries_lost,
    }));
  }, [suppliers]);

  const recommendationData = useMemo(() => {
    if (!suppliers) return [];
    const counts = {
      top_performer: suppliers.filter(s => s.recommendation === 'top_performer').length,
      good: suppliers.filter(s => s.recommendation === 'good').length,
      needs_review: suppliers.filter(s => s.recommendation === 'needs_review').length,
      renegotiate: suppliers.filter(s => s.recommendation === 'renegotiate').length,
    };
    return [
      { name: 'Top Performers', value: counts.top_performer, fill: 'hsl(var(--chart-2))', category: 'top_performer' as FilterCategory },
      { name: 'Good', value: counts.good, fill: 'hsl(var(--chart-1))', category: 'good' as FilterCategory },
      { name: 'Needs Review', value: counts.needs_review, fill: 'hsl(var(--chart-4))', category: 'needs_review' as FilterCategory },
      { name: 'Renegotiate', value: counts.renegotiate, fill: 'hsl(var(--chart-5))', category: 'renegotiate' as FilterCategory },
    ].filter(d => d.value > 0);
  }, [suppliers]);

  const handleBarClick = (data: any) => {
    if (!suppliers) return;
    const supplier = suppliers.find(s => s.supplier_id === data.supplierId);
    if (supplier) {
      setSelectedSupplier(supplier);
      setDialogTab('overview');
    }
  };

  const handlePieClick = (data: any) => {
    if (data?.category) {
      setActiveFilter(data.category);
    }
  };

  const handleExportCSV = () => {
    if (!filteredSuppliers.length) return;

    const headers = ['Supplier', 'Products', 'Enquiries', 'Won', 'Lost', 'Win Rate', 'Revenue Won', 'Revenue Lost', 'Status'];
    const rows = filteredSuppliers.map(s => [
      s.supplier_name,
      s.total_products,
      s.total_enquiries,
      s.enquiries_won,
      s.enquiries_lost,
      `${s.win_rate.toFixed(1)}%`,
      s.total_revenue_won,
      s.total_revenue_lost,
      s.recommendation,
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplier-performance.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const clearFilters = () => {
    setActiveFilter('all');
    setSearchQuery('');
    setSortField('total_enquiries');
    setSortDirection('desc');
  };

  const hasActiveFilters = activeFilter !== 'all' || searchQuery !== '';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!suppliers || suppliers.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12 text-muted-foreground"
      >
        <Package className="h-12 w-12 mb-4 opacity-50" />
        <p className="font-medium">No supplier performance data available</p>
        <p className="text-sm mt-1">Link suppliers to enquiry items to see analytics</p>
      </motion.div>
    );
  }

  const topPerformers = suppliers.filter(s => s.recommendation === 'top_performer');
  const needsRenegotiation = suppliers.filter(s => s.recommendation === 'renegotiate');

  return (
    <TooltipProvider>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Summary Cards - Clickable Filters */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              icon: Star,
              label: 'Top Performers',
              value: stats.topPerformers,
              color: 'green',
              filter: 'top_performer' as FilterCategory,
            },
            {
              icon: AlertTriangle,
              label: 'Need Renegotiation',
              value: stats.needsRenegotiation,
              color: 'red',
              filter: 'renegotiate' as FilterCategory,
            },
            {
              icon: TrendingUp,
              label: 'Revenue Won',
              value: formatCurrency(stats.totalRevenueWon),
              color: 'green',
              isRevenue: true,
            },
            {
              icon: TrendingDown,
              label: 'Revenue Lost',
              value: formatCurrency(stats.totalRevenueLost),
              color: 'red',
              isRevenue: true,
            },
          ].map((card, index) => (
            <motion.div
              key={index}
              variants={cardHoverVariants}
              initial="rest"
              whileHover={card.filter ? 'hover' : undefined}
              whileTap={card.filter ? { scale: 0.98 } : undefined}
            >
              <Card
                className={`transition-all duration-200 ${
                  card.filter
                    ? 'cursor-pointer hover:shadow-lg'
                    : ''
                } ${
                  activeFilter === card.filter
                    ? card.color === 'green'
                      ? 'ring-2 ring-green-500 bg-green-500/5'
                      : 'ring-2 ring-red-500 bg-red-500/5'
                    : ''
                }`}
                onClick={() => {
                  if (card.filter) {
                    setActiveFilter(activeFilter === card.filter ? 'all' : card.filter);
                  }
                }}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.1, type: 'spring' }}
                      className={`p-2 rounded-lg ${
                        card.color === 'green' ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}
                    >
                      <card.icon
                        className={`h-5 w-5 ${
                          card.color === 'green' ? 'text-green-500' : 'text-red-500'
                        }`}
                      />
                    </motion.div>
                    <div>
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.1 + 0.2 }}
                        className={`${card.isRevenue ? 'text-lg' : 'text-2xl'} font-bold ${
                          card.color === 'green' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {card.value}
                      </motion.p>
                    </div>
                    {card.filter && activeFilter === card.filter && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto"
                      >
                        <CheckCircle2 className={`h-5 w-5 ${
                          card.color === 'green' ? 'text-green-500' : 'text-red-500'
                        }`} />
                      </motion.div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Charts Section */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Win Rate Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Supplier Win Rates
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">
                    Click bars to view details
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click on any bar to open supplier details</p>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    onClick={(e) => e?.activePayload?.[0] && handleBarClick(e.activePayload[0].payload)}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      className="fill-muted-foreground"
                    />
                    <RechartsTooltip
                      formatter={(value: number, name, props) => [
                        <span key="value" className="font-semibold">{value.toFixed(1)}% win rate</span>,
                        <span key="details" className="text-xs text-muted-foreground">
                          {props.payload.won} won, {props.payload.lost} lost
                        </span>,
                      ]}
                      labelFormatter={(label, payload) => (
                        <span className="font-medium">{payload?.[0]?.payload?.fullName || label}</span>
                      )}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                    />
                    <Bar dataKey="winRate" radius={[4, 4, 0, 0]} className="cursor-pointer">
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getWinRateColor(entry.winRate)}
                          className="transition-all duration-200 hover:opacity-80"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Breakdown Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Supplier Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={recommendationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      onClick={(_, index) => handlePieClick(recommendationData[index])}
                      className="cursor-pointer"
                    >
                      {recommendationData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.fill}
                          className="transition-all duration-200 hover:opacity-80"
                          stroke={activeFilter === entry.category ? 'hsl(var(--foreground))' : 'transparent'}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name) => [
                        <span key="value" className="font-semibold">{value} suppliers</span>,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {recommendationData.map((d, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveFilter(activeFilter === d.category ? 'all' : d.category)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all ${
                      activeFilter === d.category
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill }} />
                    <span>{d.name}: {d.value}</span>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actionable Insights */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-green-500/20 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
                <Star className="h-4 w-4" />
                Top Performers - Prioritize Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[150px]">
                {topPerformers.length > 0 ? (
                  <motion.ul className="space-y-2" variants={containerVariants}>
                    {topPerformers.slice(0, 5).map((s, index) => (
                      <motion.li
                        key={s.supplier_id}
                        variants={tableRowVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ x: 4, backgroundColor: 'hsl(var(--muted) / 0.5)' }}
                        className="flex items-center justify-between p-2 rounded-lg cursor-pointer group"
                        onClick={() => {
                          setSelectedSupplier(s);
                          setDialogTab('overview');
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                            className="text-green-500"
                          >
                            <Star className="h-4 w-4" />
                          </motion.div>
                          <div>
                            <p className="font-medium text-sm">{s.supplier_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.enquiries_won} won • {s.win_rate.toFixed(0)}% win rate
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.li>
                    ))}
                  </motion.ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No top performers yet</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Need Renegotiation - Review Pricing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[150px]">
                {needsRenegotiation.length > 0 ? (
                  <motion.ul className="space-y-2" variants={containerVariants}>
                    {needsRenegotiation.slice(0, 5).map((s, index) => (
                      <motion.li
                        key={s.supplier_id}
                        variants={tableRowVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ x: 4, backgroundColor: 'hsl(var(--muted) / 0.5)' }}
                        className="flex items-center justify-between p-2 rounded-lg cursor-pointer group"
                        onClick={() => {
                          setSelectedSupplier(s);
                          setDialogTab('overview');
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-red-500"
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </motion.div>
                          <div>
                            <p className="font-medium text-sm">{s.supplier_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.enquiries_lost} lost • {s.win_rate.toFixed(0)}% win rate
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.li>
                    ))}
                  </motion.ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No suppliers flagged for renegotiation</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Full Supplier Table with Filters */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-sm font-medium">All Suppliers Performance</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search suppliers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 w-[180px]"
                    />
                  </div>

                  {/* Sort */}
                  <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                    <SelectTrigger className="h-9 w-[150px]">
                      <ArrowUpDown className="h-3 w-3 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total_enquiries">Total Enquiries</SelectItem>
                      <SelectItem value="win_rate">Win Rate</SelectItem>
                      <SelectItem value="total_revenue_won">Revenue Won</SelectItem>
                      <SelectItem value="total_revenue_lost">Revenue Lost</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Export */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export to CSV</TooltipContent>
                  </Tooltip>

                  {/* Clear Filters */}
                  <AnimatePresence>
                    {hasActiveFilters && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1">
                          <X className="h-3 w-3" />
                          Clear
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Category Filter Tabs */}
              <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterCategory)} className="mt-4">
                <TabsList className="grid grid-cols-5 w-full max-w-lg">
                  <TabsTrigger value="all" className="text-xs">All ({suppliers.length})</TabsTrigger>
                  <TabsTrigger value="top_performer" className="text-xs text-green-600">
                    Top ({topPerformers.length})
                  </TabsTrigger>
                  <TabsTrigger value="good" className="text-xs">
                    Good ({suppliers.filter(s => s.recommendation === 'good').length})
                  </TabsTrigger>
                  <TabsTrigger value="needs_review" className="text-xs text-yellow-600">
                    Review ({suppliers.filter(s => s.recommendation === 'needs_review').length})
                  </TabsTrigger>
                  <TabsTrigger value="renegotiate" className="text-xs text-red-600">
                    Renegotiate ({needsRenegotiation.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-center">Products</TableHead>
                      <TableHead className="text-center">Enquiries</TableHead>
                      <TableHead className="text-center">Won</TableHead>
                      <TableHead className="text-center">Lost</TableHead>
                      <TableHead>
                        <button
                          onClick={() => toggleSort('win_rate')}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          Win Rate
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          onClick={() => toggleSort('total_revenue_won')}
                          className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                        >
                          Revenue Won
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filteredSuppliers.map((supplier, index) => (
                        <motion.tr
                          key={supplier.supplier_id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.02 }}
                          whileHover={{ scale: 1.01 }}
                          className={`cursor-pointer transition-colors ${getRowBgClass(supplier.recommendation)}`}
                          onClick={() => {
                            setSelectedSupplier(supplier);
                            setDialogTab('overview');
                          }}
                        >
                          <TableCell className="font-medium">{supplier.supplier_name}</TableCell>
                          <TableCell className="text-center">{supplier.total_products}</TableCell>
                          <TableCell className="text-center">{supplier.total_enquiries}</TableCell>
                          <TableCell className="text-center text-green-600 font-medium">{supplier.enquiries_won}</TableCell>
                          <TableCell className="text-center text-red-600 font-medium">{supplier.enquiries_lost}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ delay: index * 0.03, duration: 0.5 }}
                              >
                                <Progress value={supplier.win_rate} className="h-2 w-16" />
                              </motion.div>
                              <span className="text-sm font-medium">{supplier.win_rate.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {formatCurrency(supplier.total_revenue_won)}
                          </TableCell>
                          <TableCell>
                            {getRecommendationBadge(supplier.recommendation, supplier.recommendation === 'renegotiate')}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
              {filteredSuppliers.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-muted-foreground"
                >
                  <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No suppliers match your filters</p>
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Clear all filters
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Supplier Detail Dialog with Tabs */}
      <Dialog open={!!selectedSupplier} onOpenChange={() => setSelectedSupplier(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <motion.div
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <Package className="h-5 w-5" />
              </motion.div>
              {selectedSupplier?.supplier_name}
              <span className="ml-2">
                {selectedSupplier && getRecommendationBadge(selectedSupplier.recommendation)}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedSupplier && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 overflow-y-auto space-y-6"
            >
              {/* Dialog Tabs */}
              <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as 'overview' | 'products')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="products" className="gap-2">
                    <Package className="h-4 w-4" />
                    Products ({selectedSupplier.products.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <AnimatePresence mode="wait">
                {dialogTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    {/* Key Metrics */}
                    <div className="grid grid-cols-4 gap-4">
                      {[
                        { value: selectedSupplier.total_enquiries, label: 'Total Enquiries', bg: 'bg-muted/50' },
                        { value: selectedSupplier.enquiries_won, label: 'Won', bg: 'bg-green-500/10', color: 'text-green-600' },
                        { value: selectedSupplier.enquiries_lost, label: 'Lost', bg: 'bg-red-500/10', color: 'text-red-600' },
                        { value: `${selectedSupplier.win_rate.toFixed(0)}%`, label: 'Win Rate', bg: 'bg-primary/10', color: 'text-primary' },
                      ].map((metric, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className={`p-3 rounded-lg text-center ${metric.bg}`}
                        >
                          <p className={`text-2xl font-bold ${metric.color || ''}`}>{metric.value}</p>
                          <p className="text-xs text-muted-foreground">{metric.label}</p>
                        </motion.div>
                      ))}
                    </div>

                    {/* Revenue Impact */}
                    <div className="grid grid-cols-2 gap-4">
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Revenue Won</span>
                        </div>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(selectedSupplier.total_revenue_won)}
                        </p>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium">Revenue Lost</span>
                        </div>
                        <p className="text-xl font-bold text-red-600">
                          {formatCurrency(selectedSupplier.total_revenue_lost)}
                        </p>
                      </motion.div>
                    </div>

                    {/* Recommendation */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className={`p-4 rounded-lg ${
                        selectedSupplier.recommendation === 'top_performer'
                          ? 'bg-green-500/5 border border-green-500/20'
                          : selectedSupplier.recommendation === 'renegotiate'
                          ? 'bg-red-500/5 border border-red-500/20'
                          : 'bg-muted/50 border'
                      }`}
                    >
                      <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Recommendation
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedSupplier.recommendation === 'top_performer' &&
                          'This supplier consistently helps win deals. Prioritize orders from them and consider expanding product range.'}
                        {selectedSupplier.recommendation === 'good' &&
                          'Good performance. Monitor and maintain relationship.'}
                        {selectedSupplier.recommendation === 'needs_review' &&
                          'Performance needs review. Consider pricing discussions or finding alternatives.'}
                        {selectedSupplier.recommendation === 'renegotiate' &&
                          'High loss rate suggests pricing issues. Renegotiate terms or find alternative suppliers for better competitiveness.'}
                      </p>
                    </motion.div>
                  </motion.div>
                )}

                {dialogTab === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    {selectedSupplier.products.length > 0 ? (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-center">Quotes</TableHead>
                              <TableHead className="text-center">Won</TableHead>
                              <TableHead className="text-center">Lost</TableHead>
                              <TableHead className="text-right">Avg Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedSupplier.products.map((p, index) => (
                              <motion.tr
                                key={p.product_id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="hover:bg-muted/50 cursor-pointer"
                              >
                                <TableCell className="font-medium">{p.product_name}</TableCell>
                                <TableCell className="text-center">{p.times_quoted}</TableCell>
                                <TableCell className="text-center text-green-600">{p.won}</TableCell>
                                <TableCell className="text-center text-red-600">{p.lost}</TableCell>
                                <TableCell className="text-right">{formatCurrency(p.avg_quoted_rate)}</TableCell>
                              </motion.tr>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No products linked to this supplier</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
