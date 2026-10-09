// ============================================
// In-app notifications derived strictly from real data:
// exceeded budgets, overdue/due-soon debts, and goal deadlines.
// Nothing here is fabricated — if no condition applies, the list is empty.
// ============================================

import type { Database } from '../types';
import { budgetStatus, daysBetween, debtStatus, goalStatus, toISODate } from './finance';

export interface DerivedNotification {
  id: string;
  tone: 'warning' | 'error' | 'success' | 'info';
  title: string;
  message: string;
}

export function deriveNotifications(db: Database, now: Date = new Date()): DerivedNotification[] {
  const items: DerivedNotification[] = [];
  const today = toISODate(now);
  const catById = new Map(db.categories.map((c) => [c.id, c]));

  for (const budget of db.budgets) {
    const status = budgetStatus(budget, db.transactions, catById.get(budget.categoryId));
    if (status.exceeded) {
      items.push({
        id: `budget-${budget.id}`,
        tone: 'error',
        title: 'Budget exceeded',
        message: `${status.categoryName} is over its ${budget.periodKey} limit by ₱${(
          (status.spent - status.budget.limit) / 100
        ).toFixed(2)}.`,
      });
    } else if (status.ratio >= 0.85 && status.budget.limit > 0) {
      items.push({
        id: `budget-warn-${budget.id}`,
        tone: 'warning',
        title: 'Budget warning',
        message: `${Math.round(status.ratio * 100)}% of the ${status.categoryName} budget for ${budget.periodKey} is used.`,
      });
    }
  }

  for (const debt of db.debts) {
    const status = debtStatus(debt, now);
    if (status.status === 'overdue') {
      items.push({
        id: `debt-${debt.id}`,
        tone: 'error',
        title: debt.direction === 'iOwe' ? 'Payment overdue' : 'Collection overdue',
        message: `${debt.party} — ${(status.remaining / 100).toFixed(2)} PHP, due ${debt.dueDate}.`,
      });
    } else if (status.status === 'dueSoon' && debt.dueDate) {
      items.push({
        id: `debt-soon-${debt.id}`,
        tone: 'warning',
        title: 'Payment due soon',
        message: `${debt.party} — due ${daysBetween(today, debt.dueDate) <= 0 ? 'today' : `in ${daysBetween(today, debt.dueDate)} day(s)`}.`,
      });
    }
  }

  for (const goal of db.goals) {
    const status = goalStatus(goal, now);
    if (status.status === 'completed') {
      items.push({
        id: `goal-done-${goal.id}`,
        tone: 'success',
        title: 'Goal reached',
        message: `You fully funded “${goal.title}”.`,
      });
    } else if (status.status === 'overdue') {
      items.push({
        id: `goal-late-${goal.id}`,
        tone: 'error',
        title: 'Goal deadline passed',
        message: `“${goal.title}” missed its ${goal.deadline} deadline.`,
      });
    } else if (status.status === 'dueSoon' && status.remaining > 0) {
      items.push({
        id: `goal-soon-${goal.id}`,
        tone: 'warning',
        title: 'Goal deadline approaching',
        message: `“${goal.title}” is due ${goal.deadline} — ₱${(status.remaining / 100).toFixed(2)} to go.`,
      });
    }
  }

  return items;
}
