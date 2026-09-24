import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Search, TrendingUp, TrendingDown, ArrowRight, ExternalLink, PieChart, List } from 'lucide-react';
import { useWinLossDetails } from '@/hooks/usePricingIntelligence';
import { Link } from 'react-router-dom';
import { WinLossAnalyticsDashboard } from './WinLossAnalyticsDashboard';

interface WinLossBreakdownProps {
  dateRange?: { from: Date | null; to: Date | null };
}

export function WinLossBreakdown({ dateRange }: WinLossBreakdownProps) {
  const { data: details, isLoading } = useWinLossDetails(dateRange);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'analytics' | 'deals'>('analytics');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredDetails = details?.filter(
    d => d.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         d.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         d.lead_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const wonDeals = filteredDetails?.filter(d => d.outcome === 'won') || [];
  const lostDeals = filteredDetails?.filter(d => d.outcome === 'lost') || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  const renderDealCard = (deal: typeof details[0], isWon: boolean) => {
    const quantity = deal.quantity || 1;
    const unitRate = deal.final_rate || deal.initial_rate || 0;
    const subtotal = unitRate * quantity;
    const discountAmount = deal.discount_amount || 0;
    const taxPercent = deal.tax_percent || 18;
    const taxAmount = deal.tax_amount || (subtotal - discountAmount) * (taxPercent / 100);
    const totalAmount = deal.total_amount || (subtotal - discountAmount + taxAmount);

    return (
      <div 
        key={deal.id} 
        className={`p-4 rounded-lg border ${isWon ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-medium text-sm">{deal.product_name}</h4>
            <p className="text-xs text-muted-foreground">{deal.customer_name}</p>
          </div>
          <Link to={`/leads/${deal.lead_id}`}>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* Penny-Level Summary */}
        <div className="bg-muted/30 rounded px-2 py-1.5 text-xs mb-2">
          <span className="font-medium">
            {quantity} {deal.unit || 'Nos'} × {formatCurrency(unitRate)}
          </span>
          {discountAmount > 0 && (
            <span className="text-green-600 ml-2">
              -{formatCurrency(discountAmount)}
            </span>
          )}
          <span className="text-muted-foreground ml-2">
            +GST {taxPercent}%
          </span>
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-xs mt-3">
          <div>
            <p className="text-muted-foreground">Subtotal</p>
            <p className="font-medium">{formatCurrency(subtotal)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">GST</p>
            <p className="font-medium">{formatCurrency(taxAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className={`font-bold ${isWon ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>

        {deal.gap_to_target !== null && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Gap to Target</span>
              <span className={deal.gap_to_target > 0 ? 'text-red-500' : 'text-green-500'}>
                {deal.gap_to_target > 0 ? '+' : ''}{formatCurrency(deal.gap_to_target)}
              </span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          {format(new Date(deal.created_at), 'MMM d, yyyy')}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'analytics' | 'deals')}>
          <TabsList>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="deals" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span>Deal List</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {viewMode === 'deals' && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by product, customer, or lead..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {viewMode === 'analytics' ? (
        <WinLossAnalyticsDashboard />
      ) : (
        <>
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Won Deals */}
            <Card className="border-green-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-green-500">Won Deals</CardTitle>
                </div>
                <CardDescription>
                  {wonDeals.length} deals with tracked pricing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {wonDeals.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No won deals with pricing data yet
                      </p>
                    ) : (
                      wonDeals.map(deal => renderDealCard(deal, true))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Lost Deals */}
            <Card className="border-red-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  <CardTitle className="text-red-500">Lost Deals</CardTitle>
                </div>
                <CardDescription>
                  {lostDeals.length} deals with tracked pricing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {lostDeals.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No lost deals with pricing data yet
                      </p>
                    ) : (
                      lostDeals.map(deal => renderDealCard(deal, false))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          {filteredDetails && filteredDetails.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Key Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">
                      Win rate: <span className="font-medium text-foreground">
                        {((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100 || 0).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">
                      Most quoted product: <span className="font-medium text-foreground">
                        {filteredDetails[0]?.product_name || 'N/A'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">
                      Deals tracked: <span className="font-medium text-foreground">
                        {filteredDetails.length}
                      </span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
