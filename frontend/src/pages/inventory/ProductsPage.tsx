import React from 'react';
import { Any, getBranchId } from '../../sharedConfig';
import { BarcodeTagsModal, CsvImportModal } from '../../commercialModals';
import { compressImageFile } from '../../imageUtils';
import { PageHeader, KpiStrip, FilterTabs, StatusBadge } from '../../sharedLayout';
import { SkeletonTable } from '../../components/ui/ModernUiKit';
import { Search, Package, Plus, Upload, Download, Tag, Camera } from 'lucide-react';

export function Products({api,role,branchId: propBranchId}:{api:(u:string,o?:RequestInit)=>Promise<Response>,role:string,branchId?: string}){
const branchId = propBranchId || getBranchId();
  const [rows, setRows] = React.useState<Any[]>([]);
  const [cats, setCats] = React.useState<Any[]>([]);
  const [catName, setCatName] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [stockFilter, setStockFilter] = React.useState<'ALL'|'IN_STOCK'|'LOW_STOCK'|'OUT_OF_STOCK'>('ALL');
  const [showForm, setShowForm] = React.useState(false);
  const [editItem, setEditItem] = React.useState<Any|null>(null);
  const [showBarcodes, setShowBarcodes] = React.useState(false);
  const [showCsvImport, setShowCsvImport] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // Form state
  const [form, setForm] = React.useState({
    sku: '',
    name: '',
    barcode: '',
    minStock: '5',
    stock: '10',
    purchasePrice: '0',
    price: '0',
    extraCost: '0',
    marginPercent: '30',
    categoryId: '',
    imageUrl: ''
  });

  const canManage = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'].includes(role);
  const canViewCosts = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(role);

  const load = React.useCallback(() => {
    api(`/api/products?branchId=${branchId}`).then(r => r.ok ? r.json() : []).then(setRows);
    api('/api/categories').then(r => r.ok ? r.json() : []).then(setCats);
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  // Live margin/price calculator for new product
  const handleCostChange = (costStr: string) => {
    const cost = parseFloat(costStr) || 0;
    const margin = parseFloat(form.marginPercent) || 0;
    const calculatedPrice = (cost * (1 + margin / 100)).toFixed(2);
    setForm(f => ({ ...f, purchasePrice: costStr, price: calculatedPrice }));
  };

  const handleMarginChange = (marginStr: string) => {
    const margin = parseFloat(marginStr) || 0;
    const cost = parseFloat(form.purchasePrice) || 0;
    const calculatedPrice = (cost * (1 + margin / 100)).toFixed(2);
    setForm(f => ({ ...f, marginPercent: marginStr, price: calculatedPrice }));
  };

  const handlePriceChange = (priceStr: string) => {
    const price = parseFloat(priceStr) || 0;
    const cost = parseFloat(form.purchasePrice) || 0;
    const margin = cost > 0 ? (((price - cost) / cost) * 100).toFixed(1) : '0';
    setForm(f => ({ ...f, price: priceStr, marginPercent: margin }));
  };

  const applyMarginPreset = (pct: number) => {
    const cost = parseFloat(form.purchasePrice) || 0;
    const calculatedPrice = (cost * (1 + pct / 100)).toFixed(2);
    setForm(f => ({ ...f, marginPercent: String(pct), price: calculatedPrice }));
  };

  // Create product
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api(`/api/products?branchId=${branchId}`, {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        stock: Number(form.stock),
        minStock: Number(form.minStock || 5),
        barcode: form.barcode.trim() || null,
        price: Number(form.price),
        purchasePrice: Number(form.purchasePrice),
        extraCost: Number(form.extraCost),
        marginPercent: Number(form.marginPercent),
        imageUrl: form.imageUrl?.trim() || null
      })
    });
    setBusy(false);
    if (r.ok) {
      setMsg('Producto registrado exitosamente');
      setForm({ sku: '', name: '', barcode: '', minStock: '5', stock: '10', purchasePrice: '0', price: '0', extraCost: '0', marginPercent: '30', categoryId: '', imageUrl: '' });
      setShowForm(false);
      load();
    } else {
      setMsg('No se pudo crear el producto. Verifica SKU único.');
    }
  }

  // Update product via modal
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setBusy(true);
    const res = await api(`/api/products/${editItem.id}?branchId=${branchId}`, {
      method: 'PUT',
      body: JSON.stringify({
        sku: editItem.sku,
        name: editItem.name,
        barcode: editItem.barcode ? editItem.barcode.trim() : null,
        minStock: Number(editItem.min_stock ?? editItem.minStock ?? 5),
        stock: Number(editItem.stock || 0),
        price: Number(editItem.price || 0),
        purchasePrice: Number(editItem.purchase_price ?? editItem.purchasePrice ?? 0),
        marginPercent: Number(editItem.margin_percent ?? editItem.marginPercent ?? 0),
        extraCost: Number(editItem.extra_cost ?? editItem.extraCost ?? 0),
        categoryId: editItem.category_id || editItem.categoryId || null,
        imageUrl: (editItem.imageUrl || editItem.image_url || '').trim() || null
      })
    });
    setBusy(false);
    if (res.ok) {
      setMsg('Producto actualizado correctamente');
      setEditItem(null);
      load();
    } else {
      setMsg('Error al actualizar el producto');
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    const r = await api('/api/categories', { method: 'POST', body: JSON.stringify({ name: catName.trim() }) });
    if (r.ok) {
      setCatName('');
      load();
    }
  }

  const exportCsv = () => {
    if (!rows.length) {
      alert('No hay productos para exportar');
      return;
    }
    const headers = [
      'SKU',
      'Nombre',
      'CodigoBarras',
      'Stock',
      'StockMinimo',
      ...(canViewCosts ? ['CostoCompra'] : []),
      'PrecioPVP',
      'Categoria'
    ];
    const lines = rows.map(p => [
      `"${p.sku || ''}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.barcode || ''}"`,
      p.stock || 0,
      p.min_stock ?? p.minStock ?? 5,
      ...(canViewCosts ? [p.purchase_price ?? p.purchasePrice ?? 0] : []),
      p.price || 0,
      `"${(cats.find(c => c.id === p.category_id || c.id === p.categoryId)?.name || '').replace(/"/g, '""')}"`
    ].join(','));
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...lines].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `inventario_fixme_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stock and financial calculations
  const totalUnits = rows.reduce((acc, p) => acc + Number(p.stock || 0), 0);
  const totalCostValue = rows.reduce((acc, p) => acc + (Number(p.stock || 0) * Number(p.purchase_price ?? p.purchasePrice ?? 0)), 0);
  const totalRetailValue = rows.reduce((acc, p) => acc + (Number(p.stock || 0) * Number(p.price || 0)), 0);
  const potentialProfit = Math.max(0, totalRetailValue - totalCostValue);
  const projectedMargin = totalRetailValue > 0 ? ((potentialProfit / totalRetailValue) * 100) : 0;
  const lowStockCount = rows.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.min_stock ?? p.minStock ?? 5)).length;
  const outOfStockCount = rows.filter(p => Number(p.stock) <= 0).length;

  const filtered = rows.filter(r => {
    const q = query.toLowerCase().trim();
    const matchQuery = !q || `${r.name} ${r.sku} ${r.barcode || ''}`.toLowerCase().includes(q);
    const matchCat = !category || r.category_id === category || r.categoryId === category;
    const minS = Number(r.min_stock ?? r.minStock ?? 5);
    const matchStock =
      stockFilter === 'ALL' ? true :
      stockFilter === 'IN_STOCK' ? Number(r.stock) > minS :
      stockFilter === 'LOW_STOCK' ? (Number(r.stock) > 0 && Number(r.stock) <= minS) :
      Number(r.stock) <= 0;
    return matchQuery && matchCat && matchStock;
  });

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Catálogo de productos, control de existencias y valorización"
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="secondary-action" onClick={exportCsv} title="Descargar inventario completo en formato CSV">
              <Download size={14} /> <span>Exportar CSV</span>
            </button>
            {canManage && (
              <>
                <button type="button" className="secondary-action" onClick={() => setShowCsvImport(true)} title="Importar masivamente productos desde archivo CSV">
                  <Upload size={14} /> <span>Importar CSV</span>
                </button>
                <button type="button" className="secondary-action" onClick={() => setShowBarcodes(true)} title="Generar e imprimir etiquetas de código de barras">
                  <Tag size={14} /> <span>Etiquetas</span>
                </button>
                <button className="primary-action" onClick={() => { setShowForm(!showForm); setMsg(''); }}>
                  <Plus size={16} /> <span>{showForm ? 'Cancelar' : 'Nuevo producto'}</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* FINANCIAL INVENTORY VALUATION KPIS */}
      <KpiStrip
        items={canViewCosts ? [
          {
            label: 'Total productos',
            value: rows.length,
            hint: `${totalUnits} unidades en stock`,
            active: stockFilter === 'ALL',
            onClick: () => setStockFilter('ALL')
          },
          {
            label: 'Inversión en stock',
            value: `$${totalCostValue.toFixed(2)}`,
            hint: 'Capital en costo'
          },
          {
            label: 'Valor comercial (PVP)',
            value: `$${totalRetailValue.toFixed(2)}`,
            hint: 'PVP proyectado'
          },
          {
            label: 'Margen promedio',
            value: `${projectedMargin.toFixed(1)}%`,
            hint: `+$${potentialProfit.toFixed(2)} ganancia`,
            tone: projectedMargin > 20 ? 'success' : 'default'
          }
        ] : [
          {
            label: 'Total productos',
            value: rows.length,
            hint: `${totalUnits} unidades en stock`,
            active: stockFilter === 'ALL',
            onClick: () => setStockFilter('ALL')
          },
          {
            label: 'Disponibles',
            value: rows.filter(r => Number(r.stock) > Number(r.min_stock ?? r.minStock ?? 5)).length,
            hint: 'En nivel óptimo',
            active: stockFilter === 'IN_STOCK',
            onClick: () => setStockFilter('IN_STOCK')
          },
          {
            label: 'Stock bajo',
            value: lowStockCount,
            hint: 'Requiere reposición',
            tone: lowStockCount > 0 ? 'warning' : 'default',
            active: stockFilter === 'LOW_STOCK',
            onClick: () => setStockFilter('LOW_STOCK')
          },
          {
            label: 'Agotados',
            value: outOfStockCount,
            hint: 'Sin existencias',
            tone: outOfStockCount > 0 ? 'danger' : 'default',
            active: stockFilter === 'OUT_OF_STOCK',
            onClick: () => setStockFilter('OUT_OF_STOCK')
          }
        ]}
      />

      {/* PRODUCT CREATION FORM WITH LIVE CALCULATOR */}
      {showForm && canManage && (
        <section className="product-editor panel">
          <div className="editor-heading">
            <div>
              <span className="eyebrow">NUEVO PRODUCTO</span>
              <h3>Registro de Artículo con Calculadora de Márgenes</h3>
              <p>Define costo y margen deseado para autocalcular el precio final de venta.</p>
            </div>
            <button className="close-button" onClick={() => setShowForm(false)}>✕</button>
          </div>

          <form onSubmit={add}>
            <div className="form-section">
              <h4>Datos Básicos</h4>
              <div className="form-grid">
                <label>Nombre del Producto *
                  <input
                    placeholder="Ej. Pantalla iPhone 13 OLED, Cable Tipo C 2m..."
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </label>
                <label>Código SKU / Referencia *
                  <input
                    placeholder="Ej. REP-IPH-13, CAB-001"
                    value={form.sku}
                    onChange={e => setForm({ ...form, sku: e.target.value })}
                    required
                  />
                </label>
                <label>Código de Barras (opcional)
                  <input
                    placeholder="Ej. 7861234567890 (Lector USB)"
                    value={form.barcode}
                    onChange={e => setForm({ ...form, barcode: e.target.value })}
                  />
                </label>
                <label>Categoría
                  <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">Sin categoría / General</option>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>Stock Inicial *
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                    required
                  />
                </label>
                <label>Stock Mínimo de Alerta *
                  <input
                    type="number"
                    min="1"
                    placeholder="5"
                    value={form.minStock}
                    onChange={e => setForm({ ...form, minStock: e.target.value })}
                    required
                  />
                </label>
                <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Foto del Producto (Visible en Catálogo Digital y Punto de Venta)
                  </label>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    {form.imageUrl ? (
                      <div style={{ position: 'relative', width: 90, height: 90, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0 }}>
                        <img src={form.imageUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                          title="Eliminar foto"
                          style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <label style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 120,
                        height: 90,
                        borderRadius: 10,
                        border: '2px dashed var(--border)',
                        background: 'var(--surface-2)',
                        cursor: 'pointer',
                        padding: 8,
                        textAlign: 'center',
                        gap: 4
                      }}>
                        <Camera size={20} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Subir foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const b64 = await compressImageFile(file, 800, 800, 0.75);
                                setForm(f => ({ ...f, imageUrl: b64 }));
                              } catch {
                                alert('Error al cargar la imagen');
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <input
                        placeholder="O pega aquí una URL de imagen (https://...)"
                        value={form.imageUrl}
                        onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                        style={{ fontSize: 12, padding: '7px 10px', width: '100%' }}
                      />
                      <small style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                        Sube una foto desde tu equipo o pega una URL directa. Se optimiza automáticamente para carga rápida en el catálogo.
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* LIVE PRICE & MARGIN CALCULATOR */}
            <div className="form-section" style={{ marginTop: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, color: '#1e293b' }}>Calculadora de Precios y Rentabilidad</h4>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center' }}>Presets de margen:</span>
                  {[20, 30, 50, 100].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyMarginPreset(pct)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      +{pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid">
                <label>Costo de Compra ($) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.purchasePrice}
                    onChange={e => handleCostChange(e.target.value)}
                    required
                  />
                  <small>Costo unitario del proveedor</small>
                </label>

                <label>Margen de Ganancia (%) *
                  <input
                    type="number"
                    step="0.1"
                    placeholder="30"
                    value={form.marginPercent}
                    onChange={e => handleMarginChange(e.target.value)}
                    required
                  />
                  <small>Porcentaje sobre el costo</small>
                </label>

                <label>Precio de Venta al Público (PVP $) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.price}
                    onChange={e => handlePriceChange(e.target.value)}
                    style={{ fontWeight: 800, color: '#3157d5', fontSize: '16px' }}
                    required
                  />
                  <small>Precio final mostrado al cliente</small>
                </label>
              </div>

              {/* LIVE PROFIT BADGE */}
              <div style={{ marginTop: '12px', display: 'flex', gap: '16px', alignItems: 'center', background: '#ecfdf5', padding: '10px 14px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <div>
                  <small style={{ color: '#065f46', display: 'block', fontWeight: 600 }}>Ganancia bruta por unidad vendida:</small>
                  <strong style={{ color: '#047857', fontSize: '18px' }}>
                    +${Math.max(0, (parseFloat(form.price) || 0) - (parseFloat(form.purchasePrice) || 0)).toFixed(2)}
                  </strong>
                </div>
                <div style={{ borderLeft: '1px solid #a7f3d0', paddingLeft: '14px' }}>
                  <small style={{ color: '#065f46', display: 'block', fontWeight: 600 }}>Ganancia estimada del lote ({form.stock} unids):</small>
                  <strong style={{ color: '#047857', fontSize: '18px' }}>
                    +${(Math.max(0, (parseFloat(form.price) || 0) - (parseFloat(form.purchasePrice) || 0)) * (Number(form.stock) || 0)).toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

            {/* QUICK CATEGORY CREATION */}
            <div className="category-create" style={{ marginTop: '14px' }}>
              <div>
                <b>¿Categoría nueva?</b>
                <span>Créala sin salir de este formulario.</span>
              </div>
              <input
                placeholder="Nombre de nueva categoría..."
                value={catName}
                onChange={e => setCatName(e.target.value)}
              />
              <button type="button" className="secondary-action" onClick={addCategory}>Crear categoría</button>
            </div>

            <div className="editor-footer">
              {msg && <span className="form-message">{msg}</span>}
              <button type="button" className="secondary-action" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="primary-action" disabled={busy}>
                {busy ? 'Guardando...' : '✓ Guardar Producto en Catálogo'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-head">
              <h3>✏️ Editar Producto</h3>
              <button className="close-button" onClick={() => setEditItem(null)}>✕</button>
            </div>

            <form onSubmit={saveEdit}>
              <div style={{ display: 'grid', gap: '12px' }}>
                <label>Nombre del Producto *
                  <input
                    value={editItem.name || ''}
                    onChange={e => setEditItem({ ...editItem, name: e.target.value })}
                    required
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label>SKU *
                    <input
                      value={editItem.sku || ''}
                      onChange={e => setEditItem({ ...editItem, sku: e.target.value })}
                      required
                    />
                  </label>
                  <label>Código de Barras
                    <input
                      placeholder="Lector USB / EAN"
                      value={editItem.barcode || ''}
                      onChange={e => setEditItem({ ...editItem, barcode: e.target.value })}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label>Stock Disponible *
                    <input
                      type="number"
                      min="0"
                      value={editItem.stock || 0}
                      onChange={e => setEditItem({ ...editItem, stock: e.target.value })}
                      required
                    />
                  </label>
                  <label>Stock Mínimo de Alerta *
                    <input
                      type="number"
                      min="1"
                      value={editItem.min_stock ?? editItem.minStock ?? 5}
                      onChange={e => setEditItem({ ...editItem, min_stock: e.target.value, minStock: e.target.value })}
                      required
                    />
                  </label>
                </div>

                <label>Categoría
                  <select
                    value={editItem.category_id || editItem.categoryId || ''}
                    onChange={e => setEditItem({ ...editItem, category_id: e.target.value, categoryId: e.target.value })}
                  >
                    <option value="">Sin categoría</option>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Foto del Producto (Visible en Catálogo Digital)
                  </label>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    {(editItem.imageUrl || editItem.image_url) ? (
                      <div style={{ position: 'relative', width: 80, height: 80, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0 }}>
                        <img src={editItem.imageUrl || editItem.image_url} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => setEditItem({ ...editItem, imageUrl: '', image_url: '' })}
                          title="Eliminar foto"
                          style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <label style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 100,
                        height: 80,
                        borderRadius: 10,
                        border: '2px dashed var(--border)',
                        background: 'var(--surface-2)',
                        cursor: 'pointer',
                        padding: 6,
                        textAlign: 'center',
                        gap: 3
                      }}>
                        <Camera size={18} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Subir foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const b64 = await compressImageFile(file, 800, 800, 0.75);
                                setEditItem({ ...editItem, imageUrl: b64, image_url: b64 });
                              } catch {
                                alert('Error al cargar la imagen');
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <input
                        placeholder="O URL de imagen (https://...)"
                        value={editItem.imageUrl || editItem.image_url || ''}
                        onChange={e => setEditItem({ ...editItem, imageUrl: e.target.value, image_url: e.target.value })}
                        style={{ fontSize: 12, padding: '7px 10px', width: '100%' }}
                      />
                      <small style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                        Sube una foto o pega una URL para el catálogo en línea.
                      </small>
                    </div>
                  </div>
                </div>

                {/* EDIT PRICE & COST CALCULATOR */}
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: canViewCosts ? '1fr 1fr' : '1fr', gap: '10px' }}>
                    {canViewCosts && (
                      <label>Costo de Compra ($)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editItem.purchase_price ?? editItem.purchasePrice ?? 0}
                          onChange={e => {
                            const cost = parseFloat(e.target.value) || 0;
                            const currentPvp = parseFloat(editItem.price) || 0;
                            const margin = cost > 0 ? (((currentPvp - cost) / cost) * 100).toFixed(1) : '0';
                            setEditItem({ ...editItem, purchase_price: e.target.value, purchasePrice: e.target.value, margin_percent: margin });
                          }}
                        />
                      </label>
                    )}

                    <label>Precio Venta (PVP $)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editItem.price || 0}
                        onChange={e => {
                          const pvp = parseFloat(e.target.value) || 0;
                          const cost = parseFloat(editItem.purchase_price ?? editItem.purchasePrice ?? 0) || 0;
                          const margin = cost > 0 ? (((pvp - cost) / cost) * 100).toFixed(1) : '0';
                          setEditItem({ ...editItem, price: e.target.value, margin_percent: margin });
                        }}
                        style={{ fontWeight: 800, color: '#3157d5' }}
                        required
                      />
                    </label>
                  </div>

                  {canViewCosts && (
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#047857', fontWeight: 700 }}>
                      <span>Ganancia unitaria: +${Math.max(0, (parseFloat(editItem.price) || 0) - (parseFloat(editItem.purchase_price ?? editItem.purchasePrice ?? 0) || 0)).toFixed(2)}</span>
                      <span>Margen: {editItem.margin_percent || '0'}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                <button type="button" className="secondary-action" style={{ flex: 1 }} onClick={() => setEditItem(null)}>
                  Cancelar
                </button>
                <button className="primary-action" style={{ flex: 1 }} disabled={busy}>
                  {busy ? 'Guardando...' : '✓ Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATALOG TOOLBAR & FILTERS */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <div className="search-box" style={{ width: 320 }}>
              <Search size={14} />
              <input
                placeholder="Buscar por nombre, SKU o código..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
                  title="Limpiar"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: 200 }}
            >
              <option value="">Todas las categorías ({cats.length})</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {filtered.length} artículos encontrados
          </div>
        </div>

        {/* Stock FilterTabs */}
        <div style={{ marginBottom: 16 }}>
          <FilterTabs
            tabs={[
              { id: 'ALL', label: 'Todos', count: rows.length },
              { id: 'IN_STOCK', label: 'Disponibles', count: rows.filter(r => Number(r.stock) > 5).length },
              { id: 'LOW_STOCK', label: 'Stock bajo', count: lowStockCount },
              { id: 'OUT_OF_STOCK', label: 'Agotados', count: outOfStockCount }
            ]}
            activeTab={stockFilter}
            onChange={(k: string) => setStockFilter(k as any)}
          />
        </div>

        {filtered.length ? (
          <div className="product-grid">
            {filtered.map(r => {
              const stock = Number(r.stock || 0);
              const pvp = Number(r.price || 0);
              const cost = Number(r.purchase_price ?? r.purchasePrice ?? 0);
              const unitProfit = Math.max(0, pvp - cost);
              const margin = pvp > 0 ? ((unitProfit / pvp) * 100) : 0;

              return (
                <article className="product-card" key={r.id}>
                  <div className="product-thumb" style={{ background: 'var(--surface-subtle)', position: 'relative', overflow: 'hidden' }}>
                    {r.image_url || r.imageUrl ? (
                      <img
                        src={r.image_url || r.imageUrl}
                        alt={r.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ) : (
                      <Package size={26} style={{ color: 'var(--primary)' }} />
                    )}
                  </div>
                  <div className="product-card-body">
                    <div className="product-card-top">
                      <div>
                        <span className="sku-label">{r.sku}</span>
                        {r.barcode && (
                          <small style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>
                            {r.barcode}
                          </small>
                        )}
                      </div>
                      {(() => {
                        const minS = Number(r.min_stock ?? r.minStock ?? 5);
                        const isOut = stock <= 0;
                        const isLow = stock > 0 && stock <= minS;
                        return (
                          <div>
                            {!isOut && !isLow ? (
                              <StatusBadge tone="success">{stock} en stock</StatusBadge>
                            ) : isLow ? (
                              <StatusBadge tone="warning">Bajo ({stock}/{minS})</StatusBadge>
                            ) : (
                              <StatusBadge tone="danger">Agotado</StatusBadge>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <h4 style={{ margin: '8px 0', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</h4>

                    <div className="product-card-footer" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                      <div>
                        <small style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>PVP venta</small>
                        <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>${pvp.toFixed(2)}</strong>
                      </div>
                      {canViewCosts && (
                        <div style={{ textAlign: 'right' }}>
                          <small style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Costo</small>
                          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>${cost.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      {canViewCosts ? (
                        <small style={{ color: 'var(--success-dark)', fontWeight: 600 }}>
                          +${unitProfit.toFixed(2)} ({margin.toFixed(0)}% mgn)
                        </small>
                      ) : <span />}
                      {canManage && (
                        <button
                          type="button"
                          className="secondary-action btn-sm"
                          onClick={() => setEditItem(r)}
                          style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="panel" style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--text-subtle)' }}>
              <Package size={32} />
            </div>
            <h3 style={{ margin: '0 0 4px', color: 'var(--text)' }}>No hay productos que coincidan</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Prueba ajustando el término de búsqueda o la categoría seleccionada.</p>
          </div>
        )}
      </div>

      {showBarcodes && (
        <BarcodeTagsModal
          products={filtered}
          onClose={() => setShowBarcodes(false)}
        />
      )}

      {showCsvImport && (
        <CsvImportModal
          branchId={branchId}
          api={api}
          onDone={() => {
            setShowCsvImport(false);
            load();
          }}
          onClose={() => setShowCsvImport(false)}
        />
      )}
    </>
  );
}


export default Products;
