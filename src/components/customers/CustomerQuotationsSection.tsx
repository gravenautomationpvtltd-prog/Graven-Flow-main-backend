import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, MoreHorizontal, Eye, Edit, Copy, Download, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useCustomer } from '@/hooks/useCustomers';
import { useQuotation, type QuotationWithDetails } from '@/hooks/useQuotations';
import { useDefaultContactInfo } from '@/hooks/useCompanySettings';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { CreateQuotationDialog } from '@/components/quotations/CreateQuotationDialog';
import { ViewQuotationDialog } from '@/components/quotations/ViewQuotationDialog';
import { EditQuotationDialog } from '@/components/quotations/EditQuotationDialog';
import { DuplicateQuotationDialog, type DuplicateSelection } from '@/components/quotations/DuplicateQuotationDialog';
import { downloadQuotationPDF } from '@/lib/quotation-pdf';
import { downloadProformaInvoicePDF } from '@/lib/pi-pdf';
import { downloadDeliveryChallanPDF } from '@/lib/dc-pdf';
import { ensureItemsWithModelNumber } from '@/lib/quotation-item-utils';
import { toast } from 'sonner';

interface CustomerQuotationsSectionProps {
  customerId: string;
}

interface CustomerQuotationRow {
  id: string;
  quotation_number: string;
  status: string;
  grand_total: number | null;
  currency: string | null;
  created_at: string;
  lead_id: string | null;
  lead: { id: string; title: string } | null;
  created_by_profile: { full_name: string | null } | null;
}

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'accepted':
    case 'converted':
      return 'default';
    case 'rejected':
      return 'destructive';
    case 'sent':
    case 'revised':
      return 'secondary';
    default:
      return 'outline';
  }
};

