import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, MoreHorizontal, Eye, Star, Ban, RefreshCw, Tags, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { AssignCategoriesDialog } from '@/components/supplier-network/AssignCategoriesDialog';
import { SupplierDetailSheet } from '@/components/supplier-network/SupplierDetailSheet';
import { SuspendSupplierDialog } from '@/components/supplier-network/SuspendSupplierDialog';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  internal_rating: number | null;
  preferred_flag: boolean | null;
  is_active: boolean | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  manufacturing_type: string | null;
  years_in_operation: number | null;
  [key: string]: unknown;
}

interface SupplierCategory {
  id: string;
  name: string;
}

export default function ApprovedSuppliers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['approved-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('application_status', 'approved')
        .order('name');
      
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['supplier-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as SupplierCategory[];
    },
  });

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('code, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const updateRatingMutation = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number }) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ internal_rating: rating })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approved-suppliers'] });
      toast.success('Rating updated');
    },
    onError: () => {
      toast.error('Failed to update rating');
    },
  });

  const togglePreferredMutation = useMutation({
    mutationFn: async ({ id, preferred }: { id: string; preferred: boolean }) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ preferred_flag: preferred })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approved-suppliers'] });
      toast.success('Preferred status updated');
    },
    onError: () => {
      toast.error('Failed to update preferred status');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ 
          is_active: true, 
          suspended_at: null, 
          suspension_reason: null 
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approved-suppliers'] });
      toast.success('Supplier reactivated');
    },
    onError: () => {
      toast.error('Failed to reactivate supplier');
    },
  });

  const getFilteredSuppliers = () => {
    let filtered = suppliers;
    
    if (countryFilter !== 'all') {
      filtered = filtered.filter(s => s.country === countryFilter);
    }
    
    if (ratingFilter !== 'all') {
      const minRating = parseFloat(ratingFilter);
      filtered = filtered.filter(s => (s.internal_rating || 0) >= minRating);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.city?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const renderRating = (rating: number | null) => {
    const value = rating || 0;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        <span className="ml-1 text-sm text-muted-foreground">({value.toFixed(1)})</span>
      </div>
    );
  };

  const filteredSuppliers = getFilteredSuppliers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approved Suppliers</h1>
          <p className="text-muted-foreground">Manage approved suppliers, categories, and RFQ eligibility</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-sm text-muted-foreground">Total Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{suppliers.filter(s => s.preferred_flag).length}</div>
            <p className="text-sm text-muted-foreground">Preferred Suppliers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{suppliers.filter(s => s.is_active !== false).length}</div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{suppliers.filter(s => s.suspended_at).length}</div>
            <p className="text-sm text-muted-foreground">Suspended</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Suppliers</CardTitle>
              <CardDescription>Approved suppliers eligible for RFQs</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[150px]">
                  <Globe className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-[130px]">
                  <Star className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="4">4+ Stars</SelectItem>
                  <SelectItem value="3">3+ Stars</SelectItem>
                  <SelectItem value="2">2+ Stars</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search suppliers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preferred</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading suppliers...
                    </TableCell>
                  </TableRow>
                ) : filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No approved suppliers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow 
                      key={supplier.id} 
                      className={`cursor-pointer hover:bg-muted/50 ${supplier.suspended_at ? 'opacity-60' : ''}`}
                      onClick={() => navigate(`/supplier-network/suppliers/${supplier.id}`)}
                    >
                      <TableCell className="font-medium">
                        {supplier.name}
                        {supplier.preferred_flag && (
                          <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">
                            Preferred
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{supplier.country || '-'}</TableCell>
                      <TableCell className="capitalize">{supplier.manufacturing_type || '-'}</TableCell>
                      <TableCell>
                        <Select
                          value={supplier.internal_rating?.toString() || '0'}
                          onValueChange={(value) => updateRatingMutation.mutate({ id: supplier.id, rating: parseFloat(value) })}
                        >
                          <SelectTrigger className="w-[100px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((r) => (
                              <SelectItem key={r} value={r.toString()}>
                                {r} Star{r > 1 ? 's' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {supplier.suspended_at ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={supplier.preferred_flag ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => togglePreferredMutation.mutate({ id: supplier.id, preferred: !supplier.preferred_flag })}
                        >
                          <Star className={`h-4 w-4 ${supplier.preferred_flag ? 'fill-current' : ''}`} />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedSupplier(supplier); setDetailSheetOpen(true); }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedSupplier(supplier); setCategoriesDialogOpen(true); }}>
                              <Tags className="mr-2 h-4 w-4" />
                              Assign Categories
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {supplier.suspended_at ? (
                              <DropdownMenuItem onClick={() => reactivateMutation.mutate(supplier.id)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => { setSelectedSupplier(supplier); setSuspendDialogOpen(true); }}
                                className="text-destructive"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedSupplier && (
        <>
          <AssignCategoriesDialog
            open={categoriesDialogOpen}
            onOpenChange={setCategoriesDialogOpen}
            supplier={selectedSupplier}
            categories={categories}
          />
          <SupplierDetailSheet
            open={detailSheetOpen}
            onOpenChange={setDetailSheetOpen}
            supplier={selectedSupplier}
          />
          <SuspendSupplierDialog
            open={suspendDialogOpen}
            onOpenChange={setSuspendDialogOpen}
            supplier={selectedSupplier}
          />
        </>
      )}
    </div>
  );
}
