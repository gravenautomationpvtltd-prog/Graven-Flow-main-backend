import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getTenantEmailConfig, buildFromAddress } from "../_shared/tenant-email-config.ts";
import { sendEmail } from "../_shared/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayslipEmailRequest {
  employeeName: string;
  employeeEmail: string;
  month: string;
  year: number;
  baseSalary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalLateMinutes: number;
  lateDeduction: number;
  absenceDeduction: number;
  escalationCount: number;
  escalationPenalty: number;
  leaveCount: number;
  attendanceBonus: number;
  salesCommission: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  tenant_id?: string;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PayslipEmailRequest = await req.json();
    const emailConfig = await getTenantEmailConfig(data.tenant_id);
    console.log("Sending payslip email to:", data.employeeEmail);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0 0; opacity: 0.9; }
          .content { padding: 20px; }
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 14px; font-weight: bold; color: #3b82f6; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
          .section-title.earnings { color: #22c55e; }
          .section-title.deductions { color: #ef4444; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 8px 0; }
          td:last-child { text-align: right; }
          .total-row { font-weight: bold; border-top: 1px solid #e2e8f0; }
          .net-salary { background: #3b82f6; color: white; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
          .net-salary span:first-child { font-size: 16px; }
          .net-salary span:last-child { font-size: 24px; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
          .positive { color: #22c55e; }
          .negative { color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PAYSLIP</h1>
          <p>${data.month} ${data.year}</p>
        </div>
        
        <div class="content">
          <div class="info-box">
            <strong>Employee:</strong> ${data.employeeName}<br>
            <strong>Period:</strong> ${data.month} ${data.year}
          </div>
          
          <div class="section">
            <div class="section-title">ATTENDANCE SUMMARY</div>
            <table>
              <tr><td>Working Days</td><td>${data.workingDays}</td></tr>
              <tr><td>Present Days</td><td>${data.presentDays}</td></tr>
              <tr><td>Absent Days</td><td>${data.absentDays}</td></tr>
              <tr><td>Leave Days</td><td>${data.leaveCount}</td></tr>
              <tr><td>Late Arrivals</td><td>${data.lateDays} days (${data.totalLateMinutes} min)</td></tr>
              <tr><td>Escalations</td><td>${data.escalationCount}</td></tr>
            </table>
          </div>
          
          <div class="section">
            <div class="section-title earnings">EARNINGS</div>
            <table>
              <tr><td>Base Salary</td><td>${formatCurrency(data.baseSalary)}</td></tr>
              <tr><td>Sales Commission (1%)</td><td class="positive">${formatCurrency(data.salesCommission)}</td></tr>
              <tr><td>Attendance Bonus</td><td class="positive">${formatCurrency(data.attendanceBonus)}</td></tr>
              <tr class="total-row"><td>Total Earnings</td><td>${formatCurrency(data.grossSalary)}</td></tr>
            </table>
          </div>
          
          <div class="section">
            <div class="section-title deductions">DEDUCTIONS</div>
            <table>
              <tr><td>Late Arrival Deduction</td><td class="negative">${formatCurrency(data.lateDeduction)}</td></tr>
              <tr><td>Absence Deduction</td><td class="negative">${formatCurrency(data.absenceDeduction)}</td></tr>
              <tr><td>Escalation Penalty</td><td class="negative">${formatCurrency(data.escalationPenalty)}</td></tr>
              <tr class="total-row"><td>Total Deductions</td><td class="negative">${formatCurrency(data.totalDeductions)}</td></tr>
            </table>
          </div>
          
          <div class="net-salary">
            <span>NET SALARY</span>
            <span>${formatCurrency(data.netSalary)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>This is a computer-generated payslip from ${emailConfig.companyName}.</p>
          <p>For any queries, please contact HR.</p>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail(data.tenant_id, {
      from: buildFromAddress(emailConfig, 'payroll'),
      to: [data.employeeEmail],
      subject: `Payslip for ${data.month} ${data.year}`,
      html: emailHtml,
    });
    
    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending payslip email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
