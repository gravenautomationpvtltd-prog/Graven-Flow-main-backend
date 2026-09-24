import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

export function CreateRFQDialog({ open, onOpenChange }: Props) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [deadline, setDeadline] = useState('');
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['supplier-categories'],
    queryFn: async () => { const { data } = await supabase.from('supplier_categories').select('*').eq('is_active', true); return data || []; },
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => { const { data } = await supabase.from('currencies').select('*').eq('is_active', true); return data || []; },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('rfqs').insert({ title, category_id: categoryId || null, description, base_currency: baseCurrency, deadline_date: deadline, created_by: profile?.id, rfq_number: '' });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rfqs'] }); onOpenChange(false); toast.success('RFQ created'); setTitle(''); setDescription(''); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create New RFQ</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Category</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Base Currency</Label><Select value={baseCurrency} onValueChange={setBaseCurrency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Deadline</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
          </div>
          <Button onClick={() => createMutation.mutate()} className="w-full" disabled={!title || !deadline}>Create RFQ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
