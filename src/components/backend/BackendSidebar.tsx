import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  LifeBuoy,
  BarChart3,
  Ticket,
  Megaphone,
  Settings,
  LogOut,
  ClipboardList,
} from "lucide-react";
import { useBackendAuth } from "@/hooks/useBackendAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", path: "/backend/dashboard", icon: LayoutDashboard },
  { title: "Tenants", path: "/backend/tenants", icon: Building2 },
  { title: "Subscriptions", path: "/backend/subscriptions", icon: CreditCard },
  { title: "Support", path: "/backend/support", icon: LifeBuoy },
  { title: "Analytics", path: "/backend/analytics", icon: BarChart3 },
  { title: "Coupons", path: "/backend/coupons", icon: Ticket },
  { title: "Marketing", path: "/backend/marketing", icon: Megaphone },
  { title: "Settings", path: "/backend/settings", icon: Settings },
  { title: "Audit Log", path: "/backend/audit-log", icon: ClipboardList },
];

export function BackendSidebar() {
  const { signOut } = useBackendAuth();
  const location = useLocation();

  return (
    <aside className="w-64 min-h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col">
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-lg font-bold text-white tracking-tight">Graven OneDesk</h1>
        <p className="text-xs text-zinc-500 mt-1">Platform Admin</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              location.pathname === item.path
                ? "bg-emerald-500/10 text-emerald-400"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-zinc-800/50 transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
