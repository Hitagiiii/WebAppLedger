// ============================================
// Financial health metrics, actionable insights and recommendations.
//
// Every value produced here is derived strictly from persisted data:
// transactions, budgets, goals, debts and the accounts' opening balances.
// Nothing is fabricated, no future balance is predicted, and no external
// "financial health score" is invented. When data is missing the functions
// return null / an empty list and the UI shows an insufficient-data state.
//
// All monetary inputs are integer centavos. Ratios (savings rate, expense
// ratio, month-over-month percent) are plain IEEE doubles used ONLY for
// display — no centavo ever passes through float accumulation.
// ============================================

import type {
  Budget,
  Category,
  CategorySlice,
  Database,
  DateRange,
  Totals,
  Transaction,
} from '../types';
import {
  budgetStatus,
  categoryBreakdown,
  computeBalance,
  computeTotals,
  currentMonthKey,
  daysBetween,
  filterTransactions,
  monthKey,
  monthRange,
  previousMonthKey,
  savingsRate,
  sumOpeningBalances,
  toISODate,
} from './finance';
import { formatCurrency, formatDate, formatPercent } from './format';

// ---------- Tunables (all thresholds are explicit and documented) ----------

/** A category change only counts as an insight at ≥10% AND ≥₱50 absolute. */
const MIN_CATEGORY_CHANGE_RATIO = 0.1;
const MIN_CATEGORY_CHANGE_CENTS = 5_000;

/** A "review this" recommendation requires ≥20% AND ≥₱500 absolute growth. */
const SPIKE_RATIO = 0.2;
const SPIKE_CENTS = 50_000;

/** Budgets at ≥85% of their limit are surfaced (matching the app's badges). */
const BUDGET_NEAR_RATIO = 0.85;

/** Emergency-fund coverage averages this many recent calendar months. */
const COVERAGE_SAMPLE_MONTHS = 3;

const OTHER_COLOR = '#94A3B8';

// ---------- Shared types ----------

export type InsightTone = 'info' | 'success' | 'warning' | 'error';

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  /** Includes the actual amounts / comparison period backing the claim. */
  detail: string;
}

export interface Recommendation {
  id: string;
  title: string;
  /** Plain-language explanation of exactly why this appeared. */
  why: string;
}

export interface PeriodHealth {
  /** (income − expense) ÷ income, or null when income is 0. */
  savingsRate: number | null;
  /** expense ÷ income, or null when income is 0. */
  expenseToIncome: number | null;
}

export interface MonthOverMonth {
  currentKey: string;
  previousKey: string;
  current: number;
  previous: number;
  /** current − previous (centavos). */
  diff: number;
  /** diff ÷ previous, or null when the previous month has no recorded spending. */
  percent: number | null;
}

export interface CategoryChange {
  categoryId: string;
  name: string;
  color: string;
  current: number;
  previous: number;
  diff: number;
  /** null when the previous month had no spending for this category. */
  percent: number | null;
}

export interface BudgetAlert {
  status: ReturnType<typeof budgetStatus>;
  level: 'near' | 'over';
}

export interface CoverageEstimate {
  /** Current balance: opening balance + all-time net. */
  balance: number;
  /** Average monthly expenses across sampled months (rounded centavos). */
  averageMonthlyExpense: number;
  /** How many recent months contained recorded activity. */
  monthsSampled: number;
  /** balance ÷ average, floored at 0. One decimal shown by the UI. */
  months: number;
}

export interface TimeSeriesPoint {
  key: string;
  label: string;
  values: Record<string, number>;
}

export interface TimeSeriesMeta {
  id: string;
  name: string;
  color: string;
}

// ---------- Period metrics ----------

export function periodHealth(totals: Totals): PeriodHealth {
  const rate = savingsRate(totals);
  return {
    savingsRate: rate,
    expenseToIncome: totals.income > 0 ? totals.expense / totals.income : null,
  };
}

// ---------- Month-over-month ----------

