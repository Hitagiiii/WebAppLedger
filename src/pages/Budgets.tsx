import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Field, Input, SelectField, Textarea } from '../components/ui/Field';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { Badge, EmptyState, Progress, ProgressMeta } from '../components/ui/Indicators';
import { useLedger } from '../context/LedgerContext';
import { useToast } from '../context/ToastContext';
import type { Budget, BudgetPeriod } from '../types';
import { budgetStatus, currentMonthKey, currentYearKey, toMajor } from '../utils/finance';
import { formatCurrency, formatMonthLabel, formatPercent } from '../utils/format';
import { ValidationError, type BudgetInput } from '../utils/validate';

interface FormState {
  categoryId: string;
  period: BudgetPeriod;
  periodKey: string;
  limit: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  categoryId: '',
  period: 'monthly',
  periodKey: currentMonthKey(),
  limit: '',
  notes: '',
});

function toForm(budget: Budget): FormState {
  return {
    categoryId: budget.categoryId,
    period: budget.period,
    periodKey: budget.periodKey,
    limit: toMajor(budget.limit).toFixed(2),
    notes: budget.notes ?? '',
  };
}

function periodLabel(period: BudgetPeriod, key: string): string {
  return period === 'monthly' ? formatMonthLabel(key) : `Year ${key}`;
}

