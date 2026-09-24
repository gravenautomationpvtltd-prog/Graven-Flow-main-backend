import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  MessageSquare, 
  Mail, 
  Edit, 
  Clock, 
  Send, 
  CheckCircle,
  Building2,
  Phone,
  MapPin,
  FileText,
  History,
  User,
  Reply,
  ChevronDown,
  GitBranch,
  Scale
} from 'lucide-react';
import { useState } from 'react';
import { useCanViewPriceComparison } from '@/hooks/useCanViewPriceComparison';
import { PriceComparisonSheetDialog } from './PriceComparisonSheetDialog';
import { QuotationWithDetails } from '@/hooks/useQuotations';
import { useEmailLogs, EmailLog } from '@/hooks/useEmailLogs';
import { useQuotationVersions } from '@/hooks/useQuotationVersions';
import { useDefaultContactInfo } from '@/hooks/useCompanySettings';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { EmailStatusBadge } from './EmailStatusBadge';
import { QuotationVersionHistory } from './QuotationVersionHistory';
import { format } from 'date-fns';
import { downloadQuotationPDF } from '@/lib/quotation-pdf';
import { downloadProformaInvoicePDF } from '@/lib/pi-pdf';
import { downloadDeliveryChallanPDF } from '@/lib/dc-pdf';
import { ensureItemsWithModelNumber } from '@/lib/quotation-item-utils';
import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ViewQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationWithDetails | null;
  onEdit: () => void;
  onSendWhatsApp: () => void;
  onSendEmail: () => void;
}

