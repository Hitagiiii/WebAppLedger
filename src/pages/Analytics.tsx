import { useMemo, useState } from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import PeriodSelect from '../components/PeriodSelect';
import { CategoryPieChart, CashFlowChart, IncomeExpenseChart } from '../components/charts/Charts';
import { EmptyState } from '../components/ui/Indicators';
import { useLedger } from '../context/LedgerContext';
import type { PeriodSelection } from '../types';
import {
  categoryBreakdown,
  computeTotals,
  filterTransactions,
  monthlySeries,
  rangeForPeriod,
  savingsRate,
} from '../utils/finance';
import { formatCurrency, formatPercent } from '../utils/format';

export default function Analytics() {
  const { db } = useLedger();
  const [period, setPeriod] = useState<PeriodSelection>({ key: 'thisMonth' });

  const range = useMemo(() => rangeForPeriod(period.key, period), [period]);

  const inRangeTxns = useMemo(
    () => filterTransactions(db.transactions, {}, range),
    [db.transactions, range],
  );
  const totals = useMemo(() => computeTotals(inRangeTxns), [inRangeTxns]);
  const rate = savingsRate(totals);

  const months = useMemo(() => monthlySeries(db.transactions, 6), [db.transactions]);
  const expenseSlices = useMemo(
    () => categoryBreakdown(db.transactions, 'expense', db.categories, range),
    [db.transactions, db.categories, range],
  );
  const incomeSlices = useMemo(
    () => categoryBreakdown(db.transactions, 'income', db.categories, range),
    [db.transactions, db.categories, range],
  );

  const periodLabel =
    range ? `${range.from} → ${range.to}` : 'All recorded transactions';

  return (
    <div className="page">
      <PageHeader
        jp="分析"
        title="Analytics"
        description="Income, expenses and spending patterns for the selected reporting period."
        actions={undefined}
      />

      <div className="toolbar">
        <PeriodSelect value={period} onChange={setPeriod} />
        <div className="toolbar-actions">
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Showing {periodLabel} · {inRangeTxns.length} transaction(s)
          </span>
        </div>
      </div>

      <div className="grid grid-kpi">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Income</span>
          </div>
          <div className="kpi-value amount-income">{formatCurrency(totals.income, db.settings.currency)}</div>
          <div className="kpi-sub">{totals.count} transaction(s) in period</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Expenses</span>
          </div>
          <div className="kpi-value amount-expense">{formatCurrency(totals.expense, db.settings.currency)}</div>
          <div className="kpi-sub">Debits in period</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Net cash flow</span>
          </div>
          <div className={`kpi-value ${totals.net < 0 ? 'amount-expense' : 'amount-income'}`}>
            {formatCurrency(totals.net, db.settings.currency, { showSign: true })}
          </div>
          <div className={`kpi-sub ${totals.net >= 0 ? 'is-positive' : 'is-negative'}`}>
            {totals.net >= 0 ? 'Surplus' : 'Deficit'} in period
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Savings rate</span>
          </div>
          <div className="kpi-value">{rate === null ? '—' : formatPercent(rate, 1)}</div>
          <div className="kpi-sub">
            {rate === null ? 'No income in this period' : 'Of income kept after expenses'}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="analytics-income-expense">
          <div className="card-header">
            <div>
              <h2 id="analytics-income-expense">Income vs expenses</h2>
              <p>Last 6 months, all transactions</p>
            </div>
          </div>
          <IncomeExpenseChart data={months} />
          <p className="chart-note">
            Green = income credits, pink = expense debits. Values come from the same totals used everywhere else.
          </p>
        </section>

        <section className="card" aria-labelledby="analytics-cashflow">
          <div className="card-header">
            <div>
              <h2 id="analytics-cashflow">Cash-flow trend</h2>
              <p>Monthly net (income − expenses)</p>
            </div>
          </div>
          <CashFlowChart data={months} />
          <p className="chart-note">
            Six-month net total:{' '}
            <strong>
              {formatCurrency(
                months.reduce((s, m) => s + m.net, 0),
                db.settings.currency,
                { showSign: true },
              )}
            </strong>
          </p>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="analytics-expense-pie">
          <div className="card-header">
            <div>
              <h2 id="analytics-expense-pie">Spending distribution</h2>
              <p>Expenses by category in the selected period</p>
            </div>
            <PieChartIcon size={18} aria-hidden="true" />
          </div>
          {expenseSlices.length === 0 ? (
            <EmptyState
              title="No expenses in this period"
              description="Pick a different reporting period or add expense transactions."
            />
          ) : (
            <>
              <CategoryPieChart slices={expenseSlices} />
              <ul className="breakdown-list">
                {expenseSlices.map((s) => (
                  <li key={s.categoryId}>
                    <span className="legend-dot" style={{ backgroundColor: s.color }} aria-hidden="true" />
                    <span className="breakdown-name">{s.name}</span>
                    <span className="mono-num">{formatCurrency(s.amount, db.settings.currency)}</span>
                    <span className="muted mono-num">{formatPercent(s.percent, 1)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card" aria-labelledby="analytics-income-pie">
          <div className="card-header">
            <div>
              <h2 id="analytics-income-pie">Income sources</h2>
              <p>Income by category in the selected period</p>
            </div>
          </div>
          {incomeSlices.length === 0 ? (
            <EmptyState
              title="No income in this period"
              description="Pick a different reporting period or add income transactions."
            />
          ) : (
            <>
              <CategoryPieChart slices={incomeSlices} height={260} />
              <ul className="breakdown-list">
                {incomeSlices.map((s) => (
                  <li key={s.categoryId}>
                    <span className="legend-dot" style={{ backgroundColor: s.color }} aria-hidden="true" />
                    <span className="breakdown-name">{s.name}</span>
                    <span className="mono-num">{formatCurrency(s.amount, db.settings.currency)}</span>
                    <span className="muted mono-num">{formatPercent(s.percent, 1)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
