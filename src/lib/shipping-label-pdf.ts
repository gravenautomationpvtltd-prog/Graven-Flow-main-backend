import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import gravenLogo from '@/assets/graven-logo.png';
import { GOOGLE_PLAY_BADGE } from './shipping-label-artwork';
import { GRAVEN_FULL_LABEL_WATERMARK } from './shipping-label-clean-mark';

/**
 * Branded parcel shipping labels — 4 per A4 sheet (2 x 2), with cut guides.
 * Matches the company package-slip artwork exactly: red header bar, logo,
 * contact line, CIN/GST/PAN row, shipping address block, invoice/weight
 * strip and the app-download footer with Google Play badge and QR code.
 */

const BRAND_RED: [number, number, number] = [211, 24, 31]; // #D3181F (sampled from the slip)
const INK: [number, number, number] = [20, 20, 20];
const MUTED: [number, number, number] = [80, 80, 80];

const COMPANY = {
  name: 'Graven Automation PVT LTD',
  phones: '+91 7428828011, 7428828008',
  email: 'info@gravenautomation.com',
  website: 'www.gravenautomation.com',
  address1: '7/25 TOWER F, 2ND FLOOR KIRTI',
  address2: 'NAGAR NEW DELHI 110015',
  cin: 'CIN - U51909UP2022PTC172360',
  gst: 'GST - 07AAKCG1025G1ZX',
  pan: 'PAN - AAKCG1025G',
};

const QR_TARGET = 'https://www.gravenautomation.com';

const createSmilingEmojiImage = (): string | null => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '100px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('😊', canvas.width / 2, canvas.height / 2 + 4);
  return canvas.toDataURL('image/png');
};

export interface ShippingLabelBox {
  weightKg: string;
  dimensionsCm: string;
}

export interface ShippingLabelData {
  companyName: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  invoiceNo: string;
  invoiceValue: string;
  weightKg: string;
  dimensionsCm: string;
  /** Per-box weight/dimensions; index 0 = box 1. Falls back to weightKg/dimensionsCm. */
  boxes?: ShippingLabelBox[];
  dispatchNumber: string;
}

export interface ShippingLabelPdfResult {
  blob: Blob;
  fileName: string;
}

