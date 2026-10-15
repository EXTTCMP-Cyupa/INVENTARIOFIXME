import React from 'react';

export type Any = Record<string, any>;

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_BRANCH_ID = '00000000-0000-0000-0000-000000000010';

let _tenantId = (typeof localStorage !== 'undefined' && localStorage.tenantId) || DEFAULT_TENANT_ID;
let _branchId = (typeof localStorage !== 'undefined' && localStorage.branchId) || DEFAULT_BRANCH_ID;

export function getTenantId(): string {
  if (typeof localStorage !== 'undefined' && localStorage.tenantId) {
    return localStorage.tenantId;
  }
  return _tenantId || DEFAULT_TENANT_ID;
}

export function setTenantId(tid: string): void {
  _tenantId = tid;
  if (typeof localStorage !== 'undefined') {
    if (tid) {
      localStorage.tenantId = tid;
    } else {
      delete localStorage.tenantId;
    }
  }
}

export function getBranchId(): string {
  if (typeof localStorage !== 'undefined' && localStorage.branchId) {
    return localStorage.branchId;
  }
  return _branchId || DEFAULT_BRANCH_ID;
}

export function setBranchId(bid: string): void {
  _branchId = bid;
  if (typeof localStorage !== 'undefined') {
    if (bid) {
      localStorage.branchId = bid;
    } else {
      delete localStorage.branchId;
    }
  }
}

// Proxies for legacy direct variable access
export const tenantId = getTenantId();
export const branchId = getBranchId();

export const nav: [string, string, string][] = [
  ['home','Resumen','🏠'],
  ['cash','Caja','💵'],
  ['pos','Punto de venta','💳'],
  ['sales','Ventas','🛒'],
  ['quotes','Cotizaciones','📝'],
  ['my-work','Mi Trabajo','🛠️'],
  ['work-orders','Ordenes de servicio','📋'],
  ['marketplace','Bolsa de Reparaciones','🎯'],
  ['products','Inventario','📦'],
  ['purchases','Compras y Kardex','🛍️'],
  ['imports','Importaciones','✈️'],
  ['customers','Clientes','👥'],
  ['deliveries','Entregas','🚚'],
  ['warranties','Garantias','🛡️'],
  ['reports','Reportes','📊'],
  ['administration','Empresa','🏢']
];

export function moduleKey(item: string): string {
  if (item === 'cash') return 'CASH_REGISTER';
  if (item === 'products') return 'INVENTORY';
  if (item === 'my-work' || item === 'work-orders' || item === 'marketplace') return 'WORK_ORDERS';
  if (item === 'quotes') return 'QUOTES';
  if (item === 'pos' || item === 'sales') return 'POS';
  if (item === 'purchases') return 'PURCHASES';
  if (item === 'imports') return 'IMPORTS';
  if (item === 'warranties') return 'WARRANTIES';
  if (item === 'deliveries') return 'DELIVERIES';
  if (item === 'reports') return 'REPORTS';
  if (item === 'customers') return 'CUSTOMERS';
  return item.toUpperCase().replace('-', '_');
}

export const ALL_MODULES_DEF = [
  { key: 'INVENTORY', name: 'Inventario & Productos', icon: '📦', desc: 'Stock multi-sucursal, alertas de stock mínimo, seriales y kardex' },
  { key: 'POS', name: 'Punto de Venta (POS)', icon: '💳', desc: 'Caja rápida, facturación electrónica SRI, tickets térmicos e IVA' },
  { key: 'CASH_REGISTER', name: 'Caja Chica & Arqueos', icon: '💵', desc: 'Aperturas, cierres de turno, ingresos/egresos y control de efectivo' },
  { key: 'QUOTES', name: 'Cotizaciones & Proformas', icon: '📑', desc: 'Emisión de cotizaciones con enlace público web directo para clientes' },
  { key: 'WORK_ORDERS', name: 'Taller & Órdenes de Servicio', icon: '🛠️', desc: 'Recepción técnica, diagnóstico, repuestos y portal de seguimiento' },
  { key: 'DELIVERIES', name: 'Logística & Envíos Delivery', icon: '🚚', desc: 'Despachos con motorizados, georreferenciación y tracking en vivo' },
  { key: 'CUSTOMERS', name: 'Directorio de Clientes', icon: '👥', desc: 'Gestión de cartera, RUC/cédula, historial de compras y contactos' },
  { key: 'REPORTS', name: 'Reportes & Analítica', icon: '📊', desc: 'Métricas de ventas, margen de ganancia, rotación y exportación' },
  { key: 'IMPORTS', name: 'Importaciones y Arribos', icon: '✈️', desc: 'Compras USA/China, cálculo de flete/aduana, pre-compras y avisos WhatsApp' },
  { key: 'PURCHASES', name: 'Compras & Kardex', icon: '🛍️', desc: 'Órdenes de compra a distribuidores locales y costo ponderado' },
  { key: 'WARRANTIES', name: 'Garantías y Post-Venta', icon: '🛡️', desc: 'Control de números de serie, resolución técnica y garantías' },
  { key: 'APIS', name: 'Integraciones & Pagos Digitales', icon: '⚡', desc: 'DeUna QR bancario, PayPhone cobro con tarjeta de crédito, webhooks' }
];

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-surface, #fff)', borderRadius: 12, margin: 20, border: '1px solid var(--border, #fee2e2)' }}>
          <h2 style={{ color: 'var(--danger, #dc2626)', margin: '0 0 8px 0' }}>⚠️ Ocurrió un error inesperado al cargar esta sección</h2>
          <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '13px' }}>{String(this.state.error?.message || this.state.error || 'Error de renderizado')}</p>
          <button className="primary-action" onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: 16 }}>
            🔄 Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Table({title,columns,rows,empty,action}:{title:string,columns:string[],rows:Any[],empty:string,action?:string}){
  return (
    <section className="panel table-panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {action&&<button>{action}</button>}
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{columns.map(c=><th key={c}>{c.replace(/([A-Z])/g,' $1')}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.id||i}>
                  {columns.map(c=><td data-label={c.replace(/([A-Z])/g,' $1')} key={c}>{c==='price'||c==='quote'||c==='total'?`$${Number(r[c]||0).toFixed(2)}`:c==='approval_url'?<a href={r[c]} target="_blank" rel="noreferrer">Abrir autorización</a>:r[c]??'*'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <b>--</b>
          <p>{empty}</p>
          <small>Los registros aparecerán aquí.</small>
        </div>
      )}
    </section>
  );
}
