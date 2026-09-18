import React from 'react';

type Any = Record<string, any>;

// =========================================================================
// 1. PUBLIC DIGITAL CATALOG
// =========================================================================
export function PublicCatalog({ tenantId, onBack, isLogged }: { tenantId: string; onBack?: () => void; isLogged?: boolean }) {
  const [data, setData] = React.useState<Any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [selectedCat, setSelectedCat] = React.useState('ALL');
  const [cart, setCart] = React.useState<Array<{ id: string; name: string; sku: string; price: number; stock: number; quantity: number }>>([]);
  const [showCheckout, setShowCheckout] = React.useState(false);
  const [orderPlaced, setOrderPlaced] = React.useState<Any | null>(null);

  const [form, setForm] = React.useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    fulfillmentType: 'DELIVERY' as 'DELIVERY' | 'PICKUP',
    deliveryAddress: '',
    deliveryNotes: '',
    paymentMethod: 'CASH',
    shippingCost: '2.50'
  });
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/public/catalog/${tenantId}`)
      .then(async r => {
        if (r.ok) return r.json();
        const err = await r.json().catch(() => null);
        throw new Error(err?.message || 'Catálogo no disponible');
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'No se pudo cargar el catálogo de esta tienda');
        setLoading(false);
      });
  }, [tenantId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const addToCart = (p: Any) => {
    setCart(prev => {
      const exist = prev.find(i => i.id === p.id);
      if (exist) {
        if (exist.quantity >= Number(p.stock)) return prev;
        return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: p.id, name: p.name, sku: p.sku, price: Number(p.price), stock: Number(p.stock), quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const next = i.quantity + delta;
        return next > 0 && next <= i.stock ? { ...i, quantity: next } : i;
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const subtotal = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const shippingFee = form.fulfillmentType === 'DELIVERY' ? Number(form.shippingCost || 0) : 0;
  const grandTotal = subtotal + shippingFee;
  const totalQty = cart.reduce((acc, i) => acc + i.quantity, 0);

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.length || submitting) return;
    if (form.fulfillmentType === 'DELIVERY' && !form.deliveryAddress.trim()) {
      alert('Por favor ingresa tu dirección exacta de entrega para el despacho.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/catalog/${tenantId}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerEmail: form.customerEmail,
          fulfillmentType: form.fulfillmentType,
          deliveryAddress: form.deliveryAddress,
          deliveryNotes: form.deliveryNotes,
          shippingCost: shippingFee,
          paymentMethod: form.paymentMethod,
          items: cart.map(i => ({ productId: i.id, quantity: i.quantity }))
        })
      });

      if (res.ok) {
        const result = await res.json();
        setOrderPlaced(result);
        setCart([]);
        setShowCheckout(false);
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'Error al procesar el pedido.');
      }
    } catch (err: any) {
      alert('Error de conexión con la tienda: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="public-page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🛍️</div>
          <h3>Cargando Catálogo Digital...</h3>
          <p style={{ color: '#64748b', fontSize: 13 }}>Consultando productos y stock disponible...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="public-page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
        <div className="tracking-card" style={{ maxWidth: 460, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🏬</div>
          <h3 style={{ color: '#dc2626' }}>Catálogo no disponible</h3>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{error}</p>
          {onBack && (
            <button className="primary-action" onClick={onBack}>
              {isLogged ? '← Volver al Panel de Tienda' : '← Volver al Inicio'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const d = data!;
  const cleanPhone = (d.catalogWhatsapp || d.storePhone || '').replace(/[^0-9]/g, '');
  const waHelpMsg = encodeURIComponent(`Hola ${d.storeName}, estoy viendo su catálogo digital y tengo una consulta sobre sus productos.`);

  const filteredProducts = (d.products || []).filter((p: Any) => {
    const matchSearch = !search || `${p.name} ${p.sku} ${p.category_name}`.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCat === 'ALL' || p.category_id === selectedCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="public-page-wrapper">
      {/* HEADER */}
      <header className="catalog-header">
        <div className="catalog-header-inner">
          <div className="catalog-store-info">
            <div className="catalog-store-logo">
              {d.storeName ? d.storeName.slice(0, 1).toUpperCase() : 'F'}
            </div>
            <div>
              <h1 className="catalog-store-title">{d.storeName}</h1>
              <span className="catalog-verified-tag">✓ Tienda Oficial Verificada</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {cleanPhone && (
              <a
                href={`https://wa.me/${cleanPhone}?text=${waHelpMsg}`}
                target="_blank"
                rel="noreferrer"
                className="whatsapp-action-pill"
              >
                💬 WhatsApp
              </a>
            )}
            {onBack && (
              <button className="secondary-action" onClick={onBack} style={{ padding: '7px 12px', fontSize: 12 }}>
                {isLogged ? 'Panel Tienda' : 'Inicio'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div className="catalog-content-wrap">
        {/* HERO BANNER */}
        <div className="catalog-hero-banner">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              CATÁLOGO EN LÍNEA & DESPACHOS A DOMICILIO
            </span>
            <h2 style={{ fontSize: 24, margin: '6px 0', color: '#ffffff' }}>
              Encuentra lo que necesitas y recíbelo hoy
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', maxWidth: 540 }}>
              {d.catalogDescription || 'Explora nuestros repuestos, accesorios y productos con stock en tiempo real. Realiza tu compra y sigue tu motorizado en vivo.'}
            </p>
          </div>
          {d.branch?.address && (
            <div style={{ background: 'rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: 10, fontSize: 12, border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ fontWeight: 700, color: '#93c5fd' }}>📍 Sucursal Principal:</div>
              <div>{d.branch.address}</div>
            </div>
          )}
        </div>

        {/* SEARCH BAR */}
        <div style={{ marginBottom: 18 }}>
          <input
            type="text"
            placeholder="🔍 Buscar por nombre de producto o código SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
          />
        </div>

        {/* CATEGORY TABS */}
        <div className="catalog-cats-scroll">
          <button
            type="button"
            className={`catalog-cat-pill ${selectedCat === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedCat('ALL')}
          >
            Todos ({d.products?.length || 0})
          </button>
          {(d.categories || []).map((cat: Any) => (
            <button
              key={cat.id}
              type="button"
              className={`catalog-cat-pill ${selectedCat === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCat(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* PRODUCT GRID */}
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: 16, border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📦</div>
            <h3>No encontramos productos con ese filtro</h3>
            <p style={{ color: '#64748b', fontSize: 13 }}>Prueba con otra palabra de búsqueda o categoría.</p>
          </div>
        ) : (
          <div className="catalog-grid">
            {filteredProducts.map((p: Any) => {
              const inCart = cart.find(i => i.id === p.id);
              const isAvailable = Number(p.stock) > 0;

              return (
                <div key={p.id} className="catalog-card">
                  <div>
                    <div className="catalog-card-icon">
                      {p.category_name?.toLowerCase().includes('pantalla') ? '📱' :
                       p.category_name?.toLowerCase().includes('bater') ? '🔋' :
                       p.category_name?.toLowerCase().includes('cargador') ? '🔌' :
                       p.category_name?.toLowerCase().includes('accesorio') ? '🎧' : '📦'}
                    </div>
                    {p.category_name && (
                      <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>
                        {p.category_name}
                      </div>
                    )}
                    <h3 className="catalog-card-title">{p.name}</h3>
                    {p.sku && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                        SKU: {p.sku}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span className="catalog-card-price">${Number(p.price || 0).toFixed(2)}</span>
                      <span className={`catalog-stock-chip ${Number(p.stock) <= 3 ? 'stock-low' : 'stock-in'}`}>
                        {isAvailable ? `En stock: ${p.stock}` : 'Agotado'}
                      </span>
                    </div>

                    {inCart ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 8, padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                        <button
                          type="button"
                          onClick={() => updateQty(p.id, -1)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 700 }}
                        >
                          -
                        </button>
                        <strong style={{ fontSize: 14 }}>{inCart.quantity}</strong>
                        <button
                          type="button"
                          onClick={() => updateQty(p.id, 1)}
                          disabled={inCart.quantity >= Number(p.stock)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 700 }}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="primary-action"
                        onClick={() => addToCart(p)}
                        disabled={!isAvailable}
                        style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
                      >
                        {isAvailable ? '🛒 Agregar al Carrito' : 'Agotado'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FLOATING CART BAR */}
      {cart.length > 0 && !showCheckout && (
        <div className="catalog-floating-cart" onClick={() => setShowCheckout(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: '#2563eb', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
              {totalQty}
            </span>
            <div>
              <strong style={{ fontSize: 14, display: 'block' }}>Ver Pedido</strong>
              <small style={{ color: '#94a3b8', fontSize: 11 }}>Subtotal: ${subtotal.toFixed(2)}</small>
            </div>
          </div>
          <button
            type="button"
            className="primary-action"
            style={{ padding: '8px 16px', fontSize: 13, background: '#2563eb', border: 0 }}
          >
            Comprar Ahora →
          </button>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-head">
              <h3>🛒 Finalizar Pedido</h3>
              <button className="close-button" onClick={() => setShowCheckout(false)}>✕</button>
            </div>

            {/* ORDER ITEMS REVIEW */}
            <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
              {cart.map(it => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
                  <div style={{ flex: 1 }}>
                    <strong>{it.quantity}x</strong> {it.name}
                    <div style={{ fontSize: 11, color: '#64748b' }}>${it.price.toFixed(2)} c/u</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong style={{ color: '#0f172a' }}>${(it.price * it.quantity).toFixed(2)}</strong>
                    <button
                      type="button"
                      onClick={() => removeFromCart(it.id)}
                      style={{ background: 'transparent', border: 0, color: '#dc2626', cursor: 'pointer', fontSize: 14 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handlePlaceOrder}>
              {/* FULFILLMENT SELECTOR */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Modalidad de Entrega:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div
                    onClick={() => setForm({ ...form, fulfillmentType: 'DELIVERY' })}
                    style={{
                      border: `2px solid ${form.fulfillmentType === 'DELIVERY' ? '#2563eb' : '#e2e8f0'}`,
                      background: form.fulfillmentType === 'DELIVERY' ? '#eff6ff' : '#fff',
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: 22 }}>🛵</div>
                    <strong style={{ fontSize: 13, color: form.fulfillmentType === 'DELIVERY' ? '#1d4ed8' : '#334155' }}>
                      Envío a Domicilio
                    </strong>
                    <div style={{ fontSize: 11, color: '#64748b' }}>+${Number(form.shippingCost).toFixed(2)} flete</div>
                  </div>

                  <div
                    onClick={() => setForm({ ...form, fulfillmentType: 'PICKUP' })}
                    style={{
                      border: `2px solid ${form.fulfillmentType === 'PICKUP' ? '#2563eb' : '#e2e8f0'}`,
                      background: form.fulfillmentType === 'PICKUP' ? '#eff6ff' : '#fff',
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: 22 }}>🏬</div>
                    <strong style={{ fontSize: 13, color: form.fulfillmentType === 'PICKUP' ? '#1d4ed8' : '#334155' }}>
                      Retiro en Tienda
                    </strong>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Sin costo adicional</div>
                  </div>
                </div>
              </div>

              {/* CUSTOMER CONTACT */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span>Tu Nombre y Apellido *</span>
                  <input
                    placeholder="Ej. Juan Pérez"
                    value={form.customerName}
                    onChange={e => setForm({ ...form, customerName: e.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>Teléfono WhatsApp *</span>
                  <input
                    placeholder="Ej. 0987654321"
                    value={form.customerPhone}
                    onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                    required
                  />
                </label>
              </div>

              {/* DELIVERY ADDRESS IF APPLICABLE */}
              {form.fulfillmentType === 'DELIVERY' && (
                <>
                  <label>
                    <span>Dirección de Entrega Exacta *</span>
                    <input
                      placeholder="Ej. Av. 9 de Octubre y Boyacá, Edificio Central Piso 3"
                      value={form.deliveryAddress}
                      onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    <span>Referencias / Indicaciones para el Motorizado</span>
                    <input
                      placeholder="Ej. Casa de rejas blancas junto a la farmacia"
                      value={form.deliveryNotes}
                      onChange={e => setForm({ ...form, deliveryNotes: e.target.value })}
                    />
                  </label>
                </>
              )}

              {/* PAYMENT METHOD */}
              <label>
                <span>Método de Pago Preferido:</span>
                <select
                  value={form.paymentMethod}
                  onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                >
                  <option value="CASH">💵 Efectivo al recibir (Contra Entrega)</option>
                  <option value="TRANSFER">🏦 Transferencia / Depósito Bancario</option>
                  <option value="CARD">💳 Tarjeta de Crédito / Débito</option>
                </select>
              </label>

              {/* TOTAL BOX */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, margin: '14px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                  <span>Subtotal productos:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {form.fulfillmentType === 'DELIVERY' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    <span>Flete de envío:</span>
                    <span>${shippingFee.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#0f172a', borderTop: '1px solid #cbd5e1', paddingTop: 8, marginTop: 8 }}>
                  <span>TOTAL A PAGAR:</span>
                  <span style={{ color: '#2563eb' }}>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowCheckout(false)}>
                  Volver al Catálogo
                </button>
                <button type="submit" className="primary-action" disabled={submitting}>
                  {submitting ? 'Confirmando...' : '✓ Confirmar y Realizar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ORDER PLACED SUCCESS MODAL */}
      {orderPlaced && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 500, textAlign: 'center' }}>
            <div style={{ fontSize: 50, marginBottom: 10 }}>🎉</div>
            <h2 style={{ margin: '0 0 6px', color: '#16a34a' }}>¡Pedido Realizado con Éxito!</h2>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>
              La tienda ha recibido tu pedido <strong>#{orderPlaced.orderNumber}</strong>.
            </p>

            {orderPlaced.trackingNumber && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Tu Guía de Seguimiento en Vivo:
                </span>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8', margin: '6px 0' }}>
                  {orderPlaced.trackingNumber}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#3b82f6' }}>
                  Puedes consultar el avance de tu motorizado en cualquier momento.
                </p>
                <a
                  href={`/#tracking/${orderPlaced.trackingNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="primary-action"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '8px 16px', fontSize: 13, textDecoration: 'none' }}
                >
                  🛵 Rastrear mi Envío en Vivo →
                </a>
              </div>
            )}

            {orderPlaced.whatsappUrl && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
                  Envía el resumen por WhatsApp a la tienda para confirmar la preparación inmediata:
                </p>
                <a
                  href={orderPlaced.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="whatsapp-action-pill"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: 14 }}
                >
                  💬 Enviar Pedido a la Tienda por WhatsApp
                </a>
              </div>
            )}

            <button
              type="button"
              className="secondary-action"
              style={{ width: '100%' }}
              onClick={() => {
                setOrderPlaced(null);
                load();
              }}
            >
              Seguir explorando el catálogo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 2. PUBLIC LIVE DELIVERY TRACKING
// =========================================================================
export function PublicDeliveryTracking({ code, onBack, isLogged }: { code: string; onBack?: () => void; isLogged?: boolean }) {
  const [data, setData] = React.useState<Any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/public/deliveries/tracking/${encodeURIComponent(code)}`)
      .then(async r => {
        if (r.ok) return r.json();
        const errJson = await r.json().catch(() => null);
        throw new Error(errJson?.message || 'No se encontró el envío solicitado');
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'Error al consultar el rastreo');
        setLoading(false);
      });
  }, [code]);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="public-page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🛵</div>
          <h3 style={{ margin: 0 }}>Consultando estado del envío...</h3>
          <p style={{ color: '#64748b', fontSize: 13 }}>Obteniendo ubicación y estado en tiempo real...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="public-page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
        <div className="tracking-card" style={{ maxWidth: 460, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <h3 style={{ color: '#dc2626' }}>No se pudo encontrar el envío</h3>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{error}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {onBack && (
              <button className="primary-action" onClick={onBack}>
                {isLogged ? '← Volver al Panel' : '← Volver al Inicio'}
              </button>
            )}
            <button className="secondary-action" onClick={load}>
              🔄 Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const d = data!;
  const cleanPhone = (d.storePhone || '').replace(/[^0-9]/g, '');
  const waHelpMsg = encodeURIComponent(`Hola ${d.storeName}, estoy consultando el estado de mi envío #${d.trackingNumber || d.deliveryId}. ¿Me podrían brindar más información?`);
  const stepIdx = Number(d.stepIndex || 1);

  return (
    <div className="public-page-wrapper">
      <header className="catalog-header">
        <div className="catalog-header-inner">
          <div className="catalog-store-info">
            <div className="catalog-store-logo">📦</div>
            <div>
              <h2 className="catalog-store-title">{d.storeName || 'FixmeTiendas'}</h2>
              <span className="catalog-verified-tag">● Seguimiento Oficial de Envío</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {cleanPhone && (
              <a
                href={`https://wa.me/${cleanPhone}?text=${waHelpMsg}`}
                target="_blank"
                rel="noreferrer"
                className="whatsapp-action-pill"
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                💬 Ayuda WhatsApp
              </a>
            )}
            {onBack && (
              <button className="secondary-action" onClick={onBack} style={{ padding: '6px 12px', fontSize: 12 }}>
                {isLogged ? 'Panel Tienda' : 'Inicio'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="tracking-wrapper">
        {/* Main Status Header Card */}
        <div className="tracking-card" style={{ textAlign: 'center', background: stepIdx === 4 ? '#f0fdf4' : '#ffffff' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>
            {stepIdx === 4 ? '🎉' : stepIdx === 3 ? '🛵' : stepIdx === 2 ? '📦' : '📝'}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: stepIdx === 4 ? '#16a34a' : '#2563eb' }}>
            N° Guía: {d.trackingNumber || 'S/N'}
          </span>
          <h2 style={{ margin: '6px 0 10px', fontSize: 22, color: stepIdx === 4 ? '#15803d' : '#0f172a' }}>
            {d.statusLabel}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Destino: <strong>{d.address}</strong>
          </p>

          {/* Stepper Progress */}
          <div className="tracking-stepper">
            <div className="tracking-stepper-progress" style={{ width: stepIdx === 1 ? '15%' : stepIdx === 2 ? '48%' : stepIdx === 3 ? '80%' : '100%' }} />
            <div className={`tracking-step ${stepIdx >= 1 ? 'done' : ''} ${stepIdx === 1 ? 'current' : ''}`}>
              <div className="tracking-step-circle">{stepIdx > 1 ? '✓' : '1'}</div>
              <span className="tracking-step-label">Registrado</span>
            </div>
            <div className={`tracking-step ${stepIdx >= 2 ? 'done' : ''} ${stepIdx === 2 ? 'current' : ''}`}>
              <div className="tracking-step-circle">{stepIdx > 2 ? '✓' : '2'}</div>
              <span className="tracking-step-label">Empacado</span>
            </div>
            <div className={`tracking-step ${stepIdx >= 3 ? 'done' : ''} ${stepIdx === 3 ? 'current' : ''}`}>
              <div className="tracking-step-circle">{stepIdx > 3 ? '✓' : '3'}</div>
              <span className="tracking-step-label">En Camino 🛵</span>
            </div>
            <div className={`tracking-step ${stepIdx >= 4 ? 'done' : ''} ${stepIdx === 4 ? 'current' : ''}`}>
              <div className="tracking-step-circle">{stepIdx === 4 ? '✓' : '4'}</div>
              <span className="tracking-step-label">Entregado</span>
            </div>
          </div>
        </div>

        {/* Live GPS / Driver Card if available */}
        {(d.driverName || d.courier || d.trackingUrl) && (
          <div className="tracking-card">
            <h4 style={{ margin: '0 0 12px 0', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🛵</span> Datos del Despacho y Repartidor
            </h4>
            <div className="tracking-driver-badge">
              <div>
                <strong style={{ fontSize: 14, color: '#1e3a8a', display: 'block' }}>
                  {d.driverName || d.courier}
                </strong>
                <small style={{ color: '#64748b', fontSize: 12 }}>
                  {d.driverVehicle === 'MOTO' ? '🛵 Motocicleta de flota' : d.driverVehicle === 'AUTO' ? '🚗 Automóvil' : '📦 Repartidor asignado'}
                </small>
              </div>
              {d.driverPhone && (
                <a
                  href={`tel:${d.driverPhone}`}
                  style={{ background: '#16a34a', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  📞 Llamar
                </a>
              )}
            </div>

            {d.trackingUrl && (
              <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 8 }}>
                  📍 El repartidor compartió su viaje en vivo por GPS (InDrive / Uber Flash):
                </span>
                <a
                  href={d.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0f172a', color: '#ffffff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                >
                  🗺️ Ver Ubicación en Tiempo Real del Vehículo →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Destination & Order Items */}
        <div className="tracking-card">
          <h4 style={{ margin: '0 0 12px 0', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📋</span> Resumen del Pedido
          </h4>
          <div style={{ fontSize: 13, color: '#334155', marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
            <div><strong>Destinatario:</strong> {d.recipientName || 'Cliente'} {d.recipientPhone ? `(${d.recipientPhone})` : ''}</div>
            <div style={{ marginTop: 4 }}><strong>Dirección:</strong> {d.address}</div>
            {d.deliveryNotes && <div style={{ marginTop: 4, color: '#64748b' }}><strong>Indicaciones:</strong> {d.deliveryNotes}</div>}
          </div>

          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              {(d.items || []).map((it: Any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 0' }}>
                    <strong>{it.quantity}x</strong> {it.product_name}
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700 }}>
                    ${Number(it.line_total || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {Number(d.shippingCost || 0) > 0 && (
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                  <td style={{ padding: '8px 0' }}>Flete / Envío a domicilio</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>${Number(d.shippingCost).toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td style={{ padding: '12px 0 0', fontWeight: 800, fontSize: 15 }}>Total:</td>
                <td style={{ padding: '12px 0 0', textAlign: 'right', fontWeight: 800, fontSize: 16, color: '#2563eb' }}>
                  ${Number(d.saleTotal || 0).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Live Refresh Note */}
        <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          <span>🔄 Esta página se actualiza automáticamente cada 15 segundos</span>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 3. STORE MODAL: SHARE DIGITAL CATALOG
// =========================================================================
export function CatalogShareModal({ tenantId, storeName, onClose, notify }: { tenantId: string; storeName?: string; onClose: () => void; notify?: (s: string) => void }) {
  const url = `${window.location.origin}/#catalog/${tenantId}`;

  function copyLink() {
    navigator.clipboard.writeText(url);
    notify?.('✓ Enlace del catálogo copiado al portapapeles');
  }

  const waText = encodeURIComponent(`¡Hola! Te invitamos a conocer el Catálogo Digital Oficial de ${storeName || 'nuestra tienda'}. Puedes explorar nuestros productos, consultar stock en tiempo real y hacer tus pedidos en línea aquí:\n${url}`);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h3>📱 Catálogo Digital de tu Tienda</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>
          Comparte este enlace con tus clientes por WhatsApp o redes sociales. Tus clientes podrán ver tus productos disponibles con stock en tiempo real y realizar pedidos con retiro en tienda o entrega a domicilio con tracking en vivo.
        </p>

        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <small style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>ENLACE PÚBLICO DEL CATÁLOGO:</small>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', wordBreak: 'break-all' }}>
            {url}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="primary-action" onClick={copyLink} style={{ padding: '10px 16px' }}>
            📋 Copiar Enlace del Catálogo
          </button>

          <a
            href={`https://wa.me/?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            className="whatsapp-action-pill"
            style={{ justifyContent: 'center', padding: '10px 16px' }}
          >
            💬 Compartir por WhatsApp
          </a>

          <a
            href={`/#catalog/${tenantId}`}
            target="_blank"
            rel="noreferrer"
            className="secondary-action"
            style={{ textAlign: 'center', textDecoration: 'none', padding: '10px 16px' }}
          >
            🚀 Ver Catálogo como Cliente (Nueva Pestaña)
          </a>
        </div>
      </div>
    </div>
  );
}

