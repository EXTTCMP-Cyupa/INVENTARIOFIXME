import React from 'react';

export function PageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header-clean">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export interface KpiItem {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'danger' | 'warning' | 'success' | 'default';
  onClick?: () => void;
  active?: boolean;
}

export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpi-strip">
      {items.map((k, idx) => (
        <button
          key={idx}
          type="button"
          onClick={k.onClick}
          className={`kpi-strip-cell ${k.active ? 'active' : ''} ${k.tone || 'default'}`}
        >
          <div className="kpi-cell-label">{k.label}</div>
          <div className={`kpi-cell-value ${k.tone === 'danger' ? 'danger-tone' : ''}`}>
            {k.value}
          </div>
          {k.hint && <div className="kpi-cell-hint">{k.hint}</div>}
        </button>
      ))}
    </div>
  );
}

export interface FilterTabItem {
  id: string;
  label: string;
  count?: number | null;
}

export function FilterTabs({
  tabs,
  activeTab,
  onChange
}: {
  tabs: FilterTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="filter-tabs-bar" role="tablist">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          className={`filter-tab-btn ${activeTab === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span>{t.label}</span>
          {typeof t.count === 'number' && (
            <span className="tab-count-badge">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

