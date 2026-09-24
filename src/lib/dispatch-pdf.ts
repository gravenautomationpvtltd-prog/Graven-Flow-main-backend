import jsPDF from 'jspdf';
import type { Dispatch, DispatchItem } from '@/hooks/useDispatches';

interface DispatchWithCustomer extends Dispatch {
  customer?: {
    id: string;
    company_name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  } | null;
}

export function generateDispatchPdf(dispatch: DispatchWithCustomer): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('DELIVERY NOTE', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dispatch No: ${dispatch.dispatch_number}`, margin, yPos);
  doc.text(`Date: ${dispatch.dispatch_date ? new Date(dispatch.dispatch_date).toLocaleDateString('en-IN') : '-'}`, pageWidth - margin, yPos, { align: 'right' });

  // Company Info (From)
  yPos += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FROM:', margin, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.text('Graven Automation', margin, yPos);
  yPos += 5;
  doc.text('Delhi / Lucknow', margin, yPos);

  // Customer Info (Ship To)
  const shipToY = yPos - 11;
  doc.setFont('helvetica', 'bold');
  doc.text('SHIP TO:', pageWidth / 2, shipToY);
  let shipY = shipToY + 6;
  doc.setFont('helvetica', 'normal');
  
  if (dispatch.customer) {
    doc.text(dispatch.customer.company_name, pageWidth / 2, shipY);
    shipY += 5;
    if (dispatch.customer.contact_person) {
      doc.text(`Attn: ${dispatch.customer.contact_person}`, pageWidth / 2, shipY);
      shipY += 5;
    }
    if (dispatch.shipping_address) {
      const addrLines = doc.splitTextToSize(dispatch.shipping_address, 80);
      doc.text(addrLines, pageWidth / 2, shipY);
      shipY += addrLines.length * 5;
    } else {
      const address = [
        dispatch.customer.address,
        dispatch.customer.city,
        dispatch.customer.state,
        dispatch.customer.pincode
      ].filter(Boolean).join(', ');
      if (address) {
        const addrLines = doc.splitTextToSize(address, 80);
        doc.text(addrLines, pageWidth / 2, shipY);
        shipY += addrLines.length * 5;
      }
    }
    if (dispatch.customer.phone) {
      doc.text(`Phone: ${dispatch.customer.phone}`, pageWidth / 2, shipY);
      shipY += 5;
    }
  }

  yPos = Math.max(yPos, shipY) + 10;

  // Courier Info
  if (dispatch.courier_name || dispatch.tracking_number) {
    doc.setFont('helvetica', 'bold');
    doc.text('SHIPPING INFO:', margin, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    if (dispatch.courier_name) {
      doc.text(`Courier: ${dispatch.courier_name}`, margin, yPos);
      yPos += 5;
    }
    if (dispatch.tracking_number) {
      doc.text(`Tracking #: ${dispatch.tracking_number}`, margin, yPos);
      yPos += 5;
    }
    yPos += 5;
  }

  // Quotation Reference
  if (dispatch.quotation) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Reference Quotation: ${dispatch.quotation.quotation_number}`, margin, yPos);
    yPos += 10;
  }

  // Line Items Table
  yPos += 5;
  const tableHeaders = ['#', 'Description', 'Quantity'];
  const colWidths = [15, 130, 30];
  
  // Draw header
  doc.setFillColor(51, 51, 51);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  
  let xPos = margin + 3;
  tableHeaders.forEach((header, i) => {
    doc.text(header, xPos, yPos + 5.5);
    xPos += colWidths[i];
  });

  // Draw rows
  yPos += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  const items = dispatch.items || [];
  items.forEach((item, index) => {
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }

    xPos = margin + 3;
    const rowHeight = 8;
    
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPos, pageWidth - 2 * margin, rowHeight, 'F');
    }

    doc.text(String(index + 1), xPos, yPos + 5.5);
    xPos += colWidths[0];
    
    const desc = item.description.length > 70 ? item.description.substring(0, 70) + '...' : item.description;
    doc.text(desc, xPos, yPos + 5.5);
    xPos += colWidths[1];
    
    doc.text(String(item.quantity), xPos, yPos + 5.5);
    
    yPos += rowHeight;
  });

  // Total Items
  yPos += 10;
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Items: ${items.length} | Total Quantity: ${totalQty}`, margin, yPos);

  // Notes
  if (dispatch.notes) {
    yPos += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Notes:', margin, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    const splitText = doc.splitTextToSize(dispatch.notes, pageWidth - 2 * margin);
    doc.text(splitText, margin, yPos);
  }

  // Signature Areas
  yPos = doc.internal.pageSize.getHeight() - 50;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.line(margin, yPos, margin + 50, yPos);
  doc.text('Prepared By', margin, yPos + 5);
  
  doc.line(pageWidth - margin - 50, yPos, pageWidth - margin, yPos);
  doc.text('Received By', pageWidth - margin - 50, yPos + 5);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('This is a computer generated document.', pageWidth / 2, footerY, { align: 'center' });

  doc.save(`${dispatch.dispatch_number}.pdf`);
}
