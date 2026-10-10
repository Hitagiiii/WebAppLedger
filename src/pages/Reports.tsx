import { useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import PeriodSelect from '../components/PeriodSelect';
import { Button } from '../components/ui/Button';
import { Badge, EmptyState, Progress, ProgressMeta } from '../components/ui/Indicators';
import { useLedger } from '../context/LedgerContext';
import { useToast } from '../context/ToastContext';
import type { PeriodSelection } from '../types';
import {
  budgetStatus,
  categoryBreakdown,
  computeTotals,
  filterTransactions,
  goalStatus,
  monthlySeries,
  rangeForPeriod,
  savingsRate,
} from '../utils/finance';
import { formatCurrency, formatPercent } from '../utils/format';
import { downloadCsv, toCsv, todayFileStamp, transactionsToCsv } from '../utils/csv';

export default function Reports() {
  const { db } = useLedger();
  const { toast } = useToast();
  const [period, setPeriod] = useState<PeriodSelection>({ key: 'thisMonth' });

  const range = useMemo(() => rangeForPeriod(period.key, period), [period]);
  const txns = useMemo(() => filterTransactions(db.transactions, {}, range), [db.transactions, range]);
  const totals = useMemo(() => computeTotals(txns), [txns]);
  const rate = savingsRate(totals);
  const months = useMemo(() => monthlySeries(db.transactions, 6), [db.transactions]);
  const categoryRows = useMemo(
    () => categoryBreakdown(db.transactions, 'expense', db.categories, range),
    [db.transactions, db.categories, range],
  );

  const budgetRows = useMemo(
    () =>
      db.budgets
        .map((b) => budgetStatus(b, db.transactions, db.categories.find((c) => c.id === b.categoryId)))
        .filter((s) => !range || (s.budget.period === 'monthly'
          ? s.budget.periodKey >= range.from.slice(0, 7) && s.budget.periodKey <= range.to.slice(0, 7)
          : s.budget.periodKey >= range.from.slice(0, 4) && s.budget.periodKey <= range.to.slice(0, 4))),
    [db.budgets, db.transactions, db.categories, range],
  );

  const goalRows = useMemo(() => db.goals.map((g) => goalStatus(g)), [db.goals]);

  const periodLabel = range ? `${range.from} → ${range.to}` : 'All recorded transactions';

  function exportTransactions() {
    const csv = transactionsToCsv(txns, {
      categories: db.categories,
      paymentMethods: db.paymentMethods,
      mode: 'ledger',
    });
    downloadCsv(`sakura-report-transactions-${todayFileStamp()}`, csv);
    toast(`Exported ${txns.length} transaction(s).`, 'success');
  }

  function exportSummary() {
    const headers = ['Metric', 'Amount (PHP)'];
    const rows = [
      ['Income', (totals.income / 100).toFixed(2)],
      ['Expenses', (totals.expense / 100).toFixed(2)],
      ['Net cash flow', (totals.net / 100).toFixed(2)],
      ['Savings rate', rate === null ? 'n/a' : `${(rate * 100).toFixed(1)}%`],
      ['Transactions', String(totals.count)],
    ];
    downloadCsv(`sakura-report-summary-${todayFileStamp()}`, toCsv(headers, rows));
    toast('Summary report exported.', 'success');
  }

  function exportCategories() {
    const headers = ['Category', 'Amount (PHP)', 'Share (%)'];
    const rows = categoryRows.map((c) => [c.name, (c.amount / 100).toFixed(2), c.percent.toFixed(1)]);
    downloadCsv(`sakura-report-categories-${todayFileStamp()}`, toCsv(headers, rows));
    toast('Category report exported.', 'success');
  }

  function exportMonthly() {
    const headers = ['Month', 'Income (PHP)', 'Expenses (PHP)', 'Net (PHP)'];
    const rows = months.map((m) => [
      m.key,
      (m.income / 100).toFixed(2),
      (m.expense / 100).toFixed(2),
      (m.net / 100).toFixed(2),
    ]);
    downloadCsv(`sakura-report-monthly-${todayFileStamp()}`, toCsv(headers, rows));
    toast('Monthly trend exported.', 'success');
  }

  return (
    <div className="page">
      <PageHeader
        jp="報告書"
        title="Reports"
        description="Period summaries using the exact same calculations as the dashboard and ledger."
        actions={
          <>
            <Button variant="ghost" onClick={exportSummary}>
              <Download size={15} /> Summary CSV
            </Button>
            <Button variant="ghost" onClick={exportTransactions} disabled={txns.length === 0}>
              <Download size={15} /> Transactions CSV
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <PeriodSelect value={period} onChange={setPeriod} />
        <div className="toolbar-actions">
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {periodLabel}
          </span>
        </div>
      </div>

      {/* ---------- Income statement ---------- */}
      <section className="card" aria-labelledby="report-summary">
        <div className="card-header">
          <div>
            <h2 id="report-summary">Period summary</h2>
            <p>{periodLabel}</p>
          </div>
          <Badge tone="neutral">{totals.count} transactions</Badge>
        </div>
        <dl className="detail-grid">
          <div className="detail-item">
            <dt>Total income (credits)</dt>
            <dd className="amount-income mono-num">{formatCurrency(totals.income, db.settings.currency)}</dd>
          </div>
          <div className="detail-item">
            <dt>Total expenses (debits)</dt>
            <dd className="amount-expense mono-num">{formatCurrency(totals.expense, db.settings.currency)}</dd>
          </div>
          <div className="detail-item">
            <dt>Net cash flow</dt>
            <dd className={`mono-num ${totals.net < 0 ? 'amount-expense' : 'amount-income'}`}>
              {formatCurrency(totals.net, db.settings.currency, { showSign: true })}
            </dd>
          </div>
          <div className="detail-item">
            <dt>Savings rate</dt>
            <dd className="mono-num">{rate === null ? '—' : formatPercent(rate, 1)}</dd>
          </div>
        </dl>
        <div className="form-actions">
          <Button variant="ghost" size="sm" onClick={exportSummary}>
            <FileText size={14} /> Export summary
          </Button>
          <Button variant="ghost" size="sm" onClick={exportCategories} disabled={categoryRows.length === 0}>
            <Download size={14} /> Category breakdown
          </Button>
          <Button variant="ghost" size="sm" onClick={exportMonthly}>
            <Download size={14} /> Monthly trend
          </Button>
        </div>
      </section>

      {/* ---------- Category report ---------- */}
      <section className="card" aria-labelledby="report-categories">
        <div className="card-header">
          <div>
            <h2 id="report-categories">Spending by category</h2>
            <p>Expenses within the selected period</p>
          </div>
        </div>
        {categoryRows.length === 0 ? (
          <EmptyState title="No expenses" description="There are no expense transactions in this period." />
        ) : (
          <div className="table-wrap" style={{ boxShadow: 'none' }}>
            <table className="data-table" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                  <th scope="col" className="num">
                    Share
                  </th>
                  <th scope="col">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((c) => (
                  <tr key={c.categoryId}>
                    <td>
                      <span className="legend-dot" style={{ backgroundColor: c.color, marginRight: 8 }} aria-hidden="true" />
                      {c.name}
                    </td>
                    <td className="num mono-num">{formatCurrency(c.amount, db.settings.currency)}</td>
                    <td className="num mono-num">{formatPercent(c.percent, 1)}</td>
                    <td style={{ minWidth: 160 }}>
                      <Progress
                        ratio={c.percent / 100}
                        label={`${c.name} share of spending`}
                        valueText={`${c.name}: ${formatPercent(c.percent, 1)}`}
                        tone="brand"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- Budget performance ---------- */}
      <section className="card" aria-labelledby="report-budgets">
        <div className="card-header">
          <div>
            <h2 id="report-budgets">Budget performance</h2>
            <p>Every budget whose period overlaps the selection</p>
          </div>
        </div>
        {budgetRows.length === 0 ? (
          <EmptyState title="No budgets in range" description="Create budgets to see performance here." />
        ) : (
          <div className="table-wrap" style={{ boxShadow: 'none' }}>
            <table className="data-table" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th scope="col">Budget</th>
                  <th scope="col">Period</th>
                  <th scope="col" className="num">
                    Limit
                  </th>
                  <th scope="col" className="num">
                    Spent
                  </th>
                  <th scope="col" className="num">
                    Remaining
                  </th>
                  <th scope="col" className="num">
                    Used
                  </th>
                </tr>
              </thead>
              <tbody>
                {budgetRows.map((s) => (
                  <tr key={s.budget.id}>
                    <td>{s.categoryName}</td>
                    <td className="mono-num">
                      {s.budget.period === 'monthly' ? s.budget.periodKey : `Y${s.budget.periodKey}`}
                    </td>
                    <td className="num mono-num">{formatCurrency(s.budget.limit, db.settings.currency)}</td>
                    <td className="num mono-num">{formatCurrency(s.spent, db.settings.currency)}</td>
                    <td className={`num mono-num ${s.remaining < 0 ? 'amount-expense' : ''}`}>
                      {formatCurrency(s.remaining, db.settings.currency)}
                    </td>
                    <td className="num mono-num">
                      {formatPercent(s.ratio)}
                      {s.exceeded && <Badge tone="error"> over</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- Goals + monthly trend ---------- */}
      <div className="grid grid-2">
        <section className="card" aria-labelledby="report-goals">
          <div className="card-header">
            <div>
              <h2 id="report-goals">Savings goal progress</h2>
              <p>Manual progress entries</p>
            </div>
          </div>
          {goalRows.length === 0 ? (
            <EmptyState title="No goals" description="Add a savings goal to track progress here." />
          ) : (
            goalRows.map((g) => (
              <div key={g.goal.id} style={{ marginBottom: 'var(--spacing-md)' }}>
                <div className="list-row-title" style={{ marginBottom: 6 }}>
                  {g.goal.title}
                  <span className="muted mono-num">
                    {formatCurrency(g.goal.saved, db.settings.currency)} / {formatCurrency(g.goal.target, db.settings.currency)}
                  </span>
                </div>
                <Progress
                  ratio={g.ratio}
                  label={`Progress for ${g.goal.title}`}
                  valueText={`${formatPercent(g.ratio)} complete`}
                />
                <ProgressMeta left={`${formatPercent(g.ratio)} complete`} right={`${formatCurrency(g.remaining, db.settings.currency)} to go`} />
              </div>
            ))
          )}
        </section>

        <section className="card" aria-labelledby="report-monthly">
          <div className="card-header">
            <div>
              <h2 id="report-monthly">Monthly trend</h2>
              <p>Last 6 months</p>
            </div>
            <Button variant="ghost" size="sm" onClick={exportMonthly}>
              <Download size={14} /> CSV
            </Button>
          </div>
          <div className="table-wrap" style={{ boxShadow: 'none' }}>
            <table className="data-table" style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className="num">
                    Income
                  </th>
                  <th scope="col" className="num">
                    Expenses
                  </th>
                  <th scope="col" className="num">
                    Net
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td className="num mono-num amount-income">{formatCurrency(m.income, db.settings.currency)}</td>
                    <td className="num mono-num amount-expense">{formatCurrency(m.expense, db.settings.currency)}</td>
                    <td className={`num mono-num ${m.net < 0 ? 'amount-expense' : 'amount-income'}`}>
                      {formatCurrency(m.net, db.settings.currency, { showSign: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
