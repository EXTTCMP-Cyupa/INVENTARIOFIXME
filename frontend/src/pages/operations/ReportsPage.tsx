import React from 'react';
import { Any } from '../../sharedConfig';
import { printTicketElement } from '../../ticketPrinter';

export function Reports({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){
  const [r, setR] = React.useState<Any>({});
  const [loading, setLoading] = React.useState(true);
  const [reportTab, setReportTab] = React.useState<'summary' | 'commissions' | 'pnl'>('summary');
  const [dateRange, setDateRange] = React.useState({ start: '', end: '' });
  const [commissionsData, setCommissionsData] = React.useState<Any | null>(null);
  const [pnlData, setPnlData] = React.useState<Any | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api('/api/reports/summary')
      .then(x => x.ok ? x.json() : {})
      .then(data => { setR(data); setLoading(false); });
  }, [api]);

  const loadCommissions = React.useCallback(() => {
    let q = '';
    if (dateRange.start) q += `startDate=${dateRange.start}&`;
    if (dateRange.end) q += `endDate=${dateRange.end}&`;
    api(`/api/reports/technician-commissions?${q}`)
      .then(res => res.ok ? res.json() : null)
      .then(d => setCommissionsData(d));
  }, [api, dateRange]);

  const loadPnl = React.useCallback(() => {
    let q = '';
    if (dateRange.start) q += `startDate=${dateRange.start}&`;
    if (dateRange.end) q += `endDate=${dateRange.end}&`;
    api(`/api/reports/financial-pnl?${q}`)
      .then(res => res.ok ? res.json() : null)
      .then(d => setPnlData(d));
  }, [api, dateRange]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (reportTab === 'commissions') loadCommissions();
    if (reportTab === 'pnl') loadPnl();
  }, [reportTab, loadCommissions, loadPnl]);

  const dailyTrend: Any[] = r.dailyTrend || [];
  const topProducts: Any[] = r.topProducts || [];
  const channelBreakdown = r.channelBreakdown || {};
  const storeChannel = channelBreakdown.STORE || { count: 0, revenue: 0, cogs: 0, profit: 0 };
  const onlineChannel = channelBreakdown.ONLINE || { count: 0, revenue: 0, cogs: 0, profit: 0 };
  const totalRev = Number(r.revenue || 0);

  const storeRev = Number(storeChannel.revenue || 0);
  const onlineRev = Number(onlineChannel.revenue || 0);
  const storePct = totalRev > 0 ? ((storeRev / totalRev) * 100).toFixed(0) : '0';
  const onlinePct = totalRev > 0 ? ((onlineRev / totalRev) * 100).toFixed(0) : '0';

  // Normalize paymentMethods array from backend
  const payMethodsList: Any[] = Array.isArray(r.paymentMethods) ? r.paymentMethods : [];
  const cashObj = payMethodsList.find((p: Any) => String(p.payment_method).toUpperCase() === 'CASH') || (r.paymentMethods && typeof r.paymentMethods === 'object' && r.paymentMethods.CASH ? r.paymentMethods.CASH : null);
  const cardObj = payMethodsList.find((p: Any) => String(p.payment_method).toUpperCase() === 'CARD') || (r.paymentMethods && typeof r.paymentMethods === 'object' && r.paymentMethods.CARD ? r.paymentMethods.CARD : null);
  const transferObj = payMethodsList.find((p: Any) => ['TRANSFER', 'DEUNA', 'PAYPHONE'].includes(String(p.payment_method).toUpperCase())) || (r.paymentMethods && typeof r.paymentMethods === 'object' && r.paymentMethods.TRANSFER ? r.paymentMethods.TRANSFER : null);

  const cashAmount = Number(cashObj?.total || cashObj?.amount || 0);
  const cardAmount = Number(cardObj?.total || cardObj?.amount || 0);
  const transferAmount = Number(transferObj?.total || transferObj?.amount || 0);
  const paySum = (cashAmount + cardAmount + transferAmount) || 1;

  // Logistics / Fulfillment calculations
  const pickupObj = r.fulfillmentBreakdown?.PICKUP || {};
  const deliveryObj = r.fulfillmentBreakdown?.DELIVERY || {};
  const pickupCount = Number(typeof pickupObj === 'object' && pickupObj !== null ? pickupObj.count : pickupObj) || 0;
  const deliveryCount = Number(typeof deliveryObj === 'object' && deliveryObj !== null ? deliveryObj.count : deliveryObj) || 0;
  const pickupRev = Number(typeof pickupObj === 'object' && pickupObj !== null ? pickupObj.revenue : 0) || 0;
  const deliveryRev = Number(typeof deliveryObj === 'object' && deliveryObj !== null ? deliveryObj.revenue : 0) || 0;
  const totalOrdersCount = (pickupCount + deliveryCount) || 1;
  const pickupPct = ((pickupCount / totalOrdersCount) * 100).toFixed(0);
  const deliveryPct = ((deliveryCount / totalOrdersCount) * 100).toFixed(0);

  // Max value for SVG chart scaling
  const maxChartVal = dailyTrend.reduce((m, d) => Math.max(m, Number(d.revenue || 0)), 10);

  return (
    <div id="printable-financial-report">
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">INTELIGENCIA DE NEGOCIOS & FINANZAS</span>
          <h2>Dashboard Financiero y Rentabilidad</h2>
          <p>Supervisa ingresos reales, costo de venta (COGS), márgenes de ganancia y valorización del stock.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary-action" onClick={() => printTicketElement('printable-financial-report')}>🖨️ Imprimir Reporte</button>
          <button className="primary-action" onClick={() => { if(reportTab==='summary') load(); if(reportTab==='commissions') loadCommissions(); if(reportTab==='pnl') loadPnl(); }}>Actualizar</button>
        </div>
      </section>

      {/* REPORT NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', margin: '14px 0 20px' }}>
        <button
          type="button"
          onClick={() => setReportTab('summary')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: reportTab === 'summary' ? 700 : 500,
            borderBottom: reportTab === 'summary' ? '3px solid var(--primary)' : '3px solid transparent',
            color: reportTab === 'summary' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          📊 Resumen General & Ventas
        </button>
        <button
          type="button"
          onClick={() => setReportTab('commissions')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: reportTab === 'commissions' ? 700 : 500,
            borderBottom: reportTab === 'commissions' ? '3px solid var(--primary)' : '3px solid transparent',
            color: reportTab === 'commissions' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          👨‍🔧 Comisiones de Técnicos
        </button>
        <button
          type="button"
          onClick={() => setReportTab('pnl')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: reportTab === 'pnl' ? 700 : 500,
            borderBottom: reportTab === 'pnl' ? '3px solid var(--primary)' : '3px solid transparent',
            color: reportTab === 'pnl' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          💰 Estado de Resultados (Utilidad Neta Real)
        </button>
      </div>

      {reportTab === 'summary' && (
        <>
          {/* TOP FINANCIAL KPIS */}
          <div className="finance-grid">
        <div className="finance-card">
          <small>Ingresos Totales (Ventas)</small>
          <strong className="text-revenue">${Number(r.revenue || 0).toFixed(2)}</strong>
          <span>{r.sales || 0} transacciones cobradas</span>
        </div>
        <div className="finance-card">
          <small>Costo de Mercadería (COGS)</small>
          <strong className="text-cogs">${Number(r.cogs || 0).toFixed(2)}</strong>
          <span>Costo de adquisición de lo vendido</span>
        </div>
        <div className="finance-card">
          <small>Ganancia Bruta Real</small>
          <strong className="text-profit">+${Number(r.grossProfit || 0).toFixed(2)}</strong>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{Number(r.grossMarginPercent || 0).toFixed(1)}% margen comercial real</span>
        </div>
        <div className="finance-card">
          <small>Inversión Activa en Stock</small>
          <strong>${Number(r.inventoryCostValue || 0).toFixed(2)}</strong>
          <span>Capital en mercadería disponible</span>
        </div>
        <div className="finance-card">
          <small>Valorización PVP en Bodega</small>
          <strong style={{ color: '#475569' }}>${Number(r.inventoryRetailValue || 0).toFixed(2)}</strong>
          <span>Ganancia potencial: +${Number(r.inventoryPotentialProfit || 0).toFixed(2)}</span>
        </div>
        <div className="finance-card">
          <small>Unidades en Stock</small>
          <strong>{r.totalStockUnits || 0}</strong>
          <span>{r.lowStock || 0} productos en stock bajo</span>
        </div>
      </div>

      {/* INTERACTIVE DAILY SALES & PROFIT SVG CHART */}
      <div className="chart-panel">
        <div className="chart-header">
          <div>
            <h3 style={{ margin: 0 }}>Tendencia de Ingresos vs. Ganancia Bruta</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Evolución diaria de ventas y utilidad neta en los últimos 30 días</p>
          </div>
          <div className="chart-legend">
            <div><span className="legend-dot" style={{ background: '#3157d5' }}></span>Ingresos ($)</div>
            <div><span className="legend-dot" style={{ background: '#10b981' }}></span>Ganancia Bruta ($)</div>
          </div>
        </div>

        <div className="svg-container">
          {dailyTrend.length > 0 ? (
            <svg className="svg-chart" viewBox={`0 0 ${Math.max(600, dailyTrend.length * 60)} 220`}>
              {/* Background grid lines */}
              <line x1="40" y1="30" x2={Math.max(600, dailyTrend.length * 60)} y2="30" stroke="#f1f5f9" strokeDasharray="4" />
              <line x1="40" y1="90" x2={Math.max(600, dailyTrend.length * 60)} y2="90" stroke="#f1f5f9" strokeDasharray="4" />
              <line x1="40" y1="150" x2={Math.max(600, dailyTrend.length * 60)} y2="150" stroke="#f1f5f9" strokeDasharray="4" />
              <line x1="40" y1="180" x2={Math.max(600, dailyTrend.length * 60)} y2="180" stroke="#e2e8f0" />

              {dailyTrend.map((d, i) => {
                const x = 50 + i * 55;
                const revHeight = Math.max(4, (Number(d.revenue || 0) / maxChartVal) * 140);
                const profHeight = Math.max(2, (Number(d.profit || 0) / maxChartVal) * 140);
                const yRev = 180 - revHeight;
                const yProf = 180 - profHeight;

                return (
                  <g key={d.date || i}>
                    {/* Revenue Bar */}
                    <rect
                      x={x}
                      y={yRev}
                      width="16"
                      height={revHeight}
                      rx="3"
                      fill="#3157d5"
                      opacity="0.85"
                    >
                      <title>{`${d.day}: Ingresos $${Number(d.revenue).toFixed(2)}`}</title>
                    </rect>

                    {/* Profit Bar */}
                    <rect
                      x={x + 18}
                      y={yProf}
                      width="16"
                      height={profHeight}
                      rx="3"
                      fill="#10b981"
                      opacity="0.9"
                    >
                      <title>{`${d.day}: Ganancia +$${Number(d.profit).toFixed(2)}`}</title>
                    </rect>

                    {/* Date label */}
                    <text
                      x={x + 16}
                      y="200"
                      fontSize="10"
                      fill="#64748b"
                      textAnchor="middle"
                    >
                      {d.day}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="empty" style={{ padding: '30px 0' }}>
              <p>Aún no hay suficiente historial diario para graficar.</p>
            </div>
          )}
        </div>
      </div>

      {/* DISTRIBUTION CARDS */}
      <div className="dist-grid">
        {/* CHANNELS BREAKDOWN */}
        <div className="dist-card">
          <h4>🏪 Canales de Venta (Omnicanal)</h4>
          <div className="dist-item">
            <div className="dist-labels">
              <span>Local Físico ({storeChannel.count} ventas)</span>
              <span>${storeRev.toFixed(2)} ({storePct}%)</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${storePct}%`, background: '#3157d5' }}></div>
            </div>
          </div>
          <div className="dist-item" style={{ marginTop: '12px' }}>
            <div className="dist-labels">
              <span>Internet / WhatsApp ({onlineChannel.count} ventas)</span>
              <span>${onlineRev.toFixed(2)} ({onlinePct}%)</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${onlinePct}%`, background: '#8b5cf6' }}></div>
            </div>
          </div>
        </div>

        {/* PAYMENT METHODS SHARE */}
        <div className="dist-card">
          <h4>💳 Métodos de Cobro</h4>
          <div className="dist-item">
            <div className="dist-labels">
              <span>💵 Efectivo</span>
              <span>${cashAmount.toFixed(2)} ({((cashAmount / paySum) * 100).toFixed(0)}%)</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${(cashAmount / paySum) * 100}%`, background: '#10b981' }}></div>
            </div>
          </div>
          <div className="dist-item" style={{ marginTop: '10px' }}>
            <div className="dist-labels">
              <span>💳 Tarjetas</span>
              <span>${cardAmount.toFixed(2)} ({((cardAmount / paySum) * 100).toFixed(0)}%)</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${(cardAmount / paySum) * 100}%`, background: '#3b82f6' }}></div>
            </div>
          </div>
          <div className="dist-item" style={{ marginTop: '10px' }}>
            <div className="dist-labels">
              <span>📲 Transferencia / QR</span>
              <span>${transferAmount.toFixed(2)} ({((transferAmount / paySum) * 100).toFixed(0)}%)</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${(transferAmount / paySum) * 100}%`, background: '#f59e0b' }}></div>
            </div>
          </div>
        </div>

        {/* LOGISTICS / DELIVERIES */}
        <div className="dist-card">
          <h4>🛵 Modalidad de Entrega</h4>
          <div className="dist-item">
            <div className="dist-labels">
              <span>🏬 Retiro en Tienda</span>
              <span>{pickupCount} pedidos (${pickupRev.toFixed(2)})</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${pickupPct}%`, background: '#64748b' }}></div>
            </div>
          </div>
          <div className="dist-item" style={{ marginTop: '12px' }}>
            <div className="dist-labels">
              <span>🛵 Entrega a Domicilio</span>
              <span>{deliveryCount} pedidos (${deliveryRev.toFixed(2)})</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${deliveryPct}%`, background: '#3157d5' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* TOP PRODUCTS RANKING TABLE */}
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h3>Top Productos con Mayor Rentabilidad</h3>
            <p className="catalog-toolbar-p">Artículos más vendidos ordenados por margen y volumen de ingresos generados.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Unidades Vendidas</th>
                <th>Ingresos Generados</th>
                <th>Costo (COGS)</th>
                <th>Ganancia Bruta</th>
                <th>Margen %</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, idx) => {
                const rev = Number(p.total_revenue || p.revenue || 0);
                const cost = Number(p.total_cost || p.cogs || 0);
                const profit = Number(p.total_profit || p.profit || 0);
                const units = Number(p.qty_sold || p.unitsSold || 0);
                const margin = rev > 0 ? ((profit / rev) * 100) : 0;

                return (
                  <tr key={p.id || idx}>
                    <td><b>{p.name}</b></td>
                    <td><span className="sku-label">{p.sku}</span></td>
                    <td><strong>{units}</strong> unids</td>
                    <td style={{ fontWeight: 700 }}>${rev.toFixed(2)}</td>
                    <td style={{ color: '#f43f5e' }}>${cost.toFixed(2)}</td>
                    <td style={{ fontWeight: 800, color: '#10b981' }}>+${profit.toFixed(2)}</td>
                    <td><span className="status-badge status-approved">{margin.toFixed(1)}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!topProducts.length && (
            <div className="empty">
              <b>📊</b>
              <p>No hay ventas registradas aún para rankear productos.</p>
            </div>
          )}
        </div>
      </section>
      </>
    )}

    {reportTab === 'commissions' && (
      <div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, background: 'var(--surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span>Desde:</span>
            <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span>Hasta:</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
          </label>
          <button type="button" className="primary-action" onClick={loadCommissions} style={{ padding: '6px 14px', fontSize: 13 }}>
            Filtrar Comisiones
          </button>
        </div>

        {/* TECHNICIANS SUMMARY */}
        <section className="panel table-panel">
          <div className="panel-head">
            <div>
              <h3>Liquidación de Comisiones por Técnico</h3>
              <p className="catalog-toolbar-p">Mano de obra producida y comisiones acumuladas por cada técnico del taller.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Técnico</th>
                  <th>Correo</th>
                  <th>Órdenes Asignadas</th>
                  <th>Completadas</th>
                  <th>Mano de Obra ($)</th>
                  <th>Comisión a Liquidar ($)</th>
                </tr>
              </thead>
              <tbody>
                {(commissionsData?.technicians || []).map((t: Any) => (
                  <tr key={t.technician_id}>
                    <td><b>👨‍🔧 {t.technician_name}</b></td>
                    <td>{t.technician_email}</td>
                    <td>{t.total_orders}</td>
                    <td><span className="status-badge status-approved">{t.completed_orders}</span></td>
                    <td style={{ fontWeight: 700 }}>${Number(t.total_labor_revenue || 0).toFixed(2)}</td>
                    <td style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14 }}>
                      ${Number(t.total_commission_amount || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!commissionsData?.technicians || commissionsData.technicians.length === 0) && (
              <div className="empty">
                <b>👨‍🔧</b>
                <p>No se encontraron técnicos con órdenes en el período seleccionado.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    )}

    {reportTab === 'pnl' && (
      <div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, background: 'var(--surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span>Desde:</span>
            <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span>Hasta:</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
          </label>
          <button type="button" className="primary-action" onClick={loadPnl} style={{ padding: '6px 14px', fontSize: 13 }}>
            Calcular Estado de Resultados
          </button>
        </div>

        {pnlData && (
          <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 24, maxWidth: 700, margin: '0 auto' }}>
            <h3 style={{ borderBottom: '2px solid var(--border)', paddingBottom: 10, margin: '0 0 16px' }}>
              📊 Estado de Resultados Integral (P&L)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(+) Ventas Mostrador (POS):</span>
                <strong>${Number(pnlData.posGrossSales || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(+) Servicios de Taller / Mano de Obra:</span>
                <strong>${Number(pnlData.workshopRevenue || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid var(--border)', paddingTop: 8, color: 'var(--primary)' }}>
                <span>(=) Total Ingresos Operativos:</span>
                <span>${Number(pnlData.totalRevenue || 0).toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', marginTop: 6 }}>
                <span>(-) Costo de Mercadería Vendida (COGS):</span>
                <span>-${Number(pnlData.posCogs || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                <span>(=) Utilidad Bruta:</span>
                <span>${Number(pnlData.grossProfit || 0).toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ea580c', marginTop: 6 }}>
                <span>(-) Comisiones Pagadas a Técnicos:</span>
                <span>-${Number(pnlData.technicianCommissions || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                <span>(-) Egresos / Gastos Operativos de Caja:</span>
                <span>-${Number(pnlData.operatingExpenses || 0).toFixed(2)}</span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 900,
                fontSize: 18,
                borderTop: '2px solid var(--primary)',
                paddingTop: 12,
                marginTop: 8,
                color: Number(pnlData.netProfit || 0) >= 0 ? '#10b981' : '#dc2626'
              }}>
                <span>(=) UTILIDAD NETA OPERATIVA:</span>
                <span>{Number(pnlData.netProfit || 0) >= 0 ? '+' : ''}${Number(pnlData.netProfit || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    )}
  </div>
);
}

export default Reports;
