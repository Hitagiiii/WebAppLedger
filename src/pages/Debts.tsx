import { useMemo, useState } from 'react';
import { HandCoins, Pencil, Plus, Trash2 } from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Field, Input, SelectField, Textarea } from '../components/ui/Field';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { Badge, EmptyState, Progress, ProgressMeta } from '../components/ui/Indicators';
import { useLedger } from '../context/LedgerContext';
import { useToast } from '../context/ToastContext';
import type { Debt, DebtDirection } from '../types';
import { debtStatus, toMajor } from '../utils/finance';
import { formatDate, formatCurrency, relativeDueLabel } from '../utils/format';
import { todayISO } from '../utils/finance';
import { ValidationError, type DebtInput, type PaymentInput } from '../utils/validate';

interface DebtFormState {
  direction: DebtDirection;
  party: string;
  originalAmount: string;
  dueDate: string;
  notes: string;
}

const emptyDebtForm = (): DebtFormState => ({
  direction: 'iOwe',
  party: '',
  originalAmount: '',
  dueDate: '',
  notes: '',
});

const STATUS_TONE = {
  settled: 'success',
  overdue: 'error',
  dueSoon: 'warning',
  open: 'neutral',
} as const;

const STATUS_LABEL = {
  settled: 'Settled',
  overdue: 'Overdue',
  dueSoon: 'Due soon',
  open: 'Open',
} as const;

