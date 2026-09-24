import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Percent, Package } from "lucide-react";
import type { ProfitStats } from "@/hooks/useProfitAnalytics";

interface ProfitStatsCardsProps {
  stats: ProfitStats | undefined;
  isLoading: boolean;
}

export function ProfitStatsCards({ stats, isLoading }: ProfitStatsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-4 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Revenue",
      value: formatCurrency(stats?.totalRevenue || 0),
      icon: DollarSign,
      description: "From products with margin data",
      color: "text-blue-500",
    },
    {
      title: "Total Cost",
      value: formatCurrency(stats?.totalCost || 0),
      icon: TrendingDown,
      description: "Purchase cost of sold items",
      color: "text-orange-500",
    },
    {
      title: "Gross Profit",
      value: formatCurrency(stats?.grossProfit || 0),
      icon: TrendingUp,
      description: "Revenue minus cost",
      color: stats?.grossProfit && stats.grossProfit > 0 ? "text-green-500" : "text-red-500",
    },
    {
      title: "Avg. Margin %",
      value: `${(stats?.avgMarginPercent || 0).toFixed(1)}%`,
      icon: Percent,
      description: "Weighted average margin",
      color: (stats?.avgMarginPercent || 0) >= 20 ? "text-green-500" : (stats?.avgMarginPercent || 0) >= 10 ? "text-yellow-500" : "text-red-500",
    },
    {
      title: "Products w/ Margin",
      value: `${stats?.productsWithMargin || 0}/${stats?.totalProducts || 0}`,
      icon: Package,
      description: "Products with purchase price set",
      color: "text-purple-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
