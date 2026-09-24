import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { safeInsertLead } from '@/hooks/useLeads';

interface Item {
  product_query_text: string;
  quantity: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: string;
  customerName: string;
  assignedSalesId: string | null;
}

export function RepeatEnquiryDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  assignedSalesId,
}: Props) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState(`Repeat enquiry · ${customerName}`);
  const [items, setItems] = useState<Item[]>([
    { product_query_text: '', quantity: '1', notes: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const addItem = () =>
    setItems((prev) => [...prev, { product_query_text: '', quantity: '1', notes: '' }]);
  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    const valid = items.filter((i) => i.product_query_text.trim());
    if (!valid.length) {
      toast.error('Add at least one product');
      return;
    }
    if (!user?.id) return;

    setSaving(true);
    try {
      // Resolve tenant_id from customer
      const { data: cust } = await supabase
        .from('customers')
        .select('tenant_id')
        .eq('id', customerId)
        .maybeSingle();

      const lead = await safeInsertLead({
        title,
        customer_id: customerId,
        tenant_id: (cust as any)?.tenant_id || null,
        source: 'cst_repeat',
        status: 'new',
        has_enquiry: true,
        enquiry_status: 'pending_prices',
        // Never assign to the CST user. Use loyal owner if any; otherwise let DB trigger handle round-robin.
        assigned_to: assignedSalesId ?? null,
      });

      // Insert enquiry items (triggers will auto-check pricing + create price requests)
      const itemsToInsert = valid.map((it, idx) => ({
        lead_id: (lead as any).id,
        product_query_text: it.product_query_text.trim(),
        quantity: parseFloat(it.quantity) || 1,
        notes: it.notes || null,
        sort_order: idx,
      }));
      const { error: iErr } = await supabase.from('enquiry_items').insert(itemsToInsert);
      if (iErr) throw iErr;

      // Create lead_qualification handoff row → fires reassignment trigger (loyalty enforced)
      // and makes lead visible in SPT inbox per universal-landing-zone rule.
      // History-mode: insert a new row per attempt; latest row reflects current routing.
      const { error: qErr } = await supabase
        .from('lead_qualification' as any)
        .insert({
          lead_id: (lead as any).id,
          tenant_id: (cust as any)?.tenant_id || null,
          qualification_type: 'simple',
          routed_to: 'spt',
          qualified_by: user.id,
          qualified_at: new Date().toISOString(),
          decision_reason: 'CST repeat enquiry',
        });
      if (qErr) console.error('lead_qualification insert failed:', qErr);

      toast.success('Repeat enquiry created and routed to sales');
      onOpenChange(false);
      navigate(`/leads/${(lead as any).id}`);
    } catch (e: any) {
      const lower = (e?.message || '').toLowerCase();
      if (lower.includes('no_organization')) {
        toast.error("Your account isn't fully set up yet. Please refresh the page or contact your admin.");
      } else if (lower.includes('permission') || lower.includes('row-level') || lower.includes('jwt') || lower.includes('session')) {
        toast.error('We hit a temporary issue creating this enquiry. Please refresh and try again — your data is safe.');
      } else {
        toast.error("Couldn't create the enquiry right now. Please try again in a moment.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Repeat Enquiry</DialogTitle>
          <DialogDescription>
            Skips lead qualification — routes straight to sales for {customerName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Enquiry title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                  <Input
                    className="col-span-6"
                    placeholder="Product / query"
                    value={it.product_query_text}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, i) =>
                          i === idx ? { ...x, product_query_text: e.target.value } : x
                        )
                      )
                    }
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    placeholder="Qty"
                    value={it.quantity}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x))
                      )
                    }
                  />
                  <Textarea
                    className="col-span-3"
                    placeholder="Notes"
                    rows={1}
                    value={it.notes}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x))
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Create & Route to Sales
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
