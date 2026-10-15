import React from 'react';
import { Any } from '../../sharedConfig';

export function Deliveries({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){
  const [rows, setRows] = React.useState<Any[]>([]);
  const [drivers, setDrivers] = React.useState<Any[]>([]);
  const [filterTab, setFilterTab] = React.useState<'ALL'|'PENDING'|'IN_TRANSIT'|'DELIVERED'>('ALL');
  const [search, setSearch] = React.useState('');
  const [courierModal, setCourierModal] = React.useState<Any|null>(null);
  const [showDriverModal, setShowDriverModal] = React.useState(false);
  const [newDriver, setNewDriver] = React.useState({ fullName: '', phone: '', vehicleType: 'MOTO' });
  const [dispatchType, setDispatchType] = React.useState<'FLEET' | 'INDRIVE' | 'SERVIENTREGA'>('FLEET');
  const [dispatchForm, setDispatchForm] = React.useState({ driverId: '', courier: '', trackingUrl: '', trackingNumber: '' });
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api('/api/deliveries').then(r => r.ok ? r.json() : []).then(setRows);
    api('/api/delivery-drivers').then(r => r.ok ? r.json() : []).then(setDrivers);
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  async function createDriver(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api('/api/delivery-drivers', {
      method: 'POST',
      body: JSON.stringify(newDriver)
    });
    setBusy(false);
    if (r.ok) {
      setMsg('Repartidor registrado exitosamente');
      setNewDriver({ fullName: '', phone: '', vehicleType: 'MOTO' });
      setShowDriverModal(false);
      load();
    } else {
      setMsg('No se pudo registrar al repartidor');
    }
  }

  async function startDispatch(e: React.FormEvent) {
    e.preventDefault();
    if (!courierModal) return;
    setBusy(true);

    let finalCourier = '';
    let driverId: string | null = null;
    let trackingUrl: string | null = null;
    let trackingNumber: string | null = null;

    if (dispatchType === 'FLEET') {
      const selectedDr = drivers.find(d => d.id === dispatchForm.driverId);
      finalCourier = selectedDr ? selectedDr.fullName : (dispatchForm.courier.trim() || 'Motorizado Flota');
      driverId = dispatchForm.driverId || null;
    } else if (dispatchType === 'INDRIVE') {
      finalCourier = dispatchForm.courier.trim() || 'InDrive';
      trackingUrl = dispatchForm.trackingUrl.trim() || null;
    } else if (dispatchType === 'SERVIENTREGA') {
      finalCourier = dispatchForm.courier.trim() || 'Servientrega Nacional';
      trackingNumber = dispatchForm.trackingNumber.trim() || null;
    }

    const r = await api(`/api/deliveries/${courierModal.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'IN_TRANSIT',
        courier: finalCourier,
        driverId,
        trackingUrl,
        trackingNumber
      })
    });
    setBusy(false);
    if (r.ok) {
      setCourierModal(null);
      setMsg('¡Pedido despachado exitosamente en camino!');
      load();
    } else {
      setMsg('Error al despachar el pedido');
    }
  }

  async function markDelivered(id: string) {
    setBusy(true);
    const r = await api(`/api/deliveries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DELIVERED' })
    });
    setBusy(false);
    if (r.ok) {
      setMsg('¡Entrega completada exitosamente!');
      load();
    }
  }

  const pendingCount = rows.filter(d => d.status === 'PENDING').length;
  const inTransitCount = rows.filter(d => d.status === 'IN_TRANSIT' || d.status === 'ASSIGNED').length;
  const deliveredCount = rows.filter(d => d.status === 'DELIVERED').length;

  const filtered = rows.filter(d => {
    const matchTab =
      filterTab === 'ALL' ? true :
      filterTab === 'PENDING' ? d.status === 'PENDING' :
      filterTab === 'IN_TRANSIT' ? (d.status === 'IN_TRANSIT' || d.status === 'ASSIGNED') :
      d.status === 'DELIVERED';

    const q = search.toLowerCase().trim();
    const matchSearch = !q || [
      d.recipient_name, d.recipient_phone, d.customer_name, d.customer_phone,
      d.address, d.courier, d.driver_name, d.tracking_number, d.tracking_url, d.sale_id
    ].some(v => v && String(v).toLowerCase().includes(q));

    return matchTab && matchSearch;
  });

  return (
    <>
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">LOGÍSTICA Y DESPACHOS A DOMICILIO</span>
          <h2>Tablero de Entregas & Courier</h2>
          <p>Gestiona repartidores propios, enlaces en vivo de InDrive/Uber y números de guía de Servientrega.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setShowDriverModal(true)}
          >
            🛵 Registrar Repartidor
          </button>
          <button className="primary-action" onClick={load}>Actualizar</button>
        </div>
      </section>

      {/* DISPATCH KPIS */}
      <div className="finance-grid">
        <div className="finance-card">
          <small>Pendientes de Salida</small>
          <strong style={{ color: pendingCount > 0 ? '#f59e0b' : '#64748b' }}>{pendingCount}</strong>
          <span>🛵 Requieren asignación de courier</span>
        </div>
        <div className="finance-card">
          <small>En Camino / Ruta</small>
          <strong className="text-revenue">{inTransitCount}</strong>
          <span>🚀 Repartidores en tránsito</span>
        </div>
        <div className="finance-card">
          <small>Entregas Completadas</small>
          <strong className="text-profit">{deliveredCount}</strong>
          <span>✅ Entregadas con éxito al cliente</span>
        </div>
        <div className="finance-card">
          <small>Repartidores Registrados</small>
          <strong style={{ color: '#3157d5' }}>{drivers.length}</strong>
          <span>🛵 Personal activo de flota</span>
        </div>
      </div>

      {msg && <div className="toast" onClick={() => setMsg('')}><b>✓</b> {msg}</div>}

      {/* FILTER TABS & SEARCH */}
      <div className="panel" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="deliv-tabs" style={{ margin: 0 }}>
            {[
              ['ALL', `Todas (${rows.length})`],
              ['PENDING', `🛵 Pendientes (${pendingCount})`],
              ['IN_TRANSIT', `🚀 En camino (${inTransitCount})`],
              ['DELIVERED', `✅ Entregadas (${deliveredCount})`]
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`deliv-tab ${filterTab === k ? 'active' : ''}`}
                onClick={() => setFilterTab(k as any)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="search-box" style={{ minWidth: '260px' }}>
            <span>🔍</span>
            <input
              placeholder="Buscar destinatario, repartidor, guía o dirección..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ASSIGN COURIER / INDRIVE / SERVIENTREGA DISPATCH MODAL */}
      {courierModal && (
        <div className="modal-overlay" onClick={() => setCourierModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-head">
              <h3>🚀 Despachar Pedido #{courierModal.id?.slice(0, 8)}</h3>
              <button className="close-button" onClick={() => setCourierModal(null)}>✕</button>
            </div>

            {/* RECIPIENT SUMMARY CARD */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                  👤 {courierModal.recipient_name || courierModal.customer_name || 'Consumidor'}
                </strong>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#3157d5', background: '#eff6ff', padding: '3px 8px', borderRadius: '6px' }}>
                  Flete: ${Number(courierModal.shipping_cost || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>📍</span> <span>{courierModal.address}</span>
              </div>
              {(courierModal.recipient_phone || courierModal.customer_phone) && (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  📞 {courierModal.recipient_phone || courierModal.customer_phone}
                </div>
              )}
            </div>

            <form onSubmit={startDispatch}>
              {/* DISPATCH MODE SEGMENTED CARDS */}
              <div className="modal-form-group">
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                  Modalidad de Entrega:
                </span>
                <div className="dispatch-mode-grid">
                  <div
                    className={`dispatch-mode-card ${dispatchType === 'FLEET' ? 'active' : ''}`}
                    onClick={() => {
                      setDispatchType('FLEET');
                      const sel = drivers.find(d => d.id === dispatchForm.driverId);
                      setDispatchForm(prev => ({
                        ...prev,
                        courier: sel ? sel.fullName : (drivers[0]?.fullName || 'Motorizado Flota')
                      }));
                    }}
                  >
                    <span className="dispatch-mode-icon">🛵</span>
                    <span className="dispatch-mode-title">Flota Propia</span>
                    <span className="dispatch-mode-subtitle">Motorizado tienda</span>
                  </div>

                  <div
                    className={`dispatch-mode-card ${dispatchType === 'INDRIVE' ? 'active' : ''}`}
                    onClick={() => {
                      setDispatchType('INDRIVE');
                      setDispatchForm(prev => ({
                        ...prev,
                        courier: prev.courier && (prev.courier.includes('InDrive') || prev.courier.includes('Uber')) ? prev.courier : 'InDrive'
                      }));
                    }}
                  >
                    <span className="dispatch-mode-icon">🚗</span>
                    <span className="dispatch-mode-title">InDrive / Uber</span>
                    <span className="dispatch-mode-subtitle">Rastreo en vivo</span>
                  </div>

                  <div
                    className={`dispatch-mode-card ${dispatchType === 'SERVIENTREGA' ? 'active' : ''}`}
                    onClick={() => {
                      setDispatchType('SERVIENTREGA');
                      setDispatchForm(prev => ({
                        ...prev,
                        courier: prev.courier && (prev.courier.includes('Servientrega') || prev.courier.includes('Tramaco')) ? prev.courier : 'Servientrega'
                      }));
                    }}
                  >
                    <span className="dispatch-mode-icon">📦</span>
                    <span className="dispatch-mode-title">Servientrega</span>
                    <span className="dispatch-mode-subtitle">Guía nacional</span>
                  </div>
                </div>
              </div>

              {/* CONDITIONAL CONTENT: FLEET */}
              {dispatchType === 'FLEET' && (
                <>
                  <label>
                    <span>Seleccionar Repartidor Registrado</span>
                    <select
                      value={dispatchForm.driverId}
                      onChange={e => {
                        const sel = drivers.find(d => d.id === e.target.value);
                        setDispatchForm({
                          ...dispatchForm,
                          driverId: e.target.value,
                          courier: sel ? sel.fullName : dispatchForm.courier
                        });
                      }}
                    >
                      <option value="">-- Elige un conductor de tu flota --</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.vehicleType === 'MOTO' ? '🛵 Moto' : d.vehicleType === 'AUTO' ? '🚗 Auto' : '🚲 Bici'} · {d.fullName} ({d.phone || 'Sin tel'})
                        </option>
                      ))}
                    </select>
                  </label>

                  {(() => {
                    const sel = drivers.find(d => d.id === dispatchForm.driverId);
                    if (sel) {
                      return (
                        <div className="driver-selected-card">
                          <div>
                            <strong>{sel.fullName}</strong>
                            <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                              {sel.vehicleType === 'MOTO' ? '🛵 Motocicleta' : sel.vehicleType === 'AUTO' ? '🚗 Automóvil' : '🚲 Bicicleta'} · {sel.phone || 'Sin teléfono'}
                            </div>
                          </div>
                          {sel.phone && (
                            <a
                              href={`tel:${sel.phone}`}
                              style={{ fontSize: '11px', background: '#16a34a', color: '#fff', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', fontWeight: 700 }}
                            >
                              📞 Llamar
                            </a>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="callout-box info">
                        <span>💡</span>
                        <div>
                          <span>¿El repartidor no está en la lista? </span>
                          <button
                            type="button"
                            style={{ background: 'transparent', border: 0, color: '#2563eb', fontWeight: 700, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
                            onClick={() => {
                              setCourierModal(null);
                              setShowDriverModal(true);
                            }}
                          >
                            + Registrar nuevo repartidor
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  <label>
                    <span>Nombre o Identificador del Courier / Repartidor</span>
                    <input
                      placeholder="Ej. Carlos Mendoza (Motorizado Express)"
                      value={dispatchForm.courier}
                      onChange={e => setDispatchForm({ ...dispatchForm, courier: e.target.value })}
                    />
                  </label>
                </>
              )}

              {/* CONDITIONAL CONTENT: INDRIVE / UBER */}
              {dispatchType === 'INDRIVE' && (
                <>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Plataforma de Viaje:
                    </span>
                    <div className="preset-pills">
                      {['InDrive', 'Uber Flash', 'Uber Direct', 'Didi Entrega', 'Cabify Envíos'].map(app => (
                        <span
                          key={app}
                          className={`preset-pill ${dispatchForm.courier.includes(app) ? 'active' : ''}`}
                          onClick={() => setDispatchForm({ ...dispatchForm, courier: app })}
                        >
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>

                  <label>
                    <span>Conductor / Vehículo / Placa</span>
                    <input
                      placeholder="Ej. Conductor Mario · Chevrolet Spark Gris (ABC-1234)"
                      value={dispatchForm.courier}
                      onChange={e => setDispatchForm({ ...dispatchForm, courier: e.target.value })}
                    />
                  </label>

                  <label>
                    <span>🚗 Link de Seguimiento en Vivo (InDrive / Uber)</span>
                    <input
                      type="url"
                      placeholder="https://indrive.com/track/... o https://trip.uber.com/..."
                      value={dispatchForm.trackingUrl}
                      onChange={e => setDispatchForm({ ...dispatchForm, trackingUrl: e.target.value })}
                      required={dispatchType === 'INDRIVE'}
                    />
                  </label>

                  <div className="callout-box success">
                    <span>📍</span>
                    <div>
                      <strong>Rastreo en vivo:</strong> Abre tu app de InDrive o Uber, presiona <em>"Compartir mi viaje"</em> y pega el enlace aquí. El cliente podrá ver el mapa y el recorrido en tiempo real.
                    </div>
                  </div>
                </>
              )}

              {/* CONDITIONAL CONTENT: SERVIENTREGA / ENCOMIENDA */}
              {dispatchType === 'SERVIENTREGA' && (
                <>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Empresa de Encomienda:
                    </span>
                    <div className="preset-pills">
                      {['Servientrega', 'Tramaco Express', 'LaarCourier', 'Cooperativa / Bus', 'Urbano'].map(comp => (
                        <span
                          key={comp}
                          className={`preset-pill ${dispatchForm.courier.includes(comp) ? 'active' : ''}`}
                          onClick={() => setDispatchForm({ ...dispatchForm, courier: comp })}
                        >
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>

                  <label>
                    <span>Empresa de Transporte</span>
                    <input
                      placeholder="Ej. Servientrega, Tramaco Express, Cooperativa Loja..."
                      value={dispatchForm.courier}
                      onChange={e => setDispatchForm({ ...dispatchForm, courier: e.target.value })}
                    />
                  </label>

                  <label>
                    <span>📦 Número de Guía Nacional / Código de Rastreo *</span>
                    <input
                      placeholder="Ej. SER-98745231 o 001-9928172"
                      style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', letterSpacing: '0.04em' }}
                      value={dispatchForm.trackingNumber}
                      onChange={e => setDispatchForm({ ...dispatchForm, trackingNumber: e.target.value })}
                      required={dispatchType === 'SERVIENTREGA'}
                    />
                  </label>

                  <div className="callout-box warning">
                    <span>🏷️</span>
                    <div>
                      <strong>Número de Guía:</strong> Este código se incluirá en la notificación de WhatsApp para que el cliente lo ingrese directamente en el portal de rastreo del courier.
                    </div>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setCourierModal(null)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-action"
                  disabled={busy}
                >
                  {busy ? 'Despachando...' : '✓ Iniciar Entrega y Despachar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DRIVER MODAL */}
      {showDriverModal && (
        <div className="modal-overlay" onClick={() => setShowDriverModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-head">
              <h3>🛵 Registrar Repartidor de la Empresa</h3>
              <button className="close-button" onClick={() => setShowDriverModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
              Agrega conductores o motorizados de tu tienda para asignarlos fácilmente a los pedidos.
            </p>

            <form onSubmit={createDriver}>
              <label>
                <span>Nombre y Apellidos *</span>
                <input
                  placeholder="Ej. Carlos Mendoza"
                  value={newDriver.fullName}
                  onChange={e => setNewDriver({ ...newDriver, fullName: e.target.value })}
                  required
                  autoFocus
                />
              </label>

              <label>
                <span>Teléfono Celular / WhatsApp *</span>
                <input
                  placeholder="Ej. 0987654321"
                  value={newDriver.phone}
                  onChange={e => setNewDriver({ ...newDriver, phone: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>Tipo de Vehículo</span>
                <select
                  value={newDriver.vehicleType}
                  onChange={e => setNewDriver({ ...newDriver, vehicleType: e.target.value })}
                >
                  <option value="MOTO">🛵 Motocicleta</option>
                  <option value="AUTO">🚗 Automóvil / Camioneta</option>
                  <option value="BICICLETA">🚲 Bicicleta</option>
                  <option value="EXTERNO">📦 Courier Externo Asociado</option>
                </select>
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowDriverModal(false)}>
                  Cancelar
                </button>
                <button className="primary-action" disabled={busy}>
                  {busy ? 'Guardando...' : '✓ Guardar Repartidor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPATCH CARDS GRID */}
      {filtered.length ? (
        <div className="deliv-grid">
          {filtered.map(d => {
            const cleanPhone = (d.recipient_phone || d.customer_phone || '').replace(/[^0-9]/g, '');
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address || '')}`;
            
            const publicTrackUrl = d.tracking_number ? `${window.location.origin}${window.location.pathname}#tracking/${d.tracking_number}` : '';
            let waMsg = `Hola ${d.recipient_name || d.customer_name || 'estimado/a cliente'}, te informamos sobre tu entrega en FixmeTiendas.\nEstado: ${d.status === 'IN_TRANSIT' ? '🚀 EN CAMINO hacia tu dirección' : d.status === 'DELIVERED' ? '✅ ENTREGADO' : '🛵 PREPARANDO DESPACHO'}.\nDirección: ${d.address}`;
            if (d.driver_name || d.courier) {
              waMsg += `\nRepartidor: ${d.driver_name || d.courier}`;
            }
            if (publicTrackUrl) {
              waMsg += `\n📍 Sigue tu entrega en vivo aquí: ${publicTrackUrl}`;
            } else if (d.tracking_url) {
              waMsg += `\nSigue la entrega en vivo aquí: ${d.tracking_url}`;
            }
            if (d.tracking_number) {
              waMsg += `\nN° de Guía / Tracking: ${d.tracking_number}`;
            }
            const waText = encodeURIComponent(waMsg);

            return (
              <article className="deliv-card" key={d.id}>
                <div className="deliv-head">
                  <span className="order-folio">Envío #{d.id?.slice(0, 8)}</span>
                  <span className={`deliv-badge ${
                    d.status === 'PENDING' ? 'badge-pending' :
                    d.status === 'IN_TRANSIT' ? 'badge-intransit' :
                    d.status === 'DELIVERED' ? 'badge-delivered' : 'badge-cancelled'
                  }`}>
                    {d.status === 'PENDING' ? '🛵 Pendiente' :
                     d.status === 'IN_TRANSIT' ? '🚀 En Camino' :
                     d.status === 'DELIVERED' ? '✅ Entregado' : d.status}
                  </span>
                </div>

                <div className="deliv-body">
                  <div>
                    <strong style={{ fontSize: '15px' }}>{d.recipient_name || d.customer_name || 'Consumidor Final'}</strong>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                      {cleanPhone ? (
                        <>
                          <a href={`tel:${cleanPhone}`} style={{ fontSize: '12px', color: '#3157d5', textDecoration: 'none' }}>
                            📞 {d.recipient_phone || d.customer_phone}
                          </a>
                          <a
                            href={`https://wa.me/${cleanPhone}?text=${waText}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '11px', background: '#25d366', color: '#fff', padding: '2px 8px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700 }}
                          >
                            💬 WhatsApp
                          </a>
                        </>
                      ) : (
                        <small style={{ color: '#94a3b8' }}>Sin teléfono registrado</small>
                      )}
                      {d.tracking_number && (
                        <a
                          href={`#tracking/${d.tracking_number}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          title="Abrir seguimiento público para el cliente"
                        >
                          📍 Tracking
                        </a>
                      )}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <small style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>DIRECCIÓN DE ENTREGA:</small>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>{d.address}</span>
                      </div>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Ver en Google Maps"
                        style={{
                          fontSize: '11px',
                          color: '#3157d5',
                          textDecoration: 'none',
                          fontWeight: 700,
                          padding: '4px 8px',
                          background: '#e0e7ff',
                          borderRadius: '6px',
                          whiteSpace: 'nowrap',
                          marginLeft: '6px'
                        }}
                      >
                        📍 Maps
                      </a>
                    </div>

                    {d.delivery_notes && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#475569', borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                        <b>Ref:</b> {d.delivery_notes}
                      </div>
                    )}
                  </div>

                  {/* COURIER / DRIVER / TRACKING LINKS */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '4px' }}>
                    <span>
                      Repartidor: <b>{d.driver_name || d.courier || 'Sin asignar'}</b>
                    </span>
                    <span>Flete: <b>${Number(d.shipping_cost || 0).toFixed(2)}</b></span>
                  </div>

                  {/* TRACKING URL OR GUIDE NUMBER BADGES */}
                  {(d.tracking_url || d.tracking_number) && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {d.tracking_number && (
                        <a
                          href={`#tracking/${d.tracking_number}`}
                          target="_blank"
                          rel="noreferrer"
                          className="guide-pill"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                          title="Abrir página pública de rastreo"
                        >
                          📍 Tracking: <b>{d.tracking_number}</b>
                        </a>
                      )}
                      {d.tracking_url && (
                        <a
                          href={d.tracking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-indrive"
                          title="Abrir seguimiento en vivo del conductor"
                        >
                          🚗 GPS Conductor
                        </a>
                      )}
                    </div>
                  )}

                  {d.sale_total != null && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Ticket venta: <b>${Number(d.sale_total).toFixed(2)}</b> ({d.sale_channel === 'ONLINE' ? '🌐 Internet' : '🏪 Local'})
                    </div>
                  )}
                </div>

                <div className="deliv-actions">
                  {d.status === 'PENDING' && (
                    <button
                      type="button"
                      className="btn-deliv-action btn-transit"
                      onClick={() => {
                        setCourierModal(d);
                        const isIndrive = Boolean(d.tracking_url || (d.courier && /indrive|uber|didi/i.test(d.courier)));
                        const isServi = Boolean(d.tracking_number || (d.courier && /servientrega|tramaco|laar|cooperativa/i.test(d.courier)));
                        const initialType = isIndrive ? 'INDRIVE' : isServi ? 'SERVIENTREGA' : 'FLEET';
                        setDispatchType(initialType);
                        const selDr = drivers.find(dr => dr.id === d.driver_id);
                        setDispatchForm({
                          driverId: d.driver_id || '',
                          courier: d.courier || (initialType === 'FLEET' ? (selDr?.fullName || drivers[0]?.fullName || 'Motorizado Flota') : initialType === 'INDRIVE' ? 'InDrive' : 'Servientrega'),
                          trackingUrl: d.tracking_url || '',
                          trackingNumber: d.tracking_number || ''
                        });
                      }}
                    >
                      🚀 Despachar / Iniciar Ruta
                    </button>
                  )}
                  {d.status === 'IN_TRANSIT' && (
                    <button
                      type="button"
                      className="btn-deliv-action btn-delivered"
                      onClick={() => markDelivered(d.id)}
                    >
                      ✅ Marcar como Entregado
                    </button>
                  )}
                  {d.status === 'DELIVERED' && (
                    <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, padding: '6px', textAlign: 'center', width: '100%' }}>
                      ✓ Entrega finalizada
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <b>🛵</b>
          <p>No se encontraron órdenes de entrega para este filtro.</p>
          <small>Cuando en el Punto de Venta se seleccione 'Domicilio', aparecerán aquí automáticamente.</small>
        </div>
      )}
    </>
  );
}

export default Deliveries;