export function ViewQuotationDialog({
  open,
  onOpenChange,
  quotation,
  onEdit,
  onSendWhatsApp,
  onSendEmail,
}: ViewQuotationDialogProps) {
  const { data: emailLogs = [] } = useEmailLogs(quotation?.id);
  const { data: versions = [] } = useQuotationVersions(quotation?.id);
  const { defaultPhone, defaultEmail } = useDefaultContactInfo();
  const { branding } = useTenantBranding();
  const canViewComparison = useCanViewPriceComparison();
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const companyDefaults = { defaultPhone, defaultEmail };

  if (!quotation) return null;

  const latestEmailLog = emailLogs[0];

  const getItemDisplayLines = (item: any) => {
    const model = item.model_number?.trim?.() || '';
    const description = (item.product_description || item.description || '').replace(/\s+/g, ' ').trim();
    if (model) {
      const cleanDescription = description.toUpperCase().startsWith(model.toUpperCase())
        ? description.slice(model.length).replace(/^[\s\-–:]+/, '').trim()
        : description;
      return { title: model, description: cleanDescription };
    }

    if (description.includes(' - ')) {
      const parts = description.split(' - ').map((part: string) => part.trim()).filter(Boolean);
      return { title: parts[0] || description, description: parts.slice(1).join(' - ') };
    }

    return { title: description, description: '' };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'accepted':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDownloadQuotation = async () => {
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

  const handleDownloadPI = async () => {
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

  const handleDownloadDC = async () => {
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

  return (
    <TooltipProvider>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">{quotation.quotation_number}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Created {format(new Date(quotation.created_at), 'dd MMM yyyy, hh:mm a')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(quotation.status)}
              {latestEmailLog && (
                <EmailStatusBadge
                  status={latestEmailLog.status}
                  deliveredAt={latestEmailLog.delivered_at}
                  openedAt={latestEmailLog.opened_at}
                  clickedAt={latestEmailLog.clicked_at}
                  bouncedAt={latestEmailLog.bounced_at}
                  errorMessage={latestEmailLog.error_message}
                />
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="gap-2">
              <FileText className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="versions" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Versions
              {versions.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {versions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="emails" className="gap-2">
              <History className="h-4 w-4" />
              Emails
              {emailLogs.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {emailLogs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-[calc(90vh-280px)] -mx-6 px-6">
              <div className="space-y-6 py-4">
                {/* Customer & Quotation Info */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Customer Info */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Customer Details
                    </h3>
                    {quotation.customer ? (
                      <div className="rounded-lg border p-4 space-y-2">
                        <p className="font-medium">{quotation.customer.company_name}</p>
                        {quotation.customer.contact_person && (
                          <p className="text-sm text-muted-foreground">
                            Attn: {quotation.customer.contact_person}
                          </p>
                        )}
                        {quotation.customer.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {quotation.customer.phone}
                          </p>
                        )}
                        {(quotation.customer.address || quotation.customer.city) && (
                          <p className="text-sm text-muted-foreground flex items-start gap-1">
                            <MapPin className="h-3 w-3 mt-0.5" /> 
                            {[quotation.customer.address, quotation.customer.city, quotation.customer.state].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {quotation.customer.gst_number && (
                          <p className="text-sm text-muted-foreground">
                            GSTIN: {quotation.customer.gst_number}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No customer linked</p>
                    )}
                  </div>

                  {/* Quotation Info */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Quotation Info</h3>
                    <div className="rounded-lg border p-4 space-y-2">
                      {quotation.subject && (
                        <div>
                          <p className="text-xs text-muted-foreground">Subject</p>
                          <p className="text-sm font-medium">{quotation.subject}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Valid Until</p>
                          <p className="text-sm font-medium">
                            {quotation.valid_until 
                              ? format(new Date(quotation.valid_until), 'dd MMM yyyy')
                              : 'Not specified'
                            }
                          </p>
                        </div>
                        {quotation.sent_at && (
                          <div>
                            <p className="text-xs text-muted-foreground">Sent On</p>
                            <p className="text-sm font-medium">
                              {format(new Date(quotation.sent_at), 'dd MMM yyyy')}
                              {quotation.sent_via && ` via ${quotation.sent_via}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Line Items</h3>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">#</th>
                          <th className="text-left p-3 font-medium">Description</th>
                          <th className="text-left p-3 font-medium">HSN</th>
                          <th className="text-right p-3 font-medium">Qty</th>
                          <th className="text-right p-3 font-medium">Rate</th>
                          <th className="text-right p-3 font-medium">Disc%</th>
                          <th className="text-right p-3 font-medium">Tax%</th>
                          <th className="text-right p-3 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(quotation.items || []).map((item, index) => {
                          const display = getItemDisplayLines(item);
                          return (
                            <tr key={item.id || index} className="border-t">
                              <td className="p-3">{index + 1}</td>
                              <td className="p-3">
                                <div className="font-semibold text-foreground">{display.title}</div>
                                {display.description && (
                                  <div className="mt-1 text-xs italic text-muted-foreground leading-relaxed">
                                    {display.description}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-muted-foreground">{item.hsn_code || '-'}</td>
                              <td className="p-3 text-right">{item.quantity} {item.unit}</td>
                              <td className="p-3 text-right">{formatCurrency(item.rate)}</td>
                              <td className="p-3 text-right">{item.discount_percent}%</td>
                              <td className="p-3 text-right">{item.tax_percent}%</td>
                              <td className="p-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-72 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(quotation.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-red-600">-{formatCurrency(quotation.total_discount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax (GST)</span>
                      <span>{formatCurrency(quotation.total_tax)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Grand Total</span>
                      <span className="text-primary">{formatCurrency(quotation.grand_total)}</span>
                    </div>
                    {((quotation as any).advance_amount != null || (quotation as any).payment_remark) && (
                      <div className="space-y-1 pt-2 border-t">
                        {(quotation as any).advance_amount != null && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Advance Payable{(quotation as any).advance_percent != null ? ` (${(quotation as any).advance_percent}%)` : ''}
                                {(quotation as any).advance_remark ? ` - ${(quotation as any).advance_remark}` : ''}
                              </span>
                              <span>{formatCurrency(Number((quotation as any).advance_amount))}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Balance Payable{(quotation as any).advance_percent != null ? ` (${Math.round((100 - Number((quotation as any).advance_percent)) * 100) / 100}%)` : ''}
                                {(quotation as any).balance_remark ? ` - ${(quotation as any).balance_remark}` : ''}
                              </span>

                              <span>{formatCurrency(Number((quotation as any).balance_amount ?? (quotation.grand_total - Number((quotation as any).advance_amount))))}</span>
                            </div>
                          </>
                        )}
                        {(quotation as any).payment_remark && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap pt-1">
                            {(quotation as any).payment_remark}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                {/* Notes & Terms */}
                {(quotation.notes || quotation.terms_conditions) && (
                  <div className="grid grid-cols-2 gap-6">
                    {quotation.notes && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Notes</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg border p-3">
                          {quotation.notes}
                        </p>
                      </div>
                    )}
                    {quotation.terms_conditions && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Terms & Conditions</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg border p-3">
                          {quotation.terms_conditions}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="versions" className="flex-1 overflow-hidden mt-0">
            <div className="py-4 h-[calc(90vh-280px)]">
              <QuotationVersionHistory 
                quotationId={quotation.id} 
                currentQuotation={quotation}
                companyDefaults={companyDefaults}
              />
            </div>
          </TabsContent>

          <TabsContent value="emails" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-[calc(90vh-280px)] -mx-6 px-6">
              <div className="py-4">
                {emailLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Mail className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-sm font-medium mb-1">No emails sent yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Send this quotation via email to start tracking delivery
                    </p>
                    {quotation.customer?.email && (
                      <Button onClick={onSendEmail}>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Email
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emailLogs.map((log) => (
                      <EmailHistoryCard key={log.id} log={log} />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Quotation
          </Button>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleDownloadQuotation}>
                  <FileText className="h-4 w-4 mr-2" />
                  Quotation PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPI}>
                  <FileText className="h-4 w-4 mr-2" />
                  Proforma Invoice PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadDC}>
                  <FileText className="h-4 w-4 mr-2" />
                  Delivery Challan PDF
                </DropdownMenuItem>
                {canViewComparison && (
                  <DropdownMenuItem onClick={() => setComparisonOpen(true)}>
                    <Scale className="h-4 w-4 mr-2" />
                    Comparison Sheet (PDF / CSV)
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>

            </DropdownMenu>
            {quotation.customer?.phone && (
              <Button variant="outline" className="text-green-600 hover:text-green-700" onClick={onSendWhatsApp}>
                <MessageSquare className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            )}
            {quotation.customer?.email && (
              <Button variant="default" onClick={onSendEmail}>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {canViewComparison && (
      <PriceComparisonSheetDialog
        open={comparisonOpen}
        onOpenChange={setComparisonOpen}
        quotation={quotation}
      />
    )}
    </TooltipProvider>
  );
}

function EmailHistoryCard({ log }: { log: EmailLog }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{log.recipient_email}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Sent on {format(new Date(log.sent_at), 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>
        <EmailStatusBadge
          status={log.status}
          deliveredAt={log.delivered_at}
          openedAt={log.opened_at}
          clickedAt={log.clicked_at}
          bouncedAt={log.bounced_at}
          errorMessage={log.error_message}
        />
      </div>

      {/* CC/BCC/Reply-To info */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {log.cc_emails && log.cc_emails.length > 0 && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>CC: {log.cc_emails.join(', ')}</span>
          </div>
        )}
        {log.bcc_emails && log.bcc_emails.length > 0 && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>BCC: {log.bcc_emails.join(', ')}</span>
          </div>
        )}
        {log.reply_to && (
          <div className="flex items-center gap-1">
            <Reply className="h-3 w-3" />
            <span>Reply-To: {log.reply_to}</span>
          </div>
        )}
      </div>

      {/* Delivery timeline */}
      <div className="flex flex-wrap gap-3 text-xs">
        {log.delivered_at && (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            <span>Delivered {format(new Date(log.delivered_at), 'dd MMM, hh:mm a')}</span>
          </div>
        )}
        {log.opened_at && (
          <div className="flex items-center gap-1 text-purple-600">
            <Mail className="h-3 w-3" />
            <span>Opened {format(new Date(log.opened_at), 'dd MMM, hh:mm a')}</span>
          </div>
        )}
        {log.clicked_at && (
          <div className="flex items-center gap-1 text-indigo-600">
            <Send className="h-3 w-3" />
            <span>Clicked {format(new Date(log.clicked_at), 'dd MMM, hh:mm a')}</span>
          </div>
        )}
        {log.bounced_at && (
          <div className="flex items-center gap-1 text-destructive">
            <Clock className="h-3 w-3" />
            <span>Bounced {format(new Date(log.bounced_at), 'dd MMM, hh:mm a')}</span>
          </div>
        )}
      </div>

      {/* Error message for bounced emails */}
      {log.error_message && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
          {log.error_message}
        </div>
      )}
    </div>
  );
}
