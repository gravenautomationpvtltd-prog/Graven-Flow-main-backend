import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TenantBranding } from '@/hooks/useTenantBranding';
import type { ComparisonRow, ComparisonTotals, ComparisonAssumptions } from './comparison-sheet';

const inr = (n: number | null | undefined, d = 2) =>
  n == null ? '-' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

export interface ComparisonPdfMeta {
  quotationNumber: string;
  customerName?: string | null;
  date?: string | null;
  assumptions?: ComparisonAssumptions | null;
}

export function generateComparisonSheetPDF(
  rows: ComparisonRow[],
  totals: ComparisonTotals,
  meta: ComparisonPdfMeta,
  branding?: TenantBranding,
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(branding?.companyName || 'PRICE COMPARISON SHEET', 14, 14);

  doc.setFontSize(10);
  doc.text('PRICE COMPARISON SHEET', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Quotation: ${meta.quotationNumber}`, 14, 26);
  if (meta.customerName) doc.text(`Customer: ${meta.customerName}`, 90, 26);
  if (meta.date) doc.text(`Date: ${meta.date}`, 200, 26);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 30, 30);
  doc.text('INTERNAL - CONFIDENTIAL - NOT FOR CUSTOMER', pageWidth - 14, 14, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  let startY = 31;
  if (meta.assumptions) {
    const a = meta.assumptions;
    doc.setFontSize(7);
    doc.text(
      `Assumptions — RMB/USD ${a.rmb_usd_rate} | USD/INR ${a.usd_inr_rate} | Freight $${a.freight_usd_per_kg}/kg | Insurance ${a.insurance_pct}% | CC ${a.cc_pct}% | Duty ${a.duty_pct}% | Expense ${a.expense_pct}% | Margin ${a.margin_pct}% | Negotiation ${a.negotiation_pct}%`,
      14,
      startY,
    );
    startY += 4;
  }

  autoTable(doc, {
    startY,
    head: [[
      'SR',
      'Model Number',
      'Description',
      'Qty',
      'List ₹',
      'RMB',
      'FOB ₹',
      'Frt+Ins ₹',
      'Duty+CC ₹',
      'Exp ₹',
      'Landed ₹',
      'Net Rate ₹',
      'Margin ₹',
      'Margin %',
      'Taxable ₹',
      'Tax %',
      'Tax ₹',
      'Total ₹',
      'Source',
    ]],
    body: rows.map((r, i) => [
      String(i + 1),
      r.model_number || '-',
      r.description || '-',
      `${r.quantity} ${r.unit}`,
      inr(r.list_price),
      inr(r.rmb_price),
      inr(r.breakdown?.fob_inr ?? null),
      inr(r.breakdown ? r.breakdown.freight_inr + r.breakdown.insurance_inr : null),
      inr(r.breakdown ? r.breakdown.duty_inr + r.breakdown.cc_inr : null),
      inr(r.breakdown?.expense_inr ?? null),
      inr(r.landed_inr_per_unit),
      inr(r.net_rate),
      inr(r.margin_inr),
      r.margin_pct == null ? '-' : `${inr(r.margin_pct, 1)}%`,
      inr(r.line_total),
      `${inr(r.tax_percent, 1)}%`,
      inr(r.tax_amount),
      inr(r.line_total_with_tax),
      r.source,
    ]),
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [39, 39, 42], textColor: 255, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 38 },
      3: { cellWidth: 13, halign: 'right' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 14, halign: 'right' },
      6: { cellWidth: 15, halign: 'right' },
      7: { cellWidth: 16, halign: 'right' },
      8: { cellWidth: 16, halign: 'right' },
      9: { cellWidth: 13, halign: 'right' },
      10: { cellWidth: 17, halign: 'right' },
      11: { cellWidth: 17, halign: 'right' },
      12: { cellWidth: 16, halign: 'right' },
      13: { cellWidth: 14, halign: 'right' },
      14: { cellWidth: 18, halign: 'right' },
      15: { cellWidth: 11, halign: 'right' },
      16: { cellWidth: 15, halign: 'right' },
      17: { cellWidth: 19, halign: 'right' },
      18: { cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && (data.column.index === 12 || data.column.index === 13)) {
        const row = rows[data.row.index];
        if (row?.margin_pct != null) {
          data.cell.styles.textColor = row.below_min_margin
            ? [190, 30, 30]
            : row.margin_pct < 10
              ? [180, 110, 0]
              : [20, 120, 60];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  const afterTableY = (doc as any).lastAutoTable?.finalY ?? startY + 20;
  let y = afterTableY + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Total list value: ₹${inr(totals.listValue)}`, 14, y);
  doc.text(`Freight + insurance: ₹${inr(totals.freightValue)}`, 75, y);
  doc.text(`Duty + CC: ₹${inr(totals.dutyValue)}`, 140, y);
  doc.text(`Expenses: ₹${inr(totals.expenseValue)}`, 195, y);
  doc.text(`Total landed cost: ₹${inr(totals.landedValue)}`, 240, y);
  y += 5;
  doc.text(`Taxable value: ₹${inr(totals.quotedValue)}`, 14, y);
  doc.text(`Tax: ₹${inr(totals.taxValue)}`, 75, y);
  doc.text(`Grand total incl. tax: ₹${inr(totals.quotedValueWithTax)}`, 140, y);
  doc.text(`Total margin: ₹${inr(totals.marginValue)}`, 210, y);
  doc.text(
    `Blended margin: ${totals.blendedMarginPct == null ? '-' : `${inr(totals.blendedMarginPct, 1)}%`}`,
    258,
    y,
  );

  if (totals.missingRmbCount > 0) {
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 80, 0);
    doc.text(`${totals.missingRmbCount} line(s) have no RMB reference — margin shown from list price basis.`, 14, y);
    doc.setTextColor(0, 0, 0);
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      'INTERNAL - CONFIDENTIAL - NOT FOR CUSTOMER',
      14,
      doc.internal.pageSize.getHeight() - 6,
    );
    doc.text(`Page ${p} of ${pages}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 6, {
      align: 'right',
    });
    doc.setTextColor(0);
  }

  return doc;
}

export function downloadComparisonSheetPDF(
  rows: ComparisonRow[],
  totals: ComparisonTotals,
  meta: ComparisonPdfMeta,
  branding?: TenantBranding,
): void {
  const doc = generateComparisonSheetPDF(rows, totals, meta, branding);
  doc.save(`PriceComparison_${meta.quotationNumber}.pdf`);
}
