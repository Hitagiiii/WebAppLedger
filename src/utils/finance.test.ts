// ============================================
// Core financial logic tests.
// Amounts in fixtures are centavos unless stated otherwise.
// ============================================

import { describe, expect, it } from 'vitest';

import {
  accountBalance,
  accountBalances,
  budgetStatus,
  categoryBreakdown,
  compareChronological,
  computeBalance,
  computeRunningBalances,
  computeTotals,
  debtStatus,
  filterTransactions,
  goalStatus,
  monthRange,
  monthlySeries,
  previousMonthKey,
  rangeForPeriod,
  savingsRate,
  sortTransactions,
  sumOpeningBalances,
  toCents,
  totalBalance,
} from './finance';
import type { Account, Debt, SavingsGoal, Transaction } from '../types';

let seq = 0;
function txn(partial: Partial<Transaction> & Pick<Transaction, 'date' | 'type' | 'amount'>): Transaction {
  seq += 1;
  const stamp = `${partial.date}T12:00:${String(seq % 60).padStart(2, '0')}.000Z`;
  return {
    id: `t${seq}`,
    description: 'fixture',
    category: partial.type === 'income' ? 'cat-salary' : 'cat-food',
    paymentMethod: 'pm-cash',
    account: 'acct-cash',
    createdAt: stamp,
    updatedAt: stamp,
    ...partial,
  } as Transaction;
}

function account(partial: Partial<Account> & Pick<Account, 'id' | 'name' | 'openingBalance'>): Account {
  return {
    group: 'held',
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('money helpers', () => {
  it('converts pesos to integer centavos without float drift', () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
    expect(toCents(1234.56)).toBe(123456);
    expect(toCents(-45.99)).toBe(-4599);
  });
});

describe('income increases the balance', () => {
  const opening = toCents(1000);

  it('adds income to the balance', () => {
    const txns = [txn({ date: '2026-07-10', type: 'income', amount: toCents(500) })];
    expect(computeBalance(txns, opening)).toBe(toCents(1500));
    expect(computeTotals(txns).net).toBe(toCents(500));
  });
});

describe('expenses decrease the balance', () => {
  const opening = toCents(1000);

  it('subtracts expenses from the balance', () => {
    const txns = [txn({ date: '2026-07-10', type: 'expense', amount: toCents(250.5) })];
    expect(computeBalance(txns, opening)).toBe(toCents(749.5));
    expect(computeTotals(txns).expense).toBe(toCents(250.5));
    expect(computeTotals(txns).income).toBe(0);
  });

  it('handles mixed income and expenses', () => {
    const txns = [
      txn({ date: '2026-07-01', type: 'income', amount: toCents(1000) }),
      txn({ date: '2026-07-02', type: 'expense', amount: toCents(300) }),
      txn({ date: '2026-07-03', type: 'expense', amount: toCents(200) }),
    ];
    const totals = computeTotals(txns);
    expect(totals.income).toBe(toCents(1000));
    expect(totals.expense).toBe(toCents(500));
    expect(totals.net).toBe(toCents(500));
    expect(computeBalance(txns, opening)).toBe(toCents(1500));
  });
});

describe('running balances', () => {
  const opening = toCents(10000);

  it('is calculated chronologically even when displayed newest-first', () => {
    const txns = [
      txn({ date: '2026-07-03', type: 'expense', amount: toCents(500), id: 't3' }),
      txn({ date: '2026-07-01', type: 'income', amount: toCents(2000), id: 't1' }),
      txn({ date: '2026-07-02', type: 'expense', amount: toCents(1000), id: 't2' }),
    ];

    const chrono = computeRunningBalances(txns, opening, false);
    expect(chrono.map((r) => r.transaction.id)).toEqual(['t1', 't2', 't3']);
    expect(chrono.map((r) => r.balance)).toEqual([toCents(12000), toCents(11000), toCents(10500)]);

    const display = computeRunningBalances(txns, opening, true);
    expect(display.map((r) => r.transaction.id)).toEqual(['t3', 't2', 't1']);
    // Same balances, just reversed display order.
    expect(display.map((r) => r.balance)).toEqual([toCents(10500), toCents(11000), toCents(12000)]);
  });

  it('uses a deterministic tie-breaker for identical dates', () => {
    const a = txn({ date: '2026-07-01', type: 'income', amount: toCents(100), id: 'a' });
    const b = txn({ date: '2026-07-01', type: 'income', amount: toCents(200), id: 'b' });
    expect(compareChronological(a, b)).toBeLessThan(0);
    const first = computeRunningBalances([b, a], 0, false);
    expect(first.map((r) => r.transaction.id)).toEqual(['a', 'b']);
    expect(first.map((r) => r.balance)).toEqual([toCents(100), toCents(300)]);
  });
});

describe('editing and deleting transactions recalculate totals', () => {
  const opening = 0;
  const base = txn({ date: '2026-07-01', type: 'income', amount: toCents(1000), id: 'edit-me' });

  it('reflects an edited amount immediately', () => {
    const before = [base];
    expect(computeBalance(before, opening)).toBe(toCents(1000));

    const afterEdit = before.map((t) => (t.id === 'edit-me' ? { ...t, amount: toCents(1500) } : t));
    expect(computeBalance(afterEdit, opening)).toBe(toCents(1500));
    expect(computeTotals(afterEdit).income).toBe(toCents(1500));
  });

  it('reflects a deleted transaction immediately', () => {
    const withTwo = [base, txn({ date: '2026-07-02', type: 'expense', amount: toCents(400), id: 'x' })];
    expect(computeBalance(withTwo, opening)).toBe(toCents(600));

    const afterDelete = withTwo.filter((t) => t.id !== 'x');
    expect(computeBalance(afterDelete, opening)).toBe(toCents(1000));

    // Running balances of the remaining rows are consistent too.
    const rows = computeRunningBalances(afterDelete, opening, false);
    expect(rows[rows.length - 1].balance).toBe(toCents(1000));
  });
});

describe('date and category filters', () => {
  const txns = [
    txn({ date: '2026-06-15', type: 'expense', amount: 100, category: 'cat-food', description: 'June eats' }),
    txn({ date: '2026-07-15', type: 'expense', amount: 200, category: 'cat-bills', description: 'July bills' }),
    txn({ date: '2026-07-20', type: 'income', amount: 300, category: 'cat-salary', description: 'Payday' }),
  ];

  it('filters by inclusive date range', () => {
    const result = filterTransactions(txns, {}, { from: '2026-07-01', to: '2026-07-31' });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.date.startsWith('2026-07'))).toBe(true);
  });

  it('filters by category', () => {
    const result = filterTransactions(txns, { category: 'cat-food' });
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('June eats');
  });

  it('filters by type and search text', () => {
    expect(filterTransactions(txns, { type: 'income' })).toHaveLength(1);
    expect(filterTransactions(txns, { search: 'bills' })).toHaveLength(1);
    expect(filterTransactions(txns, { search: 'nope' })).toHaveLength(0);
  });
});

