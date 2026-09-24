import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendEmail } from "../_shared/send-email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: settings, error: sErr } = await supabase
      .from("assignment_audit_settings")
      .select("tenant_id, alert_threshold, alert_emails, alert_throttle_hours");
    if (sErr) throw sErr;

    const results: any[] = [];

    for (const s of settings ?? []) {
      const { data: countData, error: cErr } = await supabase.rpc(
        "count_unlogged_leads_24h",
        { _tenant_id: s.tenant_id },
      );
      if (cErr) {
        results.push({ tenant_id: s.tenant_id, error: cErr.message });
        continue;
      }
      const unlogged = Number(countData ?? 0);
      const overThreshold = unlogged > s.alert_threshold;

      // Throttle: skip if a successful alert was sent within throttle window
      let alertSent = false;
      let alertError: string | null = null;

      if (overThreshold && (s.alert_emails ?? []).length > 0) {
        const since = new Date(
          Date.now() - s.alert_throttle_hours * 3600 * 1000,
        ).toISOString();
        const { data: recent } = await supabase
          .from("assignment_audit_runs")
          .select("id")
          .eq("tenant_id", s.tenant_id)
          .eq("alert_sent", true)
          .gte("ran_at", since)
          .limit(1);

        if (!recent || recent.length === 0) {
          const subject = `[Audit Alert] ${unlogged} leads missing assignment log`;
          const html = `
            <p>Hi Admin,</p>
            <p><b>${unlogged}</b> leads created in the last 24 hours are missing an assignment-log entry.</p>
            <p>Threshold: <b>${s.alert_threshold}</b>.</p>
            <p>Review them in the Assignment Audit report.</p>
          `;
          const res = await sendEmail(s.tenant_id, {
            from: "alerts@graven.app",
            to: s.alert_emails,
            subject,
            html,
          });
          alertSent = res.success;
          alertError = res.error ?? null;
        }
      }

      await supabase.from("assignment_audit_runs").insert({
        tenant_id: s.tenant_id,
        unlogged_count: unlogged,
        threshold: s.alert_threshold,
        alert_sent: alertSent,
        alert_error: alertError,
      });

      results.push({ tenant_id: s.tenant_id, unlogged, alertSent });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
