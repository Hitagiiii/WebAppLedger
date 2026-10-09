import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** Small Japanese subtitle rendered above the title */
  jp?: string;
  description?: string;
  actions?: ReactNode;
}

export default function PageHeader({ title, jp, description, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        {jp && <span className="page-jp">{jp}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
