import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyAmount, getCurrencySymbol, type CurrencyCode } from './currency-utils';
import gravenLogo from '@/assets/graven-logo.png';
import type { QuotationVersion, QuotationVersionItem } from '@/hooks/useQuotationVersions';
import type { QuotationWithDetails } from '@/hooks/useQuotations';
import type { TenantBranding } from '@/hooks/useTenantBranding';

const COMPANY = {
  name: 'GRAVEN AUTOMATION PRIVATE LIMITED',
  address1: '7/25, Tower F, 2nd Floor',
  address2: 'Kirti Nagar Industrial Area',
  address3: 'New Delhi 110015',
  gstin: '07AAKCG1025G1ZX',
  stateCode: '07',
  stateName: 'Delhi',
  phones: ['7905350134', '9919089567'],
  email: 'info@gravenautomation.com'
};

function formatDateIndian(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatCurrency(amount: number, currencyCode: CurrencyCode = 'INR'): string {
  return formatCurrencyAmount(amount, currencyCode);
}

export interface CompanyDefaultsOptions {
  defaultPhone?: string;
  defaultEmail?: string;
}

export function downloadVersionPDF(
  version: QuotationVersion,
  currentQuotation: QuotationWithDetails,
  companyDefaults?: CompanyDefaultsOptions,
  tenantBranding?: TenantBranding
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  const currency = (version.currency as CurrencyCode) || 'INR';

  // Resolve company info
  const co = {
    name: tenantBranding?.companyName || COMPANY.name,
    address1: tenantBranding?.address1 || COMPANY.address1,
    address2: tenantBranding?.address2 || COMPANY.address2,
    address3: tenantBranding?.address3 || COMPANY.address3,
    gstin: tenantBranding?.gstin || COMPANY.gstin,
    stateCode: tenantBranding?.stateCode || COMPANY.stateCode,
    stateName: tenantBranding?.stateName || COMPANY.stateName,
    phones: tenantBranding?.phones || COMPANY.phones,
    email: tenantBranding?.email || COMPANY.email,
  };

  let y = margin;

  // Title with version number
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`QUOTATION (Version ${version.version_number})`, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Company header
  const headerHeight = 30;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, headerHeight, 'S');

  // Logo
  try {
    const logoSrc = tenantBranding?.logoBase64 || gravenLogo;
    doc.addImage(logoSrc, 'PNG', margin + 3, y + 3, 12, 12);
  } catch (e) {
    // Logo failed
  }

  const companyX = margin + 18;
  let companyY = y + 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(co.name, companyX, companyY);
  companyY += 4;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${co.address1}, ${co.address2}, ${co.address3}`, companyX, companyY);
  companyY += 3;
  doc.text(`GSTIN: ${co.gstin} | State: ${co.stateName} (${co.stateCode})`, companyX, companyY);
  companyY += 3;
  
  const phone = companyDefaults?.defaultPhone || co.phones[0];
  const email = companyDefaults?.defaultEmail || co.email;
  doc.text(`Phone: ${phone} | Email: ${email}`, companyX, companyY);

  y += headerHeight + 5;

  // Quotation info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Quotation No: ${currentQuotation.quotation_number}`, margin, y);
  doc.text(`Version: ${version.version_number}`, margin + 80, y);
  doc.text(`Date: ${formatDateIndian(version.created_at)}`, margin + 130, y);
  y += 6;

  // Customer info
  const customer = currentQuotation.customer;
  if (customer) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${customer.company_name}`, margin, y);
    y += 4;
    if (customer.address) {
      doc.text(`Address: ${[customer.address, customer.city, customer.state].filter(Boolean).join(', ')}`, margin, y);
      y += 4;
    }
    if (customer.gst_number) {
      doc.text(`GSTIN: ${customer.gst_number}`, margin, y);
      y += 4;
    }
  }
  y += 3;

  // Items table
  const items = version.items_snapshot || [];
  const tableBody = items.map((item, index) => [
    (index + 1).toString(),
    item.description || '',
    item.hsn_code || '',
    item.quantity?.toString() || '0',
    item.unit || 'Nos',
    formatCurrency(item.rate || 0, currency),
    `${item.discount_percent || 0}%`,
    `${item.tax_percent || 0}%`,
    formatCurrency(item.amount || 0, currency)
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'HSN', 'Qty', 'Unit', 'Rate', 'Disc%', 'Tax%', 'Amount']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 50 },
      2: { cellWidth: 18 },
      3: { cellWidth: 12, halign: 'right' },
      4: { cellWidth: 12 },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 14, halign: 'right' },
      7: { cellWidth: 14, halign: 'right' },
      8: { cellWidth: 25, halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // Totals
  const totalsX = pageWidth - margin - 60;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsX, y);
  doc.text(formatCurrency(version.subtotal || 0, currency), pageWidth - margin, y, { align: 'right' });
  y += 4;

  doc.text('Discount:', totalsX, y);
  doc.text(`-${formatCurrency(version.total_discount || 0, currency)}`, pageWidth - margin, y, { align: 'right' });
  y += 4;

  doc.text('Tax:', totalsX, y);
  doc.text(formatCurrency(version.total_tax || 0, currency), pageWidth - margin, y, { align: 'right' });
  y += 4;

  doc.setLineWidth(0.3);
  doc.line(totalsX, y, pageWidth - margin, y);
  y += 3;

  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', totalsX, y);
  doc.text(formatCurrency(version.grand_total || 0, currency), pageWidth - margin, y, { align: 'right' });

  // Footer note
  y += 10;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100);
  doc.text(`This is version ${version.version_number} of quotation ${currentQuotation.quotation_number}`, margin, y);
  doc.text(`Archived on ${formatDateIndian(version.created_at)}`, margin, y + 3);

  // Save
  const filename = `${currentQuotation.quotation_number}_v${version.version_number}.pdf`;
  doc.save(filename);
}
