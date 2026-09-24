import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNegotiationEffectiveness } from '@/hooks/useActionableReports';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowRight, Clock, TrendingUp, TrendingDown } from 'lucide-react';

const fmt = (n: number) => formatCurrencyWithSymbol(n, 'INR');

interface Props {
  dateFrom?: Date;
  dateTo?: Date;
}

export function NegotiationFunnelChart({ dateFrom, dateTo }: Props) {
  const { data, isLoading } = useNegotiationEffectiveness(dateFrom, dateTo);

  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-[300px]" /></CardContent></Card>;
  }

  if (!data) return null;

  const funnelData = [
    { stage: 'Quoted', count: data.quotedCount, value: data.quotedValue },
    { stage: 'In Negotiation', count: data.inNegotiationCount, value: data.inNegotiationValue },
    { stage: 'Price Matched', count: data.priceMatchedCount, value: data.priceMatchedValue },
    { stage: 'Converted', count: data.convertedCount, value: data.convertedValue },
  ];

  const colors = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Negotiation & Pricing Effectiveness</CardTitle>
        <CardDescription>From quotation to conversion — pricing journey</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [value, 'Count']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {funnelData.map((_, i) => (
                  <Cell key={i} fill={colors[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stage-to-stage drop-offs */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t">
          {funnelData.slice(0, -1).map((stage, i) => {
            const next = funnelData[i + 1];
            const rate = stage.count > 0 ? ((next.count / stage.count) * 100).toFixed(1) : '0.0';
            return (
              <div key={stage.stage} className="flex flex-col items-center p-2 rounded-lg bg-muted/30 text-center">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{stage.stage.replace('In ', '')}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">{next.stage}</span>
                </div>
                <span className={`text-sm font-bold ${
                  parseFloat(rate) >= 50 ? 'text-green-600 dark:text-green-400' :
                  parseFloat(rate) >= 20 ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400'
                }`}>{rate}%</span>
              </div>
            );
          })}
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t">
          <div className="text-center p-2">
            <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{data.avgNegotiationDays}</p>
            <p className="text-xs text-muted-foreground">Avg days to match</p>
          </div>
          <div className="text-center p-2">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{data.matchedConversionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Matched → Convert</p>
          </div>
          <div className="text-center p-2">
            <TrendingDown className="h-4 w-4 mx-auto mb-1 text-red-500" />
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{data.unmatchedConversionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Unmatched → Convert</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
