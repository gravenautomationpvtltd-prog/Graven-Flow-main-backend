import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clock, Play, Pause, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const staleDaysOptions = [
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "15", label: "15 days" },
  { value: "30", label: "30 days" },
  { value: "45", label: "45 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

export function CRODistributionControls() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [staleDays, setStaleDays] = useState("30");
  const [isRunningManual, setIsRunningManual] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      if (enabled) {
        // Unschedule first if exists
        try {
          await supabase.rpc("unschedule_cro_distribution" as never);
        } catch {
          // Ignore
        }

        // Schedule daily at 7 AM UTC (12:30 PM IST)
        const { error } = await supabase.rpc("schedule_cro_distribution" as never, {
          cron_expression: "0 7 * * *",
        } as never);

        if (error) {
          console.error("Failed to schedule CRO distribution:", error);
          toast.error("Failed to enable daily distribution");
          return;
        }
      } else {
        const { error } = await supabase.rpc("unschedule_cro_distribution" as never);
        if (error) {
          console.error("Failed to unschedule:", error);
        }
      }

      setIsEnabled(enabled);
      toast.success(enabled ? "Daily CRO distribution enabled (7 AM UTC)" : "Daily CRO distribution disabled");
    } catch (error) {
      console.error("Error toggling CRO distribution:", error);
      toast.error("Failed to update CRO distribution schedule");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleManualRun = async () => {
    setIsRunningManual(true);
    try {
      const { data, error } = await supabase.functions.invoke("cro-distribute", {
        body: { stale_days: parseInt(staleDays) },
      });

      if (error) {
        toast.error(`Distribution failed: ${error.message}`);
        return;
      }

      const totalAssigned = data?.results?.reduce(
        (sum: number, r: any) => sum + (r.result?.assigned_count || 0),
        0
      ) || 0;

      toast.success(`Distribution complete! ${totalAssigned} customers assigned across ${data?.tenants_processed || 0} tenant(s)`);
    } catch (error) {
      console.error("Manual CRO distribution error:", error);
      toast.error("Failed to run CRO distribution");
    } finally {
      setIsRunningManual(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">CRO Customer Distribution</CardTitle>
          </div>
          <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">
            {isEnabled ? (
              <>
                <Play className="mr-1 h-3 w-3" />
                Active
              </>
            ) : (
              <>
                <Pause className="mr-1 h-3 w-3" />
                Inactive
              </>
            )}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Automatically distribute stale customers to CRO team members daily via round-robin
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-medium">Enable Daily Distribution</span>
            <p className="text-xs text-muted-foreground">
              Runs daily at 7:00 AM UTC (12:30 PM IST)
            </p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={isUpdating}
          />
        </div>

        {/* Stale Days Selector */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-medium">Stale Threshold</span>
            <p className="text-xs text-muted-foreground">
              Customers with no leads in this period
            </p>
          </div>
          <Select value={staleDays} onValueChange={setStaleDays}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {staleDaysOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Schedule Info */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Schedule</span>
            <span className="font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isEnabled ? "Daily at 7:00 AM UTC" : "Not scheduled"}
            </span>
          </div>
        </div>

        {/* Manual Run Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleManualRun}
          disabled={isRunningManual}
        >
          {isRunningManual ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Distributing...
            </>
          ) : (
            <>
              <Users className="mr-2 h-4 w-4" />
              Run Distribution Now
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
