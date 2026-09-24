import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RFQHeader {
  rfq_number: string;
  title: string;
  deadline_date: string;
  base_currency: string;
  project_name?: string | null;
  client_name?: string | null;
  department?: string | null;
  commercial_terms?: string | null;
  description?: string | null;
}

interface RFQItem {
  description: string;
  quantity: number;
  unit: string | null;
  target_price: number | null;
  specifications: Record<string, string> | null;
  sort_order: number | null;
}

function specsToString(specs: Record<string, string> | null): string {
  if (!specs) return '';
  return Object.entries(specs)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(', ');
}

export function exportRFQToExcel(rfq: RFQHeader, items: RFQItem[]) {
  const wb = XLSX.utils.book_new();

  const headerRows = [
    [`RFQ: ${rfq.rfq_number} — ${rfq.title}`],
    [`Deadline: ${rfq.deadline_date} | Currency: ${rfq.base_currency}`],
    rfq.project_name ? [`Project: ${rfq.project_name}`] : [],
    [],
  ].filter((r) => r.length > 0);

  const dataRows = items.map((item, idx) => [
    idx + 1,
    item.description,
    specsToString(item.specifications),
    item.quantity,
    item.unit || 'Nos',
    '', // Price (blank for vendor)
    '', // Total (blank)
    '', // Delivery Time (blank)
    '', // Remarks
  ]);

  const allRows = [
    ...headerRows,
    ['SR No', 'Item Description', 'Technical Specs', 'Qty', 'Unit', 'Unit Price', 'Total', 'Delivery (Days)', 'Remarks'],
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(allRows);
  ws['!cols'] = [
    { wch: 6 }, { wch: 35 }, { wch: 40 }, { wch: 8 }, { wch: 8 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'RFQ');
  XLSX.writeFile(wb, `${rfq.rfq_number || 'RFQ'}.xlsx`);
}

export function exportRFQToPDF(rfq: RFQHeader, items: RFQItem[]) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('REQUEST FOR QUOTATION', 14, 20);
  doc.setFontSize(10);
  doc.text(`RFQ Number: ${rfq.rfq_number}`, 14, 30);
  doc.text(`Title: ${rfq.title}`, 14, 36);
  doc.text(`Deadline: ${rfq.deadline_date}`, 14, 42);
  doc.text(`Currency: ${rfq.base_currency}`, 14, 48);
  if (rfq.project_name) doc.text(`Project: ${rfq.project_name}`, 14, 54);

  const startY = rfq.project_name ? 62 : 56;

  autoTable(doc, {
    startY,
    head: [['SR', 'Description', 'Specs', 'Qty', 'Unit', 'Target Price']],
    body: items.map((item, idx) => [
      idx + 1,
      item.description,
      specsToString(item.specifications),
      item.quantity,
      item.unit || 'Nos',
      item.target_price != null ? item.target_price.toFixed(2) : '-',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  if (rfq.commercial_terms) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 100;
    doc.setFontSize(10);
    doc.text('Commercial Terms:', 14, finalY + 10);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(rfq.commercial_terms, 180);
    doc.text(lines, 14, finalY + 16);
  }

  doc.save(`${rfq.rfq_number || 'RFQ'}.pdf`);
}

export function exportRFQToCSV(rfq: RFQHeader, items: RFQItem[]) {
  const rows = [
    ['SR No', 'Description', 'Specs', 'Qty', 'Unit'].join(','),
    ...items.map((item, idx) =>
      [
        idx + 1,
        `"${item.description.replace(/"/g, '""')}"`,
        `"${specsToString(item.specifications).replace(/"/g, '""')}"`,
        item.quantity,
        item.unit || 'Nos',
      ].join(',')
    ),
  ].join('\n');

  const blob = new Blob([rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${rfq.rfq_number || 'RFQ'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
