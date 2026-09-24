import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileText, Shield, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { useGstSettings, useSaveGstSettings } from "@/hooks/useGstApi";
import { useTenantStatus } from "@/hooks/useTenantStatus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { requireTenantId } from "@/utils/tenantUtils";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Chandigarh",
  "Puducherry", "Dadra and Nagar Haveli", "Daman and Diu", "Lakshadweep",
  "Andaman and Nicobar Islands",
];

export function GstApiSettings() {
  const { data: gstSettings, isLoading } = useGstSettings();
  const saveGst = useSaveGstSettings();
  const { tenant } = useTenantStatus();

  const [gstin, setGstin] = useState("");
  const [providerMode, setProviderMode] = useState<'gsp' | 'direct_irp'>('gsp');
  const [gspProvider, setGspProvider] = useState("iris_irp");
  const [irpBaseUrl, setIrpBaseUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [apiUsername, setApiUsername] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [sandboxMode, setSandboxMode] = useState(true);
  const [autoEinvoice, setAutoEinvoice] = useState(false);
  const [autoEwayBill, setAutoEwayBill] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; response?: string } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-gst-connection");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTestResult({
        ok: !!data?.ok,
        message: data?.message || "No response",
        response: data?.response,
      });
      if (data?.ok) toast.success("Connection working");
      else toast.error("Connection not working yet");
    } catch (err) {
      setTestResult({ ok: false, message: (err as Error).message });
      toast.error("Could not run the test");
    } finally {
      setTesting(false);
    }
  };

  // Tenant address fields
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  useEffect(() => {
    if (gstSettings) {
      setGstin(gstSettings.gstin || "");
      setProviderMode((gstSettings.provider_mode as 'gsp' | 'direct_irp') || 'gsp');
      setGspProvider(gstSettings.gsp_provider || "iris_irp");
      setIrpBaseUrl(gstSettings.irp_base_url || "");
      setClientId(gstSettings.client_id || "");
      setClientSecret(gstSettings.client_secret || "");
      setApiUsername(gstSettings.api_username || "");
      setApiPassword(gstSettings.api_password || "");
      setSandboxMode(gstSettings.sandbox_mode ?? true);
      setAutoEinvoice(gstSettings.auto_generate_einvoice ?? false);
      setAutoEwayBill(gstSettings.auto_generate_eway_bill ?? false);
    } else if (tenant) {
      setGstin((tenant as any).gst_number || "");
    }
  }, [gstSettings, tenant]);

  useEffect(() => {
    if (tenant) {
      setAddress((tenant as any).address || "");
      setCity((tenant as any).city || "");
      setState((tenant as any).state || "");
      setPincode((tenant as any).pincode || "");
    }
  }, [tenant]);

  const handleSave = async () => {
    if (!gstin || gstin.length !== 15) {
      toast.error("Please enter a valid 15-character GSTIN");
      return;
    }

    if (providerMode === 'gsp' && gspProvider === 'gstzen' && !clientId && !sandboxMode) {
      toast.error("Please paste your GSTZen API token (or enable Sandbox Mode for testing)");
      return;
    }

    if (providerMode === 'direct_irp') {
      if (!irpBaseUrl) {
        toast.error("Please select a government IRP portal");
        return;
      }
      if (!clientId || !clientSecret) {
        toast.error("Please enter the IRP Client ID and Client Secret");
        return;
      }
      if (!apiUsername || !apiPassword) {
        toast.error("Please enter the IRP portal username and password");
        return;
      }
    }

    try {
      const tenantId = await requireTenantId();

      // Save GST API settings
      await saveGst.mutateAsync({
        tenant_id: tenantId,
        gstin,
        provider_mode: providerMode,
        gsp_provider: providerMode === 'gsp' ? gspProvider : undefined,
        irp_base_url: providerMode === 'direct_irp' ? irpBaseUrl : undefined,
        client_id: providerMode === 'direct_irp' ? clientId : (gspProvider === 'gstzen' ? clientId : undefined),
        client_secret: providerMode === 'direct_irp' ? clientSecret : undefined,
        api_username: apiUsername || undefined,
        api_password: apiPassword || undefined,
        sandbox_mode: sandboxMode,
        auto_generate_einvoice: autoEinvoice,
        auto_generate_eway_bill: autoEwayBill,
      });

      // Update tenant address fields
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({ address, city, state, pincode })
        .eq("id", tenantId);

      if (tenantError) {
        toast.error("GST settings saved but failed to update company address: " + tenantError.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading GST settings...
        </CardContent>
      </Card>
    );
  }

  const isGstzen = gstSettings?.provider_mode !== 'direct_irp' && gstSettings?.gsp_provider === 'gstzen';
  const isConfigured = isGstzen
    ? !!gstSettings?.gstin && (!!gstSettings?.client_id || !!gstSettings?.sandbox_mode)
    : !!gstSettings?.api_username &&
      !!gstSettings?.api_password &&
      (gstSettings?.provider_mode !== 'direct_irp' ||
        (!!gstSettings?.client_id && !!gstSettings?.client_secret && !!gstSettings?.irp_base_url));

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>E-Invoice & E-Way Bill</CardTitle>
                <CardDescription>
                  Configure GST API credentials for automated e-invoice and e-way bill generation
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isGstzen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? "Testing..." : "Test connection"}
                </Button>
              )}
              <Badge variant={isConfigured ? "default" : "secondary"} className="flex items-center gap-1">
                {isConfigured ? (
                  <><CheckCircle2 className="h-3 w-3" /> Configured</>
                ) : (
                  <><AlertCircle className="h-3 w-3" /> Not Configured</>
                )}
              </Badge>
            </div>
          </div>
          {testResult && (
            <div
              className={`text-sm mt-3 rounded-md p-2 space-y-2 ${
                testResult.ok
                  ? "bg-primary/10 text-foreground"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <p>{testResult.message}</p>
              {testResult.ok && (
                <p className="text-xs opacity-80">
                  If GSTZen says the document needs line items, that is expected — it means your API key and GSTIN are recognised.
                </p>
              )}
              {testResult.response && (
                <details className="text-xs">
                  <summary className="cursor-pointer opacity-80 hover:opacity-100">
                    Raw response
                  </summary>
                  <pre className="mt-2 p-2 rounded bg-black/5 dark:bg-white/10 overflow-auto max-h-40 text-[10px] font-mono whitespace-pre-wrap">
                    {testResult.response}
                  </pre>
                </details>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* GST Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">GST API Credentials</CardTitle>
          <CardDescription>
            Choose how e-invoices and e-way bills are reported to the GST system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN *</Label>
              <Input
                id="gstin"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">15-character GST Identification Number</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-mode">Provider Mode</Label>
              <Select value={providerMode} onValueChange={(v) => setProviderMode(v as 'gsp' | 'direct_irp')}>
                <SelectTrigger id="provider-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gsp">GSP (GST Suvidha Provider)</SelectItem>
                  <SelectItem value="direct_irp">Direct Government IRP</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {providerMode === 'direct_irp'
                  ? "Connect directly to a government Invoice Registration Portal"
                  : "Use a GSP that handles IRP encryption for you"}
              </p>
            </div>

            {providerMode === 'gsp' && (
              <div className="space-y-2">
                <Label htmlFor="gsp-provider">GSP Provider</Label>
                <Select value={gspProvider} onValueChange={setGspProvider}>
                  <SelectTrigger id="gsp-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gstzen">GSTZen</SelectItem>
                    <SelectItem value="iris_irp">IRIS IRP</SelectItem>
                    <SelectItem value="cleartax">ClearTax</SelectItem>
                    <SelectItem value="custom">Custom GSP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {providerMode === 'gsp' && gspProvider === 'gstzen' && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="gstzen-token">GSTZen API Token *</Label>
                <Input
                  id="gstzen-token"
                  type="password"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="API key from your GSTZen profile page"
                />
                <p className="text-xs text-muted-foreground">
                  Found in GSTZen next to your profile. Leave empty while Sandbox Mode is on to use the shared test key.
                </p>
              </div>
            )}

            {providerMode === 'direct_irp' && (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="irp-base-url">Government IRP Portal *</Label>
                  <Select value={irpBaseUrl} onValueChange={setIrpBaseUrl}>
                    <SelectTrigger id="irp-base-url">
                      <SelectValue placeholder="Select IRP portal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="https://einvoice1.gst.gov.in">einvoice1.gst.gov.in</SelectItem>
                      <SelectItem value="https://einvoice2.gst.gov.in">einvoice2.gst.gov.in</SelectItem>
                      <SelectItem value="https://einvoice3.gst.gov.in">einvoice3.gst.gov.in</SelectItem>
                      <SelectItem value="https://einvoice4.gst.gov.in">einvoice4.gst.gov.in</SelectItem>
                      <SelectItem value="https://einvoice5.gst.gov.in">einvoice5.gst.gov.in</SelectItem>
                      <SelectItem value="https://einvoice6.gst.gov.in">einvoice6.gst.gov.in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-id">Client ID *</Label>
                  <Input
                    id="client-id"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="From IRP portal API registration"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-secret">Client Secret *</Label>
                  <Input
                    id="client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="From IRP portal API registration"
                  />
                </div>
              </>
            )}

            {!(providerMode === 'gsp' && gspProvider === 'gstzen') && (
            <>
            <div className="space-y-2">
              <Label htmlFor="api-username">API Username {providerMode === 'direct_irp' && '*'}</Label>
              <Input
                id="api-username"
                value={apiUsername}
                onChange={(e) => setApiUsername(e.target.value)}
                placeholder="Enter portal username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-password">API Password {providerMode === 'direct_irp' && '*'}</Label>
              <Input
                id="api-password"
                type="password"
                value={apiPassword}
                onChange={(e) => setApiPassword(e.target.value)}
                placeholder="Enter portal password"
              />
            </div>
            </>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              Credentials are stored securely and used only for government API communication.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Company Address for E-Invoice */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seller Address (for E-Invoice)</CardTitle>
          <CardDescription>
            This address appears as the seller details in e-invoices and e-way bills
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company-address">Address</Label>
              <Input
                id="company-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, building name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-city">City</Label>
              <Input
                id="company-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-state">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="company-state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-pincode">Pincode *</Label>
              <Input
                id="company-pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="110001"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">Required for e-invoice and e-way bill</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Automation Settings</CardTitle>
          <CardDescription>
            Configure automatic generation of compliance documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium text-sm">Sandbox Mode</p>
              <p className="text-xs text-muted-foreground">
                {isGstzen
                  ? "With a real GSTZen API token saved, the live GSTZen endpoint is used. This toggle only switches to the shared demo key when no token is saved."
                  : "Use NIC test environment for trial runs (no real documents generated)"}
              </p>
            </div>
            <Switch checked={sandboxMode} onCheckedChange={setSandboxMode} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium text-sm">Auto-generate E-Invoice</p>
              <p className="text-xs text-muted-foreground">
                Automatically generate e-invoice when an invoice is created
              </p>
            </div>
            <Switch checked={autoEinvoice} onCheckedChange={setAutoEinvoice} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium text-sm">Auto-generate E-Way Bill</p>
              <p className="text-xs text-muted-foreground">
                Automatically generate e-way bill when dispatch is created
              </p>
            </div>
            <Switch checked={autoEwayBill} onCheckedChange={setAutoEwayBill} />
          </div>
        </CardContent>
      </Card>

      {/* Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup Guide</CardTitle>
          <CardDescription>
            {providerMode === 'direct_irp'
              ? "How to get direct government IRP API credentials"
              : "How to register with a GSP for e-invoicing"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {providerMode === 'direct_irp' ? (
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Check GSTIN enablement at <a href="https://einvoice.gst.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">einvoice.gst.gov.in <ExternalLink className="h-3 w-3" /></a></li>
              <li>Register on one of the six IRP portals (einvoice1 to einvoice6.gst.gov.in)</li>
              <li>Verify your registered mobile and email with OTP</li>
              <li>Inside the portal, go to <strong>API Registration → Client Credentials</strong> to create a Client ID and Client Secret</li>
              <li>Create an API user and note the username and password</li>
              <li>Select the same IRP portal above, enter Client ID, Client Secret, username and password</li>
              <li>Enable <strong>Sandbox Mode</strong> first for testing, then switch it off for live invoicing</li>
            </ol>
          ) : gspProvider === 'gstzen' ? (
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Create an account at <a href="https://gstzen.in" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">gstzen.in <ExternalLink className="h-3 w-3" /></a> and add your GSTIN</li>
              <li>On the e-invoice portal (einvoice1.gst.gov.in), go to <strong>API Registration</strong> and register <strong>GSTZen (Cloudzen Software Labs)</strong> as your provider — create an API username and password there</li>
              <li>Enter that username and password inside your GSTZen account (GSTZen stores them — they are not needed here)</li>
              <li>Copy your GSTZen API key from your GSTZen profile page and paste it above</li>
              <li>Keep <strong>Sandbox Mode</strong> on to test, then switch it off for live invoicing</li>
            </ol>
          ) : (
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Choose a GSP such as GSTZen, ClearTax or Masters India</li>
              <li>Complete their onboarding and obtain API username/password</li>
              <li>Enter credentials above and enable <strong>Sandbox Mode</strong> first for testing</li>
              <li>Once tested successfully, disable Sandbox Mode for live invoicing</li>
            </ol>
          )}
          <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> E-Invoicing is mandatory for businesses with annual turnover above ₹5 crore.
              E-Way Bill is required for goods movement above ₹50,000.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveGst.isPending} size="lg">
          {saveGst.isPending ? "Saving..." : "Save GST Settings"}
        </Button>
      </div>
    </div>
  );
}
