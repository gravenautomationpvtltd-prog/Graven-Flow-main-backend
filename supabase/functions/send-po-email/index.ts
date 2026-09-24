import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import { getTenantEmailConfig, buildFromAddress } from "../_shared/tenant-email-config.ts";
import { sendEmail } from "../_shared/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPOEmailRequest {
  po_id: string;
  recipient_email: string;
  recipient_name?: string;
  message?: string;
  cc?: string[];
  user_id?: string;
  tenant_id?: string;
}

// Company details
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

const PO_DECLARATIONS = [
  'Payment: 100% Advance at the time of Dispatch.',
  'Dispatch Time will be 10-15 Days.',
  'All Disputes are Subject to [Lucknow] Jurisdiction Only.'
];

// Height constants for footer sections
const FOOTER_HEIGHT = 105;
const TABLE_HEADER_HEIGHT = 10;
const ITEM_ROW_HEIGHT = 12;
const PAGE_BOTTOM_MARGIN = 15;

// Graven logo as base64 (embedded for edge function)
const GRAVEN_LOGO_BASE64 = 'data:image/png;base64,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';

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function convertToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  
  const convertBelowThousand = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelowThousand(n % 100) : '');
  };
  
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = num % 1000;
  
  let words = '';
  if (crore) words += convertBelowThousand(crore) + ' Crore ';
  if (lakh) words += convertBelowThousand(lakh) + ' Lakh ';
  if (thousand) words += convertBelowThousand(thousand) + ' Thousand ';
  if (remainder) words += convertBelowThousand(remainder);
  
  return words.trim();
}

/**
 * Generate PO PDF matching the exact HTML template structure
 */
