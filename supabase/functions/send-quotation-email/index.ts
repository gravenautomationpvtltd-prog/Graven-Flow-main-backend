import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import { getTenantEmailConfig, buildFromAddress } from "../_shared/tenant-email-config.ts";
import { sendEmail } from "../_shared/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendQuotationEmailRequest {
  quotation_id: string;
  recipient_email: string;
  recipient_name?: string;
  message?: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  user_id?: string;
  document_type?: 'quotation' | 'proforma';
  subject?: string;
  tenant_id?: string;
}

// Company details - exactly as per HTML template
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

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateIndian = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Number to words conversion
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertTwoDigits(num: number): string {
  if (num < 20) return ones[num];
  return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
}

function convertThreeDigits(num: number): string {
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;
  if (hundred === 0) return convertTwoDigits(remainder);
  return ones[hundred] + ' Hundred' + (remainder ? ' ' + convertTwoDigits(remainder) : '');
}

function convertToIndianWords(amount: number): string {
  if (amount === 0) return 'Zero';
  const rupees = Math.floor(amount);
  let words = '';
  if (rupees === 0) {
    words = 'Zero';
  } else {
    const crore = Math.floor(rupees / 10000000);
    const lakh = Math.floor((rupees % 10000000) / 100000);
    const thousand = Math.floor((rupees % 100000) / 1000);
    const hundred = rupees % 1000;
    const parts: string[] = [];
    if (crore > 0) parts.push(convertTwoDigits(crore) + ' Crore');
    if (lakh > 0) parts.push(convertTwoDigits(lakh) + ' Lakh');
    if (thousand > 0) parts.push(convertTwoDigits(thousand) + ' Thousand');
    if (hundred > 0) parts.push(convertThreeDigits(hundred));
    words = parts.join(' ');
  }
  return words;
}

const getStateCode = (gstin?: string | null): string => {
  if (!gstin || gstin.length < 2) return '';
  return gstin.substring(0, 2);
};

const getStateName = (stateCode: string): string => {
  const states: Record<string, string> = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
    '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
    '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '19': 'West Bengal', '21': 'Odisha',
    '23': 'Madhya Pradesh', '24': 'Gujarat', '27': 'Maharashtra',
    '29': 'Karnataka', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana',
    '37': 'Andhra Pradesh'
  };
  return states[stateCode] || '';
};

