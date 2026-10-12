import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LeadSourceBadge } from '@/components/leads/LeadSourceBadge';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { useDeleteLqtLead } from '@/hooks/useDeleteLqtLead';
import type { LqtLead } from '@/hooks/useLqtLeads';

interface DeleteLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LqtLead | null;
  onDeleted?: () => void;
}

export function DeleteLeadDialog({
  open,
  onOpenChange,
  lead,
  onDeleted,
}: DeleteLeadDialogProps) {
  const { deleteLead, isDeleting } = useDeleteLqtLead();

  if (!lead) return null;

  const customerName = lead.customer?.company_name || lead.customer?.contact_person || lead.title || 'Unnamed Lead';
  const source = lead.source || 'manual';

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!lead?.id || isDeleting) return;

    try {
      await deleteLead(lead.id);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      // Error handling is handled in useDeleteLqtLead toast, modal stays open
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(val) => !isDeleting && onOpenChange(val)}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">Delete Lead?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2 text-left">
            <div className="p-3 bg-muted/50 rounded-lg border text-sm space-y-1.5">
              <div className="flex justify-between items-start gap-2">
                <span className="font-semibold text-foreground truncate">{customerName}</span>
                <LeadSourceBadge source={source} />
              </div>
              {lead.customer_query && (
                <p className="text-xs text-muted-foreground line-clamp-2 italic">
                  "{lead.customer_query}"
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted text-muted-foreground rounded-lg border text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>This lead will be moved to trash. An administrator can restore it from the Deleted Leads section if needed.</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="pt-2">
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
