import React from 'react';

type Any = Record<string, any>;

// ==========================================================================
// 1. THERMAL TICKET MODAL (80mm / 58mm POS RECIEPT)
// ==========================================================================
export function ThermalTicketModal({
  sale,
  onClose,
  tenantName
}: {
  sale: Any;
  onClose: () => void;
  tenantName?: string;
}) {
  const items = sale.items || [];
  const payments = sale.payments || [];
  const storeName = tenantName || localStorage.tenantName || 'Fixme Tienda';
  const subtotal = items.reduce(
    (acc: number, it: Any) => acc + (Number(it.unitPrice || it.price || 0) * Number(it.quantity || 1)),
    0
  );
  const tax = Number(sale.taxTotal || (sale.invoiceType === 'SRI_INVOICE' ? subtotal * 0.15 : 0));
  const shipping = Number(sale.shippingCost || 0);
  const discount = Number(sale.discount != null ? sale.discount : (sale.discountAmount || 0));
  const total = Number(sale.total || (subtotal + tax + shipping - discount));
  const change = Number(sale.changeAmount || 0);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ maxWidth: '380px' }}>
        <div className="modal-head no-print">
          <h3>🖨️ Ticket de Venta (80mm)</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div id="printable-thermal" className="thermal-receipt">
          <div className="thermal-center">
            <h2 className="thermal-title">{storeName}</h2>
            <div className="thermal-sub">
              COMPROBANTE DE VENTA {sale.invoiceType === 'SRI_INVOICE' ? 'ELECTRÓNICA' : 'INTERNA'}
            </div>
            <div className="thermal-sub">RUC: {sale.storeRuc || '1790012345001'}</div>
            <div className="thermal-sub">Matriz: {sale.storeAddress || 'Av. Principal Local 1'}</div>
            <div className="thermal-sub">Tel: {sale.storePhone || '0991234567'}</div>
            <div className="thermal-divider" />
            <div className="thermal-row">
              <span>Ticket N°:</span>
              <strong>{sale.orderNumber || sale.id?.slice(0, 8).toUpperCase()}</strong>
            </div>
            <div className="thermal-row">
              <span>Fecha:</span>
              <span>{new Date(sale.createdAt || sale.created_at || Date.now()).toLocaleString()}</span>
            </div>
            <div className="thermal-row">
              <span>Cliente:</span>
              <strong>{sale.customerName || sale.customer_name || 'CONSUMIDOR FINAL'}</strong>
            </div>
            {(sale.customerIdentification || sale.customer_identification) && (
              <div className="thermal-row">
                <span>Cédula/RUC:</span>
                <span>{sale.customerIdentification || sale.customer_identification}</span>
              </div>
            )}
            <div className="thermal-divider" />
          </div>

          <table className="thermal-table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Cant</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'right', width: '25%' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: Any, idx: number) => {
                const qty = Number(it.quantity || 1);
                const p = Number(it.unitPrice || it.price || 0);
                return (
                  <tr key={idx}>
                    <td>{qty}x</td>
                    <td>{it.productName || it.name || it.sku}</td>
                    <td style={{ textAlign: 'right' }}>${(qty * p).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="thermal-divider" />
          <div className="thermal-row">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="thermal-row" style={{ color: '#b91c1c' }}>
              <span>Descuento:</span>
              <span>-${discount.toFixed(2)}</span>
            </div>
          )}
          {sale.invoiceType === 'SRI_INVOICE' && (
            <div className="thermal-row">
              <span>IVA (15%):</span>
              <span>${tax.toFixed(2)}</span>
            </div>
          )}
          {shipping > 0 && (
            <div className="thermal-row">
              <span>Envío / Delivery:</span>
              <span>${shipping.toFixed(2)}</span>
            </div>
          )}
          <div className="thermal-row total-highlight">
            <span>TOTAL:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="thermal-divider" />

          {payments.length > 0 && (
            <div>
              <div className="thermal-sub" style={{ fontWeight: 700 }}>FORMA DE PAGO:</div>
              {payments.map((pm: Any, idx: number) => (
                <div className="thermal-row" key={idx}>
                  <span>
                    {pm.method === 'CASH'
                      ? 'Efectivo'
                      : pm.method === 'CARD'
                      ? 'Tarjeta'
                      : pm.method === 'TRANSFER'
                      ? 'Transferencia'
                      : pm.method}
                  </span>
                  <span>${Number(pm.amount || 0).toFixed(2)}</span>
                </div>
              ))}
              {change > 0 && (
                <div className="thermal-row">
                  <span>Cambio / Vuelto:</span>
                  <span>${change.toFixed(2)}</span>
                </div>
              )}
              <div className="thermal-divider" />
            </div>
          )}

          {sale.warrantyDays > 0 && (
            <div className="thermal-center thermal-sub">
              <strong>GARANTÍA: {sale.warrantyDays} DÍAS</strong>
              <div>Conserve este comprobante para hacer válida su garantía.</div>
              <div className="thermal-divider" />
            </div>
          )}

          {sale.deliveryTrackingCode && (
            <div className="thermal-center thermal-sub">
              <div>Código de Rastreo:</div>
              <strong style={{ fontSize: '13px' }}>{sale.deliveryTrackingCode}</strong>
              <div className="thermal-divider" />
            </div>
          )}

          <div className="thermal-center thermal-sub" style={{ marginTop: '6px' }}>
            <div>¡Gracias por su compra!</div>
            <small>Sistema Fixme Tiendas Cloud</small>
          </div>
        </div>

        <div className="modal-actions no-print" style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="btn-primary-sm"
            style={{ padding: '12px', fontSize: '13px' }}
            onClick={() => window.print()}
          >
            🖨️ Imprimir Ticket (80mm)
          </button>
          <button
            type="button"
            className="btn-secondary-sm"
            style={{ padding: '12px', fontSize: '13px' }}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// 2. QUICK CUSTOMER MODAL (REGISTRAR CLIENTE EXPRÉS EN POS)