describe('multi-account model', () => {
  const cash = account({ id: 'acct-cash', name: 'Cash', openingBalance: toCents(1000) });
  const bank = account({ id: 'acct-bank', name: 'Bank', group: 'stashed', openingBalance: toCents(5000) });
  const txns = [
    txn({ date: '2026-07-01', type: 'income', amount: toCents(300), account: 'acct-cash' }),
    txn({ date: '2026-07-02', type: 'expense', amount: toCents(100), account: 'acct-cash' }),
    txn({ date: '2026-07-03', type: 'expense', amount: toCents(2000), account: 'acct-bank' }),
  ];

  it('derives each account balance from its own opening balance and transactions', () => {
    expect(accountBalance(cash, txns.filter((t) => t.account === 'acct-cash'))).toBe(toCents(1200));
    expect(accountBalance(bank, txns.filter((t) => t.account === 'acct-bank'))).toBe(toCents(3000));
  });

  it('never counts the same money twice in the aggregate', () => {
    const rows = accountBalances([cash, bank], txns);
    expect(rows).toHaveLength(2);
    expect(rows[0].balance).toBe(toCents(1200));
    expect(rows[1].balance).toBe(toCents(3000));
    // Aggregate = sum of openings + net of all transactions.
    expect(totalBalance([cash, bank], txns)).toBe(toCents(1200) + toCents(3000));
    expect(totalBalance([cash, bank], txns)).toBe(
      sumOpeningBalances([cash, bank]) + computeTotals(txns).net,
    );
  });

  it('filters by account', () => {
    expect(filterTransactions(txns, { account: 'acct-cash' })).toHaveLength(2);
    expect(filterTransactions(txns, { account: 'acct-bank' })).toHaveLength(1);
    expect(filterTransactions(txns, { account: 'all' })).toHaveLength(3);
  });

  it('recalculates an account after an edit without touching other accounts', () => {
    const edited = txns.map((t) => (t.id === txns[1].id ? { ...t, amount: toCents(400) } : t));
    expect(accountBalance(cash, edited.filter((t) => t.account === 'acct-cash'))).toBe(toCents(900));
    expect(accountBalance(bank, edited.filter((t) => t.account === 'acct-bank'))).toBe(toCents(3000));
  });

  it('recalculates after a deletion', () => {
    const afterDelete = txns.filter((t) => t.id !== txns[2].id);
    expect(accountBalance(bank, afterDelete.filter((t) => t.account === 'acct-bank'))).toBe(toCents(5000));
    expect(totalBalance([cash, bank], afterDelete)).toBe(toCents(1000 + 300 - 100 + 5000));
  });

  it('keeps archived accounts in the aggregate total', () => {
    const archivedBank = { ...bank, archived: true };
    expect(totalBalance([cash, archivedBank], txns)).toBe(toCents(1200) + toCents(3000));
  });
});

