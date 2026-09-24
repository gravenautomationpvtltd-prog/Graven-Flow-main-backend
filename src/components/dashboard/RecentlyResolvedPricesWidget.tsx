import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, CheckCircle, Clock, FileText, ArrowRight, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ResolvedPriceItem {
  id: string;
  resolved_at: string;
  resolved_price: number | null;
  status: string;
  lead_id: string;
  lead: {
    id: string;
    title: string;
    quoted_at: string | null;
    customer: {
      company_name: string;
    } | null;
  } | null;
  enquiry_item: {
    product_query_text: string;
    quantity: number | null;
  } | null;
}

export function RecentlyResolvedPricesWidget() {
  const navigate = useNavigate();

  const { data: resolvedPrices = [], isLoading } = useQuery({
    queryKey: ['recently-resolved-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_requests')
        .select(`
          id,
          resolved_at,
          resolved_price,
          status,
          lead_id,
          lead:leads(
            id,
            title,
            quoted_at,
            customer:customers(company_name)
          ),
          enquiry_item:enquiry_items(product_query_text, quantity)
        `)
        .in('status', ['resolved', 'no_price'])
        .order('resolved_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      return (data || []) as ResolvedPriceItem[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Get quotation status for each resolved price
  const getQuotationStatus = (item: ResolvedPriceItem) => {
    if (item.status === 'no_price') {
      return { label: 'No Price', color: 'bg-muted text-muted-foreground', icon: XCircle };
    }
    if (item.lead?.quoted_at) {
      return { label: 'Quoted', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle };
    }
    return { label: 'Pending Quote', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Recently Resolved Prices
          </CardTitle>
          <CardDescription>Track your pricing work and its impact</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (resolvedPrices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Recently Resolved Prices
          </CardTitle>
          <CardDescription>Track your pricing work and its impact</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No prices resolved yet</p>
            <p className="text-sm">Resolved prices will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate stats
  const quotedCount = resolvedPrices.filter(p => p.status === 'resolved' && p.lead?.quoted_at).length;
  const pendingQuoteCount = resolvedPrices.filter(p => p.status === 'resolved' && !p.lead?.quoted_at).length;
  const noPriceCount = resolvedPrices.filter(p => p.status === 'no_price').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Recently Resolved Prices
            </CardTitle>
            <CardDescription>Track your pricing work and its impact</CardDescription>
          </div>
          <button
            onClick={() => navigate('/procurement?tab=price-requests&status=resolved')}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        
        {/* Quick Stats */}
        <div className="flex gap-4 mt-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm text-muted-foreground">{quotedCount} quoted</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-sm text-muted-foreground">{pendingQuoteCount} pending quote</span>
          </div>
          {noPriceCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="text-sm text-muted-foreground">{noPriceCount} no price</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {resolvedPrices.map((item) => {
          const quotationStatus = getQuotationStatus(item);
          const StatusIcon = quotationStatus.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(`/leads/${item.lead_id}`)}
              className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-primary transition-colors">
                    {item.enquiry_item?.product_query_text || 'Unknown Product'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {item.lead?.customer?.company_name || 'Unknown Customer'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {item.resolved_price !== null && (
                    <span className="font-semibold text-success">
                      ₹{item.resolved_price.toLocaleString()}
                    </span>
                  )}
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs flex items-center gap-1", quotationStatus.color)}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {quotationStatus.label}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Resolved {formatDistanceToNow(new Date(item.resolved_at), { addSuffix: true })}
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