export function monthOverMonthExpense(txns: Transaction[], now: Date = new Date()): MonthOverMonth {
  const currentKey = currentMonthKey(now);
  const previousKey = previousMonthKey(currentKey);
  let current = 0;
  let previous = 0;
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    const k = monthKey(t.date);
    if (k === currentKey) current += t.amount;
    else if (k === previousKey) previous += t.amount;
  }
  const diff = current - previous;
  return {
    currentKey,
    previousKey,
    current,
    previous,
    diff,
    percent: previous > 0 ? diff / previous : null,
  };
}

/**
 * Significant month-over-month category changes (both months must have
 * spending, ≥10% and ≥₱50 absolute), largest movement first.
 */
export function categoryMonthChanges(db: Database, now: Date = new Date()): CategoryChange[] {
  const currentKey = currentMonthKey(now);
  const previousKey = previousMonthKey(currentKey);
  const cur = new Map<string, number>();
  const prev = new Map<string, number>();
  for (const t of db.transactions) {
    if (t.type !== 'expense') continue;
    const k = monthKey(t.date);
    if (k === currentKey) cur.set(t.category, (cur.get(t.category) ?? 0) + t.amount);
    else if (k === previousKey) prev.set(t.category, (prev.get(t.category) ?? 0) + t.amount);
  }

  const meta = new Map(db.categories.map((c) => [c.id, c]));
  const ids = new Set([...cur.keys(), ...prev.keys()]);
  const changes: CategoryChange[] = [];
  for (const id of ids) {
    const current = cur.get(id) ?? 0;
    const previous = prev.get(id) ?? 0;
    if (previous <= 0 || current <= 0) continue; // not comparable
    const diff = current - previous;
    const percent = diff / previous;
    if (Math.abs(percent) < MIN_CATEGORY_CHANGE_RATIO) continue;
    if (Math.abs(diff) < MIN_CATEGORY_CHANGE_CENTS) continue;
    changes.push({
      categoryId: id,
      name: meta.get(id)?.name ?? 'Uncategorized',
      color: meta.get(id)?.color ?? OTHER_COLOR,
      current,
      previous,
      diff,
      percent,
    });
  }
  return changes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

// ---------- Largest category ----------

export function largestExpenseCategory(
  txns: Transaction[],
  categories: Category[],
  range: DateRange | null,
): CategorySlice | null {
  const slices = categoryBreakdown(txns, 'expense', categories, range);
  return slices.length > 0 ? slices[0] : null;
}

// ---------- Budget health ----------

export function budgetAlerts(budgets: Budget[], txns: Transaction[], categories: Category[]): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];
  for (const b of budgets) {
    const status = budgetStatus(b, txns, categories.find((c) => c.id === b.categoryId));
    if (status.exceeded) alerts.push({ status, level: 'over' });
    else if (status.ratio >= BUDGET_NEAR_RATIO) alerts.push({ status, level: 'near' });
  }
  return alerts.sort((a, b) => b.status.ratio - a.status.ratio);
}

// ---------- Emergency fund coverage (explicitly an estimate) ----------

/**
 * Coverage in months = current balance ÷ average monthly expenses over the
 * last `sampleMonths` calendar months that contain recorded activity.
 *
 * Assumptions (surfaced in the UI):
 *  - months with no recorded transactions at all are excluded from the average;
 *  - a non-positive balance yields 0 months;
 *  - no expense data at all yields null (insufficient data).
 * This is arithmetic on recorded history — not a prediction of future
 * balances or spending.
 */
export function emergencyFundCoverage(
  txns: Transaction[],
  openingBalance: number,
  now: Date = new Date(),
  sampleMonths = COVERAGE_SAMPLE_MONTHS,
): CoverageEstimate | null {
  const keys: string[] = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < sampleMonths; i++) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const keySet = new Set(keys);

  const expenseByKey = new Map<string, number>();
  const activeKeys = new Set<string>();
  for (const t of txns) {
    const k = monthKey(t.date);
    if (!keySet.has(k)) continue;
    activeKeys.add(k);
    if (t.type === 'expense') expenseByKey.set(k, (expenseByKey.get(k) ?? 0) + t.amount);
  }
  if (activeKeys.size === 0) return null;

  let expenseSum = 0;
  for (const k of activeKeys) expenseSum += expenseByKey.get(k) ?? 0;
  const average = Math.round(expenseSum / activeKeys.size);
  if (average <= 0) return null; // income-only months: nothing to average

  const balance = computeBalance(txns, openingBalance);
  const months = balance > 0 ? balance / average : 0;
  return {
    balance,
    averageMonthlyExpense: average,
    monthsSampled: activeKeys.size,
    months,
  };
}

