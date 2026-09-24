import { QuotationWithDetails } from '@/hooks/useQuotations';
import { generateDocumentPDF, CompanyDefaultsOptions } from './quotation-pdf';
import type { TenantBranding } from '@/hooks/useTenantBranding';

export function generateProformaInvoicePDF(quotation: QuotationWithDetails, companyDefaults?: CompanyDefaultsOptions, tenantBranding?: TenantBranding) {
  return generateDocumentPDF({ documentType: 'proforma', quotation, companyDefaults, tenantBranding });
}

export function downloadProformaInvoicePDF(quotation: QuotationWithDetails, companyDefaults?: CompanyDefaultsOptions, tenantBranding?: TenantBranding): void {
  const doc = generateProformaInvoicePDF(quotation, companyDefaults, tenantBranding);
  // Change filename to use PI prefix
  const piNumber = quotation.quotation_number.replace('QT-', 'PI-');
  doc.save(`${piNumber}.pdf`);
}
