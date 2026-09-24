import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, 
  Search, 
  Download, 
  SortAsc, 
  TrendingUp, 
  TrendingDown,
  Package 
} from 'lucide-react';
import { ExpandableDealCard, DealWithDetails } from './ExpandableDealCard';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DealDetailPanelProps {
  deals: DealWithDetails[];
  title: string;
  subtitle?: string;
  type: 'won' | 'lost';
  onBack: () => void;
}

type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'product';

export function DealDetailPanel({ deals, title, subtitle, type, onBack }: DealDetailPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredAndSortedDeals = useMemo(() => {
    let filtered = deals.filter(deal => 
      deal.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.lead_title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    switch (sortBy) {
      case 'date_desc':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'date_asc':
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'amount_desc':
        filtered.sort((a, b) => (b.total_amount || b.final_rate || b.initial_rate || 0) - (a.total_amount || a.final_rate || a.initial_rate || 0));
        break;
      case 'amount_asc':
        filtered.sort((a, b) => (a.total_amount || a.final_rate || a.initial_rate || 0) - (b.total_amount || b.final_rate || b.initial_rate || 0));
        break;
      case 'product':
        filtered.sort((a, b) => a.product_name.localeCompare(b.product_name));
        break;
    }

    return filtered;
  }, [deals, searchQuery, sortBy]);

  const totalValue = useMemo(() => {
    return filteredAndSortedDeals.reduce((sum, deal) => 
      sum + (deal.total_amount || deal.final_rate || deal.initial_rate || 0), 0
    );
  }, [filteredAndSortedDeals]);

  const handleExportCSV = () => {
    const headers = ['Product', 'Customer', 'Lead', 'Quantity', 'Unit', 'Unit Rate', 'Discount', 'Tax', 'Total', 'Date', 'Reason'];
    const rows = filteredAndSortedDeals.map(deal => [
      deal.product_name,
      deal.customer_name,
      deal.lead_title,
      deal.quantity || 1,
      deal.unit || 'Nos',
      deal.final_rate || deal.initial_rate || 0,
      deal.discount_amount || 0,
      deal.tax_amount || 0,
      deal.total_amount || deal.final_rate || deal.initial_rate || 0,
      format(new Date(deal.created_at), 'yyyy-MM-dd'),
      deal.reason || ''
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-deals-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const colorClass = type === 'won' ? 'text-green-500' : 'text-red-500';
  const Icon = type === 'won' ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            <Icon className={`h-5 w-5 ${colorClass}`} />
            {title}
          </h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="text-right">
          <p className={`font-bold ${colorClass}`}>{formatCurrency(totalValue)}</p>
          <Badge variant="secondary" className="text-xs">
            {filteredAndSortedDeals.length} deal{filteredAndSortedDeals.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[140px]">
            <SortAsc className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest First</SelectItem>
            <SelectItem value="date_asc">Oldest First</SelectItem>
            <SelectItem value="amount_desc">Highest Value</SelectItem>
            <SelectItem value="amount_asc">Lowest Value</SelectItem>
            <SelectItem value="product">By Product</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={handleExportCSV}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Deal List */}
      <ScrollArea scrollbars="both" className="flex-1">
        <div className="min-w-[550px] pr-4 pb-2">
          {filteredAndSortedDeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-4 opacity-50" />
              <p>No deals found</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-3">
                {filteredAndSortedDeals.map((deal, index) => (
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
    </motion.div>
  );
}
