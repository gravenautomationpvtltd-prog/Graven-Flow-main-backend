import { Navigate } from "react-router-dom";
import { useBackendAuth } from "@/hooks/useBackendAuth";

export function BackendProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isPlatformAdmin, loading } = useBackendAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user || !isPlatformAdmin) {
    return <Navigate to="/backend" replace />;
  }

  return <>{children}</>;
}
