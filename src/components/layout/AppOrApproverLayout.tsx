import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { ApproverLayout } from '@/components/layout/ApproverLayout';
import { useIsApproverOnly } from '@/hooks/useIsApproverOnly';

const APPROVER_ALLOWED = [
  '/supplier-network/applications',
  '/procurement/bulk-prices',
  '/procurement/price-approvals',
];

function ApproverShell() {
  const { loading, approverOnly } = useIsApproverOnly();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!approverOnly) {
    return <AppLayout />;
  }

  const allowed = APPROVER_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (!allowed) {
    return <Navigate to="/supplier-network/applications" replace />;
  }

  return <ApproverLayout />;
}

export function AppOrApproverLayout({ children }: { children?: ReactNode }) {
  return (
    <ProtectedRoute>
      <ApproverShell />
    </ProtectedRoute>
  );
}
