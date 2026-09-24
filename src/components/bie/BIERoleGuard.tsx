import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export function BIERoleGuard({ children, managerOnly = false }: { children: ReactNode; managerOnly?: boolean }) {
  const { loading, isBIE, isBIEManager } = useAuth();
  if (loading) return <div className="flex min-h-96 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!isBIE || (managerOnly && !isBIEManager)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}