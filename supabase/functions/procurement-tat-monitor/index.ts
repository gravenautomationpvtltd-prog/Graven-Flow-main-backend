// Procurement TAT monitor — runs every 15 min via cron.
// 2h elapsed → mark reminder_sent + log activity.
// 3h elapsed (deadline reached) → escalated.
// 4h+ → critical.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();
  const result = { reminder: 0, escalated: 0, critical: 0 };

  try {
    // Fetch all open price requests
    const { data: open, error } = await supabase
      .from('price_requests')
      .select('id, lead_id, created_at, tat_deadline, tat_status, assigned_to, requested_by')
      .in('status', ['pending', 'in_progress']);

    if (error) throw error;

    for (const pr of open || []) {
      const created = new Date(pr.created_at).getTime();
      const deadline = pr.tat_deadline ? new Date(pr.tat_deadline).getTime() : created + 3 * 3600_000;
      const elapsedH = (now.getTime() - created) / 3600_000;
      const overdueH = (now.getTime() - deadline) / 3600_000;

      let nextStatus: string | null = null;
      if (overdueH >= 1 && pr.tat_status !== 'critical') {
        nextStatus = 'critical';
        result.critical++;
      } else if (overdueH >= 0 && pr.tat_status !== 'escalated' && pr.tat_status !== 'critical') {
        nextStatus = 'escalated';
        result.escalated++;
      } else if (elapsedH >= 2 && pr.tat_status === 'on_track') {
        nextStatus = 'reminder_sent';
        result.reminder++;
      }

      if (nextStatus) {
        await supabase.from('price_requests').update({ tat_status: nextStatus }).eq('id', pr.id);
        // Log activity for visibility
        if (pr.lead_id && pr.assigned_to) {
          await supabase.from('activities').insert({
            lead_id: pr.lead_id,
            user_id: pr.assigned_to,
            activity_type: 'tat_alert',
            description:
              nextStatus === 'reminder_sent'
                ? 'Procurement TAT reminder (2h elapsed)'
                : nextStatus === 'escalated'
                ? 'Procurement TAT breached (3h) — escalated'
                : 'Procurement TAT critical (>4h) — manager attention required',
            metadata: { price_request_id: pr.id, status: nextStatus, elapsed_hours: elapsedH },
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
