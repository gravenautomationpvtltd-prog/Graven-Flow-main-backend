import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, RotateCcw, Clock, Building2, FileText, TrendingUp, MoreHorizontal, Eye, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useDeletedLeads, useRestoreLead, usePermanentDeleteLead } from '@/hooks/useLeads';
import { useDeletedCustomers, useRestoreCustomer, usePermanentDeleteCustomer } from '@/hooks/useCustomers';
import { useDeletedQuotations, useRestoreQuotation, usePermanentDeleteQuotation, type QuotationWithDetails } from '@/hooks/useQuotations';
import { useEmptyAllTrash } from '@/hooks/useEmptyTrash';
import { useAuth } from '@/hooks/useAuth';
import { ViewQuotationDialog } from '@/components/quotations/ViewQuotationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Trash() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('leads');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [itemToRestore, setItemToRestore] = useState<{ type: string; id: string; name: string } | null>(null);
  
  // Permanent delete state
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  
  // Empty trash state
  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
  const [emptyTrashConfirmText, setEmptyTrashConfirmText] = useState('');
  
  // Quotation view dialog state
  const [viewQuotationOpen, setViewQuotationOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationWithDetails | null>(null);

  const { data: deletedLeads, isLoading: leadsLoading } = useDeletedLeads();
  const { data: deletedCustomers, isLoading: customersLoading } = useDeletedCustomers();
  const { data: deletedQuotations, isLoading: quotationsLoading } = useDeletedQuotations();

  const restoreLead = useRestoreLead();
  const restoreCustomer = useRestoreCustomer();
  const restoreQuotation = useRestoreQuotation();
  
  const permanentDeleteLead = usePermanentDeleteLead();
  const permanentDeleteCustomer = usePermanentDeleteCustomer();
  const permanentDeleteQuotation = usePermanentDeleteQuotation();
  const emptyAllTrash = useEmptyAllTrash();

  const handleRestoreClick = (type: string, id: string, name: string) => {
    setItemToRestore({ type, id, name });
    setRestoreDialogOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (!itemToRestore) return;

    try {
      switch (itemToRestore.type) {
        case 'lead':
          await restoreLead.mutateAsync(itemToRestore.id);
          break;
        case 'customer':
          await restoreCustomer.mutateAsync(itemToRestore.id);
          break;
        case 'quotation':
          await restoreQuotation.mutateAsync(itemToRestore.id);
          break;
      }
    } finally {
      setRestoreDialogOpen(false);
      setItemToRestore(null);
    }
  };

  const handlePermanentDeleteClick = (type: string, id: string, name: string) => {
    setItemToDelete({ type, id, name });
    setConfirmText('');
    setPermanentDeleteDialogOpen(true);
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!itemToDelete || confirmText !== 'DELETE') return;

    try {
      switch (itemToDelete.type) {
        case 'lead':
          await permanentDeleteLead.mutateAsync(itemToDelete.id);
          break;
        case 'customer':
          await permanentDeleteCustomer.mutateAsync(itemToDelete.id);
          break;
        case 'quotation':
          await permanentDeleteQuotation.mutateAsync(itemToDelete.id);
          break;
      }
    } finally {
      setPermanentDeleteDialogOpen(false);
      setItemToDelete(null);
      setConfirmText('');
    }
  };

  const handleViewClick = (type: string, id: string, quotation?: QuotationWithDetails) => {
    switch (type) {
      case 'lead':
        navigate(`/leads/${id}?includeDeleted=true`);
        break;
      case 'customer':
        navigate(`/customers/${id}?includeDeleted=true`);
        break;
      case 'quotation':
        if (quotation) {
          setSelectedQuotation(quotation);
          setViewQuotationOpen(true);
        }
        break;
    }
  };

  const isRestoring = restoreLead.isPending || restoreCustomer.isPending || restoreQuotation.isPending;
  const isDeleting = permanentDeleteLead.isPending || permanentDeleteCustomer.isPending || permanentDeleteQuotation.isPending;
  const isEmptyingTrash = emptyAllTrash.isPending;
  const isProcessing = isRestoring || isDeleting || isEmptyingTrash;

  const totalDeletedItems = 
    (deletedLeads?.length || 0) + 
    (deletedCustomers?.length || 0) + 
    (deletedQuotations?.length || 0);

  const handleEmptyTrashClick = () => {
    setEmptyTrashConfirmText('');
    setEmptyTrashDialogOpen(true);
  };

  const handleEmptyTrashConfirm = async () => {
    if (emptyTrashConfirmText !== 'EMPTY') return;

    try {
      await emptyAllTrash.mutateAsync();
    } finally {
      setEmptyTrashDialogOpen(false);
      setEmptyTrashConfirmText('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trash2 className="h-8 w-8" />
            Trash
          </h1>
          <p className="text-muted-foreground">
            View, restore, or permanently delete items. Permanent deletion cannot be undone.
          </p>
        </div>
        {isAdmin && totalDeletedItems > 0 && (
          <Button
            variant="destructive"
            onClick={handleEmptyTrashClick}
            disabled={isProcessing}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Empty Trash
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deleted Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deletedLeads?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deleted Customers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deletedCustomers?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deleted Quotations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deletedQuotations?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {totalDeletedItems === 0 && !leadsLoading && !customersLoading && !quotationsLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">Trash is empty</CardTitle>
            <CardDescription>
              Deleted leads, customers, and quotations will appear here.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Leads
              {(deletedLeads?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">{deletedLeads?.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Customers
              {(deletedCustomers?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">{deletedCustomers?.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="quotations" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Quotations
              {(deletedQuotations?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">{deletedQuotations?.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Deleted Leads</CardTitle>
                <CardDescription>Leads that have been moved to trash</CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : deletedLeads?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No deleted leads</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Deleted At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedLeads?.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.title}</TableCell>
                          <TableCell>{lead.customer?.company_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{lead.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {lead.deleted_at ? format(new Date(lead.deleted_at), 'PPp') : '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={isProcessing}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewClick('lead', lead.id)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRestoreClick('lead', lead.id, lead.title)}>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handlePermanentDeleteClick('lead', lead.id, lead.title)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Deleted Customers</CardTitle>
                <CardDescription>Customers that have been moved to trash</CardDescription>
              </CardHeader>
              <CardContent>
                {customersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : deletedCustomers?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No deleted customers</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Deleted At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedCustomers?.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.company_name}</TableCell>
                          <TableCell>{customer.contact_person || '-'}</TableCell>
                          <TableCell>{customer.phone}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {customer.deleted_at ? format(new Date(customer.deleted_at), 'PPp') : '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={isProcessing}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewClick('customer', customer.id)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRestoreClick('customer', customer.id, customer.company_name)}>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handlePermanentDeleteClick('customer', customer.id, customer.company_name)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Deleted Quotations</CardTitle>
                <CardDescription>Quotations that have been moved to trash</CardDescription>
              </CardHeader>
              <CardContent>
                {quotationsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : deletedQuotations?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No deleted quotations</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quotation Number</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Deleted At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedQuotations?.map((quotation) => (
                        <TableRow key={quotation.id}>
                          <TableCell className="font-medium">{quotation.quotation_number}</TableCell>
                          <TableCell>{quotation.customer?.company_name || '-'}</TableCell>
                          <TableCell>₹{quotation.grand_total?.toLocaleString('en-IN') || '0'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {(quotation as any).deleted_at ? format(new Date((quotation as any).deleted_at), 'PPp') : '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={isProcessing}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewClick('quotation', quotation.id, quotation)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRestoreClick('quotation', quotation.id, quotation.quotation_number)}>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handlePermanentDeleteClick('quotation', quotation.id, quotation.quotation_number)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Restore Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore "{itemToRestore?.name}"? 
              This will move it back to the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm} disabled={isRestoring}>
              {isRestoring ? 'Restoring...' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Dialog */}
      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setConfirmText('');
        }
        setPermanentDeleteDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Permanently Delete {itemToDelete?.type}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action <strong>cannot be undone</strong>. The {itemToDelete?.type}{' '}
              <strong>"{itemToDelete?.name}"</strong> and all related data will be 
              permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="my-4 space-y-2">
            <Label htmlFor="confirm-delete">Type <strong>DELETE</strong> to confirm:</Label>
            <Input 
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              disabled={confirmText !== 'DELETE' || isDeleting}
              onClick={handlePermanentDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Trash Dialog - Admin Only */}
      <AlertDialog open={emptyTrashDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEmptyTrashConfirmText('');
        }
        setEmptyTrashDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Empty All Trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action <strong>cannot be undone</strong>. All {totalDeletedItems} items in trash 
              ({deletedLeads?.length || 0} leads, {deletedCustomers?.length || 0} customers, {deletedQuotations?.length || 0} quotations) 
              and their related data will be <strong>permanently deleted</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="my-4 space-y-2">
            <Label htmlFor="confirm-empty">Type <strong>EMPTY</strong> to confirm:</Label>
            <Input 
              id="confirm-empty"
              value={emptyTrashConfirmText}
              onChange={(e) => setEmptyTrashConfirmText(e.target.value)}
              placeholder="EMPTY"
              className="font-mono"
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEmptyingTrash}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              disabled={emptyTrashConfirmText !== 'EMPTY' || isEmptyingTrash}
              onClick={handleEmptyTrashConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isEmptyingTrash ? 'Emptying Trash...' : 'Empty All Trash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Quotation Dialog */}
      <ViewQuotationDialog
        open={viewQuotationOpen}
        onOpenChange={setViewQuotationOpen}
        quotation={selectedQuotation}
        onEdit={() => {}}
        onSendWhatsApp={() => {}}
        onSendEmail={() => {}}
      />
    </div>
  );
}