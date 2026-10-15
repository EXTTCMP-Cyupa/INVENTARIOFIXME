import React from 'react';
import { Any, getBranchId, Table } from '../../sharedConfig';
import { TicketFormatSelector, TicketPaperWidth, getStoredPaperWidth, setStoredPaperWidth, printTicketElement } from '../../ticketPrinter';
import { Search } from 'lucide-react';

export function Warranties({api, notify, go, branchId: propBranchId}:{api:(u:string,o?:RequestInit)=>Promise<Response>, notify?:(msg:string)=>void, go?:(page:string)=>void, branchId?: string}){
const branchId = propBranchId || getBranchId();
  const [rows, setRows] = React.useState<Any[]>([]);
  const [stats, setStats] = React.useState({ total: 0, active: 0, expiringSoon: 0, claimed: 0, expired: 0 });
  const [loading, setLoading] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');

  // Modals
  const [selectedCert, setSelectedCert] = React.useState<Any|null>(null);
  const [certPaperWidth, setCertPaperWidth] = React.useState<TicketPaperWidth>(getStoredPaperWidth());
  const [claimTarget, setClaimTarget] = React.useState<Any|null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [voidTarget, setVoidTarget] = React.useState<Any|null>(null);
  const [voidReason, setVoidReason] = React.useState('');

  // Selectors data
  const [products, setProducts] = React.useState<Any[]>([]);
  const [customers, setCustomers] = React.useState<Any[]>([]);
  const [technicians, setTechnicians] = React.useState<Any[]>([]);

  // Create form
  const [createForm, setCreateForm] = React.useState({
    productId: '',
    customerId: '',
    serialNumber: '',
    days: 365,
    terms: 'Garantía técnica oficial ante defectos de fábrica y mano de obra. No cubre humedad o caídas.'
  });

  // Claim form
  const [claimForm, setClaimForm] = React.useState({
    resolution: 'REPAIR_WORK_ORDER',
    notes: '',
    technicianId: '',
    slaHours: 48
  });
  const [submitting, setSubmitting] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') q.set('status', statusFilter);
      if (search.trim()) q.set('search', search.trim());
      
      const [rRows, rStats] = await Promise.all([
        api(`/api/warranties?${q.toString()}`),
        api('/api/warranties/stats')
      ]);

      if (rRows.ok) setRows(await rRows.json());
      if (rStats.ok) setStats(await rStats.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter, search]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Load auxiliary data for modals
  React.useEffect(() => {
    api(`/api/products?branchId=${branchId}`).then(r => r.ok ? r.json() : []).then(setProducts).catch(() => {});
    api('/api/customers').then(r => r.ok ? r.json() : []).then(setCustomers).catch(() => {});
    api('/api/work-orders/technicians').then(r => r.ok ? r.json() : []).then(setTechnicians).catch(() => {});
  }, [api]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.productId) {
      alert('Debes seleccionar un producto.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api('/api/warranties', {
        method: 'POST',
        body: JSON.stringify({
          productId: createForm.productId,
          customerId: createForm.customerId || null,
          serialNumber: createForm.serialNumber ? createForm.serialNumber.trim() : null,
          days: Number(createForm.days) || 365,
          terms: createForm.terms
        })
      });
      if (res.ok) {
        const created = await res.json();
        if (notify) notify('🛡️ Garantía emitida exitosamente: ' + (created.warranty_code || ''));
        setShowCreate(false);
        setCreateForm({
          productId: '',
          customerId: '',
          serialNumber: '',
          days: 365,
          terms: 'Garantía técnica oficial ante defectos de fábrica y mano de obra. No cubre humedad o caídas.'
        });
        loadData();
        setSelectedCert(created);
      } else {
        const err = await res.text();
        alert('Error al emitir garantía: ' + err);
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimTarget) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/warranties/${claimTarget.id}/claim`, {
        method: 'PATCH',
        body: JSON.stringify({
          notes: claimForm.notes,
          resolution: claimForm.resolution,
          technicianId: claimForm.technicianId || null,
          slaHours: Number(claimForm.slaHours) || 48
        })
      });
      if (res.ok) {
        const updated = await res.json();
        const otMsg = updated.work_order_number ? ` (Orden técnica creada: ${updated.work_order_number})` : '';
        if (notify) notify(`🛡️ Reclamo procesado exitosamente${otMsg}`);
        setClaimTarget(null);
        setClaimForm({
          resolution: 'REPAIR_WORK_ORDER',
          notes: '',
          technicianId: '',
          slaHours: 48
        });
        loadData();
      } else {
        const err = await res.text();
        alert('Error al procesar reclamo: ' + err);
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/warranties/${voidTarget.id}/void`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: voidReason || 'Anulada por administrador' })
      });
      if (res.ok) {
        if (notify) notify('Garantía anulada correctamente.');
        setVoidTarget(null);
        setVoidReason('');
        loadData();
      } else {
        alert('No se pudo anular la garantía.');
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const shareWhatsApp = (w: Any) => {
    const rawPhone = (w.customer_phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('0') ? '593' + rawPhone.slice(1) : (rawPhone || '');
    const verifyUrl = `${window.location.origin}/public/warranties/verify?token=${w.tenant_id}.${w.warranty_code}`;
    const text = `Hola ${w.customer_name || 'Estimado cliente'}, aquí tiene su Certificado Oficial de Garantía de *${w.product_name || 'su equipo'}* emitido por *Fixme Tiendas*.\n\n🛡️ *Código de Garantía:* ${w.warranty_code}\n📅 *Válido hasta:* ${new Date(w.expires_at).toLocaleDateString()}\n🔍 *Consulta tu cobertura en vivo:* ${verifyUrl}`;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="warranties-page">
      {/* Header with Title and Primary Actions */}
      <section className="panel" style={{marginBottom: 16}}>
        <div className="panel-head" style={{flexWrap: 'wrap', gap: 12}}>
          <div>
            <h2 style={{fontSize: 20, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8}}>
              🛡️ Garantías y Pólizas Técnicas
            </h2>
            <p style={{margin: 0, fontSize: 13, color: '#64748b'}}>
              Control integral de garantías, certificados 80mm con QR en tiempo real y flujo automático hacia Taller.
            </p>
          </div>
          <div style={{display: 'flex', gap: 8}}>
            <button className="secondary" onClick={() => loadData()} title="Recargar lista" style={{display: 'flex', alignItems: 'center', gap: 5}}>
              🔄 Refrescar
            </button>
            <button onClick={() => setShowCreate(true)} style={{display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700}}>
              ➕ Emitir Garantía Manual
            </button>
          </div>
        </div>

        {/* KPI Metrics Cards */}
        <div className="warranty-kpi-grid" style={{marginTop: 16}}>
          <div
            className={`warranty-kpi-card ${statusFilter === 'ALL' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            <span className="kpi-label">📋 Total Registradas</span>
            <span className="kpi-value">{stats.total}</span>
          </div>
          <div
            className={`warranty-kpi-card kpi-active ${statusFilter === 'ACTIVE' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            <span className="kpi-label">🟢 Vigentes</span>
            <span className="kpi-value">{stats.active}</span>
          </div>
          <div
            className={`warranty-kpi-card kpi-expiring ${statusFilter === 'EXPIRING_SOON' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('EXPIRING_SOON')}
          >
            <span className="kpi-label">⚠️ Por Vencer (&le;15d)</span>
            <span className="kpi-value">{stats.expiringSoon}</span>
          </div>
          <div
            className={`warranty-kpi-card kpi-claimed ${statusFilter === 'CLAIMED' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('CLAIMED')}
          >
            <span className="kpi-label">🛠️ Reclamadas / Taller</span>
            <span className="kpi-value">{stats.claimed}</span>
          </div>
          <div
            className={`warranty-kpi-card kpi-expired ${statusFilter === 'EXPIRED' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('EXPIRED')}
          >
            <span className="kpi-label">🔴 Vencidas</span>
            <span className="kpi-value">{stats.expired}</span>
          </div>
        </div>

        {/* Toolbar: Search and Filter Pills */}
        <div className="warranty-controls">
          <div className="warranty-search-wrap">
            <span className="warranty-search-icon">🔍</span>
            <input
              type="text"
              className="warranty-search-input"
              placeholder="Buscar por código, serie, producto, cliente o teléfono..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '2px 6px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="warranty-filter-pills">
            {[
              ['ALL', 'Todas'],
              ['ACTIVE', '🟢 Vigentes'],
              ['EXPIRING_SOON', '⚠️ Por Vencer'],
              ['CLAIMED', '🛠️ Reclamadas'],
              ['EXPIRED', '🔴 Vencidas'],
              ['VOID', '⚪ Anuladas']
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`warranty-pill ${statusFilter === k ? 'active' : ''}`}
                onClick={() => setStatusFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Warranties Table */}
      <section className="panel table-panel">
        <div className="panel-head">
          <h3>
            Listado de Garantías {statusFilter !== 'ALL' && <small style={{color: '#64748b'}}>({statusFilter})</small>}
          </h3>
          <span style={{fontSize: 12, color: '#64748b'}}>{rows.length} registros encontrados</span>
        </div>

        {loading ? (
          <div style={{textAlign: 'center', padding: 32, color: '#64748b'}}>
            <p>Cargando garantías...</p>
          </div>
        ) : rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código / Serie</th>
                  <th>Producto</th>
                  <th>Cliente</th>
                  <th>Plazo / Cobertura</th>
                  <th>Estado / Resolución</th>
                  <th style={{textAlign: 'right'}}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: Any) => {
                  const isExpiring = r.status === 'ACTIVE' && r.remaining_days <= 15 && r.remaining_days >= 0;
                  return (
                    <tr key={r.id}>
                      <td data-label="Código">
                        <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
                          <strong style={{fontFamily: 'monospace', fontSize: 13, color: '#1e293b'}}>
                            {r.warranty_code || 'GAR-XXXX'}
                          </strong>
                          {r.serial_number ? (
                            <span className="serial-tag" title={r.serial_number}>
                              S/N: {r.serial_number}
                            </span>
                          ) : (
                            <small style={{color: '#94a3b8', fontSize: 11}}>Sin N° de Serie</small>
                          )}
                        </div>
                      </td>
                      <td data-label="Producto">
                        <div style={{display: 'flex', flexDirection: 'column'}}>
                          <strong style={{fontSize: 13, color: '#0f172a'}}>
                            {r.product_name || 'Producto'}
                          </strong>
                          <div style={{display: 'flex', gap: 6, fontSize: 11, color: '#64748b', marginTop: 2}}>
                            <span>SKU: {r.product_sku || 'N/A'}</span>
                            {r.product_price ? <span>• ${Number(r.product_price).toFixed(2)}</span> : null}
                          </div>
                        </div>
                      </td>
                      <td data-label="Cliente">
                        <div style={{display: 'flex', flexDirection: 'column'}}>
                          <strong style={{fontSize: 12.5, color: '#334155'}}>
                            {r.customer_name || 'Consumidor Final'}
                          </strong>
                          {r.customer_phone && (
                            <small style={{color: '#64748b', display: 'flex', alignItems: 'center', gap: 4}}>
                              📞 {r.customer_phone}
                            </small>
                          )}
                        </div>
                      </td>
                      <td data-label="Plazo">
                        <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
                          <div style={{fontSize: 11.5, color: '#475569'}}>
                            {new Date(r.starts_at).toLocaleDateString()} &rarr; {new Date(r.expires_at).toLocaleDateString()}
                          </div>
                          <div>
                            {r.status === 'ACTIVE' ? (
                              isExpiring ? (
                                <span className="days-counter warning">⚠️ Vence en {r.remaining_days}d</span>
                              ) : (
                                <span className="days-counter good">🟢 {r.remaining_days}d restantes</span>
                              )
                            ) : r.status === 'CLAIMED' ? (
                              <span className="days-counter" style={{background: '#eff6ff', color: '#1e40af'}}>
                                🛡️ Reclamada
                              </span>
                            ) : r.status === 'EXPIRED' ? (
                              <span className="days-counter danger">🔴 Expirada</span>
                            ) : (
                              <span className="days-counter" style={{background: '#f1f5f9', color: '#64748b'}}>
                                ⚪ Anulada
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-label="Estado">
                        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                          <span className={`w-badge ${r.status}`}>
                            {r.status === 'ACTIVE'
                              ? 'VIGENTE'
                              : r.status === 'CLAIMED'
                              ? 'RECLAMADA'
                              : r.status === 'EXPIRED'
                              ? 'VENCIDA'
                              : 'ANULADA'}
                          </span>
                          {r.claim_resolution && (
                            <small style={{fontSize: 11, color: '#475569', fontWeight: 600}}>
                              {r.claim_resolution === 'REPAIR_WORK_ORDER'
                                ? '🛠️ Reparación Taller'
                                : r.claim_resolution === 'REPLACEMENT'
                                ? '🔄 Reemplazo'
                                : r.claim_resolution === 'REFUND'
                                ? '💰 Reembolso'
                                : '🎧 Asistencia'}
                            </small>
                          )}
                          {r.work_order_number && (
                            <button
                              type="button"
                              onClick={() => go && go('work-orders')}
                              style={{
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                color: '#166534',
                                borderRadius: 6,
                                padding: '2px 6px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: 'fit-content'
                              }}
                              title="Ver en Taller"
                            >
                              📋 {r.work_order_number} ({r.work_order_status || 'TALLER'}) &rarr;
                            </button>
                          )}
                        </div>
                      </td>
                      <td data-label="Acciones" style={{textAlign: 'right'}}>
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap'}}>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setSelectedCert(r)}
                            style={{padding: '5px 9px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4}}
                            title="Ver e Imprimir Certificado de Garantía"
                          >
                            📜 Certificado
                          </button>
                          {r.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => {
                                setClaimTarget(r);
                                setClaimForm({
                                  resolution: 'REPAIR_WORK_ORDER',
                                  notes: '',
                                  technicianId: '',
                                  slaHours: 48
                                });
                              }}
                              style={{
                                padding: '5px 9px',
                                fontSize: 11.5,
                                background: '#3157d5',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Procesar reclamo de garantía"
                            >
                              🛡️ Reclamar
                            </button>
                          )}
                          {r.status === 'ACTIVE' && (
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => {
                                setVoidTarget(r);
                                setVoidReason('');
                              }}
                              style={{padding: '5px 8px', fontSize: 11, color: '#ef4444', borderColor: '#fca5a5'}}
                              title="Anular garantía"
                            >
                              ✕
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
        ) : (
          <div className="empty">
            <b>🛡️</b>
            <p>No se encontraron garantías registradas con los filtros actuales.</p>
            <small>Puedes emitir una nueva garantía manual o generarla automáticamente al registrar una venta en el POS.</small>
            <button onClick={() => setShowCreate(true)} style={{marginTop: 12}}>
              ➕ Emitir Primera Garantía
            </button>
          </div>
        )}
      </section>

      {/* MODAL: Certificado Oficial Térmico 80mm + QR + WhatsApp */}
      {selectedCert && (
        <div className="modal-overlay" onClick={() => setSelectedCert(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: certPaperWidth === '58mm' ? 330 : 430, transition: 'max-width 0.2s'}}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{margin: 0}}>📜 Certificado de Garantía</h3>
                <small style={{color: '#64748b'}}>Ticket oficial ({certPaperWidth}) para el cliente</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TicketFormatSelector
                  value={certPaperWidth}
                  onChange={w => {
                    setCertPaperWidth(w);
                    setStoredPaperWidth(w);
                  }}
                />
                <button className="modal-close" onClick={() => setSelectedCert(null)}>✕</button>
              </div>
            </div>

            <div className="cert-container">
              <div id="printable-warranty-cert" className={`thermal-cert paper-${certPaperWidth}`}>
                <div className="cert-header">
                  <h4 className="cert-store">Fixme Tiendas</h4>
                  <p className="cert-subtitle">Servicio Técnico y Garantías Oficiales</p>
                  <div className="cert-code-badge">{selectedCert.warranty_code || 'GAR-CERT'}</div>
                </div>

                <div className="cert-section">
                  <div className="cert-row">
                    <span>Estado:</span>
                    <strong>
                      {selectedCert.status === 'ACTIVE' ? '🟢 VIGENTE (COBERTURA TOTAL)' : selectedCert.status}
                    </strong>
                  </div>
                  <div className="cert-row">
                    <span>Emisión:</span>
                    <strong>{new Date(selectedCert.starts_at).toLocaleDateString()}</strong>
                  </div>
                  <div className="cert-row">
                    <span>Vencimiento:</span>
                    <strong>{new Date(selectedCert.expires_at).toLocaleDateString()}</strong>
                  </div>
                  <div className="cert-row">
                    <span>Días Restantes:</span>
                    <strong>{selectedCert.remaining_days} días</strong>
                  </div>
                </div>

                <div className="cert-section">
                  <div className="cert-row">
                    <span>Producto:</span>
                    <strong>{selectedCert.product_name || 'Equipo / Repuesto'}</strong>
                  </div>
                  <div className="cert-row">
                    <span>SKU:</span>
                    <strong>{selectedCert.product_sku || 'N/A'}</strong>
                  </div>
                  <div className="cert-row">
                    <span>N° Serie / IMEI:</span>
                    <strong>{selectedCert.serial_number || 'N/A'}</strong>
                  </div>
                </div>

                <div className="cert-section">
                  <div className="cert-row">
                    <span>Cliente:</span>
                    <strong>{selectedCert.customer_name || 'Consumidor Final'}</strong>
                  </div>
                  {selectedCert.customer_phone && (
                    <div className="cert-row">
                      <span>Teléfono:</span>
                      <strong>{selectedCert.customer_phone}</strong>
                    </div>
                  )}
                </div>

                <div className="cert-terms">
                  <strong>Términos de Cobertura:</strong>
                  <p style={{margin: '4px 0 0'}}>
                    {selectedCert.terms || 'Cubre defectos de fábrica y mano de obra. No cubre caídas, humedad o intervención de terceros no autorizados.'}
                  </p>
                </div>

                {/* QR Code */}
                <div className="cert-qr-wrap" style={{ textAlign: 'center', margin: '10px 0 6px' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      `${window.location.origin}/public/warranties/verify?token=${selectedCert.tenant_id}.${selectedCert.warranty_code}`
                    )}`}
                    alt="QR Garantía"
                    style={{
                      width: certPaperWidth === '58mm' ? '125px' : '155px',
                      height: certPaperWidth === '58mm' ? '125px' : '155px',
                      margin: '0 auto',
                      display: 'block'
                    }}
                  />
                  <div className="cert-qr-hint" style={{ fontSize: certPaperWidth === '58mm' ? '10px' : '11px', marginTop: '4px', fontWeight: 600 }}>
                    Escanee para verificar vigencia oficial en línea
                  </div>
                </div>

                <div className="cert-footer">
                  <p style={{margin: '0 0 2px'}}>¡Gracias por su preferencia!</p>
                  <p style={{margin: 0}}>Fixme Tiendas • Soporte Especializado</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="cert-actions">
                <button
                  type="button"
                  className="btn-whatsapp"
                  onClick={() => shareWhatsApp(selectedCert)}
                >
                  💬 Enviar WhatsApp
                </button>
                <button
                  type="button"
                  className="btn-print"
                  onClick={() => printTicketElement('printable-warranty-cert', certPaperWidth)}
                >
                  🖨️ Imprimir ({certPaperWidth})
                </button>
                <button
                  type="button"
                  className="secondary"
                  style={{width: '100%'}}
                  onClick={() => {
                    const link = `${window.location.origin}/public/warranties/verify?token=${selectedCert.tenant_id}.${selectedCert.warranty_code}`;
                    navigator.clipboard.writeText(link);
                    if (notify) notify('Enlace público de garantía copiado al portapapeles');
                  }}
                >
                  📋 Copiar Enlace Público de Verificación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Procesar Reclamo de Garantía (Conexión Taller $0.00) */}
      {claimTarget && (
        <div className="modal-overlay" onClick={() => setClaimTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: 520}}>
            <div className="modal-header">
              <div>
                <h3 style={{margin: 0}}>🛡️ Procesar Reclamo de Garantía</h3>
                <small style={{color: '#64748b'}}>
                  {claimTarget.warranty_code} • {claimTarget.product_name}
                </small>
              </div>
              <button className="modal-close" onClick={() => setClaimTarget(null)}>✕</button>
            </div>

            <form onSubmit={handleClaim} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <div style={{background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, fontSize: 12}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                  <span style={{color: '#64748b'}}>Cliente:</span>
                  <strong>{claimTarget.customer_name || 'Consumidor Final'}</strong>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                  <span style={{color: '#64748b'}}>Número de Serie:</span>
                  <strong>{claimTarget.serial_number || 'N/A'}</strong>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{color: '#64748b'}}>Vigencia restante:</span>
                  <span style={{color: '#059669', fontWeight: 700}}>{claimTarget.remaining_days} días de cobertura</span>
                </div>
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 6}}>
                  Resolución del Reclamo:
                </label>
                <div className="resolution-grid">
                  <div
                    className={`resolution-card ${claimForm.resolution === 'REPAIR_WORK_ORDER' ? 'selected' : ''}`}
                    onClick={() => setClaimForm({...claimForm, resolution: 'REPAIR_WORK_ORDER'})}
                  >
                    <input
                      type="radio"
                      name="res"
                      checked={claimForm.resolution === 'REPAIR_WORK_ORDER'}
                      onChange={() => setClaimForm({...claimForm, resolution: 'REPAIR_WORK_ORDER'})}
                    />
                    <div className="resolution-info">
                      <strong>🛠️ Crear Orden de Trabajo en Taller ($0.00 Cobertura Total)</strong>
                      <small>Genera automáticamente la OT técnica con número de seguimiento y SLA garantizado sin costo al cliente.</small>
                    </div>
                  </div>

                  <div
                    className={`resolution-card ${claimForm.resolution === 'REPLACEMENT' ? 'selected' : ''}`}
                    onClick={() => setClaimForm({...claimForm, resolution: 'REPLACEMENT'})}
                  >
                    <input
                      type="radio"
                      name="res"
                      checked={claimForm.resolution === 'REPLACEMENT'}
                      onChange={() => setClaimForm({...claimForm, resolution: 'REPLACEMENT'})}
                    />
                    <div className="resolution-info">
                      <strong>🔄 Reemplazo / Cambio Directo de Unidad</strong>
                      <small>Autoriza entrega de producto sustituto nuevo o refabricado al cliente.</small>
                    </div>
                  </div>

                  <div
                    className={`resolution-card ${claimForm.resolution === 'REFUND' ? 'selected' : ''}`}
                    onClick={() => setClaimForm({...claimForm, resolution: 'REFUND'})}
                  >
                    <input
                      type="radio"
                      name="res"
                      checked={claimForm.resolution === 'REFUND'}
                      onChange={() => setClaimForm({...claimForm, resolution: 'REFUND'})}
                    />
                    <div className="resolution-info">
                      <strong>💰 Nota de Crédito / Reembolso Comercial</strong>
                      <small>Devolución del importe pagado o emisión de saldo a favor en tienda.</small>
                    </div>
                  </div>
                </div>
              </div>

              {claimForm.resolution === 'REPAIR_WORK_ORDER' && (
                <div style={{background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10}}>
                  <strong style={{fontSize: 12, color: '#1e40af'}}>Detalles Técnicos para el Taller:</strong>
                  
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                    <div>
                      <label style={{fontSize: 11, color: '#1e3a8a', display: 'block', marginBottom: 3}}>Técnico Asignado</label>
                      <select
                        value={claimForm.technicianId}
                        onChange={e => setClaimForm({...claimForm, technicianId: e.target.value})}
                        style={{width: '100%', fontSize: 12, padding: 8, borderRadius: 6, border: '1px solid #93c5fd'}}
                      >
                        <option value="">-- Asignación Automática --</option>
                        {technicians.map((t: Any) => (
                          <option key={t.id} value={t.id}>{t.fullName || t.email}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{fontSize: 11, color: '#1e3a8a', display: 'block', marginBottom: 3}}>SLA / Plazo Máximo</label>
                      <select
                        value={claimForm.slaHours}
                        onChange={e => setClaimForm({...claimForm, slaHours: Number(e.target.value)})}
                        style={{width: '100%', fontSize: 12, padding: 8, borderRadius: 6, border: '1px solid #93c5fd'}}
                      >
                        <option value={24}>⚡ Express 24 horas</option>
                        <option value={48}>🕒 Estándar 48 horas</option>
                        <option value={72}>📆 Extendido 72 horas</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Motivo del Reclamo / Falla Reportada por el Cliente:
                </label>
                <textarea
                  required
                  rows={3}
                  value={claimForm.notes}
                  onChange={e => setClaimForm({...claimForm, notes: e.target.value})}
                  placeholder="Ej: La pantalla presenta líneas verticales o el equipo no enciende tras carga..."
                  style={{width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12}}
                />
              </div>

              <div className="modal-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10}}>
                <button type="button" className="secondary" onClick={() => setClaimTarget(null)}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} style={{fontWeight: 700}}>
                  {submitting ? 'Procesando...' : 'Confirmar Reclamo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Nueva Garantía Manual */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: 520}}>
            <div className="modal-header">
              <div>
                <h3 style={{margin: 0}}>➕ Emitir Garantía Manual</h3>
                <small style={{color: '#64748b'}}>Emisión directa con código único y certificado QR</small>
              </div>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Producto Cubierto: *
                </label>
                <select
                  required
                  value={createForm.productId}
                  onChange={e => setCreateForm({...createForm, productId: e.target.value})}
                  style={{width: '100%', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
                >
                  <option value="">-- Selecciona el producto --</option>
                  {products.map((p: Any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (SKU: {p.sku}) - ${Number(p.price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Cliente Titular (Opcional):
                </label>
                <select
                  value={createForm.customerId}
                  onChange={e => setCreateForm({...createForm, customerId: e.target.value})}
                  style={{width: '100%', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
                >
                  <option value="">-- Consumidor Final / Mostrador --</option>
                  {customers.map((c: Any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Número de Serie / IMEI / Código de Equipo:
                </label>
                <input
                  type="text"
                  placeholder="Ej: SN-APP-2026-X01 o IMEI 3548..."
                  value={createForm.serialNumber}
                  onChange={e => setCreateForm({...createForm, serialNumber: e.target.value})}
                  style={{width: '100%', boxSizing: 'border-box', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
                />
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Plazo de Cobertura (Días):
                </label>
                <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6}}>
                  {[
                    [30, '30 días (1 mes)'],
                    [90, '90 días (3 meses)'],
                    [180, '180 días (6 meses)'],
                    [365, '1 año (365 d)'],
                    [730, '2 años (730 d)']
                  ].map(([d, lbl]) => (
                    <button
                      key={d}
                      type="button"
                      className={`chip ${createForm.days === d ? 'active' : ''}`}
                      onClick={() => setCreateForm({...createForm, days: Number(d)})}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        borderRadius: 16,
                        border: '1px solid #cbd5e1',
                        background: createForm.days === d ? '#1e293b' : '#fff',
                        color: createForm.days === d ? '#fff' : '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={createForm.days}
                  onChange={e => setCreateForm({...createForm, days: Number(e.target.value)})}
                  style={{width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
                />
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Términos y Condiciones:
                </label>
                <textarea
                  rows={2}
                  value={createForm.terms}
                  onChange={e => setCreateForm({...createForm, terms: e.target.value})}
                  style={{width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12}}
                />
              </div>

              <div className="modal-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10}}>
                <button type="button" className="secondary" onClick={() => setShowCreate(false)}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} style={{fontWeight: 700}}>
                  {submitting ? 'Generando...' : 'Emitir Garantía Oficial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Anular Garantía */}
      {voidTarget && (
        <div className="modal-overlay" onClick={() => setVoidTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: 440}}>
            <div className="modal-header">
              <h3 style={{margin: 0, color: '#ef4444'}}>✕ Anular Garantía</h3>
              <button className="modal-close" onClick={() => setVoidTarget(null)}>✕</button>
            </div>
            <form onSubmit={handleVoid} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <p style={{fontSize: 13, color: '#475569', margin: 0}}>
                ¿Estás seguro de que deseas anular la garantía <strong>{voidTarget.warranty_code}</strong> correspondiente a <strong>{voidTarget.product_name}</strong>?
              </p>
              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Motivo de anulación:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Devolución comercial, producto canjeado o error de registro"
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  style={{width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12}}
                />
              </div>
              <div className="modal-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                <button type="button" className="secondary" onClick={() => setVoidTarget(null)}>
                  Volver
                </button>
                <button type="submit" disabled={submitting} style={{background: '#ef4444', color: '#fff', fontWeight: 700}}>
                  {submitting ? 'Anulando...' : 'Confirmar Anulación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Warranties;
