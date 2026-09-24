
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/lib/i18n";
import { VerticalProvider } from "@/contexts/VerticalContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppOrApproverLayout } from "@/components/layout/AppOrApproverLayout";
import { Loader2 } from "lucide-react";
import { BackendProtectedRoute } from "./components/backend/BackendProtectedRoute";
import { BackendLayout } from "./components/backend/BackendLayout";
import { BIERoleGuard } from "@/components/bie/BIERoleGuard";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const OrderAnalytics = lazy(() => import("./pages/OrderAnalytics"));
const EmailAnalytics = lazy(() => import("./pages/EmailAnalytics"));
const ProfitAnalytics = lazy(() => import("./pages/ProfitAnalytics"));
const PricingIntelligence = lazy(() => import("./pages/PricingIntelligence"));
const DecisionDeck = lazy(() => import("./pages/DecisionDeck"));
const Settings = lazy(() => import("./pages/Settings"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Payroll = lazy(() => import("./pages/Payroll"));
const Employees = lazy(() => import("./pages/Employees"));
const EmployeeDetail = lazy(() => import("./pages/EmployeeDetail"));
const Escalations = lazy(() => import("./pages/Escalations"));
const Procurement = lazy(() => import("./pages/Procurement"));
const SupplierDetail = lazy(() => import("./pages/SupplierDetail"));
const Inventory = lazy(() => import("./pages/Inventory"));
const QCWorkspace = lazy(() => import("./pages/qc/QCWorkspace"));
const StockLedger = lazy(() => import("./pages/inventory/StockLedger"));
const Dispatch = lazy(() => import("./pages/Dispatch"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Accounts = lazy(() => import("./pages/Accounts"));
const NotFound = lazy(() => import("./pages/NotFound"));
const VendorRegistration = lazy(() => import("./pages/VendorRegistration"));
const SupplierLanding = lazy(() => import("./pages/SupplierLanding"));
const Profile = lazy(() => import("./pages/Profile"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/legal/TermsOfUse"));
const RefundPolicy = lazy(() => import("./pages/legal/RefundPolicy"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const Messages = lazy(() => import("./pages/Messages"));
const Reports = lazy(() => import("./pages/Reports"));
const ProcurementTeamReports = lazy(() => import("./pages/reports/ProcurementTeamReports"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const AssignmentAuditReport = lazy(() => import("./pages/admin/AssignmentAuditReport"));
const OwnershipMismatchReport = lazy(() => import("./pages/admin/OwnershipMismatchReport"));
const Trash = lazy(() => import("./pages/Trash"));
const CRODashboard = lazy(() => import("./pages/CRODashboard"));
const LqtInbox = lazy(() => import("./pages/LqtInbox"));
const TSTQueue = lazy(() => import("./pages/TSTQueue"));
const SptInbox = lazy(() => import("./pages/SptInbox"));
const BoqDetail = lazy(() => import("./pages/BoqDetail"));
const CROPerformance = lazy(() => import("./pages/CROPerformance"));
const CROPerformanceDetail = lazy(() => import("./pages/CROPerformanceDetail"));
const CustomerSuccess = lazy(() => import("./pages/CustomerSuccess"));
const ProcurementQueue = lazy(() => import("./pages/procurement/ProcurementQueue"));
const BulkPriceSubmit = lazy(() => import("./pages/procurement/BulkPriceSubmit"));
const PriceApprovals = lazy(() => import("./pages/procurement/PriceApprovals"));
const ProcurementPerformance = lazy(() => import("./pages/procurement/ProcurementPerformance"));
const PriceApprovalDetail = lazy(() => import("./pages/procurement/PriceApprovalDetail"));
const CstWorkspace = lazy(() => import("./pages/cst/CstWorkspace"));
const BrandMappingSettings = lazy(() => import("./pages/settings/BrandMappingSettings"));
const RedistributeWorkload = lazy(() => import("./pages/settings/RedistributeWorkload"));
const VerticalsSettings = lazy(() => import("./pages/settings/Verticals"));
const LeadRoutingRules = lazy(() => import("./pages/settings/LeadRoutingRules"));
const CCTControlRoom = lazy(() => import("./pages/cct/CCTControlRoom"));
const OutreachAnalytics = lazy(() => import("./pages/OutreachAnalytics"));
const SupplierApplications = lazy(() => import("./pages/supplier-network/SupplierApplications"));
const ApprovedSuppliers = lazy(() => import("./pages/supplier-network/ApprovedSuppliers"));
const RFQs = lazy(() => import("./pages/supplier-network/RFQs"));
const CreateRFQ = lazy(() => import("./pages/supplier-network/CreateRFQ"));
const RFQComparison = lazy(() => import("./pages/supplier-network/RFQComparison"));
const SupplierQuotations = lazy(() => import("./pages/supplier-network/SupplierQuotations"));
const SupplierDocuments = lazy(() => import("./pages/supplier-network/SupplierDocuments"));
const SupplierCommunications = lazy(() => import("./pages/supplier-network/SupplierCommunications"));
const SupplierAnalytics = lazy(() => import("./pages/supplier-network/SupplierAnalytics"));
const SupplierNetworkDetail = lazy(() => import("./pages/supplier-network/SupplierNetworkDetail"));
const ImportInvoices = lazy(() => import("./pages/supplier-network/ImportInvoices"));
const SubscriptionExpired = lazy(() => import("./pages/SubscriptionExpired"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const BackendLogin = lazy(() => import("./pages/backend/BackendLogin"));
const BackendDashboard = lazy(() => import("./pages/backend/BackendDashboard"));
const BackendTenants = lazy(() => import("./pages/backend/BackendTenants"));
const BackendTenantDetail = lazy(() => import("./pages/backend/BackendTenantDetail"));
const BackendSubscriptions = lazy(() => import("./pages/backend/BackendSubscriptions"));
const BackendSupport = lazy(() => import("./pages/backend/BackendSupport"));
const BackendAnalytics = lazy(() => import("./pages/backend/BackendAnalytics"));
const BackendCoupons = lazy(() => import("./pages/backend/BackendCoupons"));
const BackendMarketing = lazy(() => import("./pages/backend/BackendMarketing"));
const BackendSettings = lazy(() => import("./pages/backend/BackendSettings"));
const BackendAuditLog = lazy(() => import("./pages/backend/BackendAuditLog"));
const BIEDashboard = lazy(() => import("./pages/bie/BIEDashboard"));
const BIEWork = lazy(() => import("./pages/bie/BIEWork"));
const BIETeamMember = lazy(() => import("./pages/bie/BIETeamMember"));
const BIEPerformance = lazy(() => import("./pages/bie/BIEPerformance"));
const BIEMyWork = lazy(() => import("./pages/bie/BIEMyWork"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      // Never poll while the tab is in the background — keeps steady
      // load off the database when screens are left open.
      refetchIntervalInBackground: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LanguageProvider>
          <VerticalProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
              {/* Public routes — own Suspense so they don't block the whole tree */}
              <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
              <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />
              <Route path="/pricing" element={<Suspense fallback={<PageLoader />}><Pricing /></Suspense>} />
              <Route path="/vendor-registration" element={<Suspense fallback={<PageLoader />}><VendorRegistration /></Suspense>} />
              <Route path="/supplier-register" element={<Suspense fallback={<PageLoader />}><SupplierLanding /></Suspense>} />
              <Route path="/supplier-register/:country" element={<Suspense fallback={<PageLoader />}><SupplierLanding /></Suspense>} />
              <Route path="/" element={<Suspense fallback={<PageLoader />}><LandingPage /></Suspense>} />
              <Route path="/privacy-policy" element={<Suspense fallback={<PageLoader />}><PrivacyPolicy /></Suspense>} />
              <Route path="/terms-of-use" element={<Suspense fallback={<PageLoader />}><TermsOfUse /></Suspense>} />
              <Route path="/refund-policy" element={<Suspense fallback={<PageLoader />}><RefundPolicy /></Suspense>} />
              <Route path="/pay" element={<Suspense fallback={<PageLoader />}><PaymentPage /></Suspense>} />
              <Route path="/contact" element={<Suspense fallback={<PageLoader />}><ContactUs /></Suspense>} />
              <Route path="/.lovable/oauth/consent" element={<Suspense fallback={<PageLoader />}><OAuthConsent /></Suspense>} />

              {/* Protected routes without AppLayout */}
              <Route path="/onboarding" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Onboarding /></Suspense></ProtectedRoute>} />
              <Route path="/subscription-expired" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><SubscriptionExpired /></Suspense></ProtectedRoute>} />

              {/* Protected routes with shared AppLayout — sidebar/header persist across navigation */}
              <Route element={<AppOrApproverLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/leads/:id" element={<LeadDetail />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/order-analytics" element={<OrderAnalytics />} />
                <Route path="/escalations" element={<Escalations />} />
                <Route path="/procurement" element={<Procurement />} />
                <Route path="/suppliers/:id" element={<SupplierDetail />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/qc" element={<QCWorkspace />} />
                <Route path="/stock-ledger" element={<StockLedger />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/dispatch" element={<Dispatch />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/payroll" element={<Payroll />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/employees/:id" element={<EmployeeDetail />} />
                <Route path="/email-analytics" element={<EmailAnalytics />} />
                <Route path="/profit-analytics" element={<ProfitAnalytics />} />
                <Route path="/decision-deck" element={<DecisionDeck />} />
                <Route path="/pricing-intelligence" element={<PricingIntelligence />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/reports/procurement-team" element={<ProcurementTeamReports />} />
                <Route path="/admin/assignment-audit" element={<AssignmentAuditReport />} />
                <Route path="/admin/ownership-mismatch" element={<OwnershipMismatchReport />} />
                <Route path="/activity-log" element={<ActivityLog />} />
                <Route path="/outreach-analytics" element={<OutreachAnalytics />} />
                <Route path="/supplier-network/applications" element={<SupplierApplications />} />
                <Route path="/supplier-network/suppliers" element={<ApprovedSuppliers />} />
                <Route path="/supplier-network/suppliers/:id" element={<SupplierNetworkDetail />} />
                <Route path="/supplier-network/rfqs" element={<RFQs />} />
                <Route path="/supplier-network/rfqs/create" element={<CreateRFQ />} />
                <Route path="/supplier-network/rfqs/:id/compare" element={<RFQComparison />} />
                <Route path="/supplier-network/quotations" element={<SupplierQuotations />} />
                <Route path="/supplier-network/documents" element={<SupplierDocuments />} />
                <Route path="/supplier-network/communications" element={<SupplierCommunications />} />
                <Route path="/supplier-network/analytics" element={<SupplierAnalytics />} />
                <Route path="/supplier-network/import-invoices" element={<ImportInvoices />} />
                <Route path="/trash" element={<Trash />} />
                <Route path="/cro-dashboard" element={<CRODashboard />} />
                <Route path="/lqt-inbox" element={<LqtInbox />} />
                <Route path="/spt-inbox" element={<SptInbox />} />
                <Route path="/tst" element={<TSTQueue />} />
                <Route path="/tst/boq/:id" element={<BoqDetail />} />
                <Route path="/cro-performance" element={<CROPerformance />} />
                <Route path="/cro-performance/:croId" element={<CROPerformanceDetail />} />
                <Route path="/customer-success" element={<CustomerSuccess />} />
                <Route path="/procurement/queue" element={<ProcurementQueue />} />
                <Route path="/procurement/performance" element={<ProcurementPerformance />} />
                <Route path="/procurement/bulk-prices" element={<BulkPriceSubmit />} />
                <Route path="/procurement/price-approvals" element={<PriceApprovals />} />
                <Route path="/procurement/price-approvals/:id" element={<PriceApprovalDetail />} />
                <Route path="/cst/workspace" element={<CstWorkspace />} />
                <Route path="/settings/brand-mapping" element={<BrandMappingSettings />} />
                <Route path="/settings/redistribute-workload" element={<RedistributeWorkload />} />
                <Route path="/settings/verticals" element={<VerticalsSettings />} />
                <Route path="/bie/dashboard" element={<BIERoleGuard><BIEDashboard /></BIERoleGuard>} />
                <Route path="/bie/work" element={<BIERoleGuard><BIEWork /></BIERoleGuard>} />
                <Route path="/bie/team/:userId" element={<BIERoleGuard managerOnly><BIETeamMember /></BIERoleGuard>} />
                <Route path="/bie/performance" element={<BIERoleGuard managerOnly><BIEPerformance /></BIERoleGuard>} />
                <Route path="/bie/my-work" element={<BIERoleGuard><BIEMyWork /></BIERoleGuard>} />
                <Route path="/bie/workspace" element={<Navigate to="/bie/dashboard" replace />} />
                <Route path="/settings/lead-routing" element={<LeadRoutingRules />} />
                <Route path="/cct" element={<CCTControlRoom />} />
              </Route>

              {/* Backend Admin Routes */}
              <Route path="/backend" element={<Suspense fallback={<PageLoader />}><BackendLogin /></Suspense>} />
              <Route path="/backend/dashboard" element={<BackendProtectedRoute><BackendLayout><BackendDashboard /></BackendLayout></BackendProtectedRoute>} />
              <Route path="/backend/tenants" element={<BackendProtectedRoute><BackendLayout><BackendTenants /></BackendLayout></BackendProtectedRoute>} />
              <Route path="/backend/tenants/:id" element={<BackendProtectedRoute><BackendLayout><BackendTenantDetail /></BackendLayout></BackendProtectedRoute>} />
              <Route path="/backend/subscriptions" element={<BackendProtectedRoute><BackendLayout><BackendSubscriptions /></BackendLayout></BackendProtectedRoute>} />
              <Route path="/backend/support" element={<BackendProtectedRoute><BackendLayout><BackendSupport /></BackendLayout></BackendProtectedRoute>} />
              <Route path="/backend/analytics" element={<BackendProtectedRoute><BackendLayout><BackendAnalytics /></BackendLayout></BackendProtectedRoute>} />
              <Route path="/backend/coupons" element={<BackendProtectedRoute><BackendLayout><BackendCoupons /></BackendLayout></BackendProtectedRoute>} />
              <Route path="/backend/marketing" element={<BackendProtectedRoute><BackendLayout><BackendMarketing /></BackendLayout></BackendProtectedRoute>} />
              <Route path="/backend/settings" element={<BackendProtectedRoute><BackendLayout><BackendSettings /></BackendLayout></BackendProtectedRoute>} />
              <Route path="/backend/audit-log" element={<BackendProtectedRoute><BackendLayout><BackendAuditLog /></BackendLayout></BackendProtectedRoute>} />
              <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
          </VerticalProvider>
          </LanguageProvider>
        </AuthProvider>
      </QueryClientProvider>
  </ThemeProvider>
  );
};

// Placeholder component for routes not yet implemented
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <h1 className="text-2xl font-display font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground">This module will be implemented in the next phase.</p>
    </div>
  );
}

export default App;
