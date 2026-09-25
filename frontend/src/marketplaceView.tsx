import React from 'react';

type Any = Record<string, any>;

// =========================================================================
// 1. IN-APP MARKETPLACE VIEW (PARA TIENDAS / TALLERES)
// =========================================================================
export function MarketplaceView({
  api,
  notify,
  go
}: {
  api: (u: string, o?: RequestInit) => Promise<Response>;
  notify: (msg: string) => void;
  go?: (k: string) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<'leads' | 'my_bids'>('leads');
  const [leads, setLeads] = React.useState<Any[]>([]);
  const [myBids, setMyBids] = React.useState<Any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filterCity, setFilterCity] = React.useState('ALL');
  const [filterCat, setFilterCat] = React.useState('ALL');
  const [search, setSearch] = React.useState('');

  // Bid Modal state
  const [bidModalLead, setBidModalLead] = React.useState<Any | null>(null);
  const [bidForm, setBidForm] = React.useState({
    estimatedCost: '',
    estimatedTime: '24 a 48 horas',
    sparePartQuality: 'Original',
    warrantyTerms: '90 días de garantía por escrito',
    proposalNotes: ''
  });
  const [submittingBid, setSubmittingBid] = React.useState(false);

  // Detail / Lightbox modal
  const [detailLead, setDetailLead] = React.useState<Any | null>(null);
  const [lightboxImg, setLightboxImg] = React.useState<string | null>(null);

  const ecuadorCities = [
    'ALL', 'Quito', 'Guayaquil', 'Cuenca', 'Ambato', 'Santo Domingo',
    'Machala', 'Loja', 'Manta', 'Portoviejo', 'Ibarra', 'Riobamba'
  ];

  const categories = [
    { id: 'ALL', label: 'Todos los Equipos' },
    { id: 'SMARTPHONE', label: '📱 Celulares' },
    { id: 'LAPTOP', label: '💻 Laptops' },
    { id: 'TABLET', label: '📲 Tablets' },
    { id: 'CONSOLE', label: '🎮 Consolas' },
    { id: 'DESKTOP', label: '🖥️ PC / Mac' },
    { id: 'OTHER', label: '🔌 Otros' }
  ];

  const loadLeads = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCity !== 'ALL') params.append('city', filterCity);
    if (filterCat !== 'ALL') params.append('category', filterCat);
    if (search.trim()) params.append('search', search.trim());

    api(`/api/marketplace/leads?${params.toString()}`)
      .then(r => r.ok ? r.json() : [])
      .then(setLeads)
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [api, filterCity, filterCat, search]);

  const loadMyBids = React.useCallback(() => {
    api('/api/marketplace/my-bids')
      .then(r => r.ok ? r.json() : [])
      .then(setMyBids)
      .catch(() => setMyBids([]));
  }, [api]);

  React.useEffect(() => {
    loadLeads();
    loadMyBids();
  }, [loadLeads, loadMyBids]);

  const openBidModal = (lead: Any) => {
    setBidModalLead(lead);
    if (lead.my_bid) {
      setBidForm({
        estimatedCost: String(lead.my_bid.estimatedCost || ''),
        estimatedTime: lead.my_bid.estimatedTime || '24 a 48 horas',
        sparePartQuality: lead.my_bid.sparePartQuality || 'Original',
        warrantyTerms: lead.my_bid.warrantyTerms || '90 días de garantía por escrito',
        proposalNotes: lead.my_bid.proposalNotes || ''
      });
    } else {
      setBidForm({
        estimatedCost: '',
        estimatedTime: '24 a 48 horas',
        sparePartQuality: 'Original',
        warrantyTerms: '90 días de garantía por escrito',
        proposalNotes: `Hola ${lead.customer_name}, somos taller especializado en ${lead.device_brand}. Contamos con repuesto de alta calidad y servicio técnico garantizado.`
      });
    }
  };

  const handleSendBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidModalLead) return;
    const cost = parseFloat(bidForm.estimatedCost);
    if (isNaN(cost) || cost <= 0) {
      alert('Por favor ingresa un precio de cotización válido.');
      return;
    }

    setSubmittingBid(true);
    try {
      const res = await api(`/api/marketplace/leads/${bidModalLead.id}/bids`, {
        method: 'POST',
        body: JSON.stringify(bidForm)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al enviar cotización');
      }
      notify('¡Cotización enviada al cliente con éxito!');
      setBidModalLead(null);
      loadLeads();
      loadMyBids();
    } catch (err: any) {
      alert(err.message || 'No se pudo enviar la cotización');
    } finally {
      setSubmittingBid(false);
    }
  };

  // KPIs
  const wonBidsCount = myBids.filter(b => b.bid_status === 'ACCEPTED').length;

  return (
    <section className="panel" style={{ padding: '24px 20px', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
            🎯 Adquisición de Clientes · B2B2C
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '4px 0 2px' }}>
            Bolsa de Reparaciones y Solicitudes de Clientes
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
            Capta nuevos clientes en tu ciudad, cotiza averías con fotos y convierte presupuestos aceptados directamente en Órdenes de Trabajo en tu taller.
          </p>
        </div>

        <button
          type="button"
          className="secondary-action"
          onClick={() => { loadLeads(); loadMyBids(); }}
          style={{ fontSize: 12, padding: '7px 12px' }}
        >
          🔄 Actualizar Oportunidades
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>📢 Solicitudes Disponibles</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#2563eb', marginTop: 4 }}>{leads.length}</div>
          <small style={{ color: '#94a3b8', fontSize: 11 }}>Clientes buscando taller hoy</small>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>✍️ Mis Cotizaciones Enviadas</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#7c3aed', marginTop: 4 }}>{myBids.length}</div>
          <small style={{ color: '#94a3b8', fontSize: 11 }}>Propuestas activas en clientes</small>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>🏆 Reparaciones Ganadas</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#059669', marginTop: 4 }}>{wonBidsCount}</div>
          <small style={{ color: '#94a3b8', fontSize: 11 }}>Clientes que aceptaron tu precio</small>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab('leads')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'leads' ? '3px solid #2563eb' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'leads' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'leads' ? 800 : 600,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          🔥 Oportunidades Disponibles ({leads.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('my_bids')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'my_bids' ? '3px solid #2563eb' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'my_bids' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'my_bids' ? 800 : 600,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          📋 Mis Cotizaciones Enviadas ({myBids.length})
        </button>
      </div>

      {/* TAB 1: LEADS DISPONIBLES */}
      {activeTab === 'leads' && (
        <div>
          {/* Filters Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Buscar por marca, modelo o falla..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: '1 1 200px', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
            <select
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
            >
              {ecuadorCities.map(c => <option key={c} value={c}>{c === 'ALL' ? '📍 Todas las Ciudades' : `📍 ${c}`}</option>)}
            </select>
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
            >
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Cargando solicitudes...</div>
          ) : leads.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 36, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
              <h4 style={{ margin: '0 0 4px', color: '#1e293b' }}>No hay solicitudes abiertas con los filtros seleccionados</h4>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Prueba seleccionando otra ciudad o quitando el filtro de categoría.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {leads.map(l => {
                const hasMyBid = !!l.my_bid;
                const images: Any[] = l.images || [];
                return (
                  <div
                    key={l.id}
                    style={{
                      background: '#fff',
                      borderRadius: 14,
                      padding: 18,
                      border: hasMyBid ? '2px solid #818cf8' : '1px solid #e2e8f0',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                          {l.request_code}
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {l.urgency === 'URGENT' && (
                            <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                              ⚡ Urgente
                            </span>
                          )}
                          <span style={{ background: '#ecfdf5', color: '#047857', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                            💬 {l.total_bids || 0} cotiz.
                          </span>
                        </div>
                      </div>

                      {/* Device Title */}
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
                        📱 {l.device_brand} {l.device_model}
                      </h3>

                      {/* Location & Modality */}
                      <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
                        📍 <b>{l.city}</b> {l.neighborhood ? `· ${l.neighborhood}` : ''}<br />
                        <span style={{ color: '#2563eb' }}>
                          {l.delivery_preference === 'WORKSHOP' ? '🏪 Cliente lo lleva al taller' : l.delivery_preference === 'HOME_PICKUP' ? '🛵 Desea retiro a domicilio' : '🔧 Servicio a domicilio'}
                        </span>
                      </div>

                      {/* Fault Description */}
                      <div style={{
                        background: '#f8fafc', borderRadius: 8, padding: 10, fontSize: 12, color: '#334155',
                        border: '1px solid #f1f5f9', marginBottom: 12, maxHeight: 70, overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        <b>Falla:</b> {l.fault_description}
                      </div>

                      {/* Photos Thumbnails */}
                      {images.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                          {images.map(img => (
                            <img
                              key={img.id}
                              src={img.imageUrl}
                              alt="Falla"
                              onClick={() => setLightboxImg(img.imageUrl)}
                              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer' }}
                              title="Clic para ampliar foto"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer / Actions */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                      {hasMyBid ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: 11, color: '#059669', fontWeight: 800 }}>✅ Ya cotizaste:</span>
                            <div style={{ fontSize: 15, fontWeight: 900, color: '#059669' }}>
                              ${Number(l.my_bid.estimatedCost).toFixed(2)}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => openBidModal(l)}
                            style={{ fontSize: 11, padding: '6px 10px' }}
                          >
                            ✏️ Modificar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="primary-action"
                          onClick={() => openBidModal(l)}
                          style={{ width: '100%', justifyContent: 'center', padding: '9px 12px', fontSize: 13, fontWeight: 800, background: '#2563eb' }}
                        >
                          💰 Cotizar Esta Reparación
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MIS COTIZACIONES ENVIADAS */}
      {activeTab === 'my_bids' && (
        <div>
          {myBids.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 36, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📝</div>
              <h4 style={{ margin: '0 0 4px', color: '#1e293b' }}>Aún no has enviado cotizaciones</h4>
              <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 13 }}>Revisa las oportunidades abiertas y envía presupuestos para ganar clientes.</p>
              <button type="button" className="primary-action" onClick={() => setActiveTab('leads')} style={{ margin: '0 auto' }}>
                Ver Solicitudes Disponibles
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myBids.map(b => {
                const isWon = b.bid_status === 'ACCEPTED';
                return (
                  <div
                    key={b.bid_id}
                    style={{
                      background: '#fff',
                      borderRadius: 14,
                      padding: 18,
                      border: isWon ? '2px solid #059669' : '1px solid #e2e8f0',
                      boxShadow: isWon ? '0 8px 12px -2px rgba(5,150,105,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 14
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                          {b.request_code}
                        </span>
                        <span style={{
                          background: isWon ? '#dcfce7' : '#eff6ff',
                          color: isWon ? '#15803d' : '#1d4ed8',
                          fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 4
                        }}>
                          {isWon ? '🎉 ¡GANADA! Cliente Aceptó' : '⏳ Pendiente de Respuesta'}
                        </span>
                      </div>

                      <h4 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>
                        📱 {b.device_brand} {b.device_model} · Cliente: <b>{b.customer_name}</b>
                      </h4>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        📍 {b.city} {b.neighborhood ? `· ${b.neighborhood}` : ''} {b.customer_phone ? `· 📞 ${b.customer_phone}` : ''}
                      </div>

                      <div style={{ fontSize: 12, color: '#334155', marginTop: 6 }}>
                        <b>Tu propuesta:</b> ${Number(b.estimated_cost).toFixed(2)} · Tiempo: <b>{b.estimated_time}</b> · Garantía: <b>{b.warranty_terms}</b>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: isWon ? '#059669' : '#2563eb' }}>
                          ${Number(b.estimated_cost).toFixed(2)}
                        </div>
                        <small style={{ color: '#64748b', fontSize: 11 }}>Precio cotizado</small>
                      </div>

                      {isWon && b.work_order_number && (
                        <button
                          type="button"
                          className="primary-action"
                          onClick={() => go && go('work-orders')}
                          style={{ background: '#059669', borderColor: '#059669', fontSize: 12, padding: '8px 14px' }}
                        >
                          🛠️ Ver OT #{b.work_order_number} en Taller
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL PARA ENVIAR / MODIFICAR COTIZACIÓN */}
      {bidModalLead && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16
        }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 540, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: '#0f172a' }}>
                💰 Cotizar Reparación: {bidModalLead.device_brand} {bidModalLead.deviceModel || bidModalLead.device_model}
              </h3>
              <button
                type="button"
                onClick={() => setBidModalLead(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 12, color: '#475569', marginBottom: 16, border: '1px solid #f1f5f9' }}>
              <div><b>Cliente:</b> {bidModalLead.customer_name} · <b>Ubicación:</b> {bidModalLead.city} ({bidModalLead.neighborhood || 'Sector centro'})</div>
              <div style={{ marginTop: 4 }}><b>Falla:</b> {bidModalLead.fault_description}</div>
            </div>

            <form onSubmit={handleSendBid} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Precio Cotizado ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="Ej: 45.00"
                    value={bidForm.estimatedCost}
                    onChange={e => setBidForm({ ...bidForm, estimatedCost: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 800 }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Tiempo de Entrega *</label>
                  <input
                    type="text"
                    placeholder="Ej: Mismo día - 2 horas, 24h"
                    value={bidForm.estimatedTime}
                    onChange={e => setBidForm({ ...bidForm, estimatedTime: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Calidad de Repuesto</label>
                  <select
                    value={bidForm.sparePartQuality}
                    onChange={e => setBidForm({ ...bidForm, sparePartQuality: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                  >
                    <option value="Original">Repuesto Original</option>
                    <option value="AAA+ Premium">Clase AAA+ / Premium</option>
                    <option value="Mantenimiento / Limpieza">Sin Repuesto / Mantenimiento</option>
                    <option value="Reparación a nivel de placa">Reparación Electrónica / Microelectrónica</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Garantía Otorgada</label>
                  <input
                    type="text"
                    placeholder="Ej: 90 días de garantía escrita"
                    value={bidForm.warrantyTerms}
                    onChange={e => setBidForm({ ...bidForm, warrantyTerms: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Mensaje para el Cliente</label>
                <textarea
                  rows={3}
                  placeholder="Detalla tu propuesta: Tenemos el repuesto en stock, prueba de funcionamiento en tu presencia, etc."
                  value={bidForm.proposalNotes}
                  onChange={e => setBidForm({ ...bidForm, proposalNotes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="submit"
                  className="primary-action"
                  disabled={submittingBid}
                  style={{ flex: 1, padding: '11px 16px', fontSize: 14, fontWeight: 800, justifyContent: 'center', background: '#2563eb' }}
                >
                  {submittingBid ? 'Enviando...' : '🚀 Enviar Cotización al Cliente'}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setBidModalLead(null)}
                  style={{ padding: '11px 16px' }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX DE IMÁGENES */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 20
          }}
        >
          <img src={lightboxImg} alt="Detalle" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}
    </section>
  );
}

// =========================================================================
// 2. MODAL DE COBRO DE TRABAJO Y EMISIÓN DE GARANTÍA (PARA WORK ORDERS)
// =========================================================================
export function WorkOrderCheckoutModal({
  order,
  onClose,
  onSuccess
}: {
  order: Any;
  onClose: () => void;
  onSuccess: (data: Any) => void;
}) {
  const [paymentMethod, setPaymentMethod] = React.useState('CASH');
  const [paymentAmount, setPaymentAmount] = React.useState(String(order.quote || 0));
  const [warrantyDays, setWarrantyDays] = React.useState(90);
  const [warrantyTerms, setWarrantyTerms] = React.useState(
    order.warranty_terms || 'Garantía por servicio técnico en mano de obra y repuestos especificados.'
  );
  const [techNotes, setTechNotes] = React.useState(
    order.technician_notes || 'Equipo reparado, probado y entregado a entera conformidad del cliente.'
  );
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/work-orders/${order.id}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.token
        },
        body: JSON.stringify({
          paymentMethod,
          paymentAmount: parseFloat(paymentAmount) || 0,
          warrantyDays,
          warrantyTerms,
          technicianNotes: techNotes,
          status: 'DELIVERED'
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al registrar cobro');
      }

      const data = await res.json();
      onSuccess(data);
    } catch (e: any) {
      alert(e.message || 'No se pudo registrar la entrega');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16
    }}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 500, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: '#059669', fontWeight: 800, textTransform: 'uppercase' }}>Cobro y Entrega Final</div>
            <h3 style={{ fontSize: 18, fontWeight: 900, margin: '2px 0 0', color: '#0f172a' }}>
              🤝 Finalizar Orden #{order.order_number || 'OT'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        {/* Resumen */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 12, color: '#334155', marginBottom: 16, border: '1px solid #f1f5f9' }}>
          <div>📱 <b>Equipo:</b> {order.device_brand} {order.device_model || order.description}</div>
          <div>👤 <b>Cliente:</b> {order.customer_name || 'Cliente'} {order.customer_phone ? `(📞 ${order.customer_phone})` : ''}</div>
          <div>💰 <b>Cotización Aprobada:</b> ${Number(order.quote || 0).toFixed(2)}</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Forma de Cobro *</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
              >
                <option value="CASH">💵 Efectivo</option>
                <option value="TRANSFER">🏦 Transferencia Bancaria</option>
                <option value="DEUNA">📱 DeUna QR</option>
                <option value="CARD">💳 Tarjeta Crédito / Débito</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Monto Cobrado ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 800, color: '#059669' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Tiempo de Garantía Otorgada</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { days: 30, label: '30 días' },
                { days: 60, label: '60 días' },
                { days: 90, label: '90 días' },
                { days: 180, label: '6 meses' },
                { days: 365, label: '1 año' }
              ].map(opt => (
                <button
                  type="button"
                  key={opt.days}
                  onClick={() => setWarrantyDays(opt.days)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: warrantyDays === opt.days ? '2px solid #059669' : '1px solid #cbd5e1',
                    background: warrantyDays === opt.days ? '#ecfdf5' : '#fff',
                    color: warrantyDays === opt.days ? '#047857' : '#334155',
                    fontSize: 12,
                    fontWeight: warrantyDays === opt.days ? 800 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Términos de la Garantía</label>
            <input
              type="text"
              value={warrantyTerms}
              onChange={e => setWarrantyTerms(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Notas Finales / Entrega</label>
            <textarea
              rows={2}
              value={techNotes}
              onChange={e => setTechNotes(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              type="submit"
              className="primary-action"
              disabled={loading}
              style={{ flex: 1, padding: '11px 16px', fontSize: 14, fontWeight: 800, justifyContent: 'center', background: '#059669', borderColor: '#059669' }}
            >
              {loading ? 'Registrando...' : '💰 Registrar Cobro, Emitir Garantía y Entregar'}
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={onClose}
              style={{ padding: '11px 16px' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

