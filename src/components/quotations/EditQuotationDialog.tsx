import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuotationBuilder } from './QuotationBuilder';
import { QuotationWithDetails } from '@/hooks/useQuotations';

interface EditQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationWithDetails | null;
  leadId?: string;
  customerId?: string;
  onSuccess?: () => void;
}

export function EditQuotationDialog({
  open,
  onOpenChange,
  quotation,
  leadId,
  customerId,
  onSuccess,
}: EditQuotationDialogProps) {
  if (!quotation) return null;

  const handleSuccess = () => {
    onSuccess?.();
    onOpenChange(false);
  };

  const effectiveLeadId = leadId || quotation.lead_id || undefined;
  const effectiveCustomerId = customerId || quotation.customer_id || undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quotation - {quotation.quotation_number}</DialogTitle>
        </DialogHeader>
        <QuotationBuilder
          leadId={effectiveLeadId}
          customerId={effectiveCustomerId}
          customerName={quotation.customer?.company_name}
          customerPhone={quotation.customer?.phone}
          customerEmail={quotation.customer?.email}
          existingQuotation={quotation}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
