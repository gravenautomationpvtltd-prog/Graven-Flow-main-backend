import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle,
  Settings,
  TrendingDown,
  DollarSign,
  RefreshCw,
  X,
} from 'lucide-react';

interface PricingAlert {
  id: string;
  product_id: string | null;
  product_name: string | null;
  alert_type: 'low_win_rate' | 'high_price_gap' | 'price_increase' | 'price_decrease';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metric_value: number | null;
  threshold_value: number | null;
  is_read: boolean;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

interface AlertSettings {
  id: string;
  setting_key: string;
  setting_value: number;
  description: string | null;
}

// Hook to fetch pricing alerts
function usePricingAlerts() {
  return useQuery({
    queryKey: ['pricing-alerts'],
    queryFn: async (): Promise<PricingAlert[]> => {
      const { data, error } = await supabase
        .from('pricing_alerts')
        .select(`
          *,
          product:products (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map(d => ({
        id: d.id,
        product_id: d.product_id,
        product_name: (d.product as any)?.name || null,
        alert_type: d.alert_type as PricingAlert['alert_type'],
        severity: d.severity as PricingAlert['severity'],
        title: d.title,
        message: d.message,
        metric_value: d.metric_value,
        threshold_value: d.threshold_value,
        is_read: d.is_read,
        is_resolved: d.is_resolved,
        resolved_by: d.resolved_by,
        resolved_at: d.resolved_at,
        resolution_notes: d.resolution_notes,
        created_at: d.created_at,
      }));
    },
  });
}

// Hook to fetch alert settings
function useAlertSettings() {
  return useQuery({
    queryKey: ['pricing-alert-settings'],
    queryFn: async (): Promise<AlertSettings[]> => {
      const { data, error } = await supabase
        .from('pricing_alert_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;
      return data || [];
    },
  });
}

// Hook to update alert settings
function useUpdateAlertSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: { setting_key: string; setting_value: number }[]) => {
      for (const setting of settings) {
        const { error } = await supabase
          .from('pricing_alert_settings')
          .update({ setting_value: setting.setting_value, updated_at: new Date().toISOString() })
          .eq('setting_key', setting.setting_key);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-alert-settings'] });
      toast.success('Alert thresholds updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update settings: ' + error.message);
    },
  });
}

// Hook to resolve an alert
function useResolveAlert() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, resolution_notes }: { id: string; resolution_notes: string }) => {
      const { error } = await supabase
        .from('pricing_alerts')
        .update({
          is_resolved: true,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
          resolution_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-alerts'] });
      toast.success('Alert resolved');
    },
    onError: (error: Error) => {
      toast.error('Failed to resolve alert: ' + error.message);
    },
  });
}

// Hook to mark alert as read
function useMarkAlertRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pricing_alerts')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-alerts'] });
    },
  });
}

// Hook to run the check_pricing_alerts function
function useRunAlertCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('check_pricing_alerts');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-alerts'] });
      toast.success('Alert check completed');
    },
    onError: (error: Error) => {
      toast.error('Failed to run alert check: ' + error.message);
    },
  });
}

export function PricingAlertsPanel() {
  const { isAdmin } = useAuth();
  const canEditSettings = isAdmin;
  
  const [showSettings, setShowSettings] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<PricingAlert | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showUnresolved, setShowUnresolved] = useState(true);

  const { data: alerts, isLoading } = usePricingAlerts();
  const { data: settings } = useAlertSettings();
  const updateSettings = useUpdateAlertSettings();
  const resolveAlert = useResolveAlert();
  const markRead = useMarkAlertRead();
  const runCheck = useRunAlertCheck();

  const [localSettings, setLocalSettings] = useState<Record<string, number>>({});

  // Initialize local settings when data loads
  const getSettingValue = (key: string): number => {
    if (localSettings[key] !== undefined) return localSettings[key];
    const setting = settings?.find(s => s.setting_key === key);
    return setting?.setting_value || 0;
  };

  const filteredAlerts = alerts?.filter(a => showUnresolved ? !a.is_resolved : true) || [];
  const unresolvedCount = alerts?.filter(a => !a.is_resolved).length || 0;
  const criticalCount = alerts?.filter(a => !a.is_resolved && a.severity === 'critical').length || 0;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'low_win_rate': return <TrendingDown className="h-4 w-4" />;
      case 'high_price_gap': return <DollarSign className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const handleResolve = (alert: PricingAlert) => {
    setSelectedAlert(alert);
    setResolutionNotes('');
    setShowResolve(true);
  };

  const confirmResolve = () => {
    if (selectedAlert) {
      resolveAlert.mutate({ id: selectedAlert.id, resolution_notes: resolutionNotes });
      setShowResolve(false);
      setSelectedAlert(null);
    }
  };

  const handleSaveSettings = () => {
    const settingsToUpdate = Object.entries(localSettings).map(([key, value]) => ({
      setting_key: key,
      setting_value: value,
    }));
    updateSettings.mutate(settingsToUpdate);
    setShowSettings(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Pricing Alerts</CardTitle>
            {unresolvedCount > 0 && (
              <Badge variant={criticalCount > 0 ? 'destructive' : 'secondary'}>
                {unresolvedCount} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUnresolved(!showUnresolved)}
            >
              {showUnresolved ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runCheck.mutate()}
              disabled={runCheck.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${runCheck.isPending ? 'animate-spin' : ''}`} />
            </Button>
            {canEditSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Automated alerts for low win rates and price gaps
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
            <p>No {showUnresolved ? 'active' : ''} alerts</p>
            <p className="text-sm">All pricing metrics are within thresholds</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.is_resolved ? 'bg-muted/50 opacity-60' : 'bg-card'
                  } ${!alert.is_read && !alert.is_resolved ? 'border-primary/50' : ''}`}
                  onClick={() => !alert.is_read && markRead.mutate(alert.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className={`mt-0.5 ${
                        alert.severity === 'critical' ? 'text-destructive' : 
                        alert.severity === 'warning' ? 'text-yellow-500' : 'text-muted-foreground'
                      }`}>
                        {getAlertIcon(alert.alert_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{alert.title}</span>
                          <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                            {alert.severity}
                          </Badge>
                          {alert.is_resolved && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Resolved
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {!alert.is_resolved && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolve(alert);
                        }}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alert Thresholds</DialogTitle>
            <DialogDescription>
              Configure when automated alerts should be triggered
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="min_win_rate">Minimum Win Rate (%)</Label>
              <Input
                id="min_win_rate"
                type="number"
                min="0"
                max="100"
                value={getSettingValue('min_win_rate_threshold')}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  min_win_rate_threshold: parseFloat(e.target.value) || 0,
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Alert when a product's win rate falls below this percentage
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_price_gap">Maximum Price Gap (%)</Label>
              <Input
                id="max_price_gap"
                type="number"
                min="0"
                max="100"
                value={getSettingValue('max_price_gap_threshold')}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  max_price_gap_threshold: parseFloat(e.target.value) || 0,
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Alert when average price gap exceeds this percentage
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="significant_change">Significant Price Change (%)</Label>
              <Input
                id="significant_change"
                type="number"
                min="0"
                max="100"
                value={getSettingValue('significant_price_change')}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  significant_price_change: parseFloat(e.target.value) || 0,
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Alert when a product price changes by this percentage or more
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Alert Dialog */}
      <Dialog open={showResolve} onOpenChange={setShowResolve}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Alert</DialogTitle>
            <DialogDescription>
              Add notes about how this alert was addressed
            </DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium text-sm">{selectedAlert.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedAlert.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resolution_notes">Resolution Notes</Label>
                <Textarea
                  id="resolution_notes"
                  placeholder="Describe the actions taken to address this alert..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolve(false)}>
              Cancel
            </Button>
            <Button onClick={confirmResolve} disabled={resolveAlert.isPending}>
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
