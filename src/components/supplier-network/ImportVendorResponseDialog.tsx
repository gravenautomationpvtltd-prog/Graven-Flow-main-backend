import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseVendorResponse, type ParsedVendorRow } from '@/lib/rfq-import';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfqId: string;
}

export function ImportVendorResponseDialog({ open, onOpenChange, rfqId }: Props) {
  const [parsedRows, setParsedRows] = useState<ParsedVendorRow[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [fileName, setFileName] = useState('');
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['approved-suppliers-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('application_status', 'approved')
        .order('name');
      return data || [];
    },
  });

  const { data: rfqItems = [] } = useQuery({
    queryKey: ['rfq-items', rfqId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rfq_items')
        .select('*')
        .eq('rfq_id', rfqId)
        .order('sort_order');
      return data || [];
    },
    enabled: !!rfqId,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const result = await parseVendorResponse(file);
      if (result.errors.length > 0) toast.error(result.errors.join(', '));
      setParsedRows(result.rows);
    } catch {
      toast.error('Failed to parse file');
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error('Select a supplier');

      const totalAmount = parsedRows.reduce((sum, r) => {
        const rfqItem = rfqItems[r.srNo - 1];
        return sum + (r.totalPrice || (r.unitPrice || 0) * (rfqItem?.quantity || 1));
      }, 0);

      const maxDelivery = Math.max(...parsedRows.filter(r => r.deliveryDays).map(r => r.deliveryDays!), 0);

      const { data: sq, error: sqError } = await supabase
        .from('supplier_quotations')
        .insert({
          supplier_id: supplierId,
          rfq_id: rfqId,
          status: 'submitted',
          quotation_number: '',
          quoted_currency: 'INR',
          total_original: totalAmount,
          lead_time_days: maxDelivery || null,
        })
        .select('id')
        .single();

      if (sqError) throw sqError;

      const sqItems = parsedRows
        .map((row) => {
          const rfqItem = rfqItems[row.srNo - 1];
          if (!rfqItem) return null;
          const unitPrice = row.unitPrice || 0;
          const total = row.totalPrice || unitPrice * rfqItem.quantity;
          return {
            quotation_id: sq.id,
            rfq_item_id: rfqItem.id,
            product_id: rfqItem.product_id,
            description: row.description || rfqItem.description,
            quantity: rfqItem.quantity,
            unit_price_original: unitPrice,
            total_original: total,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (sqItems.length > 0) {
        const { error } = await supabase.from('supplier_quotation_items').insert(sqItems);
        if (error) throw error;
      }

      // Update RFQ distribution if exists
      const { data: dist } = await supabase
        .from('rfq_distributions')
        .select('id')
        .eq('rfq_id', rfqId)
        .eq('supplier_id', supplierId)
        .maybeSingle();

      if (dist) {
        await supabase.from('rfq_distributions').update({ response_status: 'quoted' }).eq('id', dist.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-quotations'] });
      toast.success('Vendor response imported successfully');
      onOpenChange(false);
      setParsedRows([]);
      setSupplierId('');
      setFileName('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Import failed');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import Vendor Response</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Upload Excel Response</Label>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="mt-1" />
          </div>
          {parsedRows.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SR</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.srNo}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
                      <TableCell>{row.unitPrice ?? '-'}</TableCell>
                      <TableCell>{row.totalPrice ?? '-'}</TableCell>
                      <TableCell>{row.deliveryDays ?? '-'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{row.remarks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => importMutation.mutate()} disabled={!supplierId || parsedRows.length === 0 || importMutation.isPending}>
              <Upload className="h-4 w-4 mr-1" />
              {importMutation.isPending ? 'Importing...' : 'Import Response'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
