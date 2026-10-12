import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenantStatus } from '@/hooks/useTenantStatus';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Pages accessible even without a tenant (no onboarding loop)
const NO_TENANT_ALLOWED_PATHS = ['/dashboard', '/settings', '/profile', '/onboarding', '/subscription-expired'];

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, session, loading: authLoading, mustChangePassword } = useAuth();
  const { hasTenant, loading: tenantLoading } = useTenantStatus();
  const location = useLocation();

  // Show loader only during initial bootstrap — not on background revalidation
  const isInitialBootstrap = authLoading || (user && tenantLoading && !hasTenant);
  if (isInitialBootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return <Navigate to="/auth" replace />;
  }

  // Force first-login password change before any protected access is permitted
  if (mustChangePassword) {
    if (location.pathname !== '/set-new-password') {
      return <Navigate to="/set-new-password" replace />;
    }
    return <>{children}</>;
  } else if (location.pathname === '/set-new-password') {
    // If password change is not required, redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  // No tenant: allow specific pages, redirect everything else to dashboard
  if (!hasTenant) {
    if (NO_TENANT_ALLOWED_PATHS.includes(location.pathname)) {
      return <>{children}</>;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
