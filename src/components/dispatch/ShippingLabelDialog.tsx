import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Tags, Loader2, Download, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { generateShippingLabelsPdf } from '@/lib/shipping-label-pdf';
import { useShippingLabel, useSaveShippingLabel } from '@/hooks/useShippingLabels';
import { downloadFile } from '@/lib/download-utils';
import type { Dispatch } from '@/hooks/useDispatches';

interface ShippingLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatch: Dispatch | null | undefined;
}

interface BoxDetail {
  weightKg: string;
  dimensionsCm: string;
}

interface FormState {
  companyName: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  boxes: string;
  boxDetails: BoxDetail[];
  invoiceNo: string;
  invoiceValue: string;
}

const emptyBox = (): BoxDetail => ({ weightKg: '', dimensionsCm: '' });

/** Latest invoice linked to the dispatch's sales order (for prefill). */
function useOrderInvoice(dispatchId: string | undefined, open: boolean) {
  return useQuery({
    queryKey: ['dispatch-order-invoice', dispatchId],
    enabled: open && !!dispatchId,
    queryFn: async () => {
      const { data: disp } = await supabase
        .from('dispatches')
        .select('sales_order_id')
        .eq('id', dispatchId!)
        .maybeSingle();
      const soId = (disp as any)?.sales_order_id as string | null | undefined;
      if (!soId) return null;
      const { data: invoice } = await supabase
        .from('invoices')
        .select('invoice_number, grand_total')
        .eq('sales_order_id', soId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return invoice as { invoice_number: string; grand_total: number | null } | null;
    },
    staleTime: 60_000,
  });
}

export function ShippingLabelDialog({ open, onOpenChange, dispatch }: ShippingLabelDialogProps) {
  const [form, setForm] = useState<FormState>({
    companyName: '',
    address: '',
    contactPerson: '',
    contactNumber: '',
    boxes: '1',
    boxDetails: [emptyBox()],
    invoiceNo: '',
    invoiceValue: '',
  });
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: invoice } = useOrderInvoice(dispatch?.id, open);
  const { data: saved, isLoading: loadingSaved } = useShippingLabel(dispatch?.id, open);
  const saveLabel = useSaveShippingLabel();

  const hasSaved = !!saved;
  const showForm = !hasSaved || editing;

  // Reset the view each time the dialog opens.
  useEffect(() => {
    if (open) setEditing(false);
  }, [open]);

  // Restore previously saved details when they exist.
  useEffect(() => {
    if (!open || !saved?.label_data) return;
    const d: any = saved.label_data;
    setForm({
      companyName: d.companyName ?? '',
      address: d.address ?? '',
      contactPerson: d.contactPerson ?? '',
      contactNumber: d.contactNumber ?? '',
      boxes: String(d.boxes ?? saved.box_count ?? 1),
      boxDetails:
        Array.isArray(d.boxDetails) && d.boxDetails.length
          ? d.boxDetails.map((b: any) => ({
              weightKg: b?.weightKg ?? '',
              dimensionsCm: b?.dimensionsCm ?? '',
            }))
          : [emptyBox()],
      invoiceNo: d.invoiceNo ?? '',
      invoiceValue: d.invoiceValue ?? '',
    });
  }, [open, saved]);

  // Prefill from the dispatch each time the dialog opens (only when nothing was saved).
  useEffect(() => {
    if (!open || !dispatch || loadingSaved || hasSaved) return;
    const c: any = (dispatch as any).customer;
    const address =
      dispatch.shipping_address ||
      [c?.address, c?.city, c?.state, c?.pincode].filter(Boolean).join(', ');

    const items: any[] = (dispatch.items as any[]) ?? [];
    let weight = 0;
    let hasWeight = false;
    let dims = '';
    for (const it of items) {
      if (it.unit_weight_kg != null) {
        hasWeight = true;
        weight += Number(it.unit_weight_kg) * Number(it.quantity ?? 0);
      }
      if (!dims && it.length_cm && it.width_cm && it.height_cm) {
        dims = `${it.length_cm}*${it.width_cm}*${it.height_cm}`;
      }
    }

    setForm((prev) => {
      const boxDetails = [...prev.boxDetails];
      boxDetails[0] = {
        weightKg: hasWeight ? String(Math.round(weight * 1000) / 1000) : '',
        dimensionsCm: dims,
      };
      return {
        ...prev,
        companyName: c?.company_name ?? '',
        address: address ?? '',
        contactPerson: c?.contact_person ?? '',
        contactNumber: c?.phone ?? '',
        boxDetails,
      };
    });
  }, [open, dispatch, loadingSaved, hasSaved]);

  // Prefill invoice fields once the linked invoice arrives (don't overwrite edits).
  useEffect(() => {
    if (!invoice || hasSaved) return;
    setForm((prev) => ({
      ...prev,
      invoiceNo: prev.invoiceNo || invoice.invoice_number || '',
      invoiceValue:
        prev.invoiceValue ||
        (invoice.grand_total != null ? String(invoice.grand_total) : ''),
    }));
  }, [invoice, hasSaved]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const count = Math.max(1, Math.min(200, Number(form.boxes) || 1));
  const sheets = Math.ceil(count / 4);

  // Keep one weight/dimensions row per box, preserving entries already typed.
  useEffect(() => {
    setForm((prev) => {
      if (prev.boxDetails.length === count) return prev;
      const next = prev.boxDetails.slice(0, count);
      while (next.length < count) next.push(emptyBox());
      return { ...prev, boxDetails: next };
    });
  }, [count]);

  const setBox = (index: number, key: keyof BoxDetail) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => {
      const boxDetails = prev.boxDetails.map((b, i) =>
        i === index ? { ...b, [key]: e.target.value } : b,
      );
      return { ...prev, boxDetails };
    });

  const handleGenerate = async () => {
    if (!dispatch) return;
    setGenerating(true);
    try {
      const { blob, fileName } = await generateShippingLabelsPdf(
        {
          companyName: form.companyName,
          address: form.address,
          contactPerson: form.contactPerson,
          contactNumber: form.contactNumber,
          invoiceNo: form.invoiceNo,
          invoiceValue: form.invoiceValue,
          weightKg: form.boxDetails[0]?.weightKg ?? '',
          dimensionsCm: form.boxDetails[0]?.dimensionsCm ?? '',
          boxes: form.boxDetails.slice(0, count),
          dispatchNumber: dispatch.dispatch_number,
        },
        count,
      );
      await saveLabel.mutateAsync({
        dispatchId: dispatch.id,
        blob,
        fileName,
        boxCount: count,
        labelData: { ...form, boxes: String(count), boxDetails: form.boxDetails.slice(0, count) },
      }).catch(() => undefined);
      onOpenChange(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadSaved = () => {
    if (!saved?.file_url) return;
    downloadFile(saved.file_url, saved.file_name || 'Shipping-Labels.pdf');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Shipping labels
          </DialogTitle>
          <DialogDescription>
            {showForm
              ? 'Four branded labels print on one A4 sheet with cut guides. Check and edit the details before printing — changes here only affect the printed labels.'
              : 'Labels were already made for this dispatch. Download the same file again, or edit the details to make a fresh set.'}
          </DialogDescription>
        </DialogHeader>

        {!showForm && saved && (
          <div className="space-y-3 rounded-md border p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Boxes</span>
              <span className="font-medium">{saved.box_count}</span>
            </div>
            {saved.label_data?.invoiceNo && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Invoice No.</span>
                <span className="font-medium">{saved.label_data.invoiceNo}</span>
              </div>
            )}
            {saved.label_data?.companyName && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ship to</span>
                <span className="text-right font-medium">{saved.label_data.companyName}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Created</span>
              <span className="text-right font-medium">
                {format(new Date(saved.generated_at), 'PPp')}
                {saved.generator?.full_name ? ` · ${saved.generator.full_name}` : ''}
              </span>
            </div>
          </div>
        )}

        {showForm && (
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1">

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="sl-company">Company name</Label>
            <Input id="sl-company" value={form.companyName} onChange={set('companyName')} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="sl-address">Shipping address</Label>
            <Textarea id="sl-address" rows={2} value={form.address} onChange={set('address')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sl-contact">Contact person</Label>
            <Input id="sl-contact" value={form.contactPerson} onChange={set('contactPerson')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sl-phone">Contact number</Label>
            <Input id="sl-phone" value={form.contactNumber} onChange={set('contactNumber')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sl-invoice">Invoice No.</Label>
            <Input id="sl-invoice" value={form.invoiceNo} onChange={set('invoiceNo')} placeholder="e.g. GA-INV26-0001" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sl-value">Invoice value</Label>
            <Input id="sl-value" value={form.invoiceValue} onChange={set('invoiceValue')} placeholder="e.g. 23456.87" />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="sl-boxes">Number of boxes</Label>
            <Input id="sl-boxes" type="number" min={1} max={200} value={form.boxes} onChange={set('boxes')} />
            <p className="text-sm text-muted-foreground">
              {count} label{count === 1 ? '' : 's'} on {sheets} A4 sheet{sheets === 1 ? '' : 's'}.
            </p>
          </div>

          {form.boxDetails.slice(0, count).map((box, i) => (
            <div key={i} className="col-span-2 grid grid-cols-2 gap-3 rounded-md border p-2.5">
              <p className="col-span-2 text-xs font-medium text-muted-foreground">Box {i + 1} of {count}</p>
              <div className="space-y-1.5">
                <Label htmlFor={`sl-weight-${i}`}>Weight (KG)</Label>
                <Input
                  id={`sl-weight-${i}`}
                  value={box.weightKg}
                  onChange={setBox(i, 'weightKg')}
                  placeholder="e.g. 2"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`sl-dims-${i}`}>Dimensions (CM)</Label>
                <Input
                  id={`sl-dims-${i}`}
                  value={box.dimensionsCm}
                  onChange={setBox(i, 'dimensionsCm')}
                  placeholder="e.g. 23*34*12"
                />
              </div>
            </div>
          ))}
        </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!showForm ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit details
              </Button>
              <Button onClick={handleDownloadSaved} disabled={!saved?.file_url}>
                <Download className="mr-2 h-4 w-4" />
                Download labels
              </Button>
            </>
          ) : (
            <Button onClick={handleGenerate} disabled={!dispatch || generating}>
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hasSaved ? 'Save & download' : 'Generate PDF'}
            </Button>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
