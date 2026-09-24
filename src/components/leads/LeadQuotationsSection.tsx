import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Plus, 
  Clock, 
  CheckCircle, 
  Send, 
  Eye,
  Download,
  MessageSquare,
  Mail,
  MoreHorizontal,
  Edit,
  Target,
  Trash2,
  Pencil,
  Copy
} from 'lucide-react';
import { useQuotations, useQuotation, useDeleteQuotation, QuotationWithDetails } from '@/hooks/useQuotations';
import { useLeadDraftQuotation } from '@/hooks/useDraftQuotation';
import { useEmailLogs } from '@/hooks/useEmailLogs';
import { useDefaultContactInfo } from '@/hooks/useCompanySettings';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { CreateQuotationDialog } from '@/components/quotations/CreateQuotationDialog';
import { DuplicateQuotationDialog, type DuplicateSelection } from '@/components/quotations/DuplicateQuotationDialog';
import { ViewQuotationDialog } from '@/components/quotations/ViewQuotationDialog';
import { EditQuotationDialog } from '@/components/quotations/EditQuotationDialog';
import { SendEmailDialog } from '@/components/quotations/SendEmailDialog';
import { EmailStatusBadge } from '@/components/quotations/EmailStatusBadge';
import { downloadQuotationPDF } from '@/lib/quotation-pdf';
import { downloadProformaInvoicePDF } from '@/lib/pi-pdf';
import { downloadDeliveryChallanPDF } from '@/lib/dc-pdf';
import { ensureItemsWithModelNumber } from '@/lib/quotation-item-utils';
import { useSendQuotationEmail } from '@/hooks/useSendQuotationEmail';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { formatCurrencyWithSymbol, type CurrencyCode } from '@/lib/currency-utils';
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

interface LeadQuotationsSectionProps {
  leadId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

// Extended type to include is_price_matched and is_converted
interface QuotationWithPriceMatch extends QuotationWithDetails {
  is_price_matched?: boolean;
  price_matched_at?: string;
  is_converted?: boolean;
  converted_to_order_id?: string | null;
}

export function LeadQuotationsSection({
  leadId,
  customerId,
  customerName,
  customerPhone,
  customerEmail,
}: LeadQuotationsSectionProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailQuotation, setEmailQuotation] = useState<QuotationWithDetails | null>(null);
  const [isMarkingPriceMatched, setIsMarkingPriceMatched] = useState<string | null>(null);
  const [deleteQuotationId, setDeleteQuotationId] = useState<string | null>(null);
  const [continueDraftId, setContinueDraftId] = useState<string | undefined>(undefined);
  const [duplicateFromId, setDuplicateFromId] = useState<string | undefined>(undefined);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [duplicateSourceQuotation, setDuplicateSourceQuotation] = useState<QuotationWithDetails | null>(null);
  const [duplicateSelection, setDuplicateSelection] = useState<DuplicateSelection | null>(null);

  const queryClient = useQueryClient();
  const { data: quotations = [], isLoading } = useQuotations(leadId);
  const { data: existingDraft } = useLeadDraftQuotation(leadId);
  const { data: selectedQuotation } = useQuotation(selectedQuotationId || undefined);
  const { defaultPhone, defaultEmail } = useDefaultContactInfo();
  const { branding } = useTenantBranding();
  const companyDefaults = { defaultPhone, defaultEmail };
  const sendEmail = useSendQuotationEmail();
  const deleteQuotation = useDeleteQuotation();
  const { profile, hasRole } = useAuth();
  const isSuperAdmin = hasRole('super_admin');

  // Separate drafts from completed quotations
  const draftQuotations = quotations.filter(q => q.status === 'draft');
  const completedQuotations = quotations.filter(q => q.status !== 'draft');

  const handleDeleteQuotation = async () => {
    if (!deleteQuotationId) return;
    await deleteQuotation.mutateAsync(deleteQuotationId);
    setDeleteQuotationId(null);
  };

