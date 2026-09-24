import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

export function SubmitQuotationDialog({ open, onOpenChange }: Props) {
  const [rfqId, setRfqId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [amount, setAmount] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: rfqs = [] } = useQuery({ queryKey: ['active-rfqs'], queryFn: async () => { const { data } = await supabase.from('rfqs').select('id, rfq_number, title').in('status', ['issued', 'responses_received']); return data || []; }, enabled: open });
  const { data: suppliers = [] } = useQuery({ queryKey: ['approved-suppliers-list'], queryFn: async () => { const { data } = await supabase.from('suppliers').select('id, name').eq('application_status', 'approved'); return data || []; }, enabled: open });
  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: async () => { const { data } = await supabase.from('currencies').select('*'); return data || []; }, enabled: open });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('supplier_quotations').insert({ rfq_id: rfqId, supplier_id: supplierId, quoted_currency: currency, total_original: parseFloat(amount), lead_time_days: parseInt(leadTime) || null, submitted_by: profile?.id, quotation_number: '' });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplier-quotations'] }); onOpenChange(false); toast.success('Quotation submitted'); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Enter Supplier Quotation</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>RFQ</Label><Select value={rfqId} onValueChange={setRfqId}><SelectTrigger><SelectValue placeholder="Select RFQ..." /></SelectTrigger><SelectContent>{rfqs.map(r => <SelectItem key={r.id} value={r.id}>{r.rfq_number}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Supplier</Label><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Currency</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
          <div><Label>Lead Time (days)</Label><Input type="number" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} /></div>
          <Button onClick={() => submitMutation.mutate()} className="w-full" disabled={!rfqId || !supplierId || !amount}>Submit Quotation</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
