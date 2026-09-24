/**
 * GST filing helpers: outward/inward registers, validation, and
 * GSTR-1 / GSTR-3B JSON in the GSTN offline-utility shape.
 */

export interface OutwardRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerGstin: string | null;
  placeOfSupply: string | null;
  stateCode: string | null;
  isIgst: boolean;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  items: {
    description: string;
    hsn: string | null;
    quantity: number;
    unit: string | null;
    taxable: number;
    taxPercent: number;
    tax: number;
  }[];
}

export interface InwardRow {
  billId: string;
  billNumber: string;
  billDate: string;
  supplierName: string;
  supplierGstin: string | null;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  itcEligible: boolean;
}

export const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};

export const isValidGstin = (g?: string | null) => !!g && /^\d{2}[A-Z0-9]{13}$/.test(g.trim().toUpperCase());

export const gstinStateCode = (g?: string | null) =>
  isValidGstin(g) ? g!.trim().toUpperCase().slice(0, 2) : null;

export const posLabel = (code?: string | null) =>
  code ? `${code}-${STATE_CODES[code] ?? 'Unknown'}` : '';

export interface FilingIssue {
  invoiceNumber: string;
  problem: string;
}

export function validateOutward(rows: OutwardRow[]): FilingIssue[] {
  const issues: FilingIssue[] = [];
  for (const r of rows) {
    if (r.customerGstin && !isValidGstin(r.customerGstin)) {
      issues.push({ invoiceNumber: r.invoiceNumber, problem: 'Customer GSTIN is not a valid 15-character number' });
    }
    if (!r.stateCode) {
      issues.push({ invoiceNumber: r.invoiceNumber, problem: 'Place of supply is missing' });
    }
    const badHsn = r.items.filter((i) => !i.hsn || !/^\d{4,8}$/.test(String(i.hsn).trim()));
    if (badHsn.length) {
      issues.push({ invoiceNumber: r.invoiceNumber, problem: `${badHsn.length} line(s) have a missing or invalid HSN code` });
    }
    if (!r.total) {
      issues.push({ invoiceNumber: r.invoiceNumber, problem: 'Invoice total is zero' });
    }
  }
  return issues;
}

export interface GstrPeriod {
  /** MMYYYY as required by the portal */
  fp: string;
  from: string;
  to: string;
  label: string;
}

export function monthPeriod(year: number, month: number): GstrPeriod {
  const mm = String(month).padStart(2, '0');
  const from = `${year}-${mm}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${mm}-${String(last).padStart(2, '0')}`;
  const label = new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return { fp: `${mm}${year}`, from, to, label };
}