// ---------- Spending by category over time (chart data) ----------

function shortMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/**
 * Expense totals per month, stacked by the top `topN` categories in the
 * range; everything else is grouped into one "Other" series. Income is
 * intentionally excluded — this chart answers "where does spending go?".
 */
export function categoryTimeSeries(
  txns: Transaction[],
  categories: Category[],
  range: DateRange | null,
  topN = 5,
): { points: TimeSeriesPoint[]; series: TimeSeriesMeta[] } {
  const inRange = filterTransactions(txns, {}, range);
  if (inRange.length === 0) return { points: [], series: [] };

  let monthKeys = [...new Set(inRange.map((t) => monthKey(t.date)))].sort();
  if (monthKeys.length > 24) monthKeys = monthKeys.slice(-24);

  const totals = new Map<string, number>();
  for (const t of inRange) {
    if (t.type !== 'expense') continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  if (totals.size === 0) return { points: [], series: [] };
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, topN).map(([id]) => id);
  const hasOther = ranked.length > top.length;

  const meta = new Map(categories.map((c) => [c.id, c]));
  const series: TimeSeriesMeta[] = top.map((id) => ({
    id,
    name: meta.get(id)?.name ?? 'Uncategorized',
    color: meta.get(id)?.color ?? OTHER_COLOR,
  }));
  if (hasOther) series.push({ id: '__other', name: 'Other', color: OTHER_COLOR });

  const points: TimeSeriesPoint[] = monthKeys.map((k) => {
    const values: Record<string, number> = {};
    for (const s of series) values[s.id] = 0;
    const month = monthRange(k);
    for (const t of inRange) {
      if (t.type !== 'expense') continue;
      if (t.date < month.from || t.date > month.to) continue;
      const id = top.includes(t.category) ? t.category : '__other';
      if (id in values) values[id] += t.amount;
    }
    return { key: k, label: shortMonthLabel(k), values };
  });

  return { points, series };
}

// ---------- Insight generation ----------

