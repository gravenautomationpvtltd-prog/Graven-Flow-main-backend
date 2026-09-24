import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: { id: string; name: string };
}

export function SuspendSupplierDialog({ open, onOpenChange, supplier }: Props) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const suspendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('suppliers').update({ is_active: false, suspended_at: new Date().toISOString(), suspension_reason: reason }).eq('id', supplier.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['approved-suppliers'] }); onOpenChange(false); toast.success('Supplier suspended'); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Suspend: {supplier.name}</DialogTitle></DialogHeader>
        <Textarea placeholder="Reason for suspension..." value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button onClick={() => suspendMutation.mutate()} variant="destructive" className="w-full mt-4">Suspend Supplier</Button>
      </DialogContent>
    </Dialog>
  );
}
