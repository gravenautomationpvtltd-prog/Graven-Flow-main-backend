import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';

interface OrderFiltersProps {
  filters: {
    search: string;
    status: string;
    paymentStatus: string;
    salesRep: string;
  };
  onFiltersChange: (filters: OrderFiltersProps['filters']) => void;
}

export function OrderFilters({ filters, onFiltersChange }: OrderFiltersProps) {
  const { isManager, isAdmin } = useAuth();
  const { data: profiles } = useProfiles();

  const salesProfiles = profiles?.filter(p => p.is_active) || [];

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search orders..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      <Select
        value={filters.status}
        onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="pending_documents">Pending Documents</SelectItem>
          <SelectItem value="ready_for_procurement">Ready for Procurement</SelectItem>
          <SelectItem value="in_procurement">In Procurement</SelectItem>
          <SelectItem value="partially_fulfilled">Partially Fulfilled</SelectItem>
          <SelectItem value="fulfilled">Fulfilled</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          <SelectItem value="postponed">Postponed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.paymentStatus}
        onValueChange={(value) => onFiltersChange({ ...filters, paymentStatus: value })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Payment Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Payments</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="partial">Partial</SelectItem>
          <SelectItem value="received">Received</SelectItem>
        </SelectContent>
      </Select>

      {(isManager || isAdmin) && (
        <Select
          value={filters.salesRep}
          onValueChange={(value) => onFiltersChange({ ...filters, salesRep: value })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Sales Reps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sales Reps</SelectItem>
            {salesProfiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