  const handleMarkAsPriceMatched = async (quotation: QuotationWithPriceMatch) => {
    if ((quotation as any).is_price_matched) {
      toast.info('This quotation is already marked as price matched');
      return;
    }

    setIsMarkingPriceMatched(quotation.id);
    try {
      const now = new Date().toISOString();

      // Update quotation
      const { error: quotationError } = await supabase
        .from('quotations')
        .update({
          is_price_matched: true,
          price_matched_at: now,
        })
        .eq('id', quotation.id);

      if (quotationError) throw quotationError;

      // Update lead
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          price_matched_at: now,
          enquiry_status: 'price_matched',
        })
        .eq('id', leadId);

      if (leadError) throw leadError;

      queryClient.invalidateQueries({ queryKey: ['quotations', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Quotation marked as price matched');
    } catch (error) {
      toast.error('Failed to mark as price matched');
    } finally {
      setIsMarkingPriceMatched(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'sent':
        return <Badge variant="default" className="text-xs bg-blue-500"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'accepted':
        return <Badge variant="default" className="text-xs bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const formatQuotationAmount = (amount: number, currency?: string | null) => {
    return formatCurrencyWithSymbol(amount, (currency as CurrencyCode) || 'INR');
  };

  const handleViewDetails = (quotation: QuotationWithDetails) => {
    setSelectedQuotationId(quotation.id);
    setIsViewOpen(true);
  };

  const handleEdit = (quotation: QuotationWithDetails) => {
    setSelectedQuotationId(quotation.id);
    setIsEditOpen(true);
  };

  const handleContinueDraft = (draftId: string) => {
    setContinueDraftId(draftId);
    setIsCreateOpen(true);
  };

  const handleCreateNew = () => {
    setContinueDraftId(undefined);
    setDuplicateFromId(undefined);
    setIsCreateOpen(true);
  };

  const handleDuplicate = (quotation: QuotationWithDetails) => {
    setDuplicateSourceQuotation(quotation);
    setIsDuplicateOpen(true);
  };

  const handleDuplicateConfirm = (selection: DuplicateSelection) => {
    setContinueDraftId(undefined);
    setDuplicateFromId(duplicateSourceQuotation?.id);
    setDuplicateSelection(selection);
    setIsCreateOpen(true);
    toast.info('Review the copied quotation and save to create a new one');
  };



  const handleDownloadQuotation = async (quotation: QuotationWithDetails) => {
    try {
      const items = await ensureItemsWithModelNumber(quotation.id, quotation.items as any[] | undefined);
      const completeQuotation = { ...quotation, items } as QuotationWithDetails;
      downloadQuotationPDF(completeQuotation, companyDefaults, branding);
      toast.success('Quotation PDF downloaded');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate quotation PDF. Please try again.');
    }
  };

  const handleDownloadPI = async (quotation: QuotationWithDetails) => {
    try {
      const items = await ensureItemsWithModelNumber(quotation.id, quotation.items as any[] | undefined);
      const completeQuotation = { ...quotation, items } as QuotationWithDetails;
      downloadProformaInvoicePDF(completeQuotation, companyDefaults, branding);
      toast.success('Proforma Invoice PDF downloaded');
    } catch (err) {
      console.error('PI PDF generation failed:', err);
      toast.error('Failed to generate Proforma Invoice PDF. Please try again.');
    }
  };

  const handleDownloadDC = async (quotation: QuotationWithDetails) => {
    try {
      const items = await ensureItemsWithModelNumber(quotation.id, quotation.items as any[] | undefined);
      const completeQuotation = { ...quotation, items } as QuotationWithDetails;
      downloadDeliveryChallanPDF(completeQuotation, companyDefaults, branding);
      toast.success('Delivery Challan PDF downloaded');
    } catch (err) {
      console.error('DC PDF generation failed:', err);
      toast.error('Failed to generate Delivery Challan PDF. Please try again.');
    }
  };

  const handleSendWhatsApp = (quotation: QuotationWithDetails) => {
    const phone = quotation.customer?.phone || customerPhone;
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    
    let cleanPhone = phone.replace(/\D/g, '');
    // Add country code if not present
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const message = encodeURIComponent(
      `Dear ${quotation.customer?.company_name || customerName || 'Sir/Madam'},\n\nPlease find our quotation ${quotation.quotation_number} for ${formatQuotationAmount(quotation.grand_total, quotation.currency)}.\n\nWe look forward to your response.\n\nRegards,\n${branding.companyName}`
    );
    window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${message}`, '_blank');
    toast.success('WhatsApp opened');
  };

  const handleOpenEmailDialog = (quotation: QuotationWithDetails) => {
    const email = quotation.customer?.email || customerEmail;
    if (!email) {
      toast.error('No email address available');
      return;
    }
    setEmailQuotation(quotation);
    setIsEmailDialogOpen(true);
  };

  const handleSendEmail = async (params: {
    recipient_email: string;
    recipient_name?: string;
    message?: string;
    cc?: string[];
    bcc?: string[];
    reply_to?: string;
  }) => {
    if (!emailQuotation) return;
    
    await sendEmail.mutateAsync({
      quotation_id: emailQuotation.id,
      ...params,
    });
    setIsEmailDialogOpen(false);
    setEmailQuotation(null);
  };

  const handleEditFromView = () => {
    setIsViewOpen(false);
    setIsEditOpen(true);
  };

  const handleSendWhatsAppFromView = () => {
    if (selectedQuotation) {
      handleSendWhatsApp(selectedQuotation);
    }
  };

  const handleSendEmailFromView = () => {
    if (selectedQuotation) {
      handleOpenEmailDialog(selectedQuotation);
      setIsViewOpen(false);
    }
  };

  return (
    <>
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Quotations
              {quotations.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {quotations.length}
                </Badge>
              )}
            </CardTitle>
            <Button size="sm" onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : quotations.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <FileText className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                No quotations yet
              </p>
              <Button size="sm" variant="outline" onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-1" />
                Create First Quotation
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[350px]">
              <div className="space-y-3">
                {/* Show draft quotations first with prominent styling */}
                {draftQuotations.length > 0 && (
                  <div className="space-y-2">
                    {draftQuotations.map((quotation) => (
                      <div
                        key={quotation.id}
                        className="group flex items-center justify-between p-3 rounded-lg border-2 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 hover:border-yellow-400 transition-all"
                      >
                        <div 
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => handleContinueDraft(quotation.id)}
                        >
                          <div className="w-10 h-10 rounded-lg bg-yellow-200 dark:bg-yellow-800 flex items-center justify-center">
                            <Pencil className="h-5 w-5 text-yellow-700 dark:text-yellow-300" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {quotation.quotation_number}
                              </span>
                              <Badge variant="secondary" className="text-xs bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200">
                                <Clock className="h-3 w-3 mr-1" />
                                Draft - In Progress
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Last edited {format(new Date(quotation.updated_at), 'dd MMM yyyy, HH:mm')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {formatQuotationAmount(quotation.grand_total, quotation.currency)}
                          </span>
                          <Button 
                            size="sm" 
                            onClick={() => handleContinueDraft(quotation.id)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white"
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Continue
                          </Button>
                          
                          {/* Dropdown menu for drafts with download options */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(quotation)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDownloadQuotation(quotation)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download Quotation PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadPI(quotation)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download Proforma Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadDC(quotation)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download Delivery Challan
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setDeleteQuotationId(quotation.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Draft
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Completed quotations */}
                {completedQuotations.map((quotation) => (
                  <div
                    key={quotation.id}
                    className="group flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all"
                  >
                    <div 
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => handleViewDetails(quotation)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center relative">
                        <FileText className="h-5 w-5 text-primary" />
                        {(quotation as QuotationWithPriceMatch).is_price_matched && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <Target className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {quotation.quotation_number}
                          </span>
                          {getStatusBadge(quotation.status)}
                          {(quotation as QuotationWithPriceMatch).is_converted && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Converted
                            </Badge>
                          )}
                          {(quotation as QuotationWithPriceMatch).is_price_matched && !(quotation as QuotationWithPriceMatch).is_converted && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                              <Target className="h-3 w-3 mr-1" />
                              Price Matched
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(new Date(quotation.created_at), 'dd MMM yyyy')}</span>
                          {quotation.valid_until && (
                            <>
                              <span>•</span>
                              <span>Valid till {format(new Date(quotation.valid_until), 'dd MMM')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">
                        {formatQuotationAmount(quotation.grand_total, quotation.currency)}
                      </span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(quotation)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(quotation)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Quotation
                          </DropdownMenuItem>
                          {isSuperAdmin && (
                            <DropdownMenuItem onClick={() => handleDuplicate(quotation)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate Quotation
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDownloadQuotation(quotation)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Quotation PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPI(quotation)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Proforma Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadDC(quotation)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Delivery Challan
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleMarkAsPriceMatched(quotation)}
                            disabled={isMarkingPriceMatched === quotation.id || (quotation as QuotationWithPriceMatch).is_price_matched}
                            className="text-green-600"
                          >
                            <Target className="h-4 w-4 mr-2" />
                            {(quotation as QuotationWithPriceMatch).is_price_matched ? 'Price Matched ✓' : 'Mark as Price Matched'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {(quotation.customer?.phone || customerPhone) && (
                            <DropdownMenuItem
                              className="text-green-600"
                              onClick={() => handleSendWhatsApp(quotation)}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Send via WhatsApp
                            </DropdownMenuItem>
                          )}
                          {(quotation.customer?.email || customerEmail) && (
                            <DropdownMenuItem 
                              onClick={() => handleOpenEmailDialog(quotation)}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Send via Email
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeleteQuotationId(quotation.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Quotation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <CreateQuotationDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setContinueDraftId(undefined);
            setDuplicateFromId(undefined);
            setDuplicateSelection(null);
          }
        }}
        leadId={duplicateSelection ? duplicateSelection.leadId : leadId}
        customerId={duplicateSelection ? duplicateSelection.customerId : customerId}
        customerName={duplicateSelection ? duplicateSelection.customerName : customerName}
        customerPhone={duplicateSelection ? duplicateSelection.customerPhone : customerPhone}
        customerEmail={duplicateSelection ? duplicateSelection.customerEmail : customerEmail}
        existingDraftId={continueDraftId}
        duplicateFromId={duplicateFromId}
        itemsOverride={duplicateSelection?.items}
      />

      <DuplicateQuotationDialog
        open={isDuplicateOpen}
        onOpenChange={(open) => {
          setIsDuplicateOpen(open);
          if (!open) setDuplicateSourceQuotation(null);
        }}
        quotation={duplicateSourceQuotation}
        sourceLeadId={leadId}
        onConfirm={handleDuplicateConfirm}
      />

      <ViewQuotationDialog
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        quotation={selectedQuotation || null}
        onEdit={handleEditFromView}
        onSendWhatsApp={handleSendWhatsAppFromView}
        onSendEmail={handleSendEmailFromView}
      />

      <EditQuotationDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        quotation={selectedQuotation || null}
        onSuccess={() => setSelectedQuotationId(null)}
      />

      {emailQuotation && (
        <SendEmailDialog
          open={isEmailDialogOpen}
          onOpenChange={(open) => {
            setIsEmailDialogOpen(open);
            if (!open) setEmailQuotation(null);
          }}
          recipientEmail={emailQuotation.customer?.email || customerEmail || ''}
          recipientName={emailQuotation.customer?.company_name || customerName}
          quotationNumber={emailQuotation.quotation_number}
          quotationSubject={emailQuotation.subject || undefined}
          quotationValidUntil={emailQuotation.valid_until ? format(new Date(emailQuotation.valid_until), 'dd MMM yyyy') : undefined}
          quotationGrandTotal={emailQuotation.grand_total}
          quotationDeliveryTimeline={(emailQuotation as any).delivery_timeline || '2-3 Weeks'}
          senderName={profile?.full_name}
          senderPhone={profile?.phone}
          senderEmail={profile?.email}
          onSend={handleSendEmail}
          isSending={sendEmail.isPending}
        />
      )}

      <AlertDialog open={!!deleteQuotationId} onOpenChange={(open) => !open && setDeleteQuotationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quotation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this quotation and all its items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteQuotation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteQuotation.isPending}
            >
              {deleteQuotation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
