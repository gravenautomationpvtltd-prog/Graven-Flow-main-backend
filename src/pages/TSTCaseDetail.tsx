import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Phone, Mail, Copy, Camera, CheckCircle2,
  Clock, ArrowLeft, Building2, User, FileText, CreditCard,
  ShieldCheck, AlertTriangle, ExternalLink, Star
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { PhoneNumberScannerDialog } from '@/components/tst/PhoneNumberScannerDialog';
import { TSTInteractionDialog } from '@/components/tst/TSTInteractionDialog';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

export default function TSTCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);

  // Fetch full TST Case with Customer 360 relations
  const { data: tstCase, isLoading } = useQuery({
    queryKey: ['tst-case-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('tst_cases')
        .select(`
          *,
          customer:customers(*),
          lead:leads(*),
          payment_request:payment_requests(*),
          customer_form:customer_forms(*),
          qualification:lead_qualification(*),
          assignee:profiles!tst_cases_assigned_to_fkey(id, full_name, email),
          interactions:tst_interactions(*),
          followups:tst_followups(*),
          feedback:customer_feedback(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Status mutation
  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await (supabase as any)
        .from('tst_cases')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tst-case-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['tst-cases'] });
      toast.success('Case status updated.');
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96 md:col-span-1" />
          <Skeleton className="h-96 md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!tstCase) {
    return (
      <div className="container mx-auto p-6 max-w-6xl text-center py-20 space-y-4">
        <h2 className="text-xl font-bold">TST Case Not Found</h2>
        <Button onClick={() => navigate('/tst-queue')}>Back to TST Queue</Button>
      </div>
    );
  }

  const customer = tstCase.customer || {};
  const lead = tstCase.lead || {};
  const payment = tstCase.payment_request || {};
  const form = tstCase.customer_form || {};
  const qualification = tstCase.qualification || {};
  const interactions = tstCase.interactions || [];
  const followups = tstCase.followups || [];
  const feedbackList = tstCase.feedback || [];

  const primaryPhone = customer.phone || form.submitted_data?.phone || form.prefilled_data?.phone || '';

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6 max-w-7xl">
      {/* Top Bar Navigation & Actions */}
      {/* Top Bar Navigation & Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" onClick={() => navigate('/tst-queue')} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold font-display truncate">
                {customer.company_name || customer.contact_person || 'Technical Case'}
              </h1>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className="uppercase font-mono text-xs">
                  {tstCase.status}
                </Badge>
                <Badge variant={tstCase.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
                  {tstCase.priority}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Case #{tstCase.id.slice(0, 8)} · Created {format(new Date(tstCase.created_at), 'PPP')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={tstCase.status} onValueChange={(val) => updateStatus.mutate(val)}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
              <SelectValue placeholder="Update status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" className="gap-2 w-full sm:w-auto shrink-0" onClick={() => setInteractionOpen(true)}>
            <CheckCircle2 className="h-4 w-4" /> Log Call & Solution
          </Button>
        </div>
      </div>

      {/* Prominent Quick-Action Callout Banner for TST Engineers */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Phone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Direct Customer Contact
              </p>
              <div className="text-base font-bold flex items-center gap-2 flex-wrap">
                <span className="font-mono">{primaryPhone || 'No phone recorded'}</span>
                {customer.contact_person && (
                  <span className="text-sm font-normal text-muted-foreground truncate">
                    ({customer.contact_person})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            {primaryPhone && (
              <>
                <Button size="sm" asChild className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto text-xs justify-center">
                  <a href={`tel:${primaryPhone}`}>
                    <Phone className="h-3.5 w-3.5" /> Call Customer
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 w-full sm:w-auto text-xs justify-center">
                  <a href={`https://wa.me/${primaryPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                    <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </Button>
              </>
            )}

            <Button size="sm" variant="outline" className="gap-1.5 w-full sm:w-auto text-xs justify-center" onClick={() => setScannerOpen(true)}>
              <Camera className="h-3.5 w-3.5" /> Scan Number
            </Button>

            {primaryPhone && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 w-full sm:w-auto text-xs justify-center bg-background/50 hover:bg-background"
                onClick={() => copyToClipboard(primaryPhone, 'Phone number')}
              >
                <Copy className="h-3.5 w-3.5" /> Copy Number
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Customer 360 Tabbed Layout */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/60 p-1 flex-wrap h-auto">
          <TabsTrigger value="overview">Customer 360</TabsTrigger>
          <TabsTrigger value="interactions">Interactions ({interactions.length})</TabsTrigger>
          <TabsTrigger value="form">Customer Form</TabsTrigger>
          <TabsTrigger value="payment">Payment Verification</TabsTrigger>
          <TabsTrigger value="feedback">Feedback ({feedbackList.length})</TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW: CUSTOMER 360 */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Customer Details Card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Customer Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Company:</span>
                  <span className="font-semibold text-sm">{customer.company_name || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Contact Person:</span>
                  <span className="font-medium">{customer.contact_person || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Email:</span>
                  <span>{customer.email || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Location / City:</span>
                  <span>{customer.city ? `${customer.city}, ${customer.state || ''}` : '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Full Address:</span>
                  <span>{customer.address || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">GSTIN:</span>
                  <span className="font-mono">{customer.gst_number || '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Lead & LQT Qualification Card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Original Lead & LQT Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Lead Title / Requirement:</span>
                  <p className="font-medium mt-0.5">{lead.title || tstCase.title || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block">Customer Query:</span>
                  <p className="text-muted-foreground bg-slate-50 dark:bg-slate-900 p-2 rounded mt-0.5 border">
                    {lead.customer_query || 'No detailed query provided'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground block">Source:</span>
                  <Badge variant="outline" className="capitalize text-[10px] mt-0.5">
                    {lead.source || '—'}
                  </Badge>
                </div>
                {qualification.notes && (
                  <div>
                    <span className="text-muted-foreground block">LQT Qualification Notes:</span>
                    <p className="font-medium text-amber-800 dark:text-amber-400 mt-0.5">
                      {qualification.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment & SLA Status Card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" /> Payment & Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg">
                  <div>
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold uppercase tracking-wider block">
                      Status
                    </span>
                    <span className="text-base font-bold text-emerald-700 dark:text-emerald-300 capitalize">
                      {payment.status || 'Paid'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold uppercase tracking-wider block">
                      Amount
                    </span>
                    <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                      ₹{payment.amount || '0'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block">Reference:</span>
                  <span className="font-mono text-[11px]">{payment.payment_reference || 'MOCK-VERIFIED'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Assigned Engineer:</span>
                  <span className="font-semibold">{tstCase.assignee?.full_name || 'Unassigned'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. INTERACTIONS */}
        <TabsContent value="interactions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Consultation History</h3>
            <Button size="sm" onClick={() => setInteractionOpen(true)}>
              + Log New Interaction
            </Button>
          </div>

          {interactions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No calls or solutions recorded yet for this case. Click &quot;Log Call &amp; Solution&quot; to add one.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {interactions.map((it: any) => (
                <Card key={it.id} className="p-4 shadow-sm border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {it.call_status.replace('_', ' ')}
                      </Badge>
                      <Badge variant={it.resolution_status === 'resolved' ? 'default' : 'secondary'}>
                        {it.resolution_status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {it.problem_issue && (
                    <p className="text-xs text-foreground">
                      <strong className="text-muted-foreground">Problem:</strong> {it.problem_issue}
                    </p>
                  )}
                  {it.solution_provided && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                      <strong>Solution:</strong> {it.solution_provided}
                    </p>
                  )}
                  {it.product_solution_suggested && (
                    <p className="text-xs text-muted-foreground">
                      <strong>Product Suggested:</strong> {it.product_solution_suggested}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 3. CUSTOMER FORM DETAILS */}
        <TabsContent value="form" className="space-y-4">
          {form.id ? (
            <Card className="p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-base">Customer Intake Specification</h3>
                  <p className="text-xs text-muted-foreground">
                    Status: <Badge variant="outline" className="uppercase ml-1">{form.status}</Badge>
                  </p>
                </div>
                {form.submitted_at && (
                  <span className="text-xs text-muted-foreground">
                    Submitted: {format(new Date(form.submitted_at), 'PPP p')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block">Product / Model:</span>
                  <span className="font-medium text-sm">{form.submitted_data?.product || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Quantity:</span>
                  <span className="font-medium text-sm">{form.submitted_data?.quantity || '—'}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-muted-foreground block">Application Details:</span>
                  <p className="font-medium mt-1">{form.submitted_data?.application || '—'}</p>
                </div>
                <div className="md:col-span-2">
                  <span className="text-muted-foreground block">Technical Problem / Requirement:</span>
                  <p className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg mt-1 font-mono text-xs">
                    {form.submitted_data?.problemDetails || '—'}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No customer form was sent for this lead.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 4. PAYMENT */}
        <TabsContent value="payment" className="space-y-4">
          <Card className="p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Payment Structure & Audit
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block">Payment Reference:</span>
                <span className="font-mono text-sm">{payment.payment_reference || 'MOCK-VERIFIED'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Payment Status:</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold uppercase mt-1">
                  {payment.status || 'Paid'}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground block">Amount:</span>
                <span className="font-bold text-base">₹{payment.amount || '0'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Purpose:</span>
                <span>{payment.purpose || 'Technical Consultation / TST Service'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Mode:</span>
                <span className="capitalize">{payment.provider || 'Mock (Ready for Razorpay)'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Paid At:</span>
                <span>{payment.paid_at ? format(new Date(payment.paid_at), 'PPP p') : '—'}</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* 5. FEEDBACK */}
        <TabsContent value="feedback" className="space-y-4">
          {feedbackList.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No customer feedback has been submitted for this case yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {feedbackList.map((fb: any) => (
                <Card key={fb.id} className="p-4 shadow-sm border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">Rating:</span>
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${
                              s <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(fb.submitted_at || fb.created_at), 'PPP')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Requirement Resolved:</span>{' '}
                      <span className="font-semibold uppercase">{fb.requirement_resolved}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Team Rating:</span>{' '}
                      <span className="font-semibold uppercase">{fb.team_rating}</span>
                    </div>
                  </div>

                  {fb.comments && (
                    <p className="text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900 p-2.5 rounded border">
                      &quot;{fb.comments}&quot;
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PhoneNumberScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onSelectNumber={(num) => {
          window.location.href = `tel:${num}`;
        }}
      />

      <TSTInteractionDialog
        open={interactionOpen}
        onOpenChange={setInteractionOpen}
        tstCase={tstCase}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['tst-case-detail', id] });
        }}
      />
    </div>
  );
}
