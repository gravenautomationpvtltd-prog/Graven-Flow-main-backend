import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { convertAmountToWords, formatCurrencyAmount, getCurrencySymbol, type CurrencyCode } from './currency-utils';
import gravenLogo from '@/assets/graven-logo.png';
import type { QuotationWithDetails as HookQuotationWithDetails } from '@/hooks/useQuotations';
import type { TenantBranding } from '@/hooks/useTenantBranding';

// Company details - fallback defaults
const COMPANY = {
  name: 'GRAVEN AUTOMATION PRIVATE LIMITED',
  address1: '7/25, Tower F, 2nd Floor',
  address2: 'Kirti Nagar Industrial Area',
  address3: 'New Delhi 110015',
  gstin: '07AAKCG1025G1ZX',
  stateCode: '07',
  stateName: 'Delhi',
  phones: ['7905350134', '9919089567'],
  email: 'info@gravenautomation.com',
  bank: {
    name: 'ICICI BANK',
    accountNo: '777705098567',
    branch: 'JANKIPURAM EXTN.,LUCKNOW',
    ifsc: 'ICIC0004074'
  }
};

const DEFAULT_DECLARATIONS = [
  'Payment Terms: 100% Advance against PI.',
  'Dispatch Time: 2-3 Weeks (MAY VARY).',
  'Freight Charges: Freight will be charged extra as per actual.',
  'Jurisdiction: All disputes under Lucknow jurisdiction only.',
  'As per brand warranty',
  'Once goods sold will not be taken back'
];

function formatCurrency(amount: number, currencyCode: CurrencyCode = 'INR'): string {
  return formatCurrencyAmount(amount, currencyCode);
}

function formatDateIndian(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function getStateCode(gstin?: string | null): string {
  if (!gstin || gstin.length < 2) return '';
  return gstin.substring(0, 2);
}

function getStateName(stateCode: string): string {
  const states: Record<string, string> = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
    '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
    '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
    '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka', '32': 'Kerala',
    '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh'
  };
  return states[stateCode] || '';
}

export interface QuotationItem {
  id?: string;
  description: string;
  product_description?: string | null;
  hsn_code?: string | null;
  quantity: number;
  rate: number;
  unit?: string | null;
  discount_percent?: number | null;
  tax_percent?: number | null;
  amount: number;
  tax_amount?: number | null;
  lead_time_days?: number | null;
  model_number?: string | null;
  product_id?: string | null;
}

