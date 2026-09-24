import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

export function QuotationComparisonPanel({ open, onOpenChange }: Props) {
  const { data: quotations = [] } = useQuery({
    queryKey: ['quotations-comparison'],
    queryFn: async () => { const { data } = await supabase.from('supplier_quotations').select('*, suppliers(name), rfqs(rfq_number, base_currency)').order('total_converted', { ascending: true }); return data || []; },
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[800px] sm:max-w-[800px]">
        <SheetHeader><SheetTitle>Quotation Comparison</SheetTitle></SheetHeader>
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>RFQ</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((q: Record<string, unknown>) => (
                <TableRow key={q.id as string}>
                  <TableCell>{(q.suppliers as Record<string, unknown>)?.name as string}</TableCell>
                  <TableCell>{(q.rfqs as Record<string, unknown>)?.rfq_number as string}</TableCell>
                  <TableCell>{(q.total_original as number)?.toLocaleString()} {q.quoted_currency as string}</TableCell>
                  <TableCell>{q.lead_time_days as number} days</TableCell>
                  <TableCell>{q.status as string}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}
