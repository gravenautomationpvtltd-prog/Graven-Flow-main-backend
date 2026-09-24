import { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/lib/i18n';

interface DoubleConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemDetails?: React.ReactNode;
  isLoading?: boolean;
}

export function DoubleConfirmDeleteDialog({ open, onOpenChange, onConfirm, title, description, itemDetails, isLoading = false }: DoubleConfirmDeleteDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');
  const { t } = useTranslation();

  const handleClose = () => { setStep(1); setConfirmText(''); onOpenChange(false); };
  const handleFirstConfirm = () => setStep(2);
  const handleFinalConfirm = () => { if (confirmText.toUpperCase() === 'DELETE') { onConfirm(); handleClose(); } };
  const isDeleteValid = confirmText.toUpperCase() === 'DELETE';

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <span className="text-xl">⚠️</span> {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left">{description}</AlertDialogDescription>
            </AlertDialogHeader>
            {itemDetails && <div className="my-4 p-3 bg-muted rounded-md text-sm space-y-1">{itemDetails}</div>}
            <p className="text-sm text-muted-foreground">{t('delete.cannot_undo', 'This action cannot be undone.')}</p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>{t('delete.cancel', 'Cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); handleFirstConfirm(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoading}>
                {t('delete.yes_delete', 'Yes, Delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <span className="text-xl">🛑</span> {t('delete.final_confirmation', 'Final Confirmation Required')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left">{t('delete.final_desc', 'You are about to permanently delete this item. This is irreversible.')}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4 space-y-3">
              <Label htmlFor="confirm-delete" className="text-sm font-medium">
                {t('delete.type_delete', 'Type DELETE below to confirm:')}
              </Label>
              <Input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={t('delete.type_placeholder', 'Type DELETE to confirm')} className="font-mono" autoFocus disabled={isLoading} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStep(1)} disabled={isLoading}>{t('delete.back', 'Back')}</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); handleFinalConfirm(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={!isDeleteValid || isLoading}>
                {isLoading ? t('delete.deleting', 'Deleting...') : t('delete.confirm_delete', 'Confirm Delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