export default function Debts() {
  const { db, addDebt, updateDebt, deleteDebt, addDebtPayment, deleteDebtPayment } = useLedger();
  const { toast } = useToast();
  const today = todayISO();

  const [direction, setDirection] = useState<DebtDirection>('iOwe');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | undefined>();
  const [confirming, setConfirming] = useState<Debt | undefined>();
  const [form, setForm] = useState<DebtFormState>(emptyDebtForm);
  const [errors, setErrors] = useState<Partial<Record<keyof DebtFormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Payment modal
  const [payFor, setPayFor] = useState<Debt | undefined>();
  const [payForm, setPayForm] = useState<PaymentInput>({ date: today, amount: '', notes: '' });
  const [payLinked, setPayLinked] = useState(false);
  const [payErrors, setPayErrors] = useState<Partial<Record<keyof PaymentInput, string>>>({});
  const [payError, setPayError] = useState<string | null>(null);

  const allStatuses = useMemo(() => db.debts.map((d) => debtStatus(d)), [db.debts]);
  const visible = allStatuses.filter((s) => s.debt.direction === direction);

  const totals = useMemo(() => {
    const inDirection = allStatuses.filter((s) => s.debt.direction === direction);
    return {
      original: inDirection.reduce((s, d) => s + d.debt.originalAmount, 0),
      remaining: inDirection.reduce((s, d) => s + d.remaining, 0),
    };
  }, [allStatuses, direction]);

  function openCreate() {
    setEditing(undefined);
    setForm({ ...emptyDebtForm(), direction });
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(debt: Debt) {
    setEditing(debt);
    setForm({
      direction: debt.direction,
      party: debt.party,
      originalAmount: toMajor(debt.originalAmount).toFixed(2),
      dueDate: debt.dueDate ?? '',
      notes: debt.notes ?? '',
    });
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function set<K extends keyof DebtFormState>(key: K, value: DebtFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input: DebtInput = {
      direction: form.direction,
      party: form.party,
      originalAmount: form.originalAmount,
      dueDate: form.dueDate,
      notes: form.notes,
    };
    try {
      if (editing) updateDebt(editing.id, input);
      else addDebt(input);
      toast(editing ? 'Debt updated.' : 'Debt added.', 'success');
      setFormOpen(false);
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(err.fields as Partial<Record<keyof DebtFormState, string>>);
        setFormError('Please fix the highlighted fields.');
      } else {
        setFormError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    }
  }

  function openPayment(debt: Debt) {
    setPayFor(debt);
    setPayForm({ date: todayISO(), amount: '', notes: '' });
    setPayLinked(false);
    setPayErrors({});
    setPayError(null);
  }

  function onPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payFor) return;
    setPayError(null);
    try {
      addDebtPayment(payFor.id, payForm, { recordInLedger: payLinked });
      toast(
        payLinked ? 'Payment recorded and added to the ledger.' : 'Payment recorded (ledger unchanged).',
        'success',
      );
      setPayFor(undefined);
    } catch (err) {
      if (err instanceof ValidationError) {
        setPayErrors(err.fields as Partial<Record<keyof PaymentInput, string>>);
        setPayError('Please fix the highlighted fields.');
      } else {
        setPayError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    }
  }

  const payRemaining = (() => {
    if (!payFor) return 0;
    const paid = payFor.payments.reduce((s, p) => s + p.amount, 0);
    return Math.max(payFor.originalAmount - paid, 0);
  })();

  return (
    <div className="page">
      <PageHeader
        jp="借金と貸し"
        title="Debts & Loans"
        description="Money you owe and money owed to you — balances derived from recorded payments."
        actions={
          <Button onClick={openCreate}>
            <Plus size={15} /> Add {direction === 'iOwe' ? 'debt' : 'receivable'}
          </Button>
        }
      />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Debt direction" style={{ maxWidth: 360 }}>
          <button
            type="button"
            className={`segmented-btn ${direction === 'iOwe' ? 'is-active is-expense' : ''}`}
            aria-pressed={direction === 'iOwe'}
            onClick={() => setDirection('iOwe')}
          >
            Money I owe
          </button>
          <button
            type="button"
            className={`segmented-btn ${direction === 'owedToMe' ? 'is-active is-income' : ''}`}
            aria-pressed={direction === 'owedToMe'}
            onClick={() => setDirection('owedToMe')}
          >
            Money owed to me
          </button>
        </div>
        <div className="toolbar-actions">
          <div className="figure">
            <span className="figure-label">Outstanding</span>
            <span className="figure-value">{formatCurrency(totals.remaining, db.settings.currency)}</span>
          </div>
          <div className="figure">
            <span className="figure-label">Original total</span>
            <span className="figure-value">{formatCurrency(totals.original, db.settings.currency)}</span>
          </div>
        </div>
      </div>

      <p className="muted text-sm">
        Debt balances are kept separate from your cash ledger. When you record a payment you can optionally add a
        matching expense to the ledger — it is never done silently, so nothing is double-counted.
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title={direction === 'iOwe' ? 'Nothing owed' : 'Nothing owed to you'}
          description={
            direction === 'iOwe'
              ? 'Add a credit card balance, loan or installment to start tracking repayments.'
              : 'Add money you have lent to someone so you can track collections.'
          }
          action={
            <Button onClick={openCreate}>
              <Plus size={15} /> Add {direction === 'iOwe' ? 'debt' : 'receivable'}
            </Button>
          }
        />
      ) : (
        visible.map((status) => {
          const { debt, paid, remaining, status: debtState } = status;
          const ratio = debt.originalAmount > 0 ? paid / debt.originalAmount : 0;
          return (
            <article className="card" key={debt.id}>
              <div className="card-header">
                <div>
                  <h2>
                    {debt.party}{' '}
                    <Badge tone={STATUS_TONE[debtState]}>{STATUS_LABEL[debtState]}</Badge>
                  </h2>
                  <p>
                    {debt.direction === 'iOwe' ? 'I owe' : 'Owed to me'}
                    {debt.dueDate ? ` · ${relativeDueLabel(debt.dueDate, today)} (${formatDate(debt.dueDate, db.settings.dateFormat)})` : ' · No due date'}
                    {debt.notes ? ` · ${debt.notes}` : ''}
                  </p>
                </div>
                <div className="row-actions">
                  <Button size="sm" variant="accent" onClick={() => openPayment(debt)} disabled={remaining <= 0}>
                    <HandCoins size={14} /> Record payment
                  </Button>
                  <button
                    type="button"
                    className="row-action"
                    onClick={() => openEdit(debt)}
                    aria-label={`Edit ${debt.party}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="row-action is-danger"
                    onClick={() => setConfirming(debt)}
                    aria-label={`Delete ${debt.party}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <Progress
                ratio={ratio}
                label={`Repayment progress for ${debt.party}`}
                valueText={`${formatCurrency(paid, db.settings.currency)} paid of ${formatCurrency(debt.originalAmount, db.settings.currency)}`}
              />
              <ProgressMeta
                left={`${formatCurrency(paid, db.settings.currency)} paid`}
                right={`${formatPercentText(ratio)}`}
              />

              <div className="list-row-figures" style={{ marginTop: 'var(--spacing-md)' }}>
                <div className="figure">
                  <span className="figure-label">Original</span>
                  <span className="figure-value">{formatCurrency(debt.originalAmount, db.settings.currency)}</span>
                </div>
                <div className="figure">
                  <span className="figure-label">Paid</span>
                  <span className="figure-value amount-income">{formatCurrency(paid, db.settings.currency)}</span>
                </div>
                <div className="figure">
                  <span className="figure-label">Remaining</span>
                  <span className={`figure-value ${remaining <= 0 ? 'amount-income' : ''}`}>
                    {formatCurrency(remaining, db.settings.currency)}
                  </span>
                </div>
              </div>

              {debt.payments.length > 0 && (
                <>
                  <hr className="divider" />
                  <h3 className="text-sm" style={{ marginBottom: 'var(--spacing-sm)' }}>
                    Payment history
                  </h3>
                  <div className="table-wrap" style={{ boxShadow: 'none' }}>
                    <table className="data-table" style={{ minWidth: 480 }}>
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col" className="num">
                            Amount
                          </th>
                          <th scope="col">Notes</th>
                          <th scope="col">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...debt.payments]
                          .sort((a, b) => (a.date < b.date ? 1 : -1))
                          .map((p) => (
                            <tr key={p.id}>
                              <td className="mono-num">{formatDate(p.date, db.settings.dateFormat)}</td>
                              <td className="num amount-income">{formatCurrency(p.amount, db.settings.currency)}</td>
                              <td className="muted">{p.notes || '—'}</td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="row-action is-danger"
                                    aria-label={`Delete payment on ${p.date}`}
                                    onClick={() => {
                                      deleteDebtPayment(debt.id, p.id);
                                      toast('Payment removed.', 'success');
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </article>
          );
        })
      )}

      {/* ---------- Debt form ---------- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit debt' : 'Add debt'}
        description="Remaining balance is always calculated from recorded payments."
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="debt-form">
              {editing ? 'Save changes' : 'Add debt'}
            </Button>
          </>
        }
      >
        <form id="debt-form" onSubmit={onSubmit} noValidate>
          {formError && (
            <div className="form-alert form-alert-error" role="alert">
              {formError}
            </div>
          )}
          <div className="form-grid">
            <SelectField
              label="Direction"
              required
              value={form.direction}
              onChange={(v) => set('direction', v as DebtDirection)}
              options={[
                { value: 'iOwe', label: 'Money I owe' },
                { value: 'owedToMe', label: 'Money owed to me' },
              ]}
            />
            <Field label={form.direction === 'iOwe' ? 'Creditor' : 'Debtor'} required error={errors.party}>
              {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
                <Input
                  id={id}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  value={form.party}
                  onChange={(e) => set('party', e.target.value)}
                  placeholder="e.g. Metrobank, Juan Dela Cruz"
                  maxLength={80}
                  required
                />
              )}
            </Field>
            <Field label="Original amount (PHP)" required error={errors.originalAmount}>
              {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
                <Input
                  id={id}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  inputMode="decimal"
                  value={form.originalAmount}
                  onChange={(e) => set('originalAmount', e.target.value)}
                  placeholder="15000.00"
                  required
                />
              )}
            </Field>
            <Field label="Due date (optional)" error={errors.dueDate}>
              {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
                <Input
                  id={id}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => set('dueDate', e.target.value)}
                />
              )}
            </Field>
            <Field label="Notes (optional)" error={errors.notes} className="field-full">
              {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
                <Textarea
                  id={id}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  maxLength={300}
                />
              )}
            </Field>
          </div>
        </form>
      </Modal>

      {/* ---------- Payment form ---------- */}
      <Modal
        open={Boolean(payFor)}
        onClose={() => setPayFor(undefined)}
        title={payFor ? `Record payment — ${payFor.party}` : 'Record payment'}
        description={
          payFor
            ? `Remaining balance: ${formatCurrency(payRemaining, db.settings.currency)}. Payments cannot exceed it.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setPayFor(undefined)}>
              Cancel
            </Button>
            <Button type="submit" form="payment-form">
              Record payment
            </Button>
          </>
        }
      >
        <form id="payment-form" onSubmit={onPaymentSubmit} noValidate>
          {payError && (
            <div className="form-alert form-alert-error" role="alert">
              {payError}
            </div>
          )}
          <div className="form-grid">
            <Field label="Date" required error={payErrors.date}>
              {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
                <Input
                  id={id}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  type="date"
                  value={payForm.date}
                  onChange={(e) => setPayForm((p) => ({ ...p, date: e.target.value }))}
                  required
                />
              )}
            </Field>
            <Field label="Amount (PHP)" required error={payErrors.amount}>
              {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
                <Input
                  id={id}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  inputMode="decimal"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder={(payRemaining / 100).toFixed(2)}
                  required
                />
              )}
            </Field>
            <Field label="Notes (optional)" error={payErrors.notes} className="field-full">
              {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
                <Input
                  id={id}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  value={payForm.notes ?? ''}
                  onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
                  maxLength={200}
                />
              )}
            </Field>
          </div>

          <label className="checkline">
            <input
              type="checkbox"
              checked={payLinked}
              onChange={(e) => setPayLinked(e.target.checked)}
            />
            <span>
              Also add this payment to the cash ledger as an expense (category <strong>Debt Payment</strong>).
            </span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete debt?"
        message={`“${confirming?.party ?? ''}” and its payment history will be removed. Ledger transactions are unaffected.`}
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => {
          if (!confirming) return;
          deleteDebt(confirming.id);
          setConfirming(undefined);
          toast('Debt deleted.', 'success');
        }}
      />
    </div>
  );
}

function formatPercentText(ratio: number): string {
  return `${(Math.max(0, ratio) * 100).toFixed(0)}% repaid`;
}
