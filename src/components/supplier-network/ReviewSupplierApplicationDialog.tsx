import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Supplier {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
}

export function ReviewSupplierApplicationDialog({ open, onOpenChange, supplier }: Props) {
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from('suppliers').update({ application_status: status }).eq('id', supplier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-applications'] });
      onOpenChange(false);
      toast.success('Application updated');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review: {supplier.name}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => updateStatus.mutate('approved')} className="flex-1">Approve</Button>
          <Button onClick={() => updateStatus.mutate('rejected')} variant="destructive" className="flex-1">Reject</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
