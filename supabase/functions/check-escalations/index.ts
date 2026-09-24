import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Working-hours based escalation thresholds
const ESCALATION_THRESHOLDS = {
  alert: 2,     // 2 working hours -> Internal Alert/Reminder
  manager: 4,   // 4 working hours -> Escalate to Manager
  coo: 12,      // 12 working hours -> Escalate to COO
  ceo: 24,      // 24 working hours -> Escalate to CEO
};

const LEVEL_ORDER = ['none', 'alert', 'manager', 'coo', 'ceo'] as const;
type EscalationLevel = typeof LEVEL_ORDER[number];

// IST is UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

interface Office {
  id: string;
  opening_time: string | null;
  closing_time: string | null;
}

interface Lead {
  id: string;
  assigned_to: string;
  last_activity_at: string | null;
  escalation_level: EscalationLevel | null;
  title: string;
  status: string;
  created_at: string;
  office_id: string | null;
  office: Office[] | null;  // Supabase returns joins as arrays
}

/**
 * Convert a UTC Date to IST Date for office hours comparison
 */
function toIST(utcDate: Date): Date {
  return new Date(utcDate.getTime() + IST_OFFSET_MS);
}

/**
 * Calculate working hours between two dates, considering:
 * - Office opening and closing times (in IST)
 * - Weekends (Saturday & Sunday excluded)
 * - All times are converted to IST before comparison
 */
function calculateWorkingHours(
  fromDate: Date,
  toDate: Date,
  openingTime: string,
  closingTime: string
): number {
  // Parse opening/closing times (format: "HH:MM:SS" or "HH:MM")
  const [openHour, openMin] = openingTime.split(':').map(Number);
  const [closeHour, closeMin] = closingTime.split(':').map(Number);
  
  // Convert UTC dates to IST for office hours comparison
  const fromIST = toIST(fromDate);
  const toIST_date = toIST(toDate);
  
  let workingHours = 0;
  const current = new Date(fromIST);
  
  // Iterate day by day in IST
  while (current < toIST_date) {
    const dayOfWeek = current.getDay();
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Get the start and end of working hours for this day (in IST)
      const dayStart = new Date(current);
      dayStart.setHours(openHour, openMin, 0, 0);
      
      const dayEnd = new Date(current);
      dayEnd.setHours(closeHour, closeMin, 0, 0);
      
      // Calculate effective overlap between [fromIST, toIST_date] and [dayStart, dayEnd]
      const effectiveStart = new Date(Math.max(current.getTime(), dayStart.getTime(), fromIST.getTime()));
      const effectiveEnd = new Date(Math.min(dayEnd.getTime(), toIST_date.getTime()));
      
      if (effectiveEnd > effectiveStart) {
        const hoursThisDay = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
        workingHours += hoursThisDay;
      }
    }
    
    // Move to next day at start of day
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }
  
  return workingHours;
}

/**
 * Check if a lead has ANY activity (activities, quotations, tasks, sales orders)
 * Returns true if ANY work has been done on this lead
 */
