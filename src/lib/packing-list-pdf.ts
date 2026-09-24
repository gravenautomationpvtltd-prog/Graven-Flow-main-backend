import jsPDF from 'jspdf';
import type { Dispatch } from '@/hooks/useDispatches';

/**
 * Packing list — logistics document only.
 * Weight is always in KG and dimensions always in CM. No prices ever appear here,
 * and weight/dimensions never appear on quotations, PIs or invoices.
 */
export function generatePackingListPdf(dispatch: Dispatch): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PACKING LIST', pageWidth / 2, y, { align: 'center' });

  y += 12;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dispatch No: ${dispatch.dispatch_number}`, margin, y);
  doc.text(
    `Date: ${dispatch.dispatch_date ? new Date(dispatch.dispatch_date).toLocaleDateString('en-IN') : '-'}`,
    pageWidth - margin,
    y,
    { align: 'right' },
  );

  y += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('SHIP TO:', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  const c: any = (dispatch as any).customer;
  if (c) {
    doc.text(c.company_name ?? '-', margin, y);
    y += 5;
    const address =
      dispatch.shipping_address ||
      [c.address, c.city, c.state, c.pincode].filter(Boolean).join(', ');
    if (address) {
      const lines = doc.splitTextToSize(address, pageWidth - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 5;
    }
  } else {
    doc.text('-', margin, y);
    y += 5;
  }

  if (dispatch.courier_name || dispatch.tracking_number) {
    y += 2;
    doc.text(
      [dispatch.courier_name && `Courier: ${dispatch.courier_name}`, dispatch.tracking_number && `Tracking: ${dispatch.tracking_number}`]
        .filter(Boolean)
        .join('    '),
      margin,
      y,
    );
    y += 6;
  }

  y += 6;

  const cols = [
    { label: '#', x: margin, w: 10, align: 'left' as const },
    { label: 'Model No', x: margin + 10, w: 38, align: 'left' as const },
    { label: 'Description', x: margin + 48, w: 62, align: 'left' as const },
    { label: 'Qty', x: margin + 118, w: 14, align: 'right' as const },
    { label: 'Unit Wt (KG)', x: margin + 148, w: 20, align: 'right' as const },
    { label: 'Total Wt (KG)', x: pageWidth - margin, w: 20, align: 'right' as const },
  ];

  const header = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    cols.forEach((col) => doc.text(col.label, col.x, y, { align: col.align }));
    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
  };
  header();

  const items = dispatch.items ?? [];
  let totalWeight = 0;
  let totalQty = 0;

  items.forEach((item: any, i) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
      header();
    }
    const qty = Number(item.quantity ?? 0);
    const unitWt = item.unit_weight_kg == null ? null : Number(item.unit_weight_kg);
    const lineWt = unitWt === null ? null : Math.round(unitWt * qty * 1000) / 1000;
    totalQty += qty;
    if (lineWt !== null) totalWeight += lineWt;

    const descLines = doc.splitTextToSize(String(item.description ?? ''), 62);
    doc.text(String(i + 1), cols[0].x, y);
    doc.text(String(item.model_number ?? '-'), cols[1].x, y);
    doc.text(descLines, cols[2].x, y);
    doc.text(String(qty), cols[3].x, y, { align: 'right' });
    doc.text(unitWt === null ? '-' : unitWt.toFixed(3), cols[4].x, y, { align: 'right' });
    doc.text(lineWt === null ? '-' : lineWt.toFixed(3), cols[5].x, y, { align: 'right' });

    y += Math.max(descLines.length * 5, 5);

    const dims =
      item.length_cm != null && item.width_cm != null && item.height_cm != null
        ? `Dimensions: ${item.length_cm} x ${item.width_cm} x ${item.height_cm} CM`
        : null;
    if (dims) {
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(dims, cols[2].x, y);
      doc.setTextColor(0);
      doc.setFontSize(9);
      y += 5;
    }
    y += 2;
  });

  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total packages / quantity: ${totalQty}`, margin, y);
  doc.text(`Total weight: ${totalWeight.toFixed(3)} KG`, pageWidth - margin, y, { align: 'right' });

  const missing = items.filter((it: any) => it.unit_weight_kg == null).length;
  if (missing > 0) {
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 60, 0);
    doc.text(`${missing} item(s) have no weight recorded — total weight is incomplete.`, margin, y);
    doc.setTextColor(0);
  }

  doc.save(`Packing-List-${dispatch.dispatch_number}.pdf`);
}
