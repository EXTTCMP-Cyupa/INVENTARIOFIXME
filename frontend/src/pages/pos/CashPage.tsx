import React from 'react';
import { Any, getBranchId } from '../../sharedConfig';
import { CorteZModal } from '../../commercialModals';
import { PageHeader, KpiStrip, IconButton } from '../../sharedLayout';
import { RefreshCw, Plus, Printer, CreditCard, Banknote, ShoppingBag, Building2, Lock, PlayCircle, Coins } from 'lucide-react';

export function Cash({api,notify,branchId: propBranchId}:{api:(u:string,o?:RequestInit)=>Promise<Response>,notify:(s:string)=>void,branchId?: string}){
const branchId = propBranchId || getBranchId();
  const [s, setS] = React.useState<Any|null>(null);
  const [history, setHistory] = React.useState<Any[]>([]);
  const [opening, setOpening] = React.useState('100');
  const [movementFilter, setMovementFilter] = React.useState('ALL');

  // Modals
  const [showMoveModal, setShowMoveModal] = React.useState(false);
  const [showDepositModal, setShowDepositModal] = React.useState(false);
  const [showCloseModal, setShowCloseModal] = React.useState(false);
  const [corteZSummary, setCorteZSummary] = React.useState<Any|null>(null);
  const [useDenom, setUseDenom] = React.useState(true);
  const [blindMode, setBlindMode] = React.useState(true);
  const [denoms, setDenoms] = React.useState<Record<string, number>>({
    b100: 0, b50: 0, b20: 0, b10: 0, b5: 0, b1: 0,
    c100: 0, c50: 0, c25: 0, c10: 0, c5: 0, c1: 0
  });

  const updateDenom = (k: string, v: number) => {
    const next = { ...denoms, [k]: Math.max(0, v) };
    setDenoms(next);
    const tot = (
      (next.b100 || 0) * 100 +
      (next.b50 || 0) * 50 +
      (next.b20 || 0) * 20 +
      (next.b10 || 0) * 10 +
      (next.b5 || 0) * 5 +
      (next.b1 || 0) * 1 +
      (next.c100 || 0) * 1.00 +
      (next.c50 || 0) * 0.50 +
      (next.c25 || 0) * 0.25 +
      (next.c10 || 0) * 0.10 +
      (next.c5 || 0) * 0.05 +
      (next.c1 || 0) * 0.01
    );
    setCloseForm(f => ({ ...f, countedCash: tot.toFixed(2) }));
  };

  // Forms
  const [movement, setMovement] = React.useState({ type: 'CASH_IN', paymentMethod: 'CASH', amount: '', reason: '' });
  const [depositForm, setDepositForm] = React.useState({ destination: 'BANCO_PICHINCHA', amount: '', reference: '', notes: '' });
  const [closeForm, setCloseForm] = React.useState({ countedCash: '', depositDestination: 'BANCO_PICHINCHA', depositReference: '', depositAmount: '', nextDayFund: '50', notes: '' });

  const load = React.useCallback(() => {
    api('/api/cash/current?branchId=' + branchId).then(r => r.json()).then(x => setS(x && x.id ? x : null));
    api('/api/cash/movements?branchId=' + branchId).then(r => r.ok ? r.json() : []).then(setHistory);
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  async function open() {
    const r = await api('/api/cash/open?branchId=' + branchId, {
      method: 'POST',
      body: JSON.stringify({ openingCash: Number(opening), amounts: { CASH: Number(opening) } })
    });
    if (r.ok) { notify('Caja de turno abierta exitosamente'); load(); }
  }

  async function move(e: React.FormEvent) {
    e.preventDefault();
    const r = await api('/api/cash/movement?branchId=' + branchId, {
      method: 'POST',
      body: JSON.stringify({ ...movement, amount: Number(movement.amount) })
    });
    if (r.ok) {
      notify('Movimiento registrado en caja');
      setMovement({ type: 'CASH_IN', paymentMethod: 'CASH', amount: '', reason: '' });
      setShowMoveModal(false);
      load();
    }
  }

  async function recordDeposit(e: React.FormEvent) {
    e.preventDefault();
    const r = await api('/api/cash/deposit?branchId=' + branchId, {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(depositForm.amount),
        destination: depositForm.destination,
        reference: depositForm.reference,
        notes: depositForm.notes
      })
    });
    if (r.ok) {
      notify('Depósito a banco registrado');
      setDepositForm({ destination: 'BANCO_PICHINCHA', amount: '', reference: '', notes: '' });
      setShowDepositModal(false);
      load();
    }
  }

  async function close(e: React.FormEvent) {
    e.preventDefault();
    const counted = Number(closeForm.countedCash || 0);
    const r = await api('/api/cash/close?branchId=' + branchId, {
      method: 'POST',
      body: JSON.stringify({
        counted: {
          CASH: counted,
          CARD: Number(s && s.paymentsSummary && s.paymentsSummary.card || s && s.expected && s.expected.CARD || 0),
          TRANSFER: Number(s && s.paymentsSummary && s.paymentsSummary.transfer || s && s.expected && s.expected.TRANSFER || 0)
        },
        depositDestination: closeForm.depositDestination,
        depositReference: closeForm.depositReference,
        depositAmount: Number(closeForm.depositAmount || 0),
        nextDayFund: Number(closeForm.nextDayFund || 0),
        notes: closeForm.notes,
        countedBreakdown: denoms
      })
    });
    if (r.ok) {
      notify('Caja cerrada y arqueada correctamente');
      setShowCloseModal(false);
      setCorteZSummary({
        openingCash: s?.openingCash || s?.expected?.OPENING || 0,
        salesCash: s?.salesCash || (s?.expected?.CASH ? Math.max(0, s.expected.CASH - (s.openingCash || 0)) : 0),
        posSalesCash: s?.posSalesCash || 0,
        workOrdersCash: s?.workOrdersCash || 0,
        inflowsCash: s?.inflowsCash || 0,
        outflowsCash: s?.outflowsCash || 0,
        depositsCash: s?.depositsCash || 0,
        cashInDrawer: inDrawer,
        counted: counted,
        difference: diff,
        depositAmount: Number(closeForm.depositAmount || 0),
        depositDestination: closeForm.depositDestination,
        depositReference: closeForm.depositReference,
        nextDayFund: Number(closeForm.nextDayFund || 0),
        paymentsSummary: s?.paymentsSummary,
        fiscalSummary: s?.fiscalSummary,
        salesBreakdown: s?.salesBreakdown,
        workOrdersBreakdown: s?.workOrdersBreakdown,
        drawerReconciliation: s?.drawerReconciliation
      });
      load();
    }
  }

  const inDrawer = Number(s?.currentCashInDrawer ?? (s?.expected?.CASH ?? 0));
  const countedNum = Number(closeForm.countedCash || 0);
  const diff = closeForm.countedCash ? countedNum - inDrawer : 0;

  const filteredHistory = history.filter(m => {
    if (movementFilter === 'ALL') return true;
    if (movementFilter === 'DEPOSIT') return m.type === 'DEPOSIT';
    if (movementFilter === 'CASH_IN') return m.type === 'CASH_IN';
    if (movementFilter === 'CASH_OUT') return m.type === 'CASH_OUT' || m.type === 'OUT';
    if (movementFilter === 'SALE_CASH') return m.type === 'SALE_CASH';
    return true;
  });

  return (
    <>
      <PageHeader
        title="Caja y turnos"
        description="Apertura, arqueo y conciliación de movimientos de efectivo"
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {s && (
              <>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setCorteZSummary({
                      openingCash: s.openingCash || s.expected?.OPENING || 0,
                      salesCash: s.salesCash || (s.expected?.CASH ? Math.max(0, s.expected.CASH - (s.openingCash || 0)) : 0),
                      posSalesCash: s.posSalesCash || 0,
                      workOrdersCash: s.workOrdersCash || 0,
                      inflowsCash: s.inflowsCash || 0,
                      outflowsCash: s.outflowsCash || 0,
                      depositsCash: s.depositsCash || 0,
                      cashInDrawer: inDrawer,
                      counted: inDrawer,
                      difference: 0,
                      depositAmount: 0,
                      depositDestination: 'Banco',
                      depositReference: 'ARQUEO-PREVIO',
                      nextDayFund: 50,
                      paymentsSummary: s.paymentsSummary,
                      fiscalSummary: s.fiscalSummary,
                      salesBreakdown: s.salesBreakdown,
                      workOrdersBreakdown: s.workOrdersBreakdown,
                      drawerReconciliation: s.drawerReconciliation
                    });
                  }}
                  title="Imprimir arqueo Corte Z"
                >
                  <Printer size={14} /> <span>Imprimir corte Z</span>
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setShowMoveModal(true)}
                >
                  <Plus size={14} /> <span>Entrada / Gasto</span>
                </button>
                <button
                  type="button"
                  className="danger-action"
                  onClick={() => {
                    setCloseForm(f => ({ ...f, countedCash: inDrawer.toFixed(2) }));
                    setShowCloseModal(true);
                  }}
                >
                  <span>Cerrar caja</span>
                </button>
              </>
            )}
            <IconButton icon={RefreshCw} label="Actualizar caja" onClick={load} />
          </div>
        }
      />

      <KpiStrip
        items={[
          {
            label: 'Estado de caja',
            value: s ? 'Abierta' : 'Cerrada',
            hint: s?.openedAt ? `Desde ${new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Sin turno activo',
            tone: s ? 'success' : 'default'
          },
          {
            label: 'Fondo de apertura',
            value: `$${Number(s?.openingCash || 0).toFixed(2)}`,
            hint: 'Efectivo inicial'
          },
          {
            label: 'Cobros Efectivo (Ventas+Taller)',
            value: `+$${Number(s?.salesCash || 0).toFixed(2)}`,
            hint: `Ventas: $${Number(s?.posSalesCash || 0).toFixed(2)} | Taller: $${Number(s?.workOrdersCash || 0).toFixed(2)}`,
            tone: Number(s?.salesCash || 0) > 0 ? 'success' : 'default'
          },
          {
            label: 'Efectivo en gaveta',
            value: `$${inDrawer.toFixed(2)}`,
            hint: 'Físico esperado hoy'
          },
          {
            label: 'Total Negocio Turno',
            value: `$${Number(s?.paymentsSummary?.total || 0).toFixed(2)}`,
            hint: 'Efectivo + Tarjetas + Bancos',
            tone: 'success'
          }
        ]}
      />

      {!s ? (
        <section className="panel" style={{ maxWidth: '520px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--warning-border)' }}><Lock size={32} style={{ color: 'var(--warning)' }} /></div></div>
            <h3>No hay turno de caja abierto</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
              Para registrar ventas y movimientos en efectivo en esta sucursal, inicia un nuevo turno con tu fondo base de cambio.
            </p>
            <div className="inline-form" style={{ justifyContent: 'center' }}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={opening}
                onChange={e => setOpening(e.target.value)}
                placeholder="Fondo base ($)"
                style={{ width: '150px', fontSize: '16px', fontWeight: 700 }}
              />
              <button className="primary-action" onClick={open}>
                <PlayCircle size={15} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }} /> Abrir Turno de Caja
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* CASH BENTO HERO */}
          <div className="cash-bento-hero">
            {/* HERO DRAWER PRIMARY CARD */}
            <div className="cash-drawer-primary">
              <div>
                <small style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: '6px' }}>
                  <Banknote size={15} style={{ color: 'var(--primary)' }} />
                  DINERO FÍSICO EN GAVETA (ACTUAL ESPERADO)
                </small>
                <div className="cash-drawer-val num" style={{ fontSize: '38px', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0' }}>
                  ${inDrawer.toFixed(2)}
                </div>
                <div>
                  <span className="cash-status-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
                    <span style={{ color: 'var(--success)' }}>●</span> Turno activo desde {s.openedAt ? new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 18 }}>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setShowDepositModal(true)}
                >
                  <Building2 size={14} /> <span>Depositar a Banco</span>
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setShowMoveModal(true)}
                >
                  <Plus size={14} /> <span>Entrada / Gasto</span>
                </button>
                <button
                  type="button"
                  className="danger-action"
                  onClick={() => {
                    setCloseForm(f => ({ ...f, countedCash: inDrawer.toFixed(2) }));
                    setShowCloseModal(true);
                  }}
                >
                  <span>Cerrar y Arquear</span>
                </button>
              </div>
            </div>

            {/* SUB-KPI GRID */}
            <div className="cash-subkpi-grid">
              <div className="cash-subkpi-card">
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Fondo Apertura</small>
                <strong className="num" style={{ fontSize: 17, color: 'var(--text-primary)' }}>+${Number(s.openingCash || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-subkpi-card">
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Ventas Mostrador</small>
                <strong className="num" style={{ fontSize: 17, color: 'var(--primary)' }}>+${Number(s.posSalesCash != null ? s.posSalesCash : s.salesCash || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-subkpi-card">
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Taller / OT</small>
                <strong className="num" style={{ fontSize: 17, color: 'var(--info)' }}>+${Number(s.workOrdersCash || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-subkpi-card">
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Ingresos Extra</small>
                <strong className="num" style={{ fontSize: 17, color: 'var(--success-text)' }}>+${Number(s.inflows || s.inflowsCash || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-subkpi-card">
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Gastos / Salidas</small>
                <strong className="num" style={{ fontSize: 17, color: 'var(--danger-text)' }}>-${Number(s.outflows || s.outflowsCash || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-subkpi-card">
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Depósitos Banco</small>
                <strong className="num" style={{ fontSize: 17, color: 'var(--warning-text)' }}>-${Number(s.deposits || s.depositsCash || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-subkpi-card">
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Tarjetas POS</small>
                <strong className="num" style={{ fontSize: 17, color: 'var(--purple)' }}>${Number(s.paymentsSummary?.card || s.expected?.CARD || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-subkpi-card">
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Bancos / Transf</small>
                <strong className="num" style={{ fontSize: 17, color: 'var(--info)' }}>${Number(s.paymentsSummary?.transfer || s.expected?.TRANSFER || 0).toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* CONCILIACIÓN MULTICANAL EN VIVO */}
          <div className="panel" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>📍 ¿Dónde está el dinero del turno? (Conciliación Multicanal)</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Identificación de fondos en gaveta física, cuentas bancarias y datáfonos de tarjetas</p>
              </div>
              <span className="cash-status-tag" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                Total Recaudado Empresa: <strong className="num">${Number(s.paymentsSummary?.total || 0).toFixed(2)}</strong>
              </span>
            </div>

            <div className="cash-recon-grid">
              <div className="cash-recon-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Banknote size={15} style={{ color: 'var(--success)' }} /> Gaveta de Efectivo
                  </span>
                  <span className="badge success">Físico</span>
                </div>
                <div className="num" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success-text)', margin: '6px 0' }}>${inDrawer.toFixed(2)}</div>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                  Apertura (${Number(s.openingCash || 0).toFixed(2)}) + Cobros (${Number(s.salesCash || 0).toFixed(2)})
                </small>
              </div>

              <div className="cash-recon-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={15} style={{ color: 'var(--primary)' }} /> Cuentas Bancarias
                  </span>
                  <span className="badge brand">Transferencias</span>
                </div>
                <div className="num" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', margin: '6px 0' }}>${Number(s.paymentsSummary?.transfer || s.expected?.TRANSFER || 0).toFixed(2)}</div>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                  Pichincha / Guayaquil / Produbanco
                </small>
              </div>

              <div className="cash-recon-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CreditCard size={15} style={{ color: 'var(--purple)' }} /> Datáfonos POS / Tarjetas
                  </span>
                  <span className="badge warning">Datafast/Medianet</span>
                </div>
                <div className="num" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--purple)', margin: '6px 0' }}>${Number(s.paymentsSummary?.card || s.expected?.CARD || 0).toFixed(2)}</div>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                  Pendiente de liquidación en lote
                </small>
              </div>

              <div className="cash-recon-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShoppingBag size={15} style={{ color: 'var(--teal, #00a896)' }} /> Actividades del Negocio
                  </span>
                  <span className="badge info">Origen</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                  Mostrador POS: <strong className="num">${Number(s.salesBreakdown?.total || 0).toFixed(2)}</strong> ({s.salesBreakdown?.count || 0})
                </div>
                <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '2px', fontWeight: 600 }}>
                  Taller / OT: <strong className="num">${Number(s.workOrdersBreakdown?.total || 0).toFixed(2)}</strong> ({s.workOrdersBreakdown?.count || 0})
                </div>
                <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>
                  Gastos Turno: <span className="num">-${Number((s.outflowsCash || 0) + (s.depositsCash || 0)).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* MOVEMENTS HISTORY */}
          <div className="panel table-panel">
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3>Registro Detallado de Movimientos</h3>
                <p className="catalog-toolbar-p">Entradas, salidas de efectivo y depósitos bancarios de este turno</p>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  ['ALL', `Todos (${history.length})`],
                  ['SALE_CASH', 'Ventas / Servicios'],
                  ['CASH_OUT', 'Gastos / Salidas'],
                  ['CASH_IN', 'Entradas'],
                  ['DEPOSIT', 'Depósitos']
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`filter-pill ${movementFilter === k ? 'active' : ''}`}
                    onClick={() => setMovementFilter(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Tipo de Movimiento</th>
                    <th>Método</th>
                    <th>Destino / Concepto</th>
                    <th>Referencia</th>
                    <th className="num">Efecto en Gaveta</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((m: Any) => {
                    const isPositive = m.type === 'CASH_IN' || m.type === 'SALE_CASH' || m.type === 'OPENING';
                    return (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleDateString()} {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          <span className={`deliv-badge ${
                            m.type === 'SALE_CASH' ? 'badge-movement-in' :
                            m.type === 'OPENING' ? 'badge-movement-in' :
                            m.type === 'DEPOSIT' ? 'badge-movement-deposit' :
                            m.type === 'CASH_IN' ? 'badge-movement-in' : 'badge-movement-out'
                          }`} style={{
                            background: m.type === 'SALE_CASH' ? '#eff6ff' : undefined,
                            color: m.type === 'SALE_CASH' ? '#1d4ed8' : undefined,
                            borderColor: m.type === 'SALE_CASH' ? '#bfdbfe' : undefined
                          }}>
                            {m.type === 'SALE_CASH' ? '🛒 Cobro Venta / Taller' :
                             m.type === 'OPENING' ? '🟢 Fondo de Apertura' :
                             m.type === 'DEPOSIT' ? '🏦 Depósito Banco' :
                             m.type === 'CASH_IN' ? '📥 Ingreso Extra' : '📤 Gasto / Salida'}
                          </span>
                        </td>
                        <td><b>{m.payment_method || 'CASH'}</b></td>
                        <td>
                          <strong>{m.reason || m.destination || 'Movimiento de caja'}</strong>
                          {m.notes && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.notes}</div>}
                        </td>
                        <td>
                          {m.reference ? (
                            <span className="guide-pill">📄 {m.reference}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 800, color: isPositive ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                          {isPositive ? '+' : '-'}${Number(m.amount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredHistory.length && (
                <div className="empty">
                  <b>💵</b>
                  <p>No se encontraron movimientos para este criterio.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL DEPOSITO BANCARIO */}
      {showDepositModal && (
        <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <h3>🏦 Registrar Depósito a Banco / Bóveda</h3>
              <button className="close-button" onClick={() => setShowDepositModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px' }}>
              Registra la salida física del dinero de gaveta hacia una cuenta de banco o resguardo en bóveda.
            </p>
            <div style={{ background: 'var(--success-soft)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', color: 'var(--success-text)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Efectivo disponible en gaveta:</span>
              <strong>${inDrawer.toFixed(2)}</strong>
            </div>

            <form onSubmit={recordDeposit}>
              <label>
                <span>Destino del Depósito *</span>
                <select
                  value={depositForm.destination}
                  onChange={e => setDepositForm({ ...depositForm, destination: e.target.value })}
                  required
                >
                  <option value="BANCO_PICHINCHA">Banco Pichincha (Cta. Corriente)</option>
                  <option value="BANCO_GUAYAQUIL">Banco Guayaquil</option>
                  <option value="BANCO_PRODUBANCO">Banco Produbanco</option>
                  <option value="BOVEDA_CENTRAL">Bóveda Central / Caja Fuerte</option>
                  <option value="RETIRO_GERENCIA">Retiro Propietario / Gerencia</option>
                  <option value="OTRO">Otro Destino</option>
                </select>
              </label>

              <label>
                <span>Monto a Depositar ($) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={inDrawer > 0 ? inDrawer : undefined}
                  placeholder="0.00"
                  value={depositForm.amount}
                  onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
                  required
                  autoFocus
                />
              </label>

              <label>
                <span>N° Papeleta / Comprobante / Referencia</span>
                <input
                  placeholder="Ej. DEP-9938472"
                  value={depositForm.reference}
                  onChange={e => setDepositForm({ ...depositForm, reference: e.target.value })}
                />
              </label>

              <label>
                <span>Observaciones / Detalle</span>
                <input
                  placeholder="Ej. Depósito cierre parcial mediodía"
                  value={depositForm.notes}
                  onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowDepositModal(false)}>
                  Cancelar
                </button>
                <button className="primary-action">
                  ✓ Confirmar Depósito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MOVIMIENTO MENOR */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-head">
              <h3>📥 / 📤 Registrar Movimiento Menor</h3>
              <button className="close-button" onClick={() => setShowMoveModal(false)}>✕</button>
            </div>

            <form onSubmit={move}>
              <label>
                <span>Tipo de Movimiento</span>
                <select value={movement.type} onChange={e => setMovement({ ...movement, type: e.target.value })}>
                  <option value="CASH_IN">📥 Entrada de Efectivo (Aporte/Cambio)</option>
                  <option value="CASH_OUT">📤 Salida de Efectivo (Gasto menor / Flete)</option>
                </select>
              </label>

              <label>
                <span>Monto ($) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={movement.amount}
                  onChange={e => setMovement({ ...movement, amount: e.target.value })}
                  required
                  autoFocus
                />
              </label>

              <label>
                <span>Motivo o Concepto *</span>
                <input
                  placeholder="Ej. Pago de flete moto, suministros oficina, almuerzo..."
                  value={movement.reason}
                  onChange={e => setMovement({ ...movement, reason: e.target.value })}
                  required
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowMoveModal(false)}>
                  Cancelar
                </button>
                <button className="primary-action">
                  ✓ Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CIERRE Y ARQUEO */}
      {showCloseModal && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-head">
              <h3>🔒 Cierre de Turno & Conciliación Real</h3>
              <button className="close-button" onClick={() => setShowCloseModal(false)}>✕</button>
            </div>

            {/* MODO ARQUEO CIEGO VS REVELADO */}
            <div style={{ background: blindMode ? '#f0fdf4' : '#f8fafc', border: blindMode ? '1px solid #bbf7d0' : '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: blindMode ? '0' : '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: blindMode ? '#166534' : '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {blindMode ? '🔒 MODO ARQUEO CIEGO ACTIVO (SIN SESGOS)' : '📍 DÓNDE ESTÁ EL DINERO DEL TURNO (CONCILIACIÓN)'}
                </div>
                <button
                  type="button"
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                  onClick={() => setBlindMode(!blindMode)}
                >
                  {blindMode ? '👁️ Ver saldos esperados' : '🔒 Ocultar (Modo Ciego)'}
                </button>
              </div>

              {blindMode ? (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--success-text)' }}>
                  Los saldos del sistema están ocultos para asegurar un conteo físico 100% transparente. Ingresa las cantidades de billetes y monedas que tienes en la gaveta. Al confirmar, el sistema contrastará el resultado automáticamente.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '8px', marginTop: '6px' }}>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
                    <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px' }}>💵 Gaveta (Efectivo)</small>
                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>${inDrawer.toFixed(2)}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
                    <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px' }}>🏦 Banco (Transf.)</small>
                    <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>${Number(s?.paymentsSummary?.transfer || s?.expected?.TRANSFER || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
                    <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px' }}>💳 POS (Tarjetas)</small>
                    <strong style={{ fontSize: '15px', color: '#7c3aed' }}>${Number(s?.paymentsSummary?.card || s?.expected?.CARD || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
                    <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px' }}>🔧 Taller / OT</small>
                    <strong style={{ fontSize: '15px', color: '#0284c7' }}>${Number(s?.workOrdersBreakdown?.total || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary-border)', borderRadius: '8px', padding: '8px' }}>
                    <small style={{ display: 'block', color: 'var(--primary)', fontSize: '11px' }}>💰 Total Empresa</small>
                    <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>${Number(s?.paymentsSummary?.total || 0).toFixed(2)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* TAB SELECTOR ARQUEO */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
              <button
                type="button"
                className={`filter-pill ${useDenom ? 'active' : ''}`}
                style={{ flex: 1, textAlign: 'center', padding: '8px 12px', fontWeight: 700 }}
                onClick={() => setUseDenom(true)}
              >
                🧮 Conteo por Billetes y Monedas
              </button>
              <button
                type="button"
                className={`filter-pill ${!useDenom ? 'active' : ''}`}
                style={{ flex: 1, textAlign: 'center', padding: '8px 12px', fontWeight: 700 }}
                onClick={() => setUseDenom(false)}
              >
                ⚡ Ingresar Total Directo
              </button>
            </div>

            <form onSubmit={close}>
              {useDenom ? (
                <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: '10px', marginBottom: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Arqueo Físico por Denominaciones ($ USD)</strong>
                    <button
                      type="button"
                      style={{ fontSize: '11px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => {
                        const reset = { b100:0, b50:0, b20:0, b10:0, b5:0, b1:0, c100:0, c50:0, c25:0, c10:0, c5:0, c1:0 };
                        setDenoms(reset);
                        setCloseForm(f => ({ ...f, countedCash: '0.00' }));
                      }}
                    >
                      Limpiar conteo
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Billetes */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--success-text)', marginBottom: '6px' }}>💵 BILLETES</div>
                      {[
                        ['b100', 100, '$100'],
                        ['b50', 50, '$50'],
                        ['b20', 20, '$20'],
                        ['b10', 10, '$10'],
                        ['b5', 5, '$5'],
                        ['b1', 1, '$1']
                      ].map(([k, val, lbl]) => (
                        <div key={k as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, width: '45px' }}>{lbl}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>×</span>
                          <input
                            type="number"
                            min="0"
                            value={denoms[k as string] || ''}
                            placeholder="0"
                            onChange={e => updateDenom(k as string, parseInt(e.target.value) || 0)}
                            style={{ width: '55px', padding: '3px 6px', fontSize: '12px', textAlign: 'center', margin: '0 4px' }}
                          />
                          <span style={{ fontSize: '11px', fontWeight: 700, width: '50px', textAlign: 'right', color: 'var(--success-text)' }}>
                            ${((denoms[k as string] || 0) * (val as number)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Monedas */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--warning-text)', marginBottom: '6px' }}>🪙 MONEDAS</div>
                      {[
                        ['c100', 1.00, '$1.00'],
                        ['c50', 0.50, '$0.50'],
                        ['c25', 0.25, '$0.25'],
                        ['c10', 0.10, '$0.10'],
                        ['c5', 0.05, '$0.05'],
                        ['c1', 0.01, '$0.01']
                      ].map(([k, val, lbl]) => (
                        <div key={k as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, width: '45px' }}>{lbl}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>×</span>
                          <input
                            type="number"
                            min="0"
                            value={denoms[k as string] || ''}
                            placeholder="0"
                            onChange={e => updateDenom(k as string, parseInt(e.target.value) || 0)}
                            style={{ width: '55px', padding: '3px 6px', fontSize: '12px', textAlign: 'center', margin: '0 4px' }}
                          />
                          <span style={{ fontSize: '11px', fontWeight: 700, width: '50px', textAlign: 'right', color: 'var(--warning-text)' }}>
                            ${((denoms[k as string] || 0) * (val as number)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Total Físico Contado:</span>
                    <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>${countedNum.toFixed(2)}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '14px' }}>
                  <label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Efectivo Físico Contado en Gaveta ($) *</span>
                      <button
                        type="button"
                        style={{ fontSize: '11px', color: 'var(--primary)', background: 'var(--primary-soft)', border: '1px solid var(--primary-border)', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => setCloseForm(f => ({ ...f, countedCash: inDrawer.toFixed(2) }))}
                      >
                        ⚡ Copiar esperado (${inDrawer.toFixed(2)})
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={closeForm.countedCash}
                      onChange={e => setCloseForm({ ...closeForm, countedCash: e.target.value })}
                      required
                      autoFocus
                    />
                  </label>
                </div>
              )}

              {/* CUADRE COMPARATIVO */}
              <div style={{ background: 'var(--bg-subtle)', padding: '12px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', border: '1px solid var(--border)' }}>
                {blindMode ? (
                  <div style={{ textAlign: 'center', padding: '6px 0', color: 'var(--text-secondary)' }}>
                    <span style={{ fontSize: '12px' }}>🔒 <b>Arqueo Ciego Activo:</b> La diferencia del cuadre (cuadrada, sobrante o faltante) se auditará y registrará al procesar el cierre.</span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Efectivo esperado según sistema:</span>
                      <strong style={{ fontSize: '14px' }}>${inDrawer.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Efectivo físico contado en gaveta:</span>
                      <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>${countedNum.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '4px' }}>
                      <span style={{ fontWeight: 700 }}>Resultado del Cuadre:</span>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '14px',
                        color: Math.abs(diff) < 0.01 ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444'
                      }}>
                        {Math.abs(diff) < 0.01 ? '✓ Cuadre Perfecto ($0.00)' : diff > 0 ? `+ Sobrante: $${diff.toFixed(2)}` : `- Faltante: $${Math.abs(diff).toFixed(2)}`}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <label>
                  <span>Destino del Depósito de Cierre</span>
                  <select
                    value={closeForm.depositDestination}
                    onChange={e => setCloseForm({ ...closeForm, depositDestination: e.target.value })}
                  >
                    <option value="BANCO_PICHINCHA">Banco Pichincha</option>
                    <option value="BANCO_GUAYAQUIL">Banco Guayaquil</option>
                    <option value="BOVEDA_CENTRAL">Bóveda Central</option>
                    <option value="RETIRO_GERENCIA">Retiro Propietario</option>
                  </select>
                </label>

                <label>
                  <span>Fondo Base para Mañana ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="50.00"
                    value={closeForm.nextDayFund}
                    onChange={e => setCloseForm({ ...closeForm, nextDayFund: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <label>
                  <span>N° Papeleta / Comprobante</span>
                  <input
                    placeholder="Ej. DEP-FINAL-102"
                    value={closeForm.depositReference}
                    onChange={e => setCloseForm({ ...closeForm, depositReference: e.target.value })}
                  />
                </label>

                <label>
                  <span>Monto a Depositar ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={(countedNum > Number(closeForm.nextDayFund || 0) ? (countedNum - Number(closeForm.nextDayFund || 0)).toFixed(2) : '0.00')}
                    value={closeForm.depositAmount}
                    onChange={e => setCloseForm({ ...closeForm, depositAmount: e.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Notas de Cierre del Turno</span>
                <input
                  placeholder="Observaciones de caja..."
                  value={closeForm.notes}
                  onChange={e => setCloseForm({ ...closeForm, notes: e.target.value })}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowCloseModal(false)}>
                  Cancelar
                </button>
                <button className="primary-action" style={{ background: '#ef4444' }}>
                  ✓ Confirmar y Cerrar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {corteZSummary && (
        <CorteZModal
          summary={corteZSummary}
          onClose={() => setCorteZSummary(null)}
          tenantName={localStorage.tenantName || 'Fixme Tiendas'}
        />
      )}
    </>
  );
}

export default Cash;
