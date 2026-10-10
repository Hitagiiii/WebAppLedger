// ============================================
// Centralized financial business logic.
//
// ACCOUNTING MODEL (documented in README):
//  - The app tracks MULTIPLE accounts (cash wallets, e-wallets, banks).
//  - Each Account has an `openingBalance` (before its earliest transaction).
//  - income  => credit  (increases that account's balance)
//  - expense => debit   (decreases that account's balance)
//  - Account balance = openingBalance + sum(income) - sum(expense)
//    (+ future transfer effects), computed in CHRONOLOGICAL order.
//  - Balances are always DERIVED — never stored or independently editable —
//    so editing/deleting a transaction recalculates every affected figure.
//  - The aggregate (all accounts) balance = sum of per-account balances;
//    each peso is counted exactly once because transfers (coming later)
//    will credit one account and debit another, never both the same way.
//  - All arithmetic is done on integer centavos to avoid float drift.
//  - Deterministic ordering: date asc, then createdAt asc, then id asc.
//
// Every UI component must call these functions instead of reimplementing
// totals, so the dashboard, ledger and reports can never disagree.
// ============================================

import type {
  Account,
  AccountBalance,
  BudgetStatus,
  CategorySlice,
  DateRange,
  DebtStatus,
  GoalStatus,
  MonthPoint,
  RunningBalanceRow,
  Transaction,
  TransactionFilters,
  Totals,
} from '../types';

// ---------- Money helpers ----------

/** Convert a major-unit amount (pesos) to integer centavos, rounding half-up. */
export function toCents(major: number): number {
  return Math.round(major * 100);
}

/** Convert integer centavos back to a major-unit number (display only). */
export function toMajor(cents: number): number {
  return cents / 100;
}

export function addCents(...values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}

/** Signed contribution of a transaction to the balance. */
export function signedAmount(t: Pick<Transaction, 'type' | 'amount'>): number {
  return t.type === 'income' ? t.amount : -t.amount;
}

// ---------- Date helpers (ISO YYYY-MM-DD strings) ----------

export function isDateStr(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function yearKey(isoDate: string): string {
  return isoDate.slice(0, 4);
}

/** Inclusive date range for a month key like '2026-07'. */
export function monthRange(key: string): DateRange {
  const [y, m] = key.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${key}-01`, to: `${key}-${String(lastDay).padStart(2, '0')}` };
}

/** Inclusive date range for a year key like '2026'. */
export function yearRange(key: string): DateRange {
  return { from: `${key}-01-01`, to: `${key}-12-31` };
}

export function inRange(date: string, range: DateRange | null): boolean {
  if (!range) return true;
  return date >= range.from && date <= range.to;
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO);
  const b = Date.parse(toISO);
  return Math.round((b - a) / 86_400_000);
}

export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

// ---------- Deterministic ordering ----------

/**
 * Chronological order with a deterministic tie-breaker.
 * Used for running-balance math AND for stable list rendering.
 */
export function compareChronological(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function sortChronological(txns: Transaction[]): Transaction[] {
  return [...txns].sort(compareChronological);
}

// ---------- Filtering / searching ----------

export function matchesFilters(t: Transaction, filters: TransactionFilters): boolean {
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    if (q) {
      const haystack = `${t.description} ${t.reference ?? ''} ${t.notes ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
  }
  if (filters.from && t.date < filters.from) return false;
  if (filters.to && t.date > filters.to) return false;
  if (filters.type && filters.type !== 'all' && t.type !== filters.type) return false;
  if (filters.category && filters.category !== 'all' && t.category !== filters.category) return false;
  if (filters.paymentMethod && filters.paymentMethod !== 'all' && t.paymentMethod !== filters.paymentMethod) {
    return false;
  }
  if (filters.account && filters.account !== 'all' && t.account !== filters.account) {
    return false;
  }
  return true;
}

export function filterTransactions(
  txns: Transaction[],
  filters: TransactionFilters = {},
  range: DateRange | null = null,
): Transaction[] {
  return txns.filter((t) => inRange(t.date, range) && matchesFilters(t, filters));
}

/**
 * Deterministic list sort used by tables.
 * 'amount' sorts by signed value so income/expense ordering is intuitive.
 */
export function sortTransactions(
  txns: Transaction[],
  key: 'date' | 'amount' = 'date',
  dir: 'asc' | 'desc' = 'desc',
): Transaction[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...txns].sort((a, b) => {
    if (key === 'amount') {
      const diff = signedAmount(a) - signedAmount(b);
      if (diff !== 0) return diff * sign;
    }
    const chrono = compareChronological(a, b);
    return dir === 'asc' ? chrono : -chrono;
  });
}