const formatAmount = (amount: number | null, currency: string | null) => {
  if (amount == null) return '-';
  const cur = currency || 'INR';
  try {
    return new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${cur} ${Math.round(amount).toLocaleString()}`;
  }
};

export function CustomerQuotationsSection({ customerId }: CustomerQuotationsSectionProps) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | undefined>(undefined);
  const [duplicateFromId, setDuplicateFromId] = useState<string | undefined>(undefined);
  const [duplicateSelection, setDuplicateSelection] = useState<DuplicateSelection | null>(null);

  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('super_admin');
  const { data: customer } = useCustomer(customerId);
  const { data: selectedQuotation } = useQuotation(selectedQuotationId || undefined);
  const { data: duplicateSourceQuotation } = useQuotation(duplicateSourceId);
  const { defaultPhone, defaultEmail } = useDefaultContactInfo();
  const { branding } = useTenantBranding();
  const companyDefaults = { defaultPhone, defaultEmail };

  const { data: quotations, isLoading } = useQuery({
    queryKey: ['customer-quotations', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          id, quotation_number, status, grand_total, currency, created_at, lead_id,
          lead:leads(id, title),
          created_by_profile:profiles!quotations_created_by_fkey(full_name)
        `)
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as CustomerQuotationRow[];
    },
  });

  const visibleRows = useMemo(() => {
    if (!quotations) return [];
    return showAll ? quotations : quotations.slice(0, 10);
  }, [quotations, showAll]);

  const openQuotation = (q: CustomerQuotationRow) => {
    setSelectedQuotationId(q.id);
    setIsViewOpen(true);
  };

  const handleEdit = (q: CustomerQuotationRow) => {
    setSelectedQuotationId(q.id);
    setIsEditOpen(true);
  };

  const handleDuplicate = (q: CustomerQuotationRow) => {
    setDuplicateSourceId(q.id);
    setIsDuplicateOpen(true);
  };

  const handleDuplicateConfirm = (selection: DuplicateSelection) => {
    setDuplicateFromId(duplicateSourceId);
    setDuplicateSelection(selection);
    setIsCreateOpen(true);
    toast.info('Review the copied quotation and save to create a new one');
  };

  const withFullQuotation = async (
    id: string,
    action: (q: QuotationWithDetails) => void,
    label: string,
  ) => {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*, customer:customers(*), items:quotation_items(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      const items = await ensureItemsWithModelNumber(id, (data as any).items);
      action({ ...(data as any), items } as QuotationWithDetails);
      toast.success(`${label} downloaded`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error(`Failed to generate ${label}. Please try again.`);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quotations ({quotations?.length || 0})
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setDuplicateFromId(undefined);
              setDuplicateSelection(null);
              setIsCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create Quotation
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !quotations || quotations.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No quotations created for this customer yet
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quotation #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((q) => {
                      const hasLead = !!q.lead_id;
                      return (
                        <TableRow
                          key={q.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openQuotation(q)}
                        >
                          <TableCell className="font-medium">{q.quotation_number}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(q.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell
                            className={hasLead ? 'text-primary hover:underline cursor-pointer' : 'text-muted-foreground'}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (q.lead_id) navigate(`/leads/${q.lead_id}`);
                            }}
                          >
                            {q.lead?.title || '-'}
                          </TableCell>
                          <TableCell>{q.created_by_profile?.full_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(q.status)} className="capitalize">
                              {q.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatAmount(q.grand_total, q.currency)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openQuotation(q)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(q)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Quotation
                                </DropdownMenuItem>
                                {isSuperAdmin && (
                                  <DropdownMenuItem onClick={() => handleDuplicate(q)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicate Quotation
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    withFullQuotation(
                                      q.id,
                                      (full) => downloadQuotationPDF(full, companyDefaults, branding),
                                      'Quotation PDF',
                                    )
                                  }
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download Quotation PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    withFullQuotation(
                                      q.id,
                                      (full) => downloadProformaInvoicePDF(full, companyDefaults, branding),
                                      'Proforma Invoice PDF',
                                    )
                                  }
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download Proforma Invoice
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    withFullQuotation(
                                      q.id,
                                      (full) => downloadDeliveryChallanPDF(full, companyDefaults, branding),
                                      'Delivery Challan PDF',
                                    )
                                  }
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download Delivery Challan
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {quotations.length > 10 && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" size="sm" onClick={() => setShowAll((s) => !s)}>
                    {showAll ? 'Show less' : `Show all ${quotations.length}`}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ViewQuotationDialog
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        quotation={selectedQuotation || null}
        onEdit={() => {
          setIsViewOpen(false);
          setIsEditOpen(true);
        }}
        onSendWhatsApp={() => {
          const phone = selectedQuotation?.customer?.phone || customer?.phone;
          if (!phone) {
            toast.error('No phone number available');
            return;
          }
          let clean = phone.replace(/\D/g, '');
          if (clean.length === 10) clean = '91' + clean;
          window.open(`https://web.whatsapp.com/send?phone=${clean}`, '_blank');
        }}
        onSendEmail={() => {
          const email = selectedQuotation?.customer?.email || customer?.email;
          if (!email) {
            toast.error('No email address available');
            return;
          }
          window.open(`mailto:${email}`, '_blank');
        }}
      />

      <EditQuotationDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        quotation={selectedQuotation || null}
        onSuccess={() => setSelectedQuotationId(null)}
      />

      <DuplicateQuotationDialog
        open={isDuplicateOpen}
        onOpenChange={(open) => {
          setIsDuplicateOpen(open);
          if (!open) setDuplicateSourceId(undefined);
        }}
        quotation={duplicateSourceQuotation || null}
        onConfirm={handleDuplicateConfirm}
      />

      <CreateQuotationDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setDuplicateFromId(undefined);
            setDuplicateSelection(null);
          }
        }}
        leadId={duplicateSelection?.leadId}
        customerId={duplicateSelection ? duplicateSelection.customerId : customerId}
        customerName={
          duplicateSelection
            ? duplicateSelection.customerName
            : customer?.company_name || customer?.contact_person || undefined
        }
        customerPhone={duplicateSelection ? duplicateSelection.customerPhone : customer?.phone || undefined}
        customerEmail={duplicateSelection ? duplicateSelection.customerEmail : customer?.email || undefined}
        duplicateFromId={duplicateFromId}
        itemsOverride={duplicateSelection?.items}
      />
    </>
  );
}
