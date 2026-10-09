import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  PiggyBank,
  Plus,
  Wallet,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import PeriodSelect from '../components/PeriodSelect';
import { KpiCard } from '../components/ui/Kpi';
import { Button, LinkButton } from '../components/ui/Button';
import { Badge, EmptyState, Progress, ProgressMeta } from '../components/ui/Indicators';
import { CategoryPieChart, IncomeExpenseChart } from '../components/charts/Charts';
import TransactionForm from '../features/transactions/TransactionForm';
import { useLedger } from '../context/LedgerContext';
import type { PeriodSelection } from '../types';
import {
  budgetStatus,
  categoryBreakdown,
  computeTotals,
  currentMonthKey,
  debtStatus,
  filterTransactions,
  goalStatus,
  monthlySeries,
  previousMonthKey,
  rangeForPeriod,
  savingsRate,
  sumOpeningBalances,
  todayISO,
  totalBalance,
} from '../utils/finance';
import { formatDate, formatCurrency, formatPercent, relativeDueLabel } from '../utils/format';
import { deriveNotifications } from '../utils/notifications';

export default function Dashboard() {
  const { db } = useLedger();
  const today = todayISO();

  const [period, setPeriod] = useState<PeriodSelection>({ key: 'thisMonth' });
  const [quickType, setQuickType] = useState<'income' | 'expense' | null>(null);

  const range = useMemo(() => rangeForPeriod(period.key, period), [period]);
  const txns = useMemo(() => filterTransactions(db.transactions, {}, range), [db.transactions, range]);
  const totals = useMemo(() => computeTotals(txns), [txns]);
  const rate = savingsRate(totals);

  // Aggregate of every account (active + archived) — each peso counted once.
  const balance = useMemo(
    () => totalBalance(db.accounts, db.transactions),
    [db.accounts, db.transactions],
  );

  const accountRows = useMemo(() => {
    const byAccount = new Map<string, { income: number; expense: number }>();
    for (const t of db.transactions) {
      const row = byAccount.get(t.account) ?? { income: 0, expense: 0 };
      if (t.type === 'income') row.income += t.amount;
      else row.expense += t.amount;
      byAccount.set(t.account, row);
    }
    return db.accounts.map((account) => {
      const own = byAccount.get(account.id) ?? { income: 0, expense: 0 };
      return {
        account,
        balance: account.openingBalance + own.income - own.expense,
      };
    });
  }, [db.accounts, db.transactions]);

  const heldTotal = useMemo(
    () => accountRows.filter((r) => r.account.group === 'held').reduce((s, r) => s + r.balance, 0),
    [accountRows],
  );
  const stashedTotal = useMemo(
    () => accountRows.filter((r) => r.account.group === 'stashed').reduce((s, r) => s + r.balance, 0),
    [accountRows],
  );
  const aggregateOpening = useMemo(() => sumOpeningBalances(db.accounts), [db.accounts]);

  // Previous-period comparison is only offered where real prior data exists.
  const previous = useMemo(() => {
    if (period.key !== 'thisMonth' && period.key !== 'lastMonth') return null;
    const prevKey = previousMonthKey(period.key === 'thisMonth' ? currentMonthKey() : previousMonthKey());
    const prevRange = rangeForPeriod('thisMonth', undefined, new Date(`${prevKey}-01T00:00:00`));
    if (!prevRange) return null;
    const prevTxns = filterTransactions(db.transactions, {}, prevRange);
    if (prevTxns.length === 0) return null;
    return computeTotals(prevTxns);
  }, [period.key, db.transactions]);

  const months = useMemo(() => monthlySeries(db.transactions, 6), [db.transactions]);
  const expenseSlices = useMemo(
    () => categoryBreakdown(db.transactions, 'expense', db.categories, range),
    [db.transactions, db.categories, range],
  );

  const monthBudgets = useMemo(() => {
    const key = currentMonthKey();
    return db.budgets
      .filter((b) => b.period === 'monthly' && b.periodKey === key)
      .map((b) => budgetStatus(b, db.transactions, db.categories.find((c) => c.id === b.categoryId)))
      .sort((a, b) => b.ratio - a.ratio);
  }, [db.budgets, db.transactions, db.categories]);

  const budgetLimit = monthBudgets.reduce((s, b) => s + b.budget.limit, 0);
  const budgetSpent = monthBudgets.reduce((s, b) => s + b.spent, 0);

  const goalRows = useMemo(
    () => db.goals.map((g) => goalStatus(g)).sort((a, b) => b.ratio - a.ratio).slice(0, 3),
    [db.goals],
  );

  const upcoming = useMemo(
    () =>
      db.debts
        .map((d) => debtStatus(d))
        .filter((s) => s.debt.dueDate && s.remaining > 0)
        .sort((a, b) => ((a.debt.dueDate ?? '') < (b.debt.dueDate ?? '') ? -1 : 1))
        .slice(0, 4),
    [db.debts],
  );

  const notifications = useMemo(() => deriveNotifications(db), [db]);

  const recent = useMemo(
    () => [...db.transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 6),
    [db.transactions],
  );

  const categoryById = useMemo(() => new Map(db.categories.map((c) => [c.id, c])), [db.categories]);
  const pmById = useMemo(() => new Map(db.paymentMethods.map((p) => [p.id, p])), [db.paymentMethods]);

  /** Comparison against the previous period, only when real prior data exists. */
  function deltaInfo(
    current: number,
    prev: number | undefined,
    higherIsBetter: boolean,
  ): { text: string; good: boolean } | null {
    if (prev === undefined || prev === 0) return null;
    const change = (current - prev) / prev;
    if (!Number.isFinite(change)) return null;
    const arrow = change >= 0 ? '▲' : '▼';
    return {
      text: `${arrow} ${Math.abs(change * 100).toFixed(0)}% vs previous month`,
      good: higherIsBetter ? change >= 0 : change <= 0,
    };
  }

  const incomeDelta = deltaInfo(totals.income, previous?.income, true);
  const expenseDelta = deltaInfo(totals.expense, previous?.expense, false);

  return (
    <div className="page">
      <PageHeader
        jp="ダッシュボード"
        title={`Welcome back, ${db.profile.name}`}
        description="Your financial position at a glance — every number below is derived from the ledger."
        actions={
          <>
            <Button variant="ghost" onClick={() => setQuickType('income')}>
              <ArrowDownLeft size={15} /> Add income
            </Button>
            <Button variant="accent" onClick={() => setQuickType('expense')}>
              <ArrowUpRight size={15} /> Add expense
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <PeriodSelect value={period} onChange={setPeriod} label="Dashboard period" />
        <div className="toolbar-actions">
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {range ? `${range.from} → ${range.to}` : 'All recorded transactions'}
          </span>
        </div>
      </div>

      {/* ---------- Summary cards ---------- */}
      <div className="grid grid-kpi">
        <KpiCard
          label="Current balance"
          value={formatCurrency(balance, db.settings.currency)}
          icon={<Wallet size={17} />}
          sub={
            db.accounts.length === 1
              ? `1 account · opening ${formatCurrency(aggregateOpening, db.settings.currency)} + ${db.transactions.length} transactions`
              : `${db.accounts.length} accounts · opening ${formatCurrency(aggregateOpening, db.settings.currency)} + ${db.transactions.length} transactions`
          }
          tone={balance >= 0 ? 'positive' : 'negative'}
        />
        <KpiCard
          label="Income (period)"
          value={formatCurrency(totals.income, db.settings.currency)}
          icon={<TrendingUp size={17} />}
          sub={incomeDelta?.text ?? `${totals.count} transaction(s) in period`}
          tone={incomeDelta ? (incomeDelta.good ? 'positive' : 'negative') : 'neutral'}
        />
        <KpiCard
          label="Expenses (period)"
          value={formatCurrency(totals.expense, db.settings.currency)}
          icon={<TrendingDown size={17} />}
          sub={expenseDelta?.text ?? 'Debits in selected period'}
          tone={expenseDelta ? (expenseDelta.good ? 'positive' : 'negative') : 'negative'}
        />
        <KpiCard
          label="Net cash flow"
          value={formatCurrency(totals.net, db.settings.currency, { showSign: true })}
          icon={totals.net >= 0 ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
          sub={totals.net >= 0 ? 'Income exceeded expenses' : 'Expenses exceeded income'}
          tone={totals.net >= 0 ? 'positive' : 'negative'}
        />
        <KpiCard
          label="Savings rate"
          value={rate === null ? '—' : formatPercent(rate, 1)}
          icon={<PiggyBank size={17} />}
          sub={rate === null ? 'No income in this period' : 'Kept after expenses'}
          tone={rate !== null && rate >= 0 ? 'positive' : 'negative'}
        />
        <KpiCard
          label="Budget remaining"
          value={formatCurrency(budgetLimit - budgetSpent, db.settings.currency)}
          icon={<Wallet size={17} />}
          sub={
            monthBudgets.length === 0
              ? 'No budgets for this month'
              : `${formatPercent(budgetLimit > 0 ? budgetSpent / budgetLimit : 0)} of ${formatCurrency(budgetLimit, db.settings.currency)} used`
          }
          tone={budgetLimit - budgetSpent >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {/* ---------- Charts ---------- */}
      <div className="grid grid-dashboard">
        <section className="card" aria-labelledby="dash-income-expense">
          <div className="card-header">
            <div>
              <h2 id="dash-income-expense">Income vs expenses</h2>
              <p>Last 6 months</p>
            </div>
            <LinkButton to="/analytics" variant="ghost" size="sm">
              Full analytics
            </LinkButton>
          </div>
          <IncomeExpenseChart data={months} height={280} />
        </section>

        <section className="card" aria-labelledby="dash-breakdown">
          <div className="card-header">
            <div>
              <h2 id="dash-breakdown">Spending breakdown</h2>
              <p>{range ? `${range.from} → ${range.to}` : 'All time'} by category</p>
            </div>
          </div>
          {expenseSlices.length === 0 ? (
            <EmptyState title="No expenses yet" description="Expenses in this period will be charted here." />
          ) : (
            <CategoryPieChart slices={expenseSlices} height={260} />
          )}
        </section>
      </div>

      {/* ---------- Accounts ---------- */}
      <section className="card" aria-labelledby="dash-accounts">
        <div className="card-header">
          <div>
            <h2 id="dash-accounts">Accounts</h2>
            <p>Balances derived from each account’s opening balance and its transactions</p>
          </div>
          <LinkButton to="/accounts" variant="ghost" size="sm">
            Manage
          </LinkButton>
        </div>
        <div className="list-row-figures">
          <div className="figure">
            <span className="figure-label">Held</span>
            <span className="figure-value">{formatCurrency(heldTotal, db.settings.currency)}</span>
          </div>
          <div className="figure">
            <span className="figure-label">Stashed Away</span>
            <span className="figure-value">{formatCurrency(stashedTotal, db.settings.currency)}</span>
          </div>
          <div className="figure">
            <span className="figure-label">Total</span>
            <span className="figure-value">{formatCurrency(balance, db.settings.currency)}</span>
          </div>
        </div>
        {accountRows.length === 0 ? (
          <EmptyState
            title="No accounts yet"
            description="Create your first account to start tracking where your money lives."
            action={<LinkButton to="/accounts" size="sm">Add account</LinkButton>}
          />
        ) : (
          <ul className="upcoming-list">
            {accountRows.map(({ account, balance: accBalance }) => (
              <li key={account.id} className="upcoming-item upcoming-item--txn">
                <div>
                  <strong>
                    {account.name}
                    {account.archived && <Badge tone="neutral">archived</Badge>}
                  </strong>
                  <span className="list-row-sub">
                    {account.group === 'held' ? 'Held' : 'Stashed Away'} · opening{' '}
                    {formatCurrency(account.openingBalance, db.settings.currency)}
                  </span>
                </div>
                <div className="upcoming-date">
                  <span className="mono-num">{formatCurrency(accBalance, db.settings.currency)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Transactions / budgets / goals ---------- */}
      <div className="grid grid-dashboard">
        <section className="card card-flush" aria-labelledby="dash-recent">
          <div className="card-header">
            <div>
              <h2 id="dash-recent">Recent transactions</h2>
              <p>Newest first</p>
            </div>
            <LinkButton to="/transactions" variant="ghost" size="sm">
              View all
            </LinkButton>
          </div>

          {recent.length === 0 ? (
            <div style={{ padding: 'var(--spacing-md)' }}>
              <EmptyState
                title="No transactions yet"
                description="Add your first income or expense to see it here."
                action={
                  <Button size="sm" onClick={() => setQuickType('expense')}>
                    <Plus size={14} /> Add expense
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
              <table className="data-table" style={{ minWidth: 640 }}>
                <caption className="sr-only">Six most recent transactions</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                    <th scope="col">Category</th>
                    <th scope="col">Payment</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
                      <td className="mono-num">{formatDate(t.date, db.settings.dateFormat)}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.description}</div>
                        <Badge tone={t.type === 'income' ? 'income' : 'expense'}>
                          {t.type === 'income' ? 'Credit' : 'Debit'}
                        </Badge>
                      </td>
                      <td>{categoryById.get(t.category)?.name ?? 'Uncategorized'}</td>
                      <td>{pmById.get(t.paymentMethod)?.name ?? '—'}</td>
                      <td className={`num ${t.type === 'income' ? 'amount-income' : 'amount-expense'}`}>
                        {t.type === 'income' ? '+' : '−'}
                        {formatCurrency(t.amount, db.settings.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {/* Budget progress */}
          <section className="card" aria-labelledby="dash-budgets">
            <div className="card-header">
              <div>
                <h2 id="dash-budgets">Budget progress</h2>
                <p>Current month</p>
              </div>
              <LinkButton to="/budgets" variant="ghost" size="sm">
                Manage
              </LinkButton>
            </div>
            {monthBudgets.length === 0 ? (
              <EmptyState
                title="No budgets this month"
                description="Set spending limits to see live progress here."
                action={
                  <LinkButton to="/budgets" size="sm" variant="ghost">
                    Create budget
                  </LinkButton>
                }
              />
            ) : (
              monthBudgets.slice(0, 4).map((s) => (
                <div key={s.budget.id} style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div className="list-row-title" style={{ marginBottom: 4, fontSize: 'var(--text-sm)' }}>
                    {s.categoryName}
                    {s.exceeded && <Badge tone="error">over</Badge>}
                  </div>
                  <Progress
                    ratio={s.ratio}
                    label={`${s.categoryName} budget`}
                    valueText={`${formatCurrency(s.spent, db.settings.currency)} of ${formatCurrency(s.budget.limit, db.settings.currency)}`}
                  />
                  <ProgressMeta
                    left={`${formatCurrency(s.remaining, db.settings.currency)} left`}
                    right={formatPercent(s.ratio)}
                  />
                </div>
              ))
            )}
          </section>

          {/* Savings goals */}
          <section className="card" aria-labelledby="dash-goals">
            <div className="card-header">
              <div>
                <h2 id="dash-goals">Savings goals</h2>
                <p>Top progress</p>
              </div>
              <LinkButton to="/goals" variant="ghost" size="sm">
                All goals
              </LinkButton>
            </div>
            {goalRows.length === 0 ? (
              <EmptyState
                title="No goals yet"
                description="Create a savings goal to track progress."
                action={
                  <LinkButton to="/goals" size="sm" variant="ghost">
                    New goal
                  </LinkButton>
                }
              />
            ) : (
              goalRows.map((g) => (
                <div key={g.goal.id} style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div className="list-row-title" style={{ marginBottom: 4, fontSize: 'var(--text-sm)' }}>
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
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      {/* ---------- Upcoming + notifications ---------- */}
      <div className="grid grid-2">
        <section className="card" aria-labelledby="dash-upcoming">
          <div className="card-header">
            <div>
              <h2 id="dash-upcoming">
                <CalendarClock size={16} aria-hidden="true" /> Upcoming payments
              </h2>
              <p>From your debts and loans</p>
            </div>
            <LinkButton to="/debts" variant="ghost" size="sm">
              Debts
            </LinkButton>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing due" description="Debts with due dates will appear here so nothing slips through." />
          ) : (
            <ul className="upcoming-list">
              {upcoming.map((s) => (
                <li key={s.debt.id} className={`upcoming-item upcoming-item--${s.status === 'overdue' ? 'debt' : 'goal'}`}>
                  <div>
                    <strong>{s.debt.party}</strong>
                    <span className="list-row-sub">
                      {s.debt.direction === 'iOwe' ? 'You owe' : 'Owed to you'}{' '}
                      {formatCurrency(s.remaining, db.settings.currency)}
                    </span>
                  </div>
                  <div className="upcoming-date">
                    <span className="mono-num">{formatDate(s.debt.dueDate, db.settings.dateFormat)}</span>
                    <span className={s.status === 'overdue' ? 'amount-expense' : 'list-row-sub'}>
                      {relativeDueLabel(s.debt.dueDate ?? today, today)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="dash-notifications">
          <div className="card-header">
            <div>
              <h2 id="dash-notifications">Notifications</h2>
              <p>Generated from budgets, debts and goals</p>
            </div>
            <Badge tone="neutral">{notifications.length}</Badge>
          </div>
          {notifications.length === 0 ? (
            <EmptyState title="All clear" description="No budget warnings, overdue payments or deadline alerts right now." />
          ) : (
            <ul className="upcoming-list">
              {notifications.map((n) => (
                <li key={n.id} className={`upcoming-item upcoming-item--${n.tone === 'success' ? 'txn' : 'debt'}`}>
                  <div>
                    <strong>{n.title}</strong>
                    <span className="list-row-sub">{n.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <TransactionForm
        open={quickType !== null}
        defaultType={quickType ?? undefined}
        onClose={() => setQuickType(null)}
      />
    </div>
  );
}
