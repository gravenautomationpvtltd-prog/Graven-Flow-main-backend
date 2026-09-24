import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesPipelineReport } from '@/hooks/useActionableReports';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';

const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  dateFrom?: Date;
  dateTo?: Date;
}

export function SalesPipelineChart({ dateFrom, dateTo }: Props) {
  const { data: pipeline, isLoading } = useSalesPipelineReport(dateFrom, dateTo);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  const totalValue = pipeline?.reduce((sum, p) => sum + p.value, 0) || 0;
  const totalCount = pipeline?.reduce((sum, p) => sum + p.count, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sales Pipeline</CardTitle>
        <CardDescription>
          {totalCount} leads worth {formatCurrency(totalValue)} in pipeline
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipeline}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}d`} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'Count') return [value, name];
                  if (name === 'Avg Age') return [`${value} days`, name];
                  return [formatCurrency(value), name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name="Count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="avg_age_days" name="Avg Age" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4 pt-4 border-t">
          {pipeline?.map((stage) => (
            <div key={stage.status} className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">{stage.status}</p>
              <p className="text-lg font-bold">{stage.count}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(stage.value)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
