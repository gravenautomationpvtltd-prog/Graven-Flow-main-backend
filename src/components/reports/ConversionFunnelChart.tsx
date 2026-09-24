import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversionFunnel } from '@/hooks/useActionableReports';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');

interface Props {
  dateFrom?: Date;
  dateTo?: Date;
}

const stageToStatusFilter: Record<string, string> = {
  'New': '',
  'Contacted': 'contacted',
  'Qualified': 'qualified',
  'Proposal': 'proposal',
  'Quoted': 'quoted,negotiation,won,lost',
  'Negotiation': 'negotiation',
  'Price Matched': 'negotiation,won',
  'Won': 'won',
};

export function ConversionFunnelChart({ dateFrom, dateTo }: Props) {
  const { data: funnel, isLoading } = useConversionFunnel(dateFrom, dateTo);
  const navigate = useNavigate();

  const handleStageClick = (stage: string) => {
    const statusFilter = stageToStatusFilter[stage];
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('from', dateFrom.toISOString().split('T')[0]);
    if (dateTo) params.set('to', dateTo.toISOString().split('T')[0]);
    navigate(`/leads${params.toString() ? `?${params.toString()}` : ''}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--primary))',
    'hsl(var(--chart-2))',
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Pipeline Funnel</CardTitle>
        <CardDescription>Full B2B journey — click any stage to view those leads</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tickFormatter={(v) => `${v}`} />
              <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'count' ? value : formatCurrency(value),
                  name === 'count' ? 'Count' : 'Value'
                ]}
              />
              <Bar
                dataKey="count"
                name="count"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(data) => handleStageClick(data.stage)}
              >
                {funnel?.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stage cards */}
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 mt-4 pt-4 border-t">
          {funnel?.map((stage) => (
            <div
              key={stage.stage}
              className="text-center p-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors group"
              onClick={() => handleStageClick(stage.stage)}
            >
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                {stage.stage}
                <ChevronRight className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <p className="text-base font-bold">{stage.count}</p>
              <p className="text-[10px] text-muted-foreground">
                {stage.conversion_rate.toFixed(0)}%
              </p>
            </div>
          ))}
        </div>

        {/* Stage-to-Stage Conversion */}
        {funnel && funnel.length > 1 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-3">Stage-to-Stage Conversion</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {funnel.slice(0, -1).map((stage, index) => {
                const nextStage = funnel[index + 1];
                const rate = stage.count > 0
                  ? ((nextStage.count / stage.count) * 100).toFixed(1)
                  : '0.0';

                return (
                  <div
                    key={`${stage.stage}-${nextStage.stage}`}
                    className="flex flex-col items-center p-2 rounded-lg bg-muted/30 text-center"
                  >
                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground mb-1">
                      <span className="font-medium text-foreground truncate">{stage.stage}</span>
                      <ChevronRight className="h-2.5 w-2.5 shrink-0" />
                      <span className="font-medium text-foreground truncate">{nextStage.stage}</span>
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        parseFloat(rate) >= 50
                          ? 'text-green-600 dark:text-green-400'
                          : parseFloat(rate) >= 20
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {rate}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