describe('monthly income and expense calculations', () => {
  const txns = [
    txn({ date: '2026-07-01', type: 'income', amount: toCents(1000) }),
    txn({ date: '2026-07-31', type: 'expense', amount: toCents(400) }),
    txn({ date: '2026-08-01', type: 'income', amount: toCents(500) }),
    txn({ date: '2026-08-10', type: 'expense', amount: toCents(100) }),
  ];

  it('computes period totals with inclusive month boundaries', () => {
    const july = rangeForPeriod('thisMonth', undefined, new Date('2026-07-15T00:00:00'));
    expect(july).toEqual({ from: '2026-07-01', to: '2026-07-31' });
    const totals = computeTotals(filterTransactions(txns, {}, july));
    expect(totals.income).toBe(toCents(1000));
    expect(totals.expense).toBe(toCents(400));
    expect(totals.net).toBe(toCents(600));
  });

  it('maps the previous month correctly across year boundaries', () => {
    expect(previousMonthKey('2026-01')).toBe('2025-12');
    expect(previousMonthKey('2026-07')).toBe('2026-06');
  });

  it('builds a monthly series with the right per-month values', () => {
    const series = monthlySeries(txns, 3, new Date('2026-08-15T00:00:00'));
    expect(series).toHaveLength(3);
    const july = series.find((p) => p.key === '2026-07');
    const august = series.find((p) => p.key === '2026-08');
    expect(july?.income).toBe(toCents(1000));
    expect(july?.expense).toBe(toCents(400));
    expect(august?.income).toBe(toCents(500));
    expect(august?.net).toBe(toCents(400));
    const june = series.find((p) => p.key === '2026-06');
    expect(june).toMatchObject({ income: 0, expense: 0, net: 0 });
  });

  it('computes savings rate', () => {
    expect(savingsRate({ income: toCents(1000), expense: toCents(250), net: toCents(750), count: 2 })).toBeCloseTo(0.75);
    expect(savingsRate({ income: 0, expense: 100, net: -100, count: 1 })).toBeNull();
  });
});

describe('budget utilization', () => {
  const budget = {
    id: 'b1',
    categoryId: 'cat-food',
    period: 'monthly' as const,
    periodKey: '2026-10',
    limit: toCents(1000),
  };

  it('counts only matching expenses inside the period', () => {
    const txns = [
      txn({ date: '2026-10-05', type: 'expense', amount: toCents(600), category: 'cat-food' }),
      txn({ date: '2026-10-06', type: 'expense', amount: toCents(300), category: 'cat-bills' }), // wrong category
      txn({ date: '2026-11-05', type: 'expense', amount: toCents(900), category: 'cat-food' }), // wrong month
      txn({ date: '2026-10-07', type: 'income', amount: toCents(500), category: 'cat-food' }), // income never counts
    ];
    const status = budgetStatus(budget, txns, { name: 'Food', color: '#fff' });
    expect(status.spent).toBe(toCents(600));
    expect(status.remaining).toBe(toCents(400));
    expect(status.ratio).toBeCloseTo(0.6);
    expect(status.exceeded).toBe(false);
  });

  it('flags overspending and survives a zero limit safely', () => {
    const txns = [txn({ date: '2026-10-05', type: 'expense', amount: toCents(1500), category: 'cat-food' })];
    const status = budgetStatus(budget, txns);
    expect(status.spent).toBe(toCents(1500));
    expect(status.remaining).toBe(toCents(-500));
    expect(status.exceeded).toBe(true);
    expect(status.ratio).toBeCloseTo(1.5);

    // Zero limit: ratio is 0 (nothing to compare against) and remaining is
    // honestly negative rather than silently clamped.
    const zero = budgetStatus({ ...budget, limit: 0 }, txns);
    expect(zero.ratio).toBe(0);
    expect(zero.exceeded).toBe(false);
    expect(zero.remaining).toBe(-toCents(1500));
  });

  it('supports yearly budgets', () => {
    const yearly = { ...budget, period: 'yearly' as const, periodKey: '2026' };
    const txns = [
      txn({ date: '2026-01-15', type: 'expense', amount: toCents(200), category: 'cat-food' }),
      txn({ date: '2026-12-15', type: 'expense', amount: toCents(300), category: 'cat-food' }),
    ];
    expect(budgetStatus(yearly, txns).spent).toBe(toCents(500));
  });
});