function normalizeWhitespace(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function stripModelPrefix(description: string, modelNumber: string): string {
  if (!modelNumber) return description.trim();
  const desc = description.trim();
  if (desc.toUpperCase().startsWith(modelNumber.toUpperCase())) {
    return desc.slice(modelNumber.length).replace(/^[\s\-–:]+/, '').trim();
  }
  return desc;
}

function collapseRepeatedDashDescription(description: string): string {
  const parts = description.split(' - ').map(part => normalizeWhitespace(part)).filter(Boolean);
  if (parts.length >= 2 && parts.every(part => part.toUpperCase() === parts[0].toUpperCase())) {
    return parts[0];
  }
  return description.trim();
}

import { pickBestDescription } from './description-utils';

function getPrintableItemLines(item: QuotationItem): { code: string; description: string } {
  const modelNumber = item.model_number?.trim() || '';
  const catalogDescription = normalizeWhitespace(item.product_description);
  const itemDescription = collapseRepeatedDashDescription(normalizeWhitespace(item.description));

  if (modelNumber) {
    const cleanCatalog = stripModelPrefix(catalogDescription, modelNumber);
    const cleanItem = stripModelPrefix(itemDescription, modelNumber);
    // Prefer the longer/non-truncated of the two so a broken snapshot doesn't win.
    const description = pickBestDescription(cleanItem, cleanCatalog, modelNumber);
    return { code: modelNumber, description };
  }

  const descParts = itemDescription.split('\n').map(part => part.trim()).filter(Boolean);
  if (descParts.length > 1) {
    return { code: descParts[0], description: descParts.slice(1).join(' ') };
  }

  if (itemDescription.includes(' - ')) {
    const dashParts = itemDescription.split(' - ').map(part => part.trim()).filter(Boolean);
    return { code: dashParts[0] || itemDescription, description: dashParts.slice(1).join(' - ') };
  }

  return { code: itemDescription, description: '' };
}

// Re-export the type from useQuotations for compatibility
export type QuotationWithDetails = HookQuotationWithDetails;

export interface InvoiceOptions {
  invoiceNumber?: string;
  invoiceDate?: string;
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  buyersOrderNo?: string;
  orderDate?: string;
  dispatchDocNo?: string;
  dispatchedThrough?: string;
  destination?: string;
  billOfLading?: string;
  motorVehicleNo?: string;
  consignee?: {
    company_name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gst_number?: string | null;
  };
}

export interface CompanyDefaultsOptions {
  defaultPhone?: string;
  defaultEmail?: string;
}

export interface GeneratePDFOptions {
  documentType: 'quotation' | 'proforma' | 'invoice' | 'delivery_challan';
  quotation: QuotationWithDetails;
  invoiceOptions?: InvoiceOptions;
  companyDefaults?: CompanyDefaultsOptions;
  tenantBranding?: TenantBranding;
}

export function generateDocumentPDF({ documentType, quotation, invoiceOptions, companyDefaults, tenantBranding }: GeneratePDFOptions): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  const isInvoice = documentType === 'invoice';
  const currency = (quotation.currency as CurrencyCode) || 'INR';
  const currencySymbol = getCurrencySymbol(currency);
  
  // Resolve company info from tenant branding or defaults
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
  
  doc.setFont('helvetica');
  
  // ============= TITLE (centered, bold, 14pt) =============
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const title = documentType === 'proforma' ? 'PROFORMA INVOICE' : 
                documentType === 'invoice' ? 'Tax Invoice' :
                documentType === 'delivery_challan' ? 'DELIVERY CHALLAN' : 'QUOTATION';
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 8;
  
  // ============= IRN SECTION (Invoice only) =============
  if (isInvoice && invoiceOptions) {
    const irnY = y;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    // IRN details on left
    const irn = invoiceOptions.irn || 'd5999377d76ce031d4bbdafbd2172db73eaee139bdd\nee422dc9ce1b44841720c';
    const ackNo = invoiceOptions.ackNo || '172519036301826';
    const ackDate = invoiceOptions.ackDate || invoiceOptions.invoiceDate ? formatDateIndian(invoiceOptions.invoiceDate!) : '';
    
    doc.text(`IRN         : ${irn.split('\n')[0]}`, margin, irnY);
    if (irn.includes('\n')) {
      doc.text(`              ${irn.split('\n')[1]}`, margin, irnY + 3);
    }
    doc.text(`Ack No.   : ${ackNo}`, margin, irnY + 6);
    doc.text(`Ack Date : ${ackDate}`, margin, irnY + 9);
    
    // e-Invoice label + QR placeholder on right
    doc.setFont('helvetica', 'bold');
    doc.text('e-Invoice', pageWidth - margin - 20, irnY);
    
    // QR placeholder box
    doc.setFont('helvetica', 'normal');
    doc.rect(pageWidth - margin - 25, irnY + 2, 20, 20, 'S');
    doc.setFontSize(6);
    doc.text('QR Code', pageWidth - margin - 15, irnY + 13, { align: 'center' });
    
    y += 25;
  }
  
  // ============= MAIN TABLE START =============
  const tableStartY = y;
  
  // ============= HEADER ROW (55% left | 45% right) =============
  const headerHeight = 38;
  const leftColWidth = contentWidth * 0.55;
  const rightColWidth = contentWidth * 0.45;
  
  // Draw outer border for header
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, headerHeight, 'S');
  
  // Vertical line separating left and right
  doc.line(margin + leftColWidth, y, margin + leftColWidth, y + headerHeight);
  
  // === LEFT SIDE: Logo + Company Info ===
  const logoX = margin + 3;
  const logoY = y + 3;
  const logoWidth = 15; // 60px ≈ 15mm
  
  try {
    const logoSrc = tenantBranding?.logoBase64 || gravenLogo;
    doc.addImage(logoSrc, 'PNG', logoX, logoY, logoWidth, logoWidth);
  } catch (e) {
    // Logo failed, continue without it
  }
  
  const companyX = margin + logoWidth + 8; // margin-right: 15px ≈ 4mm
  let companyY = y + 5;
  
  // Company name (h2, 11pt bold) - wrap text to prevent overflow
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const maxCompanyNameWidth = leftColWidth - logoWidth - 15;
  const companyNameLines = doc.splitTextToSize(co.name, maxCompanyNameWidth);
  companyNameLines.forEach((line: string) => {
    doc.text(line, companyX, companyY);
    companyY += 4;
  });
  
  // Company details (line-height: 1.3)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(co.address1, companyX, companyY);
  companyY += 3;
  doc.text(co.address2, companyX, companyY);
  companyY += 3;
  doc.text(co.address3, companyX, companyY);
  companyY += 4;
  doc.text(`GSTIN/UIN: ${co.gstin}`, companyX, companyY);
  companyY += 3;
  doc.text(`State Name : ${co.stateName}, Code : ${co.stateCode}`, companyX, companyY);
  companyY += 3;
  // Use creator's contact info if available, fallback to company defaults, then company values
  const creatorPhone = quotation.created_by_profile?.phone || 
                       companyDefaults?.defaultPhone || 
                       co.phones[0];
  const creatorEmail = quotation.created_by_profile?.email || 
                       companyDefaults?.defaultEmail || 
                       co.email;
  doc.text(`Contact : ${creatorPhone}`, companyX, companyY);
  companyY += 3;
  doc.text(`E-Mail : ${creatorEmail}`, companyX, companyY);
  
  // === RIGHT SIDE: Grid (4-row for quotation/PI, 8-row for invoice) ===
  const gridX = margin + leftColWidth;
  const gridRows = isInvoice ? 8 : 4;
  const gridRowHeight = headerHeight / gridRows;
  const gridCol1Width = rightColWidth * 0.5;
  const gridCol2Width = rightColWidth * 0.5;
  
  // Draw horizontal lines for grid rows
  for (let i = 1; i < gridRows; i++) {
    doc.line(gridX, y + (i * gridRowHeight), margin + contentWidth, y + (i * gridRowHeight));
  }
  // Vertical line between two columns
  doc.line(gridX + gridCol1Width, y, gridX + gridCol1Width, y + headerHeight);
  
  doc.setFontSize(7);
  
  if (isInvoice && invoiceOptions) {
    // 8-row grid for invoice
    const rowH = gridRowHeight;
    const textOffsetY = rowH * 0.7;
    
    // Row 1: Invoice No. | Dated
    doc.setFont('helvetica', 'normal');
    doc.text('Invoice No.', gridX + 2, y + 3);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceOptions.invoiceNumber || '', gridX + 2, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('Dated', gridX + gridCol1Width + 2, y + 3);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceOptions.invoiceDate ? formatDateIndian(invoiceOptions.invoiceDate) : '', gridX + gridCol1Width + 2, y + 6);
    
    // Row 2: Delivery Note | Mode/Terms of Payment
    const row2Y = y + rowH;
    doc.setFont('helvetica', 'normal');
    doc.text('Delivery Note', gridX + 2, row2Y + 3);
    doc.text('Mode/Terms of Payment', gridX + gridCol1Width + 2, row2Y + 3);
    
    // Row 3: Reference No. & Date | Other References
    const row3Y = y + (rowH * 2);
    doc.text('Reference No. & Date.', gridX + 2, row3Y + 3);
    doc.text('Other References', gridX + gridCol1Width + 2, row3Y + 3);
    
    // Row 4: Buyer's Order No. | Dated
    const row4Y = y + (rowH * 3);
    doc.text("Buyer's Order No.", gridX + 2, row4Y + 3);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceOptions.buyersOrderNo || '', gridX + 2, row4Y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('Dated', gridX + gridCol1Width + 2, row4Y + 3);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceOptions.orderDate ? formatDateIndian(invoiceOptions.orderDate) : '', gridX + gridCol1Width + 2, row4Y + 6);
    
    // Row 5: Dispatch Doc No. | Delivery Note Date
    const row5Y = y + (rowH * 4);
    doc.setFont('helvetica', 'normal');
    doc.text('Dispatch Doc No.', gridX + 2, row5Y + 3);
    doc.text(invoiceOptions.dispatchDocNo || '', gridX + 2, row5Y + 6);
    doc.text('Delivery Note Date', gridX + gridCol1Width + 2, row5Y + 3);
    
    // Row 6: Dispatched through | Destination
    const row6Y = y + (rowH * 5);
    doc.text('Dispatched through', gridX + 2, row6Y + 3);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceOptions.dispatchedThrough || '', gridX + 2, row6Y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('Destination', gridX + gridCol1Width + 2, row6Y + 3);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceOptions.destination || '', gridX + gridCol1Width + 2, row6Y + 6);
    
    // Row 7: Bill of Lading/LR-RR No. | Motor Vehicle No.
    const row7Y = y + (rowH * 6);
    doc.setFont('helvetica', 'normal');
    doc.text('Bill of Lading/LR-RR No.', gridX + 2, row7Y + 3);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceOptions.billOfLading || '', gridX + 2, row7Y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('Motor Vehicle No.', gridX + gridCol1Width + 2, row7Y + 3);
    doc.text(invoiceOptions.motorVehicleNo || '', gridX + gridCol1Width + 2, row7Y + 6);
    
    // Row 8: Terms of Delivery | (empty)
    const row8Y = y + (rowH * 7);
    doc.text('Terms of Delivery', gridX + 2, row8Y + 3);
  } else {
    // 4-row grid for quotation/proforma
    const docNumberLabel = documentType === 'proforma' ? 'Voucher No.' :
                           documentType === 'delivery_challan' ? 'Delivery Challan No.' : 'Quotation No.';
    
    // Grid Row 1
    doc.setFont('helvetica', 'normal');
    doc.text(docNumberLabel, gridX + 2, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(quotation.quotation_number || '', gridX + 2, y + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Dated', gridX + gridCol1Width + 2, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDateIndian(quotation.created_at), gridX + gridCol1Width + 2, y + 8);
    
    // Grid Row 2
    const row2Y = y + gridRowHeight;
    doc.setFont('helvetica', 'normal');
    doc.text("Buyer's Ref./Order No.", gridX + 2, row2Y + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(quotation.quotation_number || '', gridX + 2, row2Y + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Mode/Terms of Payment', gridX + gridCol1Width + 2, row2Y + 4);
    doc.setFont('helvetica', 'bold');
    doc.text('100% ADVANCE AGAINST PI', gridX + gridCol1Width + 2, row2Y + 8);
    
    // Grid Row 3
    const row3Y = y + (gridRowHeight * 2);
    doc.setFont('helvetica', 'normal');
    doc.text('Dispatched through', gridX + 2, row3Y + 5);
    doc.text('Other References', gridX + gridCol1Width + 2, row3Y + 5);
    
    // Grid Row 4
    const row4Y = y + (gridRowHeight * 3);
    doc.text('Terms of Delivery', gridX + 2, row4Y + 5);
    doc.text('Destination', gridX + gridCol1Width + 2, row4Y + 5);
  }
  
  y += headerHeight;
  
  // ============= ADDRESS SECTION =============
  const customer = quotation.customer || null;
  const customerStateCode = customer?.gst_number ? getStateCode(customer.gst_number) : '';
  const customerStateName = customerStateCode ? getStateName(customerStateCode) : (customer?.state || '');
  
  // For invoices, use separate consignee if provided
  const consignee = isInvoice && invoiceOptions?.consignee ? invoiceOptions.consignee : customer;
  const consigneeStateCode = consignee?.gst_number ? getStateCode(consignee.gst_number) : '';
  const consigneeStateName = consigneeStateCode ? getStateName(consigneeStateCode) : (consignee?.state || '');
  
  // Build full address for consignee
  const consigneeAddressParts = [];
  if (consignee?.address) consigneeAddressParts.push(consignee.address);
  if (consignee?.city) consigneeAddressParts.push(consignee.city);
  if (consignee?.pincode) consigneeAddressParts.push(consignee.pincode);
  const consigneeFullAddress = consigneeAddressParts.join(', ').toUpperCase();
  
  // Build full address for buyer (customer)
  const buyerAddressParts = [];
  if (customer?.address) buyerAddressParts.push(customer.address);
  if (customer?.city) buyerAddressParts.push(customer.city);
  if (customer?.pincode) buyerAddressParts.push(customer.pincode);
  const buyerFullAddress = buyerAddressParts.join(', ').toUpperCase();
  
  const consigneeHeight = 24;
  const buyerHeight = 24;
  const totalAddressHeight = consigneeHeight + buyerHeight;
  
  // Left column for Consignee
  doc.rect(margin, y, leftColWidth, consigneeHeight, 'S');
  
  // Right column spans both rows (rowspan="2")
  doc.rect(margin + leftColWidth, y, rightColWidth, totalAddressHeight, 'S');
  
  // Consignee content
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Consignee (Ship to)', margin + 2, y + 4);
  
  let custY = y + 8;
  doc.setFont('helvetica', 'bold');
  doc.text((consignee?.company_name || '').toUpperCase(), margin + 2, custY);
  custY += 4;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const consigneeAddressLines = doc.splitTextToSize(consigneeFullAddress, leftColWidth - 6);
  consigneeAddressLines.slice(0, 2).forEach((line: string) => {
    doc.text(line, margin + 2, custY);
    custY += 3;
  });
  
  if (consigneeStateName || consigneeStateCode) {
    doc.text(`State Name : ${consigneeStateName}${consigneeStateCode ? `, Code : ${consigneeStateCode}` : ''}`, margin + 2, custY);
  }
  
  y += consigneeHeight;
  
  // Left column for Buyer (border-top merged with consignee bottom)
  doc.rect(margin, y, leftColWidth, buyerHeight, 'S');
  
  // Buyer content
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Buyer (Bill to)', margin + 2, y + 4);
  
  custY = y + 8;
  doc.setFont('helvetica', 'bold');
  doc.text((customer?.company_name || '').toUpperCase(), margin + 2, custY);
  custY += 4;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const buyerAddressLines = doc.splitTextToSize(buyerFullAddress, leftColWidth - 6);
  buyerAddressLines.slice(0, 2).forEach((line: string) => {
    doc.text(line, margin + 2, custY);
    custY += 3;
  });
  
  if (customer?.gst_number) {
    doc.text(`GSTIN/UIN  : ${customer.gst_number}`, margin + 2, custY);
    custY += 3;
  }
  if (customerStateName || customerStateCode) {
    doc.text(`State Name : ${customerStateName}${customerStateCode ? `, Code : ${customerStateCode}` : ''}`, margin + 2, custY);
  }
  
  y += buyerHeight;
  
  // ============= ITEMS TABLE USING AUTOTABLE =============
  const items = (quotation.items || []) as QuotationItem[];
  
  // Check if any item has a discount
  const hasAnyDiscount = items.some(item => item.discount_percent && item.discount_percent > 0);
  
  // Calculate totals
  let totalQty = 0;
  let totalTax = 0;
  let totalTaxableAmount = 0;
  items.forEach(item => {
    totalQty += item.quantity;
    totalTax += item.tax_amount || 0;
    const taxableAmount = item.amount - (item.tax_amount || 0);
    totalTaxableAmount += taxableAmount;
  });
  
  // Determine tax type (interstate = IGST, intrastate = CGST+SGST)
  // Helper function to check if a state/country is an Indian state
  const isIndianState = (state: string): boolean => {
    if (!state) return false;
    const indianStates = [
      'Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Kerala', 
      'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Telangana', 
      'Andhra Pradesh', 'Punjab', 'Haryana', 'Bihar', 'Odisha', 'Madhya Pradesh',
      'Chhattisgarh', 'Jharkhand', 'Assam', 'Goa', 'Himachal Pradesh', 
      'Uttarakhand', 'Jammu & Kashmir', 'Jammu and Kashmir', 'Sikkim', 'Tripura', 'Meghalaya',
      'Mizoram', 'Nagaland', 'Manipur', 'Arunachal Pradesh', 'Chandigarh',
      'Puducherry', 'Pondicherry', 'Ladakh', 'Dadra and Nagar Haveli',
      'Daman and Diu', 'Lakshadweep', 'Andaman and Nicobar Islands'
    ];
    return indianStates.some(s => s.toLowerCase() === state.toLowerCase().trim());
  };
  
  // Determine interstate status:
  // 1. If customer has GST, compare state codes
  // 2. If customer has no GST but has a state/country that's NOT an Indian state, treat as interstate/export
  const customerStateField = customer?.state || '';
  const isInterstate = customerStateCode 
    ? (customerStateCode !== co.stateCode)  // Has GST - compare state codes
    : (customerStateField !== '' && !isIndianState(customerStateField));  // No GST - check if foreign location
  
  // Prepare table body data - use 'any' type to support autoTable's CellInput including colSpan
  const tableData: any[][] = items.map((item, index) => {
    const taxableAmount = item.amount - (item.tax_amount || 0);
    
    // Build first line = model number (bold), second line = catalog description (italic).
    const { code: productCode, description: productDesc } = getPrintableItemLines(item);

    // Format: code on first line (bold), description on second line (italic)
    const formattedDesc = productDesc
      ? `${productCode}\n${productDesc}`
      : productCode;
    
    const row: any[] = [
      (index + 1).toString(),
      formattedDesc,
      item.hsn_code || '',
      `${item.quantity.toFixed(2)} ${item.unit || 'Nos'}`,
      formatCurrency(item.rate, currency),
      // Lead Time column - replaces "per" column
      item.lead_time_days ? `${item.lead_time_days}d` : '-',
    ];
    
    if (hasAnyDiscount) {
      row.push(item.discount_percent ? `${item.discount_percent}%` : '');
    }
    
    row.push(formatCurrency(taxableAmount, currency));
    
    return row;
  });
  
  // Add tax rows - label in Description column only (left-aligned with padding), amount in last column
  const taxLabelStyles = { fontStyle: 'bolditalic' as const, halign: 'left' as const, cellPadding: { left: 30 } };
  const taxAmountStyles = { fontStyle: 'bold' as const, halign: 'right' as const };
  
  if (totalTax > 0) {
    if (isInterstate) {
      // IGST row - 8 columns with discount, 7 without
      if (hasAnyDiscount) {
        tableData.push([
          '',  // Sl No.
          { content: 'OUTPUT IGST', styles: taxLabelStyles },  // Description
          '',  // HSN/SAC
          '',  // Quantity
          '',  // Rate
          '',  // per
          '',  // Disc %
          { content: formatCurrency(totalTax, currency), styles: taxAmountStyles }
        ]);
      } else {
        tableData.push([
          '',  // Sl No.
          { content: 'OUTPUT IGST', styles: taxLabelStyles },  // Description
          '',  // HSN/SAC
          '',  // Quantity
          '',  // Rate
          '',  // per
          { content: formatCurrency(totalTax, currency), styles: taxAmountStyles }
        ]);
      }
    } else {
      // CGST + SGST rows
      if (hasAnyDiscount) {
        tableData.push([
          '',  // Sl No.
          { content: 'OUTPUT CGST', styles: taxLabelStyles },  // Description
          '',  // HSN/SAC
          '',  // Quantity
          '',  // Rate
          '',  // per
          '',  // Disc %
          { content: formatCurrency(totalTax / 2, currency), styles: taxAmountStyles }
        ]);
        tableData.push([
          '',  // Sl No.
          { content: 'OUTPUT SGST', styles: taxLabelStyles },  // Description
          '',  // HSN/SAC
          '',  // Quantity
          '',  // Rate
          '',  // per
          '',  // Disc %
          { content: formatCurrency(totalTax / 2, currency), styles: taxAmountStyles }
        ]);
      } else {
        tableData.push([
          '',  // Sl No.
          { content: 'OUTPUT CGST', styles: taxLabelStyles },  // Description
          '',  // HSN/SAC
          '',  // Quantity
          '',  // Rate
          '',  // per
          { content: formatCurrency(totalTax / 2, currency), styles: taxAmountStyles }
        ]);
        tableData.push([
          '',  // Sl No.
          { content: 'OUTPUT SGST', styles: taxLabelStyles },  // Description
          '',  // HSN/SAC
          '',  // Quantity
          '',  // Rate
          '',  // per
          { content: formatCurrency(totalTax / 2, currency), styles: taxAmountStyles }
        ]);
      }
    }
  }
  
  // Define column widths based on whether discount column exists
  const columnStyles: Record<number, object> = hasAnyDiscount ? {
    0: { cellWidth: 10, halign: 'center' },      // Sl No.
    1: { cellWidth: 62 },                         // Description (auto-wrap)
    2: { cellWidth: 18, halign: 'center' },       // HSN/SAC
    3: { cellWidth: 20, halign: 'center' },       // Quantity
    4: { cellWidth: 22, halign: 'right' },        // Rate
    5: { cellWidth: 12, halign: 'center' },       // per
    6: { cellWidth: 12, halign: 'center' },       // Disc %
    7: { cellWidth: 24, halign: 'right' },        // Amount
  } : {
    0: { cellWidth: 10, halign: 'center' },      // Sl No.
    1: { cellWidth: 70 },                         // Description (auto-wrap)
    2: { cellWidth: 18, halign: 'center' },       // HSN/SAC
    3: { cellWidth: 20, halign: 'center' },       // Quantity
    4: { cellWidth: 24, halign: 'right' },        // Rate
    5: { cellWidth: 12, halign: 'center' },       // per
    6: { cellWidth: 26, halign: 'right' },        // Amount
  };
  
  const headColumns = hasAnyDiscount
    ? [['Sl\nNo.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'Lead\nTime', 'Disc.%', 'Amount']]
    : [['Sl\nNo.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'Lead\nTime', 'Amount']];
  
  // Track the number of actual item rows (before tax rows)
  const itemRowCount = items.length;
  
  // Column widths for manual vertical line drawing
  const colWidthsArray = hasAnyDiscount 
    ? [10, 62, 18, 20, 22, 12, 12, 24]
    : [10, 70, 18, 20, 24, 12, 26];
  
  // Generate table using autoTable
  autoTable(doc, {
    startY: y,
    head: headColumns,
    body: tableData,
    theme: 'plain',
    rowPageBreak: 'avoid',  // Prevent rows (especially tax rows) from splitting across pages
    styles: {
      fontSize: 7,
      cellPadding: 2,
      lineWidth: 0,              // Remove all cell borders
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fontStyle: 'normal',
      fillColor: [255, 255, 255],
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.2,            // Keep bottom border for header row
      lineColor: [0, 0, 0],
    },
    columnStyles: columnStyles,
    margin: { left: margin, right: margin, top: margin + 15 },
    tableLineWidth: 0.2,         // Keep outer table border
    tableLineColor: [0, 0, 0],
    didParseCell: (data) => {
      // Make description column first line bold
      if (data.section === 'body' && data.column.index === 1 && data.row.index < itemRowCount) {
        const cellText = data.cell.text.join('\n');
        const lines = cellText.split('\n');
        if (lines.length > 0) {
          // First line is product code (bold)
          data.cell.styles.fontStyle = 'bold';
        }
      }
      // Make quantity and amount columns bold
      if (data.section === 'body' && data.row.index < itemRowCount) {
        const amountColIdx = hasAnyDiscount ? 7 : 6;
        if (data.column.index === 3 || data.column.index === amountColIdx) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawCell: (data) => {
      // For description cells with multi-line content, make first line bold and rest italic
      if (data.section === 'body' && data.column.index === 1 && data.row.index < itemRowCount) {
        const cellText = String(data.cell.raw || '');
        const lines = cellText.split('\n');
        if (lines.length > 1) {
          // We need to redraw with proper styling
          const x = data.cell.x + 2;
          let textY = data.cell.y + 4;
          
          // Clear existing text by drawing white rectangle
          doc.setFillColor(255, 255, 255);
          doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, 'F');
          
          // Draw product code (bold)
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          const maxWidth = data.cell.width - 4;
          const codeLines = doc.splitTextToSize(lines[0], maxWidth) as string[];
          codeLines.forEach((line: string) => {
            doc.text(line, x, textY);
            textY += 3.5;
          });
          
          // Draw description (italic)
          if (lines.length > 1) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(6);
            const descText = lines.slice(1).join(' ');
            const descLines = doc.splitTextToSize(descText, maxWidth) as string[];
            descLines.forEach((line: string) => {
              doc.text(line, x, textY);
              textY += 3;
            });
          }
        }
      }
    },
    didDrawPage: (data) => {
      const pageNumber = data.pageNumber;
      
      // Add continuation header on pages after the first
      if (pageNumber > 1) {
        const docTitle = documentType === 'proforma' ? 'PROFORMA INVOICE' : 
                         documentType === 'invoice' ? 'Tax Invoice' :
                         documentType === 'delivery_challan' ? 'DELIVERY CHALLAN' : 'QUOTATION';
        const docNumber = quotation.quotation_number;
        const headerY = margin;
        
        // Document title with (Contd.)
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${docTitle} (Contd.)`, pageWidth / 2, headerY, { align: 'center' });
        
        // Reference number and page number below title
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Ref: ${docNumber}`, margin, headerY + 5);
        doc.text(`Page ${pageNumber}`, pageWidth - margin, headerY + 5, { align: 'right' });
      }
      
      // Draw vertical column separator lines manually
      // On page 1: use settings.startY (original table start)
      // On page 2+: use margin + 15 (where table actually starts after continuation header)
      const tableStartY = pageNumber > 1 
        ? (margin + 15)
        : ((data.settings.startY as number) || margin);
      
      // Get the actual table end position for THIS page only
      const tableEndY = data.cursor?.y || tableStartY;
      
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      
      // Draw vertical lines between columns
      let xPos = margin;
      for (let i = 0; i < colWidthsArray.length - 1; i++) {
        xPos += colWidthsArray[i];
        doc.line(xPos, tableStartY, xPos, tableEndY);
      }
    },
  });
  
  // Get final Y position after table
  y = (doc as any).lastAutoTable.finalY;
  
  // ============= TOTAL ROW =============
  const totalRowHeight = 8;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentWidth, totalRowHeight, 'S');
  
  // Calculate column positions for total row
  const totalCols = hasAnyDiscount 
    ? [10, 62, 18, 20, 22, 12, 12, 24]
    : [10, 70, 18, 20, 24, 12, 26];
  
  let colX = margin;
  for (let i = 0; i < totalCols.length - 1; i++) {
    colX += totalCols[i];
    doc.line(colX, y, colX, y + totalRowHeight);
  }
  
  // Total row content
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  
  // "Total" right-aligned in description column
  const descEndX = margin + totalCols[0] + totalCols[1];
  doc.text('Total', descEndX - 2, y + 5, { align: 'right' });
  
  // Total quantity (centered, bold) in qty column
  const qtyColX = descEndX + totalCols[2];
  doc.text(`${totalQty.toFixed(2)} Nos`, qtyColX + totalCols[3] / 2, y + 5, { align: 'center' });
  
  // Grand total in Amount column
  const grandTotal = quotation.grand_total || 0;
  doc.text(formatCurrency(grandTotal, currency), margin + contentWidth - 2, y + 5, { align: 'right' });
  
  y += totalRowHeight;
  
  // ============= AMOUNT IN WORDS =============
  const amountInWords = convertAmountToWords(grandTotal, currency);
  
  // Calculate available width for text (leave space for "E. & O.E" on right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const maxTextWidth = contentWidth - 30; // Reserve ~30mm for "E. & O.E" and padding
  const wrappedText = doc.splitTextToSize(amountInWords, maxTextWidth);
  const lineHeight = 4;
  const textLines = Array.isArray(wrappedText) ? wrappedText.length : 1;
  
  // Dynamic height based on number of lines (minimum 12mm for proper spacing)
  const amountWordsHeight = Math.max(12, 8 + (textLines * lineHeight));
  
  // === PAGE BREAK CHECK: Ensure Amount in Words + Footer fit on same page ===
  const footerSectionHeight = 55; // Footer height
  const footerBuffer = 10; // Buffer for "Computer Generated Document"
  const totalRequiredSpace = amountWordsHeight + footerSectionHeight + footerBuffer;
  const currentAvailableSpace = pageHeight - y;

  if (currentAvailableSpace < totalRequiredSpace) {
    doc.addPage();
    y = margin;
  }

  // Now draw the Amount in Words section
  doc.rect(margin, y, contentWidth, amountWordsHeight, 'S');
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Amount Chargeable (in words)', margin + 2, y + 4);
  
  // Amount in words (bold, wrapped)
  doc.setFont('helvetica', 'bold');
  if (Array.isArray(wrappedText)) {
    wrappedText.forEach((line: string, idx: number) => {
      doc.text(line, margin + 2, y + 9 + (idx * lineHeight));
    });
  } else {
    doc.text(wrappedText, margin + 2, y + 9);
  }
  
  // "E. & O.E" right-aligned, italic (at bottom of box)
  doc.setFont('helvetica', 'italic');
  doc.text('E. & O.E', margin + contentWidth - 2, y + amountWordsHeight - 2, { align: 'right' });
  
  y += amountWordsHeight;

  // ============= PAYMENT SCHEDULE (advance / balance) =============
  const advancePercentRaw = (quotation as any).advance_percent;
  const advanceAmountRaw = (quotation as any).advance_amount;
  const paymentRemark = ((quotation as any).payment_remark || '').trim();
  const advanceRemark = ((quotation as any).advance_remark || '').trim();
  const balanceRemark = ((quotation as any).balance_remark || '').trim();
  const hasAdvance =
    (advanceAmountRaw !== null && advanceAmountRaw !== undefined && Number(advanceAmountRaw) > 0) ||
    (advancePercentRaw !== null && advancePercentRaw !== undefined && Number(advancePercentRaw) > 0 && Number(advancePercentRaw) < 100);

  if (hasAdvance || paymentRemark) {
    const advanceAmount = advanceAmountRaw !== null && advanceAmountRaw !== undefined
      ? Number(advanceAmountRaw)
      : Math.round(((Number(advancePercentRaw) || 0) / 100) * grandTotal * 100) / 100;
    const balanceAmount = (quotation as any).balance_amount !== null && (quotation as any).balance_amount !== undefined
      ? Number((quotation as any).balance_amount)
      : Math.round((grandTotal - advanceAmount) * 100) / 100;
    const advancePct = advancePercentRaw !== null && advancePercentRaw !== undefined && Number(advancePercentRaw) > 0
      ? Number(advancePercentRaw)
      : (grandTotal > 0 ? Math.round((advanceAmount / grandTotal) * 100) : 0);
    const balancePct = Math.max(0, 100 - advancePct);

    const advanceLabel = `Advance Payable (${advancePct}%)${advanceRemark ? ` - ${advanceRemark}` : ''}`;
    const balanceLabel = `Balance Payable (${balancePct}%)${balanceRemark ? ` - ${balanceRemark}` : ''}`;
    const labelWidth = contentWidth - 40;
    const advanceLines = hasAdvance ? (doc.splitTextToSize(advanceLabel, labelWidth) as string[]) : [];
    const balanceLines = hasAdvance ? (doc.splitTextToSize(balanceLabel, labelWidth) as string[]) : [];

    const remarkLines: string[] = paymentRemark
      ? (doc.splitTextToSize(`Payment Remark: ${paymentRemark}`, contentWidth - 4) as string[])
      : [];
    const scheduleLineCount = advanceLines.length + balanceLines.length;
    const payHeight = 6 + scheduleLineCount * 4.5 + remarkLines.length * 4;

    if (pageHeight - y < payHeight + 60) {
      doc.addPage();
      y = margin;
    }

    doc.rect(margin, y, contentWidth, payHeight, 'S');
    let payY = y + 5;
    doc.setFontSize(7);

    if (hasAdvance) {
      doc.setFont('helvetica', 'bold');
      advanceLines.forEach((line, idx) => {
        doc.text(line, margin + 2, payY);
        if (idx === 0) {
          doc.text(formatCurrency(advanceAmount, currency), margin + contentWidth - 2, payY, { align: 'right' });
        }
        payY += 4.5;
      });
      balanceLines.forEach((line, idx) => {
        doc.text(line, margin + 2, payY);
        if (idx === 0) {
          doc.text(formatCurrency(balanceAmount, currency), margin + contentWidth - 2, payY, { align: 'right' });
        }
        payY += 4.5;
      });
    }

    if (remarkLines.length) {
      doc.setFont('helvetica', 'normal');
      remarkLines.forEach((line) => {
        doc.text(line, margin + 2, payY);
        payY += 4;
      });
    }


    y += payHeight;
  }

  
  // ============= HSN TAX ANALYSIS TABLE (Invoice only) =============
  if (isInvoice) {
    // Group items by HSN code
    const hsnGroups: Record<string, { taxableValue: number; taxRate: number; taxAmount: number }> = {};
    items.forEach(item => {
      const hsn = item.hsn_code || 'N/A';
      if (!hsnGroups[hsn]) {
        hsnGroups[hsn] = { taxableValue: 0, taxRate: item.tax_percent || 18, taxAmount: 0 };
      }
      // Use taxable amount (before tax) not total amount
      const taxableAmount = item.amount - (item.tax_amount || 0);
      hsnGroups[hsn].taxableValue += taxableAmount;
      hsnGroups[hsn].taxAmount += item.tax_amount || 0;
    });
    
    const hsnEntries = Object.entries(hsnGroups);
    const taxTableHeaderHeight = 12;
    const taxTableDataHeight = 6 * hsnEntries.length;
    const taxTableTotalHeight = 8;
    const taxTableHeight = taxTableHeaderHeight + taxTableDataHeight + taxTableTotalHeight;
    
    doc.rect(margin, y, contentWidth, taxTableHeight, 'S');
    
    if (isInterstate) {
      // IGST columns: HSN/SAC | Taxable Value | IGST Rate | IGST Amount | Total Tax Amount
      const taxColWidths = [
        contentWidth * 0.25, // HSN
        contentWidth * 0.20, // Taxable Value
        contentWidth * 0.15, // Rate
        contentWidth * 0.20, // Amount
        contentWidth * 0.20  // Total Tax
      ];
      
      // Draw column lines
      let tcX = margin;
      for (let i = 0; i < taxColWidths.length; i++) {
        tcX += taxColWidths[i];
        doc.line(tcX, y, tcX, y + taxTableHeight);
      }
      
      // Header row 1
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      tcX = margin;
      doc.text('HSN/SAC', tcX + taxColWidths[0] / 2, y + 4, { align: 'center' });
      tcX += taxColWidths[0];
      doc.text('Taxable', tcX + taxColWidths[1] / 2, y + 3, { align: 'center' });
      doc.text('Value', tcX + taxColWidths[1] / 2, y + 6, { align: 'center' });
      tcX += taxColWidths[1];
      
      // IGST header spans 2 cols
      doc.text('IGST', tcX + (taxColWidths[2] + taxColWidths[3]) / 2, y + 3, { align: 'center' });
      doc.line(tcX, y + 6, tcX + taxColWidths[2] + taxColWidths[3], y + 6);
      doc.text('Rate', tcX + taxColWidths[2] / 2, y + 10, { align: 'center' });
      tcX += taxColWidths[2];
      doc.text('Amount', tcX + taxColWidths[3] / 2, y + 10, { align: 'center' });
      tcX += taxColWidths[3];
      doc.text('Total', tcX + taxColWidths[4] / 2, y + 3, { align: 'center' });
      doc.text('Tax Amount', tcX + taxColWidths[4] / 2, y + 6, { align: 'center' });
      
      // Header separator line
      doc.line(margin, y + taxTableHeaderHeight, margin + contentWidth, y + taxTableHeaderHeight);
      
      // Data rows
      let dataY = y + taxTableHeaderHeight + 4;
      let totalTaxableValue = 0;
      let totalTaxAmount = 0;
      
      hsnEntries.forEach(([hsn, data]) => {
        tcX = margin;
        doc.setFont('helvetica', 'normal');
        doc.text(hsn, tcX + 2, dataY);
        tcX += taxColWidths[0];
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(data.taxableValue), tcX + taxColWidths[1] - 2, dataY, { align: 'right' });
        tcX += taxColWidths[1];
        doc.setFont('helvetica', 'normal');
        doc.text(`${data.taxRate}%`, tcX + taxColWidths[2] / 2, dataY, { align: 'center' });
        tcX += taxColWidths[2];
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(data.taxAmount), tcX + taxColWidths[3] - 2, dataY, { align: 'right' });
        tcX += taxColWidths[3];
        doc.text(formatCurrency(data.taxAmount), tcX + taxColWidths[4] - 2, dataY, { align: 'right' });
        
        totalTaxableValue += data.taxableValue;
        totalTaxAmount += data.taxAmount;
        dataY += 6;
      });
      
      // Total row separator
      doc.line(margin, y + taxTableHeaderHeight + taxTableDataHeight, margin + contentWidth, y + taxTableHeaderHeight + taxTableDataHeight);
      
      // Total row
      const totalY = y + taxTableHeaderHeight + taxTableDataHeight + 5;
      tcX = margin;
      doc.setFont('helvetica', 'bold');
      doc.text('Total', tcX + taxColWidths[0] - 2, totalY, { align: 'right' });
      tcX += taxColWidths[0];
      doc.text(formatCurrency(totalTaxableValue), tcX + taxColWidths[1] - 2, totalY, { align: 'right' });
      tcX += taxColWidths[1] + taxColWidths[2];
      doc.text(formatCurrency(totalTaxAmount), tcX + taxColWidths[3] - 2, totalY, { align: 'right' });
      tcX += taxColWidths[3];
      doc.text(formatCurrency(totalTaxAmount), tcX + taxColWidths[4] - 2, totalY, { align: 'right' });
      
    } else {
      // CGST + SGST columns: HSN/SAC | Taxable Value | CGST Rate | CGST Amount | SGST Rate | SGST Amount | Total Tax
      const taxColWidths = [
        contentWidth * 0.18, // HSN
        contentWidth * 0.14, // Taxable Value
        contentWidth * 0.10, // CGST Rate
        contentWidth * 0.14, // CGST Amount
        contentWidth * 0.10, // SGST Rate
        contentWidth * 0.14, // SGST Amount
        contentWidth * 0.20  // Total Tax
      ];
      
      // Draw column lines
      let tcX = margin;
      for (let i = 0; i < taxColWidths.length; i++) {
        tcX += taxColWidths[i];
        doc.line(tcX, y, tcX, y + taxTableHeight);
      }
      
      // Header
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      tcX = margin;
      doc.text('HSN/SAC', tcX + taxColWidths[0] / 2, y + 6, { align: 'center' });
      tcX += taxColWidths[0];
      doc.text('Taxable Value', tcX + taxColWidths[1] / 2, y + 6, { align: 'center' });
      tcX += taxColWidths[1];
      
      // CGST header
      doc.text('CGST', tcX + (taxColWidths[2] + taxColWidths[3]) / 2, y + 3, { align: 'center' });
      doc.line(tcX, y + 6, tcX + taxColWidths[2] + taxColWidths[3], y + 6);
      doc.text('Rate', tcX + taxColWidths[2] / 2, y + 10, { align: 'center' });
      tcX += taxColWidths[2];
      doc.text('Amount', tcX + taxColWidths[3] / 2, y + 10, { align: 'center' });
      tcX += taxColWidths[3];
      
      // SGST header
      doc.text('SGST', tcX + (taxColWidths[4] + taxColWidths[5]) / 2, y + 3, { align: 'center' });
      doc.line(tcX, y + 6, tcX + taxColWidths[4] + taxColWidths[5], y + 6);
      doc.text('Rate', tcX + taxColWidths[4] / 2, y + 10, { align: 'center' });
      tcX += taxColWidths[4];
      doc.text('Amount', tcX + taxColWidths[5] / 2, y + 10, { align: 'center' });
      tcX += taxColWidths[5];
      doc.text('Total Tax', tcX + taxColWidths[6] / 2, y + 6, { align: 'center' });
      
      // Header separator
      doc.line(margin, y + taxTableHeaderHeight, margin + contentWidth, y + taxTableHeaderHeight);
      
      // Data rows
      let dataY = y + taxTableHeaderHeight + 4;
      let totalTaxableValue = 0;
      let totalTaxAmount = 0;
      
      hsnEntries.forEach(([hsn, data]) => {
        const halfTax = data.taxAmount / 2;
        const halfRate = data.taxRate / 2;
        
        tcX = margin;
        doc.setFont('helvetica', 'normal');
        doc.text(hsn, tcX + 2, dataY);
        tcX += taxColWidths[0];
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(data.taxableValue), tcX + taxColWidths[1] - 2, dataY, { align: 'right' });
        tcX += taxColWidths[1];
        doc.setFont('helvetica', 'normal');
        doc.text(`${halfRate}%`, tcX + taxColWidths[2] / 2, dataY, { align: 'center' });
        tcX += taxColWidths[2];
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(halfTax), tcX + taxColWidths[3] - 2, dataY, { align: 'right' });
        tcX += taxColWidths[3];
        doc.setFont('helvetica', 'normal');
        doc.text(`${halfRate}%`, tcX + taxColWidths[4] / 2, dataY, { align: 'center' });
        tcX += taxColWidths[4];
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(halfTax), tcX + taxColWidths[5] - 2, dataY, { align: 'right' });
        tcX += taxColWidths[5];
        doc.text(formatCurrency(data.taxAmount), tcX + taxColWidths[6] - 2, dataY, { align: 'right' });
        
        totalTaxableValue += data.taxableValue;
        totalTaxAmount += data.taxAmount;
        dataY += 6;
      });
      
      // Total row separator
      doc.line(margin, y + taxTableHeaderHeight + taxTableDataHeight, margin + contentWidth, y + taxTableHeaderHeight + taxTableDataHeight);
      
      // Total row
      const totalY = y + taxTableHeaderHeight + taxTableDataHeight + 5;
      tcX = margin;
      doc.setFont('helvetica', 'bold');
      doc.text('Total', tcX + taxColWidths[0] - 2, totalY, { align: 'right' });
      tcX += taxColWidths[0];
      doc.text(formatCurrency(totalTaxableValue), tcX + taxColWidths[1] - 2, totalY, { align: 'right' });
      tcX += taxColWidths[1] + taxColWidths[2];
      doc.text(formatCurrency(totalTaxAmount / 2), tcX + taxColWidths[3] - 2, totalY, { align: 'right' });
      tcX += taxColWidths[3] + taxColWidths[4];
      doc.text(formatCurrency(totalTaxAmount / 2), tcX + taxColWidths[5] - 2, totalY, { align: 'right' });
      tcX += taxColWidths[5];
      doc.text(formatCurrency(totalTaxAmount), tcX + taxColWidths[6] - 2, totalY, { align: 'right' });
    }
    
    y += taxTableHeight;
    
    // Tax amount in words
    const taxWordsHeight = 8;
    doc.rect(margin, y, contentWidth, taxWordsHeight, 'S');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Tax Amount (in words) :', margin + 2, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(convertAmountToWords(totalTax, currency), margin + 38, y + 5);
    y += taxWordsHeight;
  }

  // ============= NOTES SECTION =============
  if (quotation.notes && quotation.notes.trim()) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(quotation.notes.trim(), contentWidth - 6) as string[];
    const lineHeight = 3.8;
    const notesHeight = 6 + noteLines.length * lineHeight + 2;

    // Page-break check: ensure notes + footer fit on the page
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + notesHeight + 55 + margin > pageHeight) {
      doc.addPage();
      y = margin;
    }

    doc.rect(margin, y, contentWidth, notesHeight, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', margin + 2, y + 4);
    doc.setFont('helvetica', 'normal');
    let nY = y + 4 + lineHeight;
    noteLines.forEach((line) => {
      doc.text(line, margin + 2, nY);
      nY += lineHeight;
    });
    y += notesHeight;
  }

  // ============= FOOTER SECTION (55% Declaration | 45% Bank Details) =============
  // Page break check already handled before Amount in Words section
  const footerHeight = 55;

  const declarationWidth = contentWidth * 0.55;
  const bankWidth = contentWidth * 0.45;
  
  // Declaration column
  doc.rect(margin, y, declarationWidth, footerHeight, 'S');
  // Bank details column
  doc.rect(margin + declarationWidth, y, bankWidth, footerHeight, 'S');
  
  // === DECLARATION (editable from terms_conditions) ===
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  
  // Underlined "Declaration" heading
  doc.text('Declaration', margin + 2, y + 4);
  doc.line(margin + 2, y + 5, margin + 20, y + 5); // underline
  
  // Parse terms_conditions or use defaults
  let declarations: string[] = [];
  if (quotation.terms_conditions && quotation.terms_conditions.trim()) {
    // Split by newlines and filter empty lines
    declarations = quotation.terms_conditions
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  } else {
    declarations = DEFAULT_DECLARATIONS;
  }
  
  let declY = y + 9;
  declarations.forEach((term, idx) => {
    // Check if term already starts with a number
    const hasNumber = /^\d+\.?\s/.test(term);
    const termText = hasNumber ? term : `${idx + 1}. ${term}`;
    
    // Handle multi-line terms (for "Freight Charges" style)
    const lines = doc.splitTextToSize(termText, declarationWidth - 6);
    lines.forEach((line: string) => {
      doc.text(line, margin + 2, declY);
      declY += 3.5;
    });
  });
  
  // "Thank you for doing business with us!"
  declY += 1;
  doc.text('Thank you for doing business with us!', margin + 2, declY);
  
  // === BANK DETAILS ===
  const bankX = margin + declarationWidth + 2;
  let bankY = y + 4;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text("Company's Bank Details", bankX, bankY);
  bankY += 5;
  
  // Bank details table
  const bankName = tenantBranding?.bankName || COMPANY.bank.name;
  const bankAccNo = tenantBranding?.bankAccountNumber || COMPANY.bank.accountNo;
  const bankBranch = tenantBranding?.bankBranch || COMPANY.bank.branch;
  const bankIfsc = tenantBranding?.bankIfsc || COMPANY.bank.ifsc;

  doc.text('Bank Name', bankX, bankY);
  doc.text(`: `, bankX + 25, bankY);
  doc.setFont('helvetica', 'bold');
  doc.text(bankName, bankX + 28, bankY);
  bankY += 4;
  
  doc.setFont('helvetica', 'normal');
  doc.text('A/c No.', bankX, bankY);
  doc.text(`: `, bankX + 25, bankY);
  doc.setFont('helvetica', 'bold');
  doc.text(bankAccNo, bankX + 28, bankY);
  bankY += 4;
  
  doc.setFont('helvetica', 'normal');
  doc.text('Branch & IFS Code', bankX, bankY);
  doc.text(`: `, bankX + 25, bankY);
  doc.setFont('helvetica', 'bold');
  const branchIfscText = `${bankBranch} & ${bankIfsc}`;
  const maxBranchWidth = bankWidth - 32; // Available width after label
  const branchLines = doc.splitTextToSize(branchIfscText, maxBranchWidth);
  branchLines.forEach((line: string, idx: number) => {
    doc.text(line, bankX + 28, bankY + (idx * 3));
  });
  
  // "Prepared By" line if available
  const sigY = y + footerHeight - 24;
  if (quotation.created_by_profile?.full_name) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Prepared By:', bankX + 2, sigY);
    doc.setFont('helvetica', 'bold');
    doc.text(quotation.created_by_profile.full_name, bankX + 20, sigY);
  }
  
  // "for GRAVEN AUTOMATION PRIVATE LIMITED" + Authorised Signatory
  const sigCompanyY = sigY + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('for ', bankX + (bankWidth / 2) - 30, sigCompanyY);
  doc.setFont('helvetica', 'bold');
  doc.text(co.name, bankX + (bankWidth / 2) - 26, sigCompanyY);
  
  // Line for signature area
  doc.line(bankX + 10, sigCompanyY + 10, bankX + bankWidth - 12, sigCompanyY + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Authorised Signatory', bankX + (bankWidth / 2), sigCompanyY + 14, { align: 'center' });
  
  // ============= COMPUTER GENERATED FOOTER =============
  // Position exactly 10px from bottom (≈ 3mm)
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a Computer Generated Document', pageWidth / 2, pageHeight - 5, { align: 'center' });
  
  return doc;
}

