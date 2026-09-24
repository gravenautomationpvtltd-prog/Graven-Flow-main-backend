import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Package, Clock, CheckCircle, FileText, Target, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type EnquiryStatus = 'no_enquiry' | 'pending_prices' | 'partial_prices' | 'ready_to_quote' | 'quoted' | 'price_matched' | 'negotiating' | 'closed';

interface EnquiryStatusControlProps {
  leadId: string;
  hasEnquiry: boolean;
  currentStatus: EnquiryStatus | null;
  pendingPriceCount?: number;
  resolvedPriceCount?: number;
}

const statusConfig: Record<EnquiryStatus, { label: string; icon: React.ReactNode; color: string }> = {
  no_enquiry: { label: 'No Enquiry', icon: <XCircle className="h-3 w-3" />, color: 'bg-muted text-muted-foreground' },
  pending_prices: { label: 'Pending Prices', icon: <Clock className="h-3 w-3" />, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  partial_prices: { label: 'Partial Prices', icon: <Clock className="h-3 w-3" />, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  ready_to_quote: { label: 'Ready to Quote', icon: <CheckCircle className="h-3 w-3" />, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  quoted: { label: 'Quoted', icon: <FileText className="h-3 w-3" />, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  price_matched: { label: 'Price Matched', icon: <Target className="h-3 w-3" />, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  negotiating: { label: 'Negotiating', icon: <Clock className="h-3 w-3" />, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  closed: { label: 'Closed', icon: <CheckCircle className="h-3 w-3" />, color: 'bg-muted text-muted-foreground' },
};

export function EnquiryStatusControl({
  leadId,
  hasEnquiry,
  currentStatus,
  pendingPriceCount = 0,
  resolvedPriceCount = 0,
}: EnquiryStatusControlProps) {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus: EnquiryStatus) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ enquiry_status: newStatus })
        .eq('id', leadId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Enquiry status updated');
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!hasEnquiry) {
    return null;
  }

  const status = currentStatus || 'pending_prices';
  const config = statusConfig[status];

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Enquiry Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select
          value={status}
          onValueChange={(value) => handleStatusChange(value as EnquiryStatus)}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                {config.icon}
                {config.label}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusConfig)
              .filter(([key]) => key !== 'no_enquiry')
              .map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {value.icon}
                    {value.label}
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {(pendingPriceCount > 0 || resolvedPriceCount > 0) && (
          <div className="text-xs text-muted-foreground space-y-1">
            {pendingPriceCount > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-500" />
                {pendingPriceCount} item{pendingPriceCount !== 1 ? 's' : ''} waiting for prices
              </div>
            )}
            {resolvedPriceCount > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {resolvedPriceCount} price{resolvedPriceCount !== 1 ? 's' : ''} received
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
