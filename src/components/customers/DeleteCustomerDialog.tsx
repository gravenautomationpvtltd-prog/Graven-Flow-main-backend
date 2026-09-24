import { useDeleteCustomer } from '@/hooks/useCustomers';
import type { Database } from '@/integrations/supabase/types';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';

type Customer = Database['public']['Tables']['customers']['Row'];

interface DeleteCustomerDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteCustomerDialog({ customer, open, onOpenChange }: DeleteCustomerDialogProps) {
  const deleteCustomer = useDeleteCustomer();

  const handleDelete = async () => {
    if (!customer) return;
    await deleteCustomer.mutateAsync(customer.id);
    onOpenChange(false);
  };

  return (
    <DoubleConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={handleDelete}
      title="Delete Customer"
      description="This will permanently delete this customer and remove all associated data including leads, orders, and payments."
      itemDetails={customer && (
        <>
          <p><strong>Company:</strong> {customer.company_name}</p>
          <p><strong>Contact:</strong> {customer.contact_person || '-'}</p>
          <p><strong>Phone:</strong> {customer.phone}</p>
        </>
      )}
      isLoading={deleteCustomer.isPending}
    />
  );
}