import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QuotationBuilder, type PrePopulatedItem } from './QuotationBuilder';
import type { QuotationItem } from '@/hooks/useQuotations';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuotation } from '@/hooks/useQuotations';
import { Loader2 } from 'lucide-react';

interface CreateQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  prePopulatedItems?: PrePopulatedItem[];
  existingDraftId?: string; // ID of an existing draft to continue editing
  duplicateFromId?: string; // ID of a quotation to copy into a brand-new quotation
  itemsOverride?: QuotationItem[]; // explicit line items (partial duplication)
}

export function CreateQuotationDialog({
  open,
  onOpenChange,
  leadId,
  customerId,
  customerName,
  customerPhone,
  customerEmail,
  prePopulatedItems,
  existingDraftId,
  duplicateFromId,
  itemsOverride,
}: CreateQuotationDialogProps) {
  // Fetch existing draft data if provided
  const { data: existingDraft, isLoading: isDraftLoading } = useQuotation(existingDraftId);
  // Fetch source quotation when duplicating
  const { data: duplicateSource, isLoading: isSourceLoading } = useQuotation(duplicateFromId);

  const handleSuccess = () => {
    onOpenChange(false);
  };

  // Determine if we're continuing a draft
  const isContinuingDraft = !!existingDraftId && !!existingDraft;
  const isLoadingSource = (!!existingDraftId && isDraftLoading) || (!!duplicateFromId && isSourceLoading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="sr-only">
            {duplicateFromId ? 'Duplicate Quotation' : isContinuingDraft ? 'Continue Quotation' : 'Create Quotation'}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-60px)] px-6 pb-6">
          {isLoadingSource ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                {duplicateFromId ? 'Loading quotation to copy...' : 'Loading draft...'}
              </span>
            </div>
          ) : (
            <QuotationBuilder
              key={`${duplicateFromId || existingDraftId || 'new'}-${customerId || ''}-${itemsOverride?.length ?? 0}`}
              leadId={leadId}
              customerId={customerId}
              customerName={customerName}
              customerPhone={customerPhone}
              customerEmail={customerEmail}
              prePopulatedItems={prePopulatedItems}
              existingQuotation={isContinuingDraft ? existingDraft : undefined}
              existingDraftId={existingDraftId}
              duplicateSource={duplicateFromId ? duplicateSource : undefined}
              itemsOverride={itemsOverride}
              onSuccess={handleSuccess}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
