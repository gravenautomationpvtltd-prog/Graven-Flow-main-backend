import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  useIntegrationSettings, 
  useUpdateIntegration,
  useSyncIntegration,
  useTestIntegration,
  IntegrationType 
} from "@/hooks/useIntegrations";
import { IntegrationConfigDialog } from "./IntegrationConfigDialog";
import { IntegrationAccountsDialog } from "./IntegrationAccountsDialog";
import { IntegrationLogs } from "./IntegrationLogs";
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/hooks/useAuth";
import { AutoSyncControls } from "./AutoSyncControls";
import { WebhookHealthCard } from "./WebhookHealthCard";
import { CRODistributionControls } from "./CRODistributionControls";
import { useAllIntegrationAccounts } from "@/hooks/useIntegrationAccounts";
import { 
  Settings, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Loader2,
  MessageSquare,
  Globe,
  Phone,
  Mail,
  Building2,
  Zap,
  Copy
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const WEBHOOK_URL = "https://iukquqmsrqnmuxpgessm.supabase.co/functions/v1/lead-webhook";

const integrationMeta: Record<IntegrationType, {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  supportsSync: boolean;
  supportsMultiAccount: boolean;
}> = {
  indiamart: {
    name: 'IndiaMART',
    description: 'Auto-fetch leads from IndiaMART CRM API',
    icon: <Building2 className="h-6 w-6" />,
    color: 'bg-orange-500',
    supportsSync: true,
    supportsMultiAccount: true,
  },
  whatsapp: {
    name: 'WhatsApp',
    description: 'Receive leads from WhatsApp messages',
    icon: <MessageSquare className="h-6 w-6" />,
    color: 'bg-green-500',
    supportsSync: false,
    supportsMultiAccount: false,
  },
  justdial: {
    name: 'JustDial',
    description: 'Receive leads from JustDial webhook',
    icon: <Phone className="h-6 w-6" />,
    color: 'bg-blue-500',
    supportsSync: false,
    supportsMultiAccount: false,
  },
  tradeindia: {
    name: 'TradeIndia',
    description: 'Auto-fetch leads from TradeIndia APIs',
    icon: <Globe className="h-6 w-6" />,
    color: 'bg-purple-500',
    supportsSync: true,
    supportsMultiAccount: true,
  },
  email: {
    name: 'Email',
    description: 'Parse leads from forwarded emails',
    icon: <Mail className="h-6 w-6" />,
    color: 'bg-red-500',
    supportsMultiAccount: false,
    supportsSync: false,
  },
};

export function IntegrationsSettings() {
  const { isAdmin } = useAuth();
  const { data: settings, isLoading } = useIntegrationSettings();
  const { data: allAccounts } = useAllIntegrationAccounts();
  const updateIntegration = useUpdateIntegration();
  const syncIntegration = useSyncIntegration();
  const testIntegration = useTestIntegration();
  
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [accountsDialogOpen, setAccountsDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationType | null>(null);
  const [testingIntegration, setTestingIntegration] = useState<IntegrationType | null>(null);
  const [syncingIntegration, setSyncingIntegration] = useState<IntegrationType | null>(null);

  if (!isAdmin) {
    return (
      <AccessDenied 
        title="Admin Access Required"
        message="Only administrators can manage integrations."
      />
    );
  }

  const handleToggleEnabled = async (integrationType: IntegrationType, currentEnabled: boolean) => {
    const setting = settings?.find(s => s.integration_type === integrationType);
    
    // Check if API key is configured before enabling
    if (!currentEnabled && !setting?.api_key) {
      toast.error('Please configure API key before enabling');
      return;
    }

    await updateIntegration.mutateAsync({
      integrationType,
      updates: { is_enabled: !currentEnabled },
    });
  };

  const handleConfigure = (integrationType: IntegrationType) => {
    setSelectedIntegration(integrationType);
    const meta = integrationMeta[integrationType];
    if (meta.supportsMultiAccount) {
      setAccountsDialogOpen(true);
    } else {
      setConfigDialogOpen(true);
    }
  };

  const handleTestConnection = async (integrationType: IntegrationType) => {
    const setting = settings?.find(s => s.integration_type === integrationType);
    if (!setting?.api_key) {
      toast.error('Please configure API key first');
      return;
    }

    setTestingIntegration(integrationType);
    try {
      const result = await testIntegration.mutateAsync({
        integrationType,
        apiKey: setting.api_key,
        config: setting.config,
      });

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message || 'Connection test failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTestingIntegration(null);
    }
  };

  const handleSync = async (integrationType: IntegrationType) => {
    setSyncingIntegration(integrationType);
    try {
      await syncIntegration.mutateAsync(integrationType);
    } finally {
      setSyncingIntegration(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Lead Integrations</h2>
        <p className="text-muted-foreground">
          Configure API connections to automatically capture leads from external platforms
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(integrationMeta) as IntegrationType[]).map((type) => {
          const meta = integrationMeta[type];
          const setting = settings?.find(s => s.integration_type === type);
          const accountCount = allAccounts?.filter(a => 
            (a as any).integration_settings?.integration_type === type
          ).length || 0;
          const isConfigured = !!setting?.api_key || accountCount > 0;
          const isEnabled = setting?.is_enabled || false;

          return (
            <Card key={type} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 ${meta.color}`} />
              
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${meta.color} text-white`}>
                      {meta.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{meta.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {meta.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {isConfigured ? (
                    <Badge variant={isEnabled ? "default" : "secondary"} className="flex items-center gap-1">
                      {isEnabled ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          Disabled
                        </>
                      )}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not Configured</Badge>
                  )}
                </div>

                {/* Account Count for multi-account integrations */}
                {meta.supportsMultiAccount && accountCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Accounts</span>
                    <Badge variant="secondary">{accountCount}</Badge>
                  </div>
                )}

                {/* Last Sync */}
                {setting?.last_sync_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Sync</span>
                    <span className="text-sm">
                      {formatDistanceToNow(new Date(setting.last_sync_at), { addSuffix: true })}
                    </span>
                  </div>
                )}

                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Enabled</span>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => handleToggleEnabled(type, isEnabled)}
                    disabled={!isConfigured || updateIntegration.isPending}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleConfigure(type)}
                  >
                    <Settings className="mr-1 h-3 w-3" />
                    Configure
                  </Button>

                  {isConfigured && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(type)}
                      disabled={testingIntegration === type}
                    >
                      {testingIntegration === type ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                    </Button>
                  )}

                  {meta.supportsSync && isEnabled && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(type)}
                      disabled={syncingIntegration === type}
                    >
                      {syncingIntegration === type ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Real-Time Webhook Status for IndiaMART */}
      {(settings?.find(s => s.integration_type === 'indiamart')?.is_enabled ||
        allAccounts?.some(a => (a as any).integration_settings?.integration_type === 'indiamart')) && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg text-green-700 dark:text-green-400">Real-Time Lead Sync Active</CardTitle>
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                Instant
              </Badge>
            </div>
            <CardDescription>
              Leads from IndiaMART arrive instantly via webhook. Backup polling runs every 15 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Webhook URL (configured in IndiaMART)</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 px-3 py-2 text-xs bg-muted rounded-md font-mono truncate">
                    {WEBHOOK_URL}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(WEBHOOK_URL);
                      toast.success("Webhook URL copied to clipboard");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this URL in IndiaMART Lead Manager → Settings → IM Leads Push API
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-Sync Controls */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* IndiaMART Auto-Sync */}
        {(settings?.find(s => s.integration_type === 'indiamart')?.api_key ||
          allAccounts?.some(a => (a as any).integration_settings?.integration_type === 'indiamart')) && (
          <AutoSyncControls
            integrationType="indiamart"
            isEnabled={settings?.find(s => s.integration_type === 'indiamart')?.is_enabled || false}
            syncInterval={settings?.find(s => s.integration_type === 'indiamart')?.sync_interval_minutes || 15}
            lastSyncAt={settings?.find(s => s.integration_type === 'indiamart')?.last_sync_at || null}
            isConfigured={
              !!settings?.find(s => s.integration_type === 'indiamart')?.api_key ||
              allAccounts?.some(a => (a as any).integration_settings?.integration_type === 'indiamart') || false
            }
          />
        )}

        {/* IndiaMART Webhook Health */}
        {(settings?.find(s => s.integration_type === 'indiamart')?.api_key ||
          allAccounts?.some(a => (a as any).integration_settings?.integration_type === 'indiamart')) && (
          <WebhookHealthCard source="indiamart" />
        )}

        {/* TradeIndia Auto-Sync */}
        {allAccounts?.some(a => (a as any).integration_settings?.integration_type === 'tradeindia') && (
          <AutoSyncControls
            integrationType="tradeindia"
            isEnabled={settings?.find(s => s.integration_type === 'tradeindia')?.is_enabled || false}
            syncInterval={settings?.find(s => s.integration_type === 'tradeindia')?.sync_interval_minutes || 5}
            lastSyncAt={settings?.find(s => s.integration_type === 'tradeindia')?.last_sync_at || null}
            isConfigured={
              allAccounts?.some(a => (a as any).integration_settings?.integration_type === 'tradeindia') || false
            }
          />
        )}
        {/* CRO Distribution Controls */}
        <CRODistributionControls />
      </div>

      {/* Integration Logs */}
      <IntegrationLogs />

      {/* Config Dialog for simple integrations */}
      {selectedIntegration && (
        <IntegrationConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          integrationType={selectedIntegration}
          currentSettings={settings?.find(s => s.integration_type === selectedIntegration)}
        />
      )}

      {/* Accounts Dialog for multi-account integrations */}
      {selectedIntegration && (
        <IntegrationAccountsDialog
          open={accountsDialogOpen}
          onOpenChange={setAccountsDialogOpen}
          integrationType={selectedIntegration}
          integrationSetting={settings?.find(s => s.integration_type === selectedIntegration)}
        />
      )}
    </div>
  );
}
