import React from 'react';
import { Any, getBranchId } from '../../sharedConfig';
import { SriRideModal } from '../../sriRideModal';
import { SriInvoicesListModal } from '../../sriInvoicesListModal';
import { TicketFormatSelector, TicketPaperWidth, getStoredPaperWidth, setStoredPaperWidth, printTicketElement, getCompanyReceiptInfo } from '../../ticketPrinter';
import { Search, Phone, Printer, Clock, FileText, Laptop, Store, Building2, Truck, ShieldCheck, Receipt, RotateCcw, MessageCircle, Eye, AlertCircle, CheckCircle2, Filter } from 'lucide-react';
import { SlideOverDrawer, ConfirmDialog, SkeletonTable } from '../../components/ui/ModernUiKit';

export function Sales({api, companyInfo, role = 'SELLER', branchId: propBranchId}:{api:(u:string,o?:RequestInit)=>Promise<Response>, companyInfo?: Any, role?: string, branchId?: string}){
const branchId = propBranchId || getBranchId();
  const canViewCosts = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(role);
  const [rows, setRows] = React.useState<Any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [confirmSriSaleId, setConfirmSriSaleId] = React.useState<string | null>(null);
  const [filterChannel, setFilterChannel] = React.useState('ALL');
  const [filterFulfillment, setFilterFulfillment] = React.useState('ALL');
  const [filterSeller, setFilterSeller] = React.useState('ALL');
  const [filterDate, setFilterDate] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [detailModal, setDetailModal] = React.useState<Any|null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [detailPaperWidth, setDetailPaperWidth] = React.useState<TicketPaperWidth>(getStoredPaperWidth());
  const [copied, setCopied] = React.useState(false);
  const [showRideInvoiceId, setShowRideInvoiceId] = React.useState<string | null>(null);
  const [issuingSriId, setIssuingSriId] = React.useState<string | null>(null);
  const [showSriInvoicesModal, setShowSriInvoicesModal] = React.useState(false);
  const [returnModalSale, setReturnModalSale] = React.useState<Any|null>(null);
  const [returnReason, setReturnReason] = React.useState('');
  const [returnRefundMethod, setReturnRefundMethod] = React.useState('CASH');
  const [returnRestock, setReturnRestock] = React.useState(true);
  const [submittingReturn, setSubmittingReturn] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true); api(`/api/sales?branchId=${branchId}`).then(r => r.ok ? r.json() : []).then(data => { setRows(data); setLoading(false); }).catch(() => setLoading(false));
  }, [api]);

  async function submitSaleReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnModalSale) return;
    if (!returnReason.trim()) {
      alert('Por favor indica el motivo de la devolución.');
      return;
    }
    setSubmittingReturn(true);
    try {
      const res = await api(`/api/sales/${returnModalSale.id}/return`, {
        method: 'POST',
        body: JSON.stringify({
          reason: returnReason.trim(),
          refundMethod: returnRefundMethod,
          restock: returnRestock,
          items: []
        })
      });
      if (res.ok) {
        const retData = await res.json();
        alert(`¡Devolución procesada con éxito!\nFolio Devolución: ${retData.id?.slice(0, 8)}\nReembolso: $${Number(retData.refund_amount || 0).toFixed(2)}${retData.credit_note_id ? '\nNota de Crédito SRI generada automáticamente.' : ''}`);
        setReturnModalSale(null);
        load();
      } else {
        const err = await res.text();
        alert('Error al procesar devolución: ' + err);
      }
    } catch (err: any) {
      alert('Error de conexión: ' + err.message);
    } finally {
      setSubmittingReturn(false);
    }
  }

  function issueSriInvoice(saleId: string) {
    setConfirmSriSaleId(saleId);
  }

  async function executeSriInvoice(saleId: string) {
    setIssuingSriId(saleId);
    try {
      const res = await api(`/api/sri/invoices/from-sale/${saleId}`, { method: 'POST' });
      if (res.ok) {
        const inv = await res.json();
        alert(`¡Factura Electrónica generada y autorizada con éxito!\nN°: ${inv.numero_completo}\nClave de Acceso: ${inv.clave_acceso}`);
        load();
        setShowRideInvoiceId(inv.id);
      } else {
        const err = await res.text();
        alert(`Error al emitir factura SRI: ${err}`);
      }
    } catch (e: any) {
      alert(`Error de conexión al emitir factura SRI: ${e.message}`);
    } finally {
      setIssuingSriId(null);
    }
  }

  React.useEffect(() => { load(); }, [load]);

  async function openDetail(id: string) {
    setLoadingDetail(true);
    try {
      const res = await api(`/api/sales/${id}`);
      if (res.ok) {
        const fullSale = await res.json();
        setDetailModal(fullSale);
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  // Unique sellers for filter dropdown
  const uniqueSellers = React.useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      const s = r.seller_name || r.seller;
      if (s) set.add(s);
    });
    return Array.from(set);
  }, [rows]);

  const filtered = rows.filter(r => {
    // Channel filter
    if (filterChannel !== 'ALL' && r.channel !== filterChannel) return false;
    // Fulfillment filter
    if (filterFulfillment !== 'ALL' && r.fulfillment_type !== filterFulfillment) return false;
    // Seller filter
    if (filterSeller !== 'ALL' && (r.seller_name || r.seller) !== filterSeller) return false;
    // Date filter
    if (filterDate !== 'ALL') {
      const saleDate = new Date(r.created_at);
      const now = new Date();
      if (filterDate === 'TODAY') {
        if (saleDate.toDateString() !== now.toDateString()) return false;
      } else if (filterDate === 'WEEK') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (saleDate < weekAgo) return false;
      } else if (filterDate === 'MONTH') {
        if (saleDate.getMonth() !== now.getMonth() || saleDate.getFullYear() !== now.getFullYear()) return false;
      }
    }
    // Search filter
    const q = search.toLowerCase().trim();
    if (q) {
      const matchSearch = [
        r.id,
        r.customer,
        r.customer_name,
        r.customer_identification_number,
        r.customer_phone,
        r.seller,
        r.seller_name,
        r.payment_methods,
        r.delivery_address,
        r.courier,
        r.tracking_number,
        r.warranty_code
      ].some(v => v && String(v).toLowerCase().includes(q));
      if (!matchSearch) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalSales = filtered.reduce((acc, r) => acc + Number(r.total || 0), 0);
  const totalCost = filtered.reduce((acc, r) => acc + Number(r.total_cost || 0), 0);
  const totalProfit = filtered.reduce((acc, r) => acc + Number(r.gross_profit || 0), 0);
  const avgMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : '0.0';
  const avgTicket = filtered.length > 0 ? (totalSales / filtered.length).toFixed(2) : '0.00';

  // Export to CSV
  function exportCSV() {
    if (!filtered.length) {
      alert('No hay ventas para exportar con los filtros actuales.');
      return;
    }
    const headers = [
      'ID Ticket',
      'Fecha',
      'Hora',
      'Sucursal',
      'Vendedor',
      'Rol Vendedor',
      'Cliente',
      'Tipo Doc',
      'Nro Identificacion',
      'Telefono',
      'Email',
      'Canal',
      'Modalidad Entrega',
      'Courier',
      'Guia',
      'Direccion',
      'Subtotal',
      'Envio',
      'Total Venta',
      ...(canViewCosts ? ['Costo Inversion', 'Utilidad Bruta', 'Margen %'] : []),
      'Metodos Pago',
      'Garantia Dias',
      'Codigo Garantia'
    ];

    const csvRows = filtered.map(r => {
      const d = new Date(r.created_at);
      const rev = Number(r.total || 0);
      const cost = Number(r.total_cost || 0);
      const prof = Number(r.gross_profit || 0);
      const marg = rev > 0 ? ((prof / rev) * 100).toFixed(1) : '0';

      return [
        `"${r.id || ''}"`,
        `"${d.toLocaleDateString()}"`,
        `"${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}"`,
        `"${r.branch_name || 'Principal'}"`,
        `"${r.seller_name || r.seller || ''}"`,
        `"${r.seller_role || ''}"`,
        `"${r.customer_name || r.customer || 'Consumidor Final'}"`,
        `"${r.customer_identification_type || ''}"`,
        `"${r.customer_identification_number || ''}"`,
        `"${r.customer_phone || ''}"`,
        `"${r.customer_email || ''}"`,
        `"${r.channel === 'ONLINE' ? 'Internet' : 'Local'}"`,
        `"${r.fulfillment_type === 'DELIVERY' ? 'Domicilio' : 'Retiro'}"`,
        `"${r.courier || ''}"`,
        `"${r.tracking_number || ''}"`,
        `"${(r.delivery_address || r.customer_address || '').replace(/"/g, '""')}"`,
        Number(r.subtotal || 0).toFixed(2),
        Number(r.shipping_cost || 0).toFixed(2),
        rev.toFixed(2),
        ...(canViewCosts ? [cost.toFixed(2), prof.toFixed(2), marg] : []),
        `"${r.payment_methods || 'CASH'}"`,
        r.warranty_days || 0,
        `"${r.warranty_code || ''}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ventas_fixme_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Generate formatted WhatsApp message
  function getWhatsAppMessage(sale: Any) {
    const itemsText = (sale.items || [])
      .map((it: Any) => `  • ${it.quantity}x ${it.product_name} ($${Number(it.unit_price).toFixed(2)}) = $${Number(it.line_total).toFixed(2)}`)
      .join('\n');

    const paymentText = (sale.payments || [])
      .map((p: Any) => `${p.payment_method}: $${Number(p.amount).toFixed(2)}`)
      .join(', ') || 'Contado';

    const trkUrl = sale.tracking_number ? `${window.location.origin}${window.location.pathname}#tracking/${sale.tracking_number}` : (sale.tracking_url || '');
    const deliveryBlock = sale.fulfillment_type === 'DELIVERY'
      ? `\n🛵 *DESPACHO A DOMICILIO:*\n  • Courier: ${sale.courier || 'Motorizado Express'}\n  • N° Guía / Tracking: ${sale.tracking_number || 'S/N'}${trkUrl ? `\n  • Rastreo en vivo: ${trkUrl}` : ''}\n  • Destino: ${sale.delivery_address || 'Registrada'}`
      : '';

    const warrantyBlock = Number(sale.warranty_days || 0) > 0
      ? `\n🛡️ *GARANTÍA TÉCNICA OFICIAL:*\n  • Cobertura: ${sale.warranty_days} días\n  • Código: ${sale.warranty_code || 'Emitido con ticket'}\n  • Válida ante defectos de fábrica y mano de obra.`
      : '';

    return `🧾 *COMPROBANTE DE VENTA FIXMETIENDAS* 🧾
*Ticket N°:* #${sale.id?.slice(0, 8).toUpperCase()}
*Fecha:* ${new Date(sale.created_at).toLocaleDateString()} ${new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
*Sucursal:* ${sale.branch_name || 'Principal'}
*Atendido por:* ${sale.seller_name || sale.seller}

👤 *CLIENTE:* ${sale.customer_name || sale.customer || 'Consumidor Final'}
📄 *IDENTIFICACIÓN:* ${sale.customer_identification_type || 'C.I.'}: ${sale.customer_identification_number || 'Consumidor Final'}

📦 *DETALLE DE PRODUCTOS:*
${itemsText}
${Number(sale.discount || 0) > 0 ? `\n🏷️ *Descuento Aplicado:* -$${Number(sale.discount).toFixed(2)}` : ''}

💰 *TOTAL PAGADO:* $${Number(sale.total).toFixed(2)}
💳 *Forma de Pago:* ${paymentText}${deliveryBlock}${warrantyBlock}

¡Muchas gracias por confiar en *FixmeTiendas*! 🚀
Cualquier consulta o servicio técnico estamos a la orden.`;
  }

  function copyTicketSummary(sale: Any) {
    const text = getWhatsAppMessage(sale);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <>
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">AUDITORÍA COMERCIAL & REGISTRO DE VENTAS (SALES JOURNAL)</span>
          <h2>Registro General de Ventas</h2>
          <p>
            Bitácora de transacciones: vendedor/cajero responsable, ficha fiscal del cliente, detalle de productos, rentabilidad real (COGS vs Utilidad), canal y logística.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="secondary-action" onClick={exportCSV} title="Descargar reporte en formato Excel/CSV">
            📥 Exportar Excel/CSV
          </button>
          <button
            type="button"
            className="secondary-action"
            style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setShowSriInvoicesModal(true)}
            title="Ver todas las Facturas Electrónicas emitidas al SRI, consultar RIDE y descargar XML"
          >
            🏛️ Facturas SRI
          </button>
          <button type="button" className="primary-action" onClick={load}>
            🔄 Actualizar Ventas
          </button>
        </div>
      </section>

      {/* SALES FINANCIAL SUMMARY KPIS */}
      <div className="finance-grid">
        <div className="finance-card">
          <small>Ventas Totales Cobradas</small>
          <strong className="text-revenue">${totalSales.toFixed(2)}</strong>
          <span>{filtered.length} tickets facturados ({rows.length} en total)</span>
        </div>
        {canViewCosts && (
          <>
            <div className="finance-card">
              <small>Costo de Mercadería (COGS)</small>
              <strong style={{ color: '#f43f5e' }}>${totalCost.toFixed(2)}</strong>
              <span>Capital invertido en productos vendidos</span>
            </div>
            <div className="finance-card">
              <small>Ganancia Bruta Real (Utilidad)</small>
              <strong className="text-profit">+${totalProfit.toFixed(2)}</strong>
              <span>Beneficio comercial neto generado</span>
            </div>
            <div className="finance-card">
              <small>Margen de Rentabilidad</small>
              <strong style={{ color: '#3b82f6' }}>{avgMargin}%</strong>
              <span>Margen bruto promedio sobre ventas</span>
            </div>
          </>
        )}
        <div className="finance-card">
          <small>Ticket Promedio</small>
          <strong style={{ color: '#8b5cf6' }}>${avgTicket}</strong>
          <span>Gasto promedio por cliente</span>
        </div>
      </div>

      {/* TOOLBAR CONTROLS & MULTI-FILTER BAR */}
      <div className="sales-toolbar-card">
        {/* Channel and Fulfillment Pills */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              className={`filter-pill ${filterChannel === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterChannel('ALL')}
            >
              Todos los Canales ({rows.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterChannel === 'STORE' ? 'active' : ''}`}
              onClick={() => setFilterChannel('STORE')}
            >
              <Store size={13} style={{ marginRight: 4 }} /> En Local ({rows.filter(r => r.channel === 'STORE').length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterChannel === 'ONLINE' ? 'active' : ''}`}
              onClick={() => setFilterChannel('ONLINE')}
            >
              <Laptop size={13} style={{ marginRight: 4 }} /> Catálogo / Web ({rows.filter(r => r.channel === 'ONLINE').length})
            </button>

            <span style={{ borderLeft: '1px solid var(--border)', margin: '0 4px' }} />

            <button
              type="button"
              className={`filter-pill ${filterFulfillment === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterFulfillment('ALL')}
            >
              Todas las Entregas
            </button>
            <button
              type="button"
              className={`filter-pill ${filterFulfillment === 'PICKUP' ? 'active' : ''}`}
              onClick={() => setFilterFulfillment('PICKUP')}
            >
              <Store size={13} style={{ marginRight: 4 }} /> Retiro ({rows.filter(r => r.fulfillment_type === 'PICKUP').length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterFulfillment === 'DELIVERY' ? 'active' : ''}`}
              onClick={() => setFilterFulfillment('DELIVERY')}
            >
              <Truck size={13} style={{ marginRight: 4 }} /> Domicilio ({rows.filter(r => r.fulfillment_type === 'DELIVERY').length})
            </button>
          </div>

          {/* Date Range Selector */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <small style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Periodo:</small>
            <select
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            >
              <option value="ALL">Todo el Historial</option>
              <option value="TODAY">Hoy</option>
              <option value="WEEK">Últimos 7 días</option>
              <option value="MONTH">Este Mes</option>
            </select>
          </div>
        </div>

        {/* Search Box and Seller Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '280px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ color: 'var(--text-muted)', position: 'absolute', left: 12, pointerEvents: 'none' }} />
            <input
              placeholder="Buscar por ticket #, cliente, cédula/RUC, vendedor, teléfono, producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <small style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Vendedor / Cajero:</small>
            <select
              value={filterSeller}
              onChange={e => setFilterSeller(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', minWidth: '180px' }}
            >
              <option value="ALL">Todos los vendedores ({uniqueSellers.length})</option>
              {uniqueSellers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ENRICHED SALES DATA TABLE */}
      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket / Fecha</th>
                <th>Comprobante</th>
                <th>Vendedor / Cajero</th>
                <th>Cliente & Identificación</th>
                <th>Canal</th>
                <th>Entrega / Courier</th>
                <th>Método Pago</th>
                <th>Garantía</th>
                {canViewCosts && <th>Costo (COGS)</th>}
                <th>Total Venta</th>
                {canViewCosts && <th>Ganancia Bruta</th>}
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const sellerInitial = (r.seller_name || r.seller || 'V').slice(0, 1).toUpperCase();
                const totalVal = Number(r.total || 0);
                const costVal = Number(r.total_cost || 0);
                const profitVal = Number(r.gross_profit || 0);
                const marginVal = totalVal > 0 ? ((profitVal / totalVal) * 100).toFixed(0) : '0';

                return (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-primary)' }}>
                        #{r.id?.slice(0, 8).toUpperCase()}
                      </strong>
                      <small style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }} className="num">
                        {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </small>
                      {r.branch_name && (
                        <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-subtle)' }}>
                          {r.branch_name}
                        </span>
                      )}
                    </td>

                    {/* Comprobante */}
                    <td>
                      {r.invoice_type === 'SRI_INVOICE' || r.electronic_invoice_id || r.invoice_number ? (
                        <div>
                          <span className="status-badge status-approved" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px' }}>
                            <FileText size={12} /> Factura SRI
                          </span>
                          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                            {r.invoice_number || 'Emitida'}
                          </div>
                          {r.invoice_sri_status && (
                            <span style={{ fontSize: '9.5px', color: r.invoice_sri_status === 'AUTORIZADA' ? 'var(--success-text)' : 'var(--warning-text)', fontWeight: 600 }}>
                              ● {r.invoice_sri_status}
                            </span>
                          )}
                        </div>
                      ) : r.offline_folio ? (
                        <div>
                          <span className="status-badge" style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)', fontSize: '10.5px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} /> Offline
                          </span>
                          <div style={{ fontSize: '10px', color: 'var(--warning-text)', fontFamily: 'monospace' }}>
                            {r.offline_folio}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="status-badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '10.5px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Receipt size={12} /> Ticket Interno
                          </span>
                          <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                            Sin IVA SRI
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Vendedor */}
                    <td>
                      <div className="seller-chip-modern">
                        <span className="seller-circle">{sellerInitial}</span>
                        <div>
                          <span>{r.seller_name || r.seller || 'Sistema'}</span>
                          {r.seller_role && (
                            <span className="seller-role-badge" style={{ marginLeft: 4 }}>{r.seller_role}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Cliente */}
                    <td>
                      <strong style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-primary)' }}>
                        {r.customer_name || r.customer || 'Consumidor Final'}
                      </strong>
                      {r.customer_identification_number ? (
                        <div className="customer-id-pill num">
                          <span>{r.customer_identification_type || 'CI'}:</span>
                          <strong>{r.customer_identification_number}</strong>
                        </div>
                      ) : (
                        <small style={{ color: 'var(--text-muted)' }}>Consumidor Final</small>
                      )}
                      {r.customer_phone && (
                        <div style={{ fontSize: '11px', marginTop: '2px' }}>
                          <a
                            href={`tel:${r.customer_phone}`}
                            style={{ textDecoration: 'none', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Phone size={11} /> {r.customer_phone}
                          </a>
                        </div>
                      )}
                    </td>

                    {/* Canal */}
                    <td>
                      <span className={`status-badge ${r.channel === 'ONLINE' ? 'status-quoted' : 'status-approved'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {r.channel === 'ONLINE' ? <Laptop size={12} /> : <Store size={12} />}
                        <span>{r.channel === 'ONLINE' ? 'Internet' : 'Local'}</span>
                      </span>
                    </td>

                    {/* Entrega / Logística */}
                    <td>
                      {r.fulfillment_type === 'DELIVERY' ? (
                        <div>
                          <span className="courier-pill" title={r.delivery_address || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Truck size={12} /> {r.courier || 'Domicilio'}
                          </span>
                          {r.tracking_number && (
                            <div style={{ fontSize: '10.5px', marginTop: '3px' }}>
                              <a
                                href={`#tracking/${r.tracking_number}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  background: 'var(--primary-soft)',
                                  color: 'var(--primary)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                  fontSize: '10px'
                                }}
                                title="Abrir rastreo público del cliente"
                              >
                                {r.tracking_number}
                              </a>
                            </div>
                          )}
                          {r.delivery_status && (
                            <span style={{ display: 'inline-block', fontSize: '10px', color: 'var(--success-text)', fontWeight: 600 }}>
                              ● {r.delivery_status}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="status-badge status-completed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Store size={12} /> Retiro
                        </span>
                      )}
                    </td>

                    {/* Métodos de Pago */}
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {r.payment_methods || 'CASH'}
                      </span>
                    </td>

                    {/* Garantía */}
                    <td>
                      {Number(r.warranty_days || 0) > 0 ? (
                        <div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-soft)', padding: '2px 6px', borderRadius: '4px' }}>
                            <ShieldCheck size={12} /> {r.warranty_days}d
                          </span>
                          {r.warranty_code && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                              {r.warranty_code}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Sin garantía</span>
                      )}
                    </td>

                    {/* Costo Mercadería */}
                    {canViewCosts && (
                      <td style={{ color: 'var(--danger-text)', fontSize: '12px', fontWeight: 600 }} className="num">
                        ${costVal.toFixed(2)}
                      </td>
                    )}

                    {/* Total Venta */}
                    <td>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }} className="num">
                        ${totalVal.toFixed(2)}
                      </strong>
                    </td>

                    {/* Ganancia Bruta */}
                    {canViewCosts && (
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--success-text)', fontSize: '13px' }} className="num">
                          +${profitVal.toFixed(2)}
                        </div>
                        <span className="margin-pill">
                          +{marginVal}%
                        </span>
                      </td>
                    )}

                    {/* Acciones */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="secondary-action"
                          style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => openDetail(r.id)}
                          title="Ver y re-imprimir comprobante térmico oficial"
                        >
                          <Printer size={12} /> <span>Ticket</span>
                        </button>
                        {r.electronic_invoice_id ? (
                          <button
                            type="button"
                            className="secondary-action"
                            style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap', background: 'var(--success-soft)', color: 'var(--success-text)', borderColor: 'var(--success-border)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => setShowRideInvoiceId(r.electronic_invoice_id)}
                            title="Ver RIDE oficial, descargar XML firmado y consultar SRI"
                          >
                            <FileText size={12} /> <span>RIDE SRI</span>
                          </button>
                        ) : r.invoice_type === 'SRI_INVOICE' ? (
                          <button
                            type="button"
                            className="secondary-action"
                            style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap', background: 'var(--warning-soft)', color: 'var(--warning-text)', borderColor: 'var(--warning-border)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => issueSriInvoice(r.id)}
                            disabled={issuingSriId === r.id}
                            title="Completar y emitir Factura Electrónica SRI oficial"
                          >
                            <Building2 size={12} /> <span>{issuingSriId === r.id ? 'Emitiendo...' : 'Emitir Factura'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary-action"
                            style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap', background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--primary-border)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => issueSriInvoice(r.id)}
                            disabled={issuingSriId === r.id}
                            title="Generar Factura Electrónica SRI oficial para esta venta"
                          >
                            <Building2 size={12} /> <span>{issuingSriId === r.id ? 'Emitiendo...' : 'Facturar SRI'}</span>
                          </button>
                        )}
                        {r.customer_phone && (
                          <a
                            className="whatsapp-btn"
                            style={{ padding: '5px 8px', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            href={`https://wa.me/${r.customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Hola ${r.customer_name || 'cliente'}, te saludamos de FixmeTiendas. Tu compra #${r.id?.slice(0, 8)} por un total de $${Number(r.total || 0).toFixed(2)} está registrada con éxito. ¡Gracias por tu preferencia!`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Enviar comprobante por WhatsApp"
                          >
                            <MessageCircle size={13} />
                          </a>
                        )}
                        {r.return_status === 'RETURNED' ? (
                          <span style={{ fontSize: '10.5px', padding: '3px 6px', background: 'var(--danger-soft)', color: 'var(--danger-text)', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <RotateCcw size={11} /> Devuelta
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="secondary-action"
                            style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap', color: 'var(--danger)', borderColor: 'var(--danger-border)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                            onClick={() => {
                              setReturnModalSale(r);
                              setReturnReason('');
                              setReturnRefundMethod(r.payment_methods?.includes('CASH') ? 'CASH' : 'TRANSFER');
                              setReturnRestock(true);
                            }}
                            title="Registrar devolución de mercadería o anulación de venta"
                          >
                            <RotateCcw size={11} /> <span>Devolución</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">
              <b>🧾</b>
              <p>No se encontraron ventas para los criterios seleccionados.</p>
            </div>
          )}
        </div>
      </div>

      {/* DETAILED SALE & 80MM THERMAL RECEIPT MODAL */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: detailPaperWidth === '58mm' ? '330px' : '440px', padding: '16px', transition: 'max-width 0.2s' }}>
            <div className="modal-head no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  🧾 Comprobante #{detailModal.id?.slice(0, 8).toUpperCase()}
                </h3>
                <small style={{ color: '#64748b' }}>
                  Formato térmico ({detailPaperWidth})
                </small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TicketFormatSelector
                  value={detailPaperWidth}
                  onChange={w => {
                    setDetailPaperWidth(w);
                    setStoredPaperWidth(w);
                  }}
                />
                <button className="close-button" onClick={() => setDetailModal(null)}>✕</button>
              </div>
            </div>

            {/* THERMAL PAPER ROLL RECEIPT */}
            <div id="printable-sale-receipt" className={`receipt-80mm-container paper-${detailPaperWidth}`}>
              {/* CABECERA COMPACTA ESTILO TECNAMAX CON DATOS REALES DE LA EMPRESA */}
              {(() => {
                const comp = getCompanyReceiptInfo(detailModal, companyInfo);
                const custName = detailModal.customer_name || detailModal.customer || 'CONSUMIDOR FINAL';
                const custRuc = detailModal.customer_identification_number || detailModal.customer_identification || '9999999999999';
                const custAddress = detailModal.delivery_address || detailModal.customer_address || 'QUITO, ECUADOR';
                const custPhone = detailModal.customer_phone || detailModal.recipient_phone || '9999999999';
                const custEmail = detailModal.customer_email || (detailModal.customer && typeof detailModal.customer === 'object' ? detailModal.customer.email : '') || 'consumidor@final.com';
                const sellerName = detailModal.seller_name || detailModal.seller || localStorage.fullName || 'VENDEDOR';

                return (
                  <>
                    <div className="receipt-header-fiscal">
                      <div className="receipt-store-title">{comp.storeName}</div>
                      <div className="receipt-store-slogan">{comp.slogan}</div>
                      <div className="receipt-company-line" style={{ fontWeight: 800 }}>{comp.legalName}</div>
                      <div className="receipt-company-line" style={{ fontWeight: 800 }}>RUC: {comp.ruc}</div>
                      <div className="receipt-company-line">DIR MATRIZ: {comp.matrixAddress}</div>
                      <div className="receipt-company-line">
                        SUCURSAL: {comp.branchAddress}
                      </div>
                      <div className="receipt-company-line">Tlf: {comp.phone}</div>
                      <div className="receipt-company-line">Email: {comp.email}</div>
                      <div className="receipt-company-line" style={{ fontWeight: 800, marginTop: '2px' }}>
                        CONTRIBUYENTE RÉGIMEN {comp.taxRegime}
                      </div>
                      <div className="receipt-company-line" style={{ fontWeight: 800 }}>
                        NÚMERO: {detailModal.invoice_number || `001-001-${(detailModal.id || '00000000').slice(0, 8).toUpperCase()}`}
                      </div>
                      {detailModal.invoice_access_key && (
                        <div className="receipt-company-line" style={{ fontSize: '9px', wordBreak: 'break-all' }}>
                          <strong>N AUTORIZACION:</strong> {detailModal.invoice_access_key}
                        </div>
                      )}
                    </div>

                    <div className="receipt-divider-dash" />

                    {/* METADATOS Y CLIENTE (ETIQUETAS A LA IZQUIERDA EN NEGRITA) */}
                    <div className="receipt-meta-block">
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">AMBIENTE:</span>
                        <span className="receipt-meta-content">{comp.sriEnvText}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">RUC:</span>
                        <span className="receipt-meta-content">{custRuc}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">NOMBRE:</span>
                        <span className="receipt-meta-content">{custName}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">DIRECCIÓN:</span>
                        <span className="receipt-meta-content">{custAddress}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">TELÉFONO:</span>
                        <span className="receipt-meta-content">{custPhone}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">EMAIL:</span>
                        <span className="receipt-meta-content">{custEmail}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">VENDEDOR:</span>
                        <span className="receipt-meta-content">{sellerName}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">FECHA:</span>
                        <span className="receipt-meta-content">
                          {new Date(detailModal.created_at || Date.now()).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      {detailModal.fulfillment_type === 'DELIVERY' && (
                        <div className="receipt-meta-entry">
                          <span className="receipt-meta-tag">DESPACHO:</span>
                          <span className="receipt-meta-content">
                            {detailModal.courier || 'Motorizado Express'} {detailModal.tracking_number ? `(Guía: ${detailModal.tracking_number})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              <div className="receipt-divider-dash" />

              {/* TABLA DE PRODUCTOS EN 2 NIVELES (COD - CANT - DETALLE / PRECIO - TOTAL) */}
              <div className="receipt-products-table">
                <div className="receipt-col-headers">
                  <span style={{ minWidth: '60px' }}>COD</span>
                  <span style={{ minWidth: '25px', textAlign: 'center' }}>CANT</span>
                  <span style={{ flex: 1, textAlign: 'left', paddingLeft: '5px' }}>DETALLE</span>
                </div>
                {(detailModal.items || []).map((it: Any, idx: number) => {
                  const qty = Number(it.quantity || 1);
                  const price = Number(it.unit_price || 0);
                  const lineTotal = Number(it.line_total || (qty * price)).toFixed(2);
                  const code = it.product_sku || it.sku || `TEG${String(idx + 895).padStart(5, '0')}`;

                  return (
                    <div className="receipt-item-group" key={idx}>
                      <div className="receipt-item-line-main">
                        <span className="receipt-item-sku-col">{code}</span>
                        <span className="receipt-item-qty-col">{qty}</span>
                        <span className="receipt-item-desc-col">{it.product_name || 'Artículo'}</span>
                      </div>
                      <div className="receipt-item-line-sub">
                        <span>PRECIO: ${price.toFixed(2)}</span>
                        <span><strong>TOTAL: ${lineTotal}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="receipt-divider-dash" />

              {/* TOTALES FISCALES ALINEADOS A LA DERECHA */}
              {(() => {
                const total = Number(detailModal.total || 0);
                const shipping = Number(detailModal.shipping_cost || 0);
                const discount = Number(detailModal.discount || 0);
                const isTicket = detailModal.invoice_type === 'INTERNAL_TICKET' || detailModal.invoiceType === 'INTERNAL_TICKET' || (!detailModal.invoice_type && !detailModal.invoiceType);
                const rawTax = Number(detailModal.tax != null ? detailModal.tax : 0);
                const tax = isTicket ? 0 : rawTax;
                const isTax15 = !isTicket && tax > 0;
                const subtotalSinImp = Math.max(0, Number(detailModal.subtotal || 0) - discount);
                const subtotal15 = isTax15 ? subtotalSinImp : 0.00;
                const subtotal0 = !isTax15 ? subtotalSinImp : 0.00;

                return (
                  <div className="receipt-fiscal-totals">
                    {isTax15 ? (
                      <div className="receipt-fiscal-row">
                        <span>Subtotal 15%</span>
                        <span>${subtotal15.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="receipt-fiscal-row">
                        <span>Subtotal 0% (Tarifa 0)</span>
                        <span>${subtotal0.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="receipt-fiscal-row">
                      <span>Subtotal sin Impuesto</span>
                      <span>${subtotalSinImp.toFixed(2)}</span>
                    </div>
                    <div className="receipt-fiscal-row">
                      <span>Descuento %</span>
                      <span>{discount > 0 ? `-$${discount.toFixed(2)}` : '$0.00'}</span>
                    </div>
                    {shipping > 0 && (
                      <div className="receipt-fiscal-row">
                        <span>Flete a Domicilio</span>
                        <span>+${shipping.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="receipt-fiscal-row">
                      <span>{isTax15 ? 'IVA 15%' : 'IVA (0%)'}</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>
                    <div className="receipt-fiscal-row highlight">
                      <span>Valor Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="receipt-divider-dash" />

              {/* SECCIÓN DE OBSERVACIÓN Y FORMA DE PAGO */}
              <div className="receipt-obs-section">
                <div><strong>OBSERVACIÓN:</strong></div>
                {(detailModal.payments && detailModal.payments.length > 0) ? (
                  detailModal.payments.map((p: Any, pIdx: number) => (
                    <div key={pIdx}>
                      PAGO {String(p.payment_method || 'EFECTIVO').toUpperCase()}: ${Number(p.amount || 0).toFixed(2)}
                    </div>
                  ))
                ) : (
                  <div>PAGO CONTADO EFECTIVO: ${Number(detailModal.total || 0).toFixed(2)}</div>
                )}
                {detailModal.delivery_notes && (
                  <div style={{ marginTop: '2px' }}>Notas: {detailModal.delivery_notes}</div>
                )}
                {detailModal.tracking_number && (
                  <div style={{ marginTop: '2px' }}>Tracking: {detailModal.tracking_number}</div>
                )}
              </div>

              <div className="receipt-divider-dash" />

              {/* CLÁUSULA OFICIAL DE GARANTÍA */}
              <div className="receipt-warranty-box">
                PARA TERMINOS DE GARANTIA DEBE PRESENTAR SU TICKET<br />
                DE LO CONTRARIO NO TIENE GARANTIA EL PRODUCTO
                {detailModal.warranty_days ? (
                  <div style={{ marginTop: '3px', fontSize: '9px', fontWeight: 'bold' }}>
                    COBERTURA: {detailModal.warranty_days} DÍAS · CÓDIGO: {detailModal.warranty_code || `GAR-${detailModal.id?.slice(0, 6).toUpperCase()}`}
                  </div>
                ) : null}
              </div>

              {/* CÓDIGO QR PARA VALIDACIÓN DIGITAL */}
              <div className="receipt-qr-wrap" style={{ textAlign: 'center', margin: '8px 0 4px' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `https://fixmetiendas.local/ticket/${detailModal.id || 'TICKET'}`
                  )}`}
                  alt="QR Verificación"
                  style={{
                    width: detailPaperWidth === '58mm' ? '120px' : '145px',
                    height: detailPaperWidth === '58mm' ? '120px' : '145px',
                    display: 'inline-block',
                    margin: '0 auto'
                  }}
                />
                <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#000', marginTop: '3px' }}>
                  Escanee para validar ticket y garantía oficial
                </div>
              </div>
            </div>

            {/* AUDITORÍA INTERNA DE RENTABILIDAD (SÓLO PANTALLA - NUNCA SE IMPRIME AL CLIENTE) */}
            {canViewCosts && (
              <div className="no-print" style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', margin: '12px 0 4px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  🔒 Auditoría Interna del Negocio (Solo visible en pantalla)
                </div>
                <div className="receipt-meta-row" style={{ color: '#dc2626', fontSize: '11px' }}>
                  <span>Inversión Mercadería (Costo):</span>
                  <strong>-${Number(detailModal.total_cost || 0).toFixed(2)}</strong>
                </div>
                <div className="receipt-meta-row" style={{ color: '#059669', fontWeight: 800, fontSize: '12px' }}>
                  <span>Ganancia Bruta Negocio:</span>
                  <strong>+${Number(detailModal.gross_profit || 0).toFixed(2)}</strong>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS (NO-PRINT) */}
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="primary-action"
                  style={{ flex: 1, padding: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => printTicketElement('printable-sale-receipt', detailPaperWidth)}
                >
                  🖨️ Imprimir Térmico ({detailPaperWidth})
                </button>
                {detailModal.electronic_invoice_id ? (
                  <button
                    type="button"
                    className="primary-action"
                    style={{ flex: 1, padding: '10px', fontWeight: 700, background: '#059669', borderColor: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setShowRideInvoiceId(detailModal.electronic_invoice_id)}
                  >
                    🏛️ Ver RIDE SRI
                  </button>
                ) : detailModal.invoice_type === 'SRI_INVOICE' && (
                  <button
                    type="button"
                    className="primary-action"
                    style={{ flex: 1, padding: '10px', fontWeight: 700, background: '#d97706', borderColor: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={async () => {
                      const sId = detailModal.id;
                      setDetailModal(null);
                      await issueSriInvoice(sId);
                    }}
                  >
                    🏛️ Emitir Factura SRI
                  </button>
                )}
                {detailModal.customer_phone && (
                  <a
                    className="whatsapp-btn"
                    style={{ flex: 1, textDecoration: 'none', justifyContent: 'center', padding: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                    href={`https://wa.me/${detailModal.customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      getWhatsAppMessage(detailModal)
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    💬 Enviar WhatsApp
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {detailModal.fulfillment_type === 'DELIVERY' && detailModal.tracking_number && (
                  <a
                    className="secondary-action"
                    style={{ flex: 1, padding: '8px', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700 }}
                    href={`#tracking/${detailModal.tracking_number}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📍 Ver Rastreo en Vivo
                  </a>
                )}
                <button
                  type="button"
                  className="secondary-action"
                  style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                  onClick={() => copyTicketSummary(detailModal)}
                >
                  {copied ? '✅ ¡Copiado al Portapapeles!' : '📋 Copiar Resumen de Venta'}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                  onClick={() => setDetailModal(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRideInvoiceId && (
        <SriRideModal
          invoiceId={showRideInvoiceId}
          api={api}
          onClose={() => setShowRideInvoiceId(null)}
        />
      )}

      {showSriInvoicesModal && (
        <SriInvoicesListModal
          api={api}
          onClose={() => setShowSriInvoicesModal(false)}
          onOpenRide={(id: string) => setShowRideInvoiceId(id)}
        />
      )}

      
      {/* MODAL MODERNO CONFIRMAR FACTURA SRI */}
      <ConfirmDialog
        isOpen={!!confirmSriSaleId}
        title="Generar Factura Electrónica SRI"
        message={
          <div>
            <p style={{ margin: '0 0 8px 0' }}>¿Deseas emitir la <b>Factura Electrónica oficial ante el SRI</b> para este comprobante?</p>
            <small style={{ color: 'var(--text-muted)' }}>Se aplicará la tarifa vigente de IVA, se generará la Clave de Acceso de 49 dígitos y el XML firmado.</small>
          </div>
        }
        confirmText="Emitir Factura SRI"
        cancelText="Volver"
        variant="primary"
        onConfirm={() => {
          const sId = confirmSriSaleId;
          setConfirmSriSaleId(null);
          if (sId) executeSriInvoice(sId);
        }}
        onCancel={() => setConfirmSriSaleId(null)}
      />

      {returnModalSale && (
        <div className="modal-overlay" onClick={() => setReturnModalSale(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>↩️</span> Devolución / Anulación de Venta #{returnModalSale.id?.slice(0, 8).toUpperCase()}
              </h3>
              <button className="close-button" onClick={() => setReturnModalSale(null)}>✕</button>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', margin: '12px 0', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Cliente:</span>
                <strong>{returnModalSale.customer_name || returnModalSale.customer || 'Consumidor Final'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Total Facturado:</span>
                <strong style={{ fontSize: '14px', color: '#b91c1c' }}>${Number(returnModalSale.total || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Forma de Pago Original:</span>
                <span>{returnModalSale.payment_methods || 'CASH'}</span>
              </div>
            </div>

            {returnModalSale.electronic_invoice_id && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', color: '#1e40af' }}>
                🏛️ <b>Factura SRI Vinculada:</b> Al confirmar, se emitirá automáticamente la <b>Nota de Crédito Electrónica SRI</b> autorizada correspondiente.
              </div>
            )}

            <form onSubmit={submitSaleReturn} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Motivo de la Devolución *</span>
                <textarea
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="Ej: Producto defectuoso de fábrica / Error en modelo solicitado por cliente..."
                  rows={2}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </label>

              <label>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Método de Reembolso *</span>
                <select
                  value={returnRefundMethod}
                  onChange={e => setReturnRefundMethod(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="CASH">💵 Efectivo (Egreso directo de Caja de Turno)</option>
                  <option value="TRANSFER">🏦 Transferencia Bancaria</option>
                  <option value="CREDIT_NOTE">📑 Saldo a Favor del Cliente / Nota de Crédito</option>
                </select>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 0' }}>
                <input
                  type="checkbox"
                  checked={returnRestock}
                  onChange={e => setReturnRestock(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  📦 Reingresar mercadería al inventario (Kardex IN)
                </span>
              </label>

              <div className="modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="secondary-action" onClick={() => setReturnModalSale(null)} disabled={submittingReturn}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-action"
                  style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                  disabled={submittingReturn}
                >
                  {submittingReturn ? 'Procesando...' : '↩️ Confirmar Devolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


export default Sales;
