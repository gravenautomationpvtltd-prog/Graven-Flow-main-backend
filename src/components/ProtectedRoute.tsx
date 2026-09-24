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
  const { user, session, loading: authLoading } = useAuth();
  const { hasTenant, isExpired, loading: tenantLoading } = useTenantStatus();
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

  // No tenant: allow specific pages, redirect everything else to dashboard
  if (!hasTenant) {
    if (NO_TENANT_ALLOWED_PATHS.includes(location.pathname)) {
      return <>{children}</>;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Expired → subscription expired page
  if (isExpired && location.pathname !== '/subscription-expired') {
    return <Navigate to="/subscription-expired" replace />;
  }

  return <>{children}</>;
}
