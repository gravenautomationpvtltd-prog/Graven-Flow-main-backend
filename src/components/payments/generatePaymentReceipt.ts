import jsPDF from 'jspdf';
import { format } from 'date-fns';

export interface PaymentReceiptData {
  receiptNumber: string;
  paymentDate: Date;
  paymentId: string;
  orderId: string;
  companyName: string;
  companyLogo?: string | null;
  planType: string;
  userCount: number;
  pricePerUser: number;
  totalAmount: number;
  currency: string;
  customerName?: string;
  customerEmail?: string;
  periodStart?: Date;
  periodEnd?: Date;
  discountAmount?: number;
  couponCode?: string;
}

const PLAN_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  half_yearly: 'Half-Yearly (6 Months)',
  annual: 'Annual (12 Months)',
};

const PLAN_MONTHS: Record<string, number> = {
  monthly: 1,
  half_yearly: 6,
  annual: 12,
};

export function generatePaymentReceipt(data: PaymentReceiptData): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const primaryColor: [number, number, number] = [37, 99, 235]; // Blue
  const darkText: [number, number, number] = [17, 24, 39];
  const mutedText: [number, number, number] = [107, 114, 128];
  const borderColor: [number, number, number] = [229, 231, 235];

  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Company name in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName, margin, 18);

  // Receipt title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('PAYMENT RECEIPT', margin, 30);

  // Receipt number on right
  doc.setFontSize(10);
  doc.text(`#${data.receiptNumber}`, pageWidth - margin, 30, { align: 'right' });

  y = 55;

  // Receipt details section
  doc.setTextColor(...darkText);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Receipt Details', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.setFontSize(9);

  const details = [
    ['Date', format(data.paymentDate, 'dd MMM yyyy, hh:mm a')],
    ['Payment ID', data.paymentId],
    ['Order ID', data.orderId],
    ['Status', 'PAID'],
  ];

  details.forEach(([label, value]) => {
    doc.setTextColor(...mutedText);
    doc.text(label, margin, y);
    doc.setTextColor(...darkText);
    doc.text(value, margin + 45, y);
    y += 6;
  });

  y += 5;

  // Divider
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Customer info (if available)
  if (data.customerName || data.customerEmail) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkText);
    doc.setFontSize(10);
    doc.text('Billed To', margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (data.customerName) {
      doc.text(data.customerName, margin, y);
      y += 5;
    }
    if (data.customerEmail) {
      doc.setTextColor(...mutedText);
      doc.text(data.customerEmail, margin, y);
      y += 5;
    }
    y += 8;
  }

  // Subscription details table
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.setFontSize(10);
  doc.text('Subscription Details', margin, y);
  y += 8;

  // Table header
  doc.setFillColor(249, 250, 251);
  doc.rect(margin, y - 4, contentWidth, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('DESCRIPTION', margin + 3, y);
  doc.text('QTY', margin + contentWidth * 0.55, y);
  doc.text('RATE', margin + contentWidth * 0.7, y);
  doc.text('AMOUNT', pageWidth - margin - 3, y, { align: 'right' });
  y += 8;

  // Table row
  const planLabel = PLAN_LABELS[data.planType] || data.planType;
  const months = PLAN_MONTHS[data.planType] || 1;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkText);
  doc.setFontSize(9);
  doc.text(`${planLabel} Plan`, margin + 3, y);
  doc.setTextColor(...mutedText);
  doc.setFontSize(8);
  doc.text(`${data.userCount} user(s) × ${months} month(s)`, margin + 3, y + 4.5);

  doc.setTextColor(...darkText);
  doc.setFontSize(9);
  doc.text(`${data.userCount}`, margin + contentWidth * 0.55, y);
  doc.text(`₹${data.pricePerUser.toLocaleString('en-IN')}/mo`, margin + contentWidth * 0.7, y);
  doc.text(`₹${data.totalAmount.toLocaleString('en-IN')}`, pageWidth - margin - 3, y, { align: 'right' });
  y += 14;

  // Divider
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Discount row (if applicable)
  if (data.discountAmount && data.discountAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129); // emerald
    doc.text(`Discount${data.couponCode ? ` (${data.couponCode})` : ''}`, margin + 3, y);
    doc.text(`-₹${data.discountAmount.toLocaleString('en-IN')}`, pageWidth - margin - 3, y, { align: 'right' });
    y += 8;
  }

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...darkText);
  doc.text('Total Paid', margin + 3, y);
  doc.text(`₹${data.totalAmount.toLocaleString('en-IN')}`, pageWidth - margin - 3, y, { align: 'right' });
  y += 12;

  // Subscription period
  if (data.periodStart && data.periodEnd) {
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(margin, y - 4, contentWidth, 16, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...primaryColor);
    doc.text('Subscription Period', margin + 5, y + 1);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${format(data.periodStart, 'dd MMM yyyy')} — ${format(data.periodEnd, 'dd MMM yyyy')}`,
      margin + 5,
      y + 7
    );
    y += 20;
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 25;
  doc.setDrawColor(...borderColor);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text('This is a computer-generated receipt and does not require a signature.', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Generated on ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, pageWidth / 2, footerY + 4, { align: 'center' });

  return doc;
}

export function downloadPaymentReceipt(data: PaymentReceiptData) {
  const doc = generatePaymentReceipt(data);
  doc.save(`Payment_Receipt_${data.receiptNumber}.pdf`);
}
