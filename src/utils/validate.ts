// ============================================
// Validation for every mutable entity.
// Returns a map of field -> message; an empty map means valid.
// Kept independent of the UI so tests can exercise it directly.
// ============================================

import type { Account, AccountGroup, Budget, Database, Debt, SavingsGoal, Transaction } from '../types';
import { isDateStr } from './finance';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** Thrown by LedgerContext actions when input fails validation. */
export class ValidationError<T = Record<string, string>> extends Error {
  readonly fields: FieldErrors<T>;

  constructor(fields: FieldErrors<T>) {
    super(Object.values(fields).join(' ') || 'Invalid input');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/** Raw user input for a transaction form (amount is in major units). */
export interface TransactionInput {
  date: string;
  description: string;
  type: 'income' | 'expense';
  category: string;
  /** major units, e.g. 450.50 */
  amount: string;
  paymentMethod: string;
  /** Account id from Database.accounts */
  account: string;
  reference?: string;
  notes?: string;
}

export interface TransactionValidationOptions {
  /**
   * Account id the transaction already belongs to (edit flows). When the
   * chosen account is archived it is only accepted if it matches this id,
   * so historical records stay editable without reopening the account.
   */
  previousAccountId?: string;
}

export function validateTransactionInput(
  input: TransactionInput,
  db: Pick<Database, 'categories' | 'paymentMethods' | 'accounts'>,
  options?: TransactionValidationOptions,
): FieldErrors<TransactionInput> {
  const errors: FieldErrors<TransactionInput> = {};

  if (!input.date || !isDateStr(input.date)) {
    errors.date = 'A valid transaction date is required.';
  }

  const description = input.description.trim();
  if (!description) {
    errors.description = 'Description is required.';
  } else if (description.length > 120) {
    errors.description = 'Description must be 120 characters or fewer.';
  }

  if (input.type !== 'income' && input.type !== 'expense') {
    errors.type = 'Transaction type must be income or expense.';
  }

  const amountRaw = input.amount.trim();
  if (!amountRaw) {
    errors.amount = 'Amount is required.';
  } else if (!/^\d+(\.\d{1,2})?$/.test(amountRaw)) {
    errors.amount = 'Enter a positive amount with at most 2 decimal places.';
  } else if (Number(amountRaw) <= 0) {
    errors.amount = 'Amount must be greater than zero.';
  } else if (Number(amountRaw) > 1_000_000_000) {
    errors.amount = 'Amount is too large.';
  }

  const category = db.categories.find((c) => c.id === input.category);
  if (!category) {
    errors.category = 'Select a category.';
  } else if (category.type !== input.type) {
    errors.category = `“${category.name}” is not valid for a ${input.type} transaction.`;
  }

  if (!db.paymentMethods.some((p) => p.id === input.paymentMethod)) {
    errors.paymentMethod = 'Select a payment method.';
  }

  const account = db.accounts.find((a) => a.id === input.account);
  if (!account) {
    errors.account = 'Select an account.';
  } else if (account.archived && input.account !== options?.previousAccountId) {
    errors.account = `“${account.name}” is archived. Restore it on the Accounts page, or pick another account.`;
  }

  if (input.reference && input.reference.length > 60) {
    errors.reference = 'Reference must be 60 characters or fewer.';
  }
  if (input.notes && input.notes.length > 500) {
    errors.notes = 'Notes must be 500 characters or fewer.';
  }

  return errors;
}

export interface BudgetInput {
  categoryId: string;
  period: 'monthly' | 'yearly';
  periodKey: string;
  limit: string;
  notes?: string;
}

export function validateBudgetInput(
  input: BudgetInput,
  db: Pick<Database, 'categories'>,
): FieldErrors<BudgetInput> {
  const errors: FieldErrors<BudgetInput> = {};
  const category = db.categories.find((c) => c.id === input.categoryId);
  if (!category) errors.categoryId = 'Select a category.';
  else if (category.type !== 'expense') errors.categoryId = 'Budgets apply to expense categories only.';

  if (input.period === 'monthly' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.periodKey)) {
    errors.periodKey = 'Select a valid month.';
  }
  if (input.period === 'yearly' && !/^\d{4}$/.test(input.periodKey)) {
    errors.periodKey = 'Select a valid year.';
  }

  const limitRaw = input.limit.trim();
  if (!limitRaw) errors.limit = 'Spending limit is required.';
  else if (!/^\d+(\.\d{1,2})?$/.test(limitRaw)) errors.limit = 'Enter a positive limit with at most 2 decimals.';
  else if (Number(limitRaw) <= 0) errors.limit = 'Spending limit must be greater than zero.';

  if (input.notes && input.notes.length > 300) errors.notes = 'Notes must be 300 characters or fewer.';
  return errors;
}

export interface GoalInput {
  title: string;
  description?: string;
  target: string;
  saved: string;
  deadline?: string;
}

export function validateGoalInput(input: GoalInput): FieldErrors<GoalInput> {
  const errors: FieldErrors<GoalInput> = {};
  const title = input.title.trim();
  if (!title) errors.title = 'Goal name is required.';
  else if (title.length > 80) errors.title = 'Goal name must be 80 characters or fewer.';

  const targetRaw = input.target.trim();
  if (!targetRaw) errors.target = 'Target amount is required.';
  else if (!/^\d+(\.\d{1,2})?$/.test(targetRaw)) errors.target = 'Enter a positive target with at most 2 decimals.';
  else if (Number(targetRaw) <= 0) errors.target = 'Target amount must be greater than zero.';

  const savedRaw = input.saved.trim();
  if (savedRaw === '') errors.saved = 'Current saved amount is required (use 0 if none yet).';
  else if (!/^\d+(\.\d{1,2})?$/.test(savedRaw)) errors.saved = 'Enter a non-negative amount with at most 2 decimals.';
  else if (Number(savedRaw) < 0) errors.saved = 'Saved amount cannot be negative.';

  if (input.deadline && !isDateStr(input.deadline)) errors.deadline = 'Deadline must be a valid date.';

  if (input.description && input.description.length > 300) errors.description = 'Description must be 300 characters or fewer.';
  return errors;
}

export interface DebtInput {
  direction: 'iOwe' | 'owedToMe';
  party: string;
  originalAmount: string;
  dueDate?: string;
  notes?: string;
}

export function validateDebtInput(input: DebtInput): FieldErrors<DebtInput> {
  const errors: FieldErrors<DebtInput> = {};
  const party = input.party.trim();
  if (!party) errors.party = 'Person or institution is required.';
  else if (party.length > 80) errors.party = 'Name must be 80 characters or fewer.';

  const amountRaw = input.originalAmount.trim();
  if (!amountRaw) errors.originalAmount = 'Amount is required.';
  else if (!/^\d+(\.\d{1,2})?$/.test(amountRaw)) errors.originalAmount = 'Enter a positive amount with at most 2 decimals.';
  else if (Number(amountRaw) <= 0) errors.originalAmount = 'Amount must be greater than zero.';

  if (input.dueDate && !isDateStr(input.dueDate)) errors.dueDate = 'Due date must be a valid date.';
  if (input.notes && input.notes.length > 300) errors.notes = 'Notes must be 300 characters or fewer.';
  return errors;
}

export interface PaymentInput {
  date: string;
  amount: string;
  notes?: string;
}

/** `maxCents` caps payments so debts can never be overpaid. */
export function validatePaymentInput(input: PaymentInput, maxCents: number): FieldErrors<PaymentInput> {
  const errors: FieldErrors<PaymentInput> = {};
  if (!input.date || !isDateStr(input.date)) errors.date = 'A valid date is required.';

  const raw = input.amount.trim();
  if (!raw) errors.amount = 'Amount is required.';
  else if (!/^\d+(\.\d{1,2})?$/.test(raw)) errors.amount = 'Enter a positive amount with at most 2 decimals.';
  else if (Number(raw) <= 0) errors.amount = 'Amount must be greater than zero.';
  else if (Math.round(Number(raw) * 100) > maxCents) {
    errors.amount = `Payment cannot exceed the remaining balance of ${(maxCents / 100).toFixed(2)}.`;
  }
  if (input.notes && input.notes.length > 200) errors.notes = 'Notes must be 200 characters or fewer.';
  return errors;
}

export function hasErrors<T>(errors: FieldErrors<T>): boolean {
  return Object.keys(errors).length > 0;
}

// ---------- Accounts ----------

export interface AccountInput {
  name: string;
  group: AccountGroup;
  /** major units, e.g. 120000.00; empty string means 0 */
  openingBalance: string;
}

/** Suggested starter names shown as quick-picks on the Accounts page. */
export const SUGGESTED_ACCOUNT_NAMES = ['Cash', 'GCash', 'MariBank', 'Bank ATM', 'GoTyme', 'Passbook'] as const;

export function validateAccountInput(
  input: AccountInput,
  existing: Pick<Account, 'id' | 'name'>[],
  exceptId?: string,
): FieldErrors<AccountInput> {
  const errors: FieldErrors<AccountInput> = {};

  const name = input.name.trim();
  if (!name) errors.name = 'Account name is required.';
  else if (name.length > 40) errors.name = 'Account name must be 40 characters or fewer.';
  else if (
    existing.some(
      (a) => a.id !== exceptId && a.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    errors.name = 'An account with that name already exists.';
  }

  if (input.group !== 'held' && input.group !== 'stashed') {
    errors.group = 'Choose “Held” or “Stashed Away”.';
  }

  const raw = input.openingBalance.trim();
  if (raw !== '') {
    if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
      errors.openingBalance = 'Enter a valid amount with at most 2 decimals.';
    } else if (Math.abs(Number(raw)) > 1_000_000_000) {
      errors.openingBalance = 'Starting balance is too large.';
    }
  }

  return errors;
}

// ---------- Backup import validation ----------

export interface BackupValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Structural validation for imported backups before anything is written.
 * Deliberately strict: unknown versions or shapes are rejected wholesale so
 * a bad file can never corrupt existing data.
 * v1 (single-account) and v2 (multi-account) backups are both accepted —
 * v1 files are upgraded by the migration layer after this check passes.
 */
export function validateBackup(data: unknown): BackupValidation {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) {
    return { ok: false, errors: ['Backup must be a JSON object.'] };
  }
  const db = data as Partial<Database>;
  if (db.version !== 1 && db.version !== 2) errors.push(`Unsupported backup version: ${String(db.version)}.`);
  if (!db.settings || typeof db.settings !== 'object') errors.push('Missing settings.');
  if (!Array.isArray(db.transactions)) errors.push('Missing transactions array.');
  if (db.version === 2 && !Array.isArray(db.accounts)) errors.push('Missing accounts array.');
  if (!Array.isArray(db.categories)) errors.push('Missing categories array.');
  if (!Array.isArray(db.paymentMethods)) errors.push('Missing payment methods array.');
  if (!Array.isArray(db.budgets)) errors.push('Missing budgets array.');
  if (!Array.isArray(db.goals)) errors.push('Missing goals array.');
  if (!Array.isArray(db.debts)) errors.push('Missing debts array.');

