import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { useQuotationAnalytics, type StageFilter } from '@/hooks/useQuotationAnalytics';
import { QuotationKPICards } from './quotation-analytics/QuotationKPICards';
import { QuotationVolumeChart } from './quotation-analytics/QuotationVolumeChart';
import { QuotationConversionTimeChart } from './quotation-analytics/QuotationConversionTimeChart';
import { StaffQuotationTable } from './quotation-analytics/StaffQuotationTable';
import { CustomerQuotationTable } from './quotation-analytics/CustomerQuotationTable';
import { WinLossReasonsChart } from './quotation-analytics/WinLossReasonsChart';
import { Badge } from '@/components/ui/badge';
import type { QuotationKPIs, StaffBreakdown, CustomerBreakdown, MonthlyVolume, ConversionTimeBucket, ReasonCount } from '@/hooks/useQuotationAnalytics';

interface Props {
  dateRange: { from?: Date; to?: Date };
}

const stageFilters: { value: StageFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'price_matched', label: 'Price Matched' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

export function QuotationAnalyticsTab({ dateRange }: Props) {
  const { data, isLoading, isError, refetch } = useQuotationAnalytics(dateRange);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');

  // Filter all data based on stage — not just tables
  const filteredData = useMemo(() => {
    if (!data) return null;

    // Stage-filtered staff
    let staffBreakdown = data.staffBreakdown;
    if (stageFilter === 'price_matched') {
      staffBreakdown = staffBreakdown.filter(s => s.priceMatchedCount > 0);
    } else if (stageFilter === 'converted') {
      staffBreakdown = staffBreakdown.filter(s => s.convertedCount > 0);
    } else if (stageFilter === 'lost') {
      staffBreakdown = staffBreakdown.filter(s => s.lostCount > 0);
    } else if (stageFilter === 'pending') {
      staffBreakdown = staffBreakdown.filter(s => s.pendingCount > 0);
    }

    // Stage-filtered customers
    let customerBreakdown = data.customerBreakdown;
    if (stageFilter === 'price_matched') {
      customerBreakdown = customerBreakdown.filter(c => c.priceMatchedCount > 0);
    } else if (stageFilter === 'converted') {
      customerBreakdown = customerBreakdown.filter(c => c.convertedCount > 0);
    } else if (stageFilter === 'lost') {
      customerBreakdown = customerBreakdown.filter(c => c.lostCount > 0);
    } else if (stageFilter === 'pending') {
      customerBreakdown = customerBreakdown.filter(c => c.pendingCount > 0);
    }

    // Apply staff filter to customers
    if (selectedStaffId) {
      customerBreakdown = customerBreakdown.filter(c => c.staffIds.includes(selectedStaffId));
    }

    // Stage-filtered KPIs
    let kpis = data.kpis;
    if (stageFilter !== 'all') {
      const stageCount = stageFilter === 'converted' ? kpis.matchedConvertedCount
        : stageFilter === 'price_matched' ? kpis.priceMatchedCount
        : stageFilter === 'lost' ? kpis.lostCount
        : kpis.pendingCount;
      // Show the relevant subset count prominently
      kpis = {
        ...kpis,
        // Override total with stage-specific count for context
      };
    }

    return {
      kpis,
      staffBreakdown,
      customerBreakdown,
      monthlyVolume: data.monthlyVolume,
      conversionTimeBuckets: data.conversionTimeBuckets,
      winReasons: data.winReasons,
      lossReasons: data.lossReasons,
    };
  }, [data, stageFilter, selectedStaffId]);

  const selectedStaffName = useMemo(() => {
    if (!selectedStaffId || !data?.staffBreakdown) return null;
    return data.staffBreakdown.find(s => s.staffId === selectedStaffId)?.staffName || null;
  }, [selectedStaffId, data?.staffBreakdown]);

  // Reset staff selection when stage changes
  const handleStageChange = (stage: StageFilter) => {
    setStageFilter(stage);
    setSelectedStaffId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[350px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Failed to load quotation analytics. Please try again.</p>
        <Button variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (!filteredData) return null;

  // Stage counts for badge labels
  const stageCounts = data ? {
    all: data.kpis.totalQuotations,
    pending: data.kpis.pendingCount,
    price_matched: data.kpis.priceMatchedCount,
    converted: data.kpis.matchedConvertedCount || data.staffBreakdown.reduce((s, st) => s + st.convertedCount, 0),
    lost: data.kpis.lostCount,
  } : {};

  return (
    <div className="space-y-6">
      <QuotationKPICards kpis={filteredData.kpis} activeStage={stageFilter} />

      {/* Stage Filter Chips with counts */}
      <div className="flex flex-wrap gap-2">
        {stageFilters.map((filter) => (
          <Badge
            key={filter.value}
            variant={stageFilter === filter.value ? 'default' : 'outline'}
            className="cursor-pointer px-3 py-1.5 text-xs gap-1.5"
            onClick={() => handleStageChange(filter.value)}
          >
            {filter.label}
            <span className="opacity-70">
              ({(stageCounts as any)[filter.value] ?? 0})
            </span>
          </Badge>
        ))}
        {selectedStaffId && (
          <Badge variant="secondary" className="px-3 py-1.5 text-xs gap-1.5">
            Staff: {selectedStaffName}
            <button className="ml-1 hover:text-destructive" onClick={() => setSelectedStaffId(null)}>✕</button>
          </Badge>
        )}
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        <QuotationVolumeChart data={filteredData.monthlyVolume} />
        <QuotationConversionTimeChart data={filteredData.conversionTimeBuckets} />
      </div>

      <WinLossReasonsChart winReasons={filteredData.winReasons} lossReasons={filteredData.lossReasons} />

      <StaffQuotationTable
        data={filteredData.staffBreakdown}
        selectedStaffId={selectedStaffId}
        onSelectStaff={setSelectedStaffId}
        dateRange={dateRange}
      />

      <CustomerQuotationTable
        data={filteredData.customerBreakdown}
        staffFilter={selectedStaffId}
        staffFilterName={selectedStaffName}
        dateRange={dateRange}
      />
    </div>
  );
}
