import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/lib/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useOfficesManagement } from '@/hooks/useOfficeManagement';
import { Search, Users, Building2, UserCheck, UserX, Mail, Phone, Eye, LogOut, Ban } from 'lucide-react';

interface EmployeeWithDetails {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  employment_status: string;
  exit_date: string | null;
  office_id: string | null;
  manager_id: string | null;
  created_at: string;
  office: {
    id: string;
    name: string;
    location: string;
  } | null;
  manager: {
    id: string;
    full_name: string;
  } | null;
  roles: {
    role: string;
  }[];
}

const roleColors: Record<string, string> = {
  super_admin: 'bg-red-500/10 text-red-500 border-red-500/20',
  coo: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  manager: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  sales: 'bg-green-500/10 text-green-500 border-green-500/20',
  procurement: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  accounts: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  warehouse: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  hr: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
};

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  coo: 'COO',
  manager: 'Manager',
  sales: 'Sales',
  procurement: 'Procurement',
  accounts: 'Accounts',
  warehouse: 'Warehouse',
  hr: 'HR',
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  active: { label: 'Active', variant: 'default' },
  inactive: { label: 'Inactive', variant: 'secondary' },
  resigned: { label: 'Resigned', variant: 'outline', className: 'border-yellow-500/50 text-yellow-600 bg-yellow-500/10' },
  terminated: { label: 'Terminated', variant: 'outline', className: 'border-red-500/50 text-red-600 bg-red-500/10' },
};

export default function Employees() {
  const navigate = useNavigate();
  const { isAdmin, session } = useAuth();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [officeFilter, setOfficeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const { data: offices } = useOfficesManagement();

  const { data: userRoles } = useQuery({
    queryKey: ['my-roles-check', session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session!.user.id);
      return data?.map(r => r.role) || [];
    },
    enabled: !!session?.user?.id,
  });

  const isManagerOnly = userRoles?.includes('manager') && 
    !userRoles?.some(r => ['super_admin', 'coo', 'hr'].includes(r));

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees-with-details', session?.access_token, isManagerOnly],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          office:offices(id, name, location)
        `);

      if (isManagerOnly && session?.user?.id) {
        query = query.or(`id.eq.${session.user.id},manager_id.eq.${session.user.id}`);
      }

      const { data: profilesData, error: profilesError } = await query
        .order('full_name', { ascending: true });

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const rolesMap: Record<string, { role: string }[]> = {};
      rolesData?.forEach((r) => {
        if (!rolesMap[r.user_id]) {
          rolesMap[r.user_id] = [];
        }
        rolesMap[r.user_id].push({ role: r.role });
      });

      const profilesWithDetails = await Promise.all(
        (profilesData || []).map(async (profile) => {
          let manager = null;
          if (profile.manager_id) {
            const { data: managerData } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('id', profile.manager_id)
              .single();
            manager = managerData;
          }
          return {
            ...profile,
            manager,
            roles: rolesMap[profile.id] || [],
          };
        })
      );

      return profilesWithDetails as EmployeeWithDetails[];
    },
    enabled: !!session,
  });

  const filteredEmployees = employees?.filter((employee) => {
    const matchesSearch =
      employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.phone?.includes(searchQuery);

    const matchesOffice = officeFilter === 'all' || employee.office_id === officeFilter;
    
    const empStatus = employee.employment_status || (employee.is_active ? 'active' : 'inactive');
    const matchesStatus =
      statusFilter === 'all' ||
      empStatus === statusFilter;

    return matchesSearch && matchesOffice && matchesStatus;
  });

  const stats = {
    total: employees?.length || 0,
    active: employees?.filter((e) => (e.employment_status || 'active') === 'active' && e.is_active).length || 0,
    resigned: employees?.filter((e) => e.employment_status === 'resigned').length || 0,
    terminated: employees?.filter((e) => e.employment_status === 'terminated').length || 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">{t('employees.title', 'Employees')}</h1>
        <p className="text-muted-foreground">
          {t('employees.subtitle', 'View and manage employee directory across all offices')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resigned</CardTitle>
            <LogOut className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.resigned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminated</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.terminated}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('employees.directory', 'Employee Directory')}</CardTitle>
          <CardDescription>
            {t('employees.directory_desc', 'Search and filter employees by name, email, office, or status')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={officeFilter} onValueChange={setOfficeFilter}>
              <SelectTrigger className="w-[180px]">
                <Building2 className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Offices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Offices</SelectItem>
                {offices?.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Active" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resigned">Resigned</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Reports To</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[50px]">View</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="h-24 text-center">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees?.map((employee) => {
                    const empStatus = employee.employment_status || (employee.is_active ? 'active' : 'inactive');
                    const config = statusConfig[empStatus] || statusConfig.inactive;

                    return (
                      <TableRow 
                        key={employee.id}
                        className={isAdmin ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => isAdmin && navigate(`/employees/${employee.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={employee.avatar_url || undefined} />
                              <AvatarFallback>
                                {employee.full_name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{employee.full_name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {employee.email}
                            </div>
                            {employee.phone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {employee.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {employee.office ? (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{employee.office.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {employee.roles.length > 0 ? (
                              employee.roles.map((r, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className={roleColors[r.role] || ''}
                                >
                                  {roleLabels[r.role] || r.role}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No roles</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {employee.manager ? (
                            <span className="text-sm">{employee.manager.full_name}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.variant} className={config.className}>
                            {config.label}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredEmployees?.length || 0} of {employees?.length || 0} employees
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