export function generateInsights(db: Database, range: DateRange | null, now: Date = new Date()): Insight[] {
  if (db.transactions.length === 0) return [];
  const out: Insight[] = [];
  const cur = db.settings.currency;
  const df = db.settings.dateFormat;
  const periodLabel = range
    ? `${formatDate(range.from, df)} → ${formatDate(range.to, df)}`
    : 'all recorded transactions';
  const totals = computeTotals(filterTransactions(db.transactions, {}, range));

  // --- Savings rate / deficit for the selected period ---
  if (totals.income > 0) {
    const rate = savingsRate(totals);
    if (totals.expense > totals.income) {
      out.push({
        id: 'period-deficit',
        tone: 'warning',
        title: 'Expenses exceeded income this period',
        detail: `Income ${formatCurrency(totals.income, cur)} vs expenses ${formatCurrency(totals.expense, cur)} (${periodLabel}) — a shortfall of ${formatCurrency(totals.expense - totals.income, cur)}.`,
      });
    } else if (rate !== null && rate >= 0.2) {
      out.push({
        id: 'period-savings-good',
        tone: 'success',
        title: 'Positive savings rate',
        detail: `You kept ${formatPercent(rate, 1)} of income after expenses in ${periodLabel} (${formatCurrency(totals.net, cur)}).`,
      });
    } else if (rate !== null) {
      out.push({
        id: 'period-savings',
        tone: 'info',
        title: 'Savings rate for the period',
        detail: `${formatPercent(rate, 1)} of income remained after expenses in ${periodLabel} (${formatCurrency(totals.net, cur)} kept of ${formatCurrency(totals.income, cur)}).`,
      });
    }
  } else if (totals.expense > 0) {
    out.push({
      id: 'period-no-income',
      tone: 'info',
      title: 'No income recorded this period',
      detail: `${formatCurrency(totals.expense, cur)} of expenses in ${periodLabel} with no income entries — savings rate cannot be calculated (no division by zero attempted).`,
    });
  }

  // --- Month-over-month spending (real calendar months) ---
  const mom = monthOverMonthExpense(db.transactions, now);
  const asOf = `as of ${formatDate(toISODate(now), df)}`;
  if (mom.percent !== null && mom.diff !== 0) {
    const pct = formatPercent(Math.abs(mom.percent), 0);
    if (mom.diff < 0) {
      out.push({
        id: 'mom-down',
        tone: 'success',
        title: 'Spending lower than last month',
        detail: `You spent ${formatCurrency(-mom.diff, cur)} less in ${mom.currentKey} than in ${mom.previousKey}: ${formatCurrency(mom.current, cur)} vs ${formatCurrency(mom.previous, cur)} (${pct} lower, ${asOf}).`,
      });
    } else {
      out.push({
        id: 'mom-up',
        tone: 'info',
        title: 'Spending higher than last month',
        detail: `You spent ${formatCurrency(mom.diff, cur)} more in ${mom.currentKey} than in ${mom.previousKey}: ${formatCurrency(mom.current, cur)} vs ${formatCurrency(mom.previous, cur)} (${pct} higher, ${asOf}).`,
      });
    }
  }

  // --- Notable category movements ---
  for (const change of categoryMonthChanges(db, now).slice(0, 2)) {
    const up = change.diff > 0;
    out.push({
      id: `cat-change-${change.categoryId}`,
      tone: up ? 'warning' : 'success',
      title: `${change.name} spending ${up ? 'up' : 'down'} vs last month`,
      detail: `${change.name} ${up ? 'increased' : 'decreased'} from ${formatCurrency(change.previous, cur)} (${mom.previousKey}) to ${formatCurrency(change.current, cur)} (${mom.currentKey}) — ${formatPercent(Math.abs(change.percent ?? 0), 0)} ${up ? 'increase' : 'decrease'} (${asOf}).`,
    });
  }

  // --- Largest spending category ---
  const largest = largestExpenseCategory(db.transactions, db.categories, range);
  if (largest && largest.amount > 0) {
    out.push({
      id: 'largest-category',
      tone: 'info',
      title: 'Largest spending category',
      detail: `${largest.name} is your top expense in ${periodLabel}: ${formatCurrency(largest.amount, cur)} (${formatPercent(largest.percent, 1)} of spending).`,
    });
  }

  // --- Budget health ---
  for (const alert of budgetAlerts(db.budgets, db.transactions, db.categories).slice(0, 3)) {
    const s = alert.status;
    if (alert.level === 'over') {
      out.push({
        id: `budget-over-${s.budget.id}`,
        tone: 'error',
        title: `${s.categoryName} budget exceeded`,
        detail: `${formatCurrency(s.spent, cur)} spent of the ${formatCurrency(s.budget.limit, cur)} limit for ${s.budget.periodKey} — over by ${formatCurrency(s.spent - s.budget.limit, cur)}.`,
      });
    } else {
      out.push({
        id: `budget-near-${s.budget.id}`,
        tone: 'warning',
        title: `${s.categoryName} budget at ${Math.round(s.ratio * 100)}%`,
        detail: `You've used ${formatPercent(s.ratio, 0)} of the ${formatCurrency(s.budget.limit, cur)} ${s.categoryName} budget for ${s.budget.periodKey} (${formatCurrency(s.remaining, cur)} left).`,
      });
    }
  }

  // --- Emergency fund coverage (estimate) ---
  const coverage = emergencyFundCoverage(db.transactions, sumOpeningBalances(db.accounts), now);
  if (coverage) {
    out.push({
      id: 'coverage',
      tone: 'info',
      title: 'Emergency fund coverage (estimate)',
      detail: `At your average spending rate of ${formatCurrency(coverage.averageMonthlyExpense, cur)} per month (${coverage.monthsSampled} month(s) of recorded activity), your current balance of ${formatCurrency(coverage.balance, cur)} could cover approximately ${coverage.months.toFixed(1)} months of expenses. Estimate from recorded data — not a forecast.`,
    });
  }

  return out;
}

