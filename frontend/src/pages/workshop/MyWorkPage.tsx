import React from 'react';
import { Any, getBranchId } from '../../sharedConfig';
import { WorkOrderCheckoutModal } from '../../marketplaceView';
import { WorkOrderReceiptModal, TechnicianWorkbenchModal } from '../../commercialModals';
import { PageHeader, KpiStrip, FilterTabs, IconButton, StatusBadge } from '../../sharedLayout';
import { SkeletonCards, SkeletonTable } from '../../components/ui/ModernUiKit';
import { Inbox, RefreshCw, Search, Smartphone, User, Phone, Package, Wrench, Check, Receipt } from 'lucide-react';

export function MyWork({api, notify, go, branchId: propBranchId}:{api:(u:string,o?:RequestInit)=>Promise<Response>, notify?:(s:string)=>void, go?:(p:string)=>void, branchId?: string}){
const branchId = propBranchId || getBranchId();
  const [orders, setOrders] = React.useState<Any[]>([]);
  const [stats, setStats] = React.useState<Any>({ total: 0, active: 0, in_repair: 0, waiting_parts: 0, ready: 0, completed: 0, urgent_sla: 0 });
  const [filter, setFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'KANBAN' | 'TABLE' | 'CARDS'>('KANBAN');
  const [loading, setLoading] = React.useState(true);
  const [workbenchOrder, setWorkbenchOrder] = React.useState<Any|null>(null);
  const [receiptOrder, setReceiptOrder] = React.useState<Any|null>(null);
  const [checkoutOrder, setCheckoutOrder] = React.useState<Any|null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [mobileKanbanCol, setMobileKanbanCol] = React.useState<string>('all');
  const [openMenuOrderId, setOpenMenuOrderId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      api('/api/work-orders/my-work').then(r => r.ok ? r.json() : []),
      api('/api/work-orders/my-work/stats').then(r => r.ok ? r.json() : {})
    ]).then(([ordersData, statsData]) => {
      const raw = Array.isArray(ordersData) ? ordersData : (ordersData && ordersData.data ? ordersData.data : []);
      const list = raw.filter((o: Any) => !['ENTREGADO', 'DELIVERED', 'PAGADO', 'CANCELLED', 'CANCELADO'].includes(o.status));
      setOrders(list);
      setStats(statsData || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(orderId: string, newStatus: string, defaultNote?: string) {
    setUpdating(true);
    const r = await api(`/api/work-orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, technicianNotes: defaultNote || '' })
    });
    setUpdating(false);
    if (r.ok) {
      notify?.('✓ Estado de la orden actualizado a ' + newStatus);
      load();
    } else {
      notify?.('No se pudo actualizar el estado');
    }
  }

  function getSlaBadge(o: Any) {
    if (['COMPLETED', 'ENTREGADO', 'DELIVERED', 'LISTO_ENTREGA', 'PAGADO'].includes(o.status)) {
      return <span className="badge success">Culminado</span>;
    }
    const deadline = o.sla_deadline || o.estimated_delivery;
    if (!deadline) {
      return <span className="badge neutral">Meta {o.sla_hours || 48}h</span>;
    }
    const diffMs = new Date(deadline).getTime() - Date.now();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 0) {
      const passedHours = Math.abs(Math.round(diffHours));
      if (passedHours > 48) {
        const passedDays = Math.round(passedHours / 24);
        return <span className="badge danger">Atrasada {passedDays} d</span>;
      }
      return <span className="badge danger">Vencida {passedHours}h</span>;
    }
    if (diffHours <= 12) {
      const leftH = Math.floor(diffHours);
      const leftM = Math.round((diffHours - leftH) * 60);
      return <span className="badge warning">Urgente: {leftH}h {leftM}m</span>;
    }
    const leftDays = Math.floor(diffHours / 24);
    const leftH = Math.round(diffHours % 24);
    return <span className="badge neutral">{leftDays > 0 ? `${leftDays}d ` : ''}{leftH}h</span>;
  }

  function getStatusBadge(st: string) {
    const isQuoted = ['QUOTED', 'COTIZADO', 'PRESUPUESTADO'].includes(st);
    const isRepair = ['EN_REPARACION', 'IN_PROGRESS', 'APPROVED', 'APROBADO'].includes(st);
    const isWaiting = ['ESPERANDO_REPUESTOS', 'WAITING_PARTS'].includes(st);
    const isReady = ['LISTO_ENTREGA', 'COMPLETED'].includes(st);
    const isDelivered = ['ENTREGADO', 'DELIVERED', 'PAGADO'].includes(st);

    const tone = isQuoted ? 'warning' : isRepair ? 'brand' : isWaiting ? 'warning' : isReady ? 'success' : isDelivered ? 'neutral' : 'neutral';
    const label = isQuoted ? 'Cotizada al cliente' :
                  st === 'EN_REPARACION' ? 'En reparación' :
                  st === 'ESPERANDO_REPUESTOS' ? 'Esperando repuestos' :
                  st === 'LISTO_ENTREGA' ? 'Listo para entrega' :
                  st === 'ENTREGADO' ? 'Entregado' :
                  st === 'RECIBIDO' ? 'Recibido' :
                  st === 'EN_DIAGNOSTICO' ? 'En diagnóstico' : st;

    return <StatusBadge tone={tone}>{label}</StatusBadge>;
  }

  const filteredOrders = orders.filter(o => {
    if (['ENTREGADO', 'DELIVERED', 'PAGADO', 'CANCELLED', 'CANCELADO'].includes(o.status)) return false;
    if (filter !== 'ALL') {
      if (filter === 'ACTIVE') {
        if (!['RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REPUESTOS', 'OPEN', 'DIAGNOSIS', 'QUOTED', 'COTIZADO', 'PRESUPUESTADO', 'APPROVED', 'IN_PROGRESS'].includes(o.status)) return false;
      } else if (filter === 'QUOTED') {
        if (!['QUOTED', 'COTIZADO', 'PRESUPUESTADO'].includes(o.status)) return false;
      } else if (filter === 'IN_REPAIR') {
        if (!['EN_REPARACION', 'IN_PROGRESS', 'APPROVED', 'APROBADO'].includes(o.status)) return false;
      } else if (filter === 'WAITING_PARTS') {
        if (!['ESPERANDO_REPUESTOS', 'WAITING_PARTS'].includes(o.status)) return false;
      } else if (filter === 'READY') {
        if (!['LISTO_ENTREGA', 'COMPLETED', 'REJECTED', 'RECHAZADO'].includes(o.status)) return false;
      } else if (filter === 'URGENT') {
        const deadline = o.sla_deadline || o.estimated_delivery;
        if (!deadline) return false;
        const diffHours = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
        if (diffHours > 12) return false;
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = (o.order_number || '').toLowerCase().includes(q) ||
                    (o.device_brand || '').toLowerCase().includes(q) ||
                    (o.device_model || '').toLowerCase().includes(q) ||
                    (o.serial_number || '').toLowerCase().includes(q) ||
                    (o.customer_name || '').toLowerCase().includes(q) ||
                    (o.reported_fault || '').toLowerCase().includes(q) ||
                    (o.diagnosis || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const kanbanColumns = [
    {
      id: 'COL_DIAG',
      title: 'Por diagnosticar',
      statuses: ['OPEN', 'RECIBIDO', 'EN_DIAGNOSTICO', 'DIAGNOSIS'],
      borderColor: '#94a3b8'
    },
    {
      id: 'COL_QUOTED',
      title: 'Cotizadas al cliente',
      statuses: ['QUOTED', 'COTIZADO', 'PRESUPUESTADO'],
      borderColor: '#8b5cf6'
    },
    {
      id: 'COL_PARTS',
      title: 'Esperando repuestos',
      statuses: ['ESPERANDO_REPUESTOS', 'WAITING_PARTS'],
      borderColor: '#d97706'
    },
    {
      id: 'COL_REPAIR',
      title: 'En reparación y pruebas',
      statuses: ['EN_REPARACION', 'IN_PROGRESS', 'APPROVED', 'APROBADO', 'TESTING', 'EN_PRUEBAS', 'PRUEBAS'],
      borderColor: '#2563eb'
    },
    {
      id: 'COL_READY',
      title: 'Listo para entrega',
      statuses: ['LISTO_ENTREGA', 'COMPLETED', 'REJECTED', 'RECHAZADO'],
      borderColor: '#059669'
    }
  ];

  return (
    <>
      {/* 1. Page Header (Section 6.2) */}
      <PageHeader
        title="Mi trabajo"
        description="Banco técnico de órdenes asignadas, avance de diagnósticos y repuestos"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="primary-action"
              onClick={() => { if (go) go('marketplace'); }}
            >
              <Inbox size={15} />
              <span>Tomar de la bolsa</span>
            </button>
            <IconButton
              icon={RefreshCw}
              label="Recargar órdenes"
              onClick={load}
            />
          </div>
        }
      />

      {/* 2. KPI Strip (6 celdas limpias) */}
      <KpiStrip
        items={[
          {
            label: 'Activas en taller',
            value: orders.length,
            hint: 'Órdenes en curso',
            active: filter === 'ALL',
            onClick: () => { setFilter('ALL'); setMobileKanbanCol('all'); }
          },
          {
            label: 'Cotizadas al cliente',
            value: stats.quoted != null ? stats.quoted : orders.filter(o => ['QUOTED', 'COTIZADO', 'PRESUPUESTADO'].includes(o.status)).length,
            hint: 'Esperando aprobación',
            tone: 'warning',
            active: filter === 'QUOTED',
            onClick: () => { setFilter('QUOTED'); setMobileKanbanCol('COL_QUOTED'); }
          },
          {
            label: 'En reparación',
            value: stats.in_repair || 0,
            hint: 'En banco de trabajo',
            active: filter === 'IN_REPAIR',
            onClick: () => { setFilter('IN_REPAIR'); setMobileKanbanCol('COL_REPAIR'); }
          },
          {
            label: 'Esperando repuestos',
            value: stats.waiting_parts || 0,
            hint: 'Piezas pendientes',
            active: filter === 'WAITING_PARTS',
            onClick: () => { setFilter('WAITING_PARTS'); setMobileKanbanCol('COL_PARTS'); }
          },
          {
            label: 'Listas para entrega',
            value: stats.ready || 0,
            hint: 'Por entregar/cobrar',
            active: filter === 'READY',
            onClick: () => { setFilter('READY'); setMobileKanbanCol('COL_READY'); }
          },
          {
            label: 'SLA crítico (<12h)',
            value: stats.urgent_sla || 0,
            hint: 'Prioridad inmediata',
            tone: Number(stats.urgent_sla || 0) > 0 ? 'danger' : 'default',
            active: filter === 'URGENT',
            onClick: () => { setFilter('URGENT'); setMobileKanbanCol('all'); }
          }
        ]}
      />

      {/* 3. Toolbar con FilterTabs único subrayado y controles a la derecha */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <FilterTabs
          tabs={[
            { id: 'ALL', label: 'Todas las activas', count: orders.length },
            { id: 'QUOTED', label: 'Cotizadas', count: stats.quoted != null ? stats.quoted : orders.filter(o => ['QUOTED', 'COTIZADO', 'PRESUPUESTADO'].includes(o.status)).length },
            { id: 'WAITING_PARTS', label: 'Esperando repuestos', count: stats.waiting_parts || 0 },
            { id: 'IN_REPAIR', label: 'En reparación', count: stats.in_repair || 0 },
            { id: 'READY', label: 'Listas para entrega', count: stats.ready || 0 }
          ]}
          activeTab={filter}
          onChange={(id: string) => {
            setFilter(id);
            if (id === 'ALL') setMobileKanbanCol('all');
            else if (id === 'QUOTED') setMobileKanbanCol('COL_QUOTED');
            else if (id === 'WAITING_PARTS') setMobileKanbanCol('COL_PARTS');
            else if (id === 'IN_REPAIR') setMobileKanbanCol('COL_REPAIR');
            else if (id === 'READY') setMobileKanbanCol('COL_READY');
          }}
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ width: 260 }}>
            <Search size={14} />
            <input
              placeholder="Buscar orden, cliente, serie..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
                title="Limpiar"
              >
                ✕
              </button>
            )}
          </div>

          <div className="view-mode-pill-toggle">
            <button
              type="button"
              className={`view-mode-item ${viewMode === 'KANBAN' ? 'active' : ''}`}
              onClick={() => setViewMode('KANBAN')}
            >
              Tablero
            </button>
            <button
              type="button"
              className={`view-mode-item ${viewMode === 'TABLE' ? 'active' : ''}`}
              onClick={() => setViewMode('TABLE')}
            >
              Tabla
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#64748b' }}>Cargando órdenes asignadas a tu taller...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '40px 20px', background: '#ffffff', borderRadius: 14, border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎉</div>
          <h3 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>¡Todo al día en tu banco de trabajo!</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
            {orders.length === 0 ? 'No tienes órdenes de servicio asignadas actualmente.' : 'No hay órdenes que coincidan con los filtros aplicados.'}
          </p>
        </div>
      ) : viewMode === 'KANBAN' ? (
        /* ================= 1. KANBAN VIEW (ZERO OVERLAP CANVAS) ================= */
        <div>
          <div className="kanban-board-canvas" id="mywork-kanban-canvas">
            {kanbanColumns
              .filter(col => mobileKanbanCol === 'all' || mobileKanbanCol === col.id)
              .map(col => {
                const colOrders = filteredOrders.filter(o => col.statuses.includes(o.status));
                return (
                  <div
                    className={`kanban-column ${mobileKanbanCol !== 'all' ? 'single-focus' : ''}`}
                    key={col.id}
                    id={`mywork-kcol-${col.id}`}
                  >
                    <div className="kanban-col-head" style={{ borderTop: `3px solid ${col.borderColor}`, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="col-dot" style={{ background: col.borderColor }} />
                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
                          {col.title.replace(/^[0-9]\.\s*/, '')}
                        </span>
                      </div>
                      <span className="kanban-badge" style={{ background: `${col.borderColor}18`, color: col.borderColor, fontWeight: 700, borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>
                        {colOrders.length}
                      </span>
                    </div>
                    <div className="kanban-col-body col-scroll">
                      {colOrders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '12px' }}>
                          Sin órdenes aquí
                        </div>
                      ) : (
                        colOrders.map(o => {
                          const cleanPhone = (o.customer_phone || '').replace(/[^0-9]/g, '');
                          const waUrl = cleanPhone
                            ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${o.customer_name || 'estimado cliente'}, te escribe tu técnico de Fixme sobre tu equipo ${o.device_brand || ''} ${o.device_model || ''} (Orden ${o.order_number || ''}).`)}`
                            : '';
                          const itemsCount = (o.items || []).length;
                          const quoteVal = Number(o.quote || 0);

                          return (
                            <div
                              className="kanban-card-enhanced"
                              key={o.id}
                              onClick={() => setWorkbenchOrder(o)}
                              style={{ cursor: 'pointer' }}
                              title="Clic para abrir Banco de Trabajo técnico"
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span className="card-folio">{o.order_number || 'OT-#'}</span>
                                <div>{getSlaBadge(o)}</div>
                              </div>

                              <div className="card-device" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text)' }}>
                                <Smartphone size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <span>{o.device_brand} {o.device_model}</span>
                              </div>
                              {o.serial_number && (
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                  S/N: <code>{o.serial_number}</code>
                                </div>
                              )}

                              <div className="card-fault" style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0' }}>
                                <strong>Falla:</strong> "{o.reported_fault || 'Sin reporte inicial'}"
                              </div>

                              {o.diagnosis && (
                                <div style={{ fontSize: '11px', color: 'var(--success-dark)', background: 'var(--success-light)', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--success-border)', marginBottom: 6 }}>
                                  <strong>Diagnóstico:</strong> {o.diagnosis}
                                </div>
                              )}

                              <div className="card-customer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <span title={o.customer_name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <User size={12} /> {o.customer_name || 'Cliente'}
                                </span>
                                {o.customer_phone && (
                                  <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Phone size={11} /> {o.customer_phone}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 8px' }}>
                                {itemsCount > 0 ? (
                                  <span className="kanban-items-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Package size={12} /> {itemsCount} ítems (${quoteVal.toFixed(2)})
                                  </span>
                                ) : quoteVal > 0 ? (
                                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text)' }}>
                                    Cotiz: ${quoteVal.toFixed(2)}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Sin cotización</span>
                                )}
                              </div>

                              {/* Primary Action Button + Secondary Context Menu */}
                              <div
                                style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}
                                onClick={e => e.stopPropagation()}
                              >
                                {col.id === 'COL_DIAG' && (
                                  <button
                                    type="button"
                                    className="primary-action"
                                    style={{ flex: 1, height: 30, fontSize: '11.5px', borderRadius: '6px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                    disabled={updating}
                                    onClick={() => updateStatus(o.id, 'EN_REPARACION', 'Técnico inició reparación')}
                                  >
                                    <Wrench size={13} /> Iniciar reparación
                                  </button>
                                )}

                                {col.id === 'COL_QUOTED' && (
                                  <button
                                    type="button"
                                    className="primary-action"
                                    style={{ flex: 1, height: 30, fontSize: '11.5px', borderRadius: '6px', background: '#059669', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                    disabled={updating}
                                    onClick={() => updateStatus(o.id, 'EN_REPARACION', 'Cliente autorizó presupuesto, iniciando reparación')}
                                    title="Cliente aceptó el presupuesto"
                                  >
                                    <Check size={13} /> Cliente Aprobó
                                  </button>
                                )}

                                {col.id === 'COL_REPAIR' && (
                                  <button
                                    type="button"
                                    className="primary-action"
                                    style={{ flex: 1, height: 30, fontSize: '11.5px', borderRadius: '6px', background: 'var(--success)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                    disabled={updating}
                                    onClick={() => updateStatus(o.id, 'LISTO_ENTREGA', 'Reparación culminada por técnico')}
                                  >
                                    <Check size={13} /> Marcar listo
                                  </button>
                                )}

                                {col.id === 'COL_PARTS' && (
                                  <button
                                    type="button"
                                    className="primary-action"
                                    style={{ flex: 1, height: 30, fontSize: '11.5px', borderRadius: '6px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                    disabled={updating}
                                    onClick={() => updateStatus(o.id, 'EN_REPARACION', 'Repuestos disponibles, reanudando')}
                                  >
                                    <Wrench size={13} /> Reanudar reparación
                                  </button>
                                )}

                                {col.id === 'COL_READY' && (
                                  <button
                                    type="button"
                                    className="primary-action"
                                    style={{ flex: 1, height: 30, fontSize: '11.5px', borderRadius: '6px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, background: '#059669', color: '#fff' }}
                                    disabled={updating}
                                    onClick={() => setCheckoutOrder(o)}
                                  >
                                    🤝 Cobrar y Entregar
                                  </button>
                                )}

                                {/* Context Menu Button */}
                                <div style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={() => setOpenMenuOrderId(openMenuOrderId === o.id ? null : o.id)}
                                    title="Más opciones de la orden"
                                    style={{
                                      padding: '6px 9px',
                                      borderRadius: '7px',
                                      border: '1px solid #cbd5e1',
                                      background: openMenuOrderId === o.id ? 'var(--accent-light)' : '#f8fafc',
                                      color: openMenuOrderId === o.id ? 'var(--accent)' : '#475569',
                                      fontSize: '13px',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      lineHeight: 1
                                    }}
                                  >
                                    ⋯
                                  </button>

                                  {openMenuOrderId === o.id && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        bottom: 'calc(100% + 4px)',
                                        right: 0,
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '10px',
                                        boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                                        width: '185px',
                                        zIndex: 60,
                                        padding: '5px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px'
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => { setOpenMenuOrderId(null); setWorkbenchOrder(o); }}
                                        style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b' }}
                                      >
                                        🔧 Ficha & Taller
                                      </button>
                                      {['QUOTED', 'COTIZADO', 'PRESUPUESTADO'].includes(o.status) && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => { setOpenMenuOrderId(null); updateStatus(o.id, 'EN_REPARACION', 'Cliente autorizó presupuesto'); }}
                                            style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 700 }}
                                          >
                                            👍 Cliente Aprobó
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => { setOpenMenuOrderId(null); updateStatus(o.id, 'ESPERANDO_REPUESTOS', 'Cliente aprobó, esperando repuestos'); }}
                                            style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#d97706' }}
                                          >
                                            ⏳ Pedir Repuestos
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => { setOpenMenuOrderId(null); updateStatus(o.id, 'REJECTED', 'Cliente rechazó el presupuesto'); }}
                                            style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626' }}
                                          >
                                            ❌ Cliente Rechazó
                                          </button>
                                        </>
                                      )}
                                      {['LISTO_ENTREGA', 'COMPLETED'].includes(o.status) && (
                                        <button
                                          type="button"
                                          onClick={() => { setOpenMenuOrderId(null); setCheckoutOrder(o); }}
                                          style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 700 }}
                                        >
                                          🤝 Cobrar y Entregar
                                        </button>
                                      )}
                                      {col.id === 'COL_REPAIR' && (
                                        <button
                                          type="button"
                                          onClick={() => { setOpenMenuOrderId(null); updateStatus(o.id, 'ESPERANDO_REPUESTOS', 'Esperando repuestos'); }}
                                          style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#ea580c' }}
                                        >
                                          ⏳ Esperando Repuestos
                                        </button>
                                      )}
                                      {waUrl && (
                                        <a
                                          href={waUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={() => setOpenMenuOrderId(null)}
                                          style={{ padding: '7px 8px', borderRadius: '6px', textDecoration: 'none', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a' }}
                                        >
                                          💬 WhatsApp
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => { setOpenMenuOrderId(null); setReceiptOrder(o); }}
                                        style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b' }}
                                      >
                                        🖨️ Ticket Térmico
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : viewMode === 'TABLE' ? (
        /* ================= 2. TABLE VIEW (COMPACT FOR HIGH VOLUME) ================= */
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="items-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>N° Orden</th>
                  <th>SLA / Plazo</th>
                  <th>Equipo & Serie</th>
                  <th>Cliente</th>
                  <th>Falla Reportada</th>
                  <th>Diagnóstico</th>
                  <th>Cotización</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => {
                  const cleanPhone = (o.customer_phone || '').replace(/[^0-9]/g, '');
                  const waUrl = cleanPhone
                    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${o.customer_name || 'estimado cliente'}, te escribe tu técnico sobre tu orden ${o.order_number || ''}.`)}`
                    : '';
                  const itemsCount = (o.items || []).length;
                  const quoteVal = Number(o.quote || 0);

                  return (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setWorkbenchOrder(o)}>
                      <td style={{ fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {o.order_number || 'OT-#'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{getSlaBadge(o)}</td>
                      <td>
                        <strong>{o.device_brand} {o.device_model}</strong>
                        {o.serial_number && <div style={{ fontSize: '10.5px', color: '#64748b' }}>S/N: {o.serial_number}</div>}
                      </td>
                      <td>
                        <div>{o.customer_name || 'Sin nombre'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{o.customer_phone || ''}</div>
                      </td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.reported_fault}>
                        {o.reported_fault || '-'}
                      </td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: o.diagnosis ? '#166534' : '#94a3b8' }} title={o.diagnosis}>
                        {o.diagnosis || 'Pendiente'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700 }}>${quoteVal.toFixed(2)}</div>
                        {itemsCount > 0 && <span style={{ fontSize: '10px', color: '#64748b' }}>{itemsCount} ítems</span>}
                      </td>
                      <td>{getStatusBadge(o.status)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary-sm"
                              style={{ padding: '4px 8px', fontSize: '11px', textDecoration: 'none', color: '#16a34a' }}
                              title="Chat WhatsApp"
                            >
                              💬 WA
                            </a>
                          )}
                          <button
                            type="button"
                            className="btn-secondary-sm"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => setReceiptOrder(o)}
                            title="Imprimir Comprobante 80mm"
                          >
                            🖨️
                          </button>
                          <button
                            type="button"
                            className="btn-primary-sm"
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            onClick={() => setWorkbenchOrder(o)}
                          >
                            🔧 Taller
                          </button>
                          {['QUOTED', 'COTIZADO', 'PRESUPUESTADO'].includes(o.status) && (
                            <button
                              type="button"
                              className="btn-primary-sm"
                              style={{ padding: '4px 10px', fontSize: '11px', background: '#059669', borderColor: '#059669' }}
                              onClick={() => updateStatus(o.id, 'EN_REPARACION', 'Cliente autorizó presupuesto')}
                              title="Cliente autorizó cotización"
                            >
                              👍 Aprobó
                            </button>
                          )}
                          {['LISTO_ENTREGA', 'COMPLETED', 'REJECTED', 'RECHAZADO'].includes(o.status) && (
                            <button
                              type="button"
                              className="btn-primary-sm"
                              style={{ padding: '4px 10px', fontSize: '11px', background: '#059669', borderColor: '#059669' }}
                              onClick={() => setCheckoutOrder(o)}
                              title="Cobrar y entregar orden al cliente"
                            >
                              🤝 Cobrar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= 3. CARDS GRID VIEW ================= */
        <div className="mywork-grid">
          {filteredOrders.map(o => {
            const cleanPhone = (o.customer_phone || '').replace(/[^0-9]/g, '');
            const waMsg = encodeURIComponent(`Hola ${o.customer_name || 'estimado cliente'}, te escribe tu técnico de Fixme sobre tu equipo ${o.device_brand || ''} ${o.device_model || ''} (Orden ${o.order_number || ''}).`);
            const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMsg}` : '';

            const isQuoted = ['QUOTED', 'COTIZADO', 'PRESUPUESTADO'].includes(o.status);
            const isRepair = ['EN_REPARACION', 'IN_PROGRESS', 'APPROVED', 'APROBADO'].includes(o.status);
            const isWaiting = ['ESPERANDO_REPUESTOS', 'WAITING_PARTS'].includes(o.status);
            const isReady = ['LISTO_ENTREGA', 'COMPLETED'].includes(o.status);
            const itemsCount = (o.items || []).length;
            const quoteVal = Number(o.quote || 0);

            return (
              <div key={o.id} className="mywork-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b' }}>{o.order_number || 'OT-#'}</span>
                      <div style={{ marginTop: 2 }}>{getSlaBadge(o)}</div>
                    </div>
                    <div>{getStatusBadge(o.status)}</div>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                    📱 {o.device_brand} {o.device_model}
                  </div>
                  {o.serial_number && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: 6 }}>
                      S/N: <code>{o.serial_number}</code>
                    </div>
                  )}

                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 8, fontSize: '12px', color: '#334155', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase', marginBottom: 2 }}>Falla Reportada:</div>
                    <div>"{o.reported_fault || 'Sin detalle de falla'}"</div>
                    {o.accessories && <div style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>Accesorios: {o.accessories}</div>}
                  </div>

                  {o.diagnosis && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 10px', borderRadius: 8, fontSize: '12px', color: '#166534', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: '10.5px', textTransform: 'uppercase', marginBottom: 2 }}>Diagnóstico Técnico:</div>
                      <div>{o.diagnosis}</div>
                    </div>
                  )}

                  {o.technician_notes && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '8px 10px', borderRadius: 8, fontSize: '11.5px', color: '#1e40af', marginBottom: 8 }}>
                      <strong>Nota de avance:</strong> {o.technician_notes}
                    </div>
                  )}

                  {/* Budget & Parts summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, marginBottom: 10, fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Presupuesto:</span>
                    <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                      ${quoteVal.toFixed(2)} {itemsCount > 0 && <small style={{ fontWeight: 500, color: '#64748b' }}>({itemsCount} ítems)</small>}
                    </strong>
                  </div>

                  {/* Customer Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', fontSize: '12px', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>👤 {o.customer_name || 'Cliente'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>📞 {o.customer_phone || 'Sin teléfono'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {waUrl && (
                        <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#25d366', color: '#ffffff', padding: '4px 8px', borderRadius: 6, fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                          💬 WhatsApp
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setReceiptOrder(o)}
                        className="btn-secondary-sm"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        title="Imprimir Ticket Térmico 80mm"
                      >
                        🖨️
                      </button>
                    </div>
                  </div>
                </div>

                {/* Technician Quick Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 6 }}>
                  <button
                    type="button"
                    className="btn-primary-sm"
                    style={{ flex: '1 1 100%', padding: '7px 12px', fontSize: '12px', justifyContent: 'center' }}
                    onClick={() => setWorkbenchOrder(o)}
                  >
                    🔧 Abrir Ficha Técnica & Taller
                  </button>
                  {isQuoted && (
                    <button
                      type="button"
                      className="tech-action-btn"
                      style={{ background: '#059669', color: '#ffffff', borderColor: '#059669', fontWeight: 700 }}
                      disabled={updating}
                      onClick={() => updateStatus(o.id, 'EN_REPARACION', 'Cliente autorizó presupuesto')}
                    >
                      👍 Cliente Aprobó
                    </button>
                  )}
                  {!isRepair && !isReady && !isQuoted && (
                    <button
                      className="tech-action-btn tech-action-repair"
                      disabled={updating}
                      onClick={() => updateStatus(o.id, 'EN_REPARACION', 'Técnico inició la reparación')}
                    >
                      ▶ Iniciar Reparación
                    </button>
                  )}
                  {!isWaiting && !isReady && (
                    <button
                      className="tech-action-btn tech-action-parts"
                      disabled={updating}
                      onClick={() => updateStatus(o.id, 'ESPERANDO_REPUESTOS', 'Esperando repuestos')}
                    >
                      ⏳ Esperar Repuestos
                    </button>
                  )}
                  {!isReady && (
                    <button
                      className="tech-action-btn tech-action-ready"
                      disabled={updating}
                      onClick={() => updateStatus(o.id, 'LISTO_ENTREGA', 'Reparación culminada con éxito')}
                    >
                      ✓ Marcar Listo
                    </button>
                  )}
                  {isReady && (
                    <button
                      type="button"
                      className="tech-action-btn"
                      style={{ background: '#059669', color: '#ffffff', borderColor: '#059669', fontWeight: 700 }}
                      onClick={() => setCheckoutOrder(o)}
                    >
                      🤝 Cobrar y Entregar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Technician Workbench Modal (Ficha Técnica, Repuestos, Mano de Obra, Cotización) */}
      {workbenchOrder && (
        <TechnicianWorkbenchModal
          order={workbenchOrder}
          onClose={() => setWorkbenchOrder(null)}
          onSaved={load}
          api={api}
          notify={notify}
          branchId={branchId}
          tenantName={localStorage.tenantName || 'Fixme Tiendas'}
          onCheckout={(o: Any) => setCheckoutOrder(o)}
        />
      )}

      {/* Modal Cobro y Entrega (Caja + Garantía) */}
      {checkoutOrder && (
        <WorkOrderCheckoutModal
          order={checkoutOrder}
          onClose={() => setCheckoutOrder(null)}
          onSuccess={(data: Any) => {
            setCheckoutOrder(null);
            notify?.(`¡Trabajo finalizado! Cobro registrado y Garantía #${data.warrantyCode} emitida.`);
            load();
            setReceiptOrder({
              ...checkoutOrder,
              status: data.status,
              warranty_code: data.warrantyCode,
              warranty_days: data.warrantyDays,
              payment_method: data.paymentMethod,
              payment_amount: data.paymentAmount
            });
          }}
        />
      )}

      {/* Thermal Receipt Modal (Comprobante 80mm para el cliente o técnico) */}
      {receiptOrder && (
        <WorkOrderReceiptModal
          order={receiptOrder}
          onClose={() => setReceiptOrder(null)}
          tenantName={localStorage.tenantName || 'Fixme Tiendas'}
        />
      )}
    </>
  );
}

export default MyWork;
