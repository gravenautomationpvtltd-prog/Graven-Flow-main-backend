import jsPDF from 'jspdf';

interface EmployeePayrollData {
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
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function generatePayslipPDF(data: EmployeePayrollData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.month} ${data.year}`, pageWidth / 2, 32, { align: 'center' });
  
  // Company Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Graven Automation', 20, 55);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Delhi | Lucknow', 20, 62);
  
  // Employee Info Box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, 70, pageWidth - 40, 30, 3, 3, 'FD');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee:', 25, 82);
  doc.setFont('helvetica', 'normal');
  doc.text(data.employeeName, 55, 82);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Email:', 25, 92);
  doc.setFont('helvetica', 'normal');
  doc.text(data.employeeEmail, 55, 92);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Period:', 120, 82);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.month} ${data.year}`, 145, 82);
  
  // Attendance Summary
  let yPos = 115;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('ATTENDANCE SUMMARY', 20, yPos);
  
  yPos += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  const attendanceData = [
    ['Working Days', data.workingDays.toString()],
    ['Present Days', data.presentDays.toString()],
    ['Absent Days', data.absentDays.toString()],
    ['Leave Days', data.leaveCount.toString()],
    ['Late Arrivals', `${data.lateDays} days (${data.totalLateMinutes} min)`],
    ['Escalations', data.escalationCount.toString()],
  ];
  
  attendanceData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, 25, yPos);
    doc.text(value, 100, yPos);
    yPos += 7;
  });
  
  // Earnings
  yPos += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('EARNINGS', 20, yPos);
  
  yPos += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  const earningsData = [
    ['Base Salary', formatCurrency(data.baseSalary)],
    ['Sales Commission (1%)', formatCurrency(data.salesCommission)],
    ['Attendance Bonus', formatCurrency(data.attendanceBonus)],
  ];
  
  earningsData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, 25, yPos);
    doc.text(value, pageWidth - 50, yPos, { align: 'right' });
    yPos += 7;
  });
  
  yPos += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('Total Earnings', 25, yPos);
  doc.text(formatCurrency(data.grossSalary), pageWidth - 50, yPos, { align: 'right' });
  
  // Deductions
  yPos += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(239, 68, 68);
  doc.text('DEDUCTIONS', 20, yPos);
  
  yPos += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  const deductionsData = [
    ['Late Arrival Deduction', formatCurrency(data.lateDeduction)],
    ['Absence Deduction (Pro-rata)', formatCurrency(data.absenceDeduction)],
    ['Escalation Penalty', formatCurrency(data.escalationPenalty)],
  ];
  
  deductionsData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, 25, yPos);
    doc.text(value, pageWidth - 50, yPos, { align: 'right' });
    yPos += 7;
  });
  
  yPos += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('Total Deductions', 25, yPos);
  doc.text(formatCurrency(data.totalDeductions), pageWidth - 50, yPos, { align: 'right' });
  
  // Net Salary Box
  yPos += 20;
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(20, yPos, pageWidth - 40, 25, 3, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('NET SALARY', 30, yPos + 16);
  doc.setFontSize(18);
  doc.text(formatCurrency(data.netSalary), pageWidth - 30, yPos + 16, { align: 'right' });
  
  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'This is a computer-generated payslip and does not require a signature.',
    pageWidth / 2,
    280,
    { align: 'center' }
  );
  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    pageWidth / 2,
    286,
    { align: 'center' }
  );
  
  // Save the PDF
  const fileName = `Payslip_${data.employeeName.replace(/\s+/g, '_')}_${data.month}_${data.year}.pdf`;
  doc.save(fileName);
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getMonthName(monthNumber: number): string {
  return months[monthNumber - 1] || '';
}
