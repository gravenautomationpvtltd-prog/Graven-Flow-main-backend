import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Plug, Building, Users, Shield, User, Clock, Wallet, Mail, MapPin, Megaphone, Building2, CreditCard, UsersRound, Globe, FileText } from "lucide-react";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { CompanyProfileSettings } from "@/components/settings/CompanyProfileSettings";
import { EmailSenderSettings } from "@/components/settings/EmailSenderSettings";
import { UserManagement } from "@/components/settings/UserManagement";
import { OfficeManagement } from "@/components/settings/OfficeManagement";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { AttendanceManagement } from "@/components/settings/AttendanceManagement";
import { PayrollManagement } from "@/components/settings/PayrollManagement";
import { EmailTemplatesManagement } from "@/components/settings/EmailTemplatesManagement";

import { CustomerOutreachManagement } from "@/components/settings/CustomerOutreachManagement";
import { CompanyDefaults } from "@/components/settings/CompanyDefaults";
import { LocalizationSettings } from "@/components/settings/LocalizationSettings";
import { SubscriptionManagement } from "@/components/settings/SubscriptionManagement";
import { TenantTeamManagement } from "@/components/settings/TenantTeamManagement";
import { GstApiSettings } from "@/components/settings/GstApiSettings";
import { useAuth } from "@/hooks/useAuth";
import { useTenantStatus } from "@/hooks/useTenantStatus";
import { useTranslation } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Settings = () => {
  const { isAdmin, isHR, isManager, isAccounts } = useAuth();
  const { tenantRole, hasTenant } = useTenantStatus();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const canAccessHRTabs = isAdmin || isHR;
  const canAccessEmailTemplates = isAdmin || isManager;
  const isTenantOwnerOrAdmin = tenantRole === 'owner' || tenantRole === 'admin';
  const canAccessEInvoice = isTenantOwnerOrAdmin || isAdmin || isAccounts;

  return (
    <>
      <Helmet>
        <title>Settings | Graven Automation</title>
        <meta name="description" content="Manage system settings, integrations, and configurations" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{t('settings.title', 'Settings')}</h1>
            <p className="text-muted-foreground">{t('settings.subtitle', 'Manage system configuration and integrations')}</p>
          </div>
        </div>

        {!hasTenant && (
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t('settings.complete_setup', 'Complete Organization Setup')}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t('settings.complete_setup_desc', 'Set up your company profile, invite team members, and choose a plan to unlock all features.')}</p>
            </div>
            <Button onClick={() => navigate('/onboarding')} className="shrink-0 ml-4">
              <Building2 className="mr-2 h-4 w-4" />
              {t('settings.start_setup', 'Start Setup')}
            </Button>
          </div>
        )}

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>

            {isTenantOwnerOrAdmin && (
              <TabsTrigger value="subscription" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Subscription</span>
              </TabsTrigger>
            )}

            {isTenantOwnerOrAdmin && (
              <TabsTrigger value="team" className="flex items-center gap-2">
                <UsersRound className="h-4 w-4" />
                <span className="hidden sm:inline">Team</span>
              </TabsTrigger>
            )}
            
            {(isAdmin || isTenantOwnerOrAdmin) && (
              <TabsTrigger value="company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Company</span>
              </TabsTrigger>
            )}

            {isTenantOwnerOrAdmin && (
              <TabsTrigger value="localization" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Localization</span>
              </TabsTrigger>
            )}

            {canAccessEInvoice && (
              <TabsTrigger value="einvoice" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">E-Invoice</span>
              </TabsTrigger>
            )}
            
            {isAdmin && (
              <TabsTrigger value="integrations" className="flex items-center gap-2">
                <Plug className="h-4 w-4" />
                <span className="hidden sm:inline">Integrations</span>
              </TabsTrigger>
            )}
            
            {isAdmin && (
              <TabsTrigger value="offices" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">Offices</span>
              </TabsTrigger>
            )}

            
            {canAccessEmailTemplates && (
              <TabsTrigger value="email-templates" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email Templates</span>
              </TabsTrigger>
            )}
            
            {isAdmin && (
              <TabsTrigger value="outreach" className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                <span className="hidden sm:inline">Customer Outreach</span>
              </TabsTrigger>
            )}
            
            {canAccessHRTabs && (
              <TabsTrigger value="attendance" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Attendance</span>
              </TabsTrigger>
            )}
            
            {canAccessHRTabs && (
              <TabsTrigger value="payroll" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Payroll</span>
              </TabsTrigger>
            )}
            
            {isAdmin && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
            )}
            
            {isAdmin && (
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>

          {isTenantOwnerOrAdmin && (
            <TabsContent value="subscription">
              <SubscriptionManagement />
            </TabsContent>
          )}

          {isTenantOwnerOrAdmin && (
            <TabsContent value="team" className="space-y-6">
              <TenantTeamManagement />
              <div className="rounded-lg border p-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <UsersRound className="h-4 w-4" /> Redistribute Workload
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Bulk reassign one user's leads, customers, escalations and tasks evenly across active sales teammates.
                  </p>
                </div>
                <Button onClick={() => navigate('/settings/redistribute-workload')}>
                  Open
                </Button>
              </div>
              <div className="rounded-lg border p-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <UsersRound className="h-4 w-4" /> Business Verticals
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Run multiple business lines (e.g. Graven Automation, Glidex Lubricants) inside the same organization.
                    Each vertical has its own pipelines, products, numbering and team.
                  </p>
                </div>
                <Button onClick={() => navigate('/settings/verticals')}>Open</Button>
              </div>
              <div className="rounded-lg border p-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <UsersRound className="h-4 w-4" /> Lead Routing Rules
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Split incoming new-customer leads across branches by percentage (e.g. 25% Delhi / 75% Lucknow).
                    Existing customers stay with their loyal owner.
                  </p>
                </div>
                <Button onClick={() => navigate('/settings/lead-routing')}>Open</Button>
              </div>
            </TabsContent>
          )}

          {(isAdmin || isTenantOwnerOrAdmin) && (
            <TabsContent value="company">
              <div className="space-y-6">
                <CompanyProfileSettings />
                <EmailSenderSettings />
                <CompanyDefaults />
              </div>
            </TabsContent>
          )}

          {isTenantOwnerOrAdmin && (
            <TabsContent value="localization">
              <LocalizationSettings />
            </TabsContent>
          )}

          {canAccessEInvoice && (
            <TabsContent value="einvoice">
              <GstApiSettings />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="integrations">
              <IntegrationsSettings />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="offices">
              <OfficeManagement />
            </TabsContent>
          )}

          {canAccessEmailTemplates && (
            <TabsContent value="email-templates">
              <EmailTemplatesManagement />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="outreach">
              <CustomerOutreachManagement />
            </TabsContent>
          )}

          {canAccessHRTabs && (
            <TabsContent value="attendance">
              <AttendanceManagement />
            </TabsContent>
          )}

          {canAccessHRTabs && (
            <TabsContent value="payroll">
              <PayrollManagement />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="security">
              <div className="rounded-lg border bg-card p-8 text-center">
                <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">Security Settings</h3>
                <p className="text-muted-foreground">Configure security and access controls</p>
                <p className="mt-2 text-sm text-muted-foreground">Coming soon...</p>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
};

export default Settings;
