import type { PurchaseOrder } from '@/hooks/usePurchaseOrders';
import gravenLogo from '@/assets/graven-logo.png';
import type { TenantBranding } from '@/hooks/useTenantBranding';
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

function formatDateIndian(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
 * Generate PO HTML content for printing
 */
function generatePOHTML(po: PurchaseOrder, tenantBranding?: TenantBranding): string {
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
  const logoSrc = tenantBranding?.logoUrl || gravenLogo;
  const items = po.items || [];
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
      .map(t => t.trim())
      .filter(t => t.length > 0);
  } else {
    declarations = [
      'Payment: 100% Advance at the time of Dispatch.',
      'Dispatch Time will be 10-15 Days.',
      'All Disputes are Subject to [Lucknow] Jurisdiction Only.'
    ];
  }
  
  const amountInWords = `INR ${convertToWords(roundedTotal)} Rupees Only`;
  const orderDate = po.order_date ? formatDateIndian(po.order_date) : formatDateIndian(po.created_at);
  const dueDate = po.expected_delivery ? formatDateIndian(po.expected_delivery) : '';

  // Generate items HTML
  const itemsHTML = items.map((item, index) => `
    <tr>
      <td class="po-col-sl">${index + 1}</td>
      <td class="po-col-desc po-bold">${item.description}</td>
      <td class="po-col-due">${dueDate}</td>
      <td class="po-col-qty po-bold">${item.quantity.toFixed(2)} Nos</td>
      <td class="po-col-rate">${formatCurrency(item.rate)}</td>
      <td class="po-col-per">Nos</td>
      <td class="po-col-disc"></td>
      <td class="po-col-amount po-bold">${formatCurrency(item.amount)}</td>
    </tr>
  `).join('');

  // Tax row
  const taxRowHTML = totalTax > 0 ? `
    <tr class="po-tax-row">
      <td class="po-col-sl"></td>
      <td class="po-col-desc po-right"><span class="po-bold-italic">INPUT IGST:</span></td>
      <td class="po-col-due"></td>
      <td class="po-col-qty"></td>
      <td class="po-col-rate"></td>
      <td class="po-col-per"></td>
      <td class="po-col-disc"></td>
      <td class="po-col-amount po-bold">${formatCurrency(totalTax)}</td>
    </tr>
  ` : '';

  // Round off row
  const roundOffHTML = Math.abs(roundOff) > 0.001 ? `
    <tr class="po-roundoff-row">
      <td class="po-col-sl"></td>
      <td class="po-col-desc po-right">
        <span class="po-italic">${roundOff < 0 ? 'Less: Round Off:' : 'Add: Round Off:'}</span>
      </td>
      <td class="po-col-due"></td>
      <td class="po-col-qty"></td>
      <td class="po-col-rate"></td>
      <td class="po-col-per"></td>
      <td class="po-col-disc"></td>
      <td class="po-col-amount po-bold">
        ${roundOff < 0 ? `(-${formatCurrency(Math.abs(roundOff))})` : formatCurrency(Math.abs(roundOff))}
      </td>
    </tr>
  ` : '';

  // Declarations HTML
  const declarationsHTML = declarations.map((term, idx) => {
    const hasNumber = /^\d+\.?\s/.test(term);
    return `<div class="po-declaration-item">${hasNumber ? term : `${idx + 1}. ${term}`}</div>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PO-${po.po_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4;
      margin: 15mm;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 8pt;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .po-template {
      width: 100%;
      max-width: 180mm;
      margin: 0 auto;
    }
    
    .po-title {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      margin: 0 0 8px 0;
    }
    
    .po-header-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
    }
    
    .po-header-table td {
      border: 1px solid #000;
      vertical-align: top;
      padding: 0;
    }
    
    .po-header-left {
      width: 50%;
      padding: 4px;
    }
    
    .po-header-right {
      width: 50%;
      padding: 0;
    }
    
    .po-invoice-to-label {
      font-size: 9pt;
      margin-bottom: 4px;
    }
    
    .po-company-info {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    
    .po-logo {
      width: 15mm;
      height: 15mm;
      object-fit: contain;
    }
    
    .po-company-details {
      flex: 1;
      font-size: 8pt;
      line-height: 1.3;
    }
    
    .po-company-name {
      font-weight: bold;
      font-size: 10pt;
      margin-bottom: 2px;
    }
    
    .po-header-grid {
      width: 100%;
      border-collapse: collapse;
      height: 100%;
    }
    
    .po-header-grid td {
      border: 1px solid #000;
      padding: 2px 4px;
      width: 50%;
      vertical-align: top;
    }
    
    .po-grid-label {
      font-size: 7pt;
    }
    
    .po-grid-value {
      font-size: 8pt;
      font-weight: bold;
    }
    
    .po-section {
      border: 1px solid #000;
      border-top: none;
      padding: 4px;
    }
    
    .po-section-label {
      font-size: 8pt;
      margin-bottom: 2px;
    }
    
    .po-section-content {
      font-size: 8pt;
      line-height: 1.3;
    }
    
    .po-items-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .po-items-table th,
    .po-items-table td {
      border: 1px solid #000;
      padding: 2px 4px;
      font-size: 8pt;
      vertical-align: middle;
    }
    
    .po-items-table th {
      font-weight: normal;
      text-align: center;
      font-size: 7pt;
    }
    
    .po-col-sl { width: 4%; text-align: center; }
    .po-col-desc { width: 36%; text-align: left; }
    .po-col-due { width: 10%; text-align: center; }
    .po-col-qty { width: 10%; text-align: center; }
    .po-col-rate { width: 10%; text-align: right; }
    .po-col-per { width: 5%; text-align: center; }
    .po-col-disc { width: 5%; text-align: center; }
    .po-col-amount { width: 15%; text-align: right; }
    
    .po-bold { font-weight: bold; }
    .po-italic { font-style: italic; }
    .po-bold-italic { font-weight: bold; font-style: italic; }
    .po-right { text-align: right; }
    
    .po-amount-words {
      border: 1px solid #000;
      border-top: none;
      padding: 4px;
    }
    
    .po-amount-words-label {
      font-size: 7pt;
    }
    
    .po-amount-words-value {
      font-size: 8pt;
      font-weight: bold;
    }
    
    .po-footer-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .po-footer-table td {
      border: 1px solid #000;
      border-top: none;
      vertical-align: top;
      padding: 4px;
    }
    
    .po-declaration {
      width: 55%;
    }
    
    .po-declaration-title {
      font-size: 7pt;
      text-decoration: underline;
      margin-bottom: 4px;
    }
    
    .po-declaration-list {
      font-size: 7pt;
      line-height: 1.4;
    }
    
    .po-declaration-item {
      margin-bottom: 1px;
    }
    
    .po-thanks {
      margin-top: 8px;
      font-size: 7pt;
    }
    
    .po-signatory {
      width: 45%;
      position: relative;
      min-height: 110px;
    }
    
    .po-signatory-for {
      font-size: 7pt;
      margin-bottom: 8px;
    }
    
    .po-signatory-columns {
      display: flex;
      justify-content: space-between;
      position: absolute;
      bottom: 4px;
      left: 4px;
      right: 4px;
      padding-top: 45px;
    }
    
    .po-signatory-col {
      text-align: center;
      width: 30%;
    }
    
    .po-signatory-line {
      border-bottom: 1px solid #000;
      margin-bottom: 2px;
    }
    
    .po-signatory-label {
      font-size: 6pt;
      font-weight: bold;
    }
    
    .po-signatory-name {
      font-size: 6pt;
      margin-top: 1px;
    }
    
    .po-generated-note {
      text-align: center;
      font-size: 8pt;
      margin-top: 8px;
    }
    
    @media print {
      body { margin: 0; }
      .po-template { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="po-template">
    <h1 class="po-title">PURCHASE ORDER</h1>
    
    <table class="po-header-table">
      <tr>
        <td class="po-header-left">
          <div class="po-invoice-to-label">Invoice To</div>
          <div class="po-company-info">
            <img src="${logoSrc}" alt="Logo" class="po-logo" />
            <div class="po-company-details">
              <div class="po-company-name">${co.name}</div>
              <div>${co.address1}</div>
              <div>${co.address2}</div>
              <div>${co.address3}</div>
              <div>GSTIN/UIN: ${co.gstin}</div>
              <div>State Name : ${co.stateName}, Code : ${co.stateCode}</div>
              <div>Contact : ${co.phones.join(', ')}</div>
              <div>E-Mail : ${co.email}</div>
            </div>
          </div>
        </td>
        <td class="po-header-right">
          <table class="po-header-grid">
            <tr>
              <td>
                <div class="po-grid-label">Voucher No.</div>
                <div class="po-grid-value">${po.po_number}</div>
              </td>
              <td>
                <div class="po-grid-label">Dated</div>
                <div class="po-grid-value">${orderDate}</div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="po-grid-label">Reference No. & Date.</div>
                <div class="po-grid-value">${po.po_number}</div>
              </td>
              <td>
                <div class="po-grid-label">Mode/Terms of Payment</div>
                <div class="po-grid-value"></div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="po-grid-label">Dispatched through</div>
                <div class="po-grid-value"></div>
              </td>
              <td>
                <div class="po-grid-label">Other References</div>
                <div class="po-grid-value"></div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="po-grid-label">Terms of Delivery</div>
                <div class="po-grid-value"></div>
              </td>
              <td>
                <div class="po-grid-label">Destination</div>
                <div class="po-grid-value"></div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <div class="po-section">
      <div class="po-section-label">Consignee (Ship to)</div>
      <div class="po-section-content">
        <div class="po-company-name">${co.name}</div>
        <div>${co.address1}</div>
        <div>${co.address2}</div>
        <div>${co.address3}</div>
        <div>e-mail : ${co.email}</div>
        <div>GSTIN/UIN : ${co.gstin}</div>
        <div>State Name : ${co.stateName}, Code : ${co.stateCode}</div>
      </div>
    </div>
    
    <div class="po-section">
      <div class="po-section-label">Supplier (Bill from)</div>
      <div class="po-section-content">
        <div class="po-company-name">${(supplier?.name || '').toUpperCase()}</div>
        ${supplier?.address ? `<div>${supplier.address}</div>` : ''}
        ${supplier?.gst_number ? `<div>GSTIN/UIN : ${supplier.gst_number}</div>` : ''}
        ${(supplierStateName || supplierStateCode) ? `<div>State Name : ${supplierStateName}${supplierStateCode ? `, Code : ${supplierStateCode}` : ''}</div>` : ''}
      </div>
    </div>
    
    <table class="po-items-table">
      <thead>
        <tr>
          <th class="po-col-sl">Sl<br/>No.</th>
          <th class="po-col-desc">Description of Goods</th>
          <th class="po-col-due">Due on</th>
          <th class="po-col-qty">Quantity</th>
          <th class="po-col-rate">Rate</th>
          <th class="po-col-per">per</th>
          <th class="po-col-disc">Disc. %</th>
          <th class="po-col-amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
        ${taxRowHTML}
        ${roundOffHTML}
        <tr class="po-total-row">
          <td class="po-col-sl"></td>
          <td class="po-col-desc po-right">Total</td>
          <td class="po-col-due"></td>
          <td class="po-col-qty po-bold">${totalQty.toFixed(2)} Nos</td>
          <td class="po-col-rate"></td>
          <td class="po-col-per"></td>
          <td class="po-col-disc"></td>
          <td class="po-col-amount po-bold">₹ ${formatCurrency(roundedTotal)}</td>
        </tr>
      </tbody>
    </table>
    
    <div class="po-amount-words">
      <div class="po-amount-words-label">Amount Chargeable (in words)</div>
      <div class="po-amount-words-value">${amountInWords}</div>
    </div>
    
    <table class="po-footer-table">
      <tr>
        <td class="po-declaration">
          <div class="po-declaration-title">Declaration</div>
          <div class="po-declaration-list">
            ${declarationsHTML}
          </div>
          <div class="po-thanks">Thanks for Doing Business with us!</div>
        </td>
        <td class="po-signatory">
          <div class="po-signatory-for">for <span class="po-bold">${co.name}</span></div>
          <div class="po-signatory-columns">
            <div class="po-signatory-col">
              <div class="po-signatory-line"></div>
              <div class="po-signatory-label">Prepared By</div>
              <div class="po-signatory-name">${po.creator?.full_name || ''}</div>
            </div>
            <div class="po-signatory-col">
              <div class="po-signatory-line"></div>
              <div class="po-signatory-label">Verified By</div>
              <div class="po-signatory-name">${po.verifier?.full_name || ''}</div>
            </div>
            <div class="po-signatory-col">
              <div class="po-signatory-line"></div>
              <div class="po-signatory-label">Approved By</div>
              <div class="po-signatory-name">${po.approver?.full_name || ''}</div>
            </div>
          </div>
        </td>
      </tr>
    </table>
    
    <div class="po-generated-note">This is a Computer Generated Document</div>
  </div>
  
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;
}

/**
 * Generate PO PDF by opening print dialog
 * User can save as PDF from the print dialog
 */
export function generatePOPdf(po: PurchaseOrder, tenantBranding?: TenantBranding): void {
  const html = generatePOHTML(po, tenantBranding);
  
  // Open a new window with the PO content
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('Please allow popups to download the PO');
    return;
  }
  
  // Write the HTML content (which includes the auto-print script)
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Get PO HTML for preview (without auto-print)
 */
export function getPOPreviewHTML(po: PurchaseOrder, tenantBranding?: TenantBranding): string {
  const html = generatePOHTML(po, tenantBranding);
  // Remove the auto-print script for preview
  return html.replace(/<script>[\s\S]*?<\/script>/g, '');
}
