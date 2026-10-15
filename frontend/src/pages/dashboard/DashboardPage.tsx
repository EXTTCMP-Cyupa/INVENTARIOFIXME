import React from 'react';
import { Any } from '../../sharedConfig';
import { PageHeader, KpiStrip } from '../../sharedLayout';
import { Plus, ShoppingCart } from 'lucide-react';

export function Dashboard({api,go,role}:{api:(u:string,o?:RequestInit)=>Promise<Response>,go:(p:string)=>void,role:string}){
  const [data, setData] = React.useState<Any>({});
  const [adminDash, setAdminDash] = React.useState<any>(null);
  const [adminPeriod, setAdminPeriod] = React.useState<'month' | 'last30' | 'all'>('last30');
  const [orderCounts, setOrderCounts] = React.useState<Any>({});
  const global = role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN';
  const financial = ['MANAGER', 'ACCOUNTANT', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(role);

  React.useEffect(() => {
    if (financial) {
      api(`/api/reports/dashboard-admin?period=${adminPeriod}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setAdminDash(d); })
        .catch(() => {});
      api('/api/reports/summary').then(r => r.ok ? r.json() : {}).then(setData);
    }
    api('/api/orders/counts').then(r => r.ok ? r.json() : {}).then(setOrderCounts).catch(() => {});
  }, [api, financial, adminPeriod]);

  const navigateToOrders = (params: string) => {
    window.location.hash = `#work-orders?${params}`;
    go('work-orders');
  };

  const title = global ? 'Administración General' : role === 'DELIVERY' ? 'Panel de Entregas' : role === 'TECHNICIAN' ? 'Servicio Técnico' : role === 'SELLER' ? 'Punto de Venta' : role === 'ACCOUNTANT' ? 'Balance Financiero' : 'Control Operativo';

  const quick = global
    ? [['administration', '🏢', 'Empresas & Sucursales', 'Gestión multi-tenant'], ['products', '📦', 'Inventario Global', 'Existencias y costos'], ['reports', '📊', 'Finanzas & Rentabilidad', 'Métricas de utilidad']]
    : role === 'DELIVERY'
    ? [['deliveries', '🛵', 'Entregas a Domicilio', 'Rutas, llamadas y despachos']]
    : role === 'TECHNICIAN'
    ? [['my-work', '🛠️', 'Mi Trabajo Asignado', 'Mis órdenes y estados técnicos'], ['work-orders', '📋', 'Todas las Órdenes', 'Diagnóstico general'], ['pos', '🛒', 'Punto de Venta', 'Vender si tengo permiso']]
    : role === 'SELLER'
    ? [['pos', '🛒', 'Nueva Venta', 'Local o a domicilio'], ['cash', '💵', 'Arqueo de Caja', 'Efectivo y movimientos'], ['customers', '👤', 'Nuevo Cliente', 'Ficha comercial'], ['work-orders', '🛠️', 'Ingresar Equipo', 'Ficha técnica']]
    : [['pos', '🛒', 'Punto de Venta', 'Cobro omnicanal y delivery'], ['products', '📦', 'Catálogo & Margen', 'Precios, stock y costos'], ['deliveries', '🛵', 'Despachos', 'Envíos en curso'], ['reports', '📊', 'Reportes Financieros', 'Ingresos, COGS y margen']];

  return (
    <>
      <PageHeader
        title="Resumen operativo"
        description={global ? 'Supervisión en tiempo real de empresas y rentabilidad' : `Fixme Tiendas · Sesión activa (${role.replace('_', ' ')})`}
        actions={
          !global && ['MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(role) ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="primary-action" onClick={() => go('pos')}>
                <ShoppingCart size={15} /> <span>Nueva venta</span>
              </button>
              <button type="button" className="secondary-action" onClick={() => go('products')}>
                <Plus size={15} /> <span>Producto</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* 1. BANNER DEL PLAN CONTRATADO Y DÍAS RESTANTES (ADMINISTRATIVO) */}
      {financial && adminDash?.subscription && (
        <div className="admin-plan-banner">
          <div className="admin-plan-info">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px' }}>
                  🏢 {adminDash.subscription.name || 'Mi Empresa'}
                </span>
                <span className="admin-plan-badge">
                  ⭐ Plan {adminDash.subscription.plan || 'STARTER'}
                </span>
                {adminDash.subscription.is_trial && (
                  <span style={{ background: '#3b82f6', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                    MODO PRUEBA
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>🔄 Facturación: <strong>{adminDash.subscription.billing_cycle || 'Mensual'}</strong></span>
                <span>📅 Próximo corte: <strong>{adminDash.subscription.next_billing_date || adminDash.subscription.trial_ends_at || 'Al día'}</strong></span>
                <span>💵 Cuota: <strong>${Number(adminDash.subscription.monthly_fee || 0).toFixed(2)}/mes</strong></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {adminDash.subscription.isExpired ? (
              <span className="admin-days-pill expired">
                🚨 ¡Plan Caducado! ({adminDash.subscription.daysRemaining} días)
              </span>
            ) : adminDash.subscription.isExpiringSoon ? (
              <span className="admin-days-pill warning">
                ⚠️ Por caducar: {adminDash.subscription.daysRemaining} días restantes
              </span>
            ) : (
              <span className="admin-days-pill healthy">
                🛡️ Suscripción activa · {adminDash.subscription.daysRemaining} días restantes
              </span>
            )}

            {global && (
              <button
                type="button"
                onClick={() => go('administration')}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#fff',
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Gestionar Plan ↗
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI STRIP UNIFICADO */}
      <KpiStrip
        items={[
          {
            label: 'Ingresos ventas',
            value: `$${Number((adminDash?.financials?.salesRevenue !== undefined ? adminDash.financials.salesRevenue : data.revenue) || 0).toFixed(2)}`,
            hint: `${(adminDash?.financials?.salesCount !== undefined ? adminDash.financials.salesCount : data.sales) || 0} transacciones cobradas`
          },
          {
            label: 'Ganancia bruta',
            value: `+$${Number((adminDash?.financials?.grossProfit !== undefined ? adminDash.financials.grossProfit : data.grossProfit) || 0).toFixed(2)}`,
            hint: `${Number(data.grossMarginPercent || 0).toFixed(1)}% margen comercial`,
            tone: 'success'
          },
          {
            label: 'Reparaciones activas',
            value: Number(orderCounts.totalActive || ((orderCounts.open || 0) + (orderCounts.diagnosis || 0) + (orderCounts.quoted || 0) + (orderCounts.waiting_parts || 0) + (orderCounts.repair || 0) + (orderCounts.ready || 0))),
            hint: 'En proceso técnico',
            onClick: () => navigateToOrders('view=kanban')
          },
          {
            label: 'SLA en riesgo / vencidas',
            value: (orderCounts.slaOverdue || 0) + (orderCounts.slaCritical || 0),
            hint: 'Atención prioritaria',
            tone: ((orderCounts.slaOverdue || 0) + (orderCounts.slaCritical || 0)) > 0 ? 'danger' : 'default',
            onClick: () => navigateToOrders('view=table&status=ALL')
          },
          {
            label: 'Entregas pendientes',
            value: data.deliveriesSummary?.PENDING || 0,
            hint: 'Envíos por despachar',
            tone: (data.deliveriesSummary?.PENDING || 0) > 0 ? 'warning' : 'default',
            onClick: () => go('deliveries')
          }
        ]}
      />

      {/* 2. FLUJO FINANCIERO Y ADMINISTRATIVO DETALLADO (INGRESOS, GASTOS, VENTAS, UTILIDAD) */}
      {financial && adminDash?.financials && (
        <div style={{ marginTop: 20 }}>
          <div className="admin-period-bar">
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                💼 Flujo Financiero & Balance Administrativo
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {adminPeriod === 'month' ? 'Resumen del mes actual en curso' : adminPeriod === 'last30' ? 'Últimos 30 días de operación continua' : 'Consolidado histórico de la tienda'}
              </span>
            </div>

            <div className="view-mode-pill-toggle">
              <button
                type="button"
                className={`view-mode-item ${adminPeriod === 'month' ? 'active' : ''}`}
                onClick={() => setAdminPeriod('month')}
              >
                📅 Este Mes
              </button>
              <button
                type="button"
                className={`view-mode-item ${adminPeriod === 'last30' ? 'active' : ''}`}
                onClick={() => setAdminPeriod('last30')}
              >
                ⚡ Últimos 30 Días
              </button>
              <button
                type="button"
                className={`view-mode-item ${adminPeriod === 'all' ? 'active' : ''}`}
                onClick={() => setAdminPeriod('all')}
              >
                🌐 Histórico Total
              </button>
            </div>
          </div>

          <div className="admin-fin-grid">
            <div className="admin-fin-card income">
              <div className="admin-fin-header">
                <span>Ingresos Totales</span>
                <span style={{ fontSize: 16 }}>💰</span>
              </div>
              <div className="admin-fin-value" style={{ color: '#2563eb' }}>
                ${Number(adminDash.financials.totalRevenue || 0).toFixed(2)}
              </div>
              <div className="admin-fin-breakdown">
                <div className="admin-breakdown-row">
                  <span>🛒 Ventas Mostrador:</span>
                  <strong>${Number(adminDash.financials.salesRevenue || 0).toFixed(2)} ({adminDash.financials.salesCount || 0} vts)</strong>
                </div>
                <div className="admin-breakdown-row">
                  <span>🛠️ Servicio Técnico:</span>
                  <strong>${Number(adminDash.financials.workshopRevenue || 0).toFixed(2)} ({adminDash.financials.completedWorkshopOrders || 0} rep)</strong>
                </div>
              </div>
            </div>

            <div className="admin-fin-card expenses">
              <div className="admin-fin-header">
                <span>Egresos & Compras</span>
                <span style={{ fontSize: 16 }}>📉</span>
              </div>
              <div className="admin-fin-value" style={{ color: '#ea580c' }}>
                ${(Number(adminDash.financials.operatingExpenses || 0) + Number(adminDash.financials.purchasesTotal || 0) + Number(adminDash.financials.techCommissions || 0)).toFixed(2)}
              </div>
              <div className="admin-fin-breakdown">
                <div className="admin-breakdown-row">
                  <span>💵 Gastos de Caja (Out):</span>
                  <strong>${Number(adminDash.financials.operatingExpenses || 0).toFixed(2)}</strong>
                </div>
                <div className="admin-breakdown-row">
                  <span>📦 Compras Proveedores:</span>
                  <strong>${Number(adminDash.financials.purchasesTotal || 0).toFixed(2)}</strong>
                </div>
                <div className="admin-breakdown-row">
                  <span>🤝 Comisiones Técnicas:</span>
                  <strong>${Number(adminDash.financials.techCommissions || 0).toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div className="admin-fin-card cogs">
              <div className="admin-fin-header">
                <span>Costo Mercadería (COGS)</span>
                <span style={{ fontSize: 16 }}>🏷️</span>
              </div>
              <div className="admin-fin-value" style={{ color: '#475569' }}>
                ${Number(adminDash.financials.salesCogs || 0).toFixed(2)}
              </div>
              <div className="admin-fin-breakdown">
                <div className="admin-breakdown-row">
                  <span>Margen Bruto ($):</span>
                  <strong style={{ color: '#16a34a' }}>+${Number(adminDash.financials.grossProfit || 0).toFixed(2)}</strong>
                </div>
                <div className="admin-breakdown-row">
                  <span>Margen Comercial:</span>
                  <strong>{Number(data.grossMarginPercent || 0).toFixed(1)}%</strong>
                </div>
              </div>
            </div>

            <div className="admin-fin-card profit">
              <div className="admin-fin-header">
                <span>Utilidad Neta Real</span>
                <span style={{ fontSize: 16 }}>📈</span>
              </div>
              <div className="admin-fin-value" style={{ color: Number(adminDash.financials.netProfit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                {Number(adminDash.financials.netProfit || 0) >= 0 ? '+' : ''}${Number(adminDash.financials.netProfit || 0).toFixed(2)}
              </div>
              <div className="admin-fin-breakdown">
                <div className="admin-breakdown-row">
                  <span>Margen Neto Real:</span>
                  <strong style={{ color: Number(adminDash.financials.netProfit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                    {Number(adminDash.financials.netMarginPercent || 0).toFixed(1)}%
                  </strong>
                </div>
                <div className="admin-breakdown-row">
                  <span>Balance:</span>
                  <span style={{ fontSize: 10.5 }}>Ingresos - COGS - Gastos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TRABAJOS REALIZADOS POR PERSONA (TÉCNICOS Y VENDEDORES) */}
      {financial && adminDash && (
        <div className="admin-sections-grid">
          {/* TRABAJOS DE TÉCNICOS */}
          <div className="admin-panel-card">
            <div className="admin-panel-title">
              <span>🛠️ Trabajos Realizados por Técnico</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                {adminDash.technicians?.length || 0} técnicos
              </span>
            </div>
            {(!adminDash.technicians || adminDash.technicians.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
                Sin órdenes registradas para técnicos en este período
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Técnico</th>
                    <th style={{ textAlign: 'center' }}>Completadas</th>
                    <th style={{ textAlign: 'center' }}>En Curso</th>
                    <th style={{ textAlign: 'right' }}>Mano de Obra</th>
                  </tr>
                </thead>
                <tbody>
                  {adminDash.technicians.map((t: Any, idx: number) => (
                    <tr key={t.technician_id || idx}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.email}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: Number(t.completed_orders || 0) > 0 ? '#dcfce7' : '#f1f5f9',
                          color: Number(t.completed_orders || 0) > 0 ? '#15803d' : '#64748b'
                        }}>
                          {t.completed_orders || 0}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: Number(t.active_orders || 0) > 0 ? '#ede9fe' : '#f1f5f9',
                          color: Number(t.active_orders || 0) > 0 ? '#7c3aed' : '#64748b'
                        }}>
                          {t.active_orders || 0}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
                        ${Number(t.labor_revenue || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* VENTAS POR COLABORADOR */}
          <div className="admin-panel-card">
            <div className="admin-panel-title">
              <span>🛒 Ventas por Vendedor / Colaborador</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                {adminDash.sellers?.length || 0} vendedores
              </span>
            </div>
            {(!adminDash.sellers || adminDash.sellers.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
                Sin ventas registradas en este período
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th style={{ textAlign: 'center' }}>Ventas</th>
                    <th style={{ textAlign: 'right' }}>Ticket Prom.</th>
                    <th style={{ textAlign: 'right' }}>Total Facturado</th>
                  </tr>
                </thead>
                <tbody>
                  {adminDash.sellers.map((s: Any, idx: number) => (
                    <tr key={s.user_id || idx}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.role} · {s.email}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: '#e0f2fe',
                          color: '#0284c7'
                        }}>
                          {s.sales_count || 0}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                        ${Number(s.avg_ticket || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                        ${Number(s.total_sold || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 4. TOP CATEGORÍAS Y PRODUCTOS MÁS VENDIDOS */}
      {financial && adminDash && (
        <div className="admin-sections-grid">
          {/* CATEGORÍAS MÁS VENDIDAS */}
          <div className="admin-panel-card">
            <div className="admin-panel-title">
              <span>📊 Categorías Más Vendidas</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Top 5</span>
            </div>
            {(!adminDash.topCategories || adminDash.topCategories.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
                Sin datos de categorías en este período
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th>Categoría</th>
                    <th style={{ textAlign: 'center' }}>Unidades</th>
                    <th style={{ textAlign: 'right' }}>Total Facturado</th>
                  </tr>
                </thead>
                <tbody>
                  {adminDash.topCategories.map((c: Any, idx: number) => (
                    <tr key={idx}>
                      <td>
                        <span className={`admin-rank-badge ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.category_name}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: '#f1f5f9',
                          color: '#475569'
                        }}>
                          {c.units_sold} uds
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
                        ${Number(c.total_revenue || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* PRODUCTOS MÁS VENDIDOS */}
          <div className="admin-panel-card">
            <div className="admin-panel-title">
              <span>⭐ Productos Estrella (Top Rotación)</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Top 5</span>
            </div>
            {(!adminDash.topProducts || adminDash.topProducts.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
                Sin datos de productos en este período
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th>Producto</th>
                    <th style={{ textAlign: 'center' }}>Vendidos</th>
                    <th style={{ textAlign: 'right' }}>Total Facturado</th>
                  </tr>
                </thead>
                <tbody>
                  {adminDash.topProducts.map((p: Any, idx: number) => (
                    <tr key={p.id || idx}>
                      <td>
                        <span className={`admin-rank-badge ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          SKU: {p.sku || 'N/A'} · {p.category_name}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: '#fef3c7',
                          color: '#b45309'
                        }}>
                          {p.units_sold} uds
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                        ${Number(p.total_revenue || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Workshop Command Center & Operational Actionable Alerts */}
      <div className="workshop-command-center" style={{ marginTop: 16 }}>
        <div className="workshop-command-header">
          <h3>Alertas operativas del taller</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Activas en taller: <strong>{Number(orderCounts.totalActive || ((orderCounts.open || 0) + (orderCounts.diagnosis || 0) + (orderCounts.quoted || 0) + (orderCounts.waiting_parts || 0) + (orderCounts.repair || 0) + (orderCounts.ready || 0)))}</strong> órdenes en curso
          </span>
        </div>

        <div className="workshop-kpis-grid">
          <div
            className="workshop-kpi-card urgent"
            onClick={() => navigateToOrders('view=table&status=ALL')}
            title="Ver órdenes vencidas o con SLA crítico"
          >
            <div className="workshop-kpi-top">
              <span className="workshop-kpi-label">SLA en Riesgo / Vencidas</span>
              <span className="workshop-kpi-badge" style={{ background: '#fee2e2', color: '#dc2626' }}>Crítico</span>
            </div>
            <div className="workshop-kpi-number" style={{ color: '#dc2626' }}>
              {(orderCounts.slaOverdue || 0) + (orderCounts.slaCritical || 0)}
            </div>
            <div className="workshop-kpi-desc">
              <span>🚨 Excedieron tiempo prometido</span>
              <span style={{ marginLeft: 'auto' }}>→</span>
            </div>
          </div>

          <div
            className="workshop-kpi-card quoted"
            onClick={() => navigateToOrders('view=kanban&col=quoted&status=QUOTED')}
            title="Ver cotizaciones esperando aprobación"
          >
            <div className="workshop-kpi-top">
              <span className="workshop-kpi-label">Cotizaciones por Aprobar</span>
              <span className="workshop-kpi-badge" style={{ background: '#fef3c7', color: '#d97706' }}>Pendiente</span>
            </div>
            <div className="workshop-kpi-number" style={{ color: '#d97706' }}>
              {orderCounts.quoted || 0}
            </div>
            <div className="workshop-kpi-desc">
              <span>💬 Esperando respuesta cliente</span>
              <span style={{ marginLeft: 'auto' }}>→</span>
            </div>
          </div>

          <div
            className="workshop-kpi-card parts"
            onClick={() => navigateToOrders('view=kanban&col=parts&status=WAITING_PARTS')}
            title="Ver órdenes esperando repuestos"
          >
            <div className="workshop-kpi-top">
              <span className="workshop-kpi-label">Esperando Repuestos</span>
              <span className="workshop-kpi-badge" style={{ background: '#ffedd5', color: '#ea580c' }}>En Pausa</span>
            </div>
            <div className="workshop-kpi-number" style={{ color: '#ea580c' }}>
              {orderCounts.waiting_parts || 0}
            </div>
            <div className="workshop-kpi-desc">
              <span>⏳ Esperando piezas / proveedor</span>
              <span style={{ marginLeft: 'auto' }}>→</span>
            </div>
          </div>

          <div
            className="workshop-kpi-card repair"
            onClick={() => navigateToOrders('view=kanban&col=in_progress')}
            title="Ver equipos en mesa de trabajo o pruebas"
          >
            <div className="workshop-kpi-top">
              <span className="workshop-kpi-label">En Reparación / Pruebas</span>
              <span className="workshop-kpi-badge" style={{ background: '#ede9fe', color: '#7c3aed' }}>Activas</span>
            </div>
            <div className="workshop-kpi-number" style={{ color: '#7c3aed' }}>
              {(orderCounts.repair || 0) + (orderCounts.testing || 0)}
            </div>
            <div className="workshop-kpi-desc">
              <span>⚙️ En mesa técnica y control</span>
              <span style={{ marginLeft: 'auto' }}>→</span>
            </div>
          </div>

          <div
            className="workshop-kpi-card ready"
            onClick={() => navigateToOrders('view=kanban&col=ready&status=LISTO_ENTREGA')}
            title="Ver equipos terminados para retiro"
          >
            <div className="workshop-kpi-top">
              <span className="workshop-kpi-label">Listas para Retiro</span>
              <span className="workshop-kpi-badge" style={{ background: '#d1fae5', color: '#059669' }}>Por Cobrar</span>
            </div>
            <div className="workshop-kpi-number" style={{ color: '#059669' }}>
              {orderCounts.ready || 0}
            </div>
            <div className="workshop-kpi-desc">
              <span>✅ Listos para entrega y factura</span>
              <span style={{ marginLeft: 'auto' }}>→</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginBottom: '14px' }}>Accesos Directos</h3>
        <div className="quick">
          {quick.map(q => (
            <button key={q[0]} onClick={() => go(q[0])}>
              <span style={{ fontSize: '22px', display: 'block', marginBottom: '6px' }}>{q[1]}</span>
              <b>{q[2]}</b>
              <small>{q[3]}</small>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function Kpi(p:{label:string,value:any,trend:string,danger?:boolean}){return <article className="kpi"><small>{p.label}</small><strong className={p.danger?'danger':''}>{p.value}</strong><span>{p.trend}</span></article>}


export default Dashboard;
