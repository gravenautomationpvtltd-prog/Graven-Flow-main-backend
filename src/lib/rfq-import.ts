import * as XLSX from 'xlsx';

export interface ParsedVendorRow {
  srNo: number;
  description: string;
  unitPrice: number | null;
  totalPrice: number | null;
  deliveryDays: number | null;
  remarks: string;
}

export interface ParseResult {
  rows: ParsedVendorRow[];
  errors: string[];
}

export function parseVendorResponse(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        const errors: string[] = [];
        const rows: ParsedVendorRow[] = [];

        jsonData.forEach((row, idx) => {
          // Try to find SR No column (flexible matching)
          const srKey = Object.keys(row).find((k) =>
            k.toLowerCase().replace(/\s/g, '').includes('srno') ||
            k.toLowerCase().replace(/\s/g, '').includes('sr') ||
            k.toLowerCase() === '#'
          );
          const srNo = srKey ? Number(row[srKey]) : idx + 1;

          if (isNaN(srNo) || srNo < 1) return;

          const descKey = Object.keys(row).find((k) =>
            k.toLowerCase().includes('desc') || k.toLowerCase().includes('item')
          );
          const priceKey = Object.keys(row).find((k) =>
            k.toLowerCase().includes('unit') && k.toLowerCase().includes('price')
          );
          const totalKey = Object.keys(row).find((k) =>
            k.toLowerCase().includes('total')
          );
          const deliveryKey = Object.keys(row).find((k) =>
            k.toLowerCase().includes('delivery') || k.toLowerCase().includes('lead')
          );
          const remarksKey = Object.keys(row).find((k) =>
            k.toLowerCase().includes('remark')
          );

          rows.push({
            srNo,
            description: descKey ? String(row[descKey]) : '',
            unitPrice: priceKey && row[priceKey] !== '' ? Number(row[priceKey]) : null,
            totalPrice: totalKey && row[totalKey] !== '' ? Number(row[totalKey]) : null,
            deliveryDays: deliveryKey && row[deliveryKey] !== '' ? Number(row[deliveryKey]) : null,
            remarks: remarksKey ? String(row[remarksKey]) : '',
          });
        });

        if (rows.length === 0) {
          errors.push('No valid rows found in the spreadsheet');
        }

        resolve({ rows, errors });
      } catch (err) {
        reject(new Error('Failed to parse Excel file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
