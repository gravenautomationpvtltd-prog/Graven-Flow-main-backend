import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Repeat, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { safeInsertLead } from '@/hooks/useLeads';

interface Props {
  customerId: string;
  customerName: string;
}

/**
 * Per spec: customer-originated repeat enquiries skip LQT and route directly to SPT.
 * We create a lead in 'qualified' status (post-LQT) so SPT picks it up immediately.
 */
export function CreateRepeatEnquiryButton({ customerId, customerName }: Props) {
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Resolve tenant_id from profile lookup
      const { data: prof } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .maybeSingle();

      const { data: customer } = await supabase
        .from('customers')
        .select('phone, email, contact_person, assigned_sales_id, tenant_id, company_name')
        .eq('id', customerId)
        .maybeSingle();

      const lead = await safeInsertLead({
        customer_id: customerId,
        title: `Repeat enquiry — ${customer?.company_name || customerName}`,
        customer_query: 'Repeat enquiry from existing customer (CST → SPT direct route, skips LQT per workflow spec)',
        source: 'referral',
        status: 'qualified',
        enquiry_status: 'ready_to_quote',
        has_enquiry: true,
        // Loyalty: assign to existing salesperson if known; otherwise let DB trigger run SPT round-robin (never CST user)
        assigned_to: customer?.assigned_sales_id ?? null,
        tenant_id: customer?.tenant_id || prof?.tenant_id || null,
      }, { select: 'id' });

      // Create lead_qualification handoff row → fires reassignment trigger (loyalty enforced)
      // and makes lead visible in SPT inbox per universal-landing-zone rule.
      // History-mode: insert a new row per attempt; latest row reflects current routing.
      const { error: qErr } = await supabase
        .from('lead_qualification' as any)
        .insert({
          lead_id: lead.id,
          tenant_id: customer?.tenant_id || prof?.tenant_id || null,
          qualification_type: 'simple',
          routed_to: 'spt',
          qualified_by: user.id,
          qualified_at: new Date().toISOString(),
          decision_reason: 'CST repeat enquiry (quick create)',
        });
      if (qErr) console.error('lead_qualification insert failed:', qErr);

      toast.success(`Repeat enquiry created for ${customerName} — routed to Sales`);
      navigate(`/leads/${lead.id}`);
    } catch (err: any) {
      console.error('Create repeat enquiry error:', err);
      const lower = (err?.message || '').toLowerCase();
      if (lower.includes('no_organization')) {
        toast.error("Your account isn't fully set up yet. Please refresh the page or contact your admin.");
      } else if (lower.includes('permission') || lower.includes('row-level') || lower.includes('jwt') || lower.includes('session')) {
        toast.error('We hit a temporary issue creating this enquiry. Please refresh and try again — your data is safe.');
      } else {
        toast.error("Couldn't create the repeat enquiry right now. Please try again in a moment.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleCreate} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat className="h-3.5 w-3.5" />}
      <span className="ml-1.5 hidden sm:inline">Repeat Enquiry</span>
    </Button>
  );
}
