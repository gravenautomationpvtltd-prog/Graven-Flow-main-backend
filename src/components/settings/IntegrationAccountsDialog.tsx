import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IntegrationType, IntegrationSetting } from "@/hooks/useIntegrations";
import {
  useIntegrationAccounts,
  useCreateIntegrationAccount,
  useUpdateIntegrationAccount,
  useDeleteIntegrationAccount,
  useSyncIntegrationAccount,
  useTestIntegrationAccount,
  IntegrationAccount,
} from "@/hooks/useIntegrationAccounts";
import {
  Plus,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  CheckCircle,
  Loader2,
  Edit2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface IntegrationAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationType: IntegrationType;
  integrationSetting?: IntegrationSetting;
}

interface AccountTypeConfig {
  value: string;
  label: string;
  endpoint?: string;
}

interface IntegrationConfig {
  title: string;
  description: string;
  accountTypes: AccountTypeConfig[];
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password';
    placeholder?: string;
    required?: boolean;
    showFor?: string[];
  }[];
  docsUrl?: string;
}

const integrationConfigs: Record<string, IntegrationConfig> = {
  indiamart: {
    title: 'IndiaMART Accounts',
    description: 'Manage multiple IndiaMART CRM API accounts',
    accountTypes: [
      { value: 'crm', label: 'CRM API' },
    ],
    fields: [
      { key: 'account_name', label: 'Account Name', type: 'text', placeholder: 'e.g., Main Account', required: true },
      { key: 'api_key', label: 'CRM API Key', type: 'password', placeholder: 'Enter your CRM API key', required: true },
    ],
    docsUrl: 'https://seller.indiamart.com/leadmanager/',
  },
  tradeindia: {
    title: 'TradeIndia Accounts',
    description: 'Configure API connections for TradeIndia Inquiry and Buy Trade Leads',
    accountTypes: [
      { value: 'inquiry', label: 'My Inquiry API' },
      { value: 'buy_leads', label: 'My Buy Trade Leads API' },
    ],
    fields: [
      { key: 'account_name', label: 'Account Name', type: 'text', placeholder: 'e.g., Inquiry Account 1', required: true },
      { key: 'userid', label: 'User ID', type: 'text', placeholder: 'Enter your User ID', required: true },
      { key: 'profile_id', label: 'Profile ID', type: 'text', placeholder: 'Enter your Profile ID', required: true },
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Enter your API Key', required: true },
    ],
    docsUrl: 'https://www.tradeindia.com/',
  },
};