// ==========================================================================
export function QuickCustomerModal({
  api,
  onCreated,
  onClose,
  notify
}: {
  api: (u: string, o?: RequestInit) => Promise<Response>;
  onCreated: (c: Any) => void;
  onClose: () => void;
  notify?: (s: string) => void;
}) {
  const [name, setName] = React.useState('');
  const [idNum, setIdNum] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      alert('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const res = await api('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          identification_number: idNum.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          tag: 'FREQUENT'
        })
      });
      if (res.ok) {
        const created = await res.json();
        notify?.(`✓ Cliente ${created.name} creado exitosamente`);
        onCreated(created);
        onClose();
      } else {
        const err = await res.text();
        alert(`Error al registrar cliente: ${err}`);
      }
    } catch (e: any) {
      alert(`Error de conexión: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-head">
          <h3>👤 Nuevo Cliente Rápido</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>Nombre Completo / Razón Social *
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Ej. Juan Pérez"
              autoFocus
            />
          </label>
          <label>Cédula o RUC
            <input
              type="text"
              value={idNum}
              onChange={e => setIdNum(e.target.value)}
              placeholder="Ej. 1712345678 o 1790012345001"
            />
          </label>
          <label>Teléfono / Celular (WhatsApp)
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ej. 0991234567"
            />
          </label>
          <label>Correo Electrónico
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="cliente@correo.com"
            />
          </label>
          <label>Dirección
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Calle y número de referencia"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary-sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary-sm" disabled={saving}>
              {saving ? 'Guardando...' : '✓ Guardar y Seleccionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================================================
// 3. CORTE Z MODAL (ARQUEO Y CIERRE DETALLADO DE CAJA 80mm)
// ==========================================================================
export function CorteZModal({
  summary,
  onClose,
  tenantName
}: {
  summary: Any;
  onClose: () => void;
  tenantName?: string;
}) {
  const storeName = tenantName || localStorage.tenantName || 'Fixme Tienda';
  const openCash = Number(summary.openingCash || 0);
  const salesCash = Number(summary.salesCash || 0);
  const inCash = Number(summary.inflowsCash || 0);
  const outCash = Number(summary.outflowsCash || 0);
  const depCash = Number(summary.depositsCash || 0);
  const expected = Number(
    summary.cashInDrawer || summary.expected || openCash + salesCash + inCash - outCash - depCash
  );
  const counted = Number(summary.counted || 0);
  const diff = Number(summary.difference || counted - expected);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ maxWidth: '380px' }}>
        <div className="modal-head no-print">
          <h3>📊 Reporte de Cierre Z (Arqueo)</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div id="printable-z-report" className="thermal-receipt">
          <div className="thermal-center">
            <h2 className="thermal-title">{storeName}</h2>
            <div className="thermal-sub" style={{ fontWeight: 800 }}>*** CORTE Z - CIERRE DE TURNO ***</div>
            <div className="thermal-sub">Fecha: {new Date().toLocaleString()}</div>
            <div className="thermal-sub">Sucursal: Principal</div>
            <div className="thermal-divider" />
          </div>

          <div className="thermal-row"><span>Fondo Inicial:</span><span>${openCash.toFixed(2)}</span></div>
          <div className="thermal-row"><span>(+) Ventas Efectivo:</span><span>${salesCash.toFixed(2)}</span></div>
          <div className="thermal-row"><span>(+) Entradas de Caja:</span><span>${inCash.toFixed(2)}</span></div>
          <div className="thermal-row"><span>(-) Salidas de Caja:</span><span>${outCash.toFixed(2)}</span></div>
          <div className="thermal-row"><span>(-) Depósitos al Banco:</span><span>${depCash.toFixed(2)}</span></div>
          <div className="thermal-divider" />

          <div className="thermal-row" style={{ fontWeight: 700 }}>
            <span>Efectivo Teórico:</span>
            <span>${expected.toFixed(2)}</span>
          </div>
          <div className="thermal-row" style={{ fontWeight: 700 }}>
            <span>Efectivo Contado:</span>
            <span>${counted.toFixed(2)}</span>
          </div>
          <div className="thermal-divider" />

          <div
            className="thermal-row total-highlight"
            style={{ color: diff === 0 ? '#10b981' : diff > 0 ? '#2563eb' : '#ef4444' }}
          >
            <span>DIFERENCIA:</span>
            <span>
              {diff === 0
                ? '$0.00 (Cuadrada)'
                : diff > 0
                ? `+$${diff.toFixed(2)} (Sobrante)`
                : `-$${Math.abs(diff).toFixed(2)} (Faltante)`}
            </span>
          </div>

          {summary.depositAmount > 0 && (
            <div>
              <div className="thermal-divider" />
              <div className="thermal-row">
                <span>Depósito a Banco:</span>
                <span>${Number(summary.depositAmount).toFixed(2)} ({summary.depositDestination || 'Banco'})</span>
              </div>
              {summary.depositReference && (
                <div className="thermal-row">
                  <span>Ref. Bancaria:</span>
                  <span>{summary.depositReference}</span>
                </div>
              )}
            </div>
          )}

          {summary.nextDayFund > 0 && (
            <div className="thermal-row">
              <span>Fondo Siguiente Día:</span>
              <span>${Number(summary.nextDayFund).toFixed(2)}</span>
            </div>
          )}

          <div className="thermal-divider" />
          <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '10px' }}>
            <div style={{ borderTop: '1px solid #000', width: '70%', margin: '0 auto 4px' }} />
            <div>Firma Cajero / Responsable</div>
          </div>
          <div style={{ marginTop: '25px', textAlign: 'center', fontSize: '10px' }}>
            <div style={{ borderTop: '1px solid #000', width: '70%', margin: '0 auto 4px' }} />
            <div>Firma Gerente / Auditor</div>
          </div>
        </div>

        <div className="modal-actions no-print" style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="btn-primary-sm"
            style={{ padding: '12px' }}
            onClick={() => window.print()}
          >
            🖨️ Imprimir Corte Z (80mm)
          </button>
          <button
            type="button"
            className="btn-secondary-sm"
            style={{ padding: '12px' }}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// 4. WORK ORDER RECEIPT MODAL (COMPROBANTE DE RECEPCIÓN TALLER 80mm)
// ==========================================================================
export function WorkOrderReceiptModal({
  order,
  onClose,
  tenantName
}: {
  order: Any;
  onClose: () => void;
  tenantName?: string;
}) {
  const storeName = tenantName || localStorage.tenantName || 'Fixme Tienda';
  const orderNum = order.orderNumber || order.order_number || order.id?.slice(0, 8).toUpperCase();
  const trackingUrl = `${window.location.origin}/#tracking/${orderNum}`;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ maxWidth: '380px' }}>
        <div className="modal-head no-print">
          <h3>📄 Comprobante de Recepción</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div id="printable-work-receipt" className="thermal-receipt">
          <div className="thermal-center">
            <h2 className="thermal-title">{storeName}</h2>
            <div className="thermal-sub" style={{ fontWeight: 800 }}>ORDEN DE SERVICIO TÉCNICO</div>
            <div className="thermal-sub" style={{ fontSize: '15px', fontWeight: 800 }}>#{orderNum}</div>
            <div className="thermal-sub">
              Fecha: {new Date(order.createdAt || order.created_at || Date.now()).toLocaleString()}
            </div>
            <div className="thermal-divider" />
          </div>

          <div className="thermal-row">
            <span>Cliente:</span>
            <strong>{order.customerName || order.customer_name || 'Cliente'}</strong>
          </div>
          <div className="thermal-row">
            <span>Teléfono:</span>
            <span>{order.customerPhone || order.customer_phone || '-'}</span>
          </div>
          <div className="thermal-divider" />

          <div className="thermal-sub" style={{ fontWeight: 700 }}>DATOS DEL EQUIPO:</div>
          <div className="thermal-row">
            <span>Equipo:</span>
            <strong>
              {order.deviceBrand || order.device_brand || ''} {order.deviceModel || order.device_model || order.description}
            </strong>
          </div>
          <div className="thermal-row">
            <span>Serie / IMEI:</span>
            <span>{order.serialNumber || order.serial_number || 'N/A'}</span>
          </div>
          <div className="thermal-row">
            <span>Falla Reportada:</span>
            <span>{order.reportedFault || order.reported_fault || order.description}</span>
          </div>
          {order.accessories && (
            <div className="thermal-row">
              <span>Accesorios:</span>
              <span>{order.accessories}</span>
            </div>
          )}
          <div className="thermal-divider" />

          {order.quote > 0 && (
            <div className="thermal-row">
              <span>Presupuesto Aprox:</span>
              <strong>${Number(order.quote).toFixed(2)}</strong>
            </div>
          )}
          {order.estimatedDelivery && (
            <div className="thermal-row">
              <span>Entrega Estimada:</span>
              <span>{new Date(order.estimatedDelivery).toLocaleDateString()}</span>
            </div>
          )}
          <div className="thermal-divider" />

          <div style={{ fontSize: '9px', textAlign: 'justify', lineHeight: 1.25, color: '#334155' }}>
            <strong>CONDICIONES:</strong> El cliente declara ser el legítimo propietario del equipo. La empresa no se responsabiliza por pérdida de datos previos. Equipos no retirados pasados 90 días se consideran en abandono conforme a la ley.
          </div>

          <div className="thermal-divider" />
          <div className="thermal-center" style={{ margin: '8px 0' }}>
            <div style={{ fontSize: '10px', marginBottom: '4px' }}>Rastreo en vivo por celular:</div>
            <div style={{ fontSize: '9px', fontWeight: 700, wordBreak: 'break-all' }}>{trackingUrl}</div>
          </div>

          <div style={{ marginTop: '25px', textAlign: 'center', fontSize: '10px' }}>
            <div style={{ borderTop: '1px solid #000', width: '70%', margin: '0 auto 4px' }} />
            <div>Firma de Conformidad Cliente</div>
          </div>
        </div>

        <div className="modal-actions no-print" style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="btn-primary-sm"
            style={{ padding: '12px' }}
            onClick={() => window.print()}
          >
            🖨️ Imprimir Comprobante (80mm)
          </button>
          <button
            type="button"
            className="btn-secondary-sm"
            style={{ padding: '12px' }}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// 5. BARCODE LABELS MODAL (GENERADOR DE ETIQUETAS ADHESIVAS CON CÓDIGO)
// ==========================================================================
export function BarcodeTagsModal({
  products,
  onClose
}: {
  products: Any[];
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ maxWidth: '750px' }}>
        <div className="modal-head no-print">
          <h3>🏷️ Etiquetas de Códigos de Barras</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div id="printable-barcodes">
          <div className="barcode-print-grid">
            {products.map(p => (
              <div className="barcode-tag-card" key={p.id}>
                <div className="barcode-tag-title">{p.name}</div>
                <div className="barcode-tag-price">${Number(p.price).toFixed(2)}</div>
                <div className="barcode-bars" />
                <div style={{ fontSize: '11px', marginTop: '4px' }}>{p.barcode || p.sku}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions no-print" style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="btn-primary-sm"
            style={{ padding: '12px' }}
            onClick={() => window.print()}
          >
            🖨️ Imprimir Todas las Etiquetas
          </button>
          <button
            type="button"
            className="btn-secondary-sm"
            style={{ padding: '12px' }}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// 6. CSV IMPORT MODAL (IMPORTACIÓN MASIVA DE PRODUCTOS)
// ==========================================================================
export function CsvImportModal({
  branchId,
  api,
  onDone,
  onClose,
  notify
}: {
  branchId: string;
  api: (u: string, o?: RequestInit) => Promise<Response>;
  onDone: () => void;
  onClose: () => void;
  notify?: (s: string) => void;
}) {
  const [parsed, setParsed] = React.useState<Any[]>([]);
  const [importing, setImporting] = React.useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      parseCsv(text);
    };
    reader.readAsText(file);
  }

  function parseCsv(raw: string) {
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return;
    const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase());
    const items: Any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[,;]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) continue;
      const row: Any = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] || '';
      });
      items.push({
        sku: row.sku || row.codigo || `SKU-${i}`,
        name: row.nombre || row.name || row.producto || 'Producto sin nombre',
        price: Number(row.precio || row.price || 0),
        purchasePrice: Number(row.costo || row.purchaseprice || row.cost || 0),
        stock: Number(row.stock || row.cantidad || 0),
        minStock: Number(row.stockminimo || row.minstock || 5),
        barcode: row.codigobarras || row.barcode || row.sku || ''
      });
    }
    setParsed(items);
  }

  async function handleImport() {
    if (!parsed.length) return;
    setImporting(true);
    try {
      const res = await api(`/api/products/batch-import?branchId=${branchId}`, {
        method: 'POST',
        body: JSON.stringify(parsed)
      });
      if (res.ok) {
        const resData = await res.json();
        notify?.(`✓ Catálogo importado: ${resData.imported} nuevos, ${resData.updated} actualizados.`);
        onDone();
        onClose();
      } else {
        alert('Error al importar productos');
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ maxWidth: '540px' }}>
        <div className="modal-head">
          <h3>📤 Importación Masiva de Productos (CSV)</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px' }}>
          Sube un archivo CSV con columnas: <code>sku, nombre, precio, costo, stock, minStock, barcode</code>
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          style={{ padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '8px', width: '100%' }}
        />

        {parsed.length > 0 && (
          <div
            style={{
              margin: '14px 0',
              background: '#f8fafc',
              padding: '12px',
              borderRadius: '10px',
              maxHeight: '180px',
              overflowY: 'auto'
            }}
          >
            <strong style={{ fontSize: '12px', color: '#2563eb' }}>
              ✓ {parsed.length} productos detectados listos para importar:
            </strong>
            <ul style={{ fontSize: '11px', margin: '6px 0 0', paddingLeft: '18px', color: '#334155' }}>
              {parsed.slice(0, 5).map((p, idx) => (
                <li key={idx}>
                  <strong>{p.sku}</strong> - {p.name} (${p.price} | Stock: {p.stock})
                </li>
              ))}
              {parsed.length > 5 && <li>... y {parsed.length - 5} productos más</li>}
            </ul>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="btn-secondary-sm" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn-primary-sm"
            disabled={!parsed.length || importing}
            onClick={handleImport}
          >
            {importing ? 'Importando catálogo...' : `✓ Importar ${parsed.length} Productos`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// 7. TECHNICIAN WORKBENCH MODAL (FICHA TÉCNICA, REPUESTOS Y MANO DE OBRA)
// ==========================================================================
export function TechnicianWorkbenchModal({
  order,
  onClose,
  onSaved,
  api,
  notify,
  tenantName,
  branchId
}: {
  order: Any;
  onClose: () => void;
  onSaved: () => void;
  api: (u: string, o?: RequestInit) => Promise<Response>;
  notify?: (s: string) => void;
  tenantName?: string;
  branchId?: string;
}) {
  const [tab, setTab] = React.useState<'DIAG' | 'PARTS' | 'ACTIONS'>('DIAG');
  const [diagnosis, setDiagnosis] = React.useState(order.diagnosis || '');
  const [technicianNotes, setTechnicianNotes] = React.useState(order.technician_notes || '');
  const [estDelivery, setEstDelivery] = React.useState(
    order.estimated_delivery ? order.estimated_delivery.slice(0, 16) : ''
  );
  const [slaHours, setSlaHours] = React.useState<number>(order.sla_hours || 48);

  const [items, setItems] = React.useState<Array<{
    id?: string;
    itemType: 'SERVICE' | 'PART';
    name: string;
    quantity: number;
    unitPrice: number;
  }>>(
    (order.items || []).map((it: Any) => ({
      id: it.id,
      itemType: (it.itemType || it.item_type || 'SERVICE').toUpperCase() as 'SERVICE' | 'PART',
      name: it.name || '',
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || it.unit_price || 0)
    }))
  );

  const [products, setProducts] = React.useState<Any[]>([]);
  const [showAddLabor, setShowAddLabor] = React.useState(false);
  const [laborForm, setLaborForm] = React.useState({ name: '', price: '' });

  const [showAddPart, setShowAddPart] = React.useState(false);
  const [partForm, setPartForm] = React.useState({ selectedProductId: '', customName: '', quantity: '1', price: '' });

  const [saving, setSaving] = React.useState(false);
  const [statusUpdating, setStatusUpdating] = React.useState(false);
  const [showReceiptModal, setShowReceiptModal] = React.useState(false);

  // Load products for spare parts catalog picker
  React.useEffect(() => {
    const bId = branchId || localStorage.branchId || '';
    if (bId) {
      api(`/api/products?branchId=${bId}`)
        .then(r => r.ok ? r.json() : [])
        .then(setProducts)
        .catch(() => {});
    }
  }, [api, branchId]);

  // Calculations
  const laborTotal = items
    .filter(i => i.itemType === 'SERVICE')
    .reduce((sum, i) => sum + (Number(i.quantity) * Number(i.unitPrice)), 0);

  const partsTotal = items
    .filter(i => i.itemType === 'PART')
    .reduce((sum, i) => sum + (Number(i.quantity) * Number(i.unitPrice)), 0);

  const totalQuote = laborTotal + partsTotal;

  function handleAddLabor() {
    if (!laborForm.name.trim()) {
      notify?.('Ingresa la descripción del servicio o mano de obra');
      return;
    }
    const price = Math.max(0, Number(laborForm.price || 0));
    setItems(prev => [
      ...prev,
      { itemType: 'SERVICE', name: laborForm.name.trim(), quantity: 1, unitPrice: price }
    ]);
    setLaborForm({ name: '', price: '' });
    setShowAddLabor(false);
    notify?.('✓ Mano de obra agregada al presupuesto');
  }

  function handleAddPart() {
    let name = partForm.customName.trim();
    let price = Math.max(0, Number(partForm.price || 0));
    const qty = Math.max(1, Number(partForm.quantity || 1));

    if (partForm.selectedProductId) {
      const p = products.find(x => x.id === partForm.selectedProductId);
      if (p) {
        name = p.name;
        if (!price && p.price) price = Number(p.price);
      }
    }

    if (!name) {
      notify?.('Selecciona un repuesto del inventario o escribe su nombre');
      return;
    }

    setItems(prev => [
      ...prev,
      { itemType: 'PART', name, quantity: qty, unitPrice: price }
    ]);
    setPartForm({ selectedProductId: '', customName: '', quantity: '1', price: '' });
    setShowAddPart(false);
    notify?.('✓ Repuesto agregado al presupuesto');
  }

  function handleRemoveItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveTechnicalDetails() {
    setSaving(true);
    try {
      const body = {
        diagnosis,
        technicianNotes,
        quote: totalQuote,
        estimatedDelivery: estDelivery ? new Date(estDelivery).toISOString() : null,
        assignedTechnicianId: order.assigned_technician_id || null,
        slaHours: Number(slaHours || 48),
        items: items.map(it => ({
          itemType: it.itemType,
          name: it.name,
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0)
        }))
      };

      const res = await api(`/api/work-orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });

      if (res.ok) {
        notify?.('✓ Ficha técnica, repuestos y presupuesto guardados con éxito');
        onSaved();
        onClose();
      } else {
        const err = await res.text();
        notify?.(`Error al guardar: ${err}`);
      }
    } catch (e: any) {
      notify?.(`Error de conexión: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStatus(newStatus: string, defaultNote?: string) {
    setStatusUpdating(true);
    try {
      const res = await api(`/api/work-orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          technicianNotes: defaultNote || `Estado actualizado a ${newStatus}`
        })
      });
      if (res.ok) {
        notify?.(`✓ Orden avanzada a ${newStatus}`);
        onSaved();
        onClose();
      } else {
        notify?.('No se pudo actualizar el estado de la orden');
      }
    } finally {
      setStatusUpdating(false);
    }
  }

  function getSmartWhatsAppLink() {
    const cleanPhone = (order.customer_phone || '').replace(/[^0-9]/g, '');
    if (!cleanPhone) return null;

    let itemsBreakdown = '';
    if (items.length > 0) {
      itemsBreakdown = '\n\n*Detalle de Cotización:*\n' + items.map(it =>
        `  • ${it.itemType === 'PART' ? '📦' : '🛠️'} ${it.name} (x${it.quantity}): $${(it.quantity * it.unitPrice).toFixed(2)}`
      ).join('\n') + `\n*TOTAL PRESUPUESTO:* $${totalQuote.toFixed(2)}`;
    }

    const diagText = diagnosis ? `\n*Diagnóstico:* ${diagnosis}` : '';
    const text = encodeURIComponent(
      `Hola *${order.customer_name || 'Estimado cliente'}*, te saludamos de *${tenantName || 'Fixme Tiendas'}*.\n\n` +
      `Te informamos sobre tu equipo *${order.device_brand || ''} ${order.device_model || ''}* (Orden *#${order.order_number || ''}*):\n` +
      `*Estado actual:* ${order.status}${diagText}${itemsBreakdown}\n\n` +
      `Quedamos atentos a tu confirmación. ¡Muchas gracias!`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  }

  const waLink = getSmartWhatsAppLink();

  return (
    <>
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-card" style={{ maxWidth: '680px', width: '95%' }}>
          {/* Header */}
          <div className="modal-head" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0 }}>🛠️ Banco de Trabajo — {order.order_number || 'OT-#'}</h3>
                <span className="badge-service" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                  {order.status}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: 4 }}>
                📱 <strong>{order.device_brand} {order.device_model}</strong> · Cliente: <strong>{order.customer_name || 'Consumidor Final'}</strong>
              </div>
            </div>
            <button className="close-button" onClick={onClose}>✕</button>
          </div>

          {/* Nav Tabs */}
          <div className="workbench-tabs">
            <button
              type="button"
              className={`workbench-tab-btn ${tab === 'DIAG' ? 'active' : ''}`}
              onClick={() => setTab('DIAG')}
            >
              🔬 Diagnóstico & Bitácora
            </button>
            <button
              type="button"
              className={`workbench-tab-btn ${tab === 'PARTS' ? 'active' : ''}`}
              onClick={() => setTab('PARTS')}
            >
              ⚙️ Repuestos & Mano de Obra {items.length > 0 && `(${items.length})`}
            </button>
            <button
              type="button"
              className={`workbench-tab-btn ${tab === 'ACTIONS' ? 'active' : ''}`}
              onClick={() => setTab('ACTIONS')}
            >
              🚀 Acciones & WhatsApp
            </button>
          </div>

          {/* TAB 1: DIAGNOSIS & NOTES */}
          {tab === 'DIAG' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, fontSize: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Falla Reportada por Cliente:</span>
                    <strong style={{ color: '#0f172a' }}>"{order.reported_fault || 'Sin detalle'}"</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Accesorios Recibidos:</span>
                    <strong>{order.accessories || 'Ninguno'}</strong>
                  </div>
                  {order.serial_number && (
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>N° Serie / IMEI:</span>
                      <code>{order.serial_number}</code>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  🔬 Diagnóstico Técnico (Causa de la falla confirmada)
                </label>
                <textarea
                  rows={3}
                  value={diagnosis}
                  onChange={e => setDiagnosis(e.target.value)}
                  placeholder="Ej: Se desmontó el equipo y se detectó cortocircuito en línea principal VDD_MAIN. Pantalla quebrada internamente..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  📝 Bitácora Interna / Notas de Avance del Técnico
                </label>
                <textarea
                  rows={3}
                  value={technicianNotes}
                  onChange={e => setTechnicianNotes(e.target.value)}
                  placeholder="Ej: Limpieza con ultrasonido ejecutada. Repuesto solicitado a bodega. En pruebas de carga y encendido..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    ⏱️ Meta de SLA (Horas límite)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={slaHours}
                    onChange={e => setSlaHours(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    📅 Fecha Estimada de Entrega
                  </label>
                  <input
                    type="datetime-local"
                    value={estDelivery}
                    onChange={e => setEstDelivery(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SPARE PARTS & LABOR */}
          {tab === 'PARTS' && (
            <div>
              {/* Presupuesto Live KPI Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                border: '1px solid #bfdbfe',
                borderRadius: 12,
                padding: '14px 18px',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#1e40af' }}>
                    Presupuesto Técnico Total
                  </span>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e3a8a' }}>
                    ${totalQuote.toFixed(2)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: '12px', color: '#334155' }}>
                  <div>
                    <span style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>🛠️ Mano de Obra:</span>
                    <strong>${laborTotal.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>📦 Repuestos:</span>
                    <strong>${partsTotal.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons to Add Labor or Parts */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary-sm"
                  onClick={() => { setShowAddLabor(!showAddLabor); setShowAddPart(false); }}
                >
                  + Agregar Mano de Obra / Servicio
                </button>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={() => { setShowAddPart(!showAddPart); setShowAddLabor(false); }}
                >
                  + Agregar Repuesto (Inventario / Pieza)
                </button>
              </div>

              {/* Labor Input Form */}
              {showAddLabor && (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>🛠️ Nueva Mano de Obra o Servicio Técnico</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>Descripción del trabajo</label>
                      <input
                        type="text"
                        placeholder="Ej: Cambio de pantalla y recalibración táctil"
                        value={laborForm.name}
                        onChange={e => setLaborForm({ ...laborForm, name: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>Precio / Costo ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={laborForm.price}
                        onChange={e => setLaborForm({ ...laborForm, price: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
                      />
                    </div>
                    <button type="button" className="btn-primary-sm" onClick={handleAddLabor}>
                      ✓ Añadir
                    </button>
                  </div>
                </div>
              )}

              {/* Spare Part Input Form */}
              {showAddPart && (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>📦 Nuevo Repuesto / Pieza Utilizada</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>Elegir del Inventario Tienda:</label>
                      <select
                        value={partForm.selectedProductId}
                        onChange={e => {
                          const pId = e.target.value;
                          const p = products.find(x => x.id === pId);
                          setPartForm({
                            ...partForm,
                            selectedProductId: pId,
                            customName: p ? p.name : partForm.customName,
                            price: p ? String(p.price) : partForm.price
                          });
                        }}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
                      >
                        <option value="">-- Seleccionar producto de inventario --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {p.stock} | ${Number(p.price).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>O Escribir Repuesto Especial:</label>
                      <input
                        type="text"
                        placeholder="Ej: Batería iPhone 13 Original"
                        value={partForm.customName}
                        onChange={e => setPartForm({ ...partForm, customName: e.target.value, selectedProductId: '' })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <div style={{ width: '90px' }}>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={partForm.quantity}
                        onChange={e => setPartForm({ ...partForm, quantity: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ width: '110px' }}>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>Precio Unit ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={partForm.price}
                        onChange={e => setPartForm({ ...partForm, price: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
                      />
                    </div>
                    <button type="button" className="btn-primary-sm" onClick={handleAddPart}>
                      ✓ Añadir Repuesto
                    </button>
                  </div>
                </div>
              )}

              {/* Items Table */}
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 10px', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '13px' }}>
                  No se han registrado repuestos ni mano de obra aún.
                  <div style={{ fontSize: '11px', marginTop: 4 }}>Usa los botones superiores para armar el presupuesto técnico.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '110px' }}>Tipo</th>
                        <th>Descripción</th>
                        <th style={{ width: '65px', textAlign: 'center' }}>Cant</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>P. Unit</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Subtotal</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const lineTotal = Number(it.quantity) * Number(it.unitPrice);
                        return (
                          <tr key={idx}>
                            <td>
                              <span className={it.itemType === 'PART' ? 'badge-part' : 'badge-service'}>
                                {it.itemType === 'PART' ? '📦 Repuesto' : '🛠️ M. Obra'}
                              </span>
                            </td>
                            <td><strong>{it.name}</strong></td>
                            <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                            <td style={{ textAlign: 'right' }}>${Number(it.unitPrice).toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>${lineTotal.toFixed(2)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                title="Eliminar ítem"
                                style={{ background: 'transparent', border: 0, color: '#ef4444', fontSize: '14px', cursor: 'pointer' }}
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUICK ACTIONS & WHATSAPP */}
          {tab === 'ACTIONS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Status Stepper Buttons */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#334155' }}>
                  🔄 Avanzar Estado del Equipo en Taller:
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    className="tech-action-btn tech-action-repair"
                    disabled={statusUpdating}
                    onClick={() => handleQuickStatus('EN_REPARACION', 'Técnico inició los trabajos de reparación')}
                  >
                    ▶ 1. En Reparación
                  </button>
                  <button
                    type="button"
                    className="tech-action-btn tech-action-parts"
                    disabled={statusUpdating}
                    onClick={() => handleQuickStatus('ESPERANDO_REPUESTOS', 'Esperando repuestos')}
                  >
                    ⏳ 2. Esperar Repuestos
                  </button>
                  <button
                    type="button"
                    className="tech-action-btn tech-action-ready"
                    disabled={statusUpdating}
                    onClick={() => handleQuickStatus('LISTO_ENTREGA', 'Equipo reparado y comprobado')}
                  >
                    ✓ 3. Marcar Listo para Entrega
                  </button>
                  <button
                    type="button"
                    className="tech-action-btn"
                    style={{ background: '#f1f5f9', color: '#334155' }}
                    disabled={statusUpdating}
                    onClick={() => handleQuickStatus('ENTREGADO', 'Equipo entregado con conformidad al cliente')}
                  >
                    🤝 4. Entregar al Cliente
                  </button>
                </div>
              </div>

              <div className="ticket-divider" />

              {/* WhatsApp Client Notification */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#334155' }}>
                  💬 Notificación Directa al Cliente por WhatsApp:
                </h4>
                {waLink ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#166534' }}>
                      Envía un mensaje detallado a <strong>{order.customer_name}</strong> ({order.customer_phone}) con el diagnóstico y la cotización actualizada de repuestos y mano de obra.
                    </p>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-wa-sm"
                      style={{ padding: '8px 16px', borderRadius: 8, fontSize: '13px', fontWeight: 700 }}
                    >
                      💬 Abrir Chat de WhatsApp con Cotización
                    </a>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '12px' }}>
                    ⚠️ Este cliente no tiene número de teléfono registrado para WhatsApp.
                  </div>
                )}
              </div>

              <div className="ticket-divider" />

              {/* Thermal Receipt Print Button */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#334155' }}>
                  🖨️ Documentos Oficiales de Taller:
                </h4>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setShowReceiptModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  🖨️ Imprimir Comprobante de Taller / Recepción (80mm con QR)
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="modal-actions" style={{ marginTop: 20 }}>
            <button type="button" className="btn-secondary-sm" onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className="btn-primary-sm"
              disabled={saving}
              onClick={handleSaveTechnicalDetails}
              style={{ minWidth: 200 }}
            >
              {saving ? 'Guardando cambios...' : `💾 Guardar Ficha & Presupuesto ($${totalQuote.toFixed(2)})`}
            </button>
          </div>
        </div>
      </div>

      {/* Embedded WorkOrderReceiptModal if requested */}
      {showReceiptModal && (
        <WorkOrderReceiptModal
          order={order}
          onClose={() => setShowReceiptModal(false)}
          tenantName={tenantName || localStorage.tenantName || 'Fixme Tiendas'}
        />
      )}
    </>
  );
}


