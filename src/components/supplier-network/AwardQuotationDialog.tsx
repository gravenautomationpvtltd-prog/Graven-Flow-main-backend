import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Award, ArrowRight, Package, Loader2 } from 'lucide-react';
import { useCreatePOFromQuotation } from '@/hooks/usePurchaseOrders';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';

interface AwardQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
}

interface QuotationItem {
  id: string;
  description: string;
  quantity: number;
  unit_price_original: number;
  unit_price_converted: number | null;
  product_id: string | null;
  total_original: number;
}

export function AwardQuotationDialog({ open, onOpenChange, quotationId }: AwardQuotationDialogProps) {
  const navigate = useNavigate();
  const createPOFromQuotation = useCreatePOFromQuotation();

  const { data: quotation, isLoading } = useQuery({
    queryKey: ['supplier-quotation-detail', quotationId],
    enabled: open && !!quotationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_quotations')
        .select(`
          *,
          suppliers(id, name, country),
          rfqs(id, rfq_number, title, base_currency),
          supplier_quotation_items(*)
        `)
        .eq('id', quotationId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const [items, setItems] = useState<Array<{
    description: string;
    quantity: number;
    rate: number;
    tax_percent: number;
    product_id: string | null;
    hsn_code: string | null;
  }>>([]);
  const [notes, setNotes] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');

  useEffect(() => {
    if (quotation) {
      const qItems = (quotation.supplier_quotation_items as QuotationItem[]) || [];
      setItems(qItems.map(item => ({
        description: item.description || '',
        quantity: item.quantity || 1,
        rate: item.unit_price_converted ?? item.unit_price_original ?? 0,
        tax_percent: 18,
        product_id: item.product_id,
        hsn_code: null,
      })));

      const rfq = quotation.rfqs as { rfq_number: string; title: string } | null;
      setNotes(`Converted from RFQ ${rfq?.rfq_number || ''} / Quotation ${quotation.quotation_number}${quotation.payment_terms ? `\nPayment Terms: ${quotation.payment_terms}` : ''}`);

      if (quotation.lead_time_days) {
        setExpectedDelivery(format(addDays(new Date(), quotation.lead_time_days), 'yyyy-MM-dd'));
      }
    }
  }, [quotation]);

  const updateItem = (index: number, field: string, value: number | string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const totalTax = items.reduce((sum, item) => sum + (item.quantity * item.rate * item.tax_percent / 100), 0);
  const grandTotal = subtotal + totalTax;

  const handleConfirm = async () => {
    if (!quotation) return;

    const supplier = quotation.suppliers as { id: string } | null;
    
    createPOFromQuotation.mutate({
      quotationId: quotation.id,
      rfqId: quotation.rfq_id,
      poData: {
        supplier_id: supplier?.id || null,
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery: expectedDelivery || null,
        notes,
        currency: quotation.quoted_currency,
        exchange_rate: quotation.fx_rate_to_base,
        items: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          tax_percent: item.tax_percent,
          tax_amount: (item.quantity * item.rate * item.tax_percent) / 100,
          amount: item.quantity * item.rate + (item.quantity * item.rate * item.tax_percent) / 100,
          product_id: item.product_id,
          hsn_code: item.hsn_code,
          received_quantity: 0,
          sort_order: 0,
        })),
      },
    }, {
      onSuccess: () => {
        onOpenChange(false);
        navigate('/procurement');
      },
    });
  };

  const rfq = quotation?.rfqs as { rfq_number: string; title: string; base_currency: string } | null;
  const supplier = quotation?.suppliers as { name: string; country: string | null } | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-green-600" />
            Award Quotation & Create Purchase Order
          </DialogTitle>
          <DialogDescription>
            Review the details below and confirm to create a Purchase Order from this quotation.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : quotation ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Source info */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Quotation</p>
                <Badge variant="outline" className="font-mono">{quotation.quotation_number}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">RFQ</p>
                <Badge variant="secondary" className="font-mono">{rfq?.rfq_number}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Supplier</p>
                <p className="font-medium">{supplier?.name}</p>
              </div>
            </div>

            <Separator />

            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Delivery</Label>
                <Input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={quotation.quoted_currency || 'INR'} disabled />
              </div>
            </div>

            {/* Line items */}
            <div>
              <Label className="mb-2 block">Line Items</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-20">Qty</TableHead>
                      <TableHead className="text-right w-28">Rate</TableHead>
                      <TableHead className="text-right w-20">Tax %</TableHead>
                      <TableHead className="text-right w-28">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(index, 'rate', Number(e.target.value))}
                            className="h-8 text-right"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.tax_percent}
                            onChange={(e) => updateItem(index, 'tax_percent', Number(e.target.value))}
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{(item.quantity * item.rate * (1 + item.tax_percent / 100)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>₹{totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base border-t pt-1">
                  <span>Grand Total:</span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={createPOFromQuotation.isPending || items.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {createPOFromQuotation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Award & Create PO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
