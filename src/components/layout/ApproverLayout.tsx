import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Loader2, ClipboardList, Send, CheckCircle2, UserPlus, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { InviteVendorDialog } from '@/components/supplier-network/InviteVendorDialog';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/supplier-network/applications', label: 'Vendor Applications', icon: ClipboardList },
  { to: '/procurement/bulk-prices', label: 'Submit Prices', icon: Send },
  { to: '/procurement/price-approvals', label: 'Approve Prices', icon: CheckCircle2 },
];

export function ApproverLayout() {
  const { profile, signOut } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 border-r bg-card flex flex-col">
        <div className="h-16 px-5 flex items-center border-b">
          <div>
            <div className="text-sm font-display font-bold tracking-tight">Graven OneDesk</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Procurement Approver</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + '/');
            return (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite Vendor
          </button>
        </nav>

        <div className="p-3 border-t space-y-2">
          <div className="px-2 text-xs">
            <div className="font-medium truncate">{profile?.full_name || 'Approver'}</div>
            <div className="text-muted-foreground truncate">{profile?.email}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <InviteVendorDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
