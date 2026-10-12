import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  ExternalLink, 
  ShieldCheck, 
  Clock, 
  Database, 
  Layers, 
  Terminal,
  Trash2
} from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { toast } from 'sonner';

export function SyncSettings() {
  const {
    state,
    sourceUrl,
    remoteApiUrl,
    lastAttempt,
    lastSuccessfulSync,
    lastError,
    isAutoSyncEnabled,
    syncIntervalMinutes,
    stats,
    logs,
    syncNow,
    setAutoSyncEnabled,
    clearLogs
  } = useSyncStatus();

  const [syncingManual, setSyncingManual] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const getTimeAgo = (isoString: string | null) => {
    if (!isoString) return null;
    try {
      const diffMs = now - new Date(isoString).getTime();
      if (diffMs < 0) return 'just now';
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin === 1) return '1 minute ago';
      if (diffMin < 60) return `${diffMin} minutes ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      const diffDays = Math.floor(diffHours / 24);
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } catch {
      return null;
    }
  };

  const timeAgo = getTimeAgo(lastSuccessfulSync);

  const handleManualSync = async () => {
    setSyncingManual(true);
    toast.info('Starting manual synchronization with Graven OneDesk...');
    try {
      const success = await syncNow();
      if (success) {
        toast.success('Synchronization completed successfully! Local data is up to date.');
      } else {
        toast.warning('Source is currently unreachable. The website continues operating normally on its local database.');
      }
    } catch (err: any) {
      toast.error('Sync request finished with note: ' + (err?.message || 'Check logs below'));
    } finally {
      setSyncingManual(false);
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Never';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = () => {
    switch (state) {
      case 'syncing':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 flex items-center gap-1.5 py-1 px-3 font-medium">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>🔵</span>
            Synchronizing...
          </Badge>
        );
      case 'synced':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 flex items-center gap-1.5 py-1 px-3 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>🟢</span>
            Active & Up To Date
          </Badge>
        );
      case 'offline':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 flex items-center gap-1.5 py-1 px-3 font-medium">
            <WifiOff className="h-3.5 w-3.5 text-amber-500" />
            <span>🟠</span>
            Source Offline — Standalone Mode
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 flex items-center gap-1.5 py-1 px-3 font-medium">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
            <span>🔴</span>
            Sync Notice
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-1.5 py-1 px-3 font-medium">
            <Clock className="h-3.5 w-3.5" />
            Idle
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <RefreshCw className="h-6 w-6 text-primary" />
                  Background Data Synchronization
                </CardTitle>
                {getStatusBadge()}
              </div>
              <CardDescription className="mt-1.5">
                Automatically synchronizes the current website with the latest data from{' '}
                <a 
                  href={sourceUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="font-medium text-primary inline-flex items-center gap-1 hover:underline"
                >
                  {sourceUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </CardDescription>
            </div>
            <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
              <Button 
                onClick={handleManualSync} 
                disabled={state === 'syncing' || syncingManual}
                className="gap-2 shadow-sm w-full sm:w-auto"
              >
                <RefreshCw className={`h-4 w-4 ${state === 'syncing' || syncingManual ? 'animate-spin' : ''}`} />
                {state === 'syncing' || syncingManual ? 'Syncing...' : 'Sync Now'}
              </Button>
              <span className="text-[11px] text-muted-foreground text-center sm:text-right">
                Manual sync — automatic sync continues in the background.
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Architecture Guarantee Banner */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3 mt-2">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Independent Operation & Non-Destructive Sync Guarantee</p>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                This website maintains its own independent database and does <strong>not</strong> depend on <span className="font-mono text-xs text-foreground bg-muted px-1.5 py-0.5 rounded">{sourceUrl}</span> being online. 
                All synchronization utilizes safe upsert logic: new and updated records are added, while <strong>zero existing data is ever deleted</strong>. Login, employee roles, and dashboards continue operating normally at all times.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Sync Status</span>
              {state === 'syncing' ? (
                <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
              ) : state === 'synced' ? (
                <Wifi className="h-4 w-4 text-emerald-500" />
              ) : state === 'offline' ? (
                <WifiOff className="h-4 w-4 text-amber-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              )}
            </div>
            <div className="text-base sm:text-lg font-bold">
              {state === 'syncing' ? (
                <span className="text-blue-500 flex items-center gap-1.5">
                  <span>🔵</span> Synchronizing...
                </span>
              ) : state === 'synced' ? (
                <span className="text-emerald-500 flex items-center gap-1.5">
                  <span>🟢</span> Active & Up To Date
                </span>
              ) : state === 'offline' ? (
                <span className="text-amber-500 flex items-center gap-1.5">
                  <span>🟠</span> Source Offline — Standalone Mode
                </span>
              ) : (
                <span className="text-rose-500 flex items-center gap-1.5">
                  <span>🔴</span> Sync Notice
                </span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {timeAgo && (
                <p className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  Last synced {timeAgo}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {state === 'offline'
                  ? 'gravenonedesk.in is unavailable, with automatic recovery when it returns.'
                  : state === 'syncing'
                  ? 'Applying safe updates in the background...'
                  : `Source: ${sourceUrl.replace('https://', '')}`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Last Successful Sync</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-sm font-semibold text-foreground">
              {formatDate(lastSuccessfulSync)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {timeAgo ? `Last synced ${timeAgo}` : (lastSuccessfulSync ? 'Data verified with source' : 'Initial sync in progress')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Last Attempt</span>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-sm font-semibold text-foreground">
              {formatDate(lastAttempt)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Interval: Every {syncIntervalMinutes} minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Safety & Deletions</span>
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xl font-bold text-emerald-500">
              Safe Upsert (0 Deletions)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Records processed: {stats.totalRecordsProcessed}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Configuration & Schedule Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Synchronization Controls & Preferences
          </CardTitle>
          <CardDescription>
            Configure background synchronization parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
            <div className="space-y-0.5">
              <Label htmlFor="auto-sync" className="text-base font-medium">Automatic Background Sync</Label>
              <p className="text-sm text-muted-foreground">
                Runs automatically every 5 minutes when the website is open.
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={isAutoSyncEnabled}
              onCheckedChange={setAutoSyncEnabled}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 bg-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Primary Source Endpoint</p>
              <p className="text-sm font-mono text-foreground">{sourceUrl}</p>
              <p className="text-xs text-muted-foreground mt-1.5">Monitored automatically; fails over to local standalone mode if offline.</p>
            </div>

            <div className="rounded-lg border p-4 bg-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Remote Data Endpoint</p>
              <p className="text-sm font-mono text-foreground truncate">{remoteApiUrl}</p>
              <p className="text-xs text-muted-foreground mt-1.5">Secure API channel for entity updates and catalog changes.</p>
            </div>
          </div>

          {lastError && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-500">Notice</p>
                <p className="text-sm text-muted-foreground mt-0.5">{lastError}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Synchronized Business Entities Matrix */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Synchronized Business Entities
              </CardTitle>
              <CardDescription>
                Live status and records synchronized across all business modules from {sourceUrl}
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 self-start sm:self-auto py-1 px-3">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              Safe Upsert (0 Deletions Guaranteed)
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(stats.entities || {}).map((item) => (
              <div 
                key={item.key}
                className="rounded-lg border p-3.5 bg-card/60 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {item.category}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {item.status === 'error' ? 'Notice' : 'Safe Upsert Active'}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-primary/10 text-primary">
                    {item.processed} synced
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sync Log Console */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Sync Activity & Audit Log
            </CardTitle>
            <CardDescription>
              Chronological log of synchronization events and connectivity status
            </CardDescription>
          </div>
          {logs.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearLogs} className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Trash2 className="h-3.5 w-3.5" />
              Clear Log
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No synchronization events recorded yet. Background sync runs automatically.
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="rounded-md border p-3 text-xs bg-muted/30 flex items-start justify-between gap-3 font-mono"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.type === 'success' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : log.type === 'error'
                          ? 'bg-rose-500/20 text-rose-400'
                          : log.type === 'warn'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {log.type}
                      </span>
                      <span className="text-foreground font-sans font-medium">{log.message}</span>
                    </div>
                    {log.details && (
                      <p className="text-muted-foreground font-sans pl-1">{log.details}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
