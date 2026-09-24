import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { computeWeightedTotal, calculateScores } from '@/hooks/useVendorEvaluation';
import { useState, useMemo } from 'react';
import { Award } from 'lucide-react';

interface VendorData {
  supplierId: string;
  supplierName: string;
  totalPrice: number;
  deliveryDays: number | null;
  avgRating: number;
}

interface Props {
  vendors: VendorData[];
  onAward?: (supplierId: string) => void;
}

export function VendorScoringPanel({ vendors, onAward }: Props) {
  const [complianceScores, setComplianceScores] = useState<Record<string, number>>({});

  const scored = useMemo(() => {
    if (vendors.length === 0) return [];

    const { priceScores, deliveryScores } = calculateScores(vendors);

    return vendors.map((v, i) => {
      const compliance = complianceScores[v.supplierId] ?? 50;
      const performance = Math.round(v.avgRating * 20); // 5-star -> 100
      const weighted = computeWeightedTotal({
        price: priceScores[i],
        delivery: deliveryScores[i],
        compliance,
        performance,
      });

      return {
        ...v,
        priceScore: priceScores[i],
        deliveryScore: deliveryScores[i],
        complianceScore: compliance,
        performanceScore: performance,
        weightedTotal: weighted,
      };
    }).sort((a, b) => b.weightedTotal - a.weightedTotal);
  }, [vendors, complianceScores]);

  const chartData = scored.map((v) => ({
    name: v.supplierName.length > 15 ? v.supplierName.slice(0, 15) + '...' : v.supplierName,
    'Price (50%)': v.priceScore,
    'Delivery (20%)': v.deliveryScore,
    'Compliance (20%)': v.complianceScore,
    'Performance (10%)': v.performanceScore,
  }));

  if (vendors.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weighted Vendor Scoring</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" fontSize={12} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Price (50%)" fill="hsl(var(--primary))" />
              <Bar dataKey="Delivery (20%)" fill="hsl(210, 70%, 60%)" />
              <Bar dataKey="Compliance (20%)" fill="hsl(150, 60%, 50%)" />
              <Bar dataKey="Performance (10%)" fill="hsl(40, 80%, 55%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scoring table */}
        <div className="space-y-3">
          {scored.map((v, idx) => (
            <div key={v.supplierId} className="flex items-center gap-4 p-3 border rounded-lg">
              <div className="flex items-center gap-2 flex-1">
                {idx === 0 && <Badge className="bg-yellow-500 text-black">Best</Badge>}
                <span className="font-medium">{v.supplierName}</span>
              </div>
              <div className="text-sm text-muted-foreground flex gap-3">
                <span>Price: {v.priceScore}</span>
                <span>Delivery: {v.deliveryScore}</span>
                <span>Performance: {v.performanceScore}</span>
              </div>
              <div className="w-40">
                <Select
                  value={String(complianceScores[v.supplierId] ?? 50)}
                  onValueChange={(val) => setComplianceScores((p) => ({ ...p, [v.supplierId]: Number(val) }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">Full Compliance</SelectItem>
                    <SelectItem value="70">Partial</SelectItem>
                    <SelectItem value="30">Non-Compliant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-lg font-bold w-12 text-center">{v.weightedTotal}</div>
              {onAward && (
                <Button variant="outline" size="sm" onClick={() => onAward(v.supplierId)}>
                  <Award className="h-4 w-4 mr-1" /> Award
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
