import React from 'react';
import { MoreHorizontal, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

export function PageHeader({
  title,
  description,
  actions,
  secondaryMenu
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  secondaryMenu?: React.ReactNode;
}) {
  return (
    <header className="page-header-clean">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {(actions || secondaryMenu) && (
        <div className="page-actions">
          {actions}
          {secondaryMenu}
        </div>
      )}
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

export function Toolbar({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`secondary-controls-bar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16
      }}
    >
      {children}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="view-mode-pill-toggle" role="radiogroup">
      {options.map(opt => {
        const Icon = opt.icon;
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`view-mode-item ${active ? 'active' : ''}`}
            onClick={() => onChange(opt.id)}
          >
            {Icon && <Icon size={14} />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface ActionMenuItem {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  tone?: 'danger' | 'default';
  disabled?: boolean;
}

export function ActionMenu({
  items,
  label = 'Más acciones'
}: {
  items: ActionMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const clickOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', clickOut);
    document.addEventListener('keydown', keyEsc);
    return () => {
      document.removeEventListener('mousedown', clickOut);
      document.removeEventListener('keydown', keyEsc);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title={label}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--shadow-pop)',
            minWidth: 170,
            zIndex: 100,
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  background: 'transparent',
                  color: item.tone === 'danger' ? 'var(--danger)' : 'var(--text)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                  textAlign: 'left',
                  width: '100%'
                }}
                onMouseEnter={e => {
                  if (!item.disabled) e.currentTarget.style.background = 'var(--surface-2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {Icon && <Icon size={14} />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
  className = '',
  disabled = false
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  tone?: 'default' | 'danger' | 'primary';
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      style={
        tone === 'danger'
          ? { color: 'var(--danger)' }
          : tone === 'primary'
          ? { color: 'var(--primary)' }
          : undefined
      }
    >
      <Icon size={16} />
    </button>
  );
}

export function StatusBadge({
  tone = 'neutral',
  children
}: {
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';
  children: React.ReactNode;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function SlaBadge({
  sla,
  label
}: {
  sla?: { cls?: string; label?: string } | null;
  label?: string;
}) {
  const text = label || sla?.label || '';
  const isOverdue = text.toLowerCase().includes('atrasad') || text.toLowerCase().includes('vencid') || sla?.cls?.includes('overdue');
  const isUrgent = text.toLowerCase().includes('crític') || sla?.cls?.includes('urgent');

  if (isOverdue) {
    return (
      <span className="badge danger" title={text}>
        <AlertTriangle size={12} />
        <span>{text}</span>
      </span>
    );
  }
  if (isUrgent) {
    return (
      <span className="badge warning" title={text}>
        <Clock size={12} />
        <span>{text}</span>
      </span>
    );
  }
  return (
    <span className="badge neutral" title={text}>
      <span>{text}</span>
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={24} />
        </div>
      )}
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius = 'var(--r)',
  className = ''
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius
      }}
    />
  );
}
