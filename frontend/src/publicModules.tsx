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

// =========================================================================
// 4. PUBLIC WORK ORDER TRACKING & QUOTE APPROVAL PORTAL
// =========================================================================
export function PublicWorkOrderTracking({ code, onBack, isLogged }: { code: string; onBack?: () => void; isLogged?: boolean }) {
  const [data, setData] = React.useState<Any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionSuccess, setActionSuccess] = React.useState('');
  const [clientNotes, setClientNotes] = React.useState('');
  const [rejectReason, setRejectReason] = React.useState('');
  const [showRejectModal, setShowRejectModal] = React.useState(false);
  const [showApproveModal, setShowApproveModal] = React.useState(false);
  const [selectedPhoto, setSelectedPhoto] = React.useState<Any | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const r = await fetch(`/api/public/work-orders/${encodeURIComponent(code)}`);
      if (r.ok) {
        const d = await r.json();
        setData(d);
        setLastUpdated(new Date());
        setError('');
      } else {
        const err = await r.json().catch(() => null);
        throw new Error(err?.message || 'Orden de servicio no encontrada');
      }
    } catch (e: any) {
      if (!silent) setError(e.message || 'No se pudo cargar el seguimiento de la orden');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [code]);

  React.useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleApprove() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/work-orders/${encodeURIComponent(code)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: clientNotes.trim() })
      });
      if (res.ok) {
        setShowApproveModal(false);
        setActionSuccess('¡Presupuesto aprobado exitosamente! Tu equipo avanzó a estado: Esperando Repuestos / En Reparación.');
        load();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'No se pudo registrar la aprobación.');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      alert('Por favor indica un motivo para el rechazo.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/work-orders/${encodeURIComponent(code)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() })
      });
      if (res.ok) {
        setShowRejectModal(false);
        setActionSuccess('Presupuesto cancelado. Tu equipo está listo para entrega en recepción. Solo cancelas la tarifa de diagnóstico.');
        load();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'No se pudo registrar el rechazo.');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <h3 style={{ margin: 0, color: '#334155' }}>Consultando estado de reparación...</h3>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Conectando con el taller en tiempo real</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20, fontFamily: 'sans-serif' }}>
        <div style={{ maxWidth: 440, width: '100%', background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 20 }}>Orden no encontrada</h2>
          <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>
            {error || 'El código o enlace ingresado no corresponde a ninguna orden activa.'}
          </p>
          {onBack && (
            <button type="button" onClick={onBack} className="primary-action" style={{ width: '100%' }}>
              ← Volver al Sistema
            </button>
          )}
        </div>
      </div>
    );
  }

  const status = (data.status || 'OPEN').toUpperCase();
  const quoteVal = Number(data.quote || 0);
  const diagFee = Number(data.diagnostic_fee || 0);

  // Status flags matching workshop lifecycle
  const isQuoted = ['QUOTED', 'COTIZADO', 'PRESUPUESTADO'].includes(status);
  const isWaitingParts = ['WAITING_PARTS', 'ESPERANDO_REPUESTOS'].includes(status);
  const isRepairing = ['IN_PROGRESS', 'EN_REPARACION', 'EN_PROCESO', 'APPROVED', 'APROBADO'].includes(status);
  const isTesting = ['TESTING', 'EN_PRUEBAS', 'PRUEBAS'].includes(status);
  const isReady = ['COMPLETED', 'LISTO_ENTREGA', 'LISTO'].includes(status);
  const isDelivered = ['DELIVERED', 'ENTREGADO', 'PAGADO'].includes(status);
  const isDirectRejected = ['REJECTED', 'RECHAZADO', 'CANCELLED', 'CANCELADO'].includes(status);
  const isRejectedOrder = isDirectRejected || (isReady && (!!data.rejection_reason || !!data.rejectionReason));
  const isApproved = isWaitingParts || isRepairing || isTesting || (isReady && !isRejectedOrder) || isDelivered;

  // Can the client approve or reject the quote?
  const canApprove = (isQuoted || (['OPEN', 'RECIBIDO', 'DIAGNOSIS', 'EN_DIAGNOSTICO'].includes(status) && quoteVal > 0)) && !isApproved && !isRejectedOrder;

  // Exact step calculation
  let step = 1;
  if (isRejectedOrder) {
    step = isDelivered ? 5 : 4;
  } else {
    if (['OPEN', 'RECIBIDO'].includes(status)) step = 1;
    else if (['DIAGNOSIS', 'EN_DIAGNOSTICO'].includes(status)) step = 2;
    else if (isQuoted) step = 3;
    else if (isWaitingParts) step = 4;
    else if (isRepairing) step = 5;
    else if (isTesting) step = 6;
    else if (isReady) step = 7;
    else if (isDelivered) step = 8;
  }

  const stepsList = isRejectedOrder
    ? [
        { s: 1, label: 'Orden abierta', icon: '📋' },
        { s: 2, label: 'Diagnóstico', icon: '🔍' },
        { s: 3, label: 'Cotización', icon: '💰' },
        { s: 4, label: 'Listo Retiro', icon: '📦' },
        { s: 5, label: 'Pagado', icon: '🤝' },
      ]
    : [
        { s: 1, label: 'Orden abierta', icon: '📋' },
        { s: 2, label: 'Diagnóstico', icon: '🔍' },
        { s: 3, label: 'Cotizado', icon: '💰' },
        { s: 4, label: 'Repuestos', icon: '📦' },
        { s: 5, label: 'Reparación', icon: '⚙️' },
        { s: 6, label: 'Pruebas', icon: '🧪' },
        { s: 7, label: 'Listo Retiro', icon: '✅' },
        { s: 8, label: 'Pagado', icon: '🤝' },
      ];

  const storeName = data.store_name || 'Fixme Taller';
  const branchName = data.branch_name || 'Servicio Técnico';
  const branchPhone = data.branch_phone || data.customer_phone || '';
  const orderNum = data.order_number || ('OT-' + data.id?.slice(0, 6).toUpperCase());
  const deviceTitle = `${data.device_brand || ''} ${data.device_model || data.description || 'Equipo'}`.trim();

  let waNumber = branchPhone.replace(/[^0-9]/g, '');
  if (waNumber.startsWith('0')) waNumber = '593' + waNumber.substring(1);
  else if (waNumber && !waNumber.startsWith('593') && waNumber.length === 9) waNumber = '593' + waNumber;
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`¡Hola ${storeName}! Quisiera consultar sobre el avance de mi orden #${orderNum} (${deviceTitle}).`)}` : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-muted)', fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: 40 }}>
      {/* Mobile Top Navbar */}
      <div className="track-hero">
        <div className="track-hero-inner">
          <div className="track-brand">
            <span className="track-eyebrow">🔧 Rastreo de Reparación en Vivo</span>
            <span className="track-store">{storeName}</span>
          </div>
          <div className="track-actions">
            <button type="button" className={`track-refresh-btn ${isRefreshing ? 'refreshing' : ''}`} onClick={() => load()} disabled={isRefreshing}>
              <span className="spin">🔄</span> {isRefreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
            {onBack && <button type="button" className="track-refresh-btn" onClick={onBack}>← Volver</button>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px' }}>
        {/* Order Header Card */}
        <div className="track-card fade-in-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span className="card-folio">
                {orderNum}
              </span>
              <h2 className="track-card-title">{deviceTitle}</h2>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Cliente: <strong>{data.customer_name || 'Cliente'}</strong>
              </div>
            </div>

            {/* Status Pill */}
            <div style={{ textAlign: 'right' }}>
              <span className={`status-pill ${
                isDelivered ? 'delivered'
                : isRejectedOrder && !isDelivered ? 'rejected'
                : isReady ? 'ready'
                : isTesting ? 'testing'
                : isRepairing ? 'repair'
                : isWaitingParts ? 'parts'
                : canApprove ? 'quoted'
                : ['DIAGNOSIS', 'EN_DIAGNOSTICO'].includes(status) ? 'diag'
                : 'open'
              }`}>
                {!(isDelivered || isRejectedOrder || isReady) && <span className="pulse-dot"></span>}
                {isDelivered ? '🤝 ENTREGADO Y PAGADO'
                 : isRejectedOrder && !isDelivered ? '❌ COTIZACIÓN CANCELADA · LISTO PARA RETIRO'
                 : isReady ? '✅ LISTO PARA ENTREGA'
                 : isTesting ? '🧪 EN PRUEBAS FINALES'
                 : isRepairing ? '⚙️ EN REPARACIÓN'
                 : isWaitingParts ? '⏳ ESPERANDO REPUESTOS'
                 : canApprove ? '⚠️ NECESITA SU APROBACIÓN'
                 : ['DIAGNOSIS', 'EN_DIAGNOSTICO'].includes(status) ? '🔍 EN DIAGNÓSTICO'
                 : '📋 ORDEN ABIERTA'}
              </span>
              {data.estimated_delivery && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Entrega est.: {new Date(data.estimated_delivery).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Stepper with Sequential Stages */}
          <div className="track-stepper" style={{ marginTop: 18 }}>
            {stepsList.map((st, idx) => {
              const isPassed = step >= st.s;
              const isCurrent = step === st.s;
              const stepClass = isCurrent ? `active${isRejectedOrder && st.s === 4 ? ' rejected' : ''}` : isPassed ? 'done' : '';
              return (
                <React.Fragment key={st.s}>
                  <div className={`track-step ${stepClass}`}>
                    <div className="track-step-dot">
                      {isCurrent ? st.icon : isPassed ? '✓' : st.icon}
                    </div>
                    <div className="track-step-label">{st.label}</div>
                  </div>
                  {idx < stepsList.length - 1 && (
                    <div className={`track-step-line ${isPassed && !isCurrent ? 'done' : isCurrent ? 'active' : ''}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Action Success Alert */}
        {actionSuccess && (
          <div className="track-card" style={{ background: 'var(--success-subtle)', borderColor: 'var(--success-border)', color: 'var(--success-dark)' }}>
            <strong>✓ Notificación del Taller:</strong> {actionSuccess}
          </div>
        )}

        {/* PROMINENT ACTION BANNER: APPROVAL NEEDED */}
        {canApprove && (
          <div className="approval-banner fade-in-up">
            <h3>⚠️ ACCIÓN REQUERIDA: SU COTIZACIÓN ESTÁ LISTA</h3>
            <p>El técnico ha finalizado la evaluación de su equipo. A continuación puede revisar los repuestos, mano de obra y autorizar o cancelar la reparación.</p>
            <div className="approval-btn-grid">
              <button type="button" className="btn-approve" onClick={() => setShowApproveModal(true)}>
                ✅ Aceptar Cotización (${quoteVal.toFixed(2)})
              </button>
              <button type="button" className="btn-reject" onClick={() => setShowRejectModal(true)}>
                ❌ Cancelar Cotización
              </button>
            </div>
          </div>
        )}

        {/* Quotation & Approval Section */}
        <div className="track-card fade-in-up">
          <h3 className="track-section-title">
            <span>💰</span> Presupuesto & Cotización
          </h3>

          {/* Diagnosis Note */}
          <div className="diag-note">
            <div className="diag-note-label">Diagnóstico del Técnico:</div>
            <div className="diag-note-text">
              {data.diagnosis || 'Diagnóstico técnico en proceso en banco de trabajo.'}
            </div>
          </div>

          {/* Diagnostic Fee Policy Note */}
          {diagFee > 0 && !isRejectedOrder && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 'var(--sp-sm) var(--sp-md)', marginBottom: 'var(--sp-md)', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
              <span style={{ fontSize: '1rem' }}>💡</span>
              <div>
                <strong>Tarifa de diagnóstico: ${diagFee.toFixed(2)}.</strong> Si apruebas la reparación, cancelas el valor presupuestado. Si decides no reparar o cancelas la cotización, solo se cobra la tarifa de diagnóstico acordada.
              </div>
            </div>
          )}

          {/* Quotation Items Table (Labor vs Parts) */}
          {Array.isArray(data.items) && data.items.length > 0 ? (
            <div style={{ marginBottom: 'var(--sp-md)' }}>
              <table className="quote-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Concepto</th>
                    <th style={{ textAlign: 'center' }}>Cant.</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it: Any, idx: number) => {
                    const isLabor = it.itemType === 'LABOR' || it.itemType === 'SERVICE';
                    return (
                      <tr key={idx}>
                        <td>
                          <span className={`quote-type-badge ${isLabor ? 'labor' : 'part'}`}>
                            {isLabor ? '🛠️ Mano Obra' : '📦 Repuesto'}
                          </span>
                        </td>
                        <td>
                          <strong>{it.name}</strong>
                          {Number(it.unitPrice) > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>(${(Number(it.unitPrice)).toFixed(2)} c/u)</span>}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{Number(it.quantity)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-heading)' }}>${Number(it.subtotal).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* Total Banner */}
          {!isRejectedOrder && (
            <div className="quote-total-bar">
              <div>
                <div className="quote-total-label">TOTAL PRESUPUESTADO:</div>
                <div className="quote-total-sublabel">Incluye repuestos y mano de obra garantizada</div>
              </div>
              <div className="quote-total-amount">
                ${quoteVal.toFixed(2)}
              </div>
            </div>
          )}

          {isApproved && !isRejectedOrder && (
            <div style={{ marginTop: 'var(--sp-md)', background: 'var(--success-subtle)', border: '1px solid var(--success-border)', borderRadius: 'var(--r-md)', padding: 'var(--sp-sm) var(--sp-md)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--success-dark)' }}>
              👍 <strong>Presupuesto Aprobado:</strong> El equipo se encuentra en proceso de reparación técnica.
              {data.client_notes && <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: 2 }}>Notas del cliente: "{data.client_notes}"</div>}
            </div>
          )}

          {isRejectedOrder && (
            <div className="rejection-card">
              <div style={{ fontWeight: 900, fontSize: '1rem' }}>❌ Cotización Cancelada · Equipo Listo para Retiro</div>
              <p style={{ margin: 'var(--sp-sm) 0', fontSize: '0.8rem', color: 'var(--danger-dark)' }}>
                Has rechazado el presupuesto de reparación. Tu equipo ya se encuentra ensamblado y listo para entrega en recepción de la tienda. Al no realizar la reparación, conforme a los términos acordados, únicamente se cobra la tarifa por diagnóstico técnico:
              </p>
              <div className="rejection-amount">
                <span className="amount-label">VALOR A COBRAR POR DIAGNÓSTICO:</span>
                <span className="amount-value">${(diagFee > 0 ? diagFee : 10).toFixed(2)}</span>
              </div>
              {data.rejection_reason && (
                <div style={{ fontSize: '0.75rem', color: 'var(--danger-dark)', marginTop: 4 }}>
                  Motivo registrado: "{data.rejection_reason}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trust-Cam Visual Inspection & Repair Photos Gallery */}
        <div className="track-card fade-in-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
            <h3 className="track-section-title" style={{ marginBottom: 0 }}>
              <span>📸</span> Evidencias Visuales y Fotos del Trabajo ({Array.isArray(data.images) ? data.images.length : 0})
            </h3>
            <span style={{ fontSize: '0.7rem', background: 'var(--primary-subtle)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--r-pill)', fontWeight: 700 }}>
              Trust-Cam 360°
            </span>
          </div>

          {Array.isArray(data.images) && data.images.length > 0 ? (
            <div className="photo-grid">
              {data.images.map((img: Any, idx: number) => {
                const stageLabel: Record<string, string> = {
                  RECEPTION: '📥 Recepción',
                  DIAGNOSIS: '🔬 Diagnóstico',
                  PARTS: '📦 Repuesto',
                  WAITING_PARTS: '⏳ Repuestos',
                  REPAIR: '🛠️ Reparación',
                  TESTING: '🧪 Pruebas',
                  COMPLETED: '✨ Culminado',
                  LISTO_ENTREGA: '✅ Listo Entrega',
                  ENTREGA: '🤝 Entrega'
                };
                const badge = stageLabel[img.stage?.toUpperCase()] || img.stage || 'Evidencia';
                return (
                  <div
                    key={img.id || idx}
                    className="photo-thumb"
                    onClick={() => setSelectedPhoto(img)}
                  >
                    <div style={{ position: 'relative', height: 110, background: '#000' }}>
                      <img
                        src={img.image_url || img.imageUrl}
                        alt={img.caption || 'Foto de taller'}
                        className="photo-thumb-img"
                      />
                      <span className="photo-stage-badge">
                        {badge}
                      </span>
                    </div>
                    {img.caption && (
                      <div className="photo-thumb-caption">
                        {img.caption}
                      </div>
                    )}
                    <div className="photo-thumb-date">
                      {img.created_at ? new Date(img.created_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="photo-empty">
              📷 No hay fotos registradas todavía. A medida que el técnico evalúe y trabaje en tu equipo, subirá fotos del diagnóstico, repuestos y pruebas aquí.
            </div>
          )}
        </div>

        {/* Equipment Technical Details Card */}
        <div className="track-card fade-in-up">
          <h3 className="track-section-title">
            <span>📱</span> Datos del Equipo Recibido
          </h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Marca y Modelo:</span>
              <strong className="info-value">{deviceTitle}</strong>
            </div>
            <div className="info-item">
              <span className="info-label">N° Serie o IMEI:</span>
              <strong className="info-value">{data.serial_number || 'No especificado'}</strong>
            </div>
            <div className="info-item full">
              <span className="info-label">Falla Reportada:</span>
              <strong className="info-value">{data.reported_fault || data.description || 'Revisión técnica'}</strong>
            </div>
            {data.accessories && (
              <div className="info-item full">
                <span className="info-label">Accesorios recibidos:</span>
                <span className="info-value" style={{ fontWeight: 400 }}>{data.accessories}</span>
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp & Contact Workshop Card */}
        <div className="wa-contact-card fade-in-up">
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-heading)' }}>¿Tienes dudas sobre tu equipo?</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 'var(--sp-xs) 0 var(--sp-md)' }}>
            Habla directamente con el taller de <strong>{storeName}</strong> ({branchName}).
          </p>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="wa-contact-btn"
            >
              💬 Chatear por WhatsApp con el Taller (+593)
            </a>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Teléfono del taller: {branchPhone || 'Acércate a recepción'}</div>
          )}
        </div>

        {/* Live Refresh Note */}
        <div className="track-footer">
          <span>🔄 Actualizado en vivo cada 5 segundos <span className="live-dot"></span> {lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* LIGHTBOX MODAL FOR PHOTOS */}
      {selectedPhoto && (
        <div className="lightbox-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={selectedPhoto.image_url || selectedPhoto.imageUrl} alt="Foto completa" />
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <span className="lightbox-caption">
                <strong>{selectedPhoto.stage}</strong>: {selectedPhoto.caption || 'Evidencia de reparación'}
              </span>
            </div>
            <button className="lightbox-close" onClick={() => setSelectedPhoto(null)}>✕</button>
            {/* Add prev/next navigation if there are multiple photos */}
            {Array.isArray(data.images) && data.images.length > 1 && (
              <>
                <button className="lightbox-nav prev" onClick={() => {
                  const idx = data.images.findIndex((im: Any) => (im.id || '') === (selectedPhoto.id || ''));
                  const prev = idx > 0 ? data.images[idx - 1] : data.images[data.images.length - 1];
                  setSelectedPhoto(prev);
                }}>‹</button>
                <button className="lightbox-nav next" onClick={() => {
                  const idx = data.images.findIndex((im: Any) => (im.id || '') === (selectedPhoto.id || ''));
                  const next = idx < data.images.length - 1 ? data.images[idx + 1] : data.images[0];
                  setSelectedPhoto(next);
                }}>›</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL APPROVE */}
      {showApproveModal && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3>✅ Confirmar Aprobación</h3>
              <button className="close-button" onClick={() => setShowApproveModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 14px' }}>
              Estás autorizando al taller a proceder con la reparación de tu <strong>{deviceTitle}</strong> por el valor de <strong>${quoteVal.toFixed(2)}</strong>.
            </p>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Instrucciones adicionales (opcional):</span>
              <textarea
                className="input-field"
                rows={2}
                placeholder="Ej. Por favor respaldar fotos antes de cambiar la pantalla..."
                value={clientNotes}
                onChange={e => setClientNotes(e.target.value)}
                style={{ width: '100%', fontSize: 13 }}
              />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="primary-action"
                onClick={handleApprove}
                disabled={actionLoading}
                style={{ flex: 1, background: '#10b981', justifyContent: 'center' }}
              >
                {actionLoading ? 'Procesando...' : 'Sí, Aprobar Reparación'}
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setShowApproveModal(false)}
                disabled={actionLoading}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REJECT */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3>❌ Rechazar o Cancelar Cotización</h3>
              <button className="close-button" onClick={() => setShowRejectModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px' }}>
              Al cancelar o no autorizar la cotización, tu equipo estará disponible para retiro en recepción y únicamente deberás cancelar el valor del diagnóstico técnico de <strong>${(diagFee > 0 ? diagFee : 10).toFixed(2)}</strong>.
            </p>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px' }}>
              Indícanos el motivo por el cual decides no realizar la reparación:
            </p>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Motivo de rechazo *</span>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Ej. El costo supera mi presupuesto / Prefiero comprar un equipo nuevo..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                required
                style={{ width: '100%', fontSize: 13 }}
              />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="primary-action"
                onClick={handleReject}
                disabled={actionLoading}
                style={{ flex: 1, background: '#ef4444', borderColor: '#dc2626', justifyContent: 'center' }}
              >
                {actionLoading ? 'Procesando...' : 'Confirmar Rechazo'}
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 5. PUBLIC REPAIR REQUEST WIZARD (CLIENTE SOLICITA REPARACIÓN CON FOTOS)
// =========================================================================
export function PublicRepairRequestWizard({ onBack, isLogged }: { onBack?: () => void; isLogged?: boolean }) {
  const [form, setForm] = React.useState({
    deviceCategory: 'SMARTPHONE',
    deviceBrand: '',
    deviceModel: '',
    powersOn: true,
    faultDescription: '',
    urgency: 'NORMAL',
    city: 'Quito',
    neighborhood: '',
    customerAddress: '',
    deliveryPreference: 'WORKSHOP',
    customerName: '',
    customerPhone: '',
    customerEmail: ''
  });

  const [images, setImages] = React.useState<Array<{ imageUrl: string; fileName: string }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [submitted, setSubmitted] = React.useState<Any | null>(null);

  const categories = [
    { id: 'SMARTPHONE', label: 'Celular / Teléfono', icon: '📱' },
    { id: 'LAPTOP', label: 'Laptop / Portátil', icon: '💻' },
    { id: 'TABLET', label: 'Tablet / iPad', icon: '📲' },
    { id: 'CONSOLE', label: 'Consola Videojuegos', icon: '🎮' },
    { id: 'DESKTOP', label: 'PC Torre / Escritorio', icon: '🖥️' },
    { id: 'SMARTWATCH', label: 'Smartwatch', icon: '⌚' },
    { id: 'OTHER', label: 'Otro Equipo Electrónico', icon: '🔌' }
  ];

  const ecuadorCities = [
    'Quito', 'Guayaquil', 'Cuenca', 'Ambato', 'Santo Domingo',
    'Machala', 'Loja', 'Manta', 'Portoviejo', 'Ibarra', 'Riobamba', 'Esmeraldas', 'Quevedo', 'Latacunga'
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) {
      alert('Puedes subir hasta 5 fotos como máximo.');
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setImages(prev => [...prev, { imageUrl: String(ev.target?.result), fileName: file.name }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) { setError('Por favor ingresa tu nombre'); return; }
    if (!form.customerPhone.trim()) { setError('Por favor ingresa tu WhatsApp de contacto'); return; }
    if (!form.deviceBrand.trim() || !form.deviceModel.trim()) { setError('Ingresa la marca y modelo del equipo'); return; }
    if (!form.faultDescription.trim()) { setError('Describe la falla o lo que le ocurre a tu equipo'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/public/marketplace/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          images
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Error al enviar solicitud');
      }

      const data = await res.json();
      try {
        localStorage.fixmeCustomerPhone = form.customerPhone.trim();
        localStorage.fixmeCustomerName = form.customerName.trim();
      } catch (e) {}
      setSubmitted(data);
    } catch (err: any) {
      setError(err.message || 'No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '30px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ maxWidth: 540, width: '100%', background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>¡Solicitud Publicada con Éxito!</h2>
          <p style={{ color: '#475569', fontSize: 14, margin: '0 0 20px' }}>
            Tu requerimiento ha sido distribuido a los talleres especializados en <b>{form.city}</b>. Tu cuenta de cliente ha sido vinculada automáticamente.
          </p>

          <div style={{ background: '#f1f5f9', borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Código de Solicitud</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb', margin: '4px 0 8px' }}>{submitted.requestCode}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Dispositivo: <b>{form.deviceBrand} {form.deviceModel}</b> ({form.deviceCategory})<br/>
              Contacto: <b>{form.customerName}</b> · WhatsApp: <b>{form.customerPhone}</b>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              className="primary-action"
              style={{ padding: '12px 20px', fontSize: 14, justifyContent: 'center', background: '#059669', borderColor: '#059669' }}
              onClick={() => {
                window.location.hash = `#solicitud/${submitted.requestCode}?token=${submitted.accessToken}`;
              }}
            >
              👀 Ver Cotizaciones y Ofertas en Vivo
            </button>
            <button
              type="button"
              className="secondary-action"
              style={{ padding: '12px 20px', fontSize: 14, justifyContent: 'center', background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}
              onClick={() => {
                window.location.hash = '#portal-cliente';
              }}
            >
              📱 Ir a Mi Portal del Cliente 360 →
            </button>
            {onBack && (
              <button
                type="button"
                className="secondary-action"
                style={{ padding: '10px 20px', fontSize: 13, justifyContent: 'center' }}
                onClick={onBack}
              >
                Volver al Inicio
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>FixmeTiendas · Red de Talleres</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '2px 0 0' }}>🛠️ Solicita Cotización de Reparación</h1>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{ background: '#e2e8f0', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#334155' }}
            >
              ✕ Cerrar
            </button>
          )}
        </div>

        <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 24px' }}>
          Describe la avería de tu equipo, sube fotos de la falla y recibe ofertas competitivas con precio y garantía de los mejores talleres especializados en tu ciudad.
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Card 1: Tipo de Dispositivo */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 14px', color: '#1e293b' }}>1. ¿Qué equipo necesitas reparar?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 16 }}>
              {categories.map(c => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setForm({ ...form, deviceCategory: c.id })}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 10,
                    border: form.deviceCategory === c.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: form.deviceCategory === c.id ? '#eff6ff' : '#fff',
                    color: form.deviceCategory === c.id ? '#1d4ed8' : '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: form.deviceCategory === c.id ? 800 : 500,
                    textAlign: 'center'
                  }}
                >
                  <span style={{ fontSize: 22 }}>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Marca *</label>
                <input
                  type="text"
                  placeholder="Ej: Apple, Samsung, Xiaomi, HP, Sony"
                  value={form.deviceBrand}
                  onChange={e => setForm({ ...form, deviceBrand: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Modelo *</label>
                <input
                  type="text"
                  placeholder="Ej: iPhone 13 Pro, Galaxy S22, PS5"
                  value={form.deviceModel}
                  onChange={e => setForm({ ...form, deviceModel: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>¿El equipo enciende actualmente?</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="powersOn"
                    checked={form.powersOn === true}
                    onChange={() => setForm({ ...form, powersOn: true })}
                  />
                  <span>✅ Sí, enciende</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="powersOn"
                    checked={form.powersOn === false}
                    onChange={() => setForm({ ...form, powersOn: false })}
                  />
                  <span>❌ No enciende / Apagado total</span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Descripción de la Falla o Problema *</label>
              <textarea
                rows={3}
                placeholder="Explica qué ocurrió: Se cayó la pantalla, no carga el puerto, se reinicia solo, cayó líquido, etc."
                value={form.faultDescription}
                onChange={e => setForm({ ...form, faultDescription: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                required
              />
            </div>
          </div>

          {/* Card 2: Subida de Fotos */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 6px', color: '#1e293b' }}>📸 Fotos del Equipo y la Avería</h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px' }}>
              Sube fotos claras del estado físico (pantalla rota, puerto dañado, luz de error). Los talleres podrán cotizarte con mayor precisión.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              {images.map((img, idx) => (
                <div key={idx} style={{ position: 'relative', width: 90, height: 90, borderRadius: 10, overflow: 'hidden', border: '2px solid #e2e8f0', background: '#000' }}>
                  <img src={img.imageUrl} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    style={{
                      position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.9)',
                      color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22,
                      display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 11, cursor: 'pointer'
                    }}
                    title="Eliminar foto"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {images.length < 5 && (
                <label style={{
                  width: 90, height: 90, borderRadius: 10, border: '2px dashed #94a3b8',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                  background: '#f8fafc', cursor: 'pointer', color: '#64748b', fontSize: 11, textAlign: 'center', padding: 4
                }}>
                  <span style={{ fontSize: 24, marginBottom: 2 }}>📷</span>
                  <span>Añadir Foto</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          </div>

          {/* Card 3: Ubicación y Modalidad */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 14px', color: '#1e293b' }}>📍 Tu Ubicación y Preferencia de Servicio</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Ciudad *</label>
                <select
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                >
                  {ecuadorCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Sector / Barrio</label>
                <input
                  type="text"
                  placeholder="Ej: La Carolina, Cumbayá, Urdesa"
                  value={form.neighborhood}
                  onChange={e => setForm({ ...form, neighborhood: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Dirección o Referencia</label>
              <input
                type="text"
                placeholder="Ej: Av. República del Salvador y Moscú, Edificio Centro"
                value={form.customerAddress}
                onChange={e => setForm({ ...form, customerAddress: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>¿Cómo prefieres coordinar la reparación?</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {[
                  { id: 'WORKSHOP', icon: '🏪', title: 'Lo llevo a la tienda', desc: 'Te acercas al local seleccionado' },
                  { id: 'HOME_PICKUP', icon: '🛵', title: 'Retiro a domicilio', desc: 'El taller retira el equipo' },
                  { id: 'HOME_SERVICE', icon: '🔧', title: 'Servicio a domicilio', desc: 'Técnico visita tu domicilio' }
                ].map(m => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setForm({ ...form, deliveryPreference: m.id })}
                    style={{
                      padding: '12px 10px',
                      borderRadius: 10,
                      border: form.deliveryPreference === m.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: form.deliveryPreference === m.id ? '#eff6ff' : '#fff',
                      color: form.deliveryPreference === m.id ? '#1d4ed8' : '#334155',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 12
                    }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 2 }}>{m.icon} <b>{m.title}</b></div>
                    <small style={{ color: '#64748b', display: 'block' }}>{m.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 4: Datos de Contacto */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 14px', color: '#1e293b' }}>👤 Tus Datos de Contacto</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Tu Nombre Completo *</label>
                <input
                  type="text"
                  placeholder="Ej: Mateo Morales"
                  value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>WhatsApp / Celular *</label>
                <input
                  type="tel"
                  placeholder="Ej: 0991234567"
                  value={form.customerPhone}
                  onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="primary-action"
            disabled={loading}
            style={{
              padding: '14px 24px', fontSize: 15, fontWeight: 800,
              justifyContent: 'center', background: '#2563eb', borderColor: '#2563eb',
              boxShadow: '0 4px 6px -1px rgba(37,99,235,0.3)', cursor: 'pointer'
            }}
          >
            {loading ? 'Publicando Solicitud...' : '🚀 Publicar Solicitud y Recibir Cotizaciones'}
          </button>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// 6. PUBLIC LEAD TRACKING (CLIENTE COMPARA OFERTAS Y ACEPTA EN 1 CLIC)
// =========================================================================
export function PublicLeadTracking({ code, onBack }: { code: string; onBack?: () => void }) {
  const [data, setData] = React.useState<Any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [acceptingId, setAcceptingId] = React.useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = React.useState<string | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<Any | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/public/marketplace/requests/${code}`)
      .then(r => {
        if (!r.ok) throw new Error('No se encontró la solicitud especificada');
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleAcceptBid = async (bidId: string) => {
    if (!confirm('¿Deseas aceptar esta cotización? Se creará tu orden de servicio en el taller seleccionado y se abrirá WhatsApp para coordinar.')) return;
    setAcceptingId(bidId);
    try {
      const res = await fetch(`/api/public/marketplace/requests/${code}/accept-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al aceptar cotización');
      }
      const resp = await res.json();
      setSuccessInfo(resp);
      if (data?.customer_phone) {
        try { localStorage.setItem('fixmeCustomerPhone', data.customer_phone); } catch {}
      }
      load(); // Refrescar estado
      if (resp.whatsappUrl) {
        window.open(resp.whatsappUrl, '_blank');
      }
    } catch (e: any) {
      alert(e.message || 'No se pudo procesar la aceptación');
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔄</div>
          <div>Cargando cotizaciones para tu solicitud...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc', padding: 20 }}>
        <div style={{ maxWidth: 440, background: '#fff', padding: 30, borderRadius: 14, textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🔍</div>
          <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>Solicitud no encontrada</h3>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{error || 'El código ingresado no existe o ha expirado.'}</p>
          {onBack && (
            <button type="button" className="primary-action" onClick={onBack} style={{ justifyContent: 'center' }}>
              Volver
            </button>
          )}
        </div>
      </div>
    );
  }

  const rawBids: Any[] = data.bids || [];
  const images: Any[] = data.images || [];
  const isAccepted = data.status === 'ACCEPTED' || Boolean(data.selected_bid_id);
  const bids: Any[] = isAccepted ? rawBids.filter(b => b.status === 'ACCEPTED' || b.id === data.selected_bid_id) : rawBids;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: 40, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Navbar */}
      <div style={{ background: '#0f172a', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Portal de Cotizaciones</div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Solicitud #{data.request_code}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={load}
            style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
          >
            🔄 Actualizar
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{ background: '#334155', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
            >
              ✕ Cerrar
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '24px auto', padding: '0 16px' }}>
        {/* Banner de confirmación si fue aceptada recién */}
        {successInfo && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 6px', color: '#065f46', fontSize: 16 }}>🎉 ¡Cotización Aceptada!</h3>
            <p style={{ margin: '0 0 12px', color: '#047857', fontSize: 13 }}>
              Se ha generado tu Orden de Trabajo <b>#{successInfo.orderNumber}</b> en <b>{successInfo.storeName}</b>.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {successInfo.whatsappUrl && (
                <a
                  href={successInfo.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, background: '#059669', color: '#fff',
                    textDecoration: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 800
                  }}
                >
                  💬 Abrir Chat de WhatsApp con el Taller
                </a>
              )}
              <a
                href="#portal-cliente"
                onClick={() => {
                  if (data?.customer_phone) {
                    try { localStorage.setItem('fixmeCustomerPhone', data.customer_phone); } catch {}
                  }
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff',
                  textDecoration: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 800
                }}
              >
                👤 Ver mi Orden en el Portal Clientes 360° →
              </a>
            </div>
          </div>
        )}

        {/* Banner si la solicitud ya estaba previamente aceptada */}
        {!successInfo && isAccepted && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1e40af' }}>✅ Solicitud asignada a taller y en ejecución</div>
              <div style={{ fontSize: 12.5, color: '#3b82f6', marginTop: 2 }}>Puedes ver el timeline, aprobar repuestos adicionales y consultar tus garantías en tu Portal de Cliente.</div>
            </div>
            <a
              href="#portal-cliente"
              onClick={() => {
                if (data?.customer_phone) {
                  try { localStorage.setItem('fixmeCustomerPhone', data.customer_phone); } catch {}
                }
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff',
                textDecoration: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 800
              }}
            >
              👤 Ir a Mi Portal 360° →
            </a>
          </div>
        )}

        {/* Resumen de la Solicitud */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div>
              <span style={{
                background: isAccepted ? '#dcfce7' : '#eff6ff',
                color: isAccepted ? '#15803d' : '#1d4ed8',
                fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase'
              }}>
                {isAccepted ? '✅ Aceptada · En Proceso' : (bids.length > 0 ? `💰 ${bids.length} Oferta(s) Recibida(s)` : '🟢 En Búsqueda de Talleres')}
              </span>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: '6px 0 2px' }}>
                📱 {data.device_brand} {data.device_model}
              </h2>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                📍 {data.city} {data.neighborhood ? `· ${data.neighborhood}` : ''} · Modalidad: {data.delivery_preference === 'WORKSHOP' ? '🏪 Entrega en Tienda' : '🛵 Retiro a Domicilio'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Cliente</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{data.customer_name}</div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 13, color: '#334155', border: '1px solid #f1f5f9', marginBottom: 14 }}>
            <b>Falla reportada:</b> {data.fault_description}
          </div>

          {/* Fotos subidas */}
          {images.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Fotos adjuntas ({images.length}):</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {images.map((img: Any) => (
                  <img
                    key={img.id}
                    src={img.imageUrl}
                    alt={img.fileName || 'Foto'}
                    onClick={() => setLightboxImg(img.imageUrl)}
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sección de Cotizaciones de Talleres */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: isAccepted ? '#065f46' : '#0f172a', margin: 0 }}>
              {isAccepted ? '🏆 Taller Asignado & Cotización Seleccionada' : `🏢 Cotizaciones de Talleres Especializados (${bids.length})`}
            </h3>
            <span style={{ fontSize: 12, color: isAccepted ? '#059669' : '#64748b' }}>
              {isAccepted ? 'Decisión tomada · Las demás cotizaciones fueron descartadas' : 'Precios competitivos y garantía por escrito'}
            </span>
          </div>

          {bids.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 14, padding: 36, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
              <h4 style={{ margin: '0 0 6px', color: '#1e293b' }}>Buscando las mejores ofertas para tu equipo...</h4>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                Notificamos a los talleres especializados en tu ciudad. En pocos minutos comenzarán a aparecer sus presupuestos detallados en esta pantalla.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {bids.map((b: Any) => {
                const isThisAccepted = b.status === 'ACCEPTED';
                return (
                  <div
                    key={b.id}
                    style={{
                      background: '#fff',
                      borderRadius: 14,
                      padding: 20,
                      border: isThisAccepted ? '2px solid #059669' : '1px solid #e2e8f0',
                      boxShadow: isThisAccepted ? '0 10px 15px -3px rgba(5,150,105,0.1)' : '0 2px 4px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h4 style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', margin: 0 }}>{b.store_name}</h4>
                          <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                            ✓ Verificado
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          📍 {b.store_address || 'Taller Técnico'} {b.store_phone ? `· 📞 ${b.store_phone}` : ''}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb' }}>
                          ${Number(b.estimated_cost).toFixed(2)}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Precio final estimado</div>
                      </div>
                    </div>

                    {/* Chips de Propuesta */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                      <span style={{ background: '#f1f5f9', color: '#334155', fontSize: 12, padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
                        ⏱️ Tiempo: <b>{b.estimated_time}</b>
                      </span>
                      {b.warranty_terms && (
                        <span style={{ background: '#ecfdf5', color: '#065f46', fontSize: 12, padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
                          🛡️ {b.warranty_terms}
                        </span>
                      )}
                      {b.spare_part_quality && (
                        <span style={{ background: '#faf5ff', color: '#6b21a8', fontSize: 12, padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
                          ✨ {b.spare_part_quality}
                        </span>
                      )}
                    </div>

                    {b.proposal_notes && (
                      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569', fontStyle: 'italic', background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                        "{b.proposal_notes}"
                      </p>
                    )}

                    {/* Botón de Aceptación */}
                    <div>
                      {isThisAccepted ? (
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span style={{ background: '#059669', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 800 }}>
                            ✅ Cotización Aceptada
                          </span>
                          {b.store_phone && (
                            <a
                              href={`https://wa.me/${b.store_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${b.store_name}, acepté su cotización para mi ${data.device_brand} ${data.device_model}.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: '#25d366', color: '#fff', padding: '8px 16px', borderRadius: 8,
                                textDecoration: 'none', fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6
                              }}
                            >
                              💬 WhatsApp
                            </a>
                          )}
                        </div>
                      ) : (
                        !isAccepted && (
                          <button
                            type="button"
                            className="primary-action"
                            disabled={acceptingId === b.id}
                            onClick={() => handleAcceptBid(b.id)}
                            style={{
                              padding: '10px 18px', fontSize: 13, fontWeight: 800,
                              background: '#059669', borderColor: '#059669', justifyContent: 'center'
                            }}
                          >
                            {acceptingId === b.id ? 'Aceptando...' : '🤝 Aceptar Cotización y Chatear por WhatsApp'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox para ver fotos en grande */}
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
    </div>
  );
}


