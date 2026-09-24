import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, TrendingDown, AlertTriangle, Users, Target, Percent, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';

interface CustomerBehavior {
  customer_id: string;
  company_name: string;
  total_enquiries: number;
  enquiries_with_target: number;
  avg_target_gap_pct: number;
  aggressive_targets_count: number;
  strictness_tag: 'normal' | 'negotiator' | 'aggressive';
  total_target_value: number;
  total_quoted_value: number;
}

function useCustomerBehavior() {
  return useQuery({
    queryKey: ['customer-behavior'],
    queryFn: async () => {
      // Get quotation items with targets and rates
      const { data: quotationItems, error } = await supabase
        .from('quotation_items')
        .select(`
          id,
          target_rate,
          rate,
          quantity,
          quotation:quotations!inner(
            id,
            lead:leads!inner(
              id,
              customer:customers!inner(id, company_name)
            )
          )
        `)
        .not('target_rate', 'is', null)
        .gt('target_rate', 0);

      if (error) throw error;

      // Also get price requests with targets
      const { data: priceRequests } = await supabase
        .from('price_requests')
        .select(`
          id,
          target_rate,
          resolved_price,
          lead:leads!inner(
            id,
            customer:customers!inner(id, company_name)
          )
        `)
        .not('target_rate', 'is', null)
        .gt('target_rate', 0);

      // Aggregate by customer
      const customerMap = new Map<string, {
        company_name: string;
        items: Array<{ target: number; quoted: number; quantity: number }>;
      }>();

      // Process quotation items
      (quotationItems || []).forEach((item: any) => {
        const customerId = item.quotation?.lead?.customer?.id;
        const companyName = item.quotation?.lead?.customer?.company_name;
        if (!customerId || !companyName) return;

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, { company_name: companyName, items: [] });
        }
        customerMap.get(customerId)!.items.push({
          target: item.target_rate,
          quoted: item.rate,
          quantity: item.quantity || 1,
        });
      });

      // Process price requests
      (priceRequests || []).forEach((request: any) => {
        const customerId = request.lead?.customer?.id;
        const companyName = request.lead?.customer?.company_name;
        if (!customerId || !companyName || !request.resolved_price) return;

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, { company_name: companyName, items: [] });
        }
        customerMap.get(customerId)!.items.push({
          target: request.target_rate,
          quoted: request.resolved_price,
          quantity: 1,
        });
      });

      // Calculate metrics for each customer
      const behaviors: CustomerBehavior[] = [];
      customerMap.forEach((data, customerId) => {
        if (data.items.length === 0) return;

        let totalTargetValue = 0;
        let totalQuotedValue = 0;
        let totalGapPct = 0;
        let aggressiveCount = 0;

        data.items.forEach(item => {
          const targetValue = item.target * item.quantity;
          const quotedValue = item.quoted * item.quantity;
          totalTargetValue += targetValue;
          totalQuotedValue += quotedValue;

          // Calculate gap percentage: (quoted - target) / quoted * 100
          const gapPct = item.quoted > 0 ? ((item.quoted - item.target) / item.quoted) * 100 : 0;
          totalGapPct += gapPct;

          // Aggressive if target is >15% below quoted
          if (gapPct > 15) {
            aggressiveCount++;
          }
        });

        const avgGapPct = totalGapPct / data.items.length;
        
        // Determine strictness tag
        let strictnessTag: 'normal' | 'negotiator' | 'aggressive' = 'normal';
        if (avgGapPct > 15 || (aggressiveCount / data.items.length) > 0.3) {
          strictnessTag = 'aggressive';
        } else if (avgGapPct > 5) {
          strictnessTag = 'negotiator';
        }

        behaviors.push({
          customer_id: customerId,
          company_name: data.company_name,
          total_enquiries: data.items.length,
          enquiries_with_target: data.items.length,
          avg_target_gap_pct: avgGapPct,
          aggressive_targets_count: aggressiveCount,
          strictness_tag: strictnessTag,
          total_target_value: totalTargetValue,
          total_quoted_value: totalQuotedValue,
        });
      });

      // Sort by aggressiveness
      behaviors.sort((a, b) => b.avg_target_gap_pct - a.avg_target_gap_pct);

      return behaviors;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

const strictnessConfig = {
  normal: { label: 'Normal', className: 'bg-green-500/10 text-green-600 border-green-200' },
  negotiator: { label: 'Negotiator', className: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  aggressive: { label: 'Very Aggressive', className: 'bg-red-500/10 text-red-600 border-red-200' },
};

export function CustomerBehaviorTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: behaviors = [], isLoading } = useCustomerBehavior();

  const filteredBehaviors = behaviors.filter(b => 
    b.company_name.toLowerCase().includes(search.toLowerCase())
  );

  // Summary stats
  const aggressiveCustomers = behaviors.filter(b => b.strictness_tag === 'aggressive').length;
  const negotiators = behaviors.filter(b => b.strictness_tag === 'negotiator').length;
  const avgGap = behaviors.length > 0 
    ? behaviors.reduce((sum, b) => sum + b.avg_target_gap_pct, 0) / behaviors.length 
    : 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customers with Targets</p>
                <p className="text-2xl font-bold">{behaviors.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aggressive Negotiators</p>
                <p className="text-2xl font-bold text-red-600">{aggressiveCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Regular Negotiators</p>
                <p className="text-2xl font-bold text-amber-600">{negotiators}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Percent className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Target Gap</p>
                <p className="text-2xl font-bold">{avgGap.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Customer Negotiation Behavior
          </CardTitle>
          <CardDescription>
            Track which customers consistently demand unrealistic target prices. Higher gap % indicates more aggressive targets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredBehaviors.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {behaviors.length === 0 
                ? 'No customer target data available yet. Target prices are recorded when sales enters them during price requests or quotations.'
                : 'No customers found matching your search.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Behavior Tag</TableHead>
                  <TableHead className="text-right">Enquiries</TableHead>
                  <TableHead className="text-right">Avg Gap %</TableHead>
                  <TableHead className="text-right">Aggressive Targets</TableHead>
                  <TableHead className="text-right">Total Target vs Quoted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBehaviors.map((customer) => {
                  const config = strictnessConfig[customer.strictness_tag];
                  return (
                    <TableRow key={customer.customer_id}>
                      <TableCell className="font-medium">
                        {customer.company_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={config.className}>
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {customer.total_enquiries}
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className={
                                customer.avg_target_gap_pct > 15 
                                  ? 'text-red-600 font-semibold' 
                                  : customer.avg_target_gap_pct > 5 
                                    ? 'text-amber-600 font-semibold' 
                                    : ''
                              }>
                                {customer.avg_target_gap_pct.toFixed(1)}%
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Average difference between quoted price and customer's target</p>
                              <p className="text-xs text-muted-foreground">Higher = more aggressive targets</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        {customer.aggressive_targets_count > 0 ? (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600">
                            {customer.aggressive_targets_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-amber-600 text-sm">
                            {formatCurrencyWithSymbol(customer.total_target_value, 'INR')}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            vs {formatCurrencyWithSymbol(customer.total_quoted_value, 'INR')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/customers/${customer.customer_id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}