// ---------- Totals ----------

export function computeTotals(txns: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense, count: txns.length };
}

/** Current balance: opening balance + all-time income - all-time expense. */
export function computeBalance(txns: Transaction[], openingBalance: number): number {
  return openingBalance + computeTotals(txns).net;
}

// ---------- Accounts ----------

/** Sum of opening balances across accounts (the aggregate ledger start). */
export function sumOpeningBalances(accounts: Pick<Account, 'openingBalance'>[]): number {
  return accounts.reduce((sum, a) => sum + a.openingBalance, 0);
}

/** Derived current balance of ONE account from its own transactions. */
export function accountBalance(
  account: Pick<Account, 'openingBalance'>,
  txns: Transaction[],
): number {
  return computeBalance(txns, account.openingBalance);
}

/**
 * Derived balances (plus per-account totals) for every account in one pass.
 * Archived accounts are included so their historical money stays in the
 * aggregate total — it is never double-counted because each transaction
 * belongs to exactly one account.
 */
export function accountBalances(accounts: Account[], txns: Transaction[]): AccountBalance[] {
  const byAccount = new Map<string, Transaction[]>();
  for (const t of txns) {
    const list = byAccount.get(t.account);
    if (list) list.push(t);
    else byAccount.set(t.account, [t]);
  }
  return accounts.map((account) => {
    const own = byAccount.get(account.id) ?? [];
    const totals = computeTotals(own);
    return {
      account,
      balance: account.openingBalance + totals.net,
      income: totals.income,
      expense: totals.expense,
      count: totals.count,
    };
  });
}

/** Aggregate balance across all accounts (active + archived). */
export function totalBalance(accounts: Account[], txns: Transaction[]): number {
  return accountBalances(accounts, txns).reduce((sum, a) => sum + a.balance, 0);
}

// ---------- Running balance ----------

/**
 * Running balance per transaction in chronological order.
 * `displayReverse` returns newest-first rows (typical ledger view) while each
 * row's balance still reflects the chronological accounting position.
 */
export function computeRunningBalances(
  txns: Transaction[],
  openingBalance: number,
  displayReverse = true,
): RunningBalanceRow[] {
  const ordered = sortChronological(txns);
  let balance = openingBalance;
  const rows: RunningBalanceRow[] = ordered.map((transaction) => {
    balance += signedAmount(transaction);
    return { transaction, balance };
  });
  return displayReverse ? rows.reverse() : rows;
}

// ---------- Periods ----------

export function currentMonthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function previousMonthKey(key: string = currentMonthKey()): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentYearKey(d: Date = new Date()): string {
  return String(d.getFullYear());
}

export function rangeForPeriod(
  key: 'thisMonth' | 'lastMonth' | 'thisYear' | 'all' | 'custom',
  custom?: { from?: string; to?: string },
  now: Date = new Date(),
): DateRange | null {
  switch (key) {
    case 'thisMonth':
      return monthRange(currentMonthKey(now));
    case 'lastMonth':
      return monthRange(previousMonthKey(currentMonthKey(now)));
    case 'thisYear':
      return yearRange(currentYearKey(now));
    case 'custom':
      if (custom?.from && custom?.to && custom.from <= custom.to) {
        return { from: custom.from, to: custom.to };
      }
      return null;
    case 'all':
    default:
      return null;
  }
}

// ---------- Series & breakdowns ----------

/** Monthly income/expense series for the last `months` months (inclusive). */
export function monthlySeries(txns: Transaction[], months: number, now: Date = new Date()): MonthPoint[] {
  const points: MonthPoint[] = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    points.push({
      key,
      label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      income: 0,
      expense: 0,
      net: 0,
    });
  }
  const index = new Map(points.map((p) => [p.key, p]));
  for (const t of txns) {
    const p = index.get(monthKey(t.date));
    if (!p) continue;
    if (t.type === 'income') p.income += t.amount;
    else p.expense += t.amount;
  }
  for (const p of points) p.net = p.income - p.expense;
  return points;
}

