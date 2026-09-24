import { useState } from 'react';
import { ArrowLeft, Mail, Phone, Building2, Calendar, UserMinus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmployeeProfile } from '@/hooks/useEmployeeStats';
import { EmployeeExitDialog } from '@/components/employees/EmployeeExitDialog';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

const roleColors: Record<string, string> = {
  super_admin: 'bg-red-500/10 text-red-500 border-red-500/20',
  coo: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  manager: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  sales: 'bg-green-500/10 text-green-500 border-green-500/20',
  procurement: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  accounts: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  warehouse: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  bie: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  bie_manager: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  hr: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
};

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  coo: 'COO',
  manager: 'Manager',
  sales: 'Sales',
  procurement: 'Procurement',
  bie: "BIE",
  bie_manager: "BIE Manager",
  accounts: 'Accounts',
  warehouse: 'Warehouse',
  hr: 'HR',
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: '' },
  inactive: { label: 'Inactive', className: '' },
  resigned: { label: 'Resigned', className: 'border-yellow-500/50 text-yellow-600 bg-yellow-500/10' },
  terminated: { label: 'Terminated', className: 'border-red-500/50 text-red-600 bg-red-500/10' },
};

interface EmployeeDetailHeaderProps {
  profile: EmployeeProfile;
}

export function EmployeeDetailHeader({ profile }: EmployeeDetailHeaderProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  const empStatus = profile.employment_status || (profile.is_active ? 'active' : 'inactive');
  const exitDate = profile.exit_date;
  const exitReason = profile.exit_reason;
  const isExited = empStatus === 'resigned' || empStatus === 'terminated';
  const config = statusConfig[empStatus] || statusConfig.inactive;

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/employees')}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Employees
      </Button>

      {/* Exit Info Banner */}
      {isExited && (
        <div className={`rounded-lg border p-4 ${empStatus === 'terminated' ? 'border-red-500/30 bg-red-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
          <div className="flex items-center gap-2 font-medium">
            <UserMinus className="h-4 w-4" />
            This employee has {empStatus === 'resigned' ? 'resigned' : 'been terminated'}
            {exitDate && ` on ${format(new Date(exitDate), 'MMM d, yyyy')}`}
          </div>
          {exitReason && <p className="text-sm text-muted-foreground mt-1">{exitReason}</p>}
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-lg">
              {profile.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-bold tracking-tight">
              {profile.full_name}
            </h1>
            <div className="flex flex-wrap gap-2">
              {profile.roles.map((r, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className={roleColors[r.role] || ''}
                >
                  {roleLabels[r.role] || r.role}
                </Badge>
              ))}
              <Badge
                variant={empStatus === 'active' ? 'default' : empStatus === 'inactive' ? 'secondary' : 'outline'}
                className={config.className}
              >
                {config.label}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {profile.email}
            </div>
            {profile.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {profile.phone}
              </div>
            )}
            {profile.office && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {profile.office.name}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Joined {format(new Date(profile.created_at), 'MMM d, yyyy')}
            </div>
          </div>

          {isAdmin && profile.is_active && !isExited && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => setExitDialogOpen(true)}
            >
              <UserMinus className="h-4 w-4 mr-2" />
              Offboard Employee
            </Button>
          )}
        </div>
      </div>

      <EmployeeExitDialog
        open={exitDialogOpen}
        onOpenChange={setExitDialogOpen}
        employeeId={profile.id}
        employeeName={profile.full_name}
      />
    </div>
  );
}
