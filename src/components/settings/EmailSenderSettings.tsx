import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Save, TestTube, Loader2, Info, Eye, EyeOff } from 'lucide-react';
import { useCompanySettings, useUpdateCompanySetting } from '@/hooks/useCompanySettings';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PROVIDER_PRESETS: Record<string, { host: string; port: string; encryption: string; helpNote: string }> = {
  zoho: { host: 'smtp.zoho.in', port: '465', encryption: 'ssl', helpNote: 'Use your Zoho email and password. Enable "Allow less secure apps" or generate an App Password.' },
  gmail: { host: 'smtp.gmail.com', port: '587', encryption: 'tls', helpNote: 'You must enable 2FA and use an App Password. Regular passwords will not work.' },
  hostinger: { host: 'smtp.hostinger.com', port: '465', encryption: 'ssl', helpNote: 'Use your Hostinger email credentials.' },
  godaddy: { host: 'smtpout.secureserver.net', port: '465', encryption: 'ssl', helpNote: 'Use your GoDaddy Workspace email credentials.' },
  outlook: { host: 'smtp.office365.com', port: '587', encryption: 'tls', helpNote: 'Use your Microsoft 365 / Outlook email credentials.' },
  custom: { host: '', port: '465', encryption: 'ssl', helpNote: 'Enter your SMTP server details provided by your email host.' },
};

