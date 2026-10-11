import React from 'react';
import {
  Package,
  Plus,
  Search,
  Truck,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Eye,
  CheckCircle2,
  Trash2,
  Edit2
} from 'lucide-react';

type Any = Record<string, any>;

interface PurchasesModuleProps {
  api: (url: string, opt?: RequestInit) => Promise<Response>;
}

export function PurchasesModule({ api }: PurchasesModuleProps) {
  const [tab, setTab] = React.useState<'purchases' | 'suppliers' | 'kardex'>('purchases');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  // Data lists
  const [purchases, setPurchases] = React.useState<Any[]>([]);
  const [suppliers, setSuppliers] = React.useState<Any[]>([]);
  const [products, setProducts] = React.useState<Any[]>([]);

  // Modals
  const [showPurchaseModal, setShowPurchaseModal] = React.useState(false);
  const [showSupplierModal, setShowSupplierModal] = React.useState(false);
  const [selectedPurchase, setSelectedPurchase] = React.useState<Any | null>(null);
  const [selectedKardexProduct, setSelectedKardexProduct] = React.useState<string>('');
  const [kardexData, setKardexData] = React.useState<Any | null>(null);

  // Search
  const [searchTerm, setSearchTerm] = React.useState('');

  // Form states
  const [supplierForm, setSupplierForm] = React.useState({
    id: '',
    name: '',
    tax_id: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  const [purchaseForm, setPurchaseForm] = React.useState({
    supplierId: '',
    invoiceNumber: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    paymentStatus: 'PAID',
    notes: '',
    items: [{ productId: '', quantity: 1, unitCost: '0.00' }]
  });

  // Load initial data
  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [resPurchases, resSuppliers, resProducts] = await Promise.all([
        api('/api/purchases').then(r => r.ok ? r.json() : []),
        api('/api/suppliers').then(r => r.ok ? r.json() : []),
        api('/api/products').then(r => r.ok ? r.json() : [])
      ]);
      setPurchases(Array.isArray(resPurchases) ? resPurchases : []);
      setSuppliers(Array.isArray(resSuppliers) ? resSuppliers : []);
      setProducts(Array.isArray(resProducts) ? resProducts : []);
    } catch (e: any) {
      setError(e.message || 'Error al cargar compras');
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Kardex when product changes
  React.useEffect(() => {
    if (!selectedKardexProduct) {
      setKardexData(null);
      return;
    }
    api(`/api/kardex/${selectedKardexProduct}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setKardexData(d))
      .catch(() => setKardexData(null));
  }, [selectedKardexProduct, api]);

  // Save Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const method = supplierForm.id ? 'PUT' : 'POST';
      const url = supplierForm.id ? `/api/suppliers/${supplierForm.id}` : '/api/suppliers';
      const res = await api(url, {
        method,
        body: JSON.stringify(supplierForm)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Error al guardar proveedor');
      }
      setSuccess('Proveedor guardado exitosamente');
      setShowSupplierModal(false);
      setSupplierForm({ id: '', name: '', tax_id: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Add Item in Purchase Form
  const addItemRow = () => {
    setPurchaseForm(f => ({
      ...f,
      items: [...f.items, { productId: '', quantity: 1, unitCost: '0.00' }]
    }));
  };

  const removeItemRow = (idx: number) => {
    setPurchaseForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx)
    }));
  };

  const updateItemRow = (idx: number, field: string, val: any) => {
    setPurchaseForm(f => ({
      ...f,
      items: f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it)
    }));
  };

  // Calculate Purchase Totals
  const subtotal = purchaseForm.items.reduce((acc, it) => {
    const q = Number(it.quantity) || 0;
    const c = Number(it.unitCost) || 0;
    return acc + (q * c);
  }, 0);

  // Save Purchase
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (purchaseForm.items.length === 0 || !purchaseForm.items.some(it => it.productId)) {
        throw new Error('Debe seleccionar al menos un producto válido');
      }

      const body = {
        supplierId: purchaseForm.supplierId || null,
        invoiceNumber: purchaseForm.invoiceNumber,
        purchaseDate: purchaseForm.purchaseDate,
        paymentStatus: purchaseForm.paymentStatus,
        subtotal,
        taxAmount: 0,
        total: subtotal,
        notes: purchaseForm.notes,
        items: purchaseForm.items
          .filter(it => it.productId)
          .map(it => ({
            productId: it.productId,
            quantity: Number(it.quantity) || 1,
            unitCost: Number(it.unitCost) || 0
          }))
      };

      const res = await api('/api/purchases', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Error al procesar la compra');
      }

      setSuccess('Compra registrada con éxito y stock actualizado en Kardex');
      setShowPurchaseModal(false);
      setPurchaseForm({
        supplierId: '',
        invoiceNumber: '',
        purchaseDate: new Date().toISOString().slice(0, 10),
        paymentStatus: 'PAID',
        notes: '',
        items: [{ productId: '', quantity: 1, unitCost: '0.00' }]
      });
      loadData();
      setTimeout(() => setSuccess(''), 3500);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Filtered purchases
  const filteredPurchases = purchases.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      (p.invoice_number || '').toLowerCase().includes(term) ||
      (p.supplier_name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1300, margin: '0 auto' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={26} color="var(--primary)" /> Compras & Kardex de Inventario
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13.5 }}>
            Registra facturas de proveedores, controla entradas de mercadería y audita el Kardex de cada producto.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              setSupplierForm({ id: '', name: '', tax_id: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
              setShowSupplierModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Building2 size={16} /> + Nuevo Proveedor
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => setShowPurchaseModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> + Registrar Compra
          </button>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#ecfdf5', border: '1px solid #34d399', color: '#065f46', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {success}
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setTab('purchases')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: tab === 'purchases' ? 700 : 500,
            borderBottom: tab === 'purchases' ? '3px solid var(--primary)' : '3px solid transparent',
            color: tab === 'purchases' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          📋 Historial de Compras ({purchases.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('suppliers')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: tab === 'suppliers' ? 700 : 500,
            borderBottom: tab === 'suppliers' ? '3px solid var(--primary)' : '3px solid transparent',
            color: tab === 'suppliers' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          🏢 Directorio de Proveedores ({suppliers.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('kardex')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: tab === 'kardex' ? 700 : 500,
            borderBottom: tab === 'kardex' ? '3px solid var(--primary)' : '3px solid transparent',
            color: tab === 'kardex' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          📈 Auditoría de Kardex por Producto
        </button>
      </div>

      {/* TAB 1: PURCHASES */}
      {tab === 'purchases' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por # de factura o proveedor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 36, width: '100%' }}
              />
            </div>
          </div>

          {filteredPurchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
              <Package size={44} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
              <h3>No se encontraron compras registradas</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Registra las facturas de tus proveedores para alimentar el stock automáticamente.</p>
              <button type="button" className="primary-action" onClick={() => setShowPurchaseModal(true)} style={{ marginTop: 12 }}>
                + Registrar Primera Compra
              </button>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-subtle)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 16px' }}>Factura / N°</th>
                    <th style={{ padding: '12px 16px' }}>Fecha</th>
                    <th style={{ padding: '12px 16px' }}>Proveedor</th>
                    <th style={{ padding: '12px 16px' }}>Ítems</th>
                    <th style={{ padding: '12px 16px' }}>Total ($)</th>
                    <th style={{ padding: '12px 16px' }}>Estado</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                        {p.invoice_number || 'S/N'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                        {p.purchase_date}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <strong>{p.supplier_name || 'Proveedor General'}</strong>
                        {p.supplier_tax_id && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>RUC: {p.supplier_tax_id}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: 'var(--surface-subtle)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                          {p.items_count} productos
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--primary)' }}>
                        ${Number(p.total || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: p.payment_status === 'PAID' ? '#ecfdf5' : '#fffbeb',
                          color: p.payment_status === 'PAID' ? '#059669' : '#b45309'
                        }}>
                          {p.payment_status === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="secondary-action"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={async () => {
                            const res = await api(`/api/purchases/${p.id}`).then(r => r.json());
                            setSelectedPurchase(res);
                          }}
                        >
                          <Eye size={13} style={{ marginRight: 4 }} /> Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUPPLIERS */}
      {tab === 'suppliers' && (
        <div>
          {suppliers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
              <Building2 size={44} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
              <h3>Aún no has registrado proveedores</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Guarda los datos de tus distribuidores de repuestos, accesorios y herramientas.</p>
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  setSupplierForm({ id: '', name: '', tax_id: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
                  setShowSupplierModal(true);
                }}
                style={{ marginTop: 12 }}
              >
                + Registrar Primer Proveedor
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {suppliers.map(s => (
                <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{s.name}</h3>
                      {s.tax_id && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>RUC / ID: {s.tax_id}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierForm({
                          id: s.id,
                          name: s.name,
                          tax_id: s.tax_id || '',
                          contact_name: s.contact_name || '',
                          phone: s.phone || '',
                          email: s.email || '',
                          address: s.address || '',
                          notes: s.notes || ''
                        });
                        setShowSupplierModal(true);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>

                  <div style={{ fontSize: 12.5, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {s.contact_name && <div>👤 Contacto: <strong>{s.contact_name}</strong></div>}
                    {s.phone && <div>📞 Tel: <strong>{s.phone}</strong></div>}
                    {s.email && <div>✉️ Email: <strong>{s.email}</strong></div>}
                    {s.address && <div>📍 Dirección: {s.address}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: KARDEX */}
      {tab === 'kardex' && (
        <div>
          <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>
              Selecciona el Producto para ver su Auditoría de Movimientos (Kardex):
            </label>
            <select
              value={selectedKardexProduct}
              onChange={e => setSelectedKardexProduct(e.target.value)}
              style={{ width: '100%', maxWidth: 450, padding: '8px 12px' }}
            >
              <option value="">-- Elige un producto o repuesto --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku || 'S/N'}) - Stock actual: {p.stock}
                </option>
              ))}
            </select>
          </div>

          {kardexData && (
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px' }}>{kardexData.name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>SKU: {kardexData.sku} | Costo Referencial: ${Number(kardexData.purchase_price || 0).toFixed(2)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Stock en Bodega</span>
                  <strong style={{ fontSize: 22, color: 'var(--primary)' }}>{kardexData.stock} unidades</strong>
                </div>
              </div>

              {kardexData.movements && kardexData.movements.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-subtle)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 16px' }}>Fecha</th>
                      <th style={{ padding: '10px 16px' }}>Tipo</th>
                      <th style={{ padding: '10px 16px' }}>Cantidad</th>
                      <th style={{ padding: '10px 16px' }}>Motivo / Documento</th>
                      <th style={{ padding: '10px 16px' }}>Costo Unitario</th>
                      <th style={{ padding: '10px 16px' }}>Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kardexData.movements.map((m: Any) => {
                      const isEntry = m.type === 'IN';
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                            {new Date(m.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: isEntry ? '#ecfdf5' : '#fef2f2',
                              color: isEntry ? '#059669' : '#dc2626'
                            }}>
                              {isEntry ? '▲ ENTRADA' : '▼ SALIDA'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: 800, color: isEntry ? '#059669' : '#dc2626' }}>
                            {isEntry ? `+${m.quantity}` : `-${m.quantity}`}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            {m.reason || (m.reference_type ? `Movimiento: ${m.reference_type}` : 'Ajuste')}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            ${Number(m.unit_cost || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                            {m.user_name || 'Sistema'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay movimientos registrados para este producto todavía.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: REGISTRAR COMPRA */}
      {showPurchaseModal && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 750 }}>
            <div className="modal-head">
              <h3>📦 Registrar Nueva Compra a Proveedor</h3>
              <button className="close-button" onClick={() => setShowPurchaseModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSavePurchase}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <label>
                  <span>Proveedor:</span>
                  <select
                    value={purchaseForm.supplierId}
                    onChange={e => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}
                  >
                    <option value="">-- Proveedor General / Ocasional --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.tax_id || 'S/N'})</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>N° de Factura / Comprobante:</span>
                  <input
                    placeholder="Ej. 001-002-0004523"
                    value={purchaseForm.invoiceNumber}
                    onChange={e => setPurchaseForm({ ...purchaseForm, invoiceNumber: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <label>
                  <span>Fecha de Compra:</span>
                  <input
                    type="date"
                    value={purchaseForm.purchaseDate}
                    onChange={e => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })}
                    required
                  />
                </label>

                <label>
                  <span>Estado de Pago:</span>
                  <select
                    value={purchaseForm.paymentStatus}
                    onChange={e => setPurchaseForm({ ...purchaseForm, paymentStatus: e.target.value })}
                  >
                    <option value="PAID">💵 Pagado (Contado)</option>
                    <option value="PENDING">⏳ Pendiente (Crédito)</option>
                  </select>
                </label>
              </div>

              {/* PRODUCT ITEMS IN PURCHASE */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Ítems de la Compra:</span>
                  <button type="button" className="secondary-action" onClick={addItemRow} style={{ padding: '4px 10px', fontSize: 12 }}>
                    + Agregar Fila
                  </button>
                </div>

                {purchaseForm.items.map((row, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.2fr auto', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <select
                      value={row.productId}
                      onChange={e => updateItemRow(idx, 'productId', e.target.value)}
                      required
                    >
                      <option value="">-- Seleccionar Producto --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku || 'S/N'})</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      placeholder="Cant."
                      value={row.quantity}
                      onChange={e => updateItemRow(idx, 'quantity', e.target.value)}
                      required
                    />

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Costo U."
                      value={row.unitCost}
                      onChange={e => updateItemRow(idx, 'unitCost', e.target.value)}
                      required
                    />

                    {purchaseForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* TOTAL BOX */}
              <div style={{ background: 'var(--surface-subtle)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 600 }}>Total de la Compra:</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>${subtotal.toFixed(2)}</span>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowPurchaseModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action">
                  ✓ Confirmar y Actualizar Stock en Kardex
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROVEEDOR */}
      {showSupplierModal && (
        <div className="modal-overlay" onClick={() => setShowSupplierModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-head">
              <h3>🏢 {supplierForm.id ? 'Editar' : 'Nuevo'} Proveedor</h3>
              <button className="close-button" onClick={() => setShowSupplierModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveSupplier}>
              <label>
                <span>Razón Social / Nombre Comercial *:</span>
                <input
                  required
                  placeholder="Ej. Distribuidora Tecnológica del Guayas"
                  value={supplierForm.name}
                  onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span>RUC / Cédula / Tax ID:</span>
                  <input
                    placeholder="Ej. 0992345678001"
                    value={supplierForm.tax_id}
                    onChange={e => setSupplierForm({ ...supplierForm, tax_id: e.target.value })}
                  />
                </label>
                <label>
                  <span>Persona de Contacto:</span>
                  <input
                    placeholder="Ej. Ing. Carlos Pérez"
                    value={supplierForm.contact_name}
                    onChange={e => setSupplierForm({ ...supplierForm, contact_name: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span>Teléfono / WhatsApp:</span>
                  <input
                    placeholder="Ej. 0991234567"
                    value={supplierForm.phone}
                    onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  />
                </label>
                <label>
                  <span>Correo Electrónico:</span>
                  <input
                    type="email"
                    placeholder="ventas@proveedor.com"
                    value={supplierForm.email}
                    onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Dirección / Ciudad:</span>
                <input
                  placeholder="Ej. Guayaquil, Cdla. Alborada"
                  value={supplierForm.address}
                  onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
                />
              </label>

              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button type="button" className="secondary-action" onClick={() => setShowSupplierModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action">
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE COMPRA */}
      {selectedPurchase && (
        <div className="modal-overlay" onClick={() => setSelectedPurchase(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-head">
              <h3>📄 Compra Factura #{selectedPurchase.invoice_number || 'S/N'}</h3>
              <button className="close-button" onClick={() => setSelectedPurchase(null)}>✕</button>
            </div>

            <div style={{ marginBottom: 14, fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>Proveedor: <strong>{selectedPurchase.supplier_name || 'N/A'}</strong></div>
              <div>Fecha: <strong>{selectedPurchase.purchase_date}</strong></div>
              <div>Estado de Pago: <strong>{selectedPurchase.payment_status}</strong></div>
              <div>Sucursal: <strong>{selectedPurchase.branch_name || 'Principal'}</strong></div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>DETALLE DE PRODUCTOS INGRESADOS:</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 8 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: 6 }}>Producto</th>
                    <th style={{ padding: 6 }}>Cant.</th>
                    <th style={{ padding: 6 }}>Costo Unit.</th>
                    <th style={{ padding: 6 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchase.items?.map((it: Any) => (
                    <tr key={it.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: 6 }}>{it.product_name} ({it.product_sku || 'S/N'})</td>
                      <td style={{ padding: 6 }}>{it.quantity}</td>
                      <td style={{ padding: 6 }}>${Number(it.unit_cost || 0).toFixed(2)}</td>
                      <td style={{ padding: 6, fontWeight: 700 }}>${Number(it.total_cost || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 800, color: 'var(--primary)', marginBottom: 14 }}>
              Total: ${Number(selectedPurchase.total || 0).toFixed(2)}
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-action" onClick={() => setSelectedPurchase(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

