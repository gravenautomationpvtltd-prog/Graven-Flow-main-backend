import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Package, 
  FileText, 
  Clock, 
  DollarSign,
  Settings,
  LogOut,
  Building2,
  TrendingUp,
  AlertTriangle,
  UserCog,
  Truck,
  Receipt,
  CheckSquare,
  Mail,
  Box,
  User,
  Target,
  MessageSquare,
  History,
  BarChart3,
  Globe,
  ClipboardCheck,
  ClipboardList,
  ClipboardPaste,
  UserCheck,
  FileSearch,
  Inbox,
  FolderOpen,
  MessagesSquare,
  PieChart,
  Trash2,
  Users2,
  Cog,
  Heart,
  Tag,
  ShieldCheck
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadCount } from '@/hooks/useChat';
import { usePendingPriceRequestsCount } from '@/hooks/usePriceRequests';
import { useIsBulkPriceApprover } from '@/hooks/useProcurementApprovers';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface NavItem {
  titleKey: string;
  fallback: string;
  url: string;
  icon: React.ElementType;
}

const commonNavItems: NavItem[] = [
  { titleKey: 'nav.dashboard', fallback: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { titleKey: 'nav.messages', fallback: 'Messages', url: '/messages', icon: MessageSquare },
  { titleKey: 'nav.escalations', fallback: 'Escalations', url: '/escalations', icon: AlertTriangle },
];

const salesNavItems: NavItem[] = [
  { titleKey: 'nav.spt_inbox', fallback: 'Sales Inbox', url: '/spt-inbox', icon: Inbox },
  { titleKey: 'nav.leads', fallback: 'Leads', url: '/leads', icon: TrendingUp },
  { titleKey: 'nav.customers', fallback: 'Customers', url: '/customers', icon: Users },
  { titleKey: 'nav.orders', fallback: 'Orders', url: '/orders', icon: FileText },
  { titleKey: 'nav.tasks', fallback: 'Tasks', url: '/tasks', icon: CheckSquare },
];

const operationsNavItems: NavItem[] = [
  { titleKey: 'nav.orders', fallback: 'Sales Orders', url: '/orders', icon: FileText },
  { titleKey: 'nav.procurement_queue', fallback: 'Procurement Queue', url: '/procurement/queue', icon: Inbox },
  { titleKey: 'nav.procurement', fallback: 'Procurement', url: '/procurement', icon: ShoppingCart },
  { titleKey: 'nav.procurement_performance', fallback: 'Procurement Performance', url: '/procurement/performance', icon: BarChart3 },
  { titleKey: 'nav.bulk_prices', fallback: '批量报价 / Bulk Prices', url: '/procurement/bulk-prices', icon: ClipboardPaste },
  { titleKey: 'nav.inventory', fallback: 'Inventory', url: '/inventory', icon: Package },
  { titleKey: 'nav.products', fallback: 'Product Catalog', url: '/products', icon: Box },
  { titleKey: 'nav.dispatch', fallback: 'Dispatch', url: '/dispatch', icon: Truck },
];

const qcNavItems: NavItem[] = [
  { titleKey: 'nav.qc', fallback: 'QC & Receiving', url: '/qc', icon: ShieldCheck },
  { titleKey: 'nav.stock_ledger', fallback: 'Stock Ledger', url: '/stock-ledger', icon: ClipboardCheck },
  { titleKey: 'nav.inventory', fallback: 'Inventory', url: '/inventory', icon: Package },
];

const priceApprovalNavItems: NavItem[] = [
  { titleKey: 'nav.price_approvals', fallback: 'Price Approvals', url: '/procurement/price-approvals', icon: FileSearch },
];

const financeNavItems: NavItem[] = [
  { titleKey: 'nav.invoices', fallback: 'Invoices', url: '/invoices', icon: Receipt },
  { titleKey: 'nav.accounts', fallback: 'Accounts', url: '/accounts', icon: DollarSign },
];

const salesReportsItems: NavItem[] = [
  { titleKey: 'nav.reports', fallback: 'Reports Hub', url: '/reports', icon: BarChart3 },
  { titleKey: 'nav.email_analytics', fallback: 'Email Analytics', url: '/email-analytics', icon: Mail },
  { titleKey: 'nav.order_analytics', fallback: 'Order Analytics', url: '/order-analytics', icon: TrendingUp },
  { titleKey: 'nav.outreach_analytics', fallback: 'Outreach Analytics', url: '/outreach-analytics', icon: Users2 },
];

const procurementReportsItems: NavItem[] = [
  { titleKey: 'nav.pricing_intelligence', fallback: 'Pricing Intelligence', url: '/pricing-intelligence', icon: Target },
];

const executiveReportsItems: NavItem[] = [
  { titleKey: 'nav.decision_deck', fallback: 'Decision Deck', url: '/decision-deck', icon: Target },
  { titleKey: 'nav.profit_analytics', fallback: 'Profit Analytics', url: '/profit-analytics', icon: TrendingUp },
  { titleKey: 'nav.activity_log', fallback: 'Activity Log', url: '/activity-log', icon: History },
  { titleKey: 'nav.assignment_audit', fallback: 'Assignment Audit', url: '/admin/assignment-audit', icon: ShieldCheck },
  { titleKey: 'nav.ownership_mismatch', fallback: 'Ownership Mismatch', url: '/admin/ownership-mismatch', icon: UserCheck },
];

const hrNavItems: NavItem[] = [
  { titleKey: 'nav.attendance', fallback: 'Attendance', url: '/attendance', icon: Clock },
  { titleKey: 'nav.payroll', fallback: 'Payroll', url: '/payroll', icon: FileText },
  { titleKey: 'nav.employees', fallback: 'Employees', url: '/employees', icon: UserCog },
];

const adminNavItems: NavItem[] = [
  { titleKey: 'nav.trash', fallback: 'Trash', url: '/trash', icon: Trash2 },
  { titleKey: 'nav.settings', fallback: 'Settings', url: '/settings', icon: Settings },
];

const selfServiceNavItems: NavItem[] = [
  { titleKey: 'nav.attendance', fallback: 'My Attendance', url: '/attendance', icon: Clock },
];

const supplierNetworkNavItems: NavItem[] = [
  { titleKey: 'nav.supplier_applications', fallback: 'Supplier Applications', url: '/supplier-network/applications', icon: ClipboardList },
  { titleKey: 'nav.approved_suppliers', fallback: 'Approved Suppliers', url: '/supplier-network/suppliers', icon: UserCheck },
  { titleKey: 'nav.rfqs', fallback: 'RFQs', url: '/supplier-network/rfqs', icon: FileSearch },
  { titleKey: 'nav.supplier_quotations', fallback: 'Quotations', url: '/supplier-network/quotations', icon: FileText },
  { titleKey: 'nav.supplier_documents', fallback: 'Documents', url: '/supplier-network/documents', icon: FolderOpen },
  { titleKey: 'nav.supplier_communications', fallback: 'Communications', url: '/supplier-network/communications', icon: MessagesSquare },
  { titleKey: 'nav.import_invoices', fallback: 'Import Invoices', url: '/supplier-network/import-invoices', icon: Globe },
  { titleKey: 'nav.supplier_analytics', fallback: 'Analytics', url: '/supplier-network/analytics', icon: PieChart },
];

const lqtNavItems: NavItem[] = [
  { titleKey: 'nav.lqt_inbox', fallback: 'LQT Inbox', url: '/lqt-inbox', icon: Inbox },
  { titleKey: 'nav.cro_dashboard', fallback: 'Customer Outreach', url: '/cro-dashboard', icon: Users2 },
];

const croManagementItems: NavItem[] = [
  { titleKey: 'nav.cro_performance', fallback: 'CRO Performance', url: '/cro-performance', icon: BarChart3 },
];

const tstNavItems: NavItem[] = [
  { titleKey: 'nav.tst_queue', fallback: 'TST Queue', url: '/tst', icon: Cog },
];

const cstNavItems: NavItem[] = [
  { titleKey: 'nav.cst_dashboard', fallback: 'Customer Success', url: '/cst/workspace', icon: Heart },
  { titleKey: 'nav.tasks', fallback: 'Tasks', url: '/tasks', icon: CheckSquare },
];

const procurementSettingsItems: NavItem[] = [
  { titleKey: 'nav.brand_mapping', fallback: 'Brand Mapping', url: '/settings/brand-mapping', icon: Tag },
];

const bieNavItems: NavItem[] = [
  { titleKey: 'nav.bie_dashboard', fallback: 'My Dashboard', url: '/bie/dashboard', icon: LayoutDashboard },
  { titleKey: 'nav.bie_work', fallback: 'Work Register', url: '/bie/work', icon: ClipboardList },
  { titleKey: 'nav.products', fallback: 'Products', url: '/products', icon: Package },
  { titleKey: 'nav.supplier_onboarding', fallback: 'Supplier Onboarding', url: '/supplier-network/applications', icon: UserCheck },
  { titleKey: 'nav.tasks', fallback: 'Miscellaneous Tasks', url: '/tasks', icon: CheckSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { profile, roles, signOut, isAdmin, isHR, isProcurement, isAccounts, isWarehouse, isManager, isSales, isCRO, isTST, isCST, isSalesManager, isProcurementManager, isCCT, isBIE, isBIEManager, isPureBIE, isQC } = useAuth();
  const isBulkPriceApprover = useIsBulkPriceApprover();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const collapsed = state === 'collapsed';
  const unreadCount = useUnreadCount();
  const { data: pendingPriceRequests = 0 } = usePendingPriceRequestsCount();

  // Procurement Manager (without admin/sales-manager override) gets a procurement-only sidebar
  const isPureProcurementManager = isProcurementManager && !isAdmin && !isSalesManager;

  const isActive = (path: string) => location.pathname === path;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderNavItems = (items: NavItem[], label: string) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-muted-foreground/70">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const title = t(item.titleKey, item.fallback);
            let badgeCount = 0;
            if (item.titleKey === 'nav.messages') {
              badgeCount = unreadCount;
            } else if (item.titleKey === 'nav.procurement') {
              badgeCount = pendingPriceRequests;
            }

            return (
              <SidebarMenuItem key={item.titleKey + item.url}>
                <SidebarMenuButton 
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={collapsed ? title : undefined}
                >
                  <NavLink 
                    to={item.url}
                    className={cn(
                      "flex items-center gap-3 transition-colors",
                      isActive(item.url) && "bg-primary/10 text-primary"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && (
                      <span className="flex-1">{title}</span>
                    )}
                    {!collapsed && badgeCount > 0 && (
                      <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </Badge>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  // Determine if user needs self-service attendance (non-HR, non-admin employees)
  const showSelfServiceAttendance = !isHR && !isAdmin;

  // Procurement Manager–only sidebar: lock to procurement domain
  if (isPureProcurementManager) {
    return (
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-display font-bold text-lg">Graven</span>
                <span className="text-xs text-muted-foreground">Procurement</span>
              </div>
            )}
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-4">
          {renderNavItems(commonNavItems, 'Main')}
          {renderNavItems(operationsNavItems, 'Operations')}
          {renderNavItems(supplierNetworkNavItems, 'Supplier Network')}
          {renderNavItems(selfServiceNavItems, 'Self Service')}
          {renderNavItems(
            [
              {
                titleKey: 'nav.team_reports',
                fallback: 'Team Reports',
                url: '/reports/procurement-team',
                icon: BarChart3,
              },
            ],
            'Reports'
          )}
          {renderNavItems(procurementSettingsItems, 'Procurement Settings')}
          {renderNavItems([
            { titleKey: 'nav.settings', fallback: 'Settings', url: '/settings', icon: Settings },
          ], 'Account')}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-4">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus:outline-none">
                  <Avatar className="h-9 w-9 shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <div className="flex items-center gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate">{profile?.full_name || 'User'}</span>
                    <span className="text-xs text-muted-foreground truncate">{profile?.email}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  {t('nav.profile', 'My Profile')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('action.logout', 'Sign Out')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">Procurement Manager</p>
              </div>
            )}
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg">Graven</span>
              <span className="text-xs text-muted-foreground">Management System</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {renderNavItems(
          isPureBIE
            ? [{ titleKey: 'nav.messages', fallback: 'Messages', url: '/messages', icon: MessageSquare }]
            : commonNavItems,
          'Main'
        )}
        {isCCT && renderNavItems(
          [{ titleKey: 'nav.cct', fallback: 'CCT Control Room', url: '/cct', icon: ShieldCheck }],
          'Commercial Control'
        )}
        {isSales && renderNavItems(salesNavItems, 'Sales')}
        {(isProcurement || isWarehouse || isAdmin || isProcurementManager) && renderNavItems(operationsNavItems, 'Operations')}
        {(isQC || isWarehouse || isAdmin) && renderNavItems(qcNavItems, 'Quality Control')}
        {(isProcurement || isAdmin || isProcurementManager) && renderNavItems(supplierNetworkNavItems, 'Supplier Network')}
        {isBIE && renderNavItems(
          bieNavItems.flatMap((item) =>
            item.url === '/bie/dashboard'
              ? [{ ...item, fallback: isBIEManager ? 'Team Dashboard' : 'My Dashboard' }]
              : item.url === '/bie/work'
              ? isBIEManager
                ? [
                    { ...item, fallback: 'Team Work' },
                    { titleKey: 'nav.bie_performance', fallback: 'Team Performance', url: '/bie/performance', icon: BarChart3 },
                  ]
                : [
                    { titleKey: 'nav.bie_my_work', fallback: 'My Work', url: '/bie/my-work', icon: ClipboardCheck },
                    { ...item, fallback: 'Work Register' },
                  ]
              : [item],
          ),
          'Business Intelligence',
        )}
        {(isBulkPriceApprover) && renderNavItems(priceApprovalNavItems, 'Price Approvals')}
        {isAccounts && renderNavItems(financeNavItems, 'Finance')}
        {isCRO && renderNavItems(lqtNavItems, 'Lead Qualification (LQT)')}
        {(isAdmin || isSalesManager) && renderNavItems(croManagementItems, 'CRO Management')}
        {isTST && renderNavItems(tstNavItems, 'Technical Solutions')}
        {isCST && renderNavItems(cstNavItems, 'Customer Success')}
        {isHR && renderNavItems(hrNavItems, 'HR & Payroll')}
        {showSelfServiceAttendance && renderNavItems(selfServiceNavItems, 'Self Service')}
        {(isSalesManager || isProcurementManager || isAdmin || isProcurement) && renderNavItems(salesReportsItems, 'Reports')}
        {(isProcurementManager || isAdmin || isProcurement) && renderNavItems(procurementReportsItems, 'Procurement Reports')}
        {isAdmin && renderNavItems(executiveReportsItems, 'Executive')}
        {!isAdmin && isSalesManager && renderNavItems(
          [{ titleKey: 'nav.ownership_mismatch', fallback: 'Ownership Mismatch', url: '/admin/ownership-mismatch', icon: UserCheck }],
          'Team Audit'
        )}
        {(isAdmin || isProcurementManager) && renderNavItems(procurementSettingsItems, 'Procurement Settings')}
        {isAdmin ? renderNavItems(adminNavItems, 'Admin') : renderNavItems([
          { titleKey: 'nav.settings', fallback: 'Settings', url: '/settings', icon: Settings },
        ], 'Account')}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none">
                <Avatar className="h-9 w-9 shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate">{profile?.full_name || 'User'}</span>
                  <span className="text-xs text-muted-foreground truncate">{profile?.email}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                {t('nav.profile', 'My Profile')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {t('action.logout', 'Sign Out')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">
                {roles[0]?.replace('_', ' ') || 'No role'}
              </p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
