// Financial charts (Recharts). Every series passed in comes from the
// shared finance utilities — charts never compute totals themselves.

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { CategorySlice, MonthPoint } from '../../types';
import { toMajor } from '../../utils/finance';

const AXIS_STYLE = { fontSize: 11, fill: 'var(--color-muted)' };

function money(value: number): string {
  return `₱${toMajor(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        backgroundColor: 'var(--brand-card)',
        border: '1px solid var(--brand-border)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ color: entry.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{entry.name}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {typeof entry.value === 'number' ? money(entry.value) : String(entry.value ?? '')}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Grouped bars: income vs expense per month. */
export function IncomeExpenseChart({ data, height = 300 }: { data: MonthPoint[]; height?: number }) {
  return (
    <div className="chart-box" style={{ height }} role="img" aria-label="Bar chart of income versus expenses by month">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: 'var(--brand-border)' }} />
          <YAxis tickFormatter={(v: number) => `${Math.round(toMajor(v))}`} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={54} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(185,167,245,0.12)' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Income" fill="var(--color-emerald)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expenses" fill="var(--color-sakura-deep)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut: expense distribution by category. */
export function CategoryPieChart({ slices, height = 300 }: { slices: CategorySlice[]; height?: number }) {
  const data = slices.map((s) => ({ name: s.name, value: s.amount, color: s.color }));
  return (
    <div className="chart-box" style={{ height }} role="img" aria-label="Pie chart of spending by category">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke="var(--brand-card)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Area/line: net cash flow per month. */
export function CashFlowChart({ data, height = 300 }: { data: MonthPoint[]; height?: number }) {
  return (
    <div className="chart-box" style={{ height }} role="img" aria-label="Line chart of monthly net cash flow">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: 'var(--brand-border)' }} />
          <YAxis tickFormatter={(v: number) => `${Math.round(toMajor(v))}`} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={54} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="net"
            name="Net cash flow"
            stroke="var(--color-lavender)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Area: account balance trend over time (chronological). */
export function BalanceTrendChart({
  data,
  height = 300,
}: {
  data: { label: string; balance: number }[];
  height?: number;
}) {
  return (
    <div className="chart-box" style={{ height }} role="img" aria-label="Area chart of balance over time">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-sakura)" stopOpacity={0.55} />
              <stop offset="95%" stopColor="var(--color-lavender)" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: 'var(--brand-border)' }} minTickGap={24} />
          <YAxis tickFormatter={(v: number) => `${Math.round(toMajor(v))}`} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={54} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke="var(--color-sakura-deep)"
            strokeWidth={2}
            fill="url(#balanceFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Stacked bars: expense totals per category across months.
 * `points` come from utils/insights.categoryTimeSeries (values keyed by
 * category id, plus an optional '__other' bucket).
 */
export function CategoryStackedChart({
  points,
  series,
  height = 320,
}: {
  points: { key: string; label: string; values: Record<string, number> }[];
  series: { id: string; name: string; color: string }[];
  height?: number;
}) {
  const data = points.map((p) => ({ label: p.label, ...p.values }));
  return (
    <div
      className="chart-box"
      style={{ height }}
      role="img"
      aria-label="Stacked bar chart of spending by category over time"
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: 'var(--brand-border)' }} />
          <YAxis
            tickFormatter={(v: number) => `${Math.round(toMajor(v))}`}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(185,167,245,0.12)' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Bar
              key={s.id}
              dataKey={s.id}
              name={s.name}
              stackId="spending"
              fill={s.color}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