export function IntegrationAccountsDialog({
  open,
  onOpenChange,
  integrationType,
  integrationSetting,
}: IntegrationAccountsDialogProps) {
  const config = integrationConfigs[integrationType];
  
  const { data: accounts, isLoading } = useIntegrationAccounts(integrationSetting?.id);
  const createAccount = useCreateIntegrationAccount();
  const updateAccount = useUpdateIntegrationAccount();
  const deleteAccount = useDeleteIntegrationAccount();
  const syncAccount = useSyncIntegrationAccount();
  const testAccount = useTestIntegrationAccount();

  const [isAddMode, setIsAddMode] = useState(false);
  const [editingAccount, setEditingAccount] = useState<IntegrationAccount | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState<Record<string, string>>({
    account_type: config?.accountTypes[0]?.value || 'default',
  });

  useEffect(() => {
    if (open && !editingAccount) {
      setFormData({
        account_type: config?.accountTypes[0]?.value || 'default',
      });
      setIsAddMode(false);
    }
  }, [open, config]);

  useEffect(() => {
    if (editingAccount) {
      setFormData({
        account_name: editingAccount.account_name,
        account_type: editingAccount.account_type,
        userid: editingAccount.userid || '',
        profile_id: editingAccount.profile_id || '',
        api_key: editingAccount.api_key,
      });
    }
  }, [editingAccount]);

  if (!config) {
    return null;
  }

  const handleSave = async () => {
    if (!integrationSetting?.id) {
      toast.error('Integration not configured');
      return;
    }

    // Validate required fields
    for (const field of config.fields) {
      if (field.required && !formData[field.key]) {
        toast.error(`${field.label} is required`);
        return;
      }
    }

    try {
      // Trim all string values before saving to prevent credential errors
      const trimmedAccountName = formData.account_name?.trim() || '';
      const trimmedUserid = formData.userid?.trim() || null;
      const trimmedProfileId = formData.profile_id?.trim() || null;
      const trimmedApiKey = formData.api_key?.trim() || '';

      if (editingAccount) {
        await updateAccount.mutateAsync({
          id: editingAccount.id,
          updates: {
            account_name: trimmedAccountName,
            account_type: formData.account_type,
            userid: trimmedUserid,
            profile_id: trimmedProfileId,
            api_key: trimmedApiKey,
          },
        });
        setEditingAccount(null);
      } else {
        await createAccount.mutateAsync({
          integration_setting_id: integrationSetting.id,
          account_name: trimmedAccountName,
          account_type: formData.account_type,
          userid: trimmedUserid || undefined,
          profile_id: trimmedProfileId || undefined,
          api_key: trimmedApiKey,
        });
        setIsAddMode(false);
      }

      setFormData({
        account_type: config.accountTypes[0]?.value || 'default',
      });
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleToggleEnabled = async (account: IntegrationAccount) => {
    await updateAccount.mutateAsync({
      id: account.id,
      updates: { is_enabled: !account.is_enabled },
    });
  };

  const handleTest = async (account: IntegrationAccount) => {
    setTestingAccountId(account.id);
    try {
      const result = await testAccount.mutateAsync({
        integrationType,
        accountType: account.account_type,
        userid: account.userid || undefined,
        profileId: account.profile_id || undefined,
        apiKey: account.api_key,
      });

      if (result.success) {
        toast.success(result.message || 'Connection successful');
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTestingAccountId(null);
    }
  };

  const handleSync = async (account: IntegrationAccount) => {
    setSyncingAccountId(account.id);
    try {
      await syncAccount.mutateAsync({
        accountId: account.id,
        integrationType,
      });
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    
    try {
      await deleteAccount.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const renderForm = () => (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{editingAccount ? 'Edit Account' : 'Add New Account'}</h4>
      </div>

      {config.accountTypes.length > 1 && (
        <div className="space-y-2">
          <Label>Lead Type</Label>
          <Select
            value={formData.account_type}
            onValueChange={(value) => setFormData(prev => ({ ...prev, account_type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.accountTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.fields.map((field) => {
        // Check if field should be shown for this account type
        if (field.showFor && !field.showFor.includes(formData.account_type)) {
          return null;
        }

        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="relative">
              <Input
                id={field.key}
                type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                placeholder={field.placeholder}
                value={formData[field.key] || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                className={field.type === 'password' ? 'pr-10' : ''}
              />
              {field.type === 'password' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                >
                  {showSecrets[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={() => {
            setIsAddMode(false);
            setEditingAccount(null);
            setFormData({ account_type: config.accountTypes[0]?.value || 'default' });
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={createAccount.isPending || updateAccount.isPending}
        >
          {createAccount.isPending || updateAccount.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            editingAccount ? 'Update Account' : 'Add Account'
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{config.title}</DialogTitle>
            <DialogDescription>{config.description}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              {/* Existing Accounts */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : accounts && accounts.length > 0 ? (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <Card key={account.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{account.account_name}</span>
                              {config.accountTypes.length > 1 && (
                                <Badge variant="outline" className="shrink-0">
                                  {config.accountTypes.find(t => t.value === account.account_type)?.label || account.account_type}
                                </Badge>
                              )}
                              {account.is_enabled ? (
                                <Badge variant="default" className="shrink-0">Active</Badge>
                              ) : (
                                <Badge variant="secondary" className="shrink-0">Disabled</Badge>
                              )}
                            </div>
                            {account.last_sync_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Last sync: {formatDistanceToNow(new Date(account.last_sync_at), { addSuffix: true })}
                              </p>
                            )}
                            {account.userid && (
                              <p className="text-xs text-muted-foreground">
                                User ID: {account.userid}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={account.is_enabled}
                              onCheckedChange={() => handleToggleEnabled(account)}
                            />

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleTest(account)}
                              disabled={testingAccountId === account.id}
                              title="Test Connection"
                            >
                              {testingAccountId === account.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSync(account)}
                              disabled={syncingAccountId === account.id || !account.is_enabled}
                              title="Sync Now"
                            >
                              {syncingAccountId === account.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingAccount(account);
                                setIsAddMode(false);
                              }}
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmId(account.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !isAddMode && !editingAccount ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No accounts configured yet.</p>
                  <p className="text-sm">Add an account to start syncing leads.</p>
                </div>
              ) : null}

              {/* Add/Edit Form */}
              {(isAddMode || editingAccount) && renderForm()}

              {/* Add Button */}
              {!isAddMode && !editingAccount && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsAddMode(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 flex-col sm:flex-row gap-2">
            {config.docsUrl && (
              <a
                href={config.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mr-auto"
              >
                <ExternalLink className="h-3 w-3" />
                View documentation
              </a>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this account? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
