import React from 'react';
import { printTicketElement } from './ticketPrinter';

interface SriRideModalProps {
  invoiceId: string;
  api: (u: string, o?: RequestInit) => Promise<Response>;
  onClose: () => void;
  notify?: (msg: string) => void;
}

export function SriRideModal({ invoiceId, api, onClose, notify }: SriRideModalProps) {
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [showEmailModal, setShowEmailModal] = React.useState(false);
  const [targetEmail, setTargetEmail] = React.useState('');
  const [copiedEmailText, setCopiedEmailText] = React.useState(false);

  React.useEffect(() => {
    api(`/api/sri/invoices/${invoiceId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(d);
        if (d?.cliente_email) setTargetEmail(d.cliente_email);
      })
      .finally(() => setLoading(false));
  }, [api, invoiceId]);

  function copyKey(k: string) {
    navigator.clipboard.writeText(k);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    if (notify) notify('Clave de acceso copiada al portapapeles');
  }

  function downloadXml() {
    window.open(`/api/sri/invoices/${invoiceId}/xml`, '_blank');
  }

  function getEmailBody() {
    if (!data) return '';
    const origin = window.location.origin;
    const portalUrl = `${origin}/#portal-cliente?phone=${encodeURIComponent(data.cliente_telefono || '')}&identificationNumber=${encodeURIComponent(data.cliente_identificacion || '')}`;
    return (
      `Estimado/a ${data.cliente_razon_social || 'Cliente'},\n\n` +
      `Adjuntamos los datos oficiales de su Factura Electrónica autorizada por el SRI:\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📄 N° COMPROBANTE: ${data.numero_completo}\n` +
      `🏢 EMISOR: ${data.emisor_razon_social} (RUC: ${data.emisor_ruc})\n` +
      `📅 FECHA: ${data.fecha_emision ? new Date(data.fecha_emision).toLocaleString() : 'Reciente'}\n` +
      `💵 TOTAL: $${Number(data.importe_total || 0).toFixed(2)}\n` +
      `🔑 CLAVE DE ACCESO (49 DÍGITOS):\n${data.clave_acceso}\n` +
      `🏛️ N° AUTORIZACIÓN SRI: ${data.numero_autorizacion || data.clave_acceso}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Puede consultar y descargar en cualquier momento su RIDE oficial en PDF y su archivo XML en:\n` +
      `👉 ${portalUrl}\n\n` +
      `O verificar directamente en el portal oficial del SRI:\n` +
      `👉 https://sri.gob.ec\n\n` +
      `Agradecemos su preferencia.\n` +
      `${data.emisor_nombre_comercial || data.emisor_razon_social}`
    );
  }

  function handleOpenMailClient() {
    if (!data) return;
    const subject = encodeURIComponent(`Factura Electrónica SRI #${data.numero_completo} - ${data.emisor_nombre_comercial || data.emisor_razon_social}`);
    const body = encodeURIComponent(getEmailBody());
    const mailto = `mailto:${encodeURIComponent(targetEmail.trim())}?subject=${subject}&body=${body}`;
    window.open(mailto, '_blank');
  }

  function handleCopyEmailText() {
    navigator.clipboard.writeText(getEmailBody());
    setCopiedEmailText(true);
    setTimeout(() => setCopiedEmailText(false), 2500);
    if (notify) notify('Contenido del correo copiado al portapapeles');
  }

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '30px' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p>Cargando comprobante electrónico oficial del SRI...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Comprobante no encontrado</h3>
            <button className="close-button" onClick={onClose}>✕</button>
          </div>
          <p>No se pudo obtener la información de la factura electrónica solicitada.</p>
        </div>
      </div>
    );
  }

  const items = data.items || [];
  const statusOk = data.estado_sri === 'AUTORIZADA';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card sri-ride-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '820px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-head no-print" style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🏛️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px' }}>
                Factura Electrónica SRI #{data.numero_completo}
              </h3>
              <small style={{ color: '#64748b' }}>
                R.I.D.E. (Representación Impresa de Documento Electrónico)
              </small>
            </div>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        {/* PRINTABLE RIDE CONTAINER */}
        <div id="printable-ride" className="ride-document">
          {/* TOP GRID: EMITTER & INVOICE LEGAL BOX */}
          <div className="ride-header-grid">
            {/* LEFT: EMITTER INFO */}
            <div className="ride-box ride-emitter-box">
              <div className="ride-logo-mock">
                <b>FIXMETIENDAS</b>
                <small>Soluciones Comerciales & Servicio Técnico</small>
              </div>
              <h2 className="ride-legal-name">{data.emisor_razon_social || 'EMISOR AUTORIZADO'}</h2>
              {data.emisor_nombre_comercial && (
                <div className="ride-trade-name">{data.emisor_nombre_comercial}</div>
              )}
              <div className="ride-info-line">
                <strong>Dirección Matriz:</strong> {data.emisor_direccion_matriz || 'Dirección registrada'}
              </div>
              {data.emisor_direccion_estab && (
                <div className="ride-info-line">
                  <strong>Dirección Sucursal:</strong> {data.emisor_direccion_estab}
                </div>
              )}
              <div className="ride-info-line">
                <strong>OBLIGADO A LLEVAR CONTABILIDAD:</strong> {data.emisor_obligado ? 'SI' : 'NO'}
              </div>
              {data.emisor_regimen && (
                <div className="ride-regime-badge">
                  CONTRIBUYENTE {data.emisor_regimen.replace('_', ' ')}
                </div>
              )}
            </div>

            {/* RIGHT: LEGAL SRI INVOICE BOX */}
            <div className="ride-box ride-sri-box">
              <div className="ride-doc-title">R.U.C.: {data.emisor_ruc || '1790012345001'}</div>
              <div className="ride-doc-type">FACTURA</div>
              <div className="ride-doc-number">No. {data.numero_completo}</div>

              <div className="ride-info-line" style={{ marginTop: '6px' }}>
                <strong>NÚMERO DE AUTORIZACIÓN:</strong>
                <span className="ride-mono-num">{data.numero_autorizacion || data.clave_acceso}</span>
              </div>

              <div className="ride-info-line">
                <strong>FECHA Y HORA DE AUTORIZACIÓN:</strong>
                <span>{data.fecha_autorizacion ? new Date(data.fecha_autorizacion).toLocaleString() : new Date().toLocaleString()}</span>
              </div>

              <div className="ride-info-line">
                <strong>AMBIENTE:</strong> <span>{data.ambiente === 2 ? 'PRODUCCIÓN' : 'PRUEBAS'}</span>
              </div>

              <div className="ride-info-line">
                <strong>EMISIÓN:</strong> <span>NORMAL</span>
              </div>

              {/* ACCESS KEY & BARCODE */}
              <div className="ride-access-key-box">
                <small>CLAVE DE ACCESO (49 DÍGITOS):</small>
                <div className="ride-access-key-text">{data.clave_acceso}</div>
                {/* Simulated Barcode */}
                <div className="ride-barcode-lines" title="Código de barras oficial SRI">
                  <div className="barcode-bars" />
                </div>
                <button
                  type="button"
                  className="no-print ride-btn-copy"
                  onClick={() => copyKey(data.clave_acceso)}
                >
                  {copiedKey ? '✓ ¡Copiada!' : '📋 Copiar Clave'}
                </button>
              </div>

              <div className={`ride-status-pill ${statusOk ? 'approved' : 'pending'}`}>
                {statusOk ? '✓ AUTORIZADA POR EL SRI' : `● ${data.estado_sri || 'PROCESANDO'}`}
              </div>
            </div>
          </div>

          {/* BUYER / CUSTOMER BOX */}
          <div className="ride-box ride-buyer-box" style={{ marginTop: '10px' }}>
            <div className="ride-buyer-grid">
              <div>
                <strong>Razón Social / Nombres:</strong> {data.cliente_razon_social || 'CONSUMIDOR FINAL'}
              </div>
              <div>
                <strong>Identificación (C.I./RUC):</strong> {data.cliente_identificacion || '9999999999999'}
              </div>
              <div>
                <strong>Fecha de Emisión:</strong> {new Date(data.fecha_emision).toLocaleDateString()}
              </div>
              <div>
                <strong>Teléfono:</strong> {data.cliente_telefono || 'S/N'}
              </div>
              {data.cliente_direccion && (
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>Dirección:</strong> {data.cliente_direccion}
                </div>
              )}
              {data.cliente_email && (
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>Correo Electrónico:</strong> {data.cliente_email}
                </div>
              )}
            </div>
          </div>

          {/* ITEMS TABLE */}
          <div className="ride-box" style={{ marginTop: '10px', padding: 0, overflow: 'hidden' }}>
            <table className="ride-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Cod. Principal</th>
                  <th>Descripción del Producto / Servicio</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Cant.</th>
                  <th style={{ width: '85px', textAlign: 'right' }}>Precio Unit.</th>
                  <th style={{ width: '70px', textAlign: 'right' }}>Descuento</th>
                  <th style={{ width: '85px', textAlign: 'right' }}>Precio Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{it.sku || `ITM-${idx + 1}`}</td>
                    <td><b>{it.product_name}</b></td>
                    <td style={{ textAlign: 'center' }}>{Number(it.quantity).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>${Number(it.unit_price).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>$0.00</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>${Number(it.line_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* BOTTOM TOTALS & PAYMENT SECTION */}
          <div className="ride-bottom-grid" style={{ marginTop: '10px' }}>
            {/* PAYMENT & ADDITIONAL INFO */}
            <div className="ride-box">
              <strong style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                FORMAS DE PAGO DECLARADAS:
              </strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span>01 - Sin utilización del sistema financiero (Efectivo/Contado)</span>
                <strong>${Number(data.importe_total || 0).toFixed(2)}</strong>
              </div>

              <div style={{ marginTop: '12px' }}>
                <strong style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  INFORMACIÓN ADICIONAL:
                </strong>
                <div style={{ fontSize: '11px', color: '#334155' }}>
                  • Origen: Punto de Venta FixmeTiendas<br />
                  • Garantía oficial y soporte técnico incluido.<br />
                  • Verifique la autenticidad de este comprobante en: <i>www.sri.gob.ec</i>
                </div>
              </div>
            </div>

            {/* TAX TOTALS TABLE */}
            <div className="ride-box ride-totals-box">
              <div className="ride-total-row">
                <span>SUBTOTAL 15% (Base Imponible):</span>
                <span>${Number(data.subtotal_15 || data.subtotal_sin_impuestos || 0).toFixed(2)}</span>
              </div>
              <div className="ride-total-row">
                <span>SUBTOTAL 0% (Tarifa 0):</span>
                <span>${Number(data.subtotal_0 || 0).toFixed(2)}</span>
              </div>
              <div className="ride-total-row">
                <span>SUBTOTAL NO OBJETO DE IVA:</span>
                <span>$0.00</span>
              </div>
              <div className="ride-total-row">
                <span>SUBTOTAL SIN IMPUESTOS:</span>
                <span>${Number(data.subtotal_sin_impuestos || 0).toFixed(2)}</span>
              </div>
              <div className="ride-total-row">
                <span>TOTAL DESCUENTO:</span>
                <span>${Number(data.total_descuento || 0).toFixed(2)}</span>
              </div>
              <div className="ride-total-row">
                <span>IVA 15%:</span>
                <span>${Number(data.iva_15 || 0).toFixed(2)}</span>
              </div>
              <div className="ride-total-row">
                <span>PROPINA:</span>
                <span>$0.00</span>
              </div>
              <div className="ride-total-row grand">
                <span>VALOR TOTAL A PAGAR:</span>
                <strong>${Number(data.importe_total || 0).toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS (NO-PRINT) */}
        <div className="no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button
            type="button"
            className="secondary-action"
            style={{ flex: 1, minWidth: '90px' }}
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="primary-action"
            style={{ flex: 1, minWidth: '150px' }}
            onClick={() => printTicketElement('printable-ride')}
          >
            🖨️ Imprimir RIDE (A4)
          </button>
          <button
            type="button"
            className="secondary-action"
            style={{ flex: 1, minWidth: '140px' }}
            onClick={downloadXml}
          >
            📥 Descargar XML
          </button>
          <button
            type="button"
            className="secondary-action"
            style={{ flex: 1, minWidth: '150px', background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0', fontWeight: 700 }}
            onClick={() => setShowEmailModal(true)}
          >
            📧 Enviar por Correo
          </button>
          {data.cliente_telefono && (
            <a
              className="whatsapp-btn"
              style={{ flex: 1, minWidth: '150px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
              href={`https://wa.me/${data.cliente_telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                `Hola ${data.cliente_razon_social}, te adjuntamos tu Factura Electrónica SRI #${data.numero_completo}.\nClave de Acceso: ${data.clave_acceso}\nTotal: $${Number(data.importe_total).toFixed(2)}\nPuedes verificarla en el portal del SRI.`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              💬 Enviar por WhatsApp
            </a>
          )}
        </div>

        {/* EMAIL DISPATCH MODAL */}
        {showEmailModal && (
          <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <div className="modal-head" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>📧</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Enviar Factura SRI por Correo</h3>
                    <small style={{ color: '#64748b' }}>Factura #{data.numero_completo} ({data.cliente_razon_social})</small>
                  </div>
                </div>
                <button className="close-button" onClick={() => setShowEmailModal(false)}>✕</button>
              </div>

              <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Correo electrónico del cliente:</span>
                  <input
                    type="email"
                    className="input-field"
                    value={targetEmail}
                    onChange={e => setTargetEmail(e.target.value)}
                    placeholder="cliente@ejemplo.com"
                    style={{ width: '100%', fontSize: 13 }}
                  />
                  <small style={{ color: '#64748b', fontSize: 11, display: 'block', marginTop: 3 }}>
                    Puedes verificar o cambiar el correo del destinatario.
                  </small>
                </label>

                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Vista previa del mensaje:</span>
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: 10,
                    fontSize: 11.5,
                    fontFamily: 'monospace',
                    maxHeight: 180,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    color: '#334155'
                  }}>
                    {getEmailBody()}
                  </div>
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 12px', fontSize: 11.5, color: '#1e40af' }}>
                  💡 <b>Tip de entrega:</b> Al hacer clic en <i>Abrir en mi Correo</i>, se abrirá tu aplicación de correo habitual (Gmail, Outlook, etc.) con el mensaje listo para enviar.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={handleCopyEmailText}
                  style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600 }}
                >
                  {copiedEmailText ? '✓ Copiado' : '📋 Copiar Mensaje'}
                </button>
                <button
                  type="button"
                  className="primary-action"
                  onClick={handleOpenMailClient}
                  style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, background: '#1d4ed8', borderColor: '#1e40af' }}
                >
                  ✉️ Abrir en mi Correo (Gmail / Outlook)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