export async function generateShippingLabelsPdf(
  data: ShippingLabelData,
  boxCount = 1,
  options?: { download?: boolean },
): Promise<ShippingLabelPdfResult> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const cellW = pageW / 2; // 105
  const cellH = pageH / 2; // 148.5
  const pad = 4;
  const total = Math.max(1, Math.floor(boxCount));

  let qrDataUrl: string | null = null;
  const smilingEmojiImage = createSmilingEmojiImage();
  try {
    qrDataUrl = await QRCode.toDataURL(QR_TARGET, { margin: 0, width: 400 });
  } catch {
    qrDataUrl = null;
  }

  /** One ultra-light Graven mark behind the complete label. */
  const drawWatermark = (ox: number, oy: number) => {
    try {
      const wmW = 86;
      const wmH = wmW * (61 / 76);
      doc.addImage(
        GRAVEN_FULL_LABEL_WATERMARK,
        'PNG',
        ox + cellW / 2 - wmW / 2,
        oy + cellH / 2 - wmH / 2,
        wmW,
        wmH,
      );
    } catch {
      /* watermark optional */
    }
  };

  const drawSmiley = (x: number, y: number, r: number) => {
    if (!smilingEmojiImage) return;
    try {
      doc.addImage(smilingEmojiImage, 'PNG', x - r, y - r, r * 2, r * 2);
    } catch {
      /* smiley optional */
    }
  };

  const fitSingleLine = (
    text: string,
    maxWidth: number,
    preferredSize: number,
    minimumSize: number,
  ) => {
    let size = preferredSize;
    doc.setFontSize(size);
    while (size > minimumSize && doc.getTextWidth(text) > maxWidth) {
      size -= 0.25;
      doc.setFontSize(size);
    }
    return size;
  };

  const drawHeader = (ox: number, oy: number) => {
    const x = ox + pad;
    const w = cellW - pad * 2;

    // Match the supplied package-slip header: red rail, contact row,
    // logo/name/address row, registration row and two-tone bottom rule.
    doc.setFillColor(...BRAND_RED);
    doc.rect(x + 1, oy + 5.5, w - 2, 3.2, 'F');

    try {
      // Use the complete square brand artwork. Equal dimensions preserve the
      // full circular mark instead of stretching the screenshot-derived crop.
      doc.addImage(gravenLogo, 'PNG', x + 1.5, oy + 9.5, 14, 14);
    } catch {
      /* logo optional */
    }

    // Compact contact row across the top, as in the supplied artwork.
    const contactY = oy + 12.1;
    const contactStart = x + 18.5;
    const contactGap = 1.4;
    const contactWidths = [23.5, 28.5, 23.5];
    const contactItems = [COMPANY.phones, COMPANY.email, COMPANY.website];
    let contactX = contactStart;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    contactItems.forEach((item, index) => {
      const iconX = contactX;
      doc.setDrawColor(205, 230, 231);
      doc.setLineWidth(0.28);
      if (index === 0) {
        doc.roundedRect(iconX, contactY - 2.1, 1.3, 2.1, 0.25, 0.25, 'S');
      } else if (index === 1) {
        doc.rect(iconX, contactY - 1.75, 1.8, 1.35, 'S');
        doc.line(iconX, contactY - 1.75, iconX + 0.9, contactY - 0.9);
        doc.line(iconX + 1.8, contactY - 1.75, iconX + 0.9, contactY - 0.9);
      } else {
        doc.circle(iconX + 0.8, contactY - 1.05, 0.85, 'S');
        doc.line(iconX, contactY - 1.05, iconX + 1.6, contactY - 1.05);
        doc.line(iconX + 0.8, contactY - 1.9, iconX + 0.8, contactY - 0.2);
      }
      const textX = iconX + 2.5;
      const available = contactWidths[index] - 2.5;
      fitSingleLine(item, available, 3.7, 2.8);
      doc.text(item, textX, contactY - 0.35);
      contactX += contactWidths[index] + contactGap;
    });

    // Company name and address have separate, non-overlapping columns.
    const companyX = x + 17;
    const addressW = 25.5;
    const addressX = x + w - 1;
    const companyMaxW = w - 19 - addressW - 1.5;
    doc.setFont('helvetica', 'bold');
    fitSingleLine(COMPANY.name, companyMaxW, 10.2, 7.4);
    doc.setTextColor(...BRAND_RED);
    doc.text(COMPANY.name, companyX, oy + 20.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    fitSingleLine(COMPANY.address1, addressW, 3.8, 2.9);
    doc.text(COMPANY.address1, addressX, oy + 16.7, { align: 'right' });
    fitSingleLine(COMPANY.address2, addressW, 3.8, 2.9);
    doc.text(COMPANY.address2, addressX, oy + 19.7, { align: 'right' });

    // Registration details form the final evenly-spaced row.
    const regY = oy + 27.1;
    const regGap = 1.5;
    const regW = (w - 2 - regGap * 2) / 3;
    const registrations = [COMPANY.cin, COMPANY.gst, COMPANY.pan];
    doc.setFont('helvetica', 'bold');
    registrations.forEach((registration, index) => {
      fitSingleLine(registration, regW, 4.25, 3.1);
      doc.setTextColor(index === 1 ? BRAND_RED[0] : INK[0], index === 1 ? BRAND_RED[1] : INK[1], index === 1 ? BRAND_RED[2] : INK[2]);
      const rx = x + 1 + index * (regW + regGap);
      doc.text(registration, rx + regW / 2, regY, { align: 'center' });
    });

    // The reference uses a pale red-to-orange divider rather than a grey rule.
    const dividerY = oy + 31.4;
    const dividerW = (w - 2) / 2;
    doc.setFillColor(247, 196, 199);
    doc.rect(x + 1, dividerY, dividerW, 0.65, 'F');
    doc.setFillColor(249, 224, 188);
    doc.rect(x + 1 + dividerW, dividerY, dividerW, 0.65, 'F');

    return oy + 33;
  };

  const drawLabel = (ox: number, oy: number, boxNo: number) => {
    const x = ox + pad;
    const w = cellW - pad * 2;

    drawWatermark(ox, oy);
    let y = drawHeader(ox, oy);
    y += 6.5;

    // Shipping Address + box counter
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(...BRAND_RED);
    doc.text('Shipping Address', x + 1, y);
    doc.setTextColor(...INK);
    doc.setFontSize(10);
    doc.text(`${boxNo} of ${total}`, x + w - 1, y, { align: 'right' });
    y += 7;

    // Customer company name is bounded to two lines and a fixed-height zone.
    const company = (data.companyName || '-').toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    let nameSize = fitSingleLine(company, w - 2, 15, 9.5);
    let nameLines = doc.splitTextToSize(company, w - 2).slice(0, 2);
    if (nameLines.length > 1) {
      nameSize = 10.5;
      doc.setFontSize(nameSize);
      nameLines = doc.splitTextToSize(company, w - 2).slice(0, 2);
    }
    doc.text(nameLines, x + 1, y);
    y += nameLines.length * 4.4 + 2.5;

    // Address and contacts occupy a bounded body ending before the fixed strip.
    doc.setFontSize(7.6);
    if (data.address) {
      const cleanAddress = data.address.replace(/\s+/g, ' ').trim();
      const addrLines = doc.splitTextToSize(cleanAddress.toUpperCase(), w - 2).slice(0, 3);
      addrLines.forEach((line: string) => {
        doc.text(line, x + 1, y);
        y += 3.8;
      });
      y += 1;
    }

    doc.setFontSize(7.6);
    if (data.contactPerson) {
      const contact = `CONTACT PERSON : ${data.contactPerson.toUpperCase()}`;
      fitSingleLine(contact, w - 2, 7.6, 5.5);
      doc.text(contact, x + 1, y);
      y += 3.8;
    }
    if (data.contactNumber) {
      const phone = `CONTACT NUMBER : ${data.contactNumber}`;
      fitSingleLine(phone, w - 2, 7.6, 5.5);
      doc.text(phone, x + 1, y);
    }

    // The details strip has a fixed boundary; body text cannot enter it.
    const stripY = oy + 77;
    doc.setDrawColor(225);
    doc.setLineWidth(0.3);
    doc.line(x + 1, stripY - 4, x + w - 1, stripY - 4);

    const box = data.boxes?.[boxNo - 1];
    const boxWeight = box?.weightKg ?? data.weightKg;
    const boxDims = box?.dimensionsCm ?? data.dimensionsCm;

    const columnW = w * 0.45;
    const labelVal = (label: string, value: string, lx: number, ly: number, maxWidth: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...INK);
      doc.setFontSize(6.5);
      doc.text(label, lx, ly);
      const lw = doc.getTextWidth(label);
      doc.setFont('helvetica', 'normal');
      const safeValue = value || '-';
      fitSingleLine(safeValue, Math.max(8, maxWidth - lw - 0.8), 6.5, 4.5);
      doc.text(safeValue, lx + lw + 0.8, ly);
    };
    labelVal('Invoice No: ', data.invoiceNo, x + 1, stripY, columnW);
    labelVal('Invoice Value: ', data.invoiceValue, x + 1, stripY + 4, columnW);
    labelVal('Weight (KG): ', boxWeight, x + w * 0.55, stripY, columnW);
    labelVal('Dimensions (CM): ', boxDims, x + w * 0.55, stripY + 4, columnW);

    doc.line(x + 1, stripY + 6.8, x + w - 1, stripY + 6.8);

    // Footer elements use fixed baselines independent of body content.
    let fy = oy + 91;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(...BRAND_RED);
    doc.text('PROCUREMENT, MADE EASIER.', ox + cellW / 2, fy, { align: 'center' });
    fy += 6;
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text('DOWNLOAD THE APP NOW', ox + cellW / 2, fy, { align: 'center' });

    // Google Play badge (real artwork) + QR
    const badgeY = oy + 103;
    try {
      doc.addImage(GOOGLE_PLAY_BADGE, 'PNG', x + 6, badgeY, 42, 14);
    } catch {
      /* badge optional */
    }
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', x + w - 8 - 23, badgeY - 3.5, 23, 23);
    }

    // Thank you + smiley
    const tyY = oy + cellH - pad - 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    const ty = 'THANK YOU FOR CHOOSING US!';
    const tyW = doc.getTextWidth(ty);
    doc.text(ty, ox + cellW / 2 - 3, tyY, { align: 'center' });
    drawSmiley(ox + cellW / 2 - 3 + tyW / 2 + 4.5, tyY - 1.4, 2.6);
  };

  const drawCutGuides = () => {
    doc.setDrawColor(120);
    doc.setLineWidth(0.25);
    doc.line(pageW / 2, 0, pageW / 2, pageH);
    doc.line(0, pageH / 2, pageW, pageH / 2);
    doc.setDrawColor(0);
  };

  const positions = [
    [0, 0],
    [cellW, 0],
    [0, cellH],
    [cellW, cellH],
  ];

  for (let i = 0; i < total; i++) {
    const slot = i % 4;
    if (i > 0 && slot === 0) doc.addPage();
    if (slot === 0) drawCutGuides();
    drawLabel(positions[slot][0], positions[slot][1], i + 1);
  }

  const fileName = `Shipping-Labels-${data.dispatchNumber}.pdf`;
  if (options?.download !== false) doc.save(fileName);
  return { blob: doc.output('blob') as Blob, fileName };
}