export function EmailSenderSettings() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateSetting = useUpdateCompanySetting();

  const [senderName, setSenderName] = useState('');
  const [senderDomain, setSenderDomain] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [emailProvider, setEmailProvider] = useState('resend');
  const [smtpPreset, setSmtpPreset] = useState('custom');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState('ssl');
  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const getSetting = (key: string) => settings?.find(s => s.setting_key === key)?.setting_value || '';

  useEffect(() => {
    if (settings) {
      setSenderName(getSetting('email_sender_name'));
      setSenderDomain(getSetting('email_sender_domain'));
      setReplyTo(getSetting('email_reply_to'));
      setEmailProvider(getSetting('email_provider') || 'resend');
      setSmtpHost(getSetting('smtp_host'));
      setSmtpPort(getSetting('smtp_port') || '465');
      setSmtpUsername(getSetting('smtp_username'));
      setSmtpPassword(getSetting('smtp_password'));
      setSmtpEncryption(getSetting('smtp_encryption') || 'ssl');

      // Detect preset
      const host = getSetting('smtp_host');
      const found = Object.entries(PROVIDER_PRESETS).find(([, p]) => p.host === host && p.host !== '');
      setSmtpPreset(found ? found[0] : 'custom');
    }
  }, [settings]);

  const applyPreset = (preset: string) => {
    setSmtpPreset(preset);
    const config = PROVIDER_PRESETS[preset];
    if (config) {
      setSmtpHost(config.host);
      setSmtpPort(config.port);
      setSmtpEncryption(config.encryption);
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    const updates = [
      { settingKey: 'email_sender_name', settingValue: senderName },
      { settingKey: 'email_sender_domain', settingValue: senderDomain },
      { settingKey: 'email_reply_to', settingValue: replyTo },
      { settingKey: 'email_provider', settingValue: emailProvider },
    ];

    if (emailProvider === 'smtp') {
      updates.push(
        { settingKey: 'smtp_host', settingValue: smtpHost },
        { settingKey: 'smtp_port', settingValue: smtpPort },
        { settingKey: 'smtp_username', settingValue: smtpUsername },
        { settingKey: 'smtp_password', settingValue: smtpPassword },
        { settingKey: 'smtp_encryption', settingValue: smtpEncryption },
      );
    }

    await Promise.all(updates.map(u => updateSetting.mutateAsync(u)));
    setHasChanges(false);
  };

  const handleTestConnection = async () => {
    if (!smtpHost || !smtpUsername || !smtpPassword) {
      toast.error('Please fill in all SMTP fields before testing');
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-smtp-connection', {
        body: {
          smtp_host: smtpHost,
          smtp_port: parseInt(smtpPort, 10),
          smtp_username: smtpUsername,
          smtp_password: smtpPassword,
          smtp_encryption: smtpEncryption,
          test_email: smtpUsername,
          sender_name: senderName || undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Test email sent successfully! Check your inbox.');
      } else {
        toast.error(`Connection failed: ${data?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      toast.error('Test failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading email settings...</p>
        </CardContent>
      </Card>
    );
  }

  const currentPreset = PROVIDER_PRESETS[smtpPreset];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle>Email Sender Configuration</CardTitle>
        </div>
        <CardDescription>
          Configure how outgoing emails (quotations, POs, dispatch notices) appear to recipients.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label>Email Provider</Label>
          <Select value={emailProvider} onValueChange={(v) => { setEmailProvider(v); setHasChanges(true); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resend">Platform Default (Resend)</SelectItem>
              <SelectItem value="smtp">Custom SMTP (Own Provider)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {emailProvider === 'resend'
              ? 'Emails are sent via the platform\'s shared email service. Domain must be verified by the platform.'
              : 'Send emails directly from your own email provider (Zoho, Gmail, Hostinger, etc.).'
            }
          </p>
        </div>

        {/* SMTP Configuration */}
        {emailProvider === 'smtp' && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <div className="space-y-2">
              <Label>Quick Setup</Label>
              <Select value={smtpPreset} onValueChange={applyPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zoho">Zoho Mail</SelectItem>
                  <SelectItem value="gmail">Gmail / Google Workspace</SelectItem>
                  <SelectItem value="hostinger">Hostinger</SelectItem>
                  <SelectItem value="godaddy">GoDaddy</SelectItem>
                  <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
                  <SelectItem value="custom">Custom SMTP Server</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {currentPreset?.helpNote && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{currentPreset.helpNote}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input
                  placeholder="smtp.example.com"
                  value={smtpHost}
                  onChange={(e) => { setSmtpHost(e.target.value); setHasChanges(true); }}
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  placeholder="465"
                  value={smtpPort}
                  onChange={(e) => { setSmtpPort(e.target.value); setHasChanges(true); }}
                />
              </div>
              <div className="space-y-2">
                <Label>Username (Email)</Label>
                <Input
                  placeholder="you@yourdomain.com"
                  value={smtpUsername}
                  onChange={(e) => { setSmtpUsername(e.target.value); setHasChanges(true); }}
                />
              </div>
              <div className="space-y-2">
                <Label>Password / App Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={smtpPassword}
                    onChange={(e) => { setSmtpPassword(e.target.value); setHasChanges(true); }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Encryption</Label>
                <Select value={smtpEncryption} onValueChange={(v) => { setSmtpEncryption(v); setHasChanges(true); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ssl">SSL (Port 465)</SelectItem>
                    <SelectItem value="tls">TLS/STARTTLS (Port 587)</SelectItem>
                    <SelectItem value="none">None (Not Recommended)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !smtpHost || !smtpUsername || !smtpPassword}
            >
              {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        )}

        {/* Common fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sender-name">Sender Name</Label>
            <Input
              id="sender-name"
              placeholder="e.g., Acme Corp"
              value={senderName}
              onChange={(e) => { setSenderName(e.target.value); setHasChanges(true); }}
            />
            <p className="text-xs text-muted-foreground">
              Displayed as the "From" name in emails
            </p>
          </div>

          {emailProvider === 'resend' && (
            <div className="space-y-2">
              <Label htmlFor="sender-domain">Sender Domain</Label>
              <Input
                id="sender-domain"
                placeholder="e.g., yourdomain.com"
                value={senderDomain}
                onChange={(e) => { setSenderDomain(e.target.value); setHasChanges(true); }}
              />
              <p className="text-xs text-muted-foreground">
                Emails will be sent from prefixes like enquiry@, dispatch@ on this domain
              </p>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="reply-to">Reply-To Email</Label>
            <Input
              id="reply-to"
              type="email"
              placeholder="e.g., sales@yourdomain.com"
              value={replyTo}
              onChange={(e) => { setReplyTo(e.target.value); setHasChanges(true); }}
            />
            <p className="text-xs text-muted-foreground">
              When recipients reply to your emails, replies will go to this address
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateSetting.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateSetting.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}