import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: ReactNode;
  icon?: ReactNode;
  /** 'positive' | 'negative' | 'neutral' colours the sub-line */
  tone?: 'positive' | 'negative' | 'neutral';
}

export function KpiCard({ label, value, sub, icon, tone = 'neutral' }: KpiCardProps) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className={`kpi-sub ${tone === 'neutral' ? '' : `is-${tone}`}`}>{sub}</div>}
    </div>
  );
}
