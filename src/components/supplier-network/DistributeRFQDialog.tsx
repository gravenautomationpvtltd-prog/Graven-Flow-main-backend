import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; rfq: { id: string; rfq_number: string }; }

export function DistributeRFQDialog({ open, onOpenChange, rfq }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['approved-suppliers-list'],
    queryFn: async () => { const { data } = await supabase.from('suppliers').select('id, name, country').eq('application_status', 'approved'); return data || []; },
    enabled: open,
  });

  const distributeMutation = useMutation({
    mutationFn: async () => {
      const distributions = selected.map(s => ({ rfq_id: rfq.id, supplier_id: s, sent_by: profile?.id }));
      const { error } = await supabase.from('rfq_distributions').insert(distributions);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rfqs'] }); onOpenChange(false); toast.success(`RFQ sent to ${selected.length} suppliers`); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Distribute RFQ: {rfq.rfq_number}</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-64 overflow-auto">
          {suppliers.map(s => (
            <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
              <Checkbox checked={selected.includes(s.id)} onCheckedChange={(v) => setSelected(v ? [...selected, s.id] : selected.filter(x => x !== s.id))} />
              <span>{s.name}</span><span className="text-xs text-muted-foreground ml-auto">{s.country}</span>
            </label>
          ))}
        </div>
        <Button onClick={() => distributeMutation.mutate()} className="w-full" disabled={selected.length === 0}>Send to {selected.length} Suppliers</Button>
      </DialogContent>
    </Dialog>
  );
}