// deno-lint-ignore no-explicit-any
async function checkLeadHasActivity(supabase: any, leadId: string): Promise<boolean> {
  // Check activities table
  const { data: activities } = await supabase
    .from('activities')
    .select('id')
    .eq('lead_id', leadId)
    .limit(1);

  if (activities && activities.length > 0) {
    return true;
  }

  // Check quotations table - if ANY quotation exists for this lead, it's been worked on
  const { data: quotations } = await supabase
    .from('quotations')
    .select('id')
    .eq('lead_id', leadId)
    .limit(1);

  if (quotations && quotations.length > 0) {
    return true;
  }

  // Check tasks table - if ANY task is linked to this lead, work is in progress
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('lead_id', leadId)
    .limit(1);

  if (tasks && tasks.length > 0) {
    return true;
  }

  // Check sales orders table - if ANY sales order exists, lead has been converted
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select('id')
    .eq('lead_id', leadId)
    .limit(1);

  if (salesOrders && salesOrders.length > 0) {
    return true;
  }

  // Check dispatches table - if ANY dispatch is linked, work has been done
  const { data: dispatches } = await supabase
    .from('dispatches')
    .select('id')
    .eq('lead_id', leadId)
    .limit(1);

  if (dispatches && dispatches.length > 0) {
    return true;
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting working-hours based escalation check (IST timezone)...');

    // Get all active leads with their office working hours
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select(`
        id, assigned_to, last_activity_at, escalation_level, title, status, created_at, office_id,
        office:offices(id, opening_time, closing_time)
      `)
      .not('status', 'in', '(won,lost)')
      .not('assigned_to', 'is', null);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      throw leadsError;
    }

    console.log(`Found ${leads?.length || 0} active leads to check`);

    const now = new Date();
    let escalatedCount = 0;
    let resetCount = 0;

    for (const lead of (leads as unknown as Lead[]) || []) {
      // COMPREHENSIVE ACTIVITY CHECK: Check activities, quotations, tasks, sales orders, dispatches
      const hasActivity = await checkLeadHasActivity(supabase, lead.id);

      // If ANY activity exists, this lead should NOT be escalated
      if (hasActivity) {
        // If lead was previously escalated but now has activity, reset escalation
        if (lead.escalation_level && lead.escalation_level !== 'none') {
          console.log(`Lead "${lead.title}" has activity - resetting escalation from ${lead.escalation_level} to none`);
          
          const { error: resetError } = await supabase
            .from('leads')
            .update({ 
              escalation_level: 'none', 
              escalated_at: null 
            })
            .eq('id', lead.id);
          
          if (!resetError) {
            resetCount++;
          }
        }
        continue; // Skip to next lead - this one has activity
      }

      // No activity found - calculate working hours since creation (in IST)
      const createdAt = new Date(lead.created_at);
      
      // Get office working hours (use defaults if not set)
      const office = lead.office?.[0];  // Get first office from array
      const openingTime = office?.opening_time || '09:30:00'; // Default to 9:30 AM IST
      const closingTime = office?.closing_time || '17:30:00'; // Default to 5:30 PM IST

      const workingHoursSinceCreation = calculateWorkingHours(
        createdAt,
        now,
        openingTime,
        closingTime
      );

      console.log(`Lead "${lead.title}": ${workingHoursSinceCreation.toFixed(2)} working hours (office: ${openingTime}-${closingTime})`);

      // Determine target escalation level based on working hours
      let targetLevel: EscalationLevel = 'none';
      
      if (workingHoursSinceCreation >= ESCALATION_THRESHOLDS.ceo) {
        targetLevel = 'ceo';
      } else if (workingHoursSinceCreation >= ESCALATION_THRESHOLDS.coo) {
        targetLevel = 'coo';
      } else if (workingHoursSinceCreation >= ESCALATION_THRESHOLDS.manager) {
        targetLevel = 'manager';
      } else if (workingHoursSinceCreation >= ESCALATION_THRESHOLDS.alert) {
        targetLevel = 'alert';
      }

      const currentLevel = (lead.escalation_level || 'none') as EscalationLevel;
      const currentLevelIndex = LEVEL_ORDER.indexOf(currentLevel);
      const targetLevelIndex = LEVEL_ORDER.indexOf(targetLevel);

      // Only escalate if target level is higher than current
      if (targetLevelIndex > currentLevelIndex) {
        console.log(`Escalating lead "${lead.title}" from ${currentLevel} to ${targetLevel} (${workingHoursSinceCreation.toFixed(1)} working hours, no activity)`);

        // Create escalation log entry
        const { error: logError } = await supabase
          .from('escalation_logs')
          .insert({
            user_id: lead.assigned_to,
            lead_id: lead.id,
            escalation_level: targetLevel,
            escalated_from: currentLevel === 'none' ? null : currentLevel,
            reason: `No activity for ${Math.floor(workingHoursSinceCreation)} working hours (untouched lead)`,
          });

        if (logError) {
          console.error(`Error creating escalation log for lead ${lead.id}:`, logError);
          continue;
        }

        // Update lead's escalation level
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            escalation_level: targetLevel,
            escalated_at: now.toISOString(),
          })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`Error updating lead ${lead.id}:`, updateError);
          continue;
        }

        // Create notification for assigned user
        const levelLabels: Record<EscalationLevel, string> = {
          none: 'None',
          alert: 'Alert',
          manager: 'Manager',
          coo: 'COO',
          ceo: 'CEO',
        };

        const { error: notifyError } = await supabase
          .from('notifications')
          .insert({
            user_id: lead.assigned_to,
            title: `Lead Escalated to ${levelLabels[targetLevel]}`,
            message: `"${lead.title}" has been escalated due to ${Math.floor(workingHoursSinceCreation)} working hours of inactivity. Please take action immediately.`,
            type: 'escalation',
            link: `/leads/${lead.id}`,
          });

        if (notifyError) {
          console.error(`Error creating notification for lead ${lead.id}:`, notifyError);
        }

        escalatedCount++;
      }
    }

    console.log(`Escalation check complete. Escalated: ${escalatedCount}, Reset: ${resetCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        checked: leads?.length || 0,
        escalated: escalatedCount,
        reset: resetCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error in check-escalations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
