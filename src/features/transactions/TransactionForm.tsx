import { useEffect, useState } from 'react';

import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, Input, SelectField, Textarea } from '../../components/ui/Field';
import { useLedger } from '../../context/LedgerContext';
import { useToast } from '../../context/ToastContext';
import type { Transaction } from '../../types';
import { toMajor } from '../../utils/finance';
import { ValidationError, type TransactionInput } from '../../utils/validate';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  /** When present the form edits this transaction, otherwise it creates one. */
  initial?: Transaction;
  onSaved?: (txn: Transaction) => void;
  /** Preselect a type (used by dashboard quick actions). */
  defaultType?: 'income' | 'expense';
  /** Preselect a date (used by the calendar page). */
  defaultDate?: string;
}

type FormState = TransactionInput;

function toFormState(txn: Transaction): FormState {
  return {
    date: txn.date,
    description: txn.description,
    type: txn.type,
    category: txn.category,
    amount: toMajor(txn.amount).toFixed(2),
    paymentMethod: txn.paymentMethod,
    account: txn.account,
    reference: txn.reference ?? '',
    notes: txn.notes ?? '',
  };
}

const EMPTY: FormState = {
  date: new Date().toISOString().slice(0, 10),
  description: '',
  type: 'expense',
  category: '',
  amount: '',
  paymentMethod: 'pm-cash',
  account: '',
  reference: '',
  notes: '',
};

export default function TransactionForm({
  open,
  onClose,
  initial,
  onSaved,
  defaultType,
  defaultDate,
}: TransactionFormProps) {
  const { db, addTransaction, updateTransaction } = useLedger();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    if (initial) {
      setForm(toFormState(initial));
    } else {
      const firstActive = db.accounts.find((a) => !a.archived)?.id ?? '';
      setForm({
        ...EMPTY,
        type: defaultType ?? 'expense',
        date: defaultDate ?? EMPTY.date,
        // Sensible defaults keep the common path quick.
        category: defaultType === 'income' ? 'cat-salary' : 'cat-food',
        paymentMethod: db.paymentMethods[0]?.id ?? 'pm-cash',
        account: firstActive,
      });
    }
  }, [open, initial, defaultType, defaultDate, db.paymentMethods, db.accounts]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // Keep category valid when the type toggles.
  useEffect(() => {
    const cat = db.categories.find((c) => c.id === form.category);
    if (cat && cat.type !== form.type) {
      const fallback = db.categories.find((c) => c.type === form.type);
      if (fallback) setForm((prev) => ({ ...prev, category: fallback.id }));
    }
  }, [form.type, form.category, db.categories]);

  const categoryOptions = db.categories
    .filter((c) => c.type === form.type)
    .map((c) => ({ value: c.id, label: c.name }));
  const paymentOptions = db.paymentMethods.map((p) => ({ value: p.id, label: p.name }));
  // Archived accounts can't receive NEW money, but stay selectable when
  // editing a historical transaction that already belongs to them.
  const accountOptions = db.accounts
    .filter((a) => !a.archived || a.id === form.account)
    .map((a) => ({
      value: a.id,
      label: a.archived ? `${a.name} (archived)` : a.name,
    }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const saved = initial ? updateTransaction(initial.id, form) : addTransaction(form);
      toast(initial ? 'Transaction updated.' : 'Transaction added.', 'success');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(err.fields as Partial<Record<keyof FormState, string>>);
        setFormError('Please fix the highlighted fields.');
      } else {
        setFormError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    }
  }

  return (
      <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit transaction' : 'Add transaction'}
      description="Income credits the chosen account; expenses debit it."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="transaction-form">
            {initial ? 'Save changes' : 'Add transaction'}
          </Button>
        </>
      }
    >
      <form id="transaction-form" onSubmit={onSubmit} noValidate>
        {formError && (
          <div className="form-alert form-alert-error" role="alert">
            {formError}
          </div>
        )}

        <div className="form-grid">
          <Field label="Type" required>
            {({ id }) => (
              <div className="segmented" id={id} role="radiogroup" aria-label="Transaction type">
                <button
                  type="button"
                  className={`segmented-btn ${form.type === 'income' ? 'is-active is-income' : ''}`}
                  aria-pressed={form.type === 'income'}
                  onClick={() => set('type', 'income')}
                >
                  Income
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${form.type === 'expense' ? 'is-active is-expense' : ''}`}
                  aria-pressed={form.type === 'expense'}
                  onClick={() => set('type', 'expense')}
                >
                  Expense
                </button>
              </div>
            )}
          </Field>

          <Field label="Date" required error={errors.date}>
            {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
              <Input
                id={id}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                required
              />
            )}
          </Field>

          <Field label="Description" required error={errors.description}>
            {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
              <Input
                id={id}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                placeholder={form.type === 'income' ? 'e.g. Freelance logo design' : 'e.g. Lunch at Ramen House'}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                maxLength={120}
                required
              />
            )}
          </Field>

          <Field label="Amount (PHP)" required error={errors.amount}>
            {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
              <Input
                id={id}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                required
              />
            )}
          </Field>

          <SelectField
            label="Category"
            required
            error={errors.category}
            options={categoryOptions}
            value={form.category}
            onChange={(v) => set('category', v)}
            placeholder="Select a category"
          />

          <SelectField
            label="Payment method"
            required
            error={errors.paymentMethod}
            options={paymentOptions}
            value={form.paymentMethod}
            onChange={(v) => set('paymentMethod', v)}
            placeholder="Select a payment method"
          />

          <SelectField
            label="Account"
            required
            error={errors.account}
            options={accountOptions}
            value={form.account}
            onChange={(v) => set('account', v)}
            placeholder={accountOptions.length === 0 ? 'No accounts available' : 'Select an account'}
            hint={
              accountOptions.length === 0
                ? 'Create an account on the Accounts page first.'
                : undefined
            }
          />

          <Field label="Reference (optional)" error={errors.reference}>
            {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
              <Input
                id={id}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                placeholder="Receipt / reference no."
                value={form.reference}
                onChange={(e) => set('reference', e.target.value)}
                maxLength={60}
              />
            )}
          </Field>

          <Field label="Notes (optional)" error={errors.notes} className="field-full">
            {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
              <Textarea
                id={id}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                placeholder="Anything worth remembering…"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                maxLength={500}
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
