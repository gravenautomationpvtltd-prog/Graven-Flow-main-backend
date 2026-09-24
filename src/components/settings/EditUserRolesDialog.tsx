import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield, Users, TrendingUp, ShoppingCart, FileText, Package, Clock, Heart, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUpdateUserRole } from "@/hooks/useUserManagement";
import type { Database } from "@/integrations/supabase/types";
import { RoleTransitionDialog } from "./RoleTransitionDialog";
import { REQUIRED_DELEGATE_ROLES } from "@/hooks/useRoleTransition";

type AppRole = Database['public']['Enums']['app_role'];

const allRoles: AppRole[] = [
  "super_admin",
  "coo",
  "cct",
  "manager",
  "procurement_manager",
  "sales",
  "cro",
  "tst",
  "cst",
  "procurement",
  "import_procurement",
  "accounts",
  "warehouse",
  "qc",
  "hr",
  "bie",
  "bie_manager",
];

const roleLabels: Record<AppRole, string> = {
  super_admin: "Super Admin",
  coo: "COO",
  cct: "Commercial Control (CCT)",
  manager: "Sales Manager",
  procurement_manager: "Procurement Manager",
  sales: "Sales",
  cro: "CRO",
  tst: "Technical Solutions",
  cst: "Customer Success",
  procurement: "Procurement",
  import_procurement: "Import Procurement",
  bie: "BIE",
  bie_manager: "BIE Manager",
  accounts: "Accounts",
  warehouse: "Warehouse",
  qc: "Quality Control (QC)",
  hr: "HR",
  platform_admin: "Platform Admin",
};

const roleDescriptions: Record<AppRole, string> = {
  super_admin: "Full system access, can manage all settings and users",
  coo: "Executive access, can view all data and manage escalations",
  cct: "Commercial Control Team — sets sourcing decisions, target prices, and tracks every confirmed order end-to-end",
  manager: "Sales team management, can assign leads and view team performance",
  procurement_manager: "Procurement team lead — manages procurement team workload, queue, and supplier performance",
  sales: "Lead and customer management, quotations",
  cro: "Customer retention, follow up stale customers, generate enquiries",
  tst: "Technical Solutions Team — handles complex enquiries, BOQ design, feasibility",
  cst: "Customer Success Team — post-delivery follow-up, satisfaction, repeat business",
  bie: "Business Intelligence Executive — maintains products, registrations, tenders, supplier onboarding and listings",
  bie_manager: "BIE Manager — assigns work and manages every BIE employee dashboard",
  procurement: "Purchase orders, vendor management",
  import_procurement: "Import Procurement — handles overseas sourcing, import POs, and landed-cost tracking",
  accounts: "Invoicing, payments, financial reports",
  warehouse: "Inventory management, stock control",
  qc: "Receives material, checks quality, updates stock and releases goods for dispatch",
  hr: "Employee management, attendance, payroll",
  platform_admin: "Platform-level admin for managing all tenants",
};

const roleIcons: Record<AppRole, React.ComponentType<{ className?: string }>> = {
  super_admin: Shield,
  coo: TrendingUp,
  cct: Shield,
  manager: Users,
  procurement_manager: ShoppingCart,
  sales: TrendingUp,
  cro: Users,
  tst: Package,
  bie: ShieldCheck,
  bie_manager: ShieldCheck,
  cst: Heart,
  procurement: ShoppingCart,
  import_procurement: ShoppingCart,
  accounts: FileText,
  warehouse: Package,
  qc: ShieldCheck,
  hr: Clock,
  platform_admin: Shield,
};

const roleFeatures: Record<AppRole, string[]> = {
  super_admin: ["All Modules", "User Management", "System Settings", "Integrations", "Delete Access"],
  coo: ["Dashboard", "All Reports", "Escalations", "Approvals", "User Management"],
  cct: ["CCT Control Room", "Sourcing Decisions", "Target Prices", "Stage Tracking", "Margin Control"],
  manager: ["Team Leads", "Assign Tasks", "Team Reports", "Escalation Review"],
  procurement_manager: ["Procurement Queue", "Team Workload", "Supplier Performance", "Procurement Reports"],
  bie: ["Personal Dashboard", "Products", "Registrations", "Tenders", "Listings", "Supplier Onboarding"],
  bie_manager: ["Team Dashboard", "Assign/Reassign Work", "All BIE Records", "Performance Oversight"],
  sales: ["Leads", "Customers", "Quotations", "Activities"],
  cro: ["CRO Dashboard", "Customer Follow-ups", "Add Enquiries", "Contact Tracking"],
  tst: ["TST Queue", "BOQ Builder", "Tech Notes", "Handoff to Sales"],
  cst: ["Active Customers", "Recently Delivered", "At-Risk", "Repeat Opportunities"],
  procurement: ["Purchase Orders", "Vendors", "BOQ", "Stock Requests"],
  import_procurement: ["Import POs", "Overseas Vendors", "Landed Costs", "Customs"],
  accounts: ["Invoices", "Payments", "Financial Reports", "GST"],
  warehouse: ["Inventory", "Stock Control", "Dispatch", "Returns"],
  qc: ["Receive Material", "Quality Check", "Held Stock", "Release for Dispatch", "Stock Ledger"],
  hr: ["Attendance", "Payroll", "Leave Management", "Employee Records"],
  platform_admin: ["Platform Backend", "Tenant Management", "Subscriptions", "Analytics"],
};

interface EditUserRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; name: string; roles: AppRole[] } | null;
}

export function EditUserRolesDialog({ open, onOpenChange, user }: EditUserRolesDialogProps) {
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const updateRoles = useUpdateUserRole();

  useEffect(() => {
    if (user) {
      setSelectedRoles(user.roles);
    }
  }, [user]);

  const removedRoles: AppRole[] = user
    ? user.roles.filter(
        (r) => !selectedRoles.includes(r) && REQUIRED_DELEGATE_ROLES[r as string],
      )
    : [];

  const handleRoleToggle = (role: AppRole, checked: boolean) => {
    if (checked) {
      setSelectedRoles([...selectedRoles, role]);
    } else {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    }
  };

  const persistRoles = async () => {
    if (!user) return;
    await updateRoles.mutateAsync({ userId: user.id, roles: selectedRoles });
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!user) return;
    // If any work-bearing roles are being removed, prompt for handover first
    if (removedRoles.length > 0) {
      setTransitionOpen(true);
      return;
    }
    await persistRoles();
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Roles for {user.name}</DialogTitle>
          <DialogDescription>
            Select the roles to assign to this user. Users can have multiple roles.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="grid gap-3 py-4">
            {allRoles.map((role) => {
              const IconComponent = roleIcons[role];
              return (
                <div
                  key={role}
                  className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={role}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={(checked) => handleRoleToggle(role, checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1 grid gap-1.5">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={role} className="cursor-pointer font-medium">
                        {roleLabels[role]}
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {roleDescriptions[role]}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {roleFeatures[role].map((feature) => (
                        <Badge key={feature} variant="secondary" className="text-xs font-normal">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateRoles.isPending}>
            {updateRoles.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Roles
          </Button>
        </DialogFooter>
      </DialogContent>

      <RoleTransitionDialog
        open={transitionOpen}
        onOpenChange={setTransitionOpen}
        fromUser={user ? { id: user.id, name: user.name } : null}
        rolesRemoved={removedRoles}
        onConfirmed={async () => {
          setTransitionOpen(false);
          await persistRoles();
        }}
      />
    </Dialog>
  );
}
