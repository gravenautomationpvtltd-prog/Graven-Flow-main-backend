import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Supplier {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  manufacturing_type?: string | null;
  years_in_operation?: number | null;
  [key: string]: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
}

export function ViewSupplierApplicationDialog({ open, onOpenChange, supplier }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Supplier Details: {supplier.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Email:</strong> {supplier.email || '-'}</div>
          <div><strong>Phone:</strong> {supplier.phone || '-'}</div>
          <div><strong>Country:</strong> {supplier.country || '-'}</div>
          <div><strong>City:</strong> {supplier.city || '-'}</div>
          <div><strong>Type:</strong> {supplier.manufacturing_type || '-'}</div>
          <div><strong>Years:</strong> {supplier.years_in_operation || '-'}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