/** Expense (or income) totals grouped by category, largest first. */
export function categoryBreakdown(
  txns: Transaction[],
  type: 'income' | 'expense',
  categories: { id: string; name: string; color: string }[],
  range: DateRange | null = null,
): CategorySlice[] {
  const totals = new Map<string, number>();
  let grand = 0;
  for (const t of txns) {
    if (t.type !== type) continue;
    if (!inRange(t.date, range)) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
    grand += t.amount;
  }
  const slices: CategorySlice[] = [];
  for (const [categoryId, amount] of totals) {
    const meta = categories.find((c) => c.id === categoryId);
    slices.push({
      categoryId,
      name: meta?.name ?? 'Uncategorized',
      color: meta?.color ?? '#94A3B8',
      amount,
      percent: grand > 0 ? (amount / grand) * 100 : 0,
    });
  }
  return slices.sort((a, b) => b.amount - a.amount);
}

// ---------- Budgets ----------

/**
 * Utilization of a budget inside its own period.
 * Only expense transactions of the budget's category in [from, to] count.
 * Zero/negative limits are treated as 0 spent-capacity (ratio 0) to stay safe.
 */
export function budgetStatus(
  budget: { id: string; categoryId: string; period: 'monthly' | 'yearly'; periodKey: string; limit: number },
  txns: Transaction[],
  categoryMeta?: { name: string; color: string },
): BudgetStatus {
  const range = budget.period === 'monthly' ? monthRange(budget.periodKey) : yearRange(budget.periodKey);
  let spent = 0;
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    if (t.category !== budget.categoryId) continue;
    if (!inRange(t.date, range)) continue;
    spent += t.amount;
  }
  const limit = Math.max(budget.limit, 0);
  const remaining = limit - spent;
  const ratio = limit > 0 ? spent / limit : 0;
  return {
    budget,
    categoryName: categoryMeta?.name ?? 'Unknown category',
    color: categoryMeta?.color ?? '#94A3B8',
    spent,
    remaining,
    ratio,
    exceeded: limit > 0 && spent > limit,
  };
}

// ---------- Savings goals ----------

export function goalStatus(goal: import('../types').SavingsGoal, now: Date = new Date()): GoalStatus {
  const target = Math.max(goal.target, 0);
  const saved = Math.max(goal.saved, 0);
  const remaining = Math.max(target - saved, 0);
  const ratio = target > 0 ? saved / target : 0;
  let status: GoalStatus['status'] = 'active';
  if (saved >= target && target > 0) status = 'completed';
  else if (goal.deadline) {
    const diff = daysBetween(toISODate(now), goal.deadline);
    if (diff < 0) status = 'overdue';
    else if (diff <= 7) status = 'dueSoon';
  }
  return { goal, remaining, ratio, status };
}

// ---------- Debts ----------

export function debtPaid(debt: { payments: { amount: number }[] }): number {
  return debt.payments.reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Remaining balance is always derived from payments — never from an
 * independently editable "remaining" field — so overpayments are impossible
 * to represent silently (payment recording is capped in the UI layer).
 */
export function debtStatus(debt: import('../types').Debt, now: Date = new Date()): DebtStatus {
  const paid = debtPaid(debt);
  const remaining = Math.max(debt.originalAmount - paid, 0);
  let status: DebtStatus['status'] = 'open';
  if (remaining <= 0) status = 'settled';
  else if (debt.dueDate) {
    const diff = daysBetween(toISODate(now), debt.dueDate);
    if (diff < 0) status = 'overdue';
    else if (diff <= 7) status = 'dueSoon';
  }
  return { debt, paid, remaining, status };
}

// ---------- Savings rate ----------

/** Savings rate of a period: (income - expense) / income, or null without income. */
export function savingsRate(totals: Totals): number | null {
  if (totals.income <= 0) return null;
  return (totals.income - totals.expense) / totals.income;
}
