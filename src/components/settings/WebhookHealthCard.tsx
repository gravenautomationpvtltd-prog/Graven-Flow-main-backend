import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface WebhookStats {
  lastReceived: string | null;
  last15Minutes: number;
  lastHour: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  lastError: string | null;
}

interface WebhookHealthCardProps {
  source: string;
}

export function WebhookHealthCard({ source }: WebhookHealthCardProps) {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['webhook-health', source],
    queryFn: async (): Promise<WebhookStats> => {
      const now = new Date();
      const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

      // Get last received webhook
      const { data: lastWebhook } = await supabase
        .from('webhook_events')
        .select('created_at')
        .eq('source', source)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get counts for last 15 minutes
      const { count: last15 } = await supabase
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .eq('source', source)
        .gte('created_at', fifteenMinsAgo);

      // Get counts for last hour
      const { count: lastHourCount } = await supabase
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .eq('source', source)
        .gte('created_at', oneHourAgo);

      // Get success/fail/duplicate counts for last hour
      const { data: resultCounts } = await supabase
        .from('webhook_events')
        .select('processing_result')
        .eq('source', source)
        .gte('created_at', oneHourAgo);

      const successCount = resultCounts?.filter(r => r.processing_result === 'success').length || 0;
      const failedCount = resultCounts?.filter(r => r.processing_result === 'failed' || r.processing_result === 'invalid').length || 0;
      const duplicateCount = resultCounts?.filter(r => r.processing_result === 'duplicate').length || 0;

      // Get last error
      const { data: lastError } = await supabase
        .from('webhook_events')
        .select('error_message, created_at')
        .eq('source', source)
        .not('error_message', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        lastReceived: lastWebhook?.created_at || null,
        last15Minutes: last15 || 0,
        lastHour: lastHourCount || 0,
        successCount,
        failedCount,
        duplicateCount,
        lastError: lastError?.error_message || null,
      };
    },
    refetchInterval: 180000, // Refresh every 3 minutes (foreground only)
    refetchIntervalInBackground: false,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Webhook Health</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isHealthy = stats && stats.last15Minutes > 0 && stats.failedCount === 0;
  const hasActivity = stats && (stats.lastHour > 0);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Webhook Health</CardTitle>
          </div>
          {hasActivity && (
            <Badge 
              variant={isHealthy ? "default" : stats?.failedCount ? "destructive" : "secondary"} 
              className="text-xs"
            >
              {isHealthy ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Healthy
                </>
              ) : stats?.failedCount ? (
                <>
                  <XCircle className="mr-1 h-3 w-3" />
                  Issues
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  No Recent
                </>
              )}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Real-time webhook monitoring for {source} leads
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Last Received */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last Received
          </span>
          <span className="font-medium">
            {stats?.lastReceived 
              ? formatDistanceToNow(new Date(stats.lastReceived), { addSuffix: true })
              : "Never"
            }
          </span>
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <div className="text-lg font-semibold">{stats?.last15Minutes || 0}</div>
            <div className="text-xs text-muted-foreground">Last 15 min</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <div className="text-lg font-semibold">{stats?.lastHour || 0}</div>
            <div className="text-xs text-muted-foreground">Last hour</div>
          </div>
        </div>

        {/* Result Breakdown */}
        {hasActivity && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              {stats?.successCount} success
            </div>
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              {stats?.duplicateCount} duplicate
            </div>
            <div className="flex items-center gap-1 text-red-600">
              <XCircle className="h-3 w-3" />
              {stats?.failedCount} failed
            </div>
          </div>
        )}

        {/* Last Error */}
        {stats?.lastError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-950">
            <div className="flex items-start gap-2">
              <XCircle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-800 dark:text-red-200 line-clamp-2">
                {stats.lastError}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
