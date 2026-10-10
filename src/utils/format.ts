// ============================================
// Formatting helpers: currency, dates, percentages.
// Currency formatting always takes integer centavos.
// ============================================

import type { DateFormat } from '../types';
import { toMajor } from './finance';

const CURRENCY_LOCALES: Record<string, string> = {
  PHP: 'en-PH',
  USD: 'en-US',
  EUR: 'de-DE',
  JPY: 'ja-JP',
};

export function formatCurrency(
  cents: number,
  currency = 'PHP',
  options: { compact?: boolean; showSign?: boolean } = {},
): string {
  const locale = CURRENCY_LOCALES[currency] ?? 'en-US';
  const value = Math.abs(toMajor(cents));
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    notation: options.compact ? 'compact' : 'standard',
  }).format(value);

  if (options.showSign) {
    if (cents > 0) return `+${formatted}`;
    if (cents < 0) return `-${formatted}`;
  }
  return cents < 0 ? `-${formatted}` : formatted;
}

/** Symbol-only helper for dense tables: '₱1,234.00'. */
export function formatMoney(cents: number, currency = 'PHP'): string {
  return formatCurrency(cents, currency);
}

export function formatPercent(ratio: number, digits = 0): string {
  const clamped = Number.isFinite(ratio) ? ratio : 0;
  return `${(clamped * 100).toFixed(digits)}%`;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-PH').format(n);
}

/**
 * Format an ISO date (YYYY-MM-DD) according to the user's date setting.
 * Never uses `new Date(iso)` for day-only strings in a way that could shift
 * the day across time zones: the parts are re-arranged textually.
 */
export function formatDate(iso: string | undefined, format: DateFormat = 'YYYY-MM-DD'): string {
  if (!iso) return '—';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  switch (format) {
    case 'MM/DD/YYYY':
      return `${m}/${d}/${y}`;
    case 'DD/MM/YYYY':
      return `${d}/${m}/${y}`;
    case 'YYYY-MM-DD':
    default:
      return `${y}-${m}-${d}`;
  }
}

export function formatDateLong(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export function relativeDueLabel(dueDate: string, todayISOStr: string): string {
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date(`${todayISOStr}T00:00:00`);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff > 1) return `Due in ${diff} days`;
  if (diff === -1) return '1 day overdue';
  return `${Math.abs(diff)} days overdue`;
}
