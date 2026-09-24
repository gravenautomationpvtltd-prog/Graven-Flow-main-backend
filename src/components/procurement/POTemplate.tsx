import { forwardRef } from 'react';
import type { PurchaseOrder } from '@/hooks/usePurchaseOrders';
import gravenLogo from '@/assets/graven-logo.png';
import './POTemplate.css';

interface POTemplateProps {
  po: PurchaseOrder;
  forPrint?: boolean;
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

export const POTemplate = forwardRef<HTMLDivElement, POTemplateProps>(({ po, forPrint = false }, ref) => {
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
  
  // Parse declarations from terms_conditions
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

  return (
    <div ref={ref} className={`po-template ${forPrint ? 'po-print' : ''}`}>
      {/* Title */}
      <h1 className="po-title">PURCHASE ORDER</h1>
      
      {/* Header Section */}
      <table className="po-header-table">
        <tbody>
          <tr>
            {/* Left Column - Invoice To */}
            <td className="po-header-left">
              <div className="po-invoice-to-label">Invoice To</div>
              <div className="po-company-info">
                <img src={gravenLogo} alt="Logo" className="po-logo" />
                <div className="po-company-details">
                  <div className="po-company-name">{COMPANY.name}</div>
                  <div>{COMPANY.address1}</div>
                  <div>{COMPANY.address2}</div>
                  <div>{COMPANY.address3}</div>
                  <div>GSTIN/UIN: {COMPANY.gstin}</div>
                  <div>State Name : {COMPANY.stateName}, Code : {COMPANY.stateCode}</div>
                  <div>Contact : {COMPANY.phones.join(', ')}</div>
                  <div>E-Mail : {COMPANY.email}</div>
                </div>
              </div>
            </td>
            
            {/* Right Column - Grid */}
            <td className="po-header-right">
              <table className="po-header-grid">
                <tbody>
                  <tr>
                    <td>
                      <div className="po-grid-label">Voucher No.</div>
                      <div className="po-grid-value">{po.po_number}</div>
                    </td>
                    <td>
                      <div className="po-grid-label">Dated</div>
                      <div className="po-grid-value">{po.order_date ? formatDateIndian(po.order_date) : formatDateIndian(po.created_at)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="po-grid-label">Reference No. & Date.</div>
                      <div className="po-grid-value">{po.po_number}</div>
                    </td>
                    <td>
                      <div className="po-grid-label">Mode/Terms of Payment</div>
                      <div className="po-grid-value"></div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="po-grid-label">Dispatched through</div>
                      <div className="po-grid-value"></div>
                    </td>
                    <td>
                      <div className="po-grid-label">Other References</div>
                      <div className="po-grid-value"></div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="po-grid-label">Terms of Delivery</div>
                      <div className="po-grid-value"></div>
                    </td>
                    <td>
                      <div className="po-grid-label">Destination</div>
                      <div className="po-grid-value"></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      
      {/* Consignee Section */}
      <div className="po-section">
        <div className="po-section-label">Consignee (Ship to)</div>
        <div className="po-section-content">
          <div className="po-company-name">{COMPANY.name}</div>
          <div>{COMPANY.address1}</div>
          <div>{COMPANY.address2}</div>
          <div>{COMPANY.address3}</div>
          <div>e-mail : {COMPANY.email}</div>
          <div>GSTIN/UIN : {COMPANY.gstin}</div>
          <div>State Name : {COMPANY.stateName}, Code : {COMPANY.stateCode}</div>
        </div>
      </div>
      
      {/* Supplier Section */}
      <div className="po-section">
        <div className="po-section-label">Supplier (Bill from)</div>
        <div className="po-section-content">
          <div className="po-company-name">{(supplier?.name || '').toUpperCase()}</div>
          {supplier?.address && <div>{supplier.address}</div>}
          {supplier?.gst_number && <div>GSTIN/UIN : {supplier.gst_number}</div>}
          {(supplierStateName || supplierStateCode) && (
            <div>State Name : {supplierStateName}{supplierStateCode ? `, Code : ${supplierStateCode}` : ''}</div>
          )}
        </div>
      </div>
      
      {/* Items Table */}
      <table className="po-items-table">
        <thead>
          <tr>
            <th className="po-col-sl">Sl<br/>No.</th>
            <th className="po-col-desc">Description of Goods</th>
            <th className="po-col-due">Due on</th>
            <th className="po-col-qty">Quantity</th>
            <th className="po-col-rate">Rate</th>
            <th className="po-col-per">per</th>
            <th className="po-col-disc">Disc. %</th>
            <th className="po-col-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td className="po-col-sl">{index + 1}</td>
              <td className="po-col-desc po-bold">{item.description}</td>
              <td className="po-col-due">{po.expected_delivery ? formatDateIndian(po.expected_delivery) : ''}</td>
              <td className="po-col-qty po-bold">{item.quantity.toFixed(2)} Nos</td>
              <td className="po-col-rate">{formatCurrency(item.rate)}</td>
              <td className="po-col-per">Nos</td>
              <td className="po-col-disc"></td>
              <td className="po-col-amount po-bold">{formatCurrency(item.amount)}</td>
            </tr>
          ))}
          
          {/* Tax Row */}
          {totalTax > 0 && (
            <tr className="po-tax-row">
              <td className="po-col-sl"></td>
              <td className="po-col-desc po-right"><span className="po-bold-italic">INPUT IGST:</span></td>
              <td className="po-col-due"></td>
              <td className="po-col-qty"></td>
              <td className="po-col-rate"></td>
              <td className="po-col-per"></td>
              <td className="po-col-disc"></td>
              <td className="po-col-amount po-bold">{formatCurrency(totalTax)}</td>
            </tr>
          )}
          
          {/* Round Off Row */}
          {Math.abs(roundOff) > 0.001 && (
            <tr className="po-roundoff-row">
              <td className="po-col-sl"></td>
              <td className="po-col-desc po-right">
                <span className="po-italic">{roundOff < 0 ? 'Less: Round Off:' : 'Add: Round Off:'}</span>
              </td>
              <td className="po-col-due"></td>
              <td className="po-col-qty"></td>
              <td className="po-col-rate"></td>
              <td className="po-col-per"></td>
              <td className="po-col-disc"></td>
              <td className="po-col-amount po-bold">
                {roundOff < 0 ? `(-${formatCurrency(Math.abs(roundOff))})` : formatCurrency(Math.abs(roundOff))}
              </td>
            </tr>
          )}
          
          {/* Total Row */}
          <tr className="po-total-row">
            <td className="po-col-sl"></td>
            <td className="po-col-desc po-right">Total</td>
            <td className="po-col-due"></td>
            <td className="po-col-qty po-bold">{totalQty.toFixed(2)} Nos</td>
            <td className="po-col-rate"></td>
            <td className="po-col-per"></td>
            <td className="po-col-disc"></td>
            <td className="po-col-amount po-bold">₹ {formatCurrency(roundedTotal)}</td>
          </tr>
        </tbody>
      </table>
      
      {/* Amount in Words */}
      <div className="po-amount-words">
        <div className="po-amount-words-label">Amount Chargeable (in words)</div>
        <div className="po-amount-words-value">{amountInWords}</div>
      </div>
      
      {/* Footer Section */}
      <table className="po-footer-table">
        <tbody>
          <tr>
            {/* Declaration */}
            <td className="po-declaration">
              <div className="po-declaration-title">Declaration</div>
              <div className="po-declaration-list">
                {declarations.map((term, idx) => {
                  const hasNumber = /^\d+\.?\s/.test(term);
                  return (
                    <div key={idx} className="po-declaration-item">
                      {hasNumber ? term : `${idx + 1}. ${term}`}
                    </div>
                  );
                })}
              </div>
              <div className="po-thanks">Thanks for Doing Business with us!</div>
            </td>
            
            {/* Signatory */}
            <td className="po-signatory">
              <div className="po-signatory-for">
                for <span className="po-bold">{COMPANY.name}</span>
              </div>
              <div className="po-signatory-columns">
                <div className="po-signatory-col">
                  <div className="po-signatory-line"></div>
                  <div className="po-signatory-label">Prepared By</div>
                  <div className="po-signatory-name">{po.creator?.full_name || ''}</div>
                </div>
                <div className="po-signatory-col">
                  <div className="po-signatory-line"></div>
                  <div className="po-signatory-label">Verified By</div>
                  <div className="po-signatory-name">{po.verifier?.full_name || ''}</div>
                </div>
                <div className="po-signatory-col">
                  <div className="po-signatory-line"></div>
                  <div className="po-signatory-label">Approved By</div>
                  <div className="po-signatory-name">{po.approver?.full_name || ''}</div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      {/* Computer Generated Footer */}
      <div className="po-generated-note">This is a Computer Generated Document</div>
    </div>
  );
});

POTemplate.displayName = 'POTemplate';

export default POTemplate;
