import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuotationBuilder } from './QuotationBuilder';
import { QuotationWithDetails } from '@/hooks/useQuotations';

interface EditQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationWithDetails | null;
  onSuccess?: () => void;
}

export function EditQuotationDialog({
  open,
  onOpenChange,
  quotation,
  onSuccess,
}: EditQuotationDialogProps) {
  if (!quotation) return null;

  const handleSuccess = () => {
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quotation - {quotation.quotation_number}</DialogTitle>
        </DialogHeader>
        <QuotationBuilder
          leadId={quotation.lead_id || undefined}
          customerId={quotation.customer_id || undefined}
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
