// ============================================
// CSV export helpers (real files, UTF-8 with BOM so Excel opens
// Philippine characters correctly).
// ============================================

import type { Account, Category, PaymentMethod, Transaction } from '../types';
import { toMajor } from './finance';

export type CsvCell = string | number;

function escapeCell(value: CsvCell): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))];
  return lines.join('\r\n');
}

/** Trigger a browser download of text content as a .csv file. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface TransactionCsvOptions {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  accounts?: Account[];
  currency?: string;
  /** Include a Credit/Debit column pair instead of a signed Amount column. */
  mode?: 'ledger' | 'simple';
}

export function transactionsToCsv(txns: Transaction[], opts: TransactionCsvOptions): string {
  const catName = new Map(opts.categories.map((c) => [c.id, c.name]));
  const pmName = new Map(opts.paymentMethods.map((p) => [p.id, p.name]));
  const accName = new Map((opts.accounts ?? []).map((a) => [a.id, a.name]));
  const accountOf = (t: Transaction): string => accName.get(t.account) ?? t.account;

  if (opts.mode === 'simple') {
    const headers = ['Date', 'Description', 'Type', 'Category', 'Payment Method', 'Account', 'Reference', 'Amount'];
    const rows = txns.map((t) => [
      t.date,
      t.description,
      t.type,
      catName.get(t.category) ?? t.category,
      pmName.get(t.paymentMethod) ?? t.paymentMethod,
      accountOf(t),
      t.reference ?? '',
      toMajor(t.amount).toFixed(2),
    ]);
    return toCsv(headers, rows);
  }

  const headers = ['Date', 'Reference', 'Description', 'Category', 'Payment Method', 'Account', 'Credit', 'Debit'];
  const rows = txns.map((t) => [
    t.date,
    t.reference ?? '',
    t.description,
    catName.get(t.category) ?? t.category,
    pmName.get(t.paymentMethod) ?? t.paymentMethod,
    accountOf(t),
    t.type === 'income' ? toMajor(t.amount).toFixed(2) : '',
    t.type === 'expense' ? toMajor(t.amount).toFixed(2) : '',
  ]);
  return toCsv(headers, rows);
}

export function todayFileStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
