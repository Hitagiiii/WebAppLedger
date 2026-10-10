import { useMemo, useState } from 'react';
import { Download, Plus, RotateCcw } from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Field, Input, SelectField } from '../components/ui/Field';
import { EmptyState } from '../components/ui/Indicators';
import TransactionForm from '../features/transactions/TransactionForm';
import { useLedger } from '../context/LedgerContext';
import { useToast } from '../context/ToastContext';
import { computeRunningBalances, computeTotals } from '../utils/finance';
import { formatCurrency, formatDate } from '../utils/format';
import { downloadCsv, toCsv, todayFileStamp } from '../utils/csv';

/**
 * ACCOUNTING LEDGER
 *
 * The ledger can show ALL accounts (aggregate position) or a single account.
 * Each account's running balance starts from its own opening balance
 * (Accounts page) and moves with that account's income (credit) and expenses
 * (debit). Transfers are not modeled yet, so no amount can be double-counted
 * between accounts.
 *
 * Running balance rows are computed in chronological order and only then
 * displayed newest-first, so the displayed balance is the real accounting
 * position after that transaction — never a function of the sort order.
 */
export default function Ledger() {
  const { db } = useLedger();
  const { toast } = useToast();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [category, setCategory] = useState('all');
  const [account, setAccount] = useState('all');
  const [formOpen, setFormOpen] = useState(false);

  const categoryById = useMemo(() => new Map(db.categories.map((c) => [c.id, c])), [db.categories]);
  const pmById = useMemo(() => new Map(db.paymentMethods.map((p) => [p.id, p])), [db.paymentMethods]);
  const accountById = useMemo(() => new Map(db.accounts.map((a) => [a.id, a])), [db.accounts]);

  // Scope: a single account, or the aggregate of every account.
  const scoped = useMemo(() => {
    if (account !== 'all') {
      const acc = db.accounts.find((a) => a.id === account);
      if (!acc) return { txns: db.transactions, opening: 0 };
      return {
        txns: db.transactions.filter((t) => t.account === acc.id),
        opening: acc.openingBalance,
      };
    }
    return {
      txns: db.transactions,
      opening: db.accounts.reduce((sum, a) => sum + a.openingBalance, 0),
    };
  }, [db.accounts, db.transactions, account]);

  const chronological = useMemo(
    () => computeRunningBalances(scoped.txns, scoped.opening, false),
    [scoped],
  );

  // Display order (newest first) — balances stay chronological.
  const rows = useMemo(() => {
    const filtered = chronological.filter(({ transaction: t }) => {
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (type !== 'all' && t.type !== type) return false;
      if (category !== 'all' && t.category !== category) return false;
      return true;
    });
    return [...filtered].reverse();
  }, [chronological, from, to, type, category]);

  const totals = useMemo(() => computeTotals(rows.map((r) => r.transaction)), [rows]);
  const opening = scoped.opening;
  const latestBalance = chronological.length > 0 ? chronological[chronological.length - 1].balance : opening;
  const scopeLabel = account === 'all' ? 'All accounts' : accountById.get(account)?.name ?? 'Account';

  const hasFilters = Boolean(from || to || type !== 'all' || category !== 'all' || account !== 'all');

  function reset() {
    setFrom('');
    setTo('');
    setType('all');
    setCategory('all');
    setAccount('all');
  }

  function exportCsv() {
    const headers = ['Date', 'Reference', 'Description', 'Category', 'Payment Method', 'Account', 'Credit', 'Debit', 'Balance'];
    const body = rows.map((row) => {
      const t = row.transaction;
      return [
        t.date,
        t.reference ?? '',
        t.description,
        categoryById.get(t.category)?.name ?? 'Uncategorized',
        pmById.get(t.paymentMethod)?.name ?? '—',
        accountById.get(t.account)?.name ?? '—',
        t.type === 'income' ? (t.amount / 100).toFixed(2) : '',
        t.type === 'expense' ? (t.amount / 100).toFixed(2) : '',
        (row.balance / 100).toFixed(2),
      ];
    });
    downloadCsv(`sakura-ledger-${todayFileStamp()}`, toCsv(headers, body));
    toast(`Exported ${rows.length} ledger row(s) to CSV.`, 'success');
  }

  return (
    <div className="page">
      <PageHeader
        jp="元帳"
        title="Accounting Ledger"
        description="Credits, debits and the running balance of every account — one row per transaction."
        actions={
          <>
            <Button variant="ghost" onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={15} /> Export CSV
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={15} /> Add entry
            </Button>
          </>
        }
      />

      <div className="summary-strip">
        <div className="summary-strip-note">
          <strong>Scope:</strong> {scopeLabel}. Opening balance{' '}
          <span className="mono-num">{formatCurrency(opening, db.settings.currency)}</span>
          {account === 'all' ? ' (sum of all accounts)' : ''}, plus every income (credit) and expense (debit)
          below. Balances are recalculated chronologically from that opening balance whenever data changes.
        </div>
        <div className="list-row-figures">
          <div className="figure">
            <span className="figure-label">Credits</span>
            <span className="figure-value amount-income">{formatCurrency(totals.income, db.settings.currency)}</span>
          </div>
          <div className="figure">
            <span className="figure-label">Debits</span>
            <span className="figure-value amount-expense">{formatCurrency(totals.expense, db.settings.currency)}</span>
          </div>
          <div className="figure">
            <span className="figure-label">Net</span>
            <span className="figure-value">{formatCurrency(totals.net, db.settings.currency, { showSign: true })}</span>
          </div>
          <div className="figure">
            <span className="figure-label">Current balance</span>
            <span className="figure-value">{formatCurrency(latestBalance, db.settings.currency)}</span>
          </div>
        </div>
      </div>

      <div className="toolbar" aria-label="Ledger filters">
        <Field label="From">
          {({ id }) => (
            <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          )}
        </Field>
        <Field label="To">
          {({ id }) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}
        </Field>
        <SelectField
          label="Type"
          value={type}
          onChange={(v) => setType(v as 'all' | 'income' | 'expense')}
          options={[
            { value: 'all', label: 'All entries' },
            { value: 'income', label: 'Credits (income)' },
            { value: 'expense', label: 'Debits (expense)' },
          ]}
        />
        <SelectField
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: 'All categories' },
            ...db.categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <SelectField
          label="Account"
          value={account}
          onChange={setAccount}
          options={[
            { value: 'all', label: 'All accounts' },
            ...db.accounts.map((a) => ({
              value: a.id,
              label: a.archived ? `${a.name} (archived)` : a.name,
            })),
          ]}
        />
        <div className="toolbar-actions">
          <Button variant="ghost" size="sm" onClick={reset} disabled={!hasFilters}>
            <RotateCcw size={14} /> Reset
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No entries match these filters' : 'The ledger is empty'}
          description={
            hasFilters
              ? 'Adjust or reset the filters to see entries.'
              : 'Add income or an expense to start the running balance.'
          }
          action={
            hasFilters ? (
              <Button variant="ghost" onClick={reset}>
                <RotateCcw size={14} /> Reset filters
              </Button>
            ) : (
              <Button onClick={() => setFormOpen(true)}>
                <Plus size={15} /> Add entry
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">
                Ledger entries with credit, debit and chronologically calculated running balance (newest first)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Description</th>
                  <th scope="col">Category</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Account</th>
                  <th scope="col" className="num">
                    Credit
                  </th>
                  <th scope="col" className="num">
                    Debit
                  </th>
                  <th scope="col" className="num">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ transaction: t, balance }) => (
                  <tr key={t.id}>
                    <td className="mono-num">{formatDate(t.date, db.settings.dateFormat)}</td>
                    <td className="mono-num muted">{t.reference || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{t.description}</td>
                    <td>{categoryById.get(t.category)?.name ?? 'Uncategorized'}</td>
                    <td>{pmById.get(t.paymentMethod)?.name ?? '—'}</td>
                    <td>{accountById.get(t.account)?.name ?? '—'}</td>
                    <td className="num amount-income">{t.type === 'income' ? formatCurrency(t.amount, db.settings.currency) : ''}</td>
                    <td className="num amount-expense">{t.type === 'expense' ? formatCurrency(t.amount, db.settings.currency) : ''}</td>
                    <td className="num mono-num">{formatCurrency(balance, db.settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} style={{ fontWeight: 700 }}>
                    Filtered totals
                  </td>
                  <td className="num amount-income" style={{ fontWeight: 700 }}>
                    {formatCurrency(totals.income, db.settings.currency)}
                  </td>
                  <td className="num amount-expense" style={{ fontWeight: 700 }}>
                    {formatCurrency(totals.expense, db.settings.currency)}
                  </td>
                  <td className="num mono-num" style={{ fontWeight: 700 }}>
                    {formatCurrency(latestBalance, db.settings.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="table-scroll-hint">Scroll the table sideways to see all columns.</p>
        </>
      )}

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
