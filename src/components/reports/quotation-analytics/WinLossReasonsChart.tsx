import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { ReasonCount } from '@/hooks/useQuotationAnalytics';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';

const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');

interface Props {
  winReasons: ReasonCount[];
  lossReasons: ReasonCount[];
}

export function WinLossReasonsChart({ winReasons, lossReasons }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-chart-2">Win Reasons</CardTitle>
        </CardHeader>
        <CardContent>
          {winReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No win reasons recorded</p>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={winReasons.slice(0, 8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(value: number, name: string) => name === 'Value' ? formatCurrency(value) : value} />
                  <Bar dataKey="count" name="Count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Loss Reasons</CardTitle>
        </CardHeader>
        <CardContent>
          {lossReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No loss reasons recorded</p>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lossReasons.slice(0, 8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(value: number, name: string) => name === 'Value' ? formatCurrency(value) : value} />
                  <Bar dataKey="count" name="Count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
