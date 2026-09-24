import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';

interface CustomerFiltersProps {
  filters: {
    search: string;
    customerType: string;
    assignedTo: string;
    outreachStatus: string;
    segment: string;
  };
  onFiltersChange: (filters: CustomerFiltersProps['filters']) => void;
}

export function CustomerFilters({ filters, onFiltersChange }: CustomerFiltersProps) {
  const { data: profiles } = useProfiles();
  const { isManager, isAdmin } = useAuth();

  const updateFilter = (key: keyof typeof filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-wrap gap-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by company, contact, or phone..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-10"
        />
      </div>

      <Select value={filters.customerType} onValueChange={(value) => updateFilter('customerType', value)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Customer Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="b2b">B2B Only</SelectItem>
          <SelectItem value="b2c">B2C Only</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.outreachStatus} onValueChange={(value) => updateFilter('outreachStatus', value)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Outreach Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Outreach</SelectItem>
          <SelectItem value="never">Never Contacted</SelectItem>
          <SelectItem value="30">Not in 30 days</SelectItem>
          <SelectItem value="60">Not in 60 days</SelectItem>
          <SelectItem value="90">Not in 90 days</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.segment} onValueChange={(value) => updateFilter('segment', value)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Segment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Segments</SelectItem>
          <SelectItem value="platinum">Platinum</SelectItem>
          <SelectItem value="gold">Gold</SelectItem>
          <SelectItem value="silver">Silver</SelectItem>
          <SelectItem value="bronze">Bronze</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {(isManager || isAdmin) && (
        <Select value={filters.assignedTo} onValueChange={(value) => updateFilter('assignedTo', value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Assigned To" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sales Reps</SelectItem>
            {profiles?.map((profile) => (
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
