import React from 'react';
import { X, AlertTriangle, AlertCircle, CheckCircle2, Info } from 'lucide-react';

/* ==========================================================================
   1. SLIDE-OVER DRAWER (Panel lateral deslizante)
   ========================================================================== */
export interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string | number;
}

export function SlideOverDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 540
}: SlideOverDrawerProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthStyle = typeof width === 'number' ? `${width}px` : width;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer-panel"
        style={{ width: widthStyle }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="drawer-header">
          <div className="drawer-header-text">
            <h2 className="drawer-title">{title}</h2>
            {subtitle && <p className="drawer-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Cerrar panel"
          >
            <X size={18} />
          </button>
        </header>

        <div className="drawer-body">
          {children}
        </div>

        {footer && (
          <footer className="drawer-footer">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}

/* ==========================================================================
   2. CONFIRM DIALOG (Modal de confirmación moderno)
   ========================================================================== */
export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'primary',
  onConfirm,
  onCancel,
  loading = false
}: ConfirmDialogProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter' && !loading) onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm, loading]);

  if (!isOpen) return null;

  const iconMap = {
    danger: <AlertCircle size={24} style={{ color: 'var(--danger)' }} />,
    warning: <AlertTriangle size={24} style={{ color: 'var(--warning)' }} />,
    primary: <Info size={24} style={{ color: 'var(--primary)' }} />
  };

  const btnClassMap = {
    danger: 'btn-confirm-danger',
    warning: 'btn-confirm-warning',
    primary: 'primary-action'
  };

  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <div
        className="confirm-card"
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="confirm-card-inner">
          <div className={`confirm-icon-wrap ${variant}`}>
            {iconMap[variant]}
          </div>
          <div className="confirm-content">
            <h3 className="confirm-title">{title}</h3>
            <div className="confirm-message">{message}</div>
          </div>
        </div>

        <div className="confirm-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={btnClassMap[variant]}
            onClick={onConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   3. SKELETON LOADERS (Efecto Shimmer de alto rendimiento)
   ========================================================================== */
export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  columnWidths?: (string | number)[];
}

export function SkeletonTable({
  rows = 5,
  columns = 5,
  columnWidths
}: SkeletonTableProps) {
  const rowList = Array.from({ length: rows });
  const colList = Array.from({ length: columns });

  return (
    <div className="skeleton-table-wrap">
      <div className="skeleton-table-header">
        {colList.map((_, i) => (
          <div
            key={i}
            className="skeleton-shimmer-box"
            style={{
              height: 18,
              width: columnWidths?.[i] || `${Math.max(40, 90 - (i * 10))}%`,
              borderRadius: 'var(--radius-sm)'
            }}
          />
        ))}
      </div>
      <div className="skeleton-table-body">
        {rowList.map((_, rIdx) => (
          <div key={rIdx} className="skeleton-table-row">
            {colList.map((_, cIdx) => (
              <div
                key={cIdx}
                className="skeleton-shimmer-box"
                style={{
                  height: 16,
                  width: columnWidths?.[cIdx] || (cIdx === 0 ? '70%' : cIdx === columns - 1 ? '40%' : '55%'),
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface SkeletonCardsProps {
  count?: number;
  gridCols?: number | string;
}

export function SkeletonCards({ count = 4, gridCols = 'repeat(auto-fit, minmax(260px, 1fr))' }: SkeletonCardsProps) {
  const cardList = Array.from({ length: count });

  return (
    <div className="skeleton-cards-grid" style={{ gridTemplateColumns: typeof gridCols === 'number' ? `repeat(${gridCols}, 1fr)` : gridCols }}>
      {cardList.map((_, idx) => (
        <div key={idx} className="skeleton-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="skeleton-shimmer-box" style={{ width: '60%', height: 16 }} />
            <div className="skeleton-shimmer-box" style={{ width: 24, height: 24, borderRadius: '50%' }} />
          </div>
          <div className="skeleton-shimmer-box" style={{ width: '85%', height: 26, marginBottom: 10 }} />
          <div className="skeleton-shimmer-box" style={{ width: '45%', height: 14 }} />
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   4. TOAST STACK (Notificaciones apiladas)
   ========================================================================== */
export interface ToastMessage {
  id: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  durationMs?: number;
}

export function ToastStack({
  toasts,
  onDismiss
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  React.useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map(t => {
      const dur = t.durationMs || 3500;
      return setTimeout(() => onDismiss(t.id), dur);
    });
    return () => timers.forEach(tm => clearTimeout(tm));
  }, [toasts, onDismiss]);

  if (!toasts.length) return null;

  const iconMap = {
    success: <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />,
    error: <AlertCircle size={18} style={{ color: 'var(--danger)' }} />,
    warning: <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />,
    info: <Info size={18} style={{ color: 'var(--primary)' }} />
  };

  return (
    <div className="toast-stack-container" role="region" aria-label="Notificaciones del sistema">
      {toasts.map(t => {
        const type = t.type || 'success';
        return (
          <div
            key={t.id}
            className={`toast-modern ${type}`}
            onClick={() => onDismiss(t.id)}
            role="status"
          >
            <div className="toast-modern-icon">
              {iconMap[type]}
            </div>
            <div className="toast-modern-content">
              {t.title && <strong className="toast-modern-title">{t.title}</strong>}
              <span className="toast-modern-text">{t.message}</span>
            </div>
            <button
              type="button"
              className="toast-modern-close"
              onClick={e => {
                e.stopPropagation();
                onDismiss(t.id);
              }}
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

