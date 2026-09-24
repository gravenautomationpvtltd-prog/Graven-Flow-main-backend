import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { exportRFQToExcel, exportRFQToPDF } from '@/lib/rfq-export';

interface RFQWithStats {
  id: string;
  rfq_number: string;
  title: string;
  status: string;
  base_currency: string;
  deadline_date: string;
  distributions_count: number;
  description?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  department?: string | null;
  commercial_terms?: string | null;
  [key: string]: unknown;
}

interface Props { open: boolean; onOpenChange: (open: boolean) => void; rfq: RFQWithStats; }

export function ViewRFQDialog({ open, onOpenChange, rfq }: Props) {
  const { data: items = [] } = useQuery({
    queryKey: ['rfq-items', rfq.id],
    queryFn: async () => {
      const { data } = await supabase.from('rfq_items').select('*').eq('rfq_id', rfq.id).order('sort_order');
      return data || [];
    },
    enabled: open,
  });

  const exportItems = items.map(i => ({ ...i, specifications: i.specifications as Record<string, string> | null }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{rfq.rfq_number}: {rfq.title}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm mt-4">
          <div><strong>Status:</strong> <Badge>{rfq.status}</Badge></div>
          <div><strong>Currency:</strong> {rfq.base_currency}</div>
          <div><strong>Deadline:</strong> {format(new Date(rfq.deadline_date), 'MMM dd, yyyy')}</div>
          <div><strong>Suppliers:</strong> {rfq.distributions_count}</div>
          {rfq.project_name && <div><strong>Project:</strong> {rfq.project_name}</div>}
          {rfq.department && <div><strong>Department:</strong> {rfq.department}</div>}
          <div className="col-span-2"><strong>Description:</strong><p className="mt-1">{rfq.description || 'No description'}</p></div>
        </div>

        {items.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Line Items ({items.length})</h4>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">SR</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-16">Qty</TableHead>
                    <TableHead className="w-16">Unit</TableHead>
                    <TableHead className="w-24">Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit || 'Nos'}</TableCell>
                      <TableCell>{item.target_price != null ? `${rfq.base_currency} ${item.target_price}` : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => exportRFQToExcel(rfq, exportItems)}>
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportRFQToPDF(rfq, exportItems)}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