// ---------- Recommendations (transparent, rule-based) ----------

export function generateRecommendations(db: Database, now: Date = new Date()): Recommendation[] {
  if (db.transactions.length === 0) return [];
  const out: Recommendation[] = [];
  const cur = db.settings.currency;

  // 1. Budgets over or near their limit (with remaining days for this month).
  for (const alert of budgetAlerts(db.budgets, db.transactions, db.categories).slice(0, 2)) {
    const b = alert.status.budget;
    let daysLeft = '';
    if (b.period === 'monthly' && b.periodKey === currentMonthKey(now)) {
      const days = daysBetween(toISODate(now), monthRange(b.periodKey).to) + 1;
      daysLeft = ` ${days} day(s) remain in ${b.periodKey}.`;
    }
    if (alert.level === 'over') {
      out.push({
        id: `rec-budget-over-${b.id}`,
        title: `Rebalance the ${alert.status.categoryName} budget`,
        why: `${formatCurrency(alert.status.spent, cur)} is recorded against a ${formatCurrency(b.limit, cur)} limit for ${b.periodKey} — ${formatPercent(alert.status.ratio, 0)} used.${daysLeft}`,
      });
    } else {
      out.push({
        id: `rec-budget-near-${b.id}`,
        title: `Watch ${alert.status.categoryName} spending`,
        why: `${formatPercent(alert.status.ratio, 0)} of the ${formatCurrency(b.limit, cur)} ${b.periodKey} limit is already used (${formatCurrency(alert.status.remaining, cur)} left).${daysLeft}`,
      });
    }
  }

  // 2. Largest substantial month-over-month category increase.
  const spike = categoryMonthChanges(db, now).find(
    (c) => c.diff > 0 && (c.percent ?? 0) >= SPIKE_RATIO && c.diff >= SPIKE_CENTS,
  );
  if (spike) {
    out.push({
      id: `rec-spike-${spike.categoryId}`,
      title: `Review ${spike.name} spending`,
      why: `${spike.name} expenses went from ${formatCurrency(spike.previous, cur)} to ${formatCurrency(spike.current, cur)} versus last month — a ${formatPercent(spike.percent ?? 0, 0)} increase of ${formatCurrency(spike.diff, cur)}.`,
    });
  }

  // 3. Savings rate in the current calendar month close to zero or negative.
  const monthTotals = computeTotals(db.transactions.filter((t) => monthKey(t.date) === currentMonthKey(now)));
  if (monthTotals.income > 0) {
    const rate = savingsRate(monthTotals);
    if (rate !== null && rate < 0.1) {
      out.push({
        id: 'rec-savings',
        title: 'Expenses are close to income this month',
        why: `In ${currentMonthKey(now)} you kept ${formatPercent(rate, 1)} of income: ${formatCurrency(monthTotals.income, cur)} in, ${formatCurrency(monthTotals.expense, cur)} out (${formatCurrency(monthTotals.net, cur)} kept).`,
      });
    }
  }

  // 4. Coverage estimate below 3 months (only when a real estimate exists).
  const coverage = emergencyFundCoverage(db.transactions, sumOpeningBalances(db.accounts), now);
  if (coverage && coverage.balance > 0 && coverage.months < 3) {
    out.push({
      id: 'rec-coverage',
      title: 'Emergency buffer under 3 months',
      why: `Your balance of ${formatCurrency(coverage.balance, cur)} covers about ${coverage.months.toFixed(1)} month(s) at your recorded average spending of ${formatCurrency(coverage.averageMonthlyExpense, cur)}/month (estimate from ${coverage.monthsSampled} month(s) of data).`,
    });
  }

  return out.slice(0, 4);
}
