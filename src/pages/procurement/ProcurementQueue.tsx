import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PriceRequestsTab } from '@/components/procurement/PriceRequestsTab';
import { useProcurementQueueRealtime } from '@/hooks/useProcurementQueue';

export default function ProcurementQueue() {
  const navigate = useNavigate();
  const { isLive } = useProcurementQueueRealtime();

  useEffect(() => {
    // The legacy /procurement landing duplicated this queue in a tabbed workspace.
    // The dedicated queue is now here; keep the workspace reachable for POs/suppliers.
    const params = new URLSearchParams(window.location.search);
    if (params.get('legacy') === 'true') {
      navigate('/procurement', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Procurement Queue</h1>
          <p className="text-sm text-muted-foreground">
            Paginated price requests with filters, assignment and quote capture.
          </p>
        </div>
        <div className="ml-auto">
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5',
              isLive
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isLive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50'
              )}
            />
            <Wifi className="h-3 w-3" />
            {isLive ? 'Live' : 'Offline'}
          </Badge>
        </div>
      </div>

      <PriceRequestsTab />
    </div>
  );
}
