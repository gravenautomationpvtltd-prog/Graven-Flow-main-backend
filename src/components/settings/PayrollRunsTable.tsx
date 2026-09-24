import { useState } from 'react';
import { usePayrollRuns, useEmployeePayroll, useSendPayslipEmail, useApprovePayroll, useRejectPayroll, useFinalizePayroll } from '@/hooks/usePayroll';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Loader2, Download, Mail, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';
import { generatePayslipPDF, getMonthName } from '@/lib/payslip-pdf';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  processing: { label: 'Processing', variant: 'secondary' },
  pending_approval: { label: 'Pending Approval', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  completed: { label: 'Completed', variant: 'default' },
};

export function PayrollRunsTable() {
  const { data: payrollRuns, isLoading } = usePayrollRuns();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunPeriod, setSelectedRunPeriod] = useState<{ month: number; year: number } | null>(null);
  const { data: employeePayrolls } = useEmployeePayroll(selectedRunId);
  const sendPayslipEmail = useSendPayslipEmail();
  const approvePayroll = useApprovePayroll();
  const rejectPayroll = useRejectPayroll();
  const finalizePayroll = useFinalizePayroll();
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectRunId, setRejectRunId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleViewDetails = (runId: string, month: number, year: number) => {
    setSelectedRunId(runId);
    setSelectedRunPeriod({ month, year });
  };

  const handleApprove = async (runId: string) => {
    await approvePayroll.mutateAsync(runId);
  };

  const handleOpenRejectDialog = (runId: string) => {
    setRejectRunId(runId);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectRunId || !rejectionReason.trim()) return;
    await rejectPayroll.mutateAsync({ payrollRunId: rejectRunId, reason: rejectionReason });
    setRejectDialogOpen(false);
    setRejectRunId(null);
    setRejectionReason('');
  };

  const handleFinalize = async (runId: string) => {
    await finalizePayroll.mutateAsync(runId);
  };

  const getPayslipData = (ep: NonNullable<typeof employeePayrolls>[number]) => {
    if (!selectedRunPeriod) return null;
    
    return {
      employeeName: ep.profiles?.full_name || 'Unknown',
      employeeEmail: ep.profiles?.email || '',
      month: getMonthName(selectedRunPeriod.month),
      year: selectedRunPeriod.year,
      baseSalary: Number(ep.base_salary),
      workingDays: ep.working_days,
      presentDays: ep.present_days,
      absentDays: ep.absent_days,
      lateDays: ep.late_days,
      totalLateMinutes: ep.total_late_minutes,
      lateDeduction: Number(ep.late_deduction),
      absenceDeduction: Number(ep.absence_deduction),
      escalationCount: ep.escalation_count,
      escalationPenalty: Number(ep.escalation_penalty),
      leaveCount: ep.leave_count,
      attendanceBonus: Number(ep.attendance_bonus),
      salesCommission: Number(ep.sales_commission),
      grossSalary: Number(ep.gross_salary),
      totalDeductions: Number(ep.total_deductions),
      netSalary: Number(ep.net_salary),
    };
  };

  const handleDownloadPayslip = (ep: NonNullable<typeof employeePayrolls>[number]) => {
    const data = getPayslipData(ep);
    if (data) generatePayslipPDF(data);
  };

  const handleEmailPayslip = async (ep: NonNullable<typeof employeePayrolls>[number]) => {
    const data = getPayslipData(ep);
    if (!data || !data.employeeEmail) return;
    
    setSendingEmailFor(ep.id);
    try {
      await sendPayslipEmail.mutateAsync(data);
    } finally {
      setSendingEmailFor(null);
    }
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || { label: status, variant: 'secondary' as const };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!payrollRuns || payrollRuns.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No payroll runs yet. Generate your first payroll.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Employees</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">Deductions</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead>Approved By</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payrollRuns.map((run) => {
            const config = getStatusConfig(run.status);
            return (
              <TableRow key={run.id}>
                <TableCell className="font-medium">
                  {months[run.month - 1]} {run.year}
                </TableCell>
                <TableCell>
                  <Badge variant={config.variant}>
                    {config.label}
                  </Badge>
                  {run.rejection_reason && (
                    <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate" title={run.rejection_reason}>
                      {run.rejection_reason}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right">{run.total_employees}</TableCell>
                <TableCell className="text-right">₹{Number(run.total_gross).toLocaleString()}</TableCell>
                <TableCell className="text-right text-destructive">
                  -₹{Number(run.total_deductions).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-medium">
                  ₹{Number(run.total_net).toLocaleString()}
                </TableCell>
                <TableCell>
                  {run.approver?.full_name || '-'}
                  {run.approved_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(run.approved_at), 'dd MMM yyyy')}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleViewDetails(run.id, run.month, run.year)}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    {run.status === 'pending_approval' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApprove(run.id)}
                          disabled={approvePayroll.isPending}
                          title="Approve"
                          className="text-green-600 hover:text-green-700"
                        >
                          {approvePayroll.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenRejectDialog(run.id)}
                          title="Reject"
                          className="text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    
                    {run.status === 'approved' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFinalize(run.id)}
                        disabled={finalizePayroll.isPending}
                        title="Finalize & Process"
                        className="text-primary hover:text-primary"
                      >
                        {finalizePayroll.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlayCircle className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!selectedRunId} onOpenChange={() => { setSelectedRunId(null); setSelectedRunPeriod(null); }}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Payroll Details - {selectedRunPeriod ? `${getMonthName(selectedRunPeriod.month)} ${selectedRunPeriod.year}` : ''}
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Late Ded.</TableHead>
                <TableHead className="text-right">Abs. Ded.</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Bonus</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeePayrolls?.map((ep) => (
                <TableRow key={ep.id}>
                  <TableCell className="font-medium">
                    {ep.profiles?.full_name || 'Unknown'}
                  </TableCell>
                  <TableCell className="text-right">₹{Number(ep.base_salary).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{ep.present_days}/{ep.working_days}</TableCell>
                  <TableCell className="text-right text-destructive">
                    -₹{Number(ep.late_deduction).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    -₹{Number(ep.absence_deduction).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    +₹{Number(ep.sales_commission).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    +₹{Number(ep.attendance_bonus).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₹{Number(ep.net_salary).toLocaleString()}
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadPayslip(ep)}
                      title="Download Payslip"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEmailPayslip(ep)}
                      disabled={sendingEmailFor === ep.id || !ep.profiles?.email}
                      title="Email Payslip"
                    >
                      {sendingEmailFor === ep.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payroll</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this payroll run.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmReject}
              disabled={!rejectionReason.trim() || rejectPayroll.isPending}
            >
              {rejectPayroll.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
