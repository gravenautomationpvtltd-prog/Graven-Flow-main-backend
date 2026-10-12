import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activity-logger';
import { PhoneCall, CheckCircle2, Clock, Share2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TSTInteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tstCase: any;
  onSuccess: () => void;
}

export function TSTInteractionDialog({ open, onOpenChange, tstCase, onSuccess }: TSTInteractionDialogProps) {
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [feedbackLink, setFeedbackLink] = useState<string | null>(null);

  const [callStatus, setCallStatus] = useState<string>('connected');
  const [customerRequirement, setCustomerRequirement] = useState(tstCase?.title || '');
  const [problemIssue, setProblemIssue] = useState('');
  const [solutionProvided, setSolutionProvided] = useState('');
  const [productSuggested, setProductSuggested] = useState('');
  const [customerResponse, setCustomerResponse] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<string>('resolved');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tstCase) return;

    setSaving(true);
    try {
      const tenantId = tstCase.tenant_id || (user as any)?.user_metadata?.tenant_id || '1a5184ef-5138-4327-8928-67bc4f229131';

      // 1. Insert interaction
      const { data: interaction, error: interactionError } = await (supabase as any)
        .from('tst_interactions')
        .insert({
          tenant_id: tenantId,
          tst_case_id: tstCase.id,
          customer_id: tstCase.customer_id || null,
          lead_id: tstCase.lead_id || null,
          employee_id: user?.id || null,
          call_status: callStatus,
          customer_requirement: customerRequirement,
          problem_issue: problemIssue,
          solution_provided: solutionProvided,
          product_solution_suggested: productSuggested,
          customer_response: customerResponse,
          resolution_status: resolutionStatus,
          follow_up_required: followUpRequired || callStatus === 'callback_required',
          follow_up_date: followUpDate ? new Date(followUpDate).toISOString() : null,
          additional_notes: additionalNotes,
        })
        .select()
        .single();

      if (interactionError) throw interactionError;

      await logActivity({
        action: 'create',
        entityType: 'tst_interaction',
        entityId: interaction.id,
        entityName: `TST Call (${callStatus}) - ${resolutionStatus}`,
        metadata: { tstCaseId: tstCase.id, customerId: tstCase.customer_id, callStatus, resolutionStatus },
      });

      // 2. If follow-up required, insert into tst_followups AND OneDesk existing tasks table
      if (followUpRequired || callStatus === 'callback_required') {
        const dueDate = followUpDate ? new Date(followUpDate).toISOString() : new Date(Date.now() + 24 * 3600000).toISOString();
        
        await (supabase as any)
          .from('tst_followups')
          .insert({
            tenant_id: tenantId,
            tst_case_id: tstCase.id,
            interaction_id: interaction.id,
            customer_id: tstCase.customer_id || null,
            assigned_to: user?.id || null,
            follow_up_date: dueDate,
            notes: additionalNotes || `Follow up required after ${callStatus} call`,
            status: 'pending',
          });

        // Also integrate into existing OneDesk tasks table
        if (user?.id) {
          await supabase.from('tasks').insert({
            assigned_to: user.id,
            assigned_by: user.id,
            customer_id: tstCase.customer_id || null,
            lead_id: tstCase.lead_id || null,
            title: `TST Follow-up: ${tstCase.customer?.company_name || tstCase.customer?.contact_person || 'Customer'}`,
            description: `Customer Requirement: ${customerRequirement}\nProblem: ${problemIssue}\nSolution: ${solutionProvided}\nNotes: ${additionalNotes}`,
            due_date: dueDate,
            priority: 'high',
            status: 'pending',
          });
        }

        await (supabase as any)
          .from('tst_cases')
          .update({ status: 'follow_up', updated_at: new Date().toISOString() })
          .eq('id', tstCase.id);

        await logActivity({
          action: 'create',
          entityType: 'task',
          entityName: `Follow-up Task for TST Case #${tstCase.id.slice(0, 8)}`,
          metadata: { tstCaseId: tstCase.id, dueDate },
        });
      } else if (resolutionStatus === 'resolved') {
        // Mark case as resolved
        await (supabase as any)
          .from('tst_cases')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', tstCase.id);

        await logActivity({
          action: 'update',
          entityType: 'tst_case',
          entityId: tstCase.id,
          entityName: 'TST Case Resolved',
          metadata: { tstCaseId: tstCase.id, resolvedAt: new Date().toISOString() },
        });
      } else {
        await (supabase as any)
          .from('tst_cases')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', tstCase.id);
      }

      // 3. Generate Feedback Token if resolved or completed
      const token = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const { data: tokenData, error: tokenError } = await (supabase as any)
        .from('feedback_tokens')
        .insert({
          tenant_id: tenantId,
          token,
          tst_case_id: tstCase.id,
          customer_id: tstCase.customer_id || null,
          lead_id: tstCase.lead_id || null,
          interaction_id: interaction.id,
          employee_id: user?.id || null,
        })
        .select()
        .single();

      if (!tokenError && tokenData) {
        const fullUrl = `${window.location.origin}/feedback/${token}`;
        setFeedbackLink(fullUrl);

        await logActivity({
          action: 'create',
          entityType: 'customer_feedback',
          entityName: 'Feedback Token Generated',
          metadata: { tstCaseId: tstCase.id, token },
        });
      }

      toast.success('TST interaction logged successfully!');
      onSuccess();
    } catch (err: any) {
      toast.error('Failed to save interaction: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyFeedbackLink = () => {
    if (feedbackLink) {
      navigator.clipboard.writeText(feedbackLink);
      toast.success('Feedback link copied to clipboard!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Log TST Call & Technical Solution
          </DialogTitle>
          <DialogDescription>
            Record the outcome of your consultation with{' '}
            <span className="font-semibold text-foreground">
              {tstCase?.customer?.company_name || tstCase?.customer?.contact_person || 'Customer'}
            </span>
          </DialogDescription>
        </DialogHeader>

        {feedbackLink ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl space-y-4 text-center">
            <div className="h-12 w-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-emerald-950">Interaction Logged & Feedback Generated!</h3>
              <p className="text-sm text-emerald-800">
                Send this single-use secure feedback link to the customer so they can submit their review without logging in.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border">
              <Input readOnly value={feedbackLink} className="text-xs font-mono" />
              <Button size="sm" onClick={copyFeedbackLink} className="gap-1.5 shrink-0">
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button size="sm" variant="outline" asChild className="shrink-0">
                <a href={feedbackLink} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done & Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="callStatus">Call Outcome *</Label>
                <Select value={callStatus} onValueChange={setCallStatus}>
                  <SelectTrigger id="callStatus">
                    <SelectValue placeholder="Call status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connected">Connected / In Depth Call</SelectItem>
                    <SelectItem value="not_connected">Not Connected / Ringing</SelectItem>
                    <SelectItem value="busy">Busy / Disconnected</SelectItem>
                    <SelectItem value="callback_required">Call Back Requested</SelectItem>
                    <SelectItem value="wrong_number">Wrong Number / Invalid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resolutionStatus">Resolution Status *</Label>
                <Select value={resolutionStatus} onValueChange={setResolutionStatus}>
                  <SelectTrigger id="resolutionStatus">
                    <SelectValue placeholder="Resolution status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolved">Resolved (Solution Finalized)</SelectItem>
                    <SelectItem value="partially_resolved">Partially Resolved / Exploring</SelectItem>
                    <SelectItem value="not_resolved">Not Resolved / Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customerRequirement">Customer Requirement Summary</Label>
              <Input
                id="customerRequirement"
                value={customerRequirement}
                onChange={(e) => setCustomerRequirement(e.target.value)}
                placeholder="What did the customer need?"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="problemIssue">Problem / Technical Fault</Label>
              <Textarea
                id="problemIssue"
                rows={2}
                value={problemIssue}
                onChange={(e) => setProblemIssue(e.target.value)}
                placeholder="What was the problem or technical challenge?"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="solutionProvided">Solution Provided</Label>
              <Textarea
                id="solutionProvided"
                rows={2}
                value={solutionProvided}
                onChange={(e) => setSolutionProvided(e.target.value)}
                placeholder="What troubleshooting or engineering solution was provided?"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="productSuggested">Product / Model Suggested</Label>
              <Input
                id="productSuggested"
                value={productSuggested}
                onChange={(e) => setProductSuggested(e.target.value)}
                placeholder="e.g. Siemens S7-1200 CPU 1214C DC/DC/DC (Part # 6ES7...)"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customerResponse">Customer Response</Label>
              <Input
                id="customerResponse"
                value={customerResponse}
                onChange={(e) => setCustomerResponse(e.target.value)}
                placeholder="What did the customer say in response?"
              />
            </div>

            {/* Follow-up Section */}
            <div className="p-3 bg-slate-50 border rounded-lg space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="followUpRequired"
                  checked={followUpRequired || callStatus === 'callback_required'}
                  onCheckedChange={(checked) => setFollowUpRequired(!!checked)}
                />
                <Label htmlFor="followUpRequired" className="font-semibold text-sm cursor-pointer">
                  Schedule Follow-up / Call Back Task
                </Label>
              </div>

              {(followUpRequired || callStatus === 'callback_required') && (
                <div className="space-y-1.5">
                  <Label htmlFor="followUpDate">Follow-up Date & Time</Label>
                  <Input
                    id="followUpDate"
                    type="datetime-local"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="additionalNotes">Additional Engineer Notes</Label>
              <Textarea
                id="additionalNotes"
                rows={2}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Internal notes, commercial hints, follow-up context..."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Save Interaction & Complete
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
