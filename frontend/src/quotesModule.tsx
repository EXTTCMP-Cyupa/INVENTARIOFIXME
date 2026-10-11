import React from 'react';
import { DeUnaModal } from './deunaModal';
import { PayphoneModal } from './payphoneModal';
import { printTicketElement } from './ticketPrinter';
import { PageHeader, KpiStrip, StatusBadge, IconButton } from './sharedLayout';
import { Plus, Search, Copy, MessageCircle, Printer, Edit2, ShoppingCart, FileText } from 'lucide-react';

type Any = Record<string, any>;

// =========================================================================
// 1. COMMERCIAL QUOTES (PROFORMAS) MODULE
// =========================================================================
export function QuotesPage({
  api,
  notify,
  go
}: {
  api: (u: string, o?: RequestInit) => Promise<Response>;
  notify: (s: string) => void;
  go?: (k: string) => void;
}) {
  const [quotes, setQuotes] = React.useState<Any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');

  // Modals
  const [showFormModal, setShowFormModal] = React.useState(false);
  const [quoteToEdit, setQuoteToEdit] = React.useState<Any | null>(null);
  const [selectedQuote, setSelectedQuote] = React.useState<Any | null>(null);
  const [showPrintModal, setShowPrintModal] = React.useState(false);
  const [showConvertModal, setShowConvertModal] = React.useState(false);
  const [createdShareQuote, setCreatedShareQuote] = React.useState<Any | null>(null);

  // Products from catalog & registered customers
  const [products, setProducts] = React.useState<Any[]>([]);
  const [customers, setCustomers] = React.useState<Any[]>([]);

  // Convert to sale state
  const [convertPaymentMethod, setConvertPaymentMethod] = React.useState('CASH');
  const [convertWarrantyDays, setConvertWarrantyDays] = React.useState('30');
  const [converting, setConverting] = React.useState(false);

  const loadQuotes = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.append('status', statusFilter);
    if (search.trim()) params.append('search', search.trim());

    api(`/api/quotes?${params.toString()}`)
      .then(r => (r.ok ? r.json() : []))
      .then(setQuotes)
      .finally(() => setLoading(false));
  }, [api, statusFilter, search]);

  const loadProducts = React.useCallback(() => {
    const branch = localStorage.branchId || '';
    api(`/api/products?branchId=${branch}`)
      .then(r => (r.ok ? r.json() : []))
      .then(setProducts)
      .catch(() => {});
  }, [api]);

  const loadCustomers = React.useCallback(() => {
    api('/api/customers')
      .then(r => (r.ok ? r.json() : []))
      .then(setCustomers)
      .catch(() => {});
  }, [api]);

  React.useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  React.useEffect(() => {
    loadProducts();
    loadCustomers();
  }, [loadProducts, loadCustomers]);

  // Copy public link to clipboard helper
  const copyPublicLink = (q: Any) => {
    const token = q.public_token || q.publicToken || q.id;
    const url = `${window.location.origin}/#quote/${token}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => notify('✓ ¡Enlace público copiado al portapapeles!'))
        .catch(() => prompt('Copia este enlace para el cliente:', url));
    } else {
      prompt('Copia este enlace para el cliente:', url);
    }
  };

  // Convert quote to sale
  async function handleConvertToSale(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuote || converting) return;
    setConverting(true);
    try {
      const res = await api(`/api/quotes/${selectedQuote.id}/convert-to-sale?branchId=${localStorage.branchId || '00000000-0000-0000-0000-000000000010'}`, {
        method: 'POST',
        body: JSON.stringify({
          payments: [{ method: convertPaymentMethod, amount: selectedQuote.total }],
          warrantyDays: Number(convertWarrantyDays) || 30
        })
      });

      if (res.ok) {
        notify(`✓ Cotización ${selectedQuote.quote_number || selectedQuote.quoteNumber} convertida en venta exitosamente`);
        setShowConvertModal(false);
        setSelectedQuote(null);
        loadQuotes();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'No se pudo convertir la cotización a venta.');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setConverting(false);
    }
  }

  // KPIs
  const totalCount = quotes.length;
  const pendingCount = quotes.filter(q => q.status === 'PENDING').length;
  const approvedCount = quotes.filter(q => q.status === 'APPROVED').length;
  const convertedCount = quotes.filter(q => q.status === 'CONVERTED').length;
  const totalAmountSum = quotes.reduce((acc, q) => acc + Number(q.total || 0), 0);

  return (
    <div className="orders-page" style={{ padding: '0 2px' }}>
      {/* 1. PageHeader */}
      <PageHeader
        title="Cotizaciones"
        description="Proformas, aprobaciones y facturación comercial"
        actions={
          <button
            type="button"
            className="primary-action"
            onClick={() => { setQuoteToEdit(null); setShowFormModal(true); }}
          >
            <Plus size={16} />
            <span>Nueva cotización</span>
          </button>
        }
      />

      {/* 2. KpiStrip */}
      <KpiStrip
        items={[
          {
            label: 'Total cotizaciones',
            value: totalCount,
            hint: `$${totalAmountSum.toFixed(2)} cotizados`,
            active: statusFilter === 'ALL',
            onClick: () => setStatusFilter('ALL')
          },
          {
            label: 'Por aprobar',
            value: pendingCount,
            hint: 'Esperando cliente',
            tone: pendingCount > 0 ? 'warning' : 'default',
            active: statusFilter === 'PENDING',
            onClick: () => setStatusFilter('PENDING')
          },
          {
            label: 'Aprobadas',
            value: approvedCount,
            hint: 'Listas para facturar',
            tone: approvedCount > 0 ? 'success' : 'default',
            active: statusFilter === 'APPROVED',
            onClick: () => setStatusFilter('APPROVED')
          },
          {
            label: 'Facturadas en POS',
            value: convertedCount,
            hint: 'Venta cerrada',
            active: statusFilter === 'CONVERTED',
            onClick: () => setStatusFilter('CONVERTED')
          }
        ]}
      />

      {/* 3. Toolbar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="search-box" style={{ width: '320px' }}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar por n.º, cliente o CI/RUC..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="ALL">Todos los estados</option>
            <option value="PENDING">Por aprobar</option>
            <option value="APPROVED">Aprobadas</option>
            <option value="CONVERTED">Facturadas a venta</option>
            <option value="REJECTED">Rechazadas</option>
            <option value="EXPIRED">Vencidas</option>
          </select>
        </div>
      </div>

      {/* 4. Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando proformas...</div>
      ) : quotes.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '50px 20px', border: '1px dashed var(--border-strong)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text-subtle)' }}>
            <FileText size={36} />
          </div>
          <h3 style={{ margin: '0 0 6px', color: 'var(--text)' }}>No hay cotizaciones registradas</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
            Crea una proforma para tus clientes con precios, descuentos e IVA.
          </p>
          <button type="button" className="primary-action" onClick={() => { setQuoteToEdit(null); setShowFormModal(true); }}>
            <Plus size={16} /> Crear primera cotización
          </button>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>N.º proforma</th>
                  <th>Cliente</th>
                  <th>Emisión</th>
                  <th>Vigencia</th>
                  <th className="num">Subtotal</th>
                  <th className="num">IVA 15 %</th>
                  <th className="num">Total</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => {
                  const isConv = q.status === 'CONVERTED';
                  const isAppr = q.status === 'APPROVED';
                  const isPend = q.status === 'PENDING' || q.status === 'DRAFT';
                  const token = q.public_token || q.publicToken || q.id;
                  const publicUrl = `${window.location.origin}/#quote/${token}`;
                  const rawPhone = (q.customer_phone || q.customerPhone || '').replace(/[^0-9]/g, '');
                  const waText = encodeURIComponent(`Hola ${q.customer_name || q.customerName || 'Estimado cliente'}, le adjuntamos la cotización oficial #${q.quote_number || q.quoteNumber} por un total de $${Number(q.total).toFixed(2)}. Puede revisarla y aprobarla en línea directamente aquí: ${publicUrl}`);
                  const waHref = rawPhone ? `https://wa.me/${rawPhone}?text=${waText}` : `https://wa.me/?text=${waText}`;

                  return (
                    <tr key={q.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {q.quote_number || q.quoteNumber}
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {q.customer_name || q.customerName || 'Consumidor'}
                        </div>
                        <small style={{ color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {q.customer_id_number || q.customerIdNumber ? `CI: ${q.customer_id_number || q.customerIdNumber} ` : ''}
                          {q.customer_phone || q.customerPhone ? `· ${q.customer_phone || q.customerPhone}` : ''}
                        </small>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(q.created_at || q.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '15 días'}
                      </td>
                      <td className="num">
                        ${Number(q.subtotal || 0).toFixed(2)}
                      </td>
                      <td className="num" style={{ color: 'var(--text-muted)' }}>
                        ${Number(q.tax || 0).toFixed(2)}
                      </td>
                      <td className="num" style={{ fontWeight: 700, color: 'var(--text)' }}>
                        ${Number(q.total || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isConv ? (
                          <StatusBadge tone="brand">Facturada</StatusBadge>
                        ) : isAppr ? (
                          <StatusBadge tone="success">Aprobada</StatusBadge>
                        ) : isPend ? (
                          <StatusBadge tone="warning">Por aprobar</StatusBadge>
                        ) : q.status === 'REJECTED' ? (
                          <StatusBadge tone="danger">Rechazada</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">{q.status}</StatusBadge>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', minWidth: 168 }}>
                          {/* Facturar en POS button if not already converted */}
                          {!isConv && (
                            <button
                              type="button"
                              className="secondary-action btn-sm"
                              title="Facturar en POS (Convertir a venta)"
                              onClick={() => { setSelectedQuote(q); setShowConvertModal(true); }}
                              style={{ height: 28, padding: '0 8px', fontSize: 11, fontWeight: 600 }}
                            >
                              Facturar
                            </button>
                          )}

                          {/* Copy public link */}
                          <IconButton
                            icon={Copy}
                            label="Copiar enlace para el cliente"
                            onClick={() => copyPublicLink(q)}
                          />

                          {/* WhatsApp */}
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noreferrer"
                            className="icon-btn"
                            title="Enviar por WhatsApp"
                            aria-label="Enviar por WhatsApp"
                            style={{ textDecoration: 'none' }}
                          >
                            <MessageCircle size={15} style={{ color: 'var(--wa-green)' }} />
                          </a>

                          {/* Print / View A4 */}
                          <IconButton
                            icon={Printer}
                            label="Ver e imprimir proforma A4"
                            onClick={() => { setSelectedQuote(q); setShowPrintModal(true); }}
                          />

                          {/* Edit (only if pending/draft) */}
                          {isPend && (
                            <IconButton
                              icon={Edit2}
                              label="Editar cotización"
                              onClick={() => { setQuoteToEdit(q); setShowFormModal(true); }}
                            />
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
      )}

      {/* CREATE / EDIT MODAL */}
      {showFormModal && (
        <QuoteFormModal
          api={api}
          products={products}
          customers={customers}
          editQuote={quoteToEdit}
          onCustomerCreated={loadCustomers}
          onClose={() => { setShowFormModal(false); setQuoteToEdit(null); }}
          onSaved={(savedQuote) => {
            setShowFormModal(false);
            setQuoteToEdit(null);
            loadQuotes();
            if (!quoteToEdit) {
              setCreatedShareQuote(savedQuote);
              notify('✓ Cotización guardada con éxito.');
            } else {
              notify('✓ Cotización actualizada correctamente.');
            }
          }}
        />
      )}

      {/* SUCCESS SHARE DIALOG (AFTER CREATING QUOTE) */}
      {createdShareQuote && (
        <div className="modal-overlay" onClick={() => setCreatedShareQuote(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>
              Cotización #{createdShareQuote.quote_number || createdShareQuote.quoteNumber} Generada
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>
              La cotización ha sido guardada. Puedes enviar este enlace al cliente para que revise y apruebe en línea:
            </p>

            {/* Link Box */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/#quote/${createdShareQuote.public_token || createdShareQuote.publicToken || createdShareQuote.id}`}
                style={{ flex: 1, padding: '8px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc' }}
              />
              <button
                type="button"
                className="primary-action"
                style={{ padding: '8px 14px', fontSize: 12 }}
                onClick={() => copyPublicLink(createdShareQuote)}
              >
                📋 Copiar
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <a
                href={`https://wa.me/${(createdShareQuote.customer_phone || createdShareQuote.customerPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${createdShareQuote.customer_name || createdShareQuote.customerName || 'Estimado cliente'}, le adjuntamos su cotización oficial #${createdShareQuote.quote_number || createdShareQuote.quoteNumber} por un total de $${Number(createdShareQuote.total).toFixed(2)}. Puede revisarla y aprobarla en línea aquí: ${window.location.origin}/#quote/${createdShareQuote.public_token || createdShareQuote.publicToken || createdShareQuote.id}`)}`}
                target="_blank"
                rel="noreferrer"
                className="primary-action"
                style={{ background: '#16a34a', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13 }}
              >
                💬 Enviar por WhatsApp
              </a>

              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setSelectedQuote(createdShareQuote);
                  setCreatedShareQuote(null);
                  setShowPrintModal(true);
                }}
              >
                🖨️ Ver Proforma A4
              </button>
            </div>

            <button
              type="button"
              className="close-button"
              onClick={() => setCreatedShareQuote(null)}
              style={{ position: 'absolute', top: 12, right: 12 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* PRINT MODAL */}
      {showPrintModal && selectedQuote && (
        <PrintQuoteModal
          quote={selectedQuote}
          onClose={() => { setShowPrintModal(false); setSelectedQuote(null); }}
          onCopyLink={() => copyPublicLink(selectedQuote)}
        />
      )}

      {/* CONVERT TO SALE MODAL */}
      {showConvertModal && selectedQuote && (
        <div className="modal-overlay" onClick={() => setShowConvertModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <h3>🛒 Facturar Cotización</h3>
              <button className="close-button" onClick={() => setShowConvertModal(false)}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 14px' }}>
              Convertirás la cotización <strong>{selectedQuote.quote_number || selectedQuote.quoteNumber}</strong> ({selectedQuote.customer_name || 'Cliente'}) en una venta registrada en el sistema. Se descontará el inventario automáticamente.
            </p>

            <div style={{ background: '#eff6ff', padding: '12px 14px', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Total a Cobrar:</span>
                <strong style={{ fontSize: 18, color: '#1d4ed8' }}>${Number(selectedQuote.total).toFixed(2)}</strong>
              </div>
            </div>

            <form onSubmit={handleConvertToSale}>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Método de Pago Recibido:</span>
                <select
                  className="input-field"
                  value={convertPaymentMethod}
                  onChange={e => setConvertPaymentMethod(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px' }}
                >
                  <option value="CASH">💵 Efectivo</option>
                  <option value="TRANSFER">🏦 Transferencia Bancaria</option>
                  <option value="CARD">💳 Tarjeta Débito / Crédito</option>
                  <option value="OTHER">📱 Otro / QR</option>
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: 20 }}>
                <span style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Días de Garantía:</span>
                <input
                  type="number"
                  min="0"
                  value={convertWarrantyDays}
                  onChange={e => setConvertWarrantyDays(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px' }}
                />
              </label>

              <div className="modal-actions">
                <button
                  type="submit"
                  className="primary-action"
                  disabled={converting}
                  style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                >
                  {converting ? 'Procesando Venta...' : '✓ Confirmar y Registrar Venta'}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setShowConvertModal(false)}
                  disabled={converting}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 2. CREATE & EDIT QUOTE MODAL (WITH CUSTOMER ON-THE-FLY CREATION & PRICE UPDATING)
// =========================================================================
function QuoteFormModal({
  api,
  products,
  customers,
  editQuote,
  onCustomerCreated,
  onClose,
  onSaved
}: {
  api: (u: string, o?: RequestInit) => Promise<Response>;
  products: Any[];
  customers: Any[];
  editQuote?: Any | null;
  onCustomerCreated: () => void;
  onClose: () => void;
  onSaved: (savedQuote: Any) => void;
}) {
  const isEditing = !!editQuote;

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string>(editQuote?.customer_id || editQuote?.customerId || '');
  const [customerName, setCustomerName] = React.useState(editQuote?.customer_name || editQuote?.customerName || '');
  const [customerPhone, setCustomerPhone] = React.useState(editQuote?.customer_phone || editQuote?.customerPhone || '');
  const [customerEmail, setCustomerEmail] = React.useState(editQuote?.customer_email || editQuote?.customerEmail || '');
  const [customerIdNumber, setCustomerIdNumber] = React.useState(editQuote?.customer_id_number || editQuote?.customerIdNumber || '');
  const [validDays, setValidDays] = React.useState(15);
  const [notes, setNotes] = React.useState(editQuote?.notes || '');
  const [terms, setTerms] = React.useState(editQuote?.terms || 'Precios incluyen IVA (15%). Cotización válida por el tiempo estipulado. Entrega sujeta a disponibilidad de stock.');

  // Quick customer creation inline state
  const [showQuickCustomer, setShowQuickCustomer] = React.useState(false);
  const [newCustName, setNewCustName] = React.useState('');
  const [newCustIdNum, setNewCustIdNum] = React.useState('');
  const [newCustPhone, setNewCustPhone] = React.useState('');
  const [newCustEmail, setNewCustEmail] = React.useState('');
  const [newCustAddress, setNewCustAddress] = React.useState('');
  const [savingCust, setSavingCust] = React.useState(false);

  // Items state
  const [items, setItems] = React.useState<Array<{
    productId?: string;
    itemType: 'PRODUCT' | 'SERVICE';
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
  }>>(() => {
    if (editQuote && Array.isArray(editQuote.items) && editQuote.items.length > 0) {
      return editQuote.items.map((it: Any) => ({
        productId: it.productId || it.product_id || '',
        itemType: it.itemType || it.item_type || 'PRODUCT',
        description: it.description || '',
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice || it.unit_price) || 0,
        discount: Number(it.discount) || 0,
        taxRate: Number(it.taxRate || it.tax_rate) || 15
      }));
    }
    return [{ itemType: 'PRODUCT', description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 15 }];
  });

  const [saving, setSaving] = React.useState(false);

  // When picking an existing customer from dropdown
  function handleSelectCustomer(custId: string) {
    setSelectedCustomerId(custId);
    if (!custId) return;
    const c = customers.find(cust => cust.id === custId);
    if (c) {
      setCustomerName(c.name || '');
      setCustomerIdNumber(c.identification_number || c.identificationNumber || '');
      setCustomerPhone(c.phone || '');
      setCustomerEmail(c.email || '');
    }
  }

  // Quick Customer Save
  async function handleCreateQuickCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustName.trim()) {
      alert('El nombre del cliente es obligatorio');
      return;
    }
    setSavingCust(true);
    try {
      const res = await api('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: newCustName.trim(),
          identificationType: (newCustIdNum.trim().length === 13) ? 'RUC' : 'CEDULA',
          identificationNumber: newCustIdNum.trim(),
          phone: newCustPhone.trim(),
          email: newCustEmail.trim(),
          address: newCustAddress.trim()
        })
      });

      if (res.ok) {
        const created = await res.json();
        onCustomerCreated();
        setSelectedCustomerId(created.id);
        setCustomerName(created.name || newCustName.trim());
        setCustomerIdNumber(created.identificationNumber || created.identification_number || newCustIdNum.trim());
        setCustomerPhone(created.phone || newCustPhone.trim());
        setCustomerEmail(created.email || newCustEmail.trim());
        setShowQuickCustomer(false);
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'No se pudo registrar el cliente.');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setSavingCust(false);
    }
  }

  function addItem(type: 'PRODUCT' | 'SERVICE' = 'PRODUCT') {
    setItems([...items, { itemType: type, description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 15 }]);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function selectProduct(idx: number, prodId: string) {
    const next = [...items];
    if (!prodId) {
      next[idx] = {
        ...next[idx],
        productId: '',
        description: '',
        unitPrice: 0
      };
      setItems(next);
      return;
    }
    const p = products.find(prod => prod.id === prodId);
    if (!p) return;
    next[idx] = {
      ...next[idx],
      productId: p.id,
      description: p.name,
      unitPrice: Number(p.price || 0)
    };
    setItems(next);
  }

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
  const totalDiscount = items.reduce((acc, it) => acc + Number(it.discount || 0), 0);
  const subtotalNeto = Math.max(0, subtotal - totalDiscount);
  const tax = subtotalNeto * 0.15;
  const grandTotal = subtotalNeto + tax;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Por favor indica el nombre del cliente o selecciónalo del listado.');
      return;
    }
    if (!items.length || items.every(it => !it.description.trim())) {
      alert('Por favor agrega al menos un ítem con descripción y precio.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId: selectedCustomerId || null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        customerIdNumber: customerIdNumber.trim(),
        validDays,
        notes: notes.trim(),
        terms: terms.trim(),
        items: items.filter(it => it.description.trim()).map(it => ({
          productId: it.productId || null,
          itemType: it.itemType,
          description: it.description.trim(),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate || 15)
        }))
      };

      const endpoint = isEditing
        ? `/api/quotes/${editQuote.id}`
        : `/api/quotes?branchId=${localStorage.branchId || '00000000-0000-0000-0000-000000000010'}`;

      const res = await api(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const savedData = await res.json();
        onSaved(savedData);
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'Error al guardar la cotización.');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 840, width: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-head">
          <h3>{isEditing ? `✏️ Editar Cotización #${editQuote.quote_number || editQuote.quoteNumber}` : '📋 Nueva Cotización / Proforma'}</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* CUSTOMER SECTION */}
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 13, color: '#1e293b' }}>👤 Información del Cliente</h4>
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => setShowQuickCustomer(!showQuickCustomer)}
                style={{ fontSize: 12, padding: '4px 10px', background: showQuickCustomer ? '#fee2e2' : '#eff6ff', color: showQuickCustomer ? '#b91c1c' : '#2563eb' }}
              >
                {showQuickCustomer ? '✕ Cerrar Formulario' : '＋ Crear Nuevo Cliente'}
              </button>
            </div>

            {/* Quick Customer Inline Form */}
            {showQuickCustomer && (
              <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px dashed #93c5fd', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 8 }}>
                  Creación Rápida de Cliente en Base de Datos:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
                  <input
                    placeholder="Nombre o Razón Social *"
                    value={newCustName}
                    onChange={e => setNewCustName(e.target.value)}
                    style={{ fontSize: 12, padding: '6px 8px' }}
                  />
                  <input
                    placeholder="Cédula o RUC"
                    value={newCustIdNum}
                    onChange={e => setNewCustIdNum(e.target.value)}
                    style={{ fontSize: 12, padding: '6px 8px' }}
                  />
                  <input
                    placeholder="Teléfono / WhatsApp"
                    value={newCustPhone}
                    onChange={e => setNewCustPhone(e.target.value)}
                    style={{ fontSize: 12, padding: '6px 8px' }}
                  />
                  <input
                    type="email"
                    placeholder="Correo Electrónico"
                    value={newCustEmail}
                    onChange={e => setNewCustEmail(e.target.value)}
                    style={{ fontSize: 12, padding: '6px 8px' }}
                  />
                  <input
                    placeholder="Dirección / Ciudad"
                    value={newCustAddress}
                    onChange={e => setNewCustAddress(e.target.value)}
                    style={{ fontSize: 12, padding: '6px 8px' }}
                  />
                </div>
                <button
                  type="button"
                  className="primary-action"
                  disabled={savingCust}
                  onClick={handleCreateQuickCustomer}
                  style={{ fontSize: 12, padding: '6px 14px' }}
                >
                  {savingCust ? 'Guardando...' : '✓ Guardar y Seleccionar Cliente'}
                </button>
              </div>
            )}

            {/* Select existing customer */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 3 }}>
                  Seleccionar Cliente Existente:
                </span>
                <select
                  className="input-field"
                  value={selectedCustomerId}
                  onChange={e => handleSelectCustomer(e.target.value)}
                  style={{ width: '100%', fontSize: 13, padding: '7px 10px' }}
                >
                  <option value="">-- Buscar o Seleccionar de Clientes Registrados ({customers.length}) --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.identification_number ? `(${c.identification_number})` : ''} {c.phone ? `· ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Customer Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <label>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Nombre o Razón Social *</span>
                <input
                  placeholder="Ej. Juan Pérez / Empresa S.A."
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  required
                  style={{ width: '100%', fontSize: 13, padding: '6px 8px' }}
                />
              </label>

              <label>
                <span style={{ fontSize: 11, fontWeight: 700 }}>C.I. / RUC</span>
                <input
                  placeholder="Ej. 1712345678"
                  value={customerIdNumber}
                  onChange={e => setCustomerIdNumber(e.target.value)}
                  style={{ width: '100%', fontSize: 13, padding: '6px 8px' }}
                />
              </label>

              <label>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Teléfono / WhatsApp</span>
                <input
                  placeholder="Ej. 0987654321"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  style={{ width: '100%', fontSize: 13, padding: '6px 8px' }}
                />
              </label>

              <label>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Correo Electrónico</span>
                <input
                  type="email"
                  placeholder="cliente@ejemplo.com"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  style={{ width: '100%', fontSize: 13, padding: '6px 8px' }}
                />
              </label>
            </div>
          </div>

          {/* ITEMS SECTION */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: '#0f172a' }}>
                📦 Productos y Servicios Cotizados ({items.length})
              </h4>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn-secondary-sm" onClick={() => addItem('PRODUCT')}>
                  + Agregar Producto
                </button>
                <button type="button" className="btn-secondary-sm" onClick={() => addItem('SERVICE')}>
                  + Agregar Servicio / Mano de Obra
                </button>
              </div>
            </div>

            {items.map((it, idx) => {
              const matchedProd = products.find(p => p.id === it.productId);
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.5fr 3fr 1fr 1.2fr 1fr 1fr 30px', gap: 8, alignItems: 'center', marginBottom: 8, background: '#fff', border: '1px solid #e2e8f0', padding: 8, borderRadius: 8 }}>
                  {/* Product catalog selector */}
                  <div>
                    <select
                      className="input-field"
                      onChange={e => selectProduct(idx, e.target.value)}
                      value={it.productId || ''}
                      style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
                    >
                      <option value="">-- Catálogo de Inventario ({products.length}) --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} · ${Number(p.price).toFixed(2)} (Stock: {p.stock ?? 0})
                        </option>
                      ))}
                      <option value="">✍️ Ítem Manual / No registrado</option>
                    </select>
                    {matchedProd && (
                      <div style={{ fontSize: 10, color: '#2563eb', marginTop: 2 }}>
                        Stock actual: <strong>{matchedProd.stock ?? 0}</strong> unidades
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <input
                      placeholder="Descripción o nombre del ítem *"
                      value={it.description}
                      onChange={e => {
                        const next = [...items];
                        next[idx].description = e.target.value;
                        setItems(next);
                      }}
                      required
                      style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Cant."
                      value={it.quantity}
                      onChange={e => {
                        const next = [...items];
                        next[idx].quantity = Math.max(1, Number(e.target.value));
                        setItems(next);
                      }}
                      style={{ width: '100%', fontSize: 12, padding: '6px 8px', textAlign: 'center' }}
                    />
                  </div>

                  {/* Unit Price (Editable!) */}
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="P. Unit"
                      value={it.unitPrice}
                      onChange={e => {
                        const next = [...items];
                        next[idx].unitPrice = Math.max(0, Number(e.target.value));
                        setItems(next);
                      }}
                      title="Precio unitario (editable)"
                      style={{ width: '100%', fontSize: 12, padding: '6px 8px', textAlign: 'right' }}
                    />
                  </div>

                  {/* Discount */}
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Desc. $"
                      value={it.discount || ''}
                      onChange={e => {
                        const next = [...items];
                        next[idx].discount = Math.max(0, Number(e.target.value));
                        setItems(next);
                      }}
                      title="Descuento en $"
                      style={{ width: '100%', fontSize: 12, padding: '6px 8px', textAlign: 'right' }}
                    />
                  </div>

                  {/* Total line */}
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: '#0f172a' }}>
                    ${(it.quantity * it.unitPrice - (it.discount || 0)).toFixed(2)}
                  </div>

                  {/* Delete */}
                  <div>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                      style={{ background: 'transparent', border: 0, color: items.length <= 1 ? '#cbd5e1' : '#dc2626', cursor: items.length <= 1 ? 'not-allowed' : 'pointer', fontSize: 14 }}
                      title="Quitar ítem"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* TOTALS & TERMS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Días de Validez de la Proforma:</span>
                <input
                  type="number"
                  min="1"
                  value={validDays}
                  onChange={e => setValidDays(Math.max(1, Number(e.target.value)))}
                  style={{ width: 120, fontSize: 12, padding: '5px 8px', display: 'block', marginTop: 3 }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Términos y Condiciones Comerciales:</span>
                <textarea
                  className="input-field"
                  rows={2}
                  value={terms}
                  onChange={e => setTerms(e.target.value)}
                  style={{ width: '100%', fontSize: 12 }}
                />
              </label>

              <label style={{ display: 'block' }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Notas adicionales / Tiempos de entrega:</span>
                <input
                  placeholder="Ej. Tiempo de entrega: 2 días laborables..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ width: '100%', fontSize: 12 }}
                />
              </label>
            </div>

            {/* Calculations Box */}
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, fontSize: 13, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Subtotal:</span>
                <strong>${subtotal.toFixed(2)}</strong>
              </div>
              {totalDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#dc2626' }}>
                  <span>Descuento aplicado:</span>
                  <strong>-${totalDiscount.toFixed(2)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>IVA (15%):</span>
                <strong>${tax.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: 8, fontSize: 16, fontWeight: 800, color: '#2563eb' }}>
                <span>TOTAL:</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="primary-action" disabled={saving} style={{ padding: '10px 22px', fontSize: 13 }}>
              {saving ? 'Guardando...' : (isEditing ? '✓ Actualizar Cotización' : '✓ Guardar Cotización')}
            </button>
            <button type="button" className="secondary-action" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// 3. PRINT QUOTE MODAL (A4 FORMAL QUOTATION WITH PUBLIC LINK & WHATSAPP)
// =========================================================================
function PrintQuoteModal({
  quote,
  onClose,
  onCopyLink
}: {
  quote: Any;
  onClose: () => void;
  onCopyLink: () => void;
}) {
  const storeName = localStorage.tenantName || 'Fixme Tienda';
  const orderNum = quote.quote_number || quote.quoteNumber;
  const items = quote.items || [];
  const token = quote.public_token || quote.publicToken || quote.id;
  const publicUrl = `${window.location.origin}/#quote/${token}`;
  const rawPhone = (quote.customer_phone || quote.customerPhone || '').replace(/[^0-9]/g, '');
  const waText = encodeURIComponent(`Hola ${quote.customer_name || quote.customerName || 'Estimado cliente'}, le adjuntamos su cotización oficial #${orderNum} por un total de $${Number(quote.total).toFixed(2)}. Puede revisarla y aprobarla en línea aquí: ${publicUrl}`);
  const waHref = rawPhone ? `https://wa.me/${rawPhone}?text=${waText}` : `https://wa.me/?text=${waText}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 780, width: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-head no-print">
          <h3>📄 Proforma Oficial #{orderNum}</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        {/* TOP SHARING BAR (NO PRINT) */}
        <div className="no-print" style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: 8, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Enlace de Aprobación para el Cliente:</span>
          <input
            type="text"
            readOnly
            value={publicUrl}
            style={{ flex: 1, minWidth: 200, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
          />
          <button
            type="button"
            className="primary-action"
            style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={onCopyLink}
          >
            📋 Copiar Enlace
          </button>
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="primary-action"
            style={{ background: '#16a34a', textDecoration: 'none', padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            💬 Enviar WhatsApp
          </a>
          <a
            href={`#quote/${token}`}
            target="_blank"
            rel="noreferrer"
            className="secondary-action"
            style={{ padding: '6px 12px', fontSize: 12, textDecoration: 'none' }}
          >
            🔗 Ver como Cliente
          </a>
        </div>

        {/* PRINTABLE A4 CONTENT */}
        <div id="printable-quote" style={{ background: '#fff', padding: '24px', borderRadius: 8, color: '#0f172a', fontFamily: 'system-ui, sans-serif', border: '1px solid #e2e8f0' }}>
          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2563eb', paddingBottom: 16, marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#1d4ed8' }}>{storeName}</h1>
              <div style={{ fontSize: 12, color: '#64748b' }}>COTIZACIÓN / PROFORMA COMERCIAL</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Ecuador · R.U.C.: 1790012345001</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>{orderNum}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Fecha: {new Date(quote.created_at || quote.createdAt).toLocaleDateString()}</div>
              <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
                Válido hasta: {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : '15 días'}
              </div>
            </div>
          </div>

          {/* CLIENT INFO */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12, border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div><strong>Cliente:</strong> {quote.customer_name || quote.customerName || 'Consumidor'}</div>
              <div><strong>C.I. / RUC:</strong> {quote.customer_id_number || quote.customerIdNumber || '9999999999999'}</div>
              <div><strong>Teléfono:</strong> {quote.customer_phone || quote.customerPhone || '-'}</div>
              <div><strong>Email:</strong> {quote.customer_email || quote.customerEmail || '-'}</div>
            </div>
          </div>

          {/* ITEMS TABLE */}
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Descripción</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Cant.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>P. Unit</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: Any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px' }}>{it.description}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{Number(it.quantity)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>${Number(it.unitPrice || it.unit_price).toFixed(2)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>${Number(it.lineTotal || it.line_total || it.quantity * (it.unitPrice || it.unit_price)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* TOTALS */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <div style={{ width: 220, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span>Subtotal:</span>
                <strong>${Number(quote.subtotal || 0).toFixed(2)}</strong>
              </div>
              {Number(quote.discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#dc2626' }}>
                  <span>Descuento:</span>
                  <strong>-${Number(quote.discount).toFixed(2)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span>IVA 15%:</span>
                <strong>${Number(quote.tax || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '2px solid #0f172a', fontSize: 15, fontWeight: 900 }}>
                <span>TOTAL:</span>
                <span style={{ color: '#2563eb' }}>${Number(quote.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* TERMS */}
          {quote.terms && (
            <div style={{ fontSize: 10, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: 10, marginBottom: 24 }}>
              <strong>Términos y Condiciones:</strong> {quote.terms}
            </div>
          )}

          {/* SIGNATURES */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 40, textAlign: 'center', fontSize: 11 }}>
            <div>
              <div style={{ borderTop: '1px solid #000', margin: '0 auto 4px', width: '70%' }} />
              <div>Firma Autorizada ({storeName})</div>
            </div>
            <div>
              <div style={{ borderTop: '1px solid #000', margin: '0 auto 4px', width: '70%' }} />
              <div>Aceptación de Cotización por Cliente</div>
            </div>
          </div>
        </div>

        <div className="modal-actions no-print" style={{ marginTop: 16 }}>
          <button type="button" className="btn-primary-sm" style={{ padding: '10px 16px' }} onClick={() => printTicketElement('printable-quote')}>
            🖨️ Imprimir Proforma
          </button>
          <button type="button" className="btn-secondary-sm" style={{ padding: '10px 16px' }} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 4. PUBLIC QUOTE VIEW PORTAL (#quote/:token)
// =========================================================================
export function PublicQuoteView({ token, onBack }: { token: string; onBack?: () => void; isLogged?: boolean }) {
  const [data, setData] = React.useState<Any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [approving, setApproving] = React.useState(false);
  const [approvedMsg, setApprovedMsg] = React.useState('');
  const [showDeUna, setShowDeUna] = React.useState(false);
  const [paidWithDeUna, setPaidWithDeUna] = React.useState<Any | null>(null);
  const [showPayphone, setShowPayphone] = React.useState(false);
  const [paidWithPayphone, setPaidWithPayphone] = React.useState<Any | null>(null);

  const load = React.useCallback(() => {
    fetch(`/api/public/quotes/${encodeURIComponent(token)}`)
      .then(async r => {
        if (r.ok) return r.json();
        const err = await r.json().catch(() => null);
        throw new Error(err?.message || 'Cotización no encontrada');
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'No se pudo cargar la cotización');
        setLoading(false);
      });
  }, [token]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await fetch(`/api/public/quotes/${encodeURIComponent(token)}/approve`, {
        method: 'POST'
      });
      if (res.ok) {
        setApprovedMsg('¡Has aprobado esta cotización! La tienda se pondrá en contacto contigo para coordinar el pago y entrega.');
        load();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'Error al aprobar.');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <h3 style={{ color: '#334155' }}>Cargando proforma...</h3>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 440, padding: 30, background: '#fff', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>⚠️</div>
          <h2 style={{ color: '#0f172a', margin: '0 0 8px' }}>Cotización No Disponible</h2>
          <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>{error || 'El enlace no es válido o ha expirado.'}</p>
          {onBack && (
            <button type="button" className="secondary-action" onClick={onBack}>
              ← Volver
            </button>
          )}
        </div>
      </div>
    );
  }

  const isApproved = data.status === 'APPROVED';
  const isConverted = data.status === 'CONVERTED';
  const store = data.store || {};
  const storePhone = (store.branch_phone || '').replace(/[^0-9]/g, '');
  const waContactUrl = storePhone
    ? `https://wa.me/${storePhone}?text=${encodeURIComponent(`Hola, tengo una consulta sobre la cotización #${data.quoteNumber}`)}`
    : '';

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '20px 12px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{ background: 'transparent', border: 0, color: '#2563eb', fontWeight: 600, cursor: 'pointer', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            ← Volver
          </button>
        )}

        {/* STATUS BANNER */}
        {approvedMsg && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '14px 16px', borderRadius: 12, marginBottom: 16, color: '#14532d', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🎉</span>
            <div>
              <strong>¡Cotización Aprobada con Éxito!</strong>
              <div style={{ fontSize: 13, marginTop: 2 }}>{approvedMsg}</div>
            </div>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          {/* STORE HEADER */}
          <div style={{ background: '#2563eb', color: '#fff', padding: '24px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Proforma Comercial
                </span>
                <h1 style={{ margin: '6px 0 2px', fontSize: 22, fontWeight: 800 }}>{store.store_name || 'Fixme Tienda'}</h1>
                <div style={{ fontSize: 12, opacity: 0.9 }}>{store.branch_name || 'Sucursal Principal'} · {store.branch_address || ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>#{data.quoteNumber}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>Emisión: {new Date(data.createdAt).toLocaleDateString()}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>Válido hasta: {data.validUntil ? new Date(data.validUntil).toLocaleDateString() : '15 días'}</div>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div style={{ padding: '20px' }}>
            {/* CLIENT */}
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 18, fontSize: 13 }}>
              <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Preparada para:</div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{data.customerName || 'Estimado Cliente'}</div>
              {data.customerPhone && <div style={{ color: '#64748b', fontSize: 12 }}>Tel: {data.customerPhone}</div>}
            </div>

            {/* ITEMS */}
            <h3 style={{ fontSize: 14, margin: '0 0 10px', color: '#0f172a' }}>Detalle de Productos / Servicios</h3>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 18 }}>
              {(data.items || []).map((it: Any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i === data.items.length - 1 ? 'none' : '1px solid #f1f5f9', fontSize: 13, alignItems: 'center' }}>
                  <div style={{ flex: 1, paddingRight: 10 }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{it.description}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Cant: {it.quantity} × ${Number(it.unitPrice).toFixed(2)}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    ${Number(it.lineTotal).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* TOTALS */}
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#64748b' }}>Subtotal:</span>
                <span>${Number(data.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(data.discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#dc2626' }}>
                  <span>Descuento:</span>
                  <span>-${Number(data.discount).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#64748b' }}>IVA (15%):</span>
                <span>${Number(data.tax || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 900, color: '#1d4ed8', borderTop: '1px solid #cbd5e1', paddingTop: 8 }}>
                <span>TOTAL A PAGAR:</span>
                <span>${Number(data.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* TERMS */}
            {data.terms && (
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 20, background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #f1f5f9' }}>
                <strong>Condiciones comerciales:</strong> {data.terms}
              </div>
            )}

            {/* ACTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!isApproved && !isConverted && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowDeUna(true)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: 15,
                      fontWeight: 800,
                      borderRadius: 10,
                      border: 0,
                      background: 'linear-gradient(135deg, #00a896 0%, #028090 100%)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 12px rgba(0, 168, 150, 0.3)'
                    }}
                  >
                    <span style={{ fontSize: 18 }}>📱</span>
                    <span>PAGAR CON DEUNA QR (${Number(data.total).toFixed(2)})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPayphone(true)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: 15,
                      fontWeight: 800,
                      borderRadius: 10,
                      border: 0,
                      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)'
                    }}
                  >
                    <span style={{ fontSize: 18 }}>💳</span>
                    <span>PAGAR CON TARJETA (PAYPHONE) (${Number(data.total).toFixed(2)})</span>
                  </button>

                  <button
                    type="button"
                    className="primary-action"
                    disabled={approving}
                    onClick={handleApprove}
                    style={{ width: '100%', padding: '12px', fontSize: 14, justifyContent: 'center', background: '#16a34a' }}
                  >
                    {approving ? 'Procesando Aprobación...' : '✓ Solo Aprobar Cotización (Pagar después)'}
                  </button>
                </div>
              )}

              {paidWithDeUna && (
                <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', padding: '12px', borderRadius: 8, textAlign: 'center', color: '#065f46', fontSize: 13 }}>
                  <strong>✅ ¡Pago recibido exitosamente por DeUna!</strong>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    Código de Autorización: <b>{paidWithDeUna.authorizationCode}</b> · Ref: {paidWithDeUna.transactionId}
                  </div>
                </div>
              )}

              {paidWithPayphone && (
                <div style={{ background: '#fff7ed', border: '1px solid #fdba74', padding: '12px', borderRadius: 8, textAlign: 'center', color: '#c2410c', fontSize: 13 }}>
                  <strong>✅ ¡Pago con Tarjeta ({paidWithPayphone.cardBrand}) recibido exitosamente!</strong>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    Tarjeta: **** <b>{paidWithPayphone.cardLastDigits}</b> · Código de Autorización: <b>{paidWithPayphone.authorizationCode}</b>
                  </div>
                </div>
              )}

              {isApproved && !isConverted && !paidWithDeUna && !paidWithPayphone && (
                <div style={{ background: '#dcfce7', padding: '12px', borderRadius: 8, textAlign: 'center', color: '#15803d', fontWeight: 700, fontSize: 13 }}>
                  ✓ Cotización aprobada. La tienda te contactará pronto para coordinar la entrega o facturación.
                </div>
              )}

              {isConverted && (
                <div style={{ background: '#f3e8ff', padding: '12px', borderRadius: 8, textAlign: 'center', color: '#7e22ce', fontWeight: 700, fontSize: 13 }}>
                  🛒 Esta cotización ya ha sido facturada como venta en tienda.
                </div>
              )}

              {waContactUrl && (
                <a
                  href={waContactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="secondary-action"
                  style={{ width: '100%', padding: '12px', fontSize: 13, justifyContent: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  💬 Consultar dudas por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        {/* DEUNA QR MODAL */}
        {showDeUna && (
          <DeUnaModal
            amount={Number(data.total)}
            isPublicQuote={true}
            quoteToken={token}
            customerName={data.customerName}
            customerPhone={data.customerPhone}
            onSuccess={(res) => {
              setShowDeUna(false);
              setPaidWithDeUna(res);
              setApprovedMsg(`¡Pago de $${res.amount.toFixed(2)} registrado con éxito con DeUna QR! Código de autorización: ${res.authorizationCode}.`);
              load();
            }}
            onClose={() => setShowDeUna(false)}
          />
        )}

        {/* PAYPHONE CARDS MODAL */}
        {showPayphone && (
          <PayphoneModal
            amount={Number(data.total)}
            isPublicQuote={true}
            quoteToken={token}
            customerEmail={data.customerEmail}
            customerPhone={data.customerPhone}
            onSuccess={(res) => {
              setShowPayphone(false);
              setPaidWithPayphone(res);
              setApprovedMsg(`¡Pago de $${res.amount.toFixed(2)} registrado con éxito con Tarjeta Payphone (${res.cardBrand} **** ${res.cardLastDigits})! Código de autorización: ${res.authorizationCode}.`);
              load();
            }}
            onClose={() => setShowPayphone(false)}
          />
        )}
      </div>
    </div>
  );
}
