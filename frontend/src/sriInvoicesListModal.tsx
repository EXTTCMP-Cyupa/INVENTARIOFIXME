import React from 'react';

interface SriInvoicesListModalProps {
  api: (u: string, o?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onOpenRide: (invoiceId: string) => void;
  notify?: (msg: string) => void;
}

export function SriInvoicesListModal({ api, onClose, onOpenRide, notify }: SriInvoicesListModalProps) {
  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [ncInvoice, setNcInvoice] = React.useState<any | null>(null);
  const [ncReason, setNcReason] = React.useState('Devolución de mercadería / Anulación');
  const [ncSubmitting, setNcSubmitting] = React.useState(false);
  const [errorInvoice, setErrorInvoice] = React.useState<any | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api('/api/sri/invoices')
      .then(r => r.ok ? r.json() : [])
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, [api]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleIssueCreditNote() {
    if (!ncInvoice || ncSubmitting) return;
    setNcSubmitting(true);
    try {
      const res = await api(`/api/sri/credit-notes/from-invoice/${ncInvoice.id}`, {
        method: 'POST',
        body: JSON.stringify({ reason: ncReason.trim() })
      });
      if (res.ok) {
        if (notify) notify(`✓ Nota de Crédito emitida exitosamente para ${ncInvoice.numero_completo}`);
        setNcInvoice(null);
        load();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'Error al emitir la Nota de Crédito.');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setNcSubmitting(false);
    }
  }

  function copyKey(k: string) {
    navigator.clipboard.writeText(k);
    setCopiedKey(k);
    setTimeout(() => setCopiedKey(null), 2000);
    if (notify) notify('Clave de acceso copiada al portapapeles');
  }

  function downloadXml(id: string) {
    window.open(`/api/sri/invoices/${id}/xml`, '_blank');
  }

  const filtered = invoices.filter(inv => {
    if (statusFilter !== 'ALL' && inv.estado_sri !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const num = (inv.numero_completo || '').toLowerCase();
      const cli = (inv.cliente_razon_social || '').toLowerCase();
      const iden = (inv.cliente_identificacion || '').toLowerCase();
      const key = (inv.clave_acceso || '').toLowerCase();
      if (!num.includes(q) && !cli.includes(q) && !iden.includes(q) && !key.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const totalSum = filtered.reduce((acc, i) => acc + Number(i.importe_total || 0), 0);
  const totalIva = filtered.reduce((acc, i) => acc + Number(i.iva_15 || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '1020px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-head" style={{ marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🏛️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Facturas Electrónicas Emitidas al SRI
              </h3>
              <small style={{ color: '#64748b' }}>
                Registro oficial de comprobantes electrónicos autorizados por el SRI del Ecuador
              </small>
            </div>
          </div>
          <button className="close-button" onClick={onClose} title="Cerrar">✕</button>
        </div>

        {/* SUMMARY STATS & FILTERS */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="🔍 Buscar por N° factura, cliente, C.I./RUC o clave..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="input-field"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '13px' }}
            >
              <option value="ALL">Todos los Estados</option>
              <option value="AUTORIZADA">AUTORIZADA</option>
              <option value="GENERADA">GENERADA / EN PROCESO</option>
              <option value="DEVUELTA">DEVUELTA</option>
            </select>

            <button
              type="button"
              className="secondary-action"
              onClick={load}
              disabled={loading}
              title="Recargar facturas"
              style={{ padding: '8px 12px', fontSize: '13px' }}
            >
              🔄 Recargar
            </button>
          </div>
        </div>

        {/* FINANCIAL PILLS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 14px', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>Total comprobantes: </span>
            <strong style={{ color: '#0f172a' }}>{filtered.length}</strong>
          </div>
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '6px 14px', fontSize: '12px' }}>
            <span style={{ color: '#065f46' }}>Total Facturado: </span>
            <strong style={{ color: '#047857' }}>${totalSum.toFixed(2)}</strong>
          </div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '6px 14px', fontSize: '12px' }}>
            <span style={{ color: '#1e40af' }}>IVA (15%) Recaudado: </span>
            <strong style={{ color: '#1d4ed8' }}>${totalIva.toFixed(2)}</strong>
          </div>
        </div>

        {/* TABLE CONTAINER */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner" style={{ margin: '0 auto 10px' }} />
              <p style={{ color: '#64748b', fontSize: '13px' }}>Cargando facturas electrónicas...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px' }}>No se encontraron facturas electrónicas</p>
              <p style={{ fontSize: '12px', margin: 0 }}>
                Las facturas generadas al vender con la opción "Factura SRI" o al hacer clic en "Facturar SRI" aparecerán listadas aquí.
              </p>
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{ padding: '8px 10px' }}>Tipo</th>
                  <th style={{ padding: '8px 10px' }}>N° Comprobante</th>
                  <th style={{ padding: '8px 10px' }}>Fecha</th>
                  <th style={{ padding: '8px 10px' }}>Cliente</th>
                  <th style={{ padding: '8px 10px' }}>Subtotal</th>
                  <th style={{ padding: '8px 10px' }}>IVA 15%</th>
                  <th style={{ padding: '8px 10px' }}>Total</th>
                  <th style={{ padding: '8px 10px' }}>Estado SRI</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const isAuth = inv.estado_sri === 'AUTORIZADA';
                  const isNC = inv.tipo_documento === '04';
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9', background: isNC ? '#faf5ff' : 'transparent' }}>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 800,
                          background: isNC ? '#f3e8ff' : '#eff6ff',
                          color: isNC ? '#7e22ce' : '#2563eb'
                        }}>
                          {isNC ? '↩️ NOTA CRÉDITO' : '🏛️ FACTURA'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {inv.numero_completo}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {inv.fecha_emision ? new Date(inv.fecha_emision).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{inv.cliente_razon_social || 'CONSUMIDOR FINAL'}</div>
                        <small style={{ color: '#64748b', fontFamily: 'monospace' }}>{inv.cliente_identificacion}</small>
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        ${Number(inv.subtotal_sin_impuestos || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#2563eb' }}>
                        ${Number(inv.iva_15 || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 800, color: isNC ? '#b91c1c' : '#047857' }}>
                        ${Number(inv.importe_total || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span
                            className="status-badge"
                            style={{
                              background: isAuth ? '#ecfdf5' : (inv.estado_sri === 'DEVUELTA' ? '#fef2f2' : '#fffbeb'),
                              color: isAuth ? '#065f46' : (inv.estado_sri === 'DEVUELTA' ? '#b91c1c' : '#92400e'),
                              borderColor: isAuth ? '#a7f3d0' : (inv.estado_sri === 'DEVUELTA' ? '#fca5a5' : '#fde68a'),
                              fontWeight: 700,
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {isAuth ? '✓ AUTORIZADA' : (inv.estado_sri === 'DEVUELTA' ? '⚠️ DEVUELTA' : inv.estado_sri)}
                          </span>
                          {inv.estado_sri === 'DEVUELTA' && (
                            <button
                              type="button"
                              onClick={() => setErrorInvoice(inv)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#b91c1c',
                                fontSize: '10.5px',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                padding: 0,
                                textAlign: 'left',
                                fontWeight: 700
                              }}
                              title="Ver motivo de devolución del SRI"
                            >
                              Ver motivo SRI ↗
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="secondary-action"
                            style={{ padding: '4px 8px', fontSize: '11px', background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0', fontWeight: 700 }}
                            onClick={() => onOpenRide(inv.id)}
                            title="Ver e imprimir RIDE oficial"
                          >
                            📄 RIDE
                          </button>
                          <button
                            type="button"
                            className="secondary-action"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => downloadXml(inv.id)}
                            title="Descargar XML oficial firmado"
                          >
                            📥 XML
                          </button>
                          {!isNC && isAuth && (
                            <button
                              type="button"
                              className="secondary-action"
                              style={{ padding: '4px 8px', fontSize: '11px', background: '#fef2f2', color: '#b91c1c', borderColor: '#fca5a5', fontWeight: 700 }}
                              onClick={() => setNcInvoice(inv)}
                              title="Emitir Nota de Crédito oficial (Devolución / Anulación)"
                            >
                              ↩️ NC
                            </button>
                          )}
                          {inv.clave_acceso && (
                            <button
                              type="button"
                              className="secondary-action"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => copyKey(inv.clave_acceso)}
                              title="Copiar Clave de Acceso (49 dígitos)"
                            >
                              {copiedKey === inv.clave_acceso ? '✓ Copiada' : '🔑 Clave'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL DETALLE DE ERROR SRI */}
        {errorInvoice && (
          <div className="modal-overlay" onClick={() => setErrorInvoice(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <div className="modal-head" style={{ borderBottom: '1px solid #fee2e2', paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>⚠️</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#991b1b' }}>Motivo de Devolución del SRI</h3>
                    <small style={{ color: '#64748b' }}>Comprobante {errorInvoice.numero_completo}</small>
                  </div>
                </div>
                <button className="close-button" onClick={() => setErrorInvoice(null)}>✕</button>
              </div>

              <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px' }}>
                  <strong style={{ color: '#991b1b', fontSize: 13, display: 'block', marginBottom: 6 }}>
                    Mensaje oficial retornado por el SRI:
                  </strong>
                  {Array.isArray(errorInvoice.mensajes_sri) && errorInvoice.mensajes_sri.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 18, color: '#7f1d1d', fontSize: 12.5, lineHeight: 1.5 }}>
                      {errorInvoice.mensajes_sri.map((m: any, idx: number) => (
                        <li key={idx} style={{ marginBottom: 4 }}>
                          <b>{m.tipo || 'ERROR'}:</b> {m.mensaje}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, color: '#7f1d1d', fontSize: 12.5 }}>
                      {typeof errorInvoice.mensajes_sri === 'string' ? errorInvoice.mensajes_sri : 'Comprobante no superó las validaciones del esquema XML del SRI.'}
                    </p>
                  )}
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', fontSize: 12.5, color: '#334155', lineHeight: 1.5 }}>
                  <strong style={{ display: 'block', color: '#0f172a', marginBottom: 6 }}>💡 ¿Por qué ocurre esto y cómo resolverlo?</strong>
                  <div style={{ marginBottom: 6 }}>
                    <b>1. RUC registrado en el SRI:</b> El RUC <code>1790012345001</code> es ficticio. Incluso en el ambiente de pruebas (celcer.sri.gob.ec), el SRI valida que el RUC del emisor exista en su catastro activo.
                  </div>
                  <div>
                    <b>2. Firma Electrónica (.p12):</b> Para autorizar facturas con el SRI real, debes cargar tu archivo de firma digital <code>.p12</code> y contraseña en <b>Ajustes &gt; Facturación SRI</b>. Si no se sube un .p12, el sistema genera una firma simulada que el SRI real rechaza.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setErrorInvoice(null)}
                  style={{ padding: '7px 18px', fontWeight: 600 }}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ISSUE CREDIT NOTE */}
        {ncInvoice && (
          <div className="modal-overlay" onClick={() => setNcInvoice(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <div className="modal-head">
                <h3>↩️ Emitir Nota de Crédito Electrónica</h3>
                <button className="close-button" onClick={() => setNcInvoice(null)}>✕</button>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                <div><strong>Factura a modificar:</strong> {ncInvoice.numero_completo}</div>
                <div><strong>Cliente:</strong> {ncInvoice.cliente_razon_social} ({ncInvoice.cliente_identificacion})</div>
                <div style={{ marginTop: 4 }}><strong>Valor Total a Devolver:</strong> <span style={{ color: '#dc2626', fontWeight: 800 }}>${Number(ncInvoice.importe_total).toFixed(2)}</span></div>
              </div>

              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
                Se emitirá una Nota de Crédito oficial tipo 04 autorizada por el SRI que anulará el valor contable y tributario de la factura.
              </p>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Motivo de la Nota de Crédito:</span>
                <input
                  className="input-field"
                  value={ncReason}
                  onChange={e => setNcReason(e.target.value)}
                  placeholder="Ej. Devolución de producto / Error de facturación..."
                  style={{ width: '100%', fontSize: 13 }}
                  required
                />
              </label>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="primary-action"
                  onClick={handleIssueCreditNote}
                  disabled={ncSubmitting}
                  style={{ flex: 1, background: '#dc2626', borderColor: '#b91c1c', justifyContent: 'center' }}
                >
                  {ncSubmitting ? 'Emitiendo en SRI...' : '✓ Emitir Nota de Crédito'}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setNcInvoice(null)}
                  disabled={ncSubmitting}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          <button type="button" className="secondary-action" onClick={onClose} style={{ padding: '8px 20px', fontWeight: 600 }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

