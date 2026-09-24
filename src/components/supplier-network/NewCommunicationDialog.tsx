import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; suppliers: { id: string; name: string }[]; }

export function NewCommunicationDialog({ open, onOpenChange, suppliers }: Props) {
  const [supplierId, setSupplierId] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [messageType, setMessageType] = useState('message');
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('supplier_communications').insert({ supplier_id: supplierId, subject, content, message_type: messageType, sent_by: profile?.id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplier-communications'] }); onOpenChange(false); toast.success('Message sent'); setSubject(''); setContent(''); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Message</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Supplier</Label><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Type</Label><Select value={messageType} onValueChange={setMessageType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="message">Message</SelectItem><SelectItem value="clarification">Clarification</SelectItem><SelectItem value="negotiation">Negotiation</SelectItem></SelectContent></Select></div>
          <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div><Label>Message</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} /></div>
          <Button onClick={() => sendMutation.mutate()} className="w-full" disabled={!supplierId || !content}>Send</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
