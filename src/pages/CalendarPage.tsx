import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Indicators';
import { useLedger } from '../context/LedgerContext';
import type { Debt } from '../types';
import { debtStatus, goalStatus, todayISO, toISODate } from '../utils/finance';
import { formatDate, formatCurrency, relativeDueLabel } from '../utils/format';

type EventKind = 'debt' | 'goal' | 'txn';

interface CalEvent {
  id: string;
  date: string;
  kind: EventKind;
  title: string;
  detail: string;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export default function CalendarPage() {
  const { db } = useLedger();
  const today = todayISO();

  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const events = useMemo<CalEvent[]>(() => {
    const list: CalEvent[] = [];

    for (const debt of db.debts) {
      if (!debt.dueDate) continue;
      const status = debtStatus(debt);
      list.push({
        id: `debt-${debt.id}`,
        date: debt.dueDate,
        kind: 'debt',
        title: `${debt.direction === 'iOwe' ? 'Pay' : 'Collect'} ${debt.party}`,
        detail: `${formatCurrency(status.remaining, db.settings.currency)} remaining`,
      });
    }

    for (const goal of db.goals) {
      if (!goal.deadline) continue;
      const status = goalStatus(goal);
      if (status.status === 'completed') continue;
      list.push({
        id: `goal-${goal.id}`,
        date: goal.deadline,
        kind: 'goal',
        title: `Goal: ${goal.title}`,
        detail: `${formatCurrency(status.remaining, db.settings.currency)} to go`,
      });
    }

    // Future-dated transactions act as scheduled bills/income.
    for (const txn of db.transactions) {
      if (txn.date <= today) continue;
      list.push({
        id: `txn-${txn.id}`,
        date: txn.date,
        kind: 'txn',
        title: txn.description,
        detail: `${txn.type === 'income' ? '+' : '−'}${formatCurrency(txn.amount, db.settings.currency)} scheduled`,
      });
    }

    return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [db, today]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [events]);

  const upcoming = useMemo(() => events.filter((e) => e.date >= today).slice(0, 8), [events, today]);
  const overdue = useMemo(
    () =>
      db.debts
        .map((d) => debtStatus(d))
        .filter((s) => s.status === 'overdue')
        .map((s) => s.debt),
    [db.debts],
  );

  // Build the visible grid: start at the week containing the 1st.
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay(); // 0 = Sunday
    const gridStart = new Date(year, month, 1 - startOffset);
    const result: { date: Date; iso: string; outside: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      result.push({ date: d, iso: toISODate(d), outside: d.getMonth() !== month });
    }
    return result;
  }, [cursor]);

  function shift(months: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + months, 1));
  }

  return (
    <div className="page">
      <PageHeader
        jp="予定"
        title="Calendar"
        description="Debt due dates, savings-goal deadlines and scheduled transactions in one view."
        actions={
          <Button variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), 1))}>
            Today
          </Button>
        }
      />

      {overdue.length > 0 && (
        <div className="form-alert form-alert-error" role="status">
          {overdue.length} payment(s) overdue:{' '}
          {overdue.map((d: Debt) => d.party).join(', ')}. Open the Debts page to record a payment.
        </div>
      )}

      <div className="grid grid-dashboard">
        <section className="card" aria-label="Month calendar">
          <div className="card-header">
            <h2>{monthLabel(cursor)}</h2>
            <div className="row-actions">
              <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
                <ChevronLeft size={16} />
              </button>
              <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="calendar-grid" aria-hidden="true">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div className="calendar-head" key={d}>
                {d}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {cells.map(({ date, iso, outside }) => {
              const dayEvents = eventsByDate.get(iso) ?? [];
              return (
                <div
                  key={iso}
                  className={[
                    'calendar-cell',
                    outside ? 'is-outside' : '',
                    iso === today ? 'is-today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="calendar-daynum">{date.getDate()}</span>
                  {dayEvents.slice(0, 3).map((e) => (
                    <span key={e.id} className={`calendar-event calendar-event--${e.kind}`} title={`${e.title} — ${e.detail}`}>
                      {e.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && <span className="muted">+{dayEvents.length - 3} more</span>}
                </div>
              );
            })}
          </div>

          <div className="calendar-legend">
            <span>
              <span className="legend-dot" style={{ backgroundColor: '#fdecef' }} /> Debt due date
            </span>
            <span>
              <span className="legend-dot" style={{ backgroundColor: '#f0ecfe' }} /> Goal deadline
            </span>
            <span>
              <span className="legend-dot" style={{ backgroundColor: '#e6f7f0' }} /> Scheduled transaction
            </span>
          </div>
        </section>

        <section className="card" aria-labelledby="calendar-upcoming">
          <div className="card-header">
            <div>
              <h2 id="calendar-upcoming">Upcoming</h2>
              <p>Derived from your debts, goals and future-dated entries</p>
            </div>
            <CalendarDays size={18} aria-hidden="true" />
          </div>

          {upcoming.length === 0 ? (
            <EmptyState
              title="Nothing scheduled"
              description="Deadlines from debts and savings goals — plus any future-dated transactions — will appear here automatically."
            />
          ) : (
            <ul className="upcoming-list">
              {upcoming.map((e) => (
                <li key={e.id} className={`upcoming-item upcoming-item--${e.kind}`}>
                  <div>
                    <strong>{e.title}</strong>
                    <span className="list-row-sub">{e.detail}</span>
                  </div>
                  <div className="upcoming-date">
                    <span className="mono-num">{formatDate(e.date, db.settings.dateFormat)}</span>
                    <span className="list-row-sub">{relativeDueLabel(e.date, today)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
