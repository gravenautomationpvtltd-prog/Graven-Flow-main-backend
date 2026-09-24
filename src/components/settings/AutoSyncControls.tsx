import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useUpdateIntegration, IntegrationType } from "@/hooks/useIntegrations";
import { Clock, Play, Pause, RefreshCw, Loader2, History, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AutoSyncControlsProps {
  integrationType: IntegrationType;
  isEnabled: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
  isConfigured: boolean;
}

// IndiaMART API enforces a 5-minute rate limit, so minimum interval is 5 minutes
const getSyncIntervalOptions = (integrationType: string) => {
  const baseOptions = [
    { value: "5", label: "Every 5 minutes" },
    { value: "15", label: "Every 15 minutes" },
    { value: "30", label: "Every 30 minutes" },
    { value: "60", label: "Every 1 hour" },
  ];
  
  // Only non-IndiaMART integrations can use 1-minute intervals
  if (integrationType !== 'indiamart') {
    return [{ value: "1", label: "Every 1 minute" }, ...baseOptions];
  }
  
  return baseOptions;
};

const integrationLabels: Record<string, string> = {
  indiamart: 'IndiaMART',
  tradeindia: 'TradeIndia',
};

const recoveryTimeOptions = [
  { value: "1", label: "Last 1 hour" },
  { value: "2", label: "Last 2 hours" },
  { value: "4", label: "Last 4 hours" },
  { value: "6", label: "Last 6 hours" },
  { value: "12", label: "Last 12 hours" },
  { value: "24", label: "Last 24 hours" },
];

export function AutoSyncControls({
  integrationType,
  isEnabled,
  syncInterval,
  lastSyncAt,
  isConfigured,
}: AutoSyncControlsProps) {
  const updateIntegration = useUpdateIntegration();
  const [isUpdatingCron, setIsUpdatingCron] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(isEnabled);
  // Ensure minimum 5 minutes for IndiaMART due to API rate limit
  const effectiveInterval = integrationType === 'indiamart' && (syncInterval || 1) < 5 ? 5 : (syncInterval || 5);
  const [selectedInterval, setSelectedInterval] = useState(String(effectiveInterval));
  
  // Recovery sync state
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [recoveryHours, setRecoveryHours] = useState("4");
  const [isRecoverySyncing, setIsRecoverySyncing] = useState(false);

  const getCronExpression = (minutes: number): string => {
    if (minutes === 1) return "* * * * *";
    if (minutes < 60) return `*/${minutes} * * * *`;
    return "0 * * * *"; // Every hour
  };

  const getScheduleFunction = () => {
    return integrationType === 'tradeindia' 
      ? 'schedule_tradeindia_sync' 
      : 'schedule_indiamart_sync';
  };

  const getUnscheduleFunction = () => {
    return integrationType === 'tradeindia' 
      ? 'unschedule_tradeindia_sync' 
      : 'unschedule_indiamart_sync';
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    if (!isConfigured) {
      toast.error("Please configure API accounts first");
      return;
    }

    setIsUpdatingCron(true);
    try {
      if (enabled) {
        // Create or update cron job
        const cronExpression = getCronExpression(parseInt(selectedInterval));
        
        // First unschedule existing job if any
        try {
          await supabase.rpc(getUnscheduleFunction() as never);
        } catch {
          // Ignore error if job doesn't exist
        }

        // Schedule new job
        const { error } = await supabase.rpc(getScheduleFunction() as never, {
          cron_expression: cronExpression,
        } as never);

        if (error) {
          console.error("Failed to schedule sync:", error);
          toast.error("Failed to enable auto-sync");
          return;
        }
      } else {
        // Remove cron job
        try {
          await supabase.rpc(getUnscheduleFunction() as never);
        } catch (e) {
          console.error("Failed to unschedule sync:", e);
        }
      }

      // Update settings
      await updateIntegration.mutateAsync({
        integrationType,
        updates: { 
          is_enabled: enabled,
          sync_interval_minutes: parseInt(selectedInterval),
        },
      });

      setAutoSyncEnabled(enabled);
      toast.success(enabled ? "Auto-sync enabled" : "Auto-sync disabled");
    } catch (error) {
      console.error("Error toggling auto-sync:", error);
      toast.error("Failed to update auto-sync settings");
    } finally {
      setIsUpdatingCron(false);
    }
  };

  const handleIntervalChange = async (value: string) => {
    setSelectedInterval(value);
    
    if (!autoSyncEnabled) {
      // Just update the setting without modifying cron
      await updateIntegration.mutateAsync({
        integrationType,
        updates: { sync_interval_minutes: parseInt(value) },
      });
      return;
    }

    setIsUpdatingCron(true);
    try {
      const cronExpression = getCronExpression(parseInt(value));
      
      // Unschedule existing and create new
      try {
        await supabase.rpc(getUnscheduleFunction() as never);
      } catch {
        // Ignore
      }
      
      const { error } = await supabase.rpc(getScheduleFunction() as never, {
        cron_expression: cronExpression,
      } as never);

      if (error) {
        console.error("Failed to update schedule:", error);
        toast.error("Failed to update sync interval");
        return;
      }

      await updateIntegration.mutateAsync({
        integrationType,
        updates: { sync_interval_minutes: parseInt(value) },
      });

      toast.success(`Sync interval updated to ${value} minute(s)`);
    } catch (error) {
      console.error("Error updating interval:", error);
      toast.error("Failed to update sync interval");
    } finally {
      setIsUpdatingCron(false);
    }
  };

  const getNextSyncTime = (): string => {
    if (!autoSyncEnabled || !lastSyncAt) return "—";
    const lastSync = new Date(lastSyncAt);
    const nextSync = new Date(lastSync.getTime() + parseInt(selectedInterval) * 60 * 1000);
    
    if (nextSync < new Date()) {
      return "Any moment now";
    }
    
    return formatDistanceToNow(nextSync, { addSuffix: true });
  };

  const handleRecoverySync = async () => {
    if (!isConfigured) {
      toast.error("Please configure API accounts first");
      return;
    }

    setIsRecoverySyncing(true);
    try {
      const functionName = integrationType === 'tradeindia' ? 'tradeindia-leads' : 'indiamart-leads';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          recovery_hours: parseInt(recoveryHours), 
          force: true 
        }
      });

      if (error) {
        console.error("Recovery sync error:", error);
        toast.error(`Recovery sync failed: ${error.message}`);
        return;
      }

      const totalFetched = data?.total_fetched || 0;
      const totalSynced = data?.total_leads_synced || 0;
      const customersCreated = data?.total_customers_created || 0;

      if (totalSynced > 0) {
        toast.success(`Recovery sync complete! Found ${totalFetched} leads, synced ${totalSynced} new leads, created ${customersCreated} new customers.`);
      } else if (totalFetched > 0) {
        toast.info(`Recovery sync complete. Found ${totalFetched} leads, but all were already in the system.`);
      } else {
        toast.info(`Recovery sync complete. No leads found in the specified time range.`);
      }

      setIsRecoveryDialogOpen(false);
    } catch (error) {
      console.error("Recovery sync error:", error);
      toast.error("Recovery sync failed");
    } finally {
      setIsRecoverySyncing(false);
    }
  };

  const label = integrationLabels[integrationType] || integrationType;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{label} Auto-Sync</CardTitle>
          </div>
          <Badge variant={autoSyncEnabled ? "default" : "secondary"} className="text-xs">
            {autoSyncEnabled ? (
              <>
                <Play className="mr-1 h-3 w-3" />
                Running
              </>
            ) : (
              <>
                <Pause className="mr-1 h-3 w-3" />
                Paused
              </>
            )}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Automatically fetch new leads from {label} at scheduled intervals
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-medium">Enable Auto-Sync</span>
            <p className="text-xs text-muted-foreground">
              Uses pg_cron for reliable scheduling
            </p>
          </div>
          <Switch
            checked={autoSyncEnabled}
            onCheckedChange={handleToggleAutoSync}
            disabled={!isConfigured || isUpdatingCron}
          />
        </div>

        {/* Interval Selector */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-medium">Sync Interval</span>
            {integrationType === 'indiamart' && (
              <p className="text-xs text-muted-foreground">
                Min 5 mins (API rate limit)
              </p>
            )}
          </div>
          <Select
            value={selectedInterval}
            onValueChange={handleIntervalChange}
            disabled={isUpdatingCron}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              {getSyncIntervalOptions(integrationType).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Info */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last Sync</span>
            <span className="font-medium">
              {lastSyncAt 
                ? formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })
                : "Never"
              }
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Next Sync</span>
            <span className="font-medium flex items-center gap-1">
              {isUpdatingCron ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  {getNextSyncTime()}
                </>
              )}
            </span>
          </div>
        </div>

        {/* Recovery Sync Button - Only for IndiaMART */}
        {integrationType === 'indiamart' && (
          <Dialog open={isRecoveryDialogOpen} onOpenChange={setIsRecoveryDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                disabled={!isConfigured}
              >
                <History className="mr-2 h-4 w-4" />
                Recovery Sync
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recovery Sync
                </DialogTitle>
                <DialogDescription>
                  Fetch missed leads from a custom time range. Use this if leads were missed due to API issues or downtime.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-medium">Rate Limit Warning</p>
                      <p className="text-xs mt-1">
                        IndiaMART API allows only 1 request per 5 minutes. This recovery sync will bypass rate limiting. Avoid running multiple recovery syncs in quick succession.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Range</label>
                  <Select value={recoveryHours} onValueChange={setRecoveryHours}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time range" />
                    </SelectTrigger>
                    <SelectContent>
                      {recoveryTimeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This will fetch all leads from the past {recoveryHours} hour(s)
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsRecoveryDialogOpen(false)}
                  disabled={isRecoverySyncing}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleRecoverySync}
                  disabled={isRecoverySyncing}
                >
                  {isRecoverySyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Start Recovery Sync
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
