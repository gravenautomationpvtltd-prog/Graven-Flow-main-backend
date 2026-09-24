// Invoice PDF generation using shared quotation-pdf template
import { generateDocumentPDF, QuotationWithDetails, InvoiceOptions } from './quotation-pdf';
import jsPDF from 'jspdf';

// Re-export types for convenience
export type { QuotationWithDetails, InvoiceOptions };

// Legacy InvoiceData interface for backward compatibility
interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  buyersOrderNo?: string;
  orderDate?: string;
  dispatchedThrough?: string;
  destination?: string;
  billOfLading?: string;
  motorVehicleNo?: string;
  dispatchNumber?: string;
  consignee?: {
    company_name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  };
  buyer: {
    company_name: string;
    contact_person?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gst_number?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  items: Array<{
    description: string;
    hsn_code?: string;
    quantity: number;
    unit?: string;
    rate: number;
    discount_percent?: number;
    amount: number;
    tax_percent?: number;
    tax_amount?: number;
  }>;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  isIgst?: boolean;
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  declaration?: string[];
  notes?: string;
}

/**
 * Generate Invoice PDF - backward compatible function
 * Converts legacy InvoiceData format to QuotationWithDetails and generates PDF
 */
export function generateInvoicePdf(data: InvoiceData): void {
  // Convert legacy format to QuotationWithDetails
  // Using type assertion since we're building a minimal structure for PDF generation
  const quotation = {
    id: '',
    quotation_number: data.invoiceNumber,
    created_at: data.invoiceDate,
    status: 'sent',
    subtotal: data.subtotal,
    total_tax: data.totalTax,
    grand_total: data.grandTotal,
    terms_conditions: data.declaration?.join('\n') || data.notes,
    currency: 'INR' as const,
    customer: {
      id: '',
      company_name: data.buyer.company_name,
      contact_person: data.buyer.contact_person || null,
      phone: data.buyer.phone || '',
      email: data.buyer.email || null,
      address: data.buyer.address || null,
      city: data.buyer.city || null,
      state: data.buyer.state || null,
      pincode: data.buyer.pincode || null,
      gst_number: data.buyer.gst_number || null,
    },
    items: data.items.map((item, index) => ({
      description: item.description,
      hsn_code: item.hsn_code || null,
      quantity: item.quantity,
      rate: item.rate,
      unit: item.unit || 'Nos',
      discount_percent: item.discount_percent || 0,
      discount_amount: 0,
      tax_percent: item.tax_percent || 18,
      amount: item.amount,
      tax_amount: item.tax_amount || 0,
      sort_order: index,
    })),
  } as QuotationWithDetails;

  const invoiceOptions: InvoiceOptions = {
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate,
    irn: data.irn,
    ackNo: data.ackNo,
    ackDate: data.ackDate,
    buyersOrderNo: data.buyersOrderNo,
    orderDate: data.orderDate,
    dispatchDocNo: data.dispatchNumber,
    dispatchedThrough: data.dispatchedThrough,
    destination: data.destination,
    billOfLading: data.billOfLading,
    motorVehicleNo: data.motorVehicleNo,
    consignee: data.consignee,
  };

  const doc = generateDocumentPDF({ documentType: 'invoice', quotation, invoiceOptions });
  doc.save(`Invoice_${data.invoiceNumber}.pdf`);
}

/**
 * Generate Invoice PDF using QuotationWithDetails format directly
 */
export function generateInvoicePdfFromQuotation(quotation: QuotationWithDetails, invoiceOptions: InvoiceOptions): jsPDF {
  return generateDocumentPDF({ documentType: 'invoice', quotation, invoiceOptions });
}

/**
 * Download Invoice PDF using QuotationWithDetails format
 */
export function downloadInvoicePdf(quotation: QuotationWithDetails, invoiceOptions: InvoiceOptions): void {
  const doc = generateInvoicePdfFromQuotation(quotation, invoiceOptions);
  doc.save(`Invoice_${invoiceOptions.invoiceNumber || quotation.quotation_number}.pdf`);
}
