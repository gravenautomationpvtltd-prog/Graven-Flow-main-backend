import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, Copy, Eye, CheckCircle, XCircle, Clock, Star, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useSuppliersByStatus, useDeleteSupplier, Supplier, usePendingVendors } from '@/hooks/useSuppliers';
import { SupplierDialog } from './SupplierDialog';
import { ReviewVendorDialog } from './ReviewVendorDialog';
import { SupplierRatingBadge } from './SupplierRatingBadge';
import { RateSupplierDialog } from './RateSupplierDialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';

export function SuppliersManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [vendorToReview, setVendorToReview] = useState<Supplier | null>(null);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [supplierToRate, setSupplierToRate] = useState<Supplier | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const { data: allSuppliers = [], isLoading: loadingAll } = useSuppliersByStatus('all');
  const { data: pendingVendors = [], isLoading: loadingPending } = usePendingVendors();
  const deleteSupplier = useDeleteSupplier();
  const { isAdmin } = useAuth();

  const getFilteredSuppliers = () => {
    let suppliers = allSuppliers;
    
    if (activeTab === 'pending') {
      suppliers = allSuppliers.filter(s => s.status === 'pending');
    } else if (activeTab === 'approved') {
      suppliers = allSuppliers.filter(s => s.status === 'approved');
    } else if (activeTab === 'rejected') {
      suppliers = allSuppliers.filter(s => s.status === 'rejected');
    }

    return suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(search.toLowerCase()) ||
      supplier.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(search.toLowerCase()) ||
      supplier.phone?.includes(search)
    );
  };

  const filteredSuppliers = getFilteredSuppliers();

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (supplierToDelete) {
      await deleteSupplier.mutateAsync(supplierToDelete.id);
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    }
  };

  const handleAddNew = () => {
    setSelectedSupplier(null);
    setDialogOpen(true);
  };

  const handleReview = (vendor: Supplier) => {
    setVendorToReview(vendor);
    setReviewDialogOpen(true);
  };

  const copyRegistrationLink = () => {
    const link = `${window.location.origin}/vendor-registration`;
    navigator.clipboard.writeText(link);
    toast.success('Registration link copied to clipboard!');
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const isLoading = loadingAll || loadingPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Suppliers & Vendors</CardTitle>
          <CardDescription>Manage suppliers and review vendor applications</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyRegistrationLink}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Registration Link
          </Button>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="all">All ({allSuppliers.length})</TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({allSuppliers.filter(s => s.status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({allSuppliers.filter(s => s.status === 'approved').length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({allSuppliers.filter(s => s.status === 'rejected').length})
              </TabsTrigger>
            </TabsList>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading suppliers...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? 'No suppliers match your search' : 'No suppliers in this category'}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>GST</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((supplier) => (
                      <TableRow 
                        key={supplier.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/suppliers/${supplier.id}`)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {supplier.name}
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                            </div>
                            {supplier.contact_person && (
                              <div className="text-sm text-muted-foreground">
                                {supplier.contact_person}
                              </div>
                            )}
                            {supplier.category && (
                              <Badge variant="outline" className="mt-1 text-xs capitalize">
                                {supplier.category.replace('_', ' ')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {supplier.phone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {supplier.phone}
                              </div>
                            )}
                            {supplier.email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3" />
                                {supplier.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {supplier.city || supplier.state ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {[supplier.city, supplier.state].filter(Boolean).join(', ')}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.gst_number || '-'}
                        </TableCell>
                        <TableCell>
                          <SupplierRatingBadge supplierId={supplier.id} />
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(supplier.status)}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                Actions
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/suppliers/${supplier.id}`)}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReview(supplier)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Quick View
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSupplierToRate(supplier);
                                setRateDialogOpen(true);
                              }}>
                                <Star className="mr-2 h-4 w-4" />
                                Rate Supplier
                              </DropdownMenuItem>
                              {isAdmin && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setSupplierToDelete(supplier);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={selectedSupplier}
      />

      <ReviewVendorDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        vendor={vendorToReview}
      />

      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Supplier"
        description="This will permanently delete this supplier and all associated data."
        itemDetails={supplierToDelete && (
          <>
            <p><strong>Supplier:</strong> {supplierToDelete.name}</p>
            <p><strong>Contact:</strong> {supplierToDelete.contact_person || '-'}</p>
            <p><strong>GST:</strong> {supplierToDelete.gst_number || '-'}</p>
          </>
        )}
        isLoading={deleteSupplier.isPending}
      />

      {supplierToRate && (
        <RateSupplierDialog
          open={rateDialogOpen}
          onOpenChange={setRateDialogOpen}
          supplierId={supplierToRate.id}
          supplierName={supplierToRate.name}
        />
      )}
    </Card>
  );
}