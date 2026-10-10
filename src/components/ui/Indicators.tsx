import type { ReactNode } from 'react';

type BadgeTone = 'income' | 'expense' | 'success' | 'error' | 'warning' | 'neutral' | 'accent';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

interface ProgressProps {
  /** 0..1 (values above 1 are clamped visually but reported accurately) */
  ratio: number;
  label: string;
  /** Accessible text shown to screen readers, e.g. "₱4,500 of ₱12,000 spent" */
  valueText: string;
  tone?: 'auto' | 'brand';
}

function toneClass(ratio: number): string {
  if (ratio > 1) return 'is-over';
  if (ratio >= 0.85) return 'is-warn';
  return 'is-good';
}

export function Progress({ ratio, label, valueText, tone = 'auto' }: ProgressProps) {
  const safe = Number.isFinite(ratio) ? Math.max(0, ratio) : 0;
  const width = Math.min(safe, 1) * 100;
  return (
    <div className="progress">
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safe * 100)}
        aria-valuetext={valueText}
      >
        <div
          className={['progress-fill', tone === 'auto' ? toneClass(safe) : ''].filter(Boolean).join(' ')}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function ProgressMeta({ left, right }: { left: string; right: string }) {
  return (
    <div className="progress-meta">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">Loading…</span>
    </div>
  );
}
