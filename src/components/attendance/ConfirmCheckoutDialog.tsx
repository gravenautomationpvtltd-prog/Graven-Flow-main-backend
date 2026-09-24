import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hoursWorked: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmCheckoutDialog({
  open,
  onOpenChange,
  hoursWorked,
  onConfirm,
  isLoading = false,
}: ConfirmCheckoutDialogProps) {
  const safeHours = Number.isFinite(hoursWorked) ? hoursWorked : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm check out</DialogTitle>
          <DialogDescription>
            You&apos;re about to end your workday. Hours worked today: {safeHours.toFixed(1)}h.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            aria-label="Confirm check out"
          >
            Yes, check out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