function generatePOPdf(po: any, items: any[]): string {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  // Column widths exactly as HTML template: Sl No 4%, Description 36%, Due on 10%, Quantity 10%, Rate 10%, per 5%, Disc % 5%, Amount 15%
  const colWidths = {
    sl: contentWidth * 0.04,
    desc: contentWidth * 0.36,
    dueOn: contentWidth * 0.10,
    qty: contentWidth * 0.10,
    rate: contentWidth * 0.10,
    per: contentWidth * 0.05,
    disc: contentWidth * 0.05,
    amount: contentWidth * 0.15
  };
  
  let y = margin;
  let currentPage = 1;
  
  doc.setFont('helvetica');
  
  // Supplier info
  const supplier = po.supplier;
  const supplierStateCode = supplier?.gst_number ? getStateCode(supplier.gst_number) : '';
  const supplierStateName = supplierStateCode ? getStateName(supplierStateCode) : '';
  
  // Calculate totals
  let totalQty = 0;
  let totalTax = 0;
  items.forEach(item => {
    totalQty += item.quantity;
    totalTax += item.tax_amount || 0;
  });
  
  const grandTotal = po.grand_total || 0;
  const roundedTotal = Math.round(grandTotal);
  const roundOff = roundedTotal - grandTotal;
  
  // Parse declarations
  let declarations: string[] = [];
  if (po.terms_conditions && po.terms_conditions.trim()) {
    declarations = po.terms_conditions
      .split('\n')
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
  } else {
    declarations = PO_DECLARATIONS;
  }
  
  const orderDate = po.order_date ? formatDateIndian(po.order_date) : formatDateIndian(po.created_at);
  const dueDate = po.expected_delivery ? formatDateIndian(po.expected_delivery) : '';
  
  // Function to draw table header
  const drawTableHeader = (startY: number): number => {
    doc.rect(margin, startY, contentWidth, TABLE_HEADER_HEIGHT, 'S');
    
    // Draw vertical lines for header
    let colX = margin + colWidths.sl;
    doc.line(colX, startY, colX, startY + TABLE_HEADER_HEIGHT); colX += colWidths.desc;
    doc.line(colX, startY, colX, startY + TABLE_HEADER_HEIGHT); colX += colWidths.dueOn;
    doc.line(colX, startY, colX, startY + TABLE_HEADER_HEIGHT); colX += colWidths.qty;
    doc.line(colX, startY, colX, startY + TABLE_HEADER_HEIGHT); colX += colWidths.rate;
    doc.line(colX, startY, colX, startY + TABLE_HEADER_HEIGHT); colX += colWidths.per;
    doc.line(colX, startY, colX, startY + TABLE_HEADER_HEIGHT); colX += colWidths.disc;
    doc.line(colX, startY, colX, startY + TABLE_HEADER_HEIGHT);
    
    // Header text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    colX = margin;
    doc.text('Sl', colX + colWidths.sl / 2, startY + 3.5, { align: 'center' });
    doc.text('No.', colX + colWidths.sl / 2, startY + 7, { align: 'center' });
    colX += colWidths.sl;
    doc.text('Description of Goods', colX + colWidths.desc / 2, startY + 6, { align: 'center' });
    colX += colWidths.desc;
    doc.text('Due on', colX + colWidths.dueOn / 2, startY + 6, { align: 'center' });
    colX += colWidths.dueOn;
    doc.text('Quantity', colX + colWidths.qty / 2, startY + 6, { align: 'center' });
    colX += colWidths.qty;
    doc.text('Rate', colX + colWidths.rate / 2, startY + 6, { align: 'center' });
    colX += colWidths.rate;
    doc.text('per', colX + colWidths.per / 2, startY + 6, { align: 'center' });
    colX += colWidths.per;
    doc.text('Disc. %', colX + colWidths.disc / 2, startY + 6, { align: 'center' });
    colX += colWidths.disc;
    doc.text('Amount', colX + colWidths.amount / 2, startY + 6, { align: 'center' });
    
    return startY + TABLE_HEADER_HEIGHT;
  };
  
  // Function to calculate item row height
  const calculateItemHeight = (item: any): number => {
    const maxDescWidth = colWidths.desc - 4;
    const descLines = doc.splitTextToSize(item.description, maxDescWidth);
    const numLines = Math.min(descLines.length, 4);
    return Math.max(ITEM_ROW_HEIGHT, 6 + (numLines * 3.5));
  };
  
  // Function to draw item row
  const drawItemRow = (item: any, index: number, startY: number, rowHeight: number): void => {
    let colX = margin;
    doc.setFontSize(8);
    
    doc.rect(margin, startY, contentWidth, rowHeight, 'S');
    
    colX = margin + colWidths.sl;
    doc.line(colX, startY, colX, startY + rowHeight); colX += colWidths.desc;
    doc.line(colX, startY, colX, startY + rowHeight); colX += colWidths.dueOn;
    doc.line(colX, startY, colX, startY + rowHeight); colX += colWidths.qty;
    doc.line(colX, startY, colX, startY + rowHeight); colX += colWidths.rate;
    doc.line(colX, startY, colX, startY + rowHeight); colX += colWidths.per;
    doc.line(colX, startY, colX, startY + rowHeight); colX += colWidths.disc;
    doc.line(colX, startY, colX, startY + rowHeight);
    
    colX = margin;
    const textY = startY + 4;
    
    // Sl No
    doc.setFont('helvetica', 'normal');
    doc.text((index + 1).toString(), colX + colWidths.sl / 2, textY, { align: 'center' });
    colX += colWidths.sl;
    
    // Description (bold)
    doc.setFont('helvetica', 'bold');
    const maxDescWidth = colWidths.desc - 4;
    const descLines = doc.splitTextToSize(item.description, maxDescWidth);
    descLines.slice(0, 4).forEach((line: string, lineIdx: number) => {
      doc.text(line, colX + 2, textY + (lineIdx * 3.5));
    });
    colX += colWidths.desc;
    
    doc.setFont('helvetica', 'normal');
    
    // Due on
    doc.text(dueDate, colX + colWidths.dueOn / 2, textY, { align: 'center' });
    colX += colWidths.dueOn;
    
    // Quantity (bold)
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.quantity.toFixed(2)} Nos`, colX + colWidths.qty / 2, textY, { align: 'center' });
    colX += colWidths.qty;
    
    doc.setFont('helvetica', 'normal');
    
    // Rate
    doc.text(formatCurrency(item.rate), colX + colWidths.rate - 4, textY, { align: 'right' });
    colX += colWidths.rate;
    
    // Per
    doc.text('Nos', colX + colWidths.per / 2, textY, { align: 'center' });
    colX += colWidths.per;
    
    // Disc %
    doc.text('', colX + colWidths.disc / 2, textY, { align: 'center' });
    colX += colWidths.disc;
    
    // Amount (bold)
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(item.amount), colX + colWidths.amount - 4, textY, { align: 'right' });
  };
  
  // Function to add new page
  const addNewPage = (): number => {
    doc.addPage();
    currentPage++;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`PURCHASE ORDER - ${po.po_number} (Page ${currentPage})`, pageWidth / 2, margin, { align: 'center' });
    
    return margin + 10;
  };
  
  // ============= TITLE =============
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  // ============= HEADER ROW (50% left | 50% right) =============
  const headerHeight = 42;
  const leftColWidth = contentWidth * 0.5;
  const rightColWidth = contentWidth * 0.5;
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, headerHeight, 'S');
  doc.line(margin + leftColWidth, y, margin + leftColWidth, y + headerHeight);
  
  // === LEFT SIDE: "Invoice To" + Logo + Company Info ===
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Invoice To', margin + 2, y + 5);
  
  const logoX = margin + 4;
  const logoY = y + 8;
  const logoWidth = 15;
  
  try {
    doc.addImage(GRAVEN_LOGO_BASE64, 'PNG', logoX, logoY, logoWidth, logoWidth);
  } catch (e) {
    // Logo failed, continue without it
  }
  
  const companyX = margin + logoWidth + 8;
  let companyY = y + 11;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const maxCompanyNameWidth = leftColWidth - logoWidth - 12;
  const companyNameLines = doc.splitTextToSize(COMPANY.name, maxCompanyNameWidth);
  companyNameLines.forEach((line: string) => {
    doc.text(line, companyX, companyY);
    companyY += 3.5;
  });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY.address1, companyX, companyY);
  companyY += 3;
  doc.text(COMPANY.address2, companyX, companyY);
  companyY += 3;
  doc.text(COMPANY.address3, companyX, companyY);
  companyY += 3.5;
  doc.text(`GSTIN/UIN: ${COMPANY.gstin}`, companyX, companyY);
  companyY += 3;
  doc.text(`State Name : ${COMPANY.stateName}, Code : ${COMPANY.stateCode}`, companyX, companyY);
  companyY += 3;
  doc.text(`Contact : ${COMPANY.phones.join(', ')}`, companyX, companyY);
  companyY += 3;
  doc.text(`E-Mail : ${COMPANY.email}`, companyX, companyY);
  
  // === RIGHT SIDE: 4-row × 2-column grid ===
  const gridX = margin + leftColWidth;
  const gridRowHeight = headerHeight / 4;
  const gridCol1Width = rightColWidth * 0.5;
  const gridCol2Width = rightColWidth * 0.5;
  
  for (let i = 1; i < 4; i++) {
    doc.line(gridX, y + (i * gridRowHeight), margin + contentWidth, y + (i * gridRowHeight));
  }
  doc.line(gridX + gridCol1Width, y, gridX + gridCol1Width, y + headerHeight);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Voucher No.', gridX + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(po.po_number, gridX + 2, y + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Dated', gridX + gridCol1Width + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(orderDate, gridX + gridCol1Width + 2, y + 8);
  
  const row2Y = y + gridRowHeight;
  doc.setFont('helvetica', 'normal');
  doc.text('Reference No. & Date.', gridX + 2, row2Y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(po.po_number, gridX + 2, row2Y + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Mode/Terms of Payment', gridX + gridCol1Width + 2, row2Y + 4);
  
  const row3Y = y + (gridRowHeight * 2);
  doc.text('Dispatched through', gridX + 2, row3Y + 5);
  doc.text('Other References', gridX + gridCol1Width + 2, row3Y + 5);
  
  const row4Y = y + (gridRowHeight * 3);
  doc.text('Terms of Delivery', gridX + 2, row4Y + 5);
  doc.text('Destination', gridX + gridCol1Width + 2, row4Y + 5);
  
  y += headerHeight;
  
  // ============= CONSIGNEE =============
  const consigneeHeight = 28;
  doc.rect(margin, y, contentWidth, consigneeHeight, 'S');
  
  let consigneeY = y + 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Consignee (Ship to)', margin + 2, consigneeY);
  consigneeY += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY.name, margin + 2, consigneeY);
  consigneeY += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY.address1, margin + 2, consigneeY);
  consigneeY += 3;
  doc.text(COMPANY.address2, margin + 2, consigneeY);
  consigneeY += 3;
  doc.text(COMPANY.address3, margin + 2, consigneeY);
  consigneeY += 3;
  doc.text(`e-mail : ${COMPANY.email}`, margin + 2, consigneeY);
  consigneeY += 3;
  doc.text(`GSTIN/UIN : ${COMPANY.gstin}`, margin + 2, consigneeY);
  consigneeY += 3;
  doc.text(`State Name : ${COMPANY.stateName}, Code : ${COMPANY.stateCode}`, margin + 2, consigneeY);
  
  y += consigneeHeight;
  
  // ============= SUPPLIER =============
  const supplierHeight = 24;
  doc.rect(margin, y, contentWidth, supplierHeight, 'S');
  
  let supplierY = y + 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Supplier (Bill from)', margin + 2, supplierY);
  supplierY += 4;
  doc.setFont('helvetica', 'bold');
  doc.text((supplier?.name || '').toUpperCase(), margin + 2, supplierY);
  supplierY += 3.5;
  doc.setFont('helvetica', 'normal');
  
  if (supplier?.address) {
    const addrLines = doc.splitTextToSize(supplier.address, contentWidth - 10);
    addrLines.slice(0, 2).forEach((line: string) => {
      doc.text(line, margin + 2, supplierY);
      supplierY += 3;
    });
  }
  if (supplier?.gst_number) {
    doc.text(`GSTIN/UIN : ${supplier.gst_number}`, margin + 2, supplierY);
    supplierY += 3;
  }
  if (supplierStateName || supplierStateCode) {
    doc.text(`State Name : ${supplierStateName}${supplierStateCode ? `, Code : ${supplierStateCode}` : ''}`, margin + 2, supplierY);
  }
  
  y += supplierHeight;
  
  // ============= ITEMS TABLE =============
  y = drawTableHeader(y);
  
  items.forEach((item, index) => {
    const itemHeight = calculateItemHeight(item);
    const spaceNeeded = itemHeight + FOOTER_HEIGHT;
    const availableSpace = pageHeight - y - PAGE_BOTTOM_MARGIN;
    
    if (availableSpace < spaceNeeded && index > 0) {
      y = addNewPage();
      y = drawTableHeader(y);
    }
    
    drawItemRow(item, index, y, itemHeight);
    y += itemHeight;
  });
  
  // ============= TAX AND ROUND OFF =============
  if (totalTax > 0 || Math.abs(roundOff) > 0.001) {
    const taxRowHeight = totalTax > 0 && Math.abs(roundOff) > 0.001 ? 12 : 8;
    
    if (pageHeight - y - PAGE_BOTTOM_MARGIN < taxRowHeight + FOOTER_HEIGHT) {
      y = addNewPage();
      y = drawTableHeader(y);
    }
    
    doc.rect(margin, y, contentWidth, taxRowHeight, 'S');
    
    let colX = margin + colWidths.sl;
    doc.line(colX, y, colX, y + taxRowHeight); colX += colWidths.desc;
    doc.line(colX, y, colX, y + taxRowHeight); colX += colWidths.dueOn;
    doc.line(colX, y, colX, y + taxRowHeight); colX += colWidths.qty;
    doc.line(colX, y, colX, y + taxRowHeight); colX += colWidths.rate;
    doc.line(colX, y, colX, y + taxRowHeight); colX += colWidths.per;
    doc.line(colX, y, colX, y + taxRowHeight); colX += colWidths.disc;
    doc.line(colX, y, colX, y + taxRowHeight);
    
    const descColRight = margin + colWidths.sl + colWidths.desc - 5;
    const amountColStart = margin + colWidths.sl + colWidths.desc + colWidths.dueOn + colWidths.qty + colWidths.rate + colWidths.per + colWidths.disc;
    const amountColRight = amountColStart + colWidths.amount - 4;
    
    doc.setFontSize(7);
    
    if (totalTax > 0) {
      doc.setFont('helvetica', 'bolditalic');
      doc.text('INPUT IGST:', descColRight, y + 5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(totalTax), amountColRight, y + 5, { align: 'right' });
    }
    
    if (Math.abs(roundOff) > 0.001) {
      const roundOffY = totalTax > 0 ? y + 9 : y + 5;
      doc.setFont('helvetica', 'italic');
      const roundOffText = roundOff < 0 ? 'Less: Round Off:' : 'Add: Round Off:';
      doc.text(roundOffText, descColRight, roundOffY, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      const roundOffValue = roundOff < 0 ? `(-${formatCurrency(Math.abs(roundOff))})` : formatCurrency(Math.abs(roundOff));
      doc.text(roundOffValue, amountColRight, roundOffY, { align: 'right' });
    }
    
    y += taxRowHeight;
  }
  
  // ============= TOTAL ROW =============
  const totalRowHeight = 8;
  
  if (pageHeight - y - PAGE_BOTTOM_MARGIN < totalRowHeight + FOOTER_HEIGHT - 8) {
    y = addNewPage();
    y = drawTableHeader(y);
  }
  
  doc.rect(margin, y, contentWidth, totalRowHeight, 'S');
  
  let colX = margin + colWidths.sl;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.desc;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.dueOn;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.qty;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.rate;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.per;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.disc;
  doc.line(colX, y, colX, y + totalRowHeight);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Total', margin + colWidths.sl + colWidths.desc - 2, y + 5, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  const qtyColX = margin + colWidths.sl + colWidths.desc + colWidths.dueOn;
  doc.text(`${totalQty.toFixed(2)} Nos`, qtyColX + colWidths.qty / 2, y + 5, { align: 'center' });
  
  const amountColStart = margin + colWidths.sl + colWidths.desc + colWidths.dueOn + colWidths.qty + colWidths.rate + colWidths.per + colWidths.disc;
  const totalAmountColRight = amountColStart + colWidths.amount - 4;
  doc.text(`₹ ${formatCurrency(roundedTotal)}`, totalAmountColRight, y + 5, { align: 'right' });
  
  y += totalRowHeight;
  
  // ============= AMOUNT IN WORDS =============
  const amountWordsHeight = 12;
  doc.rect(margin, y, contentWidth, amountWordsHeight, 'S');
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Amount Chargeable (in words)', margin + 2, y + 4);
  
  const amountInWords = `INR ${convertToWords(roundedTotal)} Rupees Only`;
  doc.setFont('helvetica', 'bold');
  doc.text(amountInWords, margin + 2, y + 9);
  
  y += amountWordsHeight;
  
  // ============= FOOTER SECTION (55% Declaration | 45% Signatory) =============
  const footerHeight = 55;
  const declarationWidth = contentWidth * 0.55;
  const signatoryWidth = contentWidth * 0.45;
  
  doc.rect(margin, y, declarationWidth, footerHeight, 'S');
  doc.rect(margin + declarationWidth, y, signatoryWidth, footerHeight, 'S');
  
  // Declaration
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Declaration', margin + 2, y + 4);
  doc.line(margin + 2, y + 5, margin + 20, y + 5);
  
  let declY = y + 9;
  declarations.forEach((term: string, idx: number) => {
    const hasNumber = /^\d+\.?\s/.test(term);
    const termText = hasNumber ? term : `${idx + 1}. ${term}`;
    const lines = doc.splitTextToSize(termText, declarationWidth - 6);
    lines.forEach((line: string) => {
      doc.text(line, margin + 2, declY);
      declY += 3.5;
    });
  });
  
  declY = y + footerHeight - 6;
  doc.text('Thanks for Doing Business with us!', margin + 2, declY);
  
  // Signatory - 3 column layout
  const sigX = margin + declarationWidth;
  const sigColWidth = signatoryWidth / 3;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('for ', sigX + 2, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY.name, sigX + 8, y + 5);
  
  // More space for signatures/stamps - moved lines down from top
  const lineY = y + footerHeight - 18;
  const labelY = y + footerHeight - 12;
  const nameY = y + footerHeight - 6;
  
  doc.setLineWidth(0.3);
  
  // Prepared By column
  const prepX = sigX + 4;
  doc.line(prepX, lineY, prepX + sigColWidth - 8, lineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text('Prepared By', prepX + (sigColWidth - 8) / 2, labelY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(po.creator?.full_name || '', prepX + (sigColWidth - 8) / 2, nameY, { align: 'center' });
  
  // Verified By column
  const verX = sigX + sigColWidth + 2;
  doc.line(verX, lineY, verX + sigColWidth - 8, lineY);
  doc.setFont('helvetica', 'bold');
  doc.text('Verified By', verX + (sigColWidth - 8) / 2, labelY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(po.verifier?.full_name || '', verX + (sigColWidth - 8) / 2, nameY, { align: 'center' });
  
  // Approved By column
  const appX = sigX + (sigColWidth * 2);
  doc.line(appX, lineY, appX + sigColWidth - 8, lineY);
  doc.setFont('helvetica', 'bold');
  doc.text('Approved By', appX + (sigColWidth - 8) / 2, labelY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(po.approver?.full_name || '', appX + (sigColWidth - 8) / 2, nameY, { align: 'center' });
  
  y += footerHeight;
  
  // ============= COMPUTER GENERATED FOOTER =============
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a Computer Generated Document', pageWidth / 2, pageHeight - 5, { align: 'center' });
  
  return doc.output('datauristring').split(',')[1];
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-po-email function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { po_id, recipient_email, recipient_name, message, cc, user_id, tenant_id }: SendPOEmailRequest = await req.json();
    console.log(`Sending PO ${po_id} to ${recipient_email}`);

    // Fetch tenant email config
    const emailConfig = await getTenantEmailConfig(tenant_id);

    if (!po_id || !recipient_email) {
      throw new Error("po_id and recipient_email are required");
    }

    // Fetch PO with supplier and profile details
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        supplier:suppliers(*),
        creator:created_by(full_name),
        verifier:verified_by(full_name),
        approver:approved_by(full_name)
      `)
      .eq("id", po_id)
      .single();

    if (poError || !po) {
      console.error("Error fetching PO:", poError);
      throw new Error("Purchase order not found");
    }

    // Fetch PO items
    const { data: items, error: itemsError } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("po_id", po_id)
      .order("sort_order", { ascending: true });

    if (itemsError) {
      console.error("Error fetching PO items:", itemsError);
      throw new Error("Failed to fetch PO items");
    }

    console.log(`Generating PDF for PO ${po.po_number} with ${items?.length || 0} items`);

    // Generate PDF
    const pdfBase64 = generatePOPdf(po, items || []);

    // Build email content
    const supplierName = recipient_name || po.supplier?.name || "Supplier";
    const customMessage = message || "";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Purchase Order: ${po.po_number}</h2>
        <p>Dear ${supplierName},</p>
        ${customMessage ? `<p>${customMessage}</p>` : `<p>Please find attached the Purchase Order from ${emailConfig.companyName}.</p>`}
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>PO Number:</strong> ${po.po_number}</p>
          <p style="margin: 5px 0;"><strong>Order Date:</strong> ${po.order_date ? formatDateIndian(po.order_date) : formatDateIndian(po.created_at)}</p>
          ${po.expected_delivery ? `<p style="margin: 5px 0;"><strong>Expected Delivery:</strong> ${formatDateIndian(po.expected_delivery)}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Total Amount:</strong> Rs. ${formatCurrency(po.grand_total || 0)}</p>
        </div>
        <p>Please confirm receipt of this order and provide expected delivery date.</p>
        <p style="margin-top: 30px;">Best Regards,<br/>${emailConfig.companyName}</p>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #666;">
          ${emailConfig.companyName}<br/>
          ${emailConfig.address1}, ${emailConfig.address2}, ${emailConfig.address3}<br/>
          Email: ${emailConfig.email} | Phone: ${emailConfig.phones.join(', ')}
        </p>
      </div>
    `;

    // Send email via Resend
    const emailPayload: any = {
      from: buildFromAddress(emailConfig, 'orders'),
      to: [recipient_email],
      subject: `Purchase Order ${po.po_number} from ${emailConfig.companyName}`,
      html: emailHtml,
      attachments: [
        {
          filename: `PO-${po.po_number}.pdf`,
          content: pdfBase64,
        },
      ],
    };

    if (cc && cc.length > 0) {
      emailPayload.cc = cc;
    }

    console.log("Sending email via unified sendEmail...");
    const resendData = await sendEmail(tenant_id, {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject,
      html: emailPayload.html,
      cc: emailPayload.cc,
      replyTo: emailConfig.replyTo,
      attachments: emailPayload.attachments,
    });

    console.log("Send result:", resendData);

    if (!resendData.success) {
      throw new Error(resendData.error || "Failed to send email");
    }

    // Update PO as sent
    await supabase
      .from("purchase_orders")
      .update({
        sent_at: new Date().toISOString(),
        sent_by: user_id || null,
      })
      .eq("id", po_id);

    // Log the email
    await supabase.from("email_logs").insert({
      po_id: po_id,
      recipient_email: recipient_email,
      cc_emails: cc || [],
      subject: `Purchase Order ${po.po_number} from ${emailConfig.companyName}`,
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: user_id || null,
      email_id: resendData.messageId || 'unknown',
    });

    return new Response(
      JSON.stringify({ success: true, email_id: resendData.messageId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-po-email:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
