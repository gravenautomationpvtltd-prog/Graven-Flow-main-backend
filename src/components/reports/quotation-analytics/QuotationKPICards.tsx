import { Card, CardContent } from '@/components/ui/card';
import { FileText, TrendingUp, Clock, DollarSign, BarChart3, RefreshCw, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import type { QuotationKPIs, StageFilter } from '@/hooks/useQuotationAnalytics';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';

const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');

interface Props {
  kpis: QuotationKPIs;
  activeStage?: StageFilter;
}

export function QuotationKPICards({ kpis, activeStage = 'all' }: Props) {
  const cards = [
    { label: 'Total Quotations', value: kpis.totalQuotations.toLocaleString('en-IN'), icon: FileText, color: 'text-primary' },
    { label: 'Total Value', value: formatCurrency(kpis.totalValue), icon: DollarSign, color: 'text-chart-1' },
    { label: 'Conversion Rate', value: `${kpis.conversionRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-chart-2' },
    { label: 'Avg Days to Convert', value: kpis.avgDaysToConvert.toFixed(1), icon: Clock, color: 'text-chart-3' },
    { label: 'Price Matched', value: `${kpis.priceMatchedCount} (${kpis.priceMatchRate.toFixed(1)}%)`, icon: CheckCircle2, color: 'text-chart-2' },
    { label: 'Match → Convert', value: `${kpis.matchedConvertedCount} (${kpis.matchedConversionRate.toFixed(1)}%)`, icon: ArrowRightLeft, color: 'text-chart-1' },
    { label: 'Pending', value: kpis.pendingCount.toLocaleString('en-IN'), icon: BarChart3, color: 'text-chart-4' },
    { label: 'Lost', value: kpis.lostCount.toLocaleString('en-IN'), icon: RefreshCw, color: 'text-destructive' },
  ];

  // Highlight the active stage card
  const highlightMap: Record<StageFilter, string> = {
    all: '',
    pending: 'Pending',
    price_matched: 'Price Matched',
    converted: 'Match → Convert',
    lost: 'Lost',
  };
  const highlightLabel = highlightMap[activeStage];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
      {cards.map((card) => (
        <Card key={card.label} className={highlightLabel === card.label ? 'ring-2 ring-primary' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
            <p className="text-xl font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