  if (Array.isArray(db.transactions)) {
    db.transactions.slice(0, 200).forEach((t: Transaction, i: number) => {
      if (!t || typeof t.id !== 'string' || !isDateStr(t.date)) {
        errors.push(`Transaction #${i + 1} is malformed.`);
        return;
      }
      if (t.type !== 'income' && t.type !== 'expense') errors.push(`Transaction #${i + 1} has an invalid type.`);
      if (!Number.isInteger(t.amount) || t.amount <= 0) errors.push(`Transaction #${i + 1} has an invalid amount.`);
      if (typeof t.description !== 'string' || !t.description.trim()) {
        errors.push(`Transaction #${i + 1} is missing a description.`);
      }
    });
    if (db.transactions.length > 200) {
      const bad = db.transactions.slice(200).some(
        (t: Transaction) =>
          !t || typeof t.id !== 'string' || !isDateStr(t.date) || !Number.isInteger(t.amount) || t.amount <= 0,
      );
      if (bad) errors.push('One or more later transactions are malformed.');
    }
  }

  if (Array.isArray(db.budgets)) {
    for (const b of db.budgets as Budget[]) {
      if (!b || typeof b.id !== 'string' || !Number.isInteger(b.limit) || b.limit <= 0) {
        errors.push('One or more budgets are malformed.');
        break;
      }
    }
  }
  if (Array.isArray(db.goals)) {
    for (const g of db.goals as SavingsGoal[]) {
      if (!g || typeof g.id !== 'string' || !Number.isInteger(g.target) || g.target <= 0 || !Number.isInteger(g.saved) || g.saved < 0) {
        errors.push('One or more savings goals are malformed.');
        break;
      }
    }
  }
  if (Array.isArray(db.debts)) {
    for (const d of db.debts as Debt[]) {
      if (!d || typeof d.id !== 'string' || !Number.isInteger(d.originalAmount) || d.originalAmount <= 0 || !Array.isArray(d.payments)) {
        errors.push('One or more debts are malformed.');
        break;
      }
    }
  }

  return { ok: errors.length === 0, errors: errors.slice(0, 8) };
}
