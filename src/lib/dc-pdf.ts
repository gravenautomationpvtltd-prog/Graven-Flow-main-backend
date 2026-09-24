import { QuotationWithDetails } from '@/hooks/useQuotations';
import { generateDocumentPDF, CompanyDefaultsOptions } from './quotation-pdf';
import type { TenantBranding } from '@/hooks/useTenantBranding';

function toDcNumber(quotationNumber: string): string {
  // Convert common quotation prefixes to DC- (e.g. GA-Q26-0512 -> GA-DC26-0512, QT-... -> DC-...)
  if (!quotationNumber) return 'DC';
  if (quotationNumber.startsWith('QT-')) return quotationNumber.replace(/^QT-/, 'DC-');
  // Replace a -Q<digits> token with -DC<digits>
  if (/-Q\d/.test(quotationNumber)) return quotationNumber.replace(/-Q(\d)/, '-DC$1');
  return `DC-${quotationNumber}`;
}

export function generateDeliveryChallanPDF(
  quotation: QuotationWithDetails,
  companyDefaults?: CompanyDefaultsOptions,
  tenantBranding?: TenantBranding,
) {
  const dcNumber = toDcNumber(quotation.quotation_number);
  const dcQuotation = { ...quotation, quotation_number: dcNumber } as QuotationWithDetails;
  return generateDocumentPDF({
    documentType: 'delivery_challan',
    quotation: dcQuotation,
    companyDefaults,
    tenantBranding,
  });
}

export function downloadDeliveryChallanPDF(
  quotation: QuotationWithDetails,
  companyDefaults?: CompanyDefaultsOptions,
  tenantBranding?: TenantBranding,
): void {
  const doc = generateDeliveryChallanPDF(quotation, companyDefaults, tenantBranding);
  const dcNumber = toDcNumber(quotation.quotation_number);
  doc.save(`DeliveryChallan_${dcNumber}.pdf`);
}
