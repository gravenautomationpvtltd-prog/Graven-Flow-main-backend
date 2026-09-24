import { useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAllEmailLogs, useEmailStats, type EmailLogFilters } from '@/hooks/useAllEmailLogs';
import { EmailStatsCards } from '@/components/email/EmailStatsCards';
import { EmailLogsTable } from '@/components/email/EmailLogsTable';
import { useQueryClient } from '@tanstack/react-query';
import { DateRangeFilter, type DatePreset, getDateRangeFromPreset } from '@/components/ui/date-range-filter';

export default function EmailAnalytics() {
  const queryClient = useQueryClient();
  
  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const dateRange = getDateRangeFromPreset(datePreset, customFrom, customTo);
  
  const [filters, setFilters] = useState<EmailLogFilters>({
    dateFrom: dateRange.from?.toISOString(),
    dateTo: dateRange.to?.toISOString(),
  });
  
  // Update filters when date range changes
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const newRange = getDateRangeFromPreset(preset, customFrom, customTo);
    setFilters(prev => ({
      ...prev,
      dateFrom: newRange.from?.toISOString(),
      dateTo: newRange.to?.toISOString(),
    }));
  };
  
  const handleCustomFromChange = (date: Date | undefined) => {
    setCustomFrom(date);
    const newRange = getDateRangeFromPreset(datePreset, date, customTo);
    setFilters(prev => ({
      ...prev,
      dateFrom: newRange.from?.toISOString(),
      dateTo: newRange.to?.toISOString(),
    }));
  };
  
  const handleCustomToChange = (date: Date | undefined) => {
    setCustomTo(date);
    const newRange = getDateRangeFromPreset(datePreset, customFrom, date);
    setFilters(prev => ({
      ...prev,
      dateFrom: newRange.from?.toISOString(),
      dateTo: newRange.to?.toISOString(),
    }));
  };
  
  const { data: stats, isLoading: statsLoading } = useEmailStats();
  const { data: logs, isLoading: logsLoading, isFetching } = useAllEmailLogs(filters);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['all-email-logs'] });
    queryClient.invalidateQueries({ queryKey: ['email-stats'] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Email Analytics
          </h1>
          <p className="text-muted-foreground">
            Track your email delivery, opens, and engagement for your quotations
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter
            datePreset={datePreset}
            onDatePresetChange={handleDatePresetChange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={handleCustomFromChange}
            onCustomToChange={handleCustomToChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <EmailStatsCards stats={stats} isLoading={statsLoading} />

      {/* Email Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Email Activity</CardTitle>
          <CardDescription>
            Your email communications with delivery and engagement tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailLogsTable
            logs={logs}
            isLoading={logsLoading}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </CardContent>
      </Card>
    </div>
  );
}
