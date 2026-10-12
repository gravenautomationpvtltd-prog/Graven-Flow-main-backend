import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLqtWorkflow } from '@/hooks/useLqtWorkflow';
import { useNavigate } from 'react-router-dom';
import {
  Phone, Mail, Copy, Send, CheckCircle2,
  CreditCard, ShieldCheck, ArrowRight, ExternalLink, Loader2, Sparkles,
  Building2, User, FileText, Clock, HelpCircle, ArrowUpRight, CheckSquare, Trash2
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { useDeleteLqtLead } from '@/hooks/useDeleteLqtLead';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface LqtWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  onOpenQualifyDialog: (leadId: string) => void;
  onDeleteLead?: () => void;
}

export function LqtWorkflowModal({ open, onOpenChange, lead, onOpenQualifyDialog, onDeleteLead }: LqtWorkflowModalProps) {
  const navigate = useNavigate();
  const { canDeleteLead } = useDeleteLqtLead();
  const customer = lead?.customer || {};
  const phone = customer.phone || '';
  const email = customer.email || '';

  const {
    paymentRequest,
    isPaymentLoading,
    customerForm,
    isCustomerFormLoading,
    sendCustomerForm,
    createPaymentRequest,
    markPaymentPaidTestMode,
    sendToTST,
  } = useLqtWorkflow(lead?.id);

  const [paymentAmount, setPaymentAmount] = useState('999');
  const [paymentPurpose, setPaymentPurpose] = useState('Technical Consultation / TST Support');
  const [createdFormUrl, setCreatedFormUrl] = useState<string | null>(null);
  
  // Qualification info states
  const [qualStatus, setQualStatus] = useState<string>(lead?.status || 'new');
  const [priority, setPriority] = useState<string>('high');
  const [customerInterest, setCustomerInterest] = useState<string>('High');
  const [lqtNotes, setLqtNotes] = useState<string>(lead?.qualification?.notes || '');
  const [activeTab, setActiveTab] = useState('actions');

  const handleSendCustomerForm = async () => {
    if (!lead?.id) return;
    try {
      const res = await sendCustomerForm.mutateAsync({
        leadId: lead.id,
        customerId: customer.id,
        prefilledData: {
          customerName: customer.contact_person || '',
          companyName: customer.company_name || lead.title || '',
          phone: customer.phone || '',
          email: customer.email || '',
          city: customer.city || '',
          state: customer.state || '',
          requirement: lead.customer_query || lead.title || '',
        },
      });
      setCreatedFormUrl(res.formUrl);
    } catch (e) {
      // toast handled in hook
    }
  };

  const handleCreatePayment = async () => {
    if (!lead?.id) return;
    try {
      await createPaymentRequest.mutateAsync({
        amount: Number(paymentAmount) || 999,
        purpose: paymentPurpose,
        customerId: customer.id,
      });
    } catch (e) {
      // toast handled in hook
    }
  };

  const handleMarkPaid = async () => {
    if (!paymentRequest?.id) return;
    try {
      await markPaymentPaidTestMode.mutateAsync(paymentRequest.id);
    } catch (e) {
      // toast handled in hook
    }
  };

  const handleSendToTST = async () => {
    if (!lead?.id) return;
    try {
      await sendToTST.mutateAsync({
        customerId: customer.id,
        title: lead.title || 'Technical Solution Support',
        notes: lqtNotes || 'Forwarded directly by LQT engineer to TST queue',
        priority,
      });
      onOpenChange(false);
      navigate('/tst-queue');
    } catch (e) {
      // toast handled in hook
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  const activeFormUrl = createdFormUrl || (customerForm?.token ? `${window.location.origin}/customer-form/${customerForm.token}` : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              LQT Workspace — Lead Qualification & Pipeline
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs uppercase">
              Lead #{lead?.id?.slice(0, 8)}
            </Badge>
          </div>
          <DialogDescription>
            Qualify{' '}
            <span className="font-semibold text-foreground">
              {customer.company_name || customer.contact_person || lead?.title}
            </span>{' '}
            and manage the complete LQT → Customer Form → Payment → TST progression.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-muted/60">
            <TabsTrigger value="actions" className="text-xs">
              ⚡ LQT Actions & Pipeline
            </TabsTrigger>
            <TabsTrigger value="customer" className="text-xs">
              👤 Customer & Lead 360
            </TabsTrigger>
            <TabsTrigger value="qualification" className="text-xs">
              📋 Qualification Notes
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: WORKFLOW ACTIONS */}
          <TabsContent value="actions" className="space-y-4 pt-2">
            {/* LQT Quick-Action Buttons Header */}
            <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl flex-wrap gap-2">
              <div className="text-xs">
                <span className="font-semibold block text-foreground">Core LQT Actions:</span>
                <span className="text-muted-foreground text-[11px]">Select next step in the approved pipeline</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => onOpenQualifyDialog(lead?.id)}
                >
                  <CheckSquare className="h-3.5 w-3.5 text-primary" /> [Qualify]
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={handleSendToTST}
                  disabled={sendToTST.isPending}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" /> [Send to TST]
                </Button>
              </div>
            </div>

            {/* 1. Contact Customer Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  1. Contact Customer
                </h4>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {phone ? 'Phone Available' : 'No Phone on Record'}
                </span>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="text-xs">
                  <span className="font-semibold text-foreground">{customer.contact_person || 'Customer Contact'}</span>
                  <span className="text-muted-foreground block font-mono text-[11px]">{phone || '—'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {phone && (
                    <>
                      <Button size="sm" asChild className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                        <a href={`tel:${phone}`}>
                          <Phone className="h-3.5 w-3.5" /> 📞 Call Customer
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" asChild className="gap-1.5 border-emerald-300 text-emerald-700 h-8 text-xs hover:bg-emerald-50">
                        <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                          <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      </Button>
                    </>
                  )}
                  {email && (
                    <Button size="sm" variant="outline" asChild className="gap-1.5 h-8 text-xs">
                      <a href={`mailto:${email}`}>
                        <Mail className="h-3.5 w-3.5" /> Email
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Customer Specification Form */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  2. Customer Specification Form
                </h4>
                {customerForm && (
                  <Badge variant="outline" className="text-[10px] uppercase font-mono bg-blue-50 text-blue-700 border-blue-200">
                    Form Status: {customerForm.status}
                  </Badge>
                )}
              </div>

              {activeFormUrl ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Secure intake form generated (customer can fill missing GSTIN, specs, and requirements without login):
                  </p>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border">
                    <Input readOnly value={activeFormUrl} className="text-xs font-mono h-8" />
                    <Button size="sm" variant="outline" onClick={() => copyUrl(activeFormUrl)} className="h-8 gap-1 text-xs shrink-0">
                      <Copy className="h-3.5 w-3.5" /> Copy Link
                    </Button>
                    <Button size="sm" variant="ghost" asChild className="h-8 text-xs shrink-0">
                      <a href={activeFormUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-muted-foreground max-w-md">
                    Generate an encrypted single-use link pre-filled with existing lead details so customer can submit complete specifications.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleSendCustomerForm}
                    disabled={sendCustomerForm.isPending}
                    className="gap-1.5 h-8 text-xs shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" /> [Send Customer Form]
                  </Button>
                </div>
              )}
            </div>

            {/* 3. Payment Request & Controlled Test Mode */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  3. Payment Structure (Modular Architecture)
                </h4>
                {paymentRequest && (
                  <Badge
                    variant={paymentRequest.status === 'paid' ? 'default' : 'secondary'}
                    className="text-[10px] uppercase font-mono"
                  >
                    {paymentRequest.status}
                  </Badge>
                )}
              </div>

              {paymentRequest ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border rounded-lg text-xs flex-wrap gap-2">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Reference:</span>
                      <span className="font-mono font-medium">{paymentRequest.payment_reference}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Amount:</span>
                      <span className="font-bold text-sm text-emerald-700">₹{paymentRequest.amount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Purpose:</span>
                      <span>{paymentRequest.purpose}</span>
                    </div>
                  </div>

                  {paymentRequest.payment_link && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Payment Link / QR:</span>
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border flex-wrap">
                        <Input readOnly value={paymentRequest.payment_link} className="text-xs font-mono h-8 flex-1 min-w-[200px]" />
                        <Button size="sm" variant="outline" onClick={() => copyUrl(paymentRequest.payment_link)} className="h-8 gap-1 text-xs shrink-0">
                          <Copy className="h-3.5 w-3.5" /> Copy Link
                        </Button>
                        {phone && (
                          <Button size="sm" variant="outline" asChild className="h-8 gap-1 text-xs shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                            <a
                              href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Dear ${customer.contact_person || 'Customer'}, please complete payment of ₹${paymentRequest.amount} for ${paymentRequest.purpose || 'Technical Consultation'} using this secure link: ${paymentRequest.payment_link}`)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5" /> Send on WhatsApp
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {paymentRequest.status !== 'paid' ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                          🧪 Controlled Test Mode Action
                        </span>
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-800">
                          Test / Dev Action
                        </Badge>
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300">
                        Simulates verified customer payment. Marking PAID automatically generates and routes a TST case into the Technical Solutions Team Queue.
                      </p>
                      <Button
                        size="sm"
                        onClick={handleMarkPaid}
                        disabled={markPaymentPaidTestMode.isPending}
                        className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold h-9"
                      >
                        {markPaymentPaidTestMode.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" /> [Mark Payment as Paid — TEST MODE]
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span>Payment Verified! TST Case is active in the technical queue.</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate('/tst-queue')} className="h-8 text-xs gap-1">
                        Open TST Queue <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="payAmount" className="text-xs">Amount (₹)</Label>
                      <Input
                        id="payAmount"
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="payPurpose" className="text-xs">Service / Consultation Purpose</Label>
                      <Input
                        id="payPurpose"
                        value={paymentPurpose}
                        onChange={(e) => setPaymentPurpose(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCreatePayment}
                    disabled={createPaymentRequest.isPending}
                    className="w-full gap-2 text-xs h-8"
                  >
                    <CreditCard className="h-3.5 w-3.5" /> [Request Payment]
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: CUSTOMER & LEAD INFORMATION 360 */}
          <TabsContent value="customer" className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Customer Info Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-2.5">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                  <Building2 className="h-3.5 w-3.5 text-primary" /> Customer Information
                </h4>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Customer Name:</span>
                  <span className="font-semibold text-sm">{customer.contact_person || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Company Name:</span>
                  <span className="font-medium">{customer.company_name || lead?.title || '—'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Mobile:</span>
                    <span className="font-mono">{customer.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">WhatsApp:</span>
                    <span className="font-mono">{customer.phone || '—'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Email:</span>
                  <span>{customer.email || '—'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">City:</span>
                    <span>{customer.city || '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">State:</span>
                    <span>{customer.state || '—'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Address:</span>
                  <span>{customer.address || '—'}</span>
                </div>
              </div>

              {/* Lead Info Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-2.5">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                  <FileText className="h-3.5 w-3.5 text-primary" /> Lead Details
                </h4>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Lead Source:</span>
                    <Badge variant="outline" className="capitalize text-[10px] mt-0.5">
                      {lead?.source || 'Manual'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Lead Date:</span>
                    <span className="text-muted-foreground">
                      {lead?.created_at ? format(new Date(lead.created_at), 'dd MMM yyyy') : '—'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Requirement / Query:</span>
                  <p className="bg-white dark:bg-slate-800 p-2 rounded border text-muted-foreground mt-0.5 line-clamp-3">
                    {lead?.customer_query || lead?.title || 'No query text recorded'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Product:</span>
                    <span className="font-medium">{lead?.product_interest || 'General'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Brand:</span>
                    <span className="font-medium">{lead?.brand_interest || '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Urgency:</span>
                    <span className="font-medium capitalize">{lead?.urgency || 'Normal'}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: QUALIFICATION INFORMATION */}
          <TabsContent value="qualification" className="space-y-4 pt-2">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                <CheckSquare className="h-3.5 w-3.5 text-primary" /> Qualification Details
              </h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Qualification Status</Label>
                  <Select value={qualStatus} onValueChange={setQualStatus}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="not_qualified">Not Qualified</SelectItem>
                      <SelectItem value="follow_up">Follow-up Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">LQT Notes & Requirement Summary</Label>
                <Textarea
                  value={lqtNotes}
                  onChange={(e) => setLqtNotes(e.target.value)}
                  placeholder="Record customer technical requirements, budget, timeline, and observations..."
                  rows={4}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Customer Form Status:</span>
                  <Badge variant="outline" className="mt-1 text-[11px] capitalize">
                    {customerForm?.status || 'Not Sent'}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Payment Status:</span>
                  <Badge
                    variant={paymentRequest?.status === 'paid' ? 'default' : 'outline'}
                    className="mt-1 text-[11px] capitalize"
                  >
                    {paymentRequest?.status || 'Not Requested'}
                  </Badge>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                if (lead?.id) onOpenQualifyDialog(lead.id);
              }}
            >
              Technical BOQ Builder
            </Button>
            {canDeleteLead(lead?.assigned_to) && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  onDeleteLead?.();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Lead
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                onOpenChange(false);
                if (lead?.id) navigate(`/leads/${lead.id}?from=/lqt-inbox`);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Lead Detail
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
