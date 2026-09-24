import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: { id: string; name: string };
  categories: { id: string; name: string }[];
}

export function AssignCategoriesDialog({ open, onOpenChange, supplier, categories }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: assignments } = useQuery({
    queryKey: ['supplier-categories', supplier.id],
    queryFn: async () => {
      const { data } = await supabase.from('supplier_category_assignments').select('category_id').eq('supplier_id', supplier.id);
      return data?.map(a => a.category_id) || [];
    },
    enabled: open,
  });

  useEffect(() => { if (assignments) setSelected(assignments); }, [assignments]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('supplier_category_assignments').delete().eq('supplier_id', supplier.id);
      if (selected.length > 0) {
        await supabase.from('supplier_category_assignments').insert(selected.map(c => ({ supplier_id: supplier.id, category_id: c })));
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplier-categories'] }); onOpenChange(false); toast.success('Categories updated'); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign Categories: {supplier.name}</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-64 overflow-auto">
          {categories.map(c => (
            <label key={c.id} className="flex items-center gap-2">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={(v) => setSelected(v ? [...selected, c.id] : selected.filter(x => x !== c.id))} />
              {c.name}
            </label>
          ))}
        </div>
        <Button onClick={() => saveMutation.mutate()} className="w-full mt-4">Save</Button>
      </DialogContent>
    </Dialog>
  );
}