describe('savings goal progress', () => {
  const base: SavingsGoal = {
    id: 'g1',
    title: 'Trip',
    target: toCents(10000),
    saved: toCents(2500),
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('computes remaining and percentage', () => {
    const status = goalStatus(base, new Date('2026-10-01T00:00:00'));
    expect(status.remaining).toBe(toCents(7500));
    expect(status.ratio).toBeCloseTo(0.25);
    expect(status.status).toBe('active');
  });

  it('marks completed goals', () => {
    expect(goalStatus({ ...base, saved: toCents(10000) }).status).toBe('completed');
  });

  it('marks overdue and due-soon deadlines', () => {
    expect(goalStatus({ ...base, deadline: '2026-09-01' }, new Date('2026-10-01T00:00:00')).status).toBe('overdue');
    expect(goalStatus({ ...base, deadline: '2026-10-05' }, new Date('2026-10-01T00:00:00')).status).toBe('dueSoon');
    expect(goalStatus({ ...base, deadline: '2027-06-01' }, new Date('2026-10-01T00:00:00')).status).toBe('active');
  });
});

describe('debt payments update remaining balances', () => {
  const debt: Debt = {
    id: 'd1',
    direction: 'iOwe',
    party: 'Bank',
    originalAmount: toCents(15000),
    createdAt: '2026-01-01T00:00:00.000Z',
    payments: [
      { id: 'p1', date: '2026-05-01', amount: toCents(4000) },
      { id: 'p2', date: '2026-06-01', amount: toCents(3000) },
    ],
  };

  it('derives remaining from payments, not an editable field', () => {
    const status = debtStatus(debt, new Date('2026-10-01T00:00:00'));
    expect(status.paid).toBe(toCents(7000));
    expect(status.remaining).toBe(toCents(8000));
    expect(status.status).toBe('open');
  });

  it('settles when fully paid and flags overdue debts', () => {
    const paid = { ...debt, payments: [{ id: 'p1', date: '2026-05-01', amount: toCents(15000) }] };
    expect(debtStatus(paid).status).toBe('settled');

    const overdue = { ...debt, dueDate: '2026-09-01' };
    expect(debtStatus(overdue, new Date('2026-10-01T00:00:00')).status).toBe('overdue');
  });
});

describe('category breakdown', () => {
  it('groups expenses and computes shares', () => {
    const txns = [
      txn({ date: '2026-10-01', type: 'expense', amount: toCents(750), category: 'cat-food' }),
      txn({ date: '2026-10-02', type: 'expense', amount: toCents(250), category: 'cat-bills' }),
      txn({ date: '2026-10-03', type: 'income', amount: toCents(9999), category: 'cat-salary' }),
    ];
    const categories = [
      { id: 'cat-food', name: 'Food', color: '#f00' },
      { id: 'cat-bills', name: 'Bills', color: '#0f0' },
    ];
    const slices = categoryBreakdown(txns, 'expense', categories, rangeForPeriod('thisMonth', undefined, new Date('2026-10-05T00:00:00')));
    expect(slices).toHaveLength(2);
    expect(slices[0].name).toBe('Food');
    expect(slices[0].amount).toBe(toCents(750));
    expect(slices[0].percent).toBeCloseTo(75);
    expect(slices[1].percent).toBeCloseTo(25);
  });
});

describe('sorting', () => {
  it('sorts by signed amount and date deterministically', () => {
    const txns = [
      txn({ date: '2026-07-02', type: 'expense', amount: toCents(500) }),
      txn({ date: '2026-07-01', type: 'income', amount: toCents(100) }),
      txn({ date: '2026-07-03', type: 'income', amount: toCents(700) }),
    ];
    const byAmount = sortTransactions(txns, 'amount', 'desc');
    expect(byAmount.map((t) => t.amount)).toEqual([toCents(700), toCents(100), toCents(500)]);

    const byDate = sortTransactions(txns, 'date', 'asc');
    expect(byDate.map((t) => t.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });
});

describe('month range helper', () => {
  it('handles leap years', () => {
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});
