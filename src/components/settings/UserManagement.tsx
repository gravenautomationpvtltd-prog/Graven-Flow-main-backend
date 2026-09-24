import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DoubleConfirmDeleteDialog } from "@/components/ui/double-confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  Plus, 
  MoreHorizontal, 
  Shield, 
  UserCheck, 
  UserX,
  Search,
  Building,
  KeyRound,
  Pencil,
  UserMinus,
  Trash2,
  LogOut,
  Ban
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUsersWithRoles, useUpdateUserStatus, useOffices, useUpdateLeadAssignmentOptOut, useDeleteUser } from "@/hooks/useUserManagement";
import { useAuth } from "@/hooks/useAuth";
import { CreateUserDialog } from "./CreateUserDialog";
import { EditUserRolesDialog } from "./EditUserRolesDialog";
import { EditUserDialog } from "./EditUserDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { EmployeeExitDialog } from "@/components/employees/EmployeeExitDialog";
import { AccessDenied } from "@/components/ui/access-denied";
import { Skeleton } from "@/components/ui/skeleton";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database['public']['Enums']['app_role'];

const roleColors: Record<AppRole, string> = {
  super_admin: "bg-destructive/10 text-destructive border-destructive/20",
  coo: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  cct: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  manager: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  procurement_manager: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  sales: "bg-green-500/10 text-green-600 border-green-500/20",
  cro: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  tst: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  cst: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  procurement: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  import_procurement: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20",
  accounts: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  warehouse: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  qc: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  hr: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  bie: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  bie_manager: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  platform_admin: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

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
  accounts: "Accounts",
  bie: "BIE",
  bie_manager: "BIE Manager",
  warehouse: "Warehouse",
  qc: "Quality Control (QC)",
  hr: "HR",
  platform_admin: "Platform Admin",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  inactive: { label: 'Inactive', className: '' },
  resigned: { label: 'Left', className: 'border-yellow-500/50 text-yellow-600 bg-yellow-500/10' },
  terminated: { label: 'Terminated', className: 'border-red-500/50 text-red-600 bg-red-500/10' },
};

interface EditUserData {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  office_id?: string | null;
  manager_id?: string | null;
}

