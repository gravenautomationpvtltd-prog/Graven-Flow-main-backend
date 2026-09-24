import type { Database } from '@/integrations/supabase/types';
import { normalizePhoneStrict } from '@/lib/phone-utils';

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];

const CSV_HEADERS = [
  'company_name',
  'contact_person',
  'phone',
  'alternate_phone',
  'email',
  'address',
  'city',
  'state',
  'pincode',
  'gst_number',
  'is_b2b',
  'notes',
];

export function exportCustomersToCSV(customers: Customer[]): string {
  const headerRow = CSV_HEADERS.join(',');
  
  const dataRows = customers.map((customer) => {
    return CSV_HEADERS.map((header) => {
      const value = customer[header as keyof Customer];
      if (value === null || value === undefined) return '';
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      // Escape quotes and wrap in quotes if contains comma or quotes
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header.trim().toLowerCase()] = values[index]?.trim() || '';
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

export function validateAndTransformCSVRow(row: Record<string, string>): {
  valid: boolean;
  data?: Omit<CustomerInsert, 'id' | 'created_at' | 'updated_at'>;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  const companyName = row['company_name']?.trim();
  const phone = row['phone']?.trim();

  if (!companyName) errors.push('Company name is required');
  if (!phone) errors.push('Phone is required');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Parse is_b2b
  const isB2bValue = row['is_b2b']?.toLowerCase().trim();
  const isB2b = isB2bValue === 'true' || isB2bValue === 'yes' || isB2bValue === '1' || isB2bValue === '';

  return {
    valid: true,
    data: {
      company_name: companyName,
      contact_person: row['contact_person']?.trim() || null,
      phone: phone,
      alternate_phone: row['alternate_phone']?.trim() || null,
      email: row['email']?.trim() || null,
      address: row['address']?.trim() || null,
      city: row['city']?.trim() || null,
      state: row['state']?.trim() || null,
      pincode: row['pincode']?.trim() || null,
      gst_number: row['gst_number']?.trim() || null,
      is_b2b: isB2b,
      notes: row['notes']?.trim() || null,
    },
    errors: [],
  };
}

export function generateSampleCSV(): string {
  const sampleData = [
    CSV_HEADERS.join(','),
    'Acme Corporation,John Doe,9876543210,9876543211,john@acme.com,123 Main St,Mumbai,Maharashtra,400001,27AABCU9603R1ZM,true,Important client',
    'Tech Solutions,Jane Smith,8765432109,,jane@techsol.com,456 Tech Park,Bangalore,Karnataka,560001,,true,',
  ];
  return sampleData.join('\n');
}

/**
 * Google Ads Customer Match export.
 * Columns: Email, Phone, First Name, Last Name, Country, Zip Code
 */
const GOOGLE_ADS_HEADERS = ['Email', 'Phone', 'First Name', 'Last Name', 'Country', 'Zip Code'];

function csvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCustomersForGoogleAds(customers: Customer[]): string {
  const rows: string[] = [];

  for (const customer of customers) {
    if (customer.outreach_opted_out || customer.cst_dnc) continue;

    const email = (customer.email || '').trim().toLowerCase();
    const tenDigit = normalizePhoneStrict(customer.phone || '');
    const phone = tenDigit ? `91${tenDigit}` : '';

    if (!email && !phone) continue;

    const contact = (customer.contact_person || '').trim().replace(/\s+/g, ' ');
    const spaceIndex = contact.indexOf(' ');
    const firstName = spaceIndex === -1 ? contact : contact.slice(0, spaceIndex);
    const lastName = spaceIndex === -1 ? '' : contact.slice(spaceIndex + 1);

    const zip = (customer.pincode || '').replace(/\D/g, '');

    rows.push([email, phone, firstName, lastName, 'IN', zip].map(csvCell).join(','));
  }

  return [GOOGLE_ADS_HEADERS.join(','), ...rows].join('\n');
}