const ddmmyyyy = (iso: string) => {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}-${m}-${y}`;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** GSTR-1 JSON in the offline-utility schema (b2b, b2cs, hsn sections). */
export function buildGstr1Json(gstin: string, period: GstrPeriod, rows: OutwardRow[]) {
  const b2bRows = rows.filter((r) => isValidGstin(r.customerGstin));
  const b2cRows = rows.filter((r) => !isValidGstin(r.customerGstin));

  const b2b = Object.values(
    b2bRows.reduce<Record<string, any>>((acc, r) => {
      const ctin = r.customerGstin!.trim().toUpperCase();
      acc[ctin] ??= { ctin, inv: [] };
      acc[ctin].inv.push({
        inum: r.invoiceNumber,
        idt: ddmmyyyy(r.invoiceDate),
        val: r2(r.total),
        pos: r.stateCode ?? gstinStateCode(r.customerGstin) ?? '',
        rchrg: 'N',
        inv_typ: 'R',
        itms: r.items.map((it, idx) => ({
          num: idx + 1,
          itm_det: {
            rt: it.taxPercent,
            txval: r2(it.taxable),
            ...(r.isIgst
              ? { iamt: r2(it.tax) }
              : { camt: r2(it.tax / 2), samt: r2(it.tax / 2) }),
            csamt: 0,
          },
        })),
      });
      return acc;
    }, {}),
  );

  const b2csMap = b2cRows.reduce<Record<string, any>>((acc, r) => {
    for (const it of r.items) {
      const key = `${r.stateCode}-${it.taxPercent}`;
      acc[key] ??= {
        sply_ty: r.isIgst ? 'INTER' : 'INTRA',
        typ: 'OE',
        pos: r.stateCode ?? '',
        rt: it.taxPercent,
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
      };
      acc[key].txval = r2(acc[key].txval + it.taxable);
      if (r.isIgst) acc[key].iamt = r2(acc[key].iamt + it.tax);
      else {
        acc[key].camt = r2(acc[key].camt + it.tax / 2);
        acc[key].samt = r2(acc[key].samt + it.tax / 2);
      }
    }
    return acc;
  }, {});

  const hsnMap = rows.reduce<Record<string, any>>((acc, r) => {
    r.items.forEach((it) => {
      const hsn = (it.hsn ?? '').trim();
      const key = `${hsn}-${it.taxPercent}`;
      acc[key] ??= {
        num: 0,
        hsn_sc: hsn,
        desc: it.description?.slice(0, 30) ?? '',
        uqc: (it.unit ?? 'NOS').toUpperCase().slice(0, 3),
        qty: 0,
        rt: it.taxPercent,
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
      };
      acc[key].qty = r2(acc[key].qty + it.quantity);
      acc[key].txval = r2(acc[key].txval + it.taxable);
      if (r.isIgst) acc[key].iamt = r2(acc[key].iamt + it.tax);
      else {
        acc[key].camt = r2(acc[key].camt + it.tax / 2);
        acc[key].samt = r2(acc[key].samt + it.tax / 2);
      }
    });
    return acc;
  }, {});

  const hsnData = Object.values(hsnMap).map((h: any, i) => ({ ...h, num: i + 1 }));

  return {
    gstin,
    fp: period.fp,
    version: 'GST3.2',
    hash: 'hash',
    b2b,
    b2cs: Object.values(b2csMap),
    hsn: { data: hsnData },
  };
}

/** GSTR-3B JSON in the offline-utility schema. */
export function buildGstr3bJson(
  gstin: string,
  period: GstrPeriod,
  outward: OutwardRow[],
  inward: InwardRow[],
) {
  const sum = (xs: number[]) => r2(xs.reduce((s, x) => s + x, 0));
  const oTax = {
    txval: sum(outward.map((r) => r.taxable)),
    iamt: sum(outward.map((r) => r.igst)),
    camt: sum(outward.map((r) => r.cgst)),
    samt: sum(outward.map((r) => r.sgst)),
    csamt: 0,
  };
  const itc = inward.filter((r) => r.itcEligible);
  return {
    gstin,
    ret_period: period.fp,
    sup_details: {
      osup_det: oTax,
      osup_zero: { txval: 0, iamt: 0, csamt: 0 },
      osup_nil_exmp: { txval: 0 },
      isup_rev: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 },
      osup_nongst: { txval: 0 },
    },
    inter_sup: {
      unreg_details: outward
        .filter((r) => !isValidGstin(r.customerGstin) && r.isIgst)
        .map((r) => ({ pos: r.stateCode ?? '', txval: r2(r.taxable), iamt: r2(r.igst) })),
    },
    itc_elg: {
      itc_avl: [
        {
          ty: 'IMPG',
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        },
        {
          ty: 'OTH',
          iamt: sum(itc.map((r) => r.igst)),
          camt: sum(itc.map((r) => r.cgst)),
          samt: sum(itc.map((r) => r.sgst)),
          csamt: 0,
        },
      ],
      itc_net: {
        iamt: sum(itc.map((r) => r.igst)),
        camt: sum(itc.map((r) => r.cgst)),
        samt: sum(itc.map((r) => r.sgst)),
        csamt: 0,
      },
    },
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