export function UserManagement() {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editRolesUser, setEditRolesUser] = useState<{ id: string; name: string; roles: AppRole[] } | null>(null);
  const [editUser, setEditUser] = useState<EditUserData | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [deleteUser, setDeleteUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [offboardUser, setOffboardUser] = useState<{ id: string; name: string } | null>(null);

  const { data: users, isLoading } = useUsersWithRoles();
  const { data: offices } = useOffices();
  const updateStatus = useUpdateUserStatus();
  const updateLeadOptOut = useUpdateLeadAssignmentOptOut();
  const deleteUserMutation = useDeleteUser();
  const { roles } = useAuth();

  const filteredUsers = users?.filter(user => 
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getOfficeName = (officeId: string | null) => {
    if (!officeId || !offices) return null;
    return offices.find(o => o.id === officeId)?.name || null;
  };

  const handleMarkActive = (userId: string) => {
    updateStatus.mutate({ userId, isActive: true, employmentStatus: 'active' });
  };

  const handleMarkInactive = (userId: string) => {
    updateStatus.mutate({ userId, isActive: false, employmentStatus: 'inactive' });
  };

  const handleToggleLeadOptOut = (userId: string, currentOptOut: boolean) => {
    updateLeadOptOut.mutate({ userId, optOut: !currentOptOut });
  };

  const getEmploymentStatus = (user: any): string => {
    return user.employment_status || (user.is_active ? 'active' : 'inactive');
  };

  if (!isAdmin) {
    return (
      <AccessDenied 
        title="Admin Access Required"
        message="Only administrators can manage users and roles."
      />
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage users and their roles across the organization</CardDescription>
              </div>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Users Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Lead Assignment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers?.map((user) => {
                    const empStatus = getEmploymentStatus(user);
                    const config = statusConfig[empStatus] || statusConfig.inactive;
                    const isExited = empStatus === 'resigned' || empStatus === 'terminated';
                    const isActive = empStatus === 'active';

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.length === 0 ? (
                              <span className="text-muted-foreground text-sm">No roles</span>
                            ) : (
                              user.roles.map((role) => (
                                <Badge 
                                  key={role} 
                                  variant="outline" 
                                  className={roleColors[role]}
                                >
                                  {roleLabels[role]}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.office_id ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Building className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{getOfficeName(user.office_id) || "Assigned"}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!(user.lead_assignment_opt_out ?? false)}
                              onCheckedChange={() => handleToggleLeadOptOut(user.id, user.lead_assignment_opt_out ?? false)}
                              disabled={updateLeadOptOut.isPending}
                            />
                            <span className="text-xs text-muted-foreground">
                              {user.lead_assignment_opt_out ? "Excluded" : "Included"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={isActive ? "default" : isExited ? "outline" : "secondary"}
                            className={config.className}
                          >
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => setEditRolesUser({ 
                                  id: user.id, 
                                  name: user.full_name,
                                  roles: user.roles 
                                })}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Manage Roles
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setEditUser({
                                  id: user.id,
                                  full_name: user.full_name,
                                  email: user.email,
                                  phone: user.phone,
                                  office_id: user.office_id,
                                  manager_id: user.manager_id,
                                })}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setResetPasswordUser({
                                  id: user.id,
                                  email: user.email,
                                  name: user.full_name
                                })}
                              >
                                <KeyRound className="h-4 w-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {/* Status actions */}
                              {isActive && (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => setOffboardUser({ id: user.id, name: user.full_name })}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <UserMinus className="h-4 w-4 mr-2" />
                                    Offboard & Delegate Work
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleMarkInactive(user.id)}
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Mark Inactive
                                  </DropdownMenuItem>
                                </>
                              )}
                              {!isActive && !isExited && (
                                <DropdownMenuItem 
                                  onClick={() => handleMarkActive(user.id)}
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Mark Active
                                </DropdownMenuItem>
                              )}
                              {isExited && (
                                <DropdownMenuItem 
                                  onClick={() => handleMarkActive(user.id)}
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Reactivate
                                </DropdownMenuItem>
                              )}

                              {roles.includes('super_admin') && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => setDeleteUser({
                                      id: user.id,
                                      name: user.full_name,
                                      email: user.email,
                                    })}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete User
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm text-muted-foreground">
            {filteredUsers?.length || 0} user(s) total
          </p>
        </CardContent>
      </Card>

      <CreateUserDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />

      <EditUserRolesDialog
        open={!!editRolesUser}
        onOpenChange={(open) => !open && setEditRolesUser(null)}
        user={editRolesUser}
      />

      <EditUserDialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        user={editUser}
      />

      <ResetPasswordDialog
        open={!!resetPasswordUser}
        onOpenChange={(open) => !open && setResetPasswordUser(null)}
        user={resetPasswordUser}
      />

      {offboardUser && (
        <EmployeeExitDialog
          open={!!offboardUser}
          onOpenChange={(open) => !open && setOffboardUser(null)}
          employeeId={offboardUser.id}
          employeeName={offboardUser.name}
        />
      )}

      <DoubleConfirmDeleteDialog
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        onConfirm={() => {
          if (deleteUser) {
            deleteUserMutation.mutate({ userId: deleteUser.id });
          }
        }}
        title="Delete User Permanently"
        description="This will permanently remove this user from the system. All their data, roles, and access will be deleted. This cannot be undone."
        itemDetails={deleteUser && (
          <>
            <p><strong>Name:</strong> {deleteUser.name}</p>
            <p><strong>Email:</strong> {deleteUser.email}</p>
          </>
        )}
        isLoading={deleteUserMutation.isPending}
      />
    </>
  );
}