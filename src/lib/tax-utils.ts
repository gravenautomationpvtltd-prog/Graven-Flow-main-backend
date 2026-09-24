export interface TaxComponent {
  name: string;
  key: string;
  defaultRate: number;
}

export interface TaxSystem {
  type: string;
  label: string;
  taxIdLabel: string;
  taxIdPlaceholder: string;
  bankCodeLabel: string;
  bankCodePlaceholder: string;
  components: TaxComponent[];
  rates: number[];
}

const TAX_SYSTEMS: Record<string, TaxSystem> = {
  IN: {
    type: 'GST',
    label: 'Goods & Services Tax',
    taxIdLabel: 'GST Number',
    taxIdPlaceholder: '22AAAAA0000A1Z5',
    bankCodeLabel: 'IFSC Code',
    bankCodePlaceholder: 'SBIN0001234',
    components: [
      { name: 'CGST', key: 'cgst', defaultRate: 9 },
      { name: 'SGST', key: 'sgst', defaultRate: 9 },
      { name: 'IGST', key: 'igst', defaultRate: 18 },
    ],
    rates: [0, 5, 12, 18, 28],
  },
  US: {
    type: 'Sales Tax',
    label: 'Sales Tax',
    taxIdLabel: 'EIN',
    taxIdPlaceholder: '12-3456789',
    bankCodeLabel: 'Routing Number',
    bankCodePlaceholder: '021000021',
    components: [
      { name: 'State Tax', key: 'state_tax', defaultRate: 6 },
      { name: 'Local Tax', key: 'local_tax', defaultRate: 2 },
    ],
    rates: [0, 4, 5, 6, 7, 8, 9, 10],
  },
  GB: {
    type: 'VAT',
    label: 'Value Added Tax',
    taxIdLabel: 'VAT Number',
    taxIdPlaceholder: 'GB123456789',
    bankCodeLabel: 'Sort Code',
    bankCodePlaceholder: '12-34-56',
    components: [
      { name: 'VAT', key: 'vat', defaultRate: 20 },
    ],
    rates: [0, 5, 20],
  },
  DE: {
    type: 'VAT',
    label: 'Mehrwertsteuer (VAT)',
    taxIdLabel: 'VAT Number',
    taxIdPlaceholder: 'DE123456789',
    bankCodeLabel: 'BIC/SWIFT',
    bankCodePlaceholder: 'COBADEFFXXX',
    components: [
      { name: 'MwSt', key: 'vat', defaultRate: 19 },
    ],
    rates: [0, 7, 19],
  },
  FR: {
    type: 'VAT',
    label: 'TVA',
    taxIdLabel: 'VAT Number',
    taxIdPlaceholder: 'FR12345678901',
    bankCodeLabel: 'BIC/SWIFT',
    bankCodePlaceholder: 'BNPAFRPPXXX',
    components: [
      { name: 'TVA', key: 'vat', defaultRate: 20 },
    ],
    rates: [0, 2.1, 5.5, 10, 20],
  },
  AE: {
    type: 'VAT',
    label: 'VAT',
    taxIdLabel: 'TRN',
    taxIdPlaceholder: '100000000000003',
    bankCodeLabel: 'SWIFT Code',
    bankCodePlaceholder: 'EABORAEAXXX',
    components: [
      { name: 'VAT', key: 'vat', defaultRate: 5 },
    ],
    rates: [0, 5],
  },
  SA: {
    type: 'VAT',
    label: 'VAT',
    taxIdLabel: 'VAT Number',
    taxIdPlaceholder: '300000000000003',
    bankCodeLabel: 'SWIFT Code',
    bankCodePlaceholder: 'RJHISARIXES',
    components: [
      { name: 'VAT', key: 'vat', defaultRate: 15 },
    ],
    rates: [0, 15],
  },
  CN: {
    type: 'VAT',
    label: 'VAT (增值税)',
    taxIdLabel: 'Tax ID',
    taxIdPlaceholder: '91110000MA0XXXXX',
    bankCodeLabel: 'SWIFT Code',
    bankCodePlaceholder: 'BKCHCNBJXXX',
    components: [
      { name: 'VAT', key: 'vat', defaultRate: 13 },
    ],
    rates: [0, 3, 6, 9, 13],
  },
  JP: {
    type: 'Consumption Tax',
    label: 'Consumption Tax (消費税)',
    taxIdLabel: 'Corporate Number',
    taxIdPlaceholder: 'T1234567890123',
    bankCodeLabel: 'SWIFT Code',
    bankCodePlaceholder: 'BOTKJPJTXXX',
    components: [
      { name: 'Consumption Tax', key: 'consumption_tax', defaultRate: 10 },
    ],
    rates: [0, 8, 10],
  },
  AU: {
    type: 'GST',
    label: 'Goods & Services Tax',
    taxIdLabel: 'ABN',
    taxIdPlaceholder: '12 345 678 901',
    bankCodeLabel: 'BSB Number',
    bankCodePlaceholder: '062-000',
    components: [
      { name: 'GST', key: 'gst', defaultRate: 10 },
    ],
    rates: [0, 10],
  },
  CA: {
    type: 'GST/HST',
    label: 'GST/HST',
    taxIdLabel: 'BN',
    taxIdPlaceholder: '123456789RT0001',
    bankCodeLabel: 'Transit Number',
    bankCodePlaceholder: '12345-001',
    components: [
      { name: 'GST', key: 'gst', defaultRate: 5 },
      { name: 'PST', key: 'pst', defaultRate: 7 },
      { name: 'HST', key: 'hst', defaultRate: 13 },
    ],
    rates: [0, 5, 7, 12, 13, 15],
  },
  BR: {
    type: 'Mixed',
    label: 'ICMS/IPI/ISS',
    taxIdLabel: 'CNPJ',
    taxIdPlaceholder: '12.345.678/0001-00',
    bankCodeLabel: 'SWIFT Code',
    bankCodePlaceholder: 'BRAABORJXXX',
    components: [
      { name: 'ICMS', key: 'icms', defaultRate: 18 },
      { name: 'IPI', key: 'ipi', defaultRate: 10 },
    ],
    rates: [0, 5, 10, 12, 17, 18, 25],
  },
  RU: {
    type: 'VAT',
    label: 'НДС (VAT)',
    taxIdLabel: 'INN',
    taxIdPlaceholder: '1234567890',
    bankCodeLabel: 'BIK',
    bankCodePlaceholder: '044525225',
    components: [
      { name: 'NDS', key: 'vat', defaultRate: 20 },
    ],
    rates: [0, 10, 20],
  },
  SG: {
    type: 'GST',
    label: 'GST',
    taxIdLabel: 'GST Reg No',
    taxIdPlaceholder: 'M12345678X',
    bankCodeLabel: 'SWIFT Code',
    bankCodePlaceholder: 'DBSSSGSGXXX',
    components: [
      { name: 'GST', key: 'gst', defaultRate: 9 },
    ],
    rates: [0, 9],
  },
  KR: {
    type: 'VAT',
    label: 'VAT (부가가치세)',
    taxIdLabel: 'BRN',
    taxIdPlaceholder: '123-45-67890',
    bankCodeLabel: 'SWIFT Code',
    bankCodePlaceholder: 'KOABORKSXXX',
    components: [
      { name: 'VAT', key: 'vat', defaultRate: 10 },
    ],
    rates: [0, 10],
  },
  MX: {
    type: 'IVA',
    label: 'IVA',
    taxIdLabel: 'RFC',
    taxIdPlaceholder: 'XAXX010101000',
    bankCodeLabel: 'CLABE',
    bankCodePlaceholder: '012345678901234567',
    components: [
      { name: 'IVA', key: 'iva', defaultRate: 16 },
    ],
    rates: [0, 8, 16],
  },
  ZA: {
    type: 'VAT',
    label: 'VAT',
    taxIdLabel: 'VAT Number',
    taxIdPlaceholder: '4123456789',
    bankCodeLabel: 'Branch Code',
    bankCodePlaceholder: '250655',
    components: [
      { name: 'VAT', key: 'vat', defaultRate: 15 },
    ],
    rates: [0, 15],
  },
};

// Default fallback for countries without specific tax config
const DEFAULT_TAX_SYSTEM: TaxSystem = {
  type: 'VAT',
  label: 'VAT',
  taxIdLabel: 'Tax ID',
  taxIdPlaceholder: 'Enter tax ID',
  bankCodeLabel: 'SWIFT Code',
  bankCodePlaceholder: 'Enter SWIFT code',
  components: [
    { name: 'VAT', key: 'vat', defaultRate: 0 },
  ],
  rates: [0, 5, 10, 15, 20],
};

export function getTaxSystem(countryCode: string): TaxSystem {
  return TAX_SYSTEMS[countryCode?.toUpperCase()] || DEFAULT_TAX_SYSTEM;
}

export function getTaxIdLabel(countryCode: string): string {
  return getTaxSystem(countryCode).taxIdLabel;
}

export function getTaxRates(countryCode: string): number[] {
  return getTaxSystem(countryCode).rates;
}

export function getBankCodeLabel(countryCode: string): string {
  return getTaxSystem(countryCode).bankCodeLabel;
}

export function getBankCodePlaceholder(countryCode: string): string {
  return getTaxSystem(countryCode).bankCodePlaceholder;
}

export function getAllTaxSystems(): Record<string, TaxSystem> {
  return TAX_SYSTEMS;
}
