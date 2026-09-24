import { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { TrendingDown, Download } from 'lucide-react';
import { usePriceGapTrends, buildGapSeries, selectGapQuotes } from '@/hooks/usePriceGapTrends';
import { PriceGapDrilldown, type GapDrilldownTarget } from '@/components/procurement/PriceGapDrilldown';

const COLORS = [
  'hsl(var(--primary))',
  '#f97316',
  '#0ea5e9',
  '#22c55e',
  '#a855f7',
  '#eab308',
];

/** Trend of how far quotes sit above the lowest quote / sales target, by item or supplier. */
export function PriceGapTrends({ supplierId }: { supplierId?: string }) {
  const [days, setDays] = useState('180');
  const [groupBy, setGroupBy] = useState<'item' | 'supplier'>(supplierId ? 'item' : 'supplier');
  const [metric, setMetric] = useState<'lowest' | 'target'>('lowest');
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading } = usePriceGapTrends({ days: Number(days), supplierId });
  const groups = groupBy === 'item' ? data?.items ?? [] : data?.suppliers ?? [];

  useEffect(() => {
    setSelected(groups.slice(0, 4).map((g) => g.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, days, data?.quotes.length]);

  const { chartData, seriesKeys } = useMemo(() => {
    if (!data || selected.length === 0) return { chartData: [], seriesKeys: [] as string[] };
    const { data: d, seriesKeys: s } = buildGapSeries(data.quotes, groupBy, selected, metric);
    return { chartData: d, seriesKeys: s };
  }, [data, groupBy, selected, metric]);

  // series label (used as dataKey) -> group key, so a clicked point maps back to its group
  const labelToKey = useMemo(() => {
    const m = new Map<string, string>();
    (data?.quotes ?? []).forEach((q) => {
      const k = groupBy === 'item' ? q.item_key : q.supplier_id || q.supplier_name;
      m.set(groupBy === 'item' ? q.item_label : q.supplier_name, k);
    });
    return m;
  }, [data, groupBy]);

  const [drill, setDrill] = useState<GapDrilldownTarget | null>(null);
  const drillQuotes = useMemo(() => {
    if (!drill || !data) return [];
    return selectGapQuotes(data.quotes, groupBy, drill.groupKey, drill.period);
  }, [drill, data, groupBy]);

  const openDrill = (period: string | undefined, seriesLabel: string) => {
    const key = labelToKey.get(seriesLabel);
    if (!period || !key) return;
    setDrill({ period, seriesLabel, groupKey: key });
  };


  const exportCsv = () => {
    if (!data) return;
    const head = [
      'Date',
      'Item',
      'Supplier',
      'Quoted price',
      'Lowest for item',
      'Target rate',
      'Gap vs lowest %',
      'Gap vs target %',
      'Pushed to sales',
    ];
    const body = data.quotes.map((q) => [
      new Date(q.created_at).toLocaleDateString('en-IN'),
      q.item_label,
      q.supplier_name,
      Math.round(q.purchase_price),
      Math.round(q.lowest_price),
      q.target_rate ?? '',
      q.gap_vs_lowest_pct.toFixed(2),
      q.gap_vs_target_pct?.toFixed(2) ?? '',
      q.is_pushed ? 'Yes' : 'No',
    ]);
    const csv = [head, ...body]
      .map((l) => l.map((c) => `"${String(c ?? '')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'price-gap-trends.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].slice(-6)
    );

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              Price gap trends
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Average % a quote sits above the {metric === 'lowest' ? 'lowest quote' : 'sales target'} ,
              month by month. Lower is better.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={metric} onValueChange={(v) => setMetric(v as any)}>
              <SelectTrigger className="h-8 w-[168px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lowest">Gap vs lowest quote</SelectItem>
                <SelectItem value="target">Gap vs target rate</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supplier">By supplier</SelectItem>
                <SelectItem value="item">By item</SelectItem>
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 6 months</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            No supplier quotes captured in this period yet.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, bottom: 4, left: -12 }}
                  onClick={(state: any) => {
                    if (seriesKeys.length !== 1) return;
                    const point = chartData[state?.activeTooltipIndex ?? -1];
                    if (point) openDrill(point.period as string, seriesKeys[0]);
                  }}
                  style={{ cursor: 'pointer' }}
                >

                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(v: any, n: any) => [`${Number(v).toFixed(1)}%`, n]}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                  {seriesKeys.map((k, i) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3, cursor: 'pointer' }}
                      activeDot={{
                        r: 5,
                        cursor: 'pointer',
                        onClick: (_e: any, payload: any) =>
                          openDrill(payload?.payload?.period, k),
                      }}
                      connectNulls
                    />
                  ))}

                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="border rounded-md">
              <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground">
                {groupBy === 'item' ? 'Items' : 'Suppliers'} (max 6)
              </div>
              <ScrollArea className="h-[260px]">
                <div className="p-2 space-y-1">
                  {groups.map((g) => (
                    <label
                      key={g.key}
                      className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-muted/60 cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.includes(g.key)}
                        onCheckedChange={() => toggle(g.key)}
                        className="mt-0.5"
                      />
                      <span className="text-xs leading-snug flex-1 break-words">{g.label}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {g.quotes}
                      </Badge>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </CardContent>
      <PriceGapDrilldown
        open={!!drill}
        onOpenChange={(v) => !v && setDrill(null)}
        target={drill}
        quotes={drillQuotes}
        metric={metric}
      />
    </Card>
  );

}