function generateQuotationPDF(quotation: any, items: any[], documentType: 'quotation' | 'proforma' = 'quotation'): string {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  let y = margin;
  
  // ============= TITLE =============
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const title = documentType === 'proforma' ? 'PROFORMA INVOICE' : 'QUOTATION';
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 8;
  
  // ============= HEADER ROW (55% left | 45% right) =============
  const headerHeight = 38;
  const leftColWidth = contentWidth * 0.55;
  const rightColWidth = contentWidth * 0.45;
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, headerHeight, 'S');
  doc.line(margin + leftColWidth, y, margin + leftColWidth, y + headerHeight);
  
  // Left side: Company Info (no logo in edge function)
  const companyX = margin + 5;
  let companyY = y + 5;
  
  // Company name - wrap text to prevent overflow
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const maxCompanyNameWidth = leftColWidth - 10; // Available width in left column
  const companyNameLines = doc.splitTextToSize(COMPANY.name, maxCompanyNameWidth);
  companyNameLines.forEach((line: string) => {
    doc.text(line, companyX, companyY);
    companyY += 4;
  });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY.address1, companyX, companyY); companyY += 3;
  doc.text(COMPANY.address2, companyX, companyY); companyY += 3;
  doc.text(COMPANY.address3, companyX, companyY); companyY += 4;
  doc.text(`GSTIN/UIN: ${COMPANY.gstin}`, companyX, companyY); companyY += 3;
  doc.text(`State Name : ${COMPANY.stateName}, Code : ${COMPANY.stateCode}`, companyX, companyY); companyY += 3;
  doc.text(`Contact : ${COMPANY.phones.join(',')}`, companyX, companyY); companyY += 3;
  doc.text(`E-Mail : ${COMPANY.email}`, companyX, companyY);
  
  // Right side: 4x2 grid
  const gridX = margin + leftColWidth;
  const gridRowHeight = headerHeight / 4;
  const gridCol1Width = rightColWidth * 0.5;
  
  for (let i = 1; i < 4; i++) {
    doc.line(gridX, y + (i * gridRowHeight), margin + contentWidth, y + (i * gridRowHeight));
  }
  doc.line(gridX + gridCol1Width, y, gridX + gridCol1Width, y + headerHeight);
  
  const docNumberLabel = documentType === 'proforma' ? 'Voucher No.' : 'Quotation No.';
  
  // Row 1
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(docNumberLabel, gridX + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(quotation.quotation_number, gridX + 2, y + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Dated', gridX + gridCol1Width + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDateIndian(quotation.created_at), gridX + gridCol1Width + 2, y + 8);
  
  // Row 2
  const row2Y = y + gridRowHeight;
  doc.setFont('helvetica', 'normal');
  doc.text("Buyer's Ref./Order No.", gridX + 2, row2Y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(quotation.quotation_number, gridX + 2, row2Y + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Mode/Terms of Payment', gridX + gridCol1Width + 2, row2Y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text('100% ADVANCE AGAINST PI', gridX + gridCol1Width + 2, row2Y + 8);
  
  // Row 3
  const row3Y = y + (gridRowHeight * 2);
  doc.setFont('helvetica', 'normal');
  doc.text('Dispatched through', gridX + 2, row3Y + 5);
  doc.text('Other References', gridX + gridCol1Width + 2, row3Y + 5);
  
  // Row 4
  const row4Y = y + (gridRowHeight * 3);
  doc.text('Terms of Delivery', gridX + 2, row4Y + 5);
  doc.text('Destination', gridX + gridCol1Width + 2, row4Y + 5);
  
  y += headerHeight;
  
  // ============= ADDRESS SECTION =============
  const customer = quotation.customer;
  const customerStateCode = customer?.gst_number ? getStateCode(customer.gst_number) : '';
  const customerStateName = customerStateCode ? getStateName(customerStateCode) : (customer?.state || '');
  
  const addressParts = [];
  if (customer?.address) addressParts.push(customer.address);
  if (customer?.city) addressParts.push(customer.city);
  if (customer?.pincode) addressParts.push(customer.pincode);
  const fullAddress = addressParts.join(', ').toUpperCase();
  
  const consigneeHeight = 24;
  const buyerHeight = 24;
  const totalAddressHeight = consigneeHeight + buyerHeight;
  
  doc.rect(margin, y, leftColWidth, consigneeHeight, 'S');
  doc.rect(margin + leftColWidth, y, rightColWidth, totalAddressHeight, 'S');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Consignee (Ship to)', margin + 2, y + 4);
  
  let custY = y + 8;
  doc.setFont('helvetica', 'bold');
  doc.text((customer?.company_name || '').toUpperCase(), margin + 2, custY);
  custY += 4;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const addressLines = doc.splitTextToSize(fullAddress, leftColWidth - 6);
  addressLines.slice(0, 2).forEach((line: string) => {
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
  
  y += consigneeHeight;
  
  doc.rect(margin, y, leftColWidth, buyerHeight, 'S');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Buyer (Bill to)', margin + 2, y + 4);
  
  custY = y + 8;
  doc.setFont('helvetica', 'bold');
  doc.text((customer?.company_name || '').toUpperCase(), margin + 2, custY);
  custY += 4;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  addressLines.slice(0, 2).forEach((line: string) => {
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
  
  // ============= ITEMS TABLE =============
  // Note: "per" column replaced with "leadTime" column
  const colWidths = {
    sl: contentWidth * 0.05,
    desc: contentWidth * 0.35,
    hsn: contentWidth * 0.10,
    dueOn: contentWidth * 0.10,
    qty: contentWidth * 0.08,
    rate: contentWidth * 0.10,
    leadTime: contentWidth * 0.05,
    disc: contentWidth * 0.05,
    amount: contentWidth * 0.12
  };
  
  const tableHeaderHeight = 10;
  doc.rect(margin, y, contentWidth, tableHeaderHeight, 'S');
  
  let colX = margin + colWidths.sl;
  doc.line(colX, y, colX, y + tableHeaderHeight); colX += colWidths.desc;
  doc.line(colX, y, colX, y + tableHeaderHeight); colX += colWidths.hsn;
  doc.line(colX, y, colX, y + tableHeaderHeight); colX += colWidths.dueOn;
  doc.line(colX, y, colX, y + tableHeaderHeight); colX += colWidths.qty;
  doc.line(colX, y, colX, y + tableHeaderHeight); colX += colWidths.rate;
  doc.line(colX, y, colX, y + tableHeaderHeight); colX += colWidths.leadTime;
  doc.line(colX, y, colX, y + tableHeaderHeight); colX += colWidths.disc;
  doc.line(colX, y, colX, y + tableHeaderHeight);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  colX = margin;
  doc.text('Sl', colX + colWidths.sl / 2, y + 3, { align: 'center' });
  doc.text('No.', colX + colWidths.sl / 2, y + 7, { align: 'center' });
  colX += colWidths.sl;
  doc.text('Description of Goods', colX + colWidths.desc / 2, y + 6, { align: 'center' });
  colX += colWidths.desc;
  doc.text('HSN/SAC', colX + colWidths.hsn / 2, y + 6, { align: 'center' });
  colX += colWidths.hsn;
  doc.text('Due on', colX + colWidths.dueOn / 2, y + 6, { align: 'center' });
  colX += colWidths.dueOn;
  doc.text('Quantity', colX + colWidths.qty / 2, y + 6, { align: 'center' });
  colX += colWidths.qty;
  doc.text('Rate', colX + colWidths.rate / 2, y + 6, { align: 'center' });
  colX += colWidths.rate;
  // Lead Time header (replaces "per")
  doc.text('Lead', colX + colWidths.leadTime / 2, y + 3, { align: 'center' });
  doc.text('Time', colX + colWidths.leadTime / 2, y + 7, { align: 'center' });
  colX += colWidths.leadTime;
  doc.text('Disc. %', colX + colWidths.disc / 2, y + 6, { align: 'center' });
  colX += colWidths.disc;
  doc.text('Amount', colX + colWidths.amount / 2, y + 6, { align: 'center' });
  
  y += tableHeaderHeight;
  
  let totalQty = 0;
  let totalTax = 0;
  (items || []).forEach((item: any) => {
    totalQty += (item.quantity || 1);
    totalTax += item.tax_amount || 0;
  });
  
  const customerState = customerStateCode || '';
  const isInterstate = customerState !== '' && customerState !== COMPANY.stateCode;
  
  // Constants for pagination
  const itemRowHeight = 10;
  const paginationFooterHeight = 55;
  const paginationTotalRowHeight = 8;
  const paginationAmountWordsHeight = 12;
  const taxRowsHeight = totalTax > 0 ? (isInterstate ? 8 : 12) : 0;
  const minFooterSpace = paginationTotalRowHeight + paginationAmountWordsHeight + paginationFooterHeight + 20;
  
  // Helper function to draw table header on new page
  const drawTableHeader = () => {
    doc.rect(margin, y, contentWidth, tableHeaderHeight, 'S');
    
    let hColX = margin + colWidths.sl;
    doc.line(hColX, y, hColX, y + tableHeaderHeight); hColX += colWidths.desc;
    doc.line(hColX, y, hColX, y + tableHeaderHeight); hColX += colWidths.hsn;
    doc.line(hColX, y, hColX, y + tableHeaderHeight); hColX += colWidths.dueOn;
    doc.line(hColX, y, hColX, y + tableHeaderHeight); hColX += colWidths.qty;
    doc.line(hColX, y, hColX, y + tableHeaderHeight); hColX += colWidths.rate;
    doc.line(hColX, y, hColX, y + tableHeaderHeight); hColX += colWidths.leadTime;
    doc.line(hColX, y, hColX, y + tableHeaderHeight); hColX += colWidths.disc;
    doc.line(hColX, y, hColX, y + tableHeaderHeight);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    hColX = margin;
    doc.text('Sl', hColX + colWidths.sl / 2, y + 3, { align: 'center' });
    doc.text('No.', hColX + colWidths.sl / 2, y + 7, { align: 'center' });
    hColX += colWidths.sl;
    doc.text('Description of Goods', hColX + colWidths.desc / 2, y + 6, { align: 'center' });
    hColX += colWidths.desc;
    doc.text('HSN/SAC', hColX + colWidths.hsn / 2, y + 6, { align: 'center' });
    hColX += colWidths.hsn;
    doc.text('Due on', hColX + colWidths.dueOn / 2, y + 6, { align: 'center' });
    hColX += colWidths.dueOn;
    doc.text('Quantity', hColX + colWidths.qty / 2, y + 6, { align: 'center' });
    hColX += colWidths.qty;
    doc.text('Rate', hColX + colWidths.rate / 2, y + 6, { align: 'center' });
    hColX += colWidths.rate;
    // Lead Time header (replaces "per")
    doc.text('Lead', hColX + colWidths.leadTime / 2, y + 3, { align: 'center' });
    doc.text('Time', hColX + colWidths.leadTime / 2, y + 7, { align: 'center' });
    hColX += colWidths.leadTime;
    doc.text('Disc. %', hColX + colWidths.disc / 2, y + 6, { align: 'center' });
    hColX += colWidths.disc;
    doc.text('Amount', hColX + colWidths.amount / 2, y + 6, { align: 'center' });
    
    y += tableHeaderHeight;
  };
  
  // Track items area for drawing borders
  let itemsAreaStartY = y;
  let currentPageItemsEndY = y;
  
  // Draw items with pagination
  (items || []).forEach((item: any, index: number) => {
    // Check if we need a new page
    const isLastItem = index === (items || []).length - 1;
    const spaceNeeded = isLastItem ? itemRowHeight + minFooterSpace + taxRowsHeight : itemRowHeight;
    
    if (y + spaceNeeded > pageHeight - margin) {
      // Draw borders for current page items area
      const itemsAreaHeight = currentPageItemsEndY - itemsAreaStartY + itemRowHeight;
      doc.rect(margin, itemsAreaStartY, contentWidth, itemsAreaHeight, 'S');
      
      // Draw vertical lines for items area
      let vColX = margin + colWidths.sl;
      doc.line(vColX, itemsAreaStartY, vColX, itemsAreaStartY + itemsAreaHeight); vColX += colWidths.desc;
      doc.line(vColX, itemsAreaStartY, vColX, itemsAreaStartY + itemsAreaHeight); vColX += colWidths.hsn;
      doc.line(vColX, itemsAreaStartY, vColX, itemsAreaStartY + itemsAreaHeight); vColX += colWidths.dueOn;
      doc.line(vColX, itemsAreaStartY, vColX, itemsAreaStartY + itemsAreaHeight); vColX += colWidths.qty;
      doc.line(vColX, itemsAreaStartY, vColX, itemsAreaStartY + itemsAreaHeight); vColX += colWidths.rate;
      doc.line(vColX, itemsAreaStartY, vColX, itemsAreaStartY + itemsAreaHeight); vColX += colWidths.leadTime;
      doc.line(vColX, itemsAreaStartY, vColX, itemsAreaStartY + itemsAreaHeight); vColX += colWidths.disc;
      doc.line(vColX, itemsAreaStartY, vColX, itemsAreaStartY + itemsAreaHeight);
      
      // Add "Continued on next page" text
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text('Continued on next page...', margin + contentWidth - 2, itemsAreaStartY + itemsAreaHeight - 2, { align: 'right' });
      
      // Add new page
      doc.addPage();
      y = margin;
      
      // Add continuation header
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const contTitle = documentType === 'proforma' ? 'PROFORMA INVOICE (Continued)' : 'QUOTATION (Continued)';
      doc.text(contTitle, pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${quotation.quotation_number}`, pageWidth / 2, y, { align: 'center' });
      y += 8;
      
      // Draw table header on new page
      drawTableHeader();
      itemsAreaStartY = y;
    }
    
    // Draw item row
    colX = margin;
    doc.setFontSize(7);
    
    doc.setFont('helvetica', 'normal');
    doc.text((index + 1).toString(), colX + colWidths.sl / 2, y + 4, { align: 'center' });
    colX += colWidths.sl;
    
    const descParts = (item.description || '').split('\n');
    let productCode = descParts[0] || '';
    let productDesc = descParts.length > 1 ? descParts[1] : '';
    
    if (descParts.length === 1 && (item.description || '').includes(' - ')) {
      const dashParts = (item.description || '').split(' - ');
      productCode = dashParts[0];
      productDesc = dashParts.slice(1).join(' - ');
    } else if (descParts.length === 1) {
      productCode = item.description || '';
      productDesc = '';
    }
    
    const maxDescWidth = colWidths.desc - 4;
    doc.setFont('helvetica', 'bold');
    const wrappedCode = doc.splitTextToSize(productCode, maxDescWidth);
    wrappedCode.forEach((line: string, lineIdx: number) => {
      doc.text(line, colX + 2, y + 4 + (lineIdx * 3.5));
    });
    
    if (productDesc) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      const wrappedDesc = doc.splitTextToSize(productDesc, maxDescWidth);
      const descStartY = y + 4 + (wrappedCode.length * 3.5);
      wrappedDesc.slice(0, 2).forEach((line: string, lineIdx: number) => {
        doc.text(line, colX + 2, descStartY + (lineIdx * 3));
      });
    }
    colX += colWidths.desc;
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    
    doc.text(item.hsn_code || '', colX + colWidths.hsn / 2, y + 4, { align: 'center' });
    colX += colWidths.hsn;
    
    const dueDate = quotation.valid_until ? formatDateIndian(quotation.valid_until) : '';
    doc.text(dueDate, colX + colWidths.dueOn / 2, y + 4, { align: 'center' });
    colX += colWidths.dueOn;
    
    doc.setFont('helvetica', 'bold');
    doc.text(`${(item.quantity || 1).toFixed(2)} ${item.unit || 'Nos'}`, colX + colWidths.qty / 2, y + 4, { align: 'center' });
    colX += colWidths.qty;
    
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(item.rate || 0), colX + colWidths.rate - 2, y + 4, { align: 'right' });
    colX += colWidths.rate;
    
    // Lead Time column (replaces "per" column)
    const leadTimeText = item.lead_time_days ? `${item.lead_time_days}d` : '-';
    doc.text(leadTimeText, colX + colWidths.leadTime / 2, y + 4, { align: 'center' });
    colX += colWidths.leadTime;
    
    doc.text(item.discount_percent ? item.discount_percent.toString() : '', colX + colWidths.disc / 2, y + 4, { align: 'center' });
    colX += colWidths.disc;
    
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(item.amount || 0), colX + colWidths.amount - 2, y + 4, { align: 'right' });
    
    currentPageItemsEndY = y;
    y += itemRowHeight;
  });
  
  // Add tax rows at the end of items
  if (totalTax > 0) {
    const descColRight = margin + colWidths.sl + colWidths.desc - 5;
    const amountColRight = margin + contentWidth - 2;
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bolditalic');
    
    if (isInterstate) {
      doc.text('OUTPUT IGST', descColRight, y + 4, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(totalTax), amountColRight, y + 4, { align: 'right' });
      y += 8;
    } else {
      doc.text('OUTPUT CGST', descColRight, y + 4, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(totalTax / 2), amountColRight, y + 4, { align: 'right' });
      
      doc.setFont('helvetica', 'bolditalic');
      doc.text('OUTPUT SGST', descColRight, y + 8, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(totalTax / 2), amountColRight, y + 8, { align: 'right' });
      y += 12;
    }
  }
  
  // Draw final items area border
  const finalItemsAreaHeight = y - itemsAreaStartY;
  doc.rect(margin, itemsAreaStartY, contentWidth, finalItemsAreaHeight, 'S');
  
  // Draw vertical lines for final items area
  colX = margin + colWidths.sl;
  doc.line(colX, itemsAreaStartY, colX, y); colX += colWidths.desc;
  doc.line(colX, itemsAreaStartY, colX, y); colX += colWidths.hsn;
  doc.line(colX, itemsAreaStartY, colX, y); colX += colWidths.dueOn;
  doc.line(colX, itemsAreaStartY, colX, y); colX += colWidths.qty;
  doc.line(colX, itemsAreaStartY, colX, y); colX += colWidths.rate;
  doc.line(colX, itemsAreaStartY, colX, y); colX += colWidths.leadTime;
  doc.line(colX, itemsAreaStartY, colX, y); colX += colWidths.disc;
  doc.line(colX, itemsAreaStartY, colX, y);
  
  // ============= TOTAL ROW =============
  const totalRowHeight = 8;
  doc.rect(margin, y, contentWidth, totalRowHeight, 'S');
  
  colX = margin + colWidths.sl;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.desc;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.hsn;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.dueOn;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.qty;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.rate;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.leadTime;
  doc.line(colX, y, colX, y + totalRowHeight); colX += colWidths.disc;
  doc.line(colX, y, colX, y + totalRowHeight);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Total', margin + colWidths.sl + colWidths.desc - 2, y + 5, { align: 'right' });
  
  const qtyColX = margin + colWidths.sl + colWidths.desc + colWidths.hsn + colWidths.dueOn;
  doc.text(`${totalQty.toFixed(2)} Nos`, qtyColX + colWidths.qty / 2, y + 5, { align: 'center' });
  
  const grandTotal = quotation.grand_total || 0;
  doc.text(`Rs. ${formatCurrency(grandTotal)}`, margin + contentWidth - 2, y + 5, { align: 'right' });
  
  y += totalRowHeight;
  
  // ============= AMOUNT IN WORDS =============
  const amountWordsHeight = 12;
  doc.rect(margin, y, contentWidth, amountWordsHeight, 'S');
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Amount Chargeable (in words)', margin + 2, y + 4);
  
  // convertToIndianWords does NOT include "INR" or "Only" in edge function version
  const amountInWords = convertToIndianWords(grandTotal);
  doc.setFont('helvetica', 'bold');
  doc.text(`INR ${amountInWords} Only`, margin + 2, y + 9);
  
  doc.setFont('helvetica', 'italic');
  doc.text('E. & O.E', margin + contentWidth - 2, y + 9, { align: 'right' });
  
  y += amountWordsHeight;
  
  // ============= FOOTER SECTION =============
  const footerHeight = 55;
  const declarationWidth = contentWidth * 0.55;
  const bankWidth = contentWidth * 0.45;
  
  doc.rect(margin, y, declarationWidth, footerHeight, 'S');
  doc.rect(margin + declarationWidth, y, bankWidth, footerHeight, 'S');
  
  // Declaration
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Declaration', margin + 2, y + 4);
  doc.line(margin + 2, y + 5, margin + 20, y + 5);
  
  let declarations: string[] = [];
  if (quotation.terms_conditions && quotation.terms_conditions.trim()) {
    declarations = quotation.terms_conditions
      .split('\n')
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
  } else {
    declarations = DEFAULT_DECLARATIONS;
  }
  
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
  
  declY += 1;
  doc.text('Thank you for doing business with us!', margin + 2, declY);
  
  // Bank details
  const bankX = margin + declarationWidth + 2;
  let bankY = y + 4;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text("Company's Bank Details", bankX, bankY);
  bankY += 5;
  
  doc.text('Bank Name', bankX, bankY);
  doc.text(`: `, bankX + 25, bankY);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY.bank.name, bankX + 28, bankY);
  bankY += 4;
  
  doc.setFont('helvetica', 'normal');
  doc.text('A/c No.', bankX, bankY);
  doc.text(`: `, bankX + 25, bankY);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY.bank.accountNo, bankX + 28, bankY);
  bankY += 4;
  
  doc.setFont('helvetica', 'normal');
  doc.text('Branch & IFS Code', bankX, bankY);
  doc.text(`: `, bankX + 25, bankY);
  doc.setFont('helvetica', 'bold');
  const branchIfscText = `${COMPANY.bank.branch} & ${COMPANY.bank.ifsc}`;
  const maxBranchWidth = bankWidth - 32; // Available width after label
  const branchLines = doc.splitTextToSize(branchIfscText, maxBranchWidth);
  branchLines.forEach((line: string, idx: number) => {
    doc.text(line, bankX + 28, bankY + (idx * 3));
  });
  
  const sigY = y + footerHeight - 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('for ', bankX + (bankWidth / 2) - 30, sigY);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAVEN AUTOMATION PRIVATE LIMITED', bankX + (bankWidth / 2) - 26, sigY);
  
  doc.line(bankX + 10, sigY + 12, bankX + bankWidth - 12, sigY + 12);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Authorised Signatory', bankX + (bankWidth / 2), sigY + 16, { align: 'center' });
  
  // ============= COMPUTER GENERATED FOOTER =============
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a Computer Generated Document', pageWidth / 2, pageHeight - 5, { align: 'center' });
  
  return doc.output('datauristring').split(',')[1];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set");
      throw new Error("Email service not configured");
    }

    const { 
      quotation_id, 
      recipient_email, 
      recipient_name, 
      message,
      cc,
      bcc,
      reply_to,
      user_id,
      document_type = 'quotation',
      subject: customSubject,
      tenant_id
    }: SendQuotationEmailRequest = await req.json();

    // Fetch tenant email config
    const emailConfig = await getTenantEmailConfig(tenant_id);

    console.log(`Processing ${document_type} email request for quotation ${quotation_id} to ${recipient_email}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select(`
        *,
        customer:customers(*)
      `)
      .eq("id", quotation_id)
      .single();

    if (quotationError || !quotation) {
      console.error("Failed to fetch quotation:", quotationError);
      throw new Error("Quotation not found");
    }

    const { data: items, error: itemsError } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotation_id)
      .order("sort_order", { ascending: true });

    if (itemsError) {
      console.error("Failed to fetch quotation items:", itemsError);
      throw new Error("Failed to fetch quotation items");
    }

    console.log(`Found ${items?.length || 0} items for quotation`);

    const pdfBase64 = generateQuotationPDF(quotation, items || [], document_type);

    const documentTitle = document_type === 'proforma' ? 'Proforma Invoice' : 'Quotation';
    const documentNumber = quotation.quotation_number;
    const fileName = document_type === 'proforma' 
      ? `Proforma_Invoice_${documentNumber}.pdf`
      : `Quotation_${documentNumber}.pdf`;

    // Use custom subject if provided, otherwise generate default
    const subject = customSubject || `${documentTitle} ${documentNumber} from Graven Automation`;

    // Check if custom message already contains a greeting (starts with "Dear")
    const hasGreetingInMessage = message && /^dear\s/i.test(message.trim());
    
    // Only add greeting if message doesn't already have one
    const greeting = hasGreetingInMessage ? '' : (recipient_name ? `<p>Dear ${recipient_name},</p>` : '<p>Dear Sir/Madam,</p>');
    
    // Format custom message as HTML, preserving line breaks
    const formattedMessage = message ? `<div style="white-space: pre-line;">${message.replace(/\n/g, '<br>')}</div>` : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
          .footer { background: #1e293b; color: #94a3b8; padding: 15px 20px; border-radius: 0 0 8px 8px; font-size: 12px; }
          .highlight { background: #dbeafe; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #3b82f6; }
          .amount { font-size: 24px; font-weight: bold; color: #1e40af; }
          a { color: #3b82f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">Graven Automation Pvt. Ltd.</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${documentTitle} - ${documentNumber}</p>
          </div>
          <div class="content">
            ${greeting}
            ${formattedMessage}
            ${!message ? `<p>Please find attached our ${documentTitle.toLowerCase()} for your reference.</p>` : ''}
            <div class="highlight">
              <p style="margin: 0;"><strong>${documentTitle} Number:</strong> ${documentNumber}</p>
              <p style="margin: 5px 0 0 0;"><strong>Total Amount:</strong> <span class="amount">₹${quotation.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</span></p>
            </div>
            ${!message ? `<p>If you have any questions or require any modifications, please don't hesitate to contact us.</p>
            <p>Thank you for your business!</p>
            <p>Best regards,<br><strong>Team Graven Automation</strong></p>` : ''}
          </div>
          <div class="footer">
            <p style="margin: 0;">Graven Automation Pvt. Ltd.</p>
            <p style="margin: 5px 0 0 0;">7/25, Tower F, 2nd Floor, Kirti Nagar Industrial Area, New Delhi 110015</p>
            <p style="margin: 5px 0 0 0;">Contact: 7905350134, 9919089567 | Email: info@gravenautomation.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailPayload: any = {
      from: buildFromAddress(emailConfig, 'sales'),
      to: [recipient_email],
      subject: subject,
      html: htmlContent,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
        },
      ],
    };

    if (cc && cc.length > 0) {
      emailPayload.cc = cc;
    }
    if (bcc && bcc.length > 0) {
      emailPayload.bcc = bcc;
    }
    if (reply_to) {
      emailPayload.reply_to = reply_to || emailConfig.replyTo;
    }

    console.log("Sending email via unified sendEmail...");

    const emailResult = await sendEmail(tenant_id, {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject,
      html: emailPayload.html,
      cc: emailPayload.cc,
      bcc: emailPayload.bcc,
      replyTo: emailPayload.reply_to || emailConfig.replyTo,
      attachments: emailPayload.attachments,
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResult);

    await supabase.from("email_logs").insert({
      email_id: emailResult.messageId || 'unknown',
      quotation_id: quotation_id,
      recipient_email: recipient_email,
      cc_emails: cc || null,
      bcc_emails: bcc || null,
      reply_to: reply_to || emailConfig.replyTo,
      subject: subject,
      status: "sent",
      sent_by: user_id || null,
      metadata: { document_type, recipient_name, has_custom_message: !!message }
    });

    await supabase
      .from("quotations")
      .update({
        sent_at: new Date().toISOString(),
        sent_via: "email",
        status: quotation.status === "draft" ? "sent" : quotation.status,
      })
      .eq("id", quotation_id);

    return new Response(
      JSON.stringify({ success: true, email_id: emailResult.messageId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-quotation-email function:", error);
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