export function generateQuotationPDF(quotation: QuotationWithDetails, companyDefaults?: CompanyDefaultsOptions, tenantBranding?: TenantBranding): jsPDF {
  return generateDocumentPDF({ documentType: 'quotation', quotation, companyDefaults, tenantBranding });
}

export function downloadQuotationPDF(quotation: QuotationWithDetails, companyDefaults?: CompanyDefaultsOptions, tenantBranding?: TenantBranding): void {
  const doc = generateQuotationPDF(quotation, companyDefaults, tenantBranding);
  doc.save(`Quotation_${quotation.quotation_number}.pdf`);
}

export function generateInvoicePDF(quotation: QuotationWithDetails, invoiceOptions: InvoiceOptions, companyDefaults?: CompanyDefaultsOptions, tenantBranding?: TenantBranding): jsPDF {
  return generateDocumentPDF({ documentType: 'invoice', quotation, invoiceOptions, companyDefaults, tenantBranding });
}

export function downloadInvoicePDF(quotation: QuotationWithDetails, invoiceOptions: InvoiceOptions, companyDefaults?: CompanyDefaultsOptions, tenantBranding?: TenantBranding): void {
  const doc = generateInvoicePDF(quotation, invoiceOptions, companyDefaults, tenantBranding);
  doc.save(`Invoice_${invoiceOptions.invoiceNumber || quotation.quotation_number}.pdf`);
}
