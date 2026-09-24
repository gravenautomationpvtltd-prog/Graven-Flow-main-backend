import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface Supplier {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  internal_rating?: number | null;
  preferred_flag?: boolean | null;
  [key: string]: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
}

export function SupplierDetailSheet({ open, onOpenChange, supplier }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px]">
        <SheetHeader><SheetTitle>{supplier.name}</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-4 text-sm">
          <div><strong>Email:</strong> {supplier.email || '-'}</div>
          <div><strong>Phone:</strong> {supplier.phone || '-'}</div>
          <div><strong>Country:</strong> {supplier.country || '-'}</div>
          <div><strong>Rating:</strong> {supplier.internal_rating || 0}/5</div>
          <div><strong>Preferred:</strong> {supplier.preferred_flag ? 'Yes' : 'No'}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