export default function Budgets() {
  const { db, addBudget, updateBudget, deleteBudget } = useLedger();
  const { toast } = useToast();

  const [periodFilter, setPeriodFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | undefined>();
  const [confirming, setConfirming] = useState<Budget | undefined>();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const expenseCategories = useMemo(() => db.categories.filter((c) => c.type === 'expense'), [db.categories]);
  const categoryById = useMemo(() => new Map(db.categories.map((c) => [c.id, c])), [db.categories]);

  const statuses = useMemo(
    () =>
      db.budgets
        .map((budget) => budgetStatus(budget, db.transactions, categoryById.get(budget.categoryId)))
        .sort((a, b) => b.ratio - a.ratio),
    [db.budgets, db.transactions, categoryById],
  );

  const periodOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const b of db.budgets) keys.add(`${b.period}:${b.periodKey}`);
    return [...keys]
      .sort()
      .reverse()
      .map((k) => {
        const [period, key] = k.split(':') as [BudgetPeriod, string];
        return { value: k, label: periodLabel(period, key) };
      });
  }, [db.budgets]);

  const visible = statuses.filter((s) => periodFilter === 'all' || `${s.budget.period}:${s.budget.periodKey}` === periodFilter);

  // Headline: budgets for the current month only.
  const currentMonthStatuses = statuses.filter(
    (s) => s.budget.period === 'monthly' && s.budget.periodKey === currentMonthKey(),
  );
  const totalLimit = currentMonthStatuses.reduce((s, b) => s + b.budget.limit, 0);
  const totalSpent = currentMonthStatuses.reduce((s, b) => s + b.spent, 0);

  function openCreate() {
    setEditing(undefined);
    setForm({ ...emptyForm(), categoryId: expenseCategories[0]?.id ?? '' });
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(budget: Budget) {
    setEditing(budget);
    setForm(toForm(budget));
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const input: BudgetInput = {
        categoryId: form.categoryId,
        period: form.period,
        periodKey: form.periodKey,
        limit: form.limit,
        notes: form.notes,
      };
      if (editing) updateBudget(editing.id, input);
      else addBudget(input);
      toast(editing ? 'Budget updated.' : 'Budget created.', 'success');
      setFormOpen(false);
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
    <div className="page">
      <PageHeader
        jp="予算"
        title="Budgets"
        description="Spending limits per category and period, measured against real expense transactions."
        actions={
          <Button onClick={openCreate}>
            <Plus size={15} /> New budget
          </Button>
        }
      />

      <div className="grid grid-kpi">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">This month’s limits</span>
            <span className="kpi-icon">
              <Wallet size={17} />
            </span>
          </div>
          <div className="kpi-value">{formatCurrency(totalLimit, db.settings.currency)}</div>
          <div className="kpi-sub">{currentMonthStatuses.length} active budget(s)</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Spent so far</span>
            <span className="kpi-icon">
              <Wallet size={17} />
            </span>
          </div>
          <div className="kpi-value">{formatCurrency(totalSpent, db.settings.currency)}</div>
          <div className={`kpi-sub ${totalSpent > totalLimit ? 'is-negative' : ''}`}>
            {totalLimit > 0 ? `${formatPercent(totalSpent / totalLimit)} of limits` : 'No limits set'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Remaining</span>
            <span className="kpi-icon">
              <Wallet size={17} />
            </span>
          </div>
          <div className={`kpi-value ${totalLimit - totalSpent < 0 ? 'amount-expense' : ''}`}>
            {formatCurrency(totalLimit - totalSpent, db.settings.currency)}
          </div>
          <div className="kpi-sub">Across this month’s budgets</div>
        </div>
      </div>

      <div className="toolbar">
        <SelectField
          label="Show period"
          value={periodFilter}
          onChange={setPeriodFilter}
          options={[{ value: 'all', label: 'All periods' }, ...periodOptions]}
        />
        <div className="toolbar-actions">
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {visible.length} budget(s)
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No budgets yet"
          description="Create a monthly spending limit for a category — the ledger will measure it automatically."
          action={
            <Button onClick={openCreate}>
              <Plus size={15} /> New budget
            </Button>
          }
        />
      ) : (
        <div className="card">
          {visible.map((status) => (
            <div className="list-row" key={status.budget.id}>
              <div className="list-row-main">
                <div className="list-row-title">
                  <span
                    className="legend-dot"
                    style={{ backgroundColor: status.color }}
                    aria-hidden="true"
                  />
                  {status.categoryName}
                  <Badge tone="neutral">{periodLabel(status.budget.period, status.budget.periodKey)}</Badge>
                  {status.exceeded && <Badge tone="error">Exceeded</Badge>}
                  {!status.exceeded && status.ratio >= 0.85 && <Badge tone="warning">Near limit</Badge>}
                </div>
                <div className="list-row-sub">
                  Limit {formatCurrency(status.budget.limit, db.settings.currency)}
                  {status.budget.notes ? ` · ${status.budget.notes}` : ''}
                </div>
                <div className="list-row-progress" style={{ marginTop: 8 }}>
                  <Progress
                    ratio={status.ratio}
                    label={`${status.categoryName} budget usage`}
                    valueText={`${formatCurrency(status.spent, db.settings.currency)} spent of ${formatCurrency(status.budget.limit, db.settings.currency)}`}
                  />
                  <ProgressMeta
                    left={`${formatCurrency(status.spent, db.settings.currency)} spent`}
                    right={`${formatPercent(status.ratio)} used`}
                  />
                </div>
              </div>

              <div className="list-row-figures">
                <div className="figure">
                  <span className="figure-label">Spent</span>
                  <span className="figure-value">{formatCurrency(status.spent, db.settings.currency)}</span>
                </div>
                <div className="figure">
                  <span className="figure-label">Remaining</span>
                  <span className={`figure-value ${status.remaining < 0 ? 'amount-expense' : ''}`}>
                    {formatCurrency(status.remaining, db.settings.currency)}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="row-action"
                    onClick={() => openEdit(status.budget)}
                    aria-label={`Edit budget for ${status.categoryName}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="row-action is-danger"
                    onClick={() => setConfirming(status.budget)}
                    aria-label={`Delete budget for ${status.categoryName}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Create / edit ---------- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit budget' : 'New budget'}
        description="Only expenses in this category and period count toward the limit."
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="budget-form">
              {editing ? 'Save changes' : 'Create budget'}
            </Button>
          </>
        }
      >
        <form id="budget-form" onSubmit={onSubmit} noValidate>
          {formError && (
            <div className="form-alert form-alert-error" role="alert">
              {formError}
            </div>
          )}
          <div className="form-grid">
            <SelectField
              label="Category"
              required
              error={errors.categoryId}
              value={form.categoryId}
              onChange={(v) => set('categoryId', v)}
              placeholder="Select an expense category"
              options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectField
              label="Period"
              required
              value={form.period}
              onChange={(v) => {
                const period = v as BudgetPeriod;
                setForm((prev) => ({
                  ...prev,
                  period,
                  periodKey: period === 'monthly' ? currentMonthKey() : currentYearKey(),
                }));
              }}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
              ]}
            />
            <Field label={form.period === 'monthly' ? 'Month' : 'Year'} required error={errors.periodKey}>
              {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) =>
                form.period === 'monthly' ? (
                  <Input
                    id={id}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    type="month"
                    value={form.periodKey}
                    onChange={(e) => set('periodKey', e.target.value)}
                    required
                  />
                ) : (
                  <Input
                    id={id}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    type="number"
                    min={2000}
                    max={2100}
                    value={form.periodKey}
                    onChange={(e) => set('periodKey', e.target.value)}
                    required
                  />
                )
              }
            </Field>
            <Field label="Spending limit (PHP)" required error={errors.limit}>
              {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
                <Input
                  id={id}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  inputMode="decimal"
                  placeholder="12000.00"
                  value={form.limit}
                  onChange={(e) => set('limit', e.target.value)}
                  required
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
                  placeholder="e.g. Keep takeout under control"
                />
              )}
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete budget?"
        message={`The budget for ${confirming ? periodLabel(confirming.period, confirming.periodKey) : ''} (${
          confirming ? categoryById.get(confirming.categoryId)?.name : ''
        }) will be removed. Transactions are not affected.`}
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => {
          if (!confirming) return;
          deleteBudget(confirming.id);
          setConfirming(undefined);
          toast('Budget deleted.', 'success');
        }}
      />
    </div>
  );
}
