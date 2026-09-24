/**
 * Builds trial balance, trading account, profit & loss and balance sheet
 * from raw double-entry ledger lines.
 */

export type StatementGroup =
  | 'current_asset'
  | 'fixed_asset'
  | 'current_liability'
  | 'equity'
  | 'sales'
  | 'other_income'
  | 'purchases'
  | 'direct_expense'
  | 'indirect_expense';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface LedgerLine {
  account_id: string;
  entry_date: string;
  debit: number;
  credit: number;
  account?: {
    code: string;
    name: string;
    account_type: string;
    statement_group: string;
    opening_balance?: number | null;
  } | null;
}

export interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  group: StatementGroup;
  debit: number;
  credit: number;
  /** Positive = debit balance, negative = credit balance */
  balance: number;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatINR(n: number): string {
  return `₹${Math.abs(round2(n)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function buildBalances(lines: LedgerLine[]): AccountBalance[] {
  const map = new Map<string, AccountBalance>();
  for (const line of lines) {
    const acc = line.account;
    if (!acc) continue;
    const existing = map.get(line.account_id) ?? {
      accountId: line.account_id,
      code: acc.code,
      name: acc.name,
      type: (acc.account_type as AccountType) ?? 'asset',
      group: (acc.statement_group as StatementGroup) ?? 'current_asset',
      debit: 0,
      credit: 0,
      balance: 0,
    };
    existing.debit += Number(line.debit) || 0;
    existing.credit += Number(line.credit) || 0;
    existing.balance = round2(existing.debit - existing.credit);
    map.set(line.account_id, existing);
  }
  return Array.from(map.values())
    .map((b) => ({ ...b, debit: round2(b.debit), credit: round2(b.credit) }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export interface TrialBalance {
  rows: AccountBalance[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
}

export function buildTrialBalance(lines: LedgerLine[]): TrialBalance {
  const rows = buildBalances(lines);
  const totalDebit = round2(rows.reduce((s, r) => s + Math.max(r.balance, 0), 0));
  const totalCredit = round2(rows.reduce((s, r) => s + Math.max(-r.balance, 0), 0));
  return { rows, totalDebit, totalCredit, difference: round2(totalDebit - totalCredit) };
}

const sumGroup = (rows: AccountBalance[], groups: StatementGroup[], credit = false) =>
  round2(
    rows
      .filter((r) => groups.includes(r.group))
      .reduce((s, r) => s + (credit ? -r.balance : r.balance), 0),
  );

export interface TradingAccount {
  sales: number;
  purchases: number;
  directExpenses: number;
  openingStock: number;
  closingStock: number;
  grossProfit: number;
  rows: AccountBalance[];
}

export function buildTradingAccount(
  lines: LedgerLine[],
  opts: { openingStock?: number; closingStock?: number } = {},
): TradingAccount {
  const rows = buildBalances(lines);
  const sales = sumGroup(rows, ['sales'], true);
  const purchases = sumGroup(rows, ['purchases']);
  const directExpenses = sumGroup(rows, ['direct_expense']);
  const openingStock = opts.openingStock ?? 0;
  const closingStock = opts.closingStock ?? 0;
  const grossProfit = round2(sales + closingStock - (openingStock + purchases + directExpenses));
  return { sales, purchases, directExpenses, openingStock, closingStock, grossProfit, rows };
}

export interface ProfitAndLoss {
  grossProfit: number;
  otherIncome: number;
  indirectExpenses: number;
  netProfit: number;
  incomeRows: AccountBalance[];
  expenseRows: AccountBalance[];
}

export function buildProfitAndLoss(
  lines: LedgerLine[],
  opts: { openingStock?: number; closingStock?: number } = {},
): ProfitAndLoss {
  const rows = buildBalances(lines);
  const trading = buildTradingAccount(lines, opts);
  const otherIncome = sumGroup(rows, ['other_income'], true);
  const indirectExpenses = sumGroup(rows, ['indirect_expense']);
  return {
    grossProfit: trading.grossProfit,
    otherIncome,
    indirectExpenses,
    netProfit: round2(trading.grossProfit + otherIncome - indirectExpenses),
    incomeRows: rows.filter((r) => r.group === 'sales' || r.group === 'other_income'),
    expenseRows: rows.filter((r) => r.group === 'indirect_expense'),
  };
}

export interface BalanceSheet {
  currentAssets: AccountBalance[];
  fixedAssets: AccountBalance[];
  currentLiabilities: AccountBalance[];
  equity: AccountBalance[];
  closingStock: number;
  netProfit: number;
  totalAssets: number;
  totalLiabilities: number;
  difference: number;
}

export function buildBalanceSheet(
  lines: LedgerLine[],
  opts: { closingStock?: number; netProfit?: number } = {},
): BalanceSheet {
  const rows = buildBalances(lines);
  const closingStock = opts.closingStock ?? 0;
  const netProfit = opts.netProfit ?? buildProfitAndLoss(lines, { closingStock }).netProfit;

  const currentAssets = rows.filter((r) => r.group === 'current_asset' && r.balance !== 0);
  const fixedAssets = rows.filter((r) => r.group === 'fixed_asset' && r.balance !== 0);
  const currentLiabilities = rows.filter((r) => r.group === 'current_liability' && r.balance !== 0);
  const equity = rows.filter((r) => r.group === 'equity' && r.balance !== 0);

  const totalAssets = round2(
    currentAssets.reduce((s, r) => s + r.balance, 0) +
      fixedAssets.reduce((s, r) => s + r.balance, 0) +
      closingStock,
  );
  const totalLiabilities = round2(
    currentLiabilities.reduce((s, r) => s - r.balance, 0) +
      equity.reduce((s, r) => s - r.balance, 0) +
      netProfit,
  );

  return {
    currentAssets,
    fixedAssets,
    currentLiabilities,
    equity,
    closingStock,
    netProfit,
    totalAssets,
    totalLiabilities,
    difference: round2(totalAssets - totalLiabilities),
  };
}

export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell === null || cell === undefined ? '' : String(cell);
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(','),
    )
    .join('\n');
}
