import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface DuplicateProduct {
  id: string;
  model_number: string | null;
  brand: string | null;
  description: string | null;
  list_price: number | null;
  product_status: string | null;
}

interface DuplicateGroup {
  match_key: string;
  brand_match_key: string | null;
  product_count: number;
  products: DuplicateProduct[];
}

/**
 * Read-only report of products whose model numbers collapse to the same
 * look-alike tolerant key (O/0, I/L/1, spaces and dashes ignored).
 * Nothing is merged automatically — this is for review only.
 */
export function ModelDuplicatesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['model-key-duplicates'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_model_key_duplicates');
      if (error) throw error;
      return (data ?? []) as unknown as DuplicateGroup[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Possible duplicate model numbers</DialogTitle>
          <DialogDescription>
            These products are written differently but read as the same model number once
            spaces, dashes and look-alike characters (O/0, I/L/1) are ignored. Review them and
            merge manually if needed — nothing is changed automatically.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No duplicate model numbers found.
          </p>
        ) : (
          <div className="space-y-3">
            {data.map((group) => (
              <Card key={`${group.brand_match_key}-${group.match_key}`} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{group.match_key}</span>
                  <Badge variant="secondary">{group.product_count} products</Badge>
                </div>
                <div className="divide-y">
                  {group.products.map((p) => (
                    <Link
                      key={p.id}
                      to={`/products/${p.id}`}
                      onClick={() => onOpenChange(false)}
                      className="flex items-start justify-between gap-4 py-2 text-sm hover:bg-muted/50 rounded px-1"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{p.model_number || '—'}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.brand ? `${p.brand} · ` : ''}
                          {p.description || 'No description'}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-muted-foreground">
                        {p.list_price != null ? `₹${Number(p.list_price).toLocaleString('en-IN')}` : '—'}
                        <div>{p.product_status || 'active'}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
