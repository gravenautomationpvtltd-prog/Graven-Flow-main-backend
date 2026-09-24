import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Package, Building2, Calendar, ArrowUpRight, ArrowDownRight, PieChart, Users, Clock, Tag, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWinLossDetails, WinLossDetail } from "@/hooks/usePricingIntelligence";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WIN_REASONS, LOST_REASONS } from "@/components/leads/WinLossReasonDialog";
import { DealDetailPanel } from "./DealDetailPanel";
import { ExpandableDealCard } from "./ExpandableDealCard";

interface KPIDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'won' | 'lost';
  totalValue: number;
}

type TimePeriod = 'all' | 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months';

interface DrillDownState {
  active: boolean;
  title: string;
  subtitle?: string;
  deals: WinLossDetail[];
}

export function KPIDetailDialog({ open, onOpenChange, type, totalValue }: KPIDetailDialogProps) {
  const { data: winLossDetails, isLoading } = useWinLossDetails();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [drillDown, setDrillDown] = useState<DrillDownState>({ active: false, title: '', deals: [] });

  const filteredDeals = useMemo(() => {
    let deals = winLossDetails?.filter(deal => 
      type === 'won' ? deal.outcome === 'won' : deal.outcome === 'lost'
    ) || [];

    // Apply time period filter
    if (timePeriod !== 'all') {
      const now = new Date();
      let startDate: Date;
      let endDate = now;

      switch (timePeriod) {
        case 'this_month':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case 'last_month':
          startDate = startOfMonth(subMonths(now, 1));
          endDate = endOfMonth(subMonths(now, 1));
          break;
        case 'last_3_months':
          startDate = subMonths(now, 3);
          break;
        case 'last_6_months':
          startDate = subMonths(now, 6);
          break;
        default:
          startDate = new Date(0);
      }

      deals = deals.filter(deal => {
        const dealDate = parseISO(deal.created_at);
        return isWithinInterval(dealDate, { start: startDate, end: endDate });
      });
    }

    return deals;
  }, [winLossDetails, type, timePeriod]);

  // Calculate total for filtered deals using total_amount for accuracy
  const filteredTotal = useMemo(() => {
    return filteredDeals.reduce((sum, deal) => sum + (deal.total_amount || deal.final_rate || deal.initial_rate || 0), 0);
  }, [filteredDeals]);

  // Group by product
  const productBreakdown = useMemo(() => {
    const productMap = new Map<string, { name: string; count: number; value: number; deals: WinLossDetail[] }>();
    
    filteredDeals.forEach(deal => {
      const productName = deal.product_name || 'Unknown Product';
      const value = deal.total_amount || deal.final_rate || deal.initial_rate || 0;
      
      if (!productMap.has(productName)) {
        productMap.set(productName, { name: productName, count: 0, value: 0, deals: [] });
      }
      
      const product = productMap.get(productName)!;
      product.count++;
      product.value += value;
      product.deals.push(deal);
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredDeals]);

  // Group by customer
  const customerBreakdown = useMemo(() => {
    const customerMap = new Map<string, { name: string; count: number; value: number; deals: WinLossDetail[] }>();
    
    filteredDeals.forEach(deal => {
      const customerName = deal.customer_name || 'Unknown Customer';
      const value = deal.total_amount || deal.final_rate || deal.initial_rate || 0;
      
      if (!customerMap.has(customerName)) {
        customerMap.set(customerName, { name: customerName, count: 0, value: 0, deals: [] });
      }
      
      const customer = customerMap.get(customerName)!;
      customer.count++;
      customer.value += value;
      customer.deals.push(deal);
    });

    return Array.from(customerMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredDeals]);

  // Group by month
  const timeBreakdown = useMemo(() => {
    const timeMap = new Map<string, { month: string; count: number; value: number; sortKey: string; deals: WinLossDetail[] }>();
    
    filteredDeals.forEach(deal => {
      const date = new Date(deal.created_at);
      const month = format(date, 'MMM yyyy');
      const sortKey = format(date, 'yyyy-MM');
      const value = deal.total_amount || deal.final_rate || deal.initial_rate || 0;
      
      if (!timeMap.has(month)) {
        timeMap.set(month, { month, count: 0, value: 0, sortKey, deals: [] });
      }
      
      const time = timeMap.get(month)!;
      time.count++;
      time.value += value;
      time.deals.push(deal);
    });

    return Array.from(timeMap.values())
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
      .slice(0, 12);
  }, [filteredDeals]);

  // Group by reason
  const reasonBreakdown = useMemo(() => {
    const reasonMap = new Map<string, { reason: string; label: string; count: number; value: number; deals: WinLossDetail[] }>();
    const reasons = type === 'won' ? WIN_REASONS : LOST_REASONS;
    
    filteredDeals.forEach(deal => {
      const reasonKey = deal.reason || 'unknown';
      const value = deal.total_amount || deal.final_rate || deal.initial_rate || 0;
      
      if (!reasonMap.has(reasonKey)) {
        const reasonObj = reasons.find(r => r.value === reasonKey);
        reasonMap.set(reasonKey, { 
          reason: reasonKey, 
          label: reasonObj?.label || (reasonKey === 'unknown' ? 'Not Specified' : reasonKey),
          count: 0, 
          value: 0,
          deals: []
        });
      }
      
      const reason = reasonMap.get(reasonKey)!;
      reason.count++;
      reason.value += value;
      reason.deals.push(deal);
    });

    return Array.from(reasonMap.values())
      .sort((a, b) => b.count - a.count);
  }, [filteredDeals, type]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const Icon = type === 'won' ? TrendingUp : TrendingDown;
  const colorClass = type === 'won' ? 'text-green-500' : 'text-red-500';
  const bgClass = type === 'won' ? 'bg-green-500/10' : 'bg-red-500/10';
  const progressColor = type === 'won' ? 'bg-green-500' : 'bg-red-500';

  const maxProductValue = productBreakdown[0]?.value || 1;
  const maxCustomerValue = customerBreakdown[0]?.value || 1;
  const maxTimeValue = Math.max(...timeBreakdown.map(t => t.value), 1);
  const maxReasonCount = reasonBreakdown[0]?.count || 1;

  const handleDrillDown = (title: string, subtitle: string, deals: WinLossDetail[]) => {
    setDrillDown({ active: true, title, subtitle, deals });
  };

  const handleBackFromDrillDown = () => {
    setDrillDown({ active: false, title: '', deals: [] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {drillDown.active ? (
            <motion.div
              key="drilldown"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-[70vh]"
            >
              <DealDetailPanel
                deals={drillDown.deals}
                title={drillDown.title}
                subtitle={drillDown.subtitle}
                type={type}
                onBack={handleBackFromDrillDown}
              />
            </motion.div>
          ) : (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <motion.div 
                    className={`p-2 rounded-lg ${bgClass}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    <Icon className={`h-5 w-5 ${colorClass}`} />
                  </motion.div>
                  <span>Revenue {type === 'won' ? 'Won' : 'Lost'} Details</span>
                  <motion.span 
                    className={`ml-auto text-lg font-bold ${colorClass} whitespace-nowrap`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {formatCurrency(filteredTotal)}
                  </motion.span>
                </DialogTitle>
              </DialogHeader>

              {/* Time Period Filter */}
              <div className="flex items-center gap-2 mb-2 mt-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Time Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                    <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="secondary" className="ml-auto">
                  {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <Tabs defaultValue="all" className="w-full">
                <TabsList className="w-full overflow-x-auto flex-nowrap">
                  <TabsTrigger value="all" className="text-xs px-3">
                    <Package className="h-3 w-3 mr-1" />
                    All
                  </TabsTrigger>
                  <TabsTrigger value="reason" className="text-xs px-3">
                    <Tag className="h-3 w-3 mr-1" />
                    Reason
                  </TabsTrigger>
                  <TabsTrigger value="product" className="text-xs px-3">
                    <PieChart className="h-3 w-3 mr-1" />
                    Product
                  </TabsTrigger>
                  <TabsTrigger value="customer" className="text-xs px-3">
                    <Users className="h-3 w-3 mr-1" />
                    Customer
                  </TabsTrigger>
                  <TabsTrigger value="time" className="text-xs px-3">
                    <Calendar className="h-3 w-3 mr-1" />
                    Time
                  </TabsTrigger>
                </TabsList>

                {/* All Deals Tab */}
                <TabsContent value="all" className="mt-4">
                  <ScrollArea scrollbars="both" className="h-[calc(60vh-120px)]">
                    <div className="min-w-[600px] pr-4 pb-2">
                      {isLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-20 w-full" />
                          ))}
                        </div>
                      ) : filteredDeals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <Package className="h-12 w-12 mb-4 opacity-50" />
                          <p>No {type} deals found</p>
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          <div className="space-y-3">
                            {filteredDeals.map((deal, index) => (
                              <ExpandableDealCard
                                key={deal.id}
                                deal={deal}
                                type={type}
                                index={index}
                              />
                            ))}
                          </div>
                        </AnimatePresence>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* By Reason Tab */}
                <TabsContent value="reason" className="mt-4">
                  <ScrollArea scrollbars="both" className="h-[calc(60vh-120px)]">
                    <div className="min-w-[600px] pr-4 pb-2">
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : reasonBreakdown.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Tag className="h-12 w-12 mb-4 opacity-50" />
                        <p>No reason data available</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reasonBreakdown.map((item, index) => {
                          const reasons = type === 'won' ? WIN_REASONS : LOST_REASONS;
                          const reasonObj = reasons.find(r => r.value === item.reason);
                          const ReasonIcon = reasonObj?.icon || Tag;
                          
                          return (
                            <motion.div
                              key={item.reason}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                            >
                              <Card 
                                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => handleDrillDown(
                                  item.label,
                                  `${item.count} deal${item.count !== 1 ? 's' : ''} · ${formatCurrency(item.value)}`,
                                  item.deals
                                )}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <ReasonIcon className={`h-4 w-4 flex-shrink-0 ${colorClass}`} />
                                      <span className="font-medium text-sm truncate">{item.label}</span>
                                      <Badge variant="secondary" className="flex-shrink-0">
                                        {item.count} deal{item.count !== 1 ? 's' : ''}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                      <span className={`font-bold ${colorClass} whitespace-nowrap min-w-[100px] text-right`}>
                                        {formatCurrency(item.value)}
                                      </span>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </div>
                                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                                    <motion.div
                                      className={`absolute inset-y-0 left-0 ${progressColor} rounded-full`}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${(item.count / maxReasonCount) * 100}%` }}
                                      transition={{ duration: 0.5, delay: index * 0.05 }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                    <span>{((item.count / filteredDeals.length) * 100).toFixed(1)}% of deals</span>
                                    <span>Avg: {formatCurrency(item.value / item.count)}</span>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* By Product Tab */}
                <TabsContent value="product" className="mt-4">
                  <ScrollArea scrollbars="both" className="h-[calc(60vh-120px)]">
                    <div className="min-w-[600px] pr-4 pb-2">
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : productBreakdown.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <PieChart className="h-12 w-12 mb-4 opacity-50" />
                        <p>No product data available</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {productBreakdown.map((product, index) => (
                          <motion.div
                            key={product.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Card 
                              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => handleDrillDown(
                                product.name,
                                `${product.count} deal${product.count !== 1 ? 's' : ''} · ${formatCurrency(product.value)}`,
                                product.deals
                              )}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="font-medium text-sm truncate" title={product.name}>{product.name}</span>
                                    <Badge variant="secondary" className="flex-shrink-0">
                                      {product.count} deal{product.count !== 1 ? 's' : ''}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <span className={`font-bold ${colorClass} whitespace-nowrap min-w-[100px] text-right`}>
                                      {formatCurrency(product.value)}
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                                  <motion.div
                                    className={`absolute inset-y-0 left-0 ${progressColor} rounded-full`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(product.value / maxProductValue) * 100}%` }}
                                    transition={{ duration: 0.5, delay: index * 0.05 }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                  <span>{((product.value / filteredTotal) * 100).toFixed(1)}% of total</span>
                                  <span>Avg: {formatCurrency(product.value / product.count)}</span>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* By Customer Tab */}
                <TabsContent value="customer" className="mt-4">
                  <ScrollArea scrollbars="both" className="h-[calc(60vh-120px)]">
                    <div className="min-w-[600px] pr-4 pb-2">
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : customerBreakdown.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mb-4 opacity-50" />
                        <p>No customer data available</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {customerBreakdown.map((customer, index) => (
                          <motion.div
                            key={customer.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Card 
                              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => handleDrillDown(
                                customer.name,
                                `${customer.count} deal${customer.count !== 1 ? 's' : ''} · ${formatCurrency(customer.value)}`,
                                customer.deals
                              )}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="font-medium text-sm truncate" title={customer.name}>{customer.name}</span>
                                    <Badge variant="secondary" className="flex-shrink-0">
                                      {customer.count} deal{customer.count !== 1 ? 's' : ''}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <span className={`font-bold ${colorClass} whitespace-nowrap min-w-[100px] text-right`}>
                                      {formatCurrency(customer.value)}
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                                  <motion.div
                                    className={`absolute inset-y-0 left-0 ${progressColor} rounded-full`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(customer.value / maxCustomerValue) * 100}%` }}
                                    transition={{ duration: 0.5, delay: index * 0.05 }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                  <span>{((customer.value / filteredTotal) * 100).toFixed(1)}% of total</span>
                                  <span>Avg: {formatCurrency(customer.value / customer.count)}</span>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* By Time Tab */}
                <TabsContent value="time" className="mt-4">
                  <ScrollArea scrollbars="both" className="h-[calc(60vh-120px)]">
                    <div className="min-w-[600px] pr-4 pb-2">
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : timeBreakdown.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Calendar className="h-12 w-12 mb-4 opacity-50" />
                        <p>No time data available</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {timeBreakdown.map((time, index) => (
                          <motion.div
                            key={time.month}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Card 
                              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => handleDrillDown(
                                time.month,
                                `${time.count} deal${time.count !== 1 ? 's' : ''} · ${formatCurrency(time.value)}`,
                                time.deals
                              )}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="font-medium text-sm">{time.month}</span>
                                    <Badge variant="secondary" className="flex-shrink-0">
                                      {time.count} deal{time.count !== 1 ? 's' : ''}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <span className={`font-bold ${colorClass} whitespace-nowrap min-w-[100px] text-right`}>
                                      {formatCurrency(time.value)}
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                                  <motion.div
                                    className={`absolute inset-y-0 left-0 ${progressColor} rounded-full`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(time.value / maxTimeValue) * 100}%` }}
                                    transition={{ duration: 0.5, delay: index * 0.05 }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                  <span>{((time.value / filteredTotal) * 100).toFixed(1)}% of total</span>
                                  <span>Avg: {formatCurrency(time.value / time.count)}</span>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
