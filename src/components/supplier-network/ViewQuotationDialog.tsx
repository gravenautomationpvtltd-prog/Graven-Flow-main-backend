import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award } from 'lucide-react';
import { AwardQuotationDialog } from './AwardQuotationDialog';

interface SupplierQuotation {
  id: string;
  quotation_number: string;
  status: string;
  quoted_currency: string;
  total_original: number;
  lead_time_days?: number | null;
  validity_days?: number | null;
  moq?: number | null;
  [key: string]: unknown;
}

interface Props { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  quotation: SupplierQuotation; 
}

export function ViewQuotationDialog({ open, onOpenChange, quotation }: Props) {
  const [awardOpen, setAwardOpen] = useState(false);
  const canAward = !['accepted', 'rejected', 'withdrawn'].includes(quotation.status);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quotation: {quotation.quotation_number}</DialogTitle>
            <DialogDescription>View quotation details and convert to Purchase Order</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-sm mt-4">
            <div><strong>Status:</strong> <Badge>{quotation.status}</Badge></div>
            <div><strong>Currency:</strong> {quotation.quoted_currency}</div>
            <div><strong>Amount:</strong> {quotation.total_original?.toLocaleString()}</div>
            <div><strong>Lead Time:</strong> {quotation.lead_time_days ? `${quotation.lead_time_days} days` : '-'}</div>
            <div><strong>MOQ:</strong> {quotation.moq || '-'}</div>
            <div><strong>Validity:</strong> {quotation.validity_days ? `${quotation.validity_days} days` : '-'}</div>
          </div>
          {canAward && (
            <DialogFooter className="mt-4">
              <Button
                onClick={() => { setAwardOpen(true); onOpenChange(false); }}
                className="bg-green-600 hover:bg-green-700"
              >
                <Award className="mr-2 h-4 w-4" />
                Award & Create PO
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AwardQuotationDialog
        open={awardOpen}
        onOpenChange={setAwardOpen}
        quotationId={quotation.id}
      />
    </>
  );
}
