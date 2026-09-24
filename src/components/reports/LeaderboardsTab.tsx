import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Users } from 'lucide-react';
import { ProductLeaderboards } from './ProductLeaderboards';
import { CustomerLeaderboards } from './CustomerLeaderboards';

interface LeaderboardsTabProps {
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

const LIMIT_OPTIONS = [
  { value: '50', label: 'Top 50' },
  { value: '100', label: 'Top 100' },
  { value: '250', label: 'Top 250' },
  { value: '0', label: 'All' },
];

export function LeaderboardsTab({ dateRange }: LeaderboardsTabProps) {
  const [limit, setLimit] = useState<number>(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Ranking tables with configurable limits and export capabilities
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <Select
            value={limit.toString()}
            onValueChange={(value) => setLimit(parseInt(value))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            Top Products
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Top Customers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductLeaderboards dateRange={dateRange} limit={limit} />
        </TabsContent>

        <TabsContent value="customers">
          <CustomerLeaderboards dateRange={dateRange} limit={limit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
