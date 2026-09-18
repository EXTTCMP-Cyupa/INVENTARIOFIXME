import React from 'react';import{createRoot}from'react-dom/client';import'./style.css';
type Any=Record<string,any>;const tenantId='00000000-0000-0000-0000-000000000001',branchId='00000000-0000-0000-0000-000000000010';
const nav=[['cash','Caja','C'],['pos','Punto de venta','V'],['sales','Ventas','VT'],['administration','Empresa','E'],['home','Resumen','R'],['products','Inventario','I'],['customers','Clientes','CL'],['deliveries','Entregas','D'],['work-orders','Ordenes de servicio','OT'],['warranties','Garantias','G'],['reports','Reportes','RE']];
function App(){const[token,setToken]=React.useState(localStorage.token||''),[page,setPage]=React.useState('home'),[mods,setMods]=React.useState<Any[]>([]),[toast,setToast]=React.useState(''),[menuOpen,setMenuOpen]=React.useState(false);let role='';try{const claims=token?JSON.parse(atob(token.split('.')[1])):{};role=(claims.scope||'').replace('SCOPE_','').split(' ')[0]}catch{}const allowed:Record<string,string[]>={SUPER_ADMIN:nav.map(n=>n[0]),TENANT_ADMIN:nav.map(n=>n[0]),MANAGER:['home','cash','pos','sales','administration','products','customers','deliveries','work-orders','warranties','reports'],SELLER:['home','cash','pos','sales','products','customers','work-orders','warranties'],DELIVERY:['home','customers','deliveries'],TECHNICIAN:['home','customers','work-orders','warranties'],ACCOUNTANT:['home','cash','sales','reports']};const groups:[string,string[]][]=[['VENTAS',['pos','sales','cash','deliveries']],['OPERACION',['products','customers','work-orders','warranties']],['GESTION',['reports','administration']]];const api=React.useCallback((url:string,opt:RequestInit={})=>fetch(url,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token}}),[token]);const canReadModules=['SUPER_ADMIN','TENANT_ADMIN','MANAGER'].includes(role);React.useEffect(()=>{if(token&&canReadModules)api('/api/modules').then(r=>r.ok?r.json():[]).then(setMods)},[token,api,canReadModules]);const moduleKey=(item:string)=>item==='cash'?'CASH_REGISTER':item==='products'?'INVENTORY':(item==='warranties'?'POS':item.toUpperCase()).replace('-','_');const enabled=(key:string)=>!canReadModules||mods.length===0||mods.some(m=>m.moduleKey===key&&m.enabled);if(!token)return <Login onLogin={t=>{localStorage.token=t;setToken(t)}}/>;function go(k:string){setPage(k);setMenuOpen(false)}const visible=allowed[role]||['home'];const item=(key:string)=>nav.find(n=>n[0]===key);return <div className="shell"><button className="mobile-menu" aria-label="Abrir menú" onClick={()=>setMenuOpen(!menuOpen)}>☰</button><aside className={menuOpen?'drawer-open':''}><div className="brand"><b>F</b> Fixme<span>Tiendas</span></div><div className="branch-switch"><small>SUCURSAL ACTUAL</small><strong>Principal</strong><span>● Operativa</span></div><button className={page==='home'?'nav-item active':'nav-item'} onClick={()=>go('home')}><i>R</i>Resumen</button>{groups.map(g=><section className="nav-group" key={g[0]}><small>{g[0]}</small>{g[1].map(k=>{const n=item(k);return n&&visible.includes(k)&&(k==='administration'||enabled(moduleKey(k)))?<button className={page===k?'nav-item active':'nav-item'} onClick={()=>go(k)} key={k}><i>{n[2]}</i>{n[1]}</button>:null})}</section>)}<div className="sidebar-user"><div className="user-avatar">{role.slice(0,1)||'U'}</div><div><strong>{role||'USUARIO'}</strong><small>Sesión activa</small></div><button aria-label="Cerrar sesión" onClick={()=>{localStorage.clear();setToken('');setPage('home')}}>↪</button></div></aside><main><header className="app-header"><div><small>{role||'USUARIO'} · DEMO TENANT</small><h1>{item(page)?.[1]||'Acceso denegado'}</h1><p className="header-subtitle">Sucursal Principal <span>•</span> Información actualizada</p></div><div className="header-actions"><button className="header-icon" aria-label="Notificaciones">●</button><div className="header-avatar">{role.slice(0,1)||'U'}</div></div></header>{toast&&<div className="toast" onClick={()=>setToast('')}><b>✓</b>{toast}</div>}{page==='home'&&visible.includes('home')?<Dashboard api={api} go={go} role={role}/>:page==='cash'&&visible.includes('cash')?<Cash api={api} notify={setToast}/>:page==='pos'&&visible.includes('pos')?<POS api={api} notify={setToast}/>:page==='sales'&&visible.includes('sales')?<Sales api={api}/>:page==='administration'&&visible.includes('administration')?((role==='TENANT_ADMIN'||role==='SUPER_ADMIN')?<PlatformAdministration api={api}/>:<Administration api={api}/>):page==='products'&&visible.includes('products')?<Products api={api} role={role}/>:page==='customers'&&visible.includes('customers')?<Customers api={api} notify={setToast}/>:page==='deliveries'&&visible.includes('deliveries')?<Deliveries api={api}/>:page==='work-orders'&&visible.includes('work-orders')?<Orders api={api}/>:page==='reports'&&visible.includes('reports')?<Reports api={api}/>:page==='warranties'&&visible.includes('warranties')?<Warranties api={api}/>:<section className="panel"><h3>Acceso denegado</h3><p>No tienes permisos para esta sección.</p></section>}<nav className="mobile-nav">{nav.filter(n=>visible.includes(n[0])).slice(0,5).map(n=><button className={page===n[0]?'active':''} onClick={()=>go(n[0])} key={n[0]}><i>{n[2]}</i><small>{n[1]}</small></button>)}</nav></main></div>}
function Login({onLogin}:{onLogin:(t:string)=>void}){const[email,setEmail]=React.useState('demo@fixme.local'),[password,setPassword]=React.useState('password'),[error,setError]=React.useState('');async function submit(e:React.FormEvent){e.preventDefault();const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId,email,password})});if(r.ok)onLogin((await r.json()).accessToken);else setError('No pudimos validar tus credenciales.')}return <div className="login"><div className="login-card"><div className="logo">FX</div><h1>Bienvenido a Fixme<span>Tiendas</span></h1><p>Gestiona tu negocio desde un solo lugar.</p><form onSubmit={submit}><label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button>Iniciar sesión</button>{error&&<em>{error}</em>}</form></div></div>}
function Cash({api,notify}:{api:(u:string,o?:RequestInit)=>Promise<Response>,notify:(s:string)=>void}){const[s,setS]=React.useState<Any|null>(null),[history,setHistory]=React.useState<Any[]>([]),[opening,setOpening]=React.useState('100'),[counted,setCounted]=React.useState(''),[movement,setMovement]=React.useState({type:'CASH_IN',paymentMethod:'CASH',amount:'',reason:''});const load=React.useCallback(()=>{api('/api/cash/current?branchId='+branchId).then(r=>r.json()).then(x=>setS(x&&x.id?x:null));api('/api/cash/movements?branchId='+branchId).then(r=>r.ok?r.json():[]).then(setHistory)},[api]);React.useEffect(()=>{load()},[load]);async function open(){const r=await api('/api/cash/open?branchId='+branchId,{method:'POST',body:JSON.stringify({openingCash:Number(opening),amounts:{CASH:Number(opening)}})});if(r.ok){notify('Caja abierta');load()}}async function move(){const r=await api('/api/cash/movement?branchId='+branchId,{method:'POST',body:JSON.stringify({...movement,amount:Number(movement.amount)})});if(r.ok){notify('Movimiento registrado');setMovement({...movement,amount:'',reason:''});load()}}async function close(){const r=await api('/api/cash/close?branchId='+branchId,{method:'POST',body:JSON.stringify({counted:{CASH:Number(counted||0),CARD:Number(s&&s.expected&&s.expected.CARD||0)}})});if(r.ok){notify('Caja cerrada');load()}}return <section className="panel"><h3>Caja</h3>{!s?<div className="inline-form"><p>No hay una sesi?n abierta.</p><input type="number" value={opening} onChange={e=>setOpening(e.target.value)}/><button onClick={open}>Abrir caja</button></div>:<><div className="kpis"><Kpi label="Efectivo esperado" value={'$'+Number(s.expected&&s.expected.CASH||0).toFixed(2)} trend="Sesi?n activa"/><Kpi label="Tarjeta" value={'$'+Number(s.expected&&s.expected.CARD||0).toFixed(2)} trend="No efectivo"/></div><div className="panel cash-movement"><h4>Registrar movimiento</h4><div className="form-grid"><select value={movement.type} onChange={e=>setMovement({...movement,type:e.target.value})}><option value="CASH_IN">Entrada de efectivo</option><option value="CASH_OUT">Salida de efectivo</option></select><select value={movement.paymentMethod} onChange={e=>setMovement({...movement,paymentMethod:e.target.value})}><option>CASH</option><option>CARD</option><option>TRANSFER</option><option>OTHER</option></select><input type="number" min="0.01" placeholder="Monto" value={movement.amount} onChange={e=>setMovement({...movement,amount:e.target.value})}/><input placeholder="Motivo" value={movement.reason} onChange={e=>setMovement({...movement,reason:e.target.value})}/><button onClick={move}>Registrar</button></div></div><div className="inline-form"><input type="number" value={counted} onChange={e=>setCounted(e.target.value)} placeholder="Efectivo contado"/><button onClick={close}>Cerrar y arquear</button></div><h4>Historial de movimientos</h4><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Método</th><th>Monto</th><th>Motivo</th></tr></thead><tbody>{history.map((m:Any)=><tr key={m.id}><td>{new Date(m.created_at).toLocaleString()}</td><td>{m.type}</td><td>{m.payment_method}</td><td>${Number(m.amount).toFixed(2)}</td><td>{m.reason||''}</td></tr>)}</tbody></table></div></>}</section>}
function POS({api,notify}:{api:(u:string,o?:RequestInit)=>Promise<Response>,notify:(s:string)=>void}){
  const [products, setProducts] = React.useState<Any[]>([]);
  const [customers, setCustomers] = React.useState<Any[]>([]);
  const [cats, setCats] = React.useState<Any[]>([]);
  const [cart, setCart] = React.useState<Any[]>([]);
  const [search, setSearch] = React.useState('');
  const [selectedCat, setSelectedCat] = React.useState('');

  // Omnichannel & Delivery states
  const [channel, setChannel] = React.useState<'STORE'|'ONLINE'>('STORE');
  const [fulfillment, setFulfillment] = React.useState<'PICKUP'|'DELIVERY'>('PICKUP');
  const [delivery, setDelivery] = React.useState({
    recipientName: '',
    recipientPhone: '',
    address: '',
    notes: '',
    courier: '',
    shippingCost: '0'
  });

  const [customerId, setCustomerId] = React.useState('');
  const [warrantyDays, setWarrantyDays] = React.useState('0');

  // Payment methods
  const [payMethod, setPayMethod] = React.useState<'CASH'|'CARD'|'TRANSFER'|'SPLIT'>('CASH');
  const [cashTendered, setCashTendered] = React.useState('');
  const [splitAmounts, setSplitAmounts] = React.useState({ CASH: '', CARD: '', TRANSFER: '' });

  const [busy, setBusy] = React.useState(false);
  const [receiptModal, setReceiptModal] = React.useState<Any|null>(null);

  const load = React.useCallback(() => {
    api(`/api/products?branchId=${branchId}`).then(r => r.ok ? r.json() : []).then(setProducts);
    api('/api/customers').then(r => r.ok ? r.json() : []).then(setCustomers);
    api('/api/categories').then(r => r.ok ? r.json() : []).then(setCats);
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  const add = (p: Any) => setCart(c => {
    const x = c.find(i => i.id === p.id);
    return x
      ? c.map(i => i.id === p.id ? { ...i, quantity: Math.min(Number(i.stock), i.quantity + 1) } : i)
      : [...c, { ...p, quantity: 1 }];
  });

  const updateQty = (id: string, delta: number) => {
    setCart(c => c.map(i => {
      if (i.id === id) {
        const next = i.quantity + delta;
        return next > 0 && next <= Number(i.stock) ? { ...i, quantity: next } : i;
      }
      return i;
    }));
  };

  const removeItem = (id: string) => setCart(c => c.filter(i => i.id !== id));

  const subtotal = cart.reduce((n, i) => n + Number(i.price) * i.quantity, 0);
  const shippingFee = fulfillment === 'DELIVERY' ? Number(delivery.shippingCost || 0) : 0;
  const grandTotal = subtotal + shippingFee;

  const tenderedVal = Number(cashTendered || 0);
  const changeVal = tenderedVal >= grandTotal ? tenderedVal - grandTotal : 0;

  // Auto-fill delivery info from selected customer
  const fillCustomerData = () => {
    const c = customers.find(x => x.id === customerId);
    if (c) {
      setDelivery(d => ({
        ...d,
        recipientName: c.name || '',
        recipientPhone: c.phone || '',
        address: c.address || ''
      }));
    }
  };

  async function checkout() {
    if (!cart.length || busy) return;
    if (fulfillment === 'DELIVERY' && (!delivery.address || !delivery.address.trim())) {
      notify('Por favor ingresa la dirección de entrega a domicilio');
      return;
    }

    let paymentsPayload: Array<{ method: string, amount: number }> = [];
    if (payMethod === 'SPLIT') {
      const pList = Object.entries(splitAmounts)
        .filter(([_, val]) => Number(val) > 0)
        .map(([m, val]) => ({ method: m, amount: Number(val) }));
      const sum = pList.reduce((acc, p) => acc + p.amount, 0);
      if (sum < grandTotal) {
        notify(`Los montos divididos ($${sum.toFixed(2)}) no cubren el total ($${grandTotal.toFixed(2)})`);
        return;
      }
      paymentsPayload = pList;
    } else {
      paymentsPayload = [{ method: payMethod, amount: grandTotal }];
    }

    setBusy(true);
    const body = {
      branchId,
      customerId: customerId || null,
      warrantyDays: Number(warrantyDays || 0),
      channel,
      fulfillmentType: fulfillment,
      shippingCost: shippingFee,
      delivery: fulfillment === 'DELIVERY' ? {
        recipientName: delivery.recipientName,
        recipientPhone: delivery.recipientPhone,
        address: delivery.address,
        notes: delivery.notes,
        courier: delivery.courier,
        shippingCost: shippingFee
      } : null,
      items: cart.map(i => ({ productId: i.id, quantity: i.quantity })),
      payments: paymentsPayload
    };

    const r = await api('/api/sales', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    setBusy(false);

    if (r.ok) {
      const createdSale = await r.json();
      notify('¡Venta registrada con éxito!');
      const selCustomer = customers.find(c => c.id === customerId);
      setReceiptModal({
        sale: createdSale,
        items: [...cart],
        subtotal,
        shippingFee,
        grandTotal,
        channel,
        fulfillment,
        delivery: { ...delivery },
        customer: selCustomer,
        payMethod,
        cashTendered: payMethod === 'CASH' ? tenderedVal : null,
        change: payMethod === 'CASH' ? changeVal : null,
        payments: paymentsPayload
      });
      setCart([]);
      setCashTendered('');
      setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
      load();
    } else {
      notify(await r.text() || 'No se pudo registrar la venta');
    }
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = !search || `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !selectedCat || p.category_id === selectedCat || p.categoryId === selectedCat;
    return matchesSearch && matchesCat;
  });

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">PUNTO DE VENTA PROFESIONAL</span>
          <h3>Terminal de Ventas y Despacho</h3>
          <p>Registra ventas presenciales u online con entrega a domicilio y múltiples formas de pago.</p>
        </div>
      </div>

      <div className="pos-grid">
        {/* CATALOG PANEL */}
        <div>
          {/* SEARCH & CATEGORY CHIPS */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div className="search-box" style={{ flex: 1, minWidth: '220px' }}>
              <span>🔍</span>
              <input
                placeholder="Buscar por producto o SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                className={`filter-pill ${selectedCat === '' ? 'active' : ''}`}
                onClick={() => setSelectedCat('')}
              >
                Todos
              </button>
              {cats.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`filter-pill ${selectedCat === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedCat(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="product-grid">
            {filteredProducts.map(p => (
              <button
                key={p.id}
                disabled={!p.stock}
                onClick={() => add(p)}
                style={{
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: p.stock ? 'pointer' : 'not-allowed',
                  opacity: p.stock ? 1 : 0.6,
                  transition: 'transform .15s, box-shadow .15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <small style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700 }}>{p.sku}</small>
                  <span className={Number(p.stock) > 0 ? 'stock-badge' : 'stock-badge empty-stock'}>
                    {Number(p.stock) > 0 ? `${p.stock} disp.` : 'Agotado'}
                  </span>
                </div>
                <strong style={{ fontSize: '13px', color: '#1e293b', marginBottom: '6px', lineHeight: 1.3 }}>
                  {p.name}
                </strong>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#3157d5', marginTop: 'auto' }}>
                  ${Number(p.price).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* CART & CHECKOUT PANEL */}
        <div className="cart">
          {/* CHANNEL SELECTOR */}
          <div>
            <label style={{ marginBottom: '6px', display: 'block' }}>Canal de Venta</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${channel === 'STORE' ? 'active' : ''}`}
                onClick={() => setChannel('STORE')}
              >
                🏪 Local
              </button>
              <button
                type="button"
                className={`toggle-btn ${channel === 'ONLINE' ? 'active' : ''}`}
                onClick={() => setChannel('ONLINE')}
              >
                🌐 Internet / WhatsApp
              </button>
            </div>
          </div>

          {/* FULFILLMENT SELECTOR */}
          <div>
            <label style={{ marginBottom: '6px', display: 'block' }}>Modalidad de Entrega</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${fulfillment === 'PICKUP' ? 'active' : ''}`}
                onClick={() => setFulfillment('PICKUP')}
              >
                🏬 Retiro en tienda
              </button>
              <button
                type="button"
                className={`toggle-btn ${fulfillment === 'DELIVERY' ? 'active' : ''}`}
                onClick={() => setFulfillment('DELIVERY')}
              >
                🛵 Domicilio
              </button>
            </div>
          </div>

          {/* DELIVERY FIELDS IF DELIVERY */}
          {fulfillment === 'DELIVERY' && (
            <div className="delivery-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '12px', color: '#1e293b' }}>📦 Datos de Despacho</strong>
                {customerId && (
                  <button
                    type="button"
                    onClick={fillCustomerData}
                    style={{ border: 0, background: 'transparent', color: '#3157d5', fontSize: '11px', fontWeight: 700 }}
                  >
                    Usar datos de cliente
                  </button>
                )}
              </div>
              <input
                placeholder="Dirección completa de entrega *"
                value={delivery.address}
                onChange={e => setDelivery({ ...delivery, address: e.target.value })}
                required
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  placeholder="Destinatario"
                  value={delivery.recipientName}
                  onChange={e => setDelivery({ ...delivery, recipientName: e.target.value })}
                  style={{ flex: 1 }}
                />
                <input
                  placeholder="Teléfono"
                  value={delivery.recipientPhone}
                  onChange={e => setDelivery({ ...delivery, recipientPhone: e.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  placeholder="Referencias / Notas (ej. Torre B, Timbre 4)"
                  value={delivery.notes}
                  onChange={e => setDelivery({ ...delivery, notes: e.target.value })}
                  style={{ flex: 2 }}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Flete ($)"
                  value={delivery.shippingCost}
                  onChange={e => setDelivery({ ...delivery, shippingCost: e.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          )}

          {/* CUSTOMER & WARRANTY */}
          <label>
            Cliente registrado (opcional)
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Consumidor Final (Sin cliente)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone || c.email || 'sin contacto'}
                </option>
              ))}
            </select>
          </label>

          <label>
            Garantía comercial
            <select value={warrantyDays} onChange={e => setWarrantyDays(e.target.value)} disabled={!customerId}>
              <option value="0">Sin garantía</option>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
              <option value="180">180 días</option>
              <option value="365">1 año</option>
            </select>
          </label>

          {/* CART ITEMS LIST */}
          <div style={{ maxHeight: '180px', overflowY: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
            {cart.map(i => (
              <div key={i.id} className="cart-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{i.name}</div>
                  <small style={{ color: '#64748b' }}>${Number(i.price).toFixed(2)} c/u</small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    style={{ padding: '2px 7px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
                    onClick={() => updateQty(i.id, -1)}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 700 }}>{i.quantity}</span>
                  <button
                    type="button"
                    style={{ padding: '2px 7px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
                    onClick={() => updateQty(i.id, 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    style={{ border: 0, background: 'transparent', color: '#ef4444', fontWeight: 'bold' }}
                    onClick={() => removeItem(i.id)}
                  >
                    ✕
                  </button>
                </div>
                <strong style={{ minWidth: '60px', textAlign: 'right' }}>
                  ${(Number(i.price) * i.quantity).toFixed(2)}
                </strong>
              </div>
            ))}
            {!cart.length && <p className="empty" style={{ padding: '20px 0' }}>Agrega productos al ticket.</p>}
          </div>

          {/* TOTAL BREAKDOWN */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {shippingFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                <span>Envío a domicilio:</span>
                <span>${shippingFee.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 800, color: '#3157d5', marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
              <span>Total:</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* PAYMENT METHODS SELECTOR */}
          <div>
            <label style={{ marginBottom: '6px', display: 'block' }}>Forma de Pago</label>
            <div className="pay-grid">
              <button
                type="button"
                className={`pay-card ${payMethod === 'CASH' ? 'active' : ''}`}
                onClick={() => setPayMethod('CASH')}
              >
                <i>💵</i> Efectivo
              </button>
              <button
                type="button"
                className={`pay-card ${payMethod === 'CARD' ? 'active' : ''}`}
                onClick={() => setPayMethod('CARD')}
              >
                <i>💳</i> Tarjeta
              </button>
              <button
                type="button"
                className={`pay-card ${payMethod === 'TRANSFER' ? 'active' : ''}`}
                onClick={() => setPayMethod('TRANSFER')}
              >
                <i>📲</i> Transf. / QR
              </button>
            </div>
          </div>

          {/* CASH TENDER & CHANGE CALCULATION */}
          {payMethod === 'CASH' && (
            <div>
              <label>
                Monto Recibido en Efectivo ($)
                <input
                  type="number"
                  step="0.01"
                  placeholder={grandTotal.toFixed(2)}
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value)}
                />
              </label>
              <div className="bills-grid">
                <button type="button" className="bill-btn" onClick={() => setCashTendered(grandTotal.toFixed(2))}>
                  Exacto (${grandTotal.toFixed(2)})
                </button>
                {[5, 10, 20, 50, 100].map(bill => (
                  <button key={bill} type="button" className="bill-btn" onClick={() => setCashTendered(String(bill))}>
                    ${bill}
                  </button>
                ))}
              </div>
              {tenderedVal >= grandTotal && grandTotal > 0 && (
                <div className="change-card">
                  <span>Cambio / Vuelto:</span>
                  <strong>${changeVal.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}

          {/* CHECKOUT BUTTON */}
          <button
            disabled={!cart.length || busy}
            onClick={checkout}
            style={{
              padding: '14px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 800,
              background: '#3157d5',
              color: '#fff',
              border: 0,
              boxShadow: '0 4px 14px rgba(49,87,213,0.25)'
            }}
          >
            {busy ? 'Registrando...' : `Cobrar $${grandTotal.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* POST-SALE RECEIPT MODAL */}
      {receiptModal && (
        <div className="modal-overlay" onClick={() => setReceiptModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>🧾 Comprobante de Venta</h3>
              <button className="close-button" onClick={() => setReceiptModal(null)}>✕</button>
            </div>

            <div id="printable-ticket" className="ticket-preview">
              <h2>FIXMETIENDAS</h2>
              <div className="ticket-center">Comprobante de Venta y Despacho</div>
              <div className="ticket-divider"></div>
              <div><strong>VENTA: #{receiptModal.sale?.id?.slice(0, 8)}</strong></div>
              <div>Fecha: {new Date().toLocaleString()}</div>
              <div>Canal: {receiptModal.channel === 'ONLINE' ? 'Venta Online / Catálogo' : 'Venta en Local'}</div>
              <div>Cliente: {receiptModal.customer ? receiptModal.customer.name : 'Consumidor Final'}</div>
              {receiptModal.customer?.phone && <div>Teléfono: {receiptModal.customer.phone}</div>}

              {receiptModal.fulfillment === 'DELIVERY' && (
                <>
                  <div className="ticket-divider"></div>
                  <div><strong>🛵 DESPACHO A DOMICILIO</strong></div>
                  <div>Dirección: {receiptModal.delivery.address}</div>
                  {receiptModal.delivery.recipientName && <div>Recibe: {receiptModal.delivery.recipientName}</div>}
                  {receiptModal.delivery.recipientPhone && <div>Contacto: {receiptModal.delivery.recipientPhone}</div>}
                  {receiptModal.delivery.notes && <div>Notas: {receiptModal.delivery.notes}</div>}
                </>
              )}

              <div className="ticket-divider"></div>
              <div><strong>DETALLE DE PRODUCTOS:</strong></div>
              {receiptModal.items.map((it: Any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0' }}>
                  <span>{it.quantity}x {it.name}</span>
                  <span>${(Number(it.price) * it.quantity).toFixed(2)}</span>
                </div>
              ))}

              <div className="ticket-divider"></div>
              {receiptModal.shippingFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>Flete a domicilio:</span>
                  <span>${receiptModal.shippingFee.toFixed(2)}</span>
                </div>
              )}
              <div style={{ fontSize: '14px', fontWeight: 800, margin: '4px 0' }}>
                TOTAL PAGADO: ${receiptModal.grandTotal.toFixed(2)}
              </div>
              <div>Forma de pago: {receiptModal.payMethod}</div>
              {receiptModal.cashTendered != null && (
                <div>Efectivo recibido: ${receiptModal.cashTendered.toFixed(2)} · Cambio: ${receiptModal.change?.toFixed(2)}</div>
              )}

              <div className="ticket-divider"></div>
              <p style={{ fontSize: '9px', textAlign: 'center', color: '#64748b' }}>
                ¡Gracias por su compra!<br />
                Garantía y soporte garantizado por FixmeTiendas.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button className="secondary-action" style={{ flex: 1 }} onClick={() => setReceiptModal(null)}>
                Cerrar
              </button>
              <button className="primary-action" style={{ flex: 1 }} onClick={() => window.print()}>
                🖨️ Imprimir Ticket
              </button>
              {receiptModal.customer?.phone && (
                <a
                  className="whatsapp-btn"
                  style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}
                  href={`https://wa.me/${receiptModal.customer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hola ${receiptModal.customer.name}, gracias por tu compra en FixmeTiendas.\nTotal: $${receiptModal.grandTotal.toFixed(2)}\nModalidad: ${receiptModal.fulfillment === 'DELIVERY' ? 'Envío a domicilio' : 'Retiro en tienda'}\nComprobante #${receiptModal.sale?.id?.slice(0, 8)}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Sales({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){
  const [rows, setRows] = React.useState<Any[]>([]);
  const [filterChannel, setFilterChannel] = React.useState('ALL');

  const load = React.useCallback(() => {
    api(`/api/sales?branchId=${branchId}`).then(r => r.ok ? r.json() : []).then(setRows);
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => {
    if (filterChannel === 'ALL') return true;
    return r.channel === filterChannel;
  });

  return (
    <>
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">HISTORIAL COMERCIAL & RENTABILIDAD</span>
          <h2>Ventas Registradas</h2>
          <p>Consulta canales (Local vs Online), método de pago, costo de venta y ganancia bruta generada.</p>
        </div>
        <button className="primary-action" onClick={load}>Actualizar</button>
      </section>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          className={`filter-pill ${filterChannel === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilterChannel('ALL')}
        >
          Todas ({rows.length})
        </button>
        <button
          type="button"
          className={`filter-pill ${filterChannel === 'STORE' ? 'active' : ''}`}
          onClick={() => setFilterChannel('STORE')}
        >
          🏪 En Local ({rows.filter(r => r.channel === 'STORE').length})
        </button>
        <button
          type="button"
          className={`filter-pill ${filterChannel === 'ONLINE' ? 'active' : ''}`}
          onClick={() => setFilterChannel('ONLINE')}
        >
          🌐 Por Internet ({rows.filter(r => r.channel === 'ONLINE').length})
        </button>
      </div>

      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Canal</th>
                <th>Entrega</th>
                <th>Vendedor</th>
                <th>Cliente</th>
                <th>Pago</th>
                <th>Costo (COGS)</th>
                <th>Total Venta</th>
                <th>Ganancia Bruta</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <span className={`status-badge ${r.channel === 'ONLINE' ? 'status-quoted' : 'status-approved'}`}>
                      {r.channel === 'ONLINE' ? '🌐 Internet' : '🏪 Local'}
                    </span>
                  </td>
                  <td>
                    {r.fulfillment_type === 'DELIVERY' ? (
                      <span className="status-badge status-open" title={r.delivery_address || ''}>
                        🛵 Domicilio ({r.delivery_status || 'PENDING'})
                      </span>
                    ) : (
                      <span className="status-badge status-completed">
                        🏬 Retiro
                      </span>
                    )}
                  </td>
                  <td>{r.seller || 'Sistema'}</td>
                  <td>{r.customer || 'Consumidor final'}</td>
                  <td><span style={{ fontWeight: 600, fontSize: '11px' }}>{r.payment_methods || 'CASH'}</span></td>
                  <td style={{ color: '#f43f5e' }}>${Number(r.total_cost || 0).toFixed(2)}</td>
                  <td style={{ fontWeight: 700 }}>${Number(r.total || 0).toFixed(2)}</td>
                  <td style={{ fontWeight: 800, color: '#10b981' }}>
                    +${Number(r.gross_profit || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">
              <b>--</b>
              <p>No se encontraron ventas para este filtro.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}function PlatformAdministration({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){const[tenants,setTenants]=React.useState<Any[]>([]),[selected,setSelected]=React.useState<Any|null>(null),[overview,setOverview]=React.useState<Any>({}),[users,setUsers]=React.useState<Any[]>([]),[inventory,setInventory]=React.useState<Any>({}),[name,setName]=React.useState(''),[ownerEmail,setOwnerEmail]=React.useState(''),[ownerPassword,setOwnerPassword]=React.useState('password'),[msg,setMsg]=React.useState('');const load=React.useCallback(()=>api('/api/platform/tenants').then(r=>r.ok?r.json():[]).then(setTenants),[api]);React.useEffect(()=>{load()},[load]);async function select(t:Any){setSelected(t);const [o,u,i]=await Promise.all([api(`/api/platform/tenants/${t.id}/overview`),api(`/api/platform/tenants/${t.id}/users`),api(`/api/platform/tenants/${t.id}/inventory`)]);setOverview(o.ok?await o.json():{});setUsers(u.ok?await u.json():[]);setInventory(i.ok?await i.json():{})}async function create(e:React.FormEvent){e.preventDefault();const r=await api('/api/platform/tenants',{method:'POST',body:JSON.stringify({name,ownerEmail,ownerPassword,plan:'STARTER',subscriptionStatus:'ACTIVE'})});if(r.ok){setName('');setOwnerEmail('');setOwnerPassword('password');setMsg('Empresa creada');load()}else setMsg('No se pudo crear la empresa')}async function changeStatus(status:string){if(!selected)return;const r=await api(`/api/platform/tenants/${selected.id}`,{method:'PATCH',body:JSON.stringify({subscriptionStatus:status})});if(r.ok){setSelected({...selected,subscription_status:status});setTenants(tenants.map(t=>t.id===selected.id?{...t,subscription_status:status}:t));setMsg('Estado actualizado')}}return <><section className="inventory-hero"><div><span className="eyebrow">ADMINISTRACIÓN GLOBAL</span><h2>Empresas y tiendas</h2><p>Supervisa suscripciones, usuarios e inventario sin mezclar datos.</p></div></section><div className="platform-layout"><section className="panel tenant-list"><div className="panel-head"><div><h3>Empresas registradas</h3><p className="catalog-toolbar-p">{tenants.length} empresas</p></div></div>{tenants.map(t=><button className={selected?.id===t.id?'tenant-row selected':'tenant-row'} onClick={()=>select(t)} key={t.id}><span className="tenant-avatar">{(t.name||'E')[0]}</span><span><b>{t.name}</b><small>{t.plan||'STARTER'} · {t.subscription_status||'ACTIVE'}</small></span><i>â€º</i></button>)}<form className="tenant-create" onSubmit={create}><input placeholder="Nombre de nueva empresa" value={name} onChange={e=>setName(e.target.value)} required/><input type="email" placeholder="Correo del manager" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)} required/><input type="password" placeholder="Contraseña inicial (8+)" value={ownerPassword} onChange={e=>setOwnerPassword(e.target.value)} minLength={8} required/><button>ï¼‹ Crear empresa</button>{msg&&<small>{msg}</small>}</form></section>{selected?<section className="platform-detail"><div className="panel detail-heading"><span className="eyebrow">EMPRESA SELECCIONADA</span><h2>{selected.name}</h2><div className="detail-meta"><span>Plan: <b>{selected.plan}</b></span><span>Estado: <b className={selected.subscription_status==='ACTIVE'?'status-active':'status-paused'}>{selected.subscription_status}</b></span><select value={selected.subscription_status} onChange={e=>changeStatus(e.target.value)}><option value="ACTIVE">ACTIVA</option><option value="PAST_DUE">PAGO PENDIENTE</option><option value="SUSPENDED">SUSPENDIDA</option></select></div></div><div className="inventory-stats"><div><span>Usuarios</span><strong>{overview.users||0}</strong><small>en la empresa</small></div><div><span>Productos</span><strong>{overview.products||0}</strong><small>en inventario</small></div><div><span>Clientes</span><strong>{overview.customers||0}</strong><small>registrados</small></div><div><span>Órdenes</span><strong>{overview.orders||0}</strong><small>de servicio</small></div></div><section className="panel"><h3>Inventario de {selected.name}</h3><div className="table-wrap"><table><thead><tr><th>SKU</th><th>Producto</th><th>Stock</th><th>Valor</th></tr></thead><tbody>{(inventory.items||[]).map((p:Any)=><tr key={p.id}><td>{p.sku}</td><td>{p.name}</td><td>{p.stock}</td><td>${(Number(p.stock||0)*Number(p.price||0)).toFixed(2)}</td></tr>)}</tbody></table></div></section><Table title={`Usuarios de ${selected.name}`} columns={['full_name','identification','email','phone','role']} rows={users} empty="Esta empresa aún no tiene usuarios." /></section>:<section className="panel empty platform-empty"><b>âŒ‚</b><p>Selecciona una empresa</p><small>Consulta su estado, inventario y usuarios sin cambiar de contexto.</small></section>}</div></>}

function Administration({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){const[p,setP]=React.useState<Any>({}),[users,setUsers]=React.useState<Any[]>([]),[form,setForm]=React.useState<Any>({email:'',password:'password',role:'SELLER',fullName:'',identification:'',address:'',phone:''}),[msg,setMsg]=React.useState('');const load=React.useCallback(()=>{api('/api/administration/profile').then(r=>r.ok?r.json():{}).then(setP);api('/api/administration/users').then(r=>r.ok?r.json():[]).then(setUsers)},[api]);React.useEffect(()=>{load()},[load]);async function add(e:React.FormEvent){e.preventDefault();const r=await api('/api/administration/users',{method:'POST',body:JSON.stringify(form)});if(r.ok){setMsg('Usuario creado');setForm({...form,email:'',fullName:'',identification:'',address:'',phone:''});load()}else setMsg('No se pudo crear el usuario')}return <><section className="panel"><h3>Perfil de empresa</h3><p><b>{p.legal_name||p.name||'Empresa'}</b></p><p>Tipo: {p.business_type||'RETAIL'} · Plan: {p.plan||'FREE'} · Teléfono: {p.phone||'*'}</p></section><section className="panel"><h3>Crear usuario de la empresa</h3><form className="form-grid" onSubmit={add}>{[['fullName','Nombres y apellidos'],['identification','Cédula / identificación'],['email','Correo'],['phone','Teléfono'],['address','Dirección'],['password','Contraseña']].map(([k,l])=><label key={k}>{l}<input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required={k==='fullName'||k==='email'||k==='password'}/></label>)}<label>Rol<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{['MANAGER','SELLER','DELIVERY','TECHNICIAN','ACCOUNTANT'].map(x=><option key={x}>{x}</option>)}</select></label><button>+ Crear usuario</button>{msg&&<small>{msg}</small>}</form></section><Table title="Usuarios registrados" columns={['full_name','identification','email','phone','role']} rows={users} empty="Aún no hay usuarios." /></>}
function Dashboard({api,go,role}:{api:(u:string,o?:RequestInit)=>Promise<Response>,go:(p:string)=>void,role:string}){
  const [data, setData] = React.useState<Any>({});
  const global = role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN';
  const financial = ['MANAGER', 'ACCOUNTANT', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(role);

  React.useEffect(() => {
    if (financial) {
      api('/api/reports/summary').then(r => r.ok ? r.json() : {}).then(setData);
    }
  }, [api, financial]);

  const title = global ? 'Administración General' : role === 'DELIVERY' ? 'Panel de Entregas' : role === 'TECHNICIAN' ? 'Servicio Técnico' : role === 'SELLER' ? 'Punto de Venta' : role === 'ACCOUNTANT' ? 'Balance Financiero' : 'Control Operativo';

  const quick = global
    ? [['administration', '🏢', 'Empresas & Sucursales', 'Gestión multi-tenant'], ['products', '📦', 'Inventario Global', 'Existencias y costos'], ['reports', '📊', 'Finanzas & Rentabilidad', 'Métricas de utilidad']]
    : role === 'DELIVERY'
    ? [['deliveries', '🛵', 'Entregas a Domicilio', 'Rutas, llamadas y despachos']]
    : role === 'TECHNICIAN'
    ? [['work-orders', '🛠️', 'Órdenes de Servicio', 'Diagnóstico y cotizaciones']]
    : role === 'SELLER'
    ? [['pos', '🛒', 'Nueva Venta', 'Local o a domicilio'], ['cash', '💵', 'Arqueo de Caja', 'Efectivo y movimientos'], ['customers', '👤', 'Nuevo Cliente', 'Ficha comercial'], ['work-orders', '🛠️', 'Ingresar Equipo', 'Ficha técnica']]
    : [['pos', '🛒', 'Punto de Venta', 'Cobro omnicanal y delivery'], ['products', '📦', 'Catálogo & Margen', 'Precios, stock y costos'], ['deliveries', '🛵', 'Despachos', 'Envíos en curso'], ['reports', '📊', 'Reportes Financieros', 'Ingresos, COGS y margen']];

  return (
    <>
      <section className="welcome">
        <div>
          <h2>{title}</h2>
          <p>{global ? 'Supervisión en tiempo real de tiendas y rentabilidad.' : `FixmeTiendas · Sesión activa con rol ${role}.`}</p>
        </div>
        {!global && ['MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(role) && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="secondary-action" onClick={() => go('pos')}>🛒 Nueva Venta</button>
            <button className="primary-action" onClick={() => go('products')}>＋ Nuevo Producto</button>
          </div>
        )}
      </section>

      {financial && (
        <div className="finance-grid">
          <div className="finance-card">
            <small>Ingresos Totales</small>
            <strong className="text-revenue">${Number(data.revenue || 0).toFixed(2)}</strong>
            <span>{data.sales || 0} transacciones cobradas</span>
          </div>
          <div className="finance-card">
            <small>Costo de Ventas (COGS)</small>
            <strong className="text-cogs">${Number(data.cogs || 0).toFixed(2)}</strong>
            <span>Inversión en mercadería vendida</span>
          </div>
          <div className="finance-card">
            <small>Ganancia Bruta Real</small>
            <strong className="text-profit">+${Number(data.grossProfit || 0).toFixed(2)}</strong>
            <span style={{ fontWeight: 700, color: '#10b981' }}>{Number(data.grossMarginPercent || 0).toFixed(1)}% margen comercial</span>
          </div>
          <div className="finance-card">
            <small>Inversión en Stock</small>
            <strong>${Number(data.inventoryCostValue || 0).toFixed(2)}</strong>
            <span>{data.totalStockUnits || 0} unidades valorizadas</span>
          </div>
          <div className="finance-card">
            <small>Entregas Pendientes</small>
            <strong style={{ color: Number(data.deliveriesSummary?.PENDING || 0) > 0 ? '#f59e0b' : '#64748b' }}>
              {data.deliveriesSummary?.PENDING || 0}
            </strong>
            <span>🛵 Envíos por despachar</span>
          </div>
          <div className="finance-card">
            <small>Stock Bajo Crítico</small>
            <strong className={Number(data.lowStock || 0) > 0 ? 'text-cogs' : ''}>{data.lowStock || 0}</strong>
            <span>Productos con ≤ 5 unidades</span>
          </div>
        </div>
      )}

      <div className="panel">
        <h3 style={{ marginBottom: '14px' }}>Acciones Rápidas</h3>
        <div className="quick">
          {quick.map(q => (
            <button key={q[0]} onClick={() => go(q[0])}>
              <span style={{ fontSize: '22px', display: 'block', marginBottom: '6px' }}>{q[1]}</span>
              <b>{q[2]}</b>
              <small>{q[3]}</small>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Kpi(p:{label:string,value:any,trend:string,danger?:boolean}){return <article className="kpi"><small>{p.label}</small><strong className={p.danger?'danger':''}>{p.value}</strong><span>{p.trend}</span></article>}

function Products({api,role}:{api:(u:string,o?:RequestInit)=>Promise<Response>,role:string}){
  const [rows, setRows] = React.useState<Any[]>([]);
  const [cats, setCats] = React.useState<Any[]>([]);
  const [catName, setCatName] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [stockFilter, setStockFilter] = React.useState<'ALL'|'IN_STOCK'|'LOW_STOCK'|'OUT_OF_STOCK'>('ALL');
  const [showForm, setShowForm] = React.useState(false);
  const [editItem, setEditItem] = React.useState<Any|null>(null);
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // Form state
  const [form, setForm] = React.useState({
    sku: '',
    name: '',
    stock: '10',
    purchasePrice: '0',
    price: '0',
    extraCost: '0',
    marginPercent: '30',
    categoryId: ''
  });

  const canManage = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'].includes(role);

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
        price: Number(form.price),
        purchasePrice: Number(form.purchasePrice),
        extraCost: Number(form.extraCost),
        marginPercent: Number(form.marginPercent)
      })
    });
    setBusy(false);
    if (r.ok) {
      setMsg('Producto registrado exitosamente');
      setForm({ sku: '', name: '', stock: '10', purchasePrice: '0', price: '0', extraCost: '0', marginPercent: '30', categoryId: '' });
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
        stock: Number(editItem.stock || 0),
        price: Number(editItem.price || 0),
        purchasePrice: Number(editItem.purchase_price ?? editItem.purchasePrice ?? 0),
        marginPercent: Number(editItem.margin_percent ?? editItem.marginPercent ?? 0),
        extraCost: Number(editItem.extra_cost ?? editItem.extraCost ?? 0),
        categoryId: editItem.category_id || editItem.categoryId || null
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

  // Stock and financial calculations
  const totalUnits = rows.reduce((acc, p) => acc + Number(p.stock || 0), 0);
  const totalCostValue = rows.reduce((acc, p) => acc + (Number(p.stock || 0) * Number(p.purchase_price ?? p.purchasePrice ?? 0)), 0);
  const totalRetailValue = rows.reduce((acc, p) => acc + (Number(p.stock || 0) * Number(p.price || 0)), 0);
  const potentialProfit = Math.max(0, totalRetailValue - totalCostValue);
  const projectedMargin = totalRetailValue > 0 ? ((potentialProfit / totalRetailValue) * 100) : 0;
  const lowStockCount = rows.filter(p => Number(p.stock) > 0 && Number(p.stock) <= 5).length;
  const outOfStockCount = rows.filter(p => Number(p.stock) <= 0).length;

  const filtered = rows.filter(r => {
    const matchQuery = !query || `${r.name} ${r.sku}`.toLowerCase().includes(query.toLowerCase());
    const matchCat = !category || r.category_id === category || r.categoryId === category;
    const matchStock =
      stockFilter === 'ALL' ? true :
      stockFilter === 'IN_STOCK' ? Number(r.stock) > 5 :
      stockFilter === 'LOW_STOCK' ? (Number(r.stock) > 0 && Number(r.stock) <= 5) :
      Number(r.stock) <= 0;
    return matchQuery && matchCat && matchStock;
  });

  return (
    <>
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">INVENTARIO, VALORIZACIÓN Y MÁRGENES</span>
          <h2>Control de Existencias y Rentabilidad</h2>
          <p>Conoce la inversión total en mercadería, valorización proyectada a PVP y calcula márgenes al instante.</p>
        </div>
        {canManage && (
          <button className="primary-action" onClick={() => { setShowForm(!showForm); setMsg(''); }}>
            {showForm ? '✕ Cancelar' : '＋ Nuevo Producto'}
          </button>
        )}
      </section>

      {/* FINANCIAL INVENTORY VALUATION KPIS */}
      <div className="finance-grid">
        <div className="finance-card">
          <small>Inversión en Stock (Costo)</small>
          <strong className="text-revenue">${totalCostValue.toFixed(2)}</strong>
          <span>Capital total invertido en inventario</span>
        </div>
        <div className="finance-card">
          <small>Valorización Comercial (PVP)</small>
          <strong>${totalRetailValue.toFixed(2)}</strong>
          <span>Ingresos proyectados si se vende todo</span>
        </div>
        <div className="finance-card">
          <small>Ganancia Bruta Potencial</small>
          <strong className="text-profit">+${potentialProfit.toFixed(2)}</strong>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{projectedMargin.toFixed(1)}% margen global</span>
        </div>
        <div className="finance-card">
          <small>Unidades Totales</small>
          <strong>{totalUnits}</strong>
          <span>{rows.length} productos en catálogo</span>
        </div>
        <div className="finance-card">
          <small>Stock Crítico</small>
          <strong className={lowStockCount > 0 ? 'text-cogs' : ''}>{lowStockCount}</strong>
          <span>Productos con ≤ 5 unidades</span>
        </div>
        <div className="finance-card">
          <small>Agotados</small>
          <strong className={outOfStockCount > 0 ? 'text-cogs' : ''}>{outOfStockCount}</strong>
          <span>Sin existencias disponibles</span>
        </div>
      </div>

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
                  <label>Stock Disponible *
                    <input
                      type="number"
                      min="0"
                      value={editItem.stock || 0}
                      onChange={e => setEditItem({ ...editItem, stock: e.target.value })}
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

                {/* EDIT PRICE & COST CALCULATOR */}
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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

                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#047857', fontWeight: 700 }}>
                    <span>Ganancia unitaria: +${Math.max(0, (parseFloat(editItem.price) || 0) - (parseFloat(editItem.purchase_price ?? editItem.purchasePrice ?? 0) || 0)).toFixed(2)}</span>
                    <span>Margen: {editItem.margin_percent || '0'}%</span>
                  </div>
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
      <section className="panel catalog-panel">
        <div className="catalog-toolbar">
          <div>
            <h3>Catálogo de Productos</h3>
            <p>{filtered.length} artículos encontrados · Sincronizado</p>
          </div>

          <div className="search-box">
            <span>🔍</span>
            <input
              placeholder="Buscar por nombre, SKU o modelo..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <select className="filter-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Todas las categorías ({cats.length})</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* STOCK STATUS PILLS */}
        <div style={{ display: 'flex', gap: '8px', margin: '0 0 16px', overflowX: 'auto' }}>
          {[
            ['ALL', `Todos (${rows.length})`],
            ['IN_STOCK', `Disponibles (${rows.filter(r => Number(r.stock) > 5).length})`],
            ['LOW_STOCK', `Stock Bajo (${lowStockCount})`],
            ['OUT_OF_STOCK', `Agotados (${outOfStockCount})`]
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`filter-pill ${stockFilter === k ? 'active' : ''}`}
              onClick={() => setStockFilter(k as any)}
            >
              {label}
            </button>
          ))}
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
                  <div className="product-thumb">📦</div>
                  <div className="product-card-body">
                    <div className="product-card-top">
                      <span className="sku-label">{r.sku}</span>
                      <span className={stock > 5 ? 'stock-badge' : stock > 0 ? 'stock-badge' : 'stock-badge empty-stock'} style={{
                        background: stock > 5 ? '#dcfce7' : stock > 0 ? '#fef3c7' : '#fee2e2',
                        color: stock > 5 ? '#166534' : stock > 0 ? '#92400e' : '#991b1b'
                      }}>
                        {stock > 5 ? `${stock} en stock` : stock > 0 ? `Bajo (${stock})` : 'Agotado'}
                      </span>
                    </div>

                    <h4>{r.name}</h4>

                    <div className="product-card-footer" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                      <div>
                        <small style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>PVP VENTA</small>
                        <strong style={{ fontSize: '18px', color: '#3157d5' }}>${pvp.toFixed(2)}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <small style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>COSTO</small>
                        <span style={{ fontWeight: 600, color: '#475569' }}>${cost.toFixed(2)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <small style={{ color: '#059669', fontWeight: 700 }}>
                        +${unitProfit.toFixed(2)} ({margin.toFixed(0)}% mgn)
                      </small>
                      {canManage && (
                        <button
                          type="button"
                          className="edit-product"
                          onClick={() => setEditItem(r)}
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <b>📦</b>
            <p>No se encontraron productos con estos criterios.</p>
            <small>Ajusta los filtros o crea un nuevo producto.</small>
          </div>
        )}
      </section>
    </>
  );
}

function Customers({api,notify}:{api:(u:string,o?:RequestInit)=>Promise<Response>,notify:(s:string)=>void}){const[rows,setRows]=React.useState<Any[]>([]),[form,setForm]=React.useState({name:'',email:'',phone:'',address:'',city:''});const load=React.useCallback(()=>api('/api/customers').then(r=>r.ok?r.json():[]).then(setRows),[api]);React.useEffect(()=>{load()},[load]);async function add(e:React.FormEvent){e.preventDefault();const r=await api('/api/customers',{method:'POST',body:JSON.stringify(form)});if(r.ok){setForm({name:'',email:'',phone:'',address:'',city:''});notify('Cliente creado correctamente');load()}}return <><div className="panel"><h3>Registrar cliente</h3><form className="form-grid" onSubmit={add}>{[['name','Nombres y apellidos'],['email','Correo'],['phone','Teléfono'],['address','Dirección'],['city','Ciudad']].map(([k,l])=><label key={k}>{l}<input value={form[k as keyof typeof form]} onChange={e=>setForm({...form,[k]:e.target.value})} required={k==='name'}/></label>)}<button>+ Guardar cliente</button></form></div><Table title="Clientes" columns={['name','email','phone','address','city']} rows={rows} empty="Agrega tu primer cliente." /></>}

function Deliveries({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){
  const [rows, setRows] = React.useState<Any[]>([]);
  const [filterTab, setFilterTab] = React.useState<'ALL'|'PENDING'|'IN_TRANSIT'|'DELIVERED'>('ALL');
  const [search, setSearch] = React.useState('');
  const [courierModal, setCourierModal] = React.useState<Any|null>(null);
  const [courierName, setCourierName] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api('/api/deliveries').then(r => r.ok ? r.json() : []).then(setRows);
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string, courier?: string) {
    setBusy(true);
    const r = await api(`/api/deliveries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, courier: courier || null })
    });
    setBusy(false);
    if (r.ok) {
      setCourierModal(null);
      setMsg(`Estado actualizado a: ${status}`);
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
      d.address, d.courier, d.tracking_number, d.sale_id
    ].some(v => v && String(v).toLowerCase().includes(q));

    return matchTab && matchSearch;
  });

  return (
    <>
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">LOGÍSTICA Y DESPACHOS A DOMICILIO</span>
          <h2>Tablero de Entregas</h2>
          <p>Gestiona los pedidos con entrega a domicilio generados en el Punto de Venta (Local e Internet).</p>
        </div>
        <button className="primary-action" onClick={load}>Actualizar Entregas</button>
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
          <small>Total Envíos Registrados</small>
          <strong>{rows.length}</strong>
          <span>Historial total de pedidos</span>
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
              placeholder="Buscar destinatario, dirección o courier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ASSIGN COURIER MODAL */}
      {courierModal && (
        <div className="modal-overlay" onClick={() => setCourierModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-head">
              <h3>🚀 Despachar Pedido</h3>
              <button className="close-button" onClick={() => setCourierModal(null)}>✕</button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
              Asigna el repartidor o servicio de courier para iniciar la entrega hacia: <b>{courierModal.address}</b>
            </p>
            <label>Nombre del Repartidor / Courier
              <input
                placeholder="Ej. Juan Pérez, Servientrega, PedidosYa..."
                value={courierName}
                onChange={e => setCourierName(e.target.value)}
                autoFocus
              />
            </label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button type="button" className="secondary-action" style={{ flex: 1 }} onClick={() => setCourierModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-action"
                style={{ flex: 1 }}
                disabled={busy}
                onClick={() => updateStatus(courierModal.id, 'IN_TRANSIT', courierName || courierModal.courier)}
              >
                {busy ? 'Despachando...' : 'Iniciar En Camino'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH CARDS GRID */}
      {filtered.length ? (
        <div className="deliv-grid">
          {filtered.map(d => {
            const cleanPhone = (d.recipient_phone || d.customer_phone || '').replace(/[^0-9]/g, '');
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address || '')}`;
            const waText = encodeURIComponent(`Hola ${d.recipient_name || d.customer_name || 'estimado/a cliente'}, te informamos sobre tu entrega en FixmeTiendas. Estado actual: ${d.status === 'IN_TRANSIT' ? '🚀 EN CAMINO hacia tu dirección' : d.status === 'DELIVERED' ? '✅ ENTREGADO' : '🛵 PREPARANDO DESPACHO'}. Dirección: ${d.address}`);

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
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '2px' }}>
                    <span>Repartidor: <b>{d.courier || 'Sin asignar'}</b></span>
                    <span>Flete: <b>${Number(d.shipping_cost || 0).toFixed(2)}</b></span>
                  </div>

                  {d.sale_total != null && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Ticket venta: <b>${Number(d.sale_total).toFixed(2)}</b> ({d.sale_channel === 'ONLINE' ? '🌐 Internet' : '🏪 Local'})
                    </div>
                  )}
                </div>

                <div className="deliv-actions">
                  {d.status === 'PENDING' && (
                    <button
                      type="button"
                      className="btn-deliv-action btn-transit"
                      onClick={() => { setCourierModal(d); setCourierName(d.courier || ''); }}
                    >
                      🚀 Despachar / Iniciar Ruta
                    </button>
                  )}
                  {d.status === 'IN_TRANSIT' && (
                    <button
                      type="button"
                      className="btn-deliv-action btn-delivered"
                      onClick={() => updateStatus(d.id, 'DELIVERED')}
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
function Orders({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){
  const [r,setR]=React.useState<Any[]>([]);
  const [customers,setCustomers]=React.useState<Any[]>([]);
  const [showCreate,setShowCreate]=React.useState(false);
  const [filterStatus,setFilterStatus]=React.useState('ALL');
  const [search,setSearch]=React.useState('');
  const [msg,setMsg]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [qrModal,setQrModal]=React.useState<Any|null>(null);
  const [editModal,setEditModal]=React.useState<Any|null>(null);
  const [editItems,setEditItems]=React.useState<Array<{itemType:string,name:string,quantity:number,unitPrice:number}>>([]);
  const [ticketModal,setTicketModal]=React.useState<Any|null>(null);

  const [form,setForm]=React.useState({
    customerId:'',deviceBrand:'',deviceModel:'',serialNumber:'',
    reportedFault:'',accessories:'',description:'',diagnosis:'',
    quote:'',estimatedDelivery:''
  });

  const [items,setItems]=React.useState<Array<{itemType:string,name:string,quantity:number,unitPrice:number}>>([]);

  const load=React.useCallback(()=>{
    api('/api/work-orders').then(x=>x.ok?x.json():[]).then(setR);
    api('/api/customers').then(x=>x.ok?x.json():[]).then(setCustomers);
  },[api]);

  React.useEffect(()=>{load()},[load]);

  const addItem=()=>{
    setItems([...items,{itemType:'LABOR',name:'',quantity:1,unitPrice:0}]);
  };

  const updateItem=(idx:number,field:string,val:any)=>{
    const updated=items.map((it,i)=>i===idx?{...it,[field]:val}:it);
    setItems(updated);
    const sum=updated.reduce((n,it)=>n+(Number(it.quantity||1)*Number(it.unitPrice||0)),0);
    setForm(f=>({...f,quote:sum>0?sum.toFixed(2):f.quote}));
  };

  const removeItem=(idx:number)=>{
    const updated=items.filter((_,i)=>i!==idx);
    setItems(updated);
    const sum=updated.reduce((n,it)=>n+(Number(it.quantity||1)*Number(it.unitPrice||0)),0);
    setForm(f=>({...f,quote:sum>0?sum.toFixed(2):''}));
  };

  const addEditItem=()=>{
    setEditItems([...editItems,{itemType:'LABOR',name:'',quantity:1,unitPrice:0}]);
  };

  const updateEditItem=(idx:number,field:string,val:any)=>{
    const updated=editItems.map((it,i)=>i===idx?{...it,[field]:val}:it);
    setEditItems(updated);
    const sum=updated.reduce((n,it)=>n+(Number(it.quantity||1)*Number(it.unitPrice||0)),0);
    setEditModal(m=>m?{...m,quote:sum>0?sum.toFixed(2):m.quote}:null);
  };

  const removeEditItem=(idx:number)=>{
    const updated=editItems.filter((_,i)=>i!==idx);
    setEditItems(updated);
    const sum=updated.reduce((n,it)=>n+(Number(it.quantity||1)*Number(it.unitPrice||0)),0);
    setEditModal(m=>m?{...m,quote:sum>0?sum.toFixed(2):''}:null);
  };

  async function add(e:React.FormEvent){
    e.preventDefault();
    setBusy(true);
    const res=await api('/api/work-orders',{
      method:'POST',
      body:JSON.stringify({
        ...form,
        branchId,
        quote:form.quote?Number(form.quote):0,
        items:items.filter(it=>it.name.trim()!=='')
      })
    });
    setBusy(false);
    if(res.ok){
      const created=await res.json();
      setMsg('Orden registrada exitosamente');
      setForm({
        customerId:'',deviceBrand:'',deviceModel:'',serialNumber:'',
        reportedFault:'',accessories:'',description:'',diagnosis:'',
        quote:'',estimatedDelivery:''
      });
      setItems([]);
      setShowCreate(false);
      load();
      setQrModal(created);
    }else{
      setMsg(`No se pudo crear la orden (${res.status})`);
    }
  }

  async function updateStatus(id:string,status:string,notes?:string){
    const res=await api(`/api/work-orders/${id}/status`,{
      method:'PATCH',
      body:JSON.stringify({status,technicianNotes:notes})
    });
    if(res.ok){
      setMsg('Estado actualizado');
      load();
    }else{
      setMsg(`Error al actualizar estado (${res.status})`);
    }
  }

  function openEditModal(o:Any){
    setEditModal(o);
    const rawItems=(o.items||[]).map((it:Any)=>({
      itemType:it.itemType||it.item_type||'LABOR',
      name:it.name||'',
      quantity:Number(it.quantity||1),
      unitPrice:Number(it.unitPrice||it.unit_price||0)
    }));
    setEditItems(rawItems);
  }

  async function saveEditModal(e:React.FormEvent){
    e.preventDefault();
    if(!editModal)return;
    setBusy(true);
    await api(`/api/work-orders/${editModal.id}`,{
      method:'PUT',
      body:JSON.stringify({
        diagnosis:editModal.diagnosis,
        quote:Number(editModal.quote||0),
        technicianNotes:editModal.technician_notes||editModal.technicianNotes,
        estimatedDelivery:editModal.estimated_delivery||editModal.estimatedDelivery,
        items:editItems.filter(it=>it.name.trim()!=='')
      })
    });
    if(editModal.status){
      await api(`/api/work-orders/${editModal.id}/status`,{
        method:'PATCH',
        body:JSON.stringify({
          status:editModal.status,
          technicianNotes:editModal.technician_notes||editModal.technicianNotes
        })
      });
    }
    setBusy(false);
    setEditModal(null);
    setMsg('Orden técnica actualizada');
    load();
  }

  const statusLabel=(s:string)=>({
    OPEN:'Abierta',
    DIAGNOSIS:'En diagnóstico',
    QUOTED:'Cotizada',
    APPROVED:'Aprobada',
    REJECTED:'Rechazada',
    IN_PROGRESS:'En reparación',
    COMPLETED:'Listo para retiro',
    CANCELLED:'Cancelada'
  }[s]||s);

  const getFullUrl=(o:Any)=>{
    if(!o?.approval_url)return '';
    return window.location.origin+o.approval_url;
  };

  const getWaLink=(o:Any)=>{
    const phone=(o.customer_phone||'').replace(/[^0-9]/g,'');
    const url=getFullUrl(o);
    const folio=o.order_number||o.id?.slice(0,8)||'';
    const text=encodeURIComponent(`Hola ${o.customer_name||'estimado/a cliente'}, te compartimos el enlace para seguir el avance y cotización de tu orden ${folio} en FixmeTiendas: ${url}`);
    return phone?`https://wa.me/${phone}?text=${text}`:`https://wa.me/?text=${text}`;
  };

  const diagCount=r.filter(o=>o.status==='OPEN'||o.status==='DIAGNOSIS').length;
  const quotedCount=r.filter(o=>o.status==='QUOTED').length;
  const inProgCount=r.filter(o=>o.status==='APPROVED'||o.status==='IN_PROGRESS').length;
  const readyCount=r.filter(o=>o.status==='COMPLETED').length;

  const filtered=r.filter(o=>{
    const matchStatus=!filterStatus||filterStatus==='ALL'||(
      filterStatus==='DIAGNOSIS'?['OPEN','DIAGNOSIS'].includes(o.status):
      filterStatus==='IN_PROGRESS'?['APPROVED','IN_PROGRESS'].includes(o.status):
      o.status===filterStatus
    );
    const q=search.toLowerCase().trim();
    const matchSearch=!q||[
      o.order_number,o.customer_name,o.customer_phone,
      o.device_brand,o.device_model,o.serial_number,
      o.reported_fault,o.description
    ].some(v=>v&&String(v).toLowerCase().includes(q));
    return matchStatus&&matchSearch;
  });

  return <>
    <section className="inventory-hero">
      <div>
        <span className="eyebrow">SERVICIO TÉCNICO Y TALLER</span>
        <h2>Órdenes de Trabajo</h2>
        <p>Controla el flujo de reparación, ítems de mano de obra/repuestos y seguimiento para el cliente.</p>
      </div>
      <button className="primary-action" onClick={()=>setShowCreate(!showCreate)}>
        {showCreate?'✕ Cancelar':'＋ Nueva orden de servicio'}
      </button>
    </section>

    <div className="inventory-stats">
      <div><span>En Diagnóstico</span><strong>{diagCount}</strong><small>Por evaluar</small></div>
      <div><span>Cotizadas</span><strong>{quotedCount}</strong><small>Esperando cliente</small></div>
      <div><span>En Reparación</span><strong>{inProgCount}</strong><small>En proceso activo</small></div>
      <div><span>Listas para Entrega</span><strong style={{color:'#10b981'}}>{readyCount}</strong><small>Retiro en tienda</small></div>
    </div>

    {showCreate&&<section className="panel product-editor">
      <div className="editor-heading">
        <div>
          <span className="eyebrow">RECEPCIÓN DE EQUIPO</span>
          <h3>Ingresar Nuevo Dispositivo a Taller</h3>
          <p>Genera la ficha técnica, los ítems requeridos y el enlace de autorización para el cliente.</p>
        </div>
        <button className="close-button" onClick={()=>setShowCreate(false)}>✕</button>
      </div>

      <form onSubmit={add}>
        <div className="form-section">
          <h4>Datos del Cliente y Equipo</h4>
          <div className="form-grid">
            <label>Cliente
              <select value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})} required>
                <option value="">Selecciona un cliente</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone||c.email||'Sin contacto'}</option>)}
              </select>
            </label>
            <label>Marca
              <input placeholder="Ej. Apple, Samsung, Lenovo, HP" value={form.deviceBrand} onChange={e=>setForm({...form,deviceBrand:e.target.value})} required/>
            </label>
            <label>Modelo del equipo
              <input placeholder="Ej. iPhone 13 Pro, Pavilion 15" value={form.deviceModel} onChange={e=>setForm({...form,deviceModel:e.target.value})} required/>
            </label>
            <label>N° Serie o IMEI
              <input placeholder="Ej. 356789012345678" value={form.serialNumber} onChange={e=>setForm({...form,serialNumber:e.target.value})}/>
            </label>
          </div>
        </div>

        <div className="form-section" style={{marginTop:'16px'}}>
          <h4>Detalles del Servicio</h4>
          <div className="form-grid">
            <label>Falla reportada por el cliente
              <input placeholder="Ej. Pantalla rota, recalentamiento, no enciende" value={form.reportedFault} onChange={e=>setForm({...form,reportedFault:e.target.value})} required/>
            </label>
            <label>Accesorios recibidos
              <input placeholder="Ej. Funda, cargador original, sin chip" value={form.accessories} onChange={e=>setForm({...form,accessories:e.target.value})}/>
            </label>
            <label>Diagnóstico inicial (opcional)
              <input placeholder="Ej. Requiere cambio de pantalla y pasta térmica" value={form.diagnosis} onChange={e=>setForm({...form,diagnosis:e.target.value})}/>
            </label>
            <label>Fecha estimada de entrega
              <input type="datetime-local" value={form.estimatedDelivery} onChange={e=>setForm({...form,estimatedDelivery:e.target.value})}/>
            </label>
          </div>
        </div>

        <div className="form-section" style={{marginTop:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
            <div>
              <h4 style={{margin:0}}>Ítems de Reparación (Mano de Obra y Repuestos)</h4>
              <small style={{color:'#64748b'}}>Agrega conceptos específicos como cambio de pasta térmica, pantallas, etc.</small>
            </div>
            <button type="button" className="secondary-action" style={{fontSize:'12px',padding:'7px 14px'}} onClick={addItem}>
              ＋ Agregar ítem
            </button>
          </div>

          {items.length===0?<p style={{fontSize:'12px',color:'#94a3b8',fontStyle:'italic',background:'#f8f9fc',padding:'12px',borderRadius:'8px'}}>
            Aún no has agregado ítems desglosados. Puedes agregar líneas de mano de obra o repuestos arriba, o ingresar una cotización global abajo.
          </p>:(
            <div style={{display:'grid',gap:'8px',marginBottom:'14px'}}>
              {items.map((it,idx)=>(
                <div key={idx} style={{display:'grid',gridTemplateColumns:'130px 1fr 75px 100px 80px 30px',gap:'8px',alignItems:'center',background:'#f8f9fc',padding:'8px 10px',borderRadius:'8px'}}>
                  <select value={it.itemType} onChange={e=>updateItem(idx,'itemType',e.target.value)} style={{fontSize:'12px',padding:'7px'}}>
                    <option value="LABOR">Mano de Obra</option>
                    <option value="PART">Repuesto</option>
                  </select>
                  <input placeholder="Ej. Cambio de pasta térmica, Pantalla de 15''" value={it.name} onChange={e=>updateItem(idx,'name',e.target.value)} style={{fontSize:'12px',padding:'7px'}} required/>
                  <input type="number" min="1" placeholder="Cant" value={it.quantity} onChange={e=>updateItem(idx,'quantity',Number(e.target.value))} style={{fontSize:'12px',padding:'7px'}}/>
                  <input type="number" step="0.01" min="0" placeholder="$ Precio" value={it.unitPrice} onChange={e=>updateItem(idx,'unitPrice',Number(e.target.value))} style={{fontSize:'12px',padding:'7px'}}/>
                  <strong style={{fontSize:'12px',color:'#3157d5',textAlign:'right'}}>${(it.quantity*it.unitPrice).toFixed(2)}</strong>
                  <button type="button" onClick={()=>removeItem(idx)} style={{border:0,background:'transparent',color:'#ef4444',fontWeight:'bold',fontSize:'16px',cursor:'pointer'}}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:'12px',marginTop:'10px'}}>
            <label style={{fontSize:'13px',fontWeight:700}}>Total Cotización ($):</label>
            <input type="number" step="0.01" min="0" placeholder="0.00" style={{width:'130px',fontWeight:800,fontSize:'16px',color:'#3157d5',textAlign:'right'}} value={form.quote} onChange={e=>setForm({...form,quote:e.target.value})}/>
          </div>
        </div>

        <div className="editor-footer">
          {msg&&<span className="form-message">{msg}</span>}
          <button type="button" className="secondary-action" onClick={()=>setShowCreate(false)}>Cancelar</button>
          <button className="primary-action" disabled={busy}>
            {busy?'Generando orden...':'✓ Registrar orden y generar QR'}
          </button>
        </div>
      </form>
    </section>}

    <section className="panel">
      <div className="catalog-toolbar">
        <div>
          <h3>Órdenes Registradas</h3>
          <p>{filtered.length} órdenes encontradas</p>
        </div>
        <div className="search-box">
          <span>🔍</span>
          <input placeholder="Buscar por orden, cliente, modelo o IMEI..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </div>

      <div className="filter-pills">
        {[['ALL','Todas'],['DIAGNOSIS','Por Diagnosticar'],['QUOTED','Cotizadas'],['IN_PROGRESS','En Reparación'],['COMPLETED','Listas'],['CANCELLED','Canceladas']].map(([k,l])=>(
          <button key={k} className={`filter-pill ${filterStatus===k?'active':''}`} onClick={()=>setFilterStatus(k)}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length?<div className="order-list">
        {filtered.map(o=>(
          <article className="order-card" key={o.id}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                <span className="order-folio" style={{fontSize:'11px',padding:'3px 8px'}}>{o.order_number||'OT'}</span>
                <span className={`status-badge status-${String(o.status).toLowerCase()}`}>{statusLabel(o.status)}</span>
                <small style={{color:'#98a1b2'}}>{o.created_at?new Date(o.created_at).toLocaleDateString():''}</small>
              </div>

              <strong>{o.device_brand||''} {o.device_model||o.description||'Dispositivo'}</strong>
              <small>👤 {o.customer_name||'Cliente'} {o.customer_phone?`· 📞 ${o.customer_phone}`:''} {o.serial_number?`· 🔢 Serie: ${o.serial_number}`:''}</small>

              <div className="order-card-meta">
                <div>
                  <small>Falla reportada</small>
                  <strong>{o.reported_fault||o.description||'Sin detalle'}</strong>
                </div>
                <div>
                  <small>Diagnóstico</small>
                  <strong>{o.diagnosis||'Pendiente de evaluación'}</strong>
                </div>
                <div>
                  <small>Cotización total</small>
                  <strong style={{color:'#3157d5'}}>${Number(o.quote||0).toFixed(2)}</strong>
                </div>
              </div>

              {o.items&&o.items.length>0&&(
                <div style={{marginTop:'8px',display:'flex',gap:'6px',flexWrap:'wrap'}}>
                  {o.items.map((it:Any,idx:number)=>(
                    <span key={idx} className="order-folio" style={{fontSize:'10px',padding:'2px 7px',background:it.itemType==='LABOR'?'#e0e7ff':'#fef3c7',color:it.itemType==='LABOR'?'#3730a3':'#92400e'}}>
                      {it.quantity}x {it.name} (${Number(it.subtotal||it.quantity*it.unitPrice||0).toFixed(2)})
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="order-actions">
              <button className="btn-sm btn-primary-sm" onClick={()=>setQrModal(o)} title="Ver QR de seguimiento">
                📱 QR / Link
              </button>

              <a className="btn-sm btn-wa-sm" href={getWaLink(o)} target="_blank" rel="noreferrer" title="Enviar enlace por WhatsApp">
                💬 WhatsApp
              </a>

              <button className="btn-sm btn-secondary-sm" onClick={()=>openEditModal(o)} title="Actualizar diagnóstico, ítems y precio">
                🛠️ Taller
              </button>

              <button className="btn-sm btn-secondary-sm" onClick={()=>setTicketModal(o)} title="Imprimir comprobante">
                🖨️ Ticket
              </button>

              <select value={o.status} onChange={e=>updateStatus(o.id,e.target.value)}>
                <option value="OPEN">Abierta</option>
                <option value="DIAGNOSIS">En diagnóstico</option>
                <option value="QUOTED">Cotizada</option>
                <option value="APPROVED">Aprobada</option>
                <option value="IN_PROGRESS">En reparación</option>
                <option value="COMPLETED">Listo para retiro</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>
          </article>
        ))}
      </div>:<div className="empty">
        <b>📋</b>
        <p>No hay órdenes de servicio en este criterio.</p>
        <small>Registra una nueva orden o cambia los filtros.</small>
      </div>}
    </section>

    {/* MODAL QR Y ENLACE DE CLIENTE */}
    {qrModal&&<div className="modal-overlay" onClick={()=>setQrModal(null)}>
      <div className="modal-card" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <h3>📱 Seguimiento para el Cliente</h3>
          <button className="close-button" onClick={()=>setQrModal(null)}>✕</button>
        </div>

        <div className="qr-container">
          <p style={{textAlign:'center',fontSize:'13px',color:'#64748b'}}>
            El cliente puede escanear este código QR con la cámara de su celular para consultar el estado en tiempo real o autorizar la cotización.
          </p>

          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(getFullUrl(qrModal))}`}
            alt="Código QR de la orden"
            width="220"
            height="220"
          />

          <div className="qr-url-box">
            <small style={{display:'block',color:'#64748b',marginBottom:'4px'}}>Enlace directo de seguimiento:</small>
            <code>{getFullUrl(qrModal)}</code>
          </div>

          <div style={{display:'flex',gap:'10px',width:'100%',marginTop:'10px'}}>
            <button
              className="primary-action"
              style={{flex:1}}
              onClick={()=>{
                navigator.clipboard.writeText(getFullUrl(qrModal));
                alert('¡Enlace copiado al portapapeles!');
              }}
            >
              📋 Copiar Enlace
            </button>

            <a
              className="btn-sm btn-wa-sm"
              style={{flex:1,justifyContent:'center',padding:'12px',borderRadius:'10px'}}
              href={getWaLink(qrModal)}
              target="_blank"
              rel="noreferrer"
            >
              💬 Enviar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>}

    {/* MODAL ACTUALIZACIÓN TÉCNICA E ÍTEMS EN TALLER */}
    {editModal&&<div className="modal-overlay" onClick={()=>setEditModal(null)}>
      <div className="modal-card" style={{width:'min(620px,100%)'}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <h3>🛠️ Actualización Técnica · {editModal.order_number||'Orden'}</h3>
          <button className="close-button" onClick={()=>setEditModal(null)}>✕</button>
        </div>

        <form onSubmit={saveEditModal}>
          <div className="form-grid" style={{gridTemplateColumns:'1fr'}}>
            <label>Diagnóstico técnico
              <textarea
                style={{width:'100%',padding:'10px',borderRadius:'10px',border:'1px solid #dfe4ec',fontFamily:'inherit'}}
                rows={3}
                placeholder="Detalla la revisión técnica..."
                value={editModal.diagnosis||''}
                onChange={e=>setEditModal({...editModal,diagnosis:e.target.value})}
              />
            </label>

            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                <label style={{margin:0}}>Ítems de Mano de Obra y Repuestos</label>
                <button type="button" className="secondary-action" style={{fontSize:'11px',padding:'5px 10px'}} onClick={addEditItem}>
                  ＋ Agregar ítem
                </button>
              </div>

              {editItems.length===0?<p style={{fontSize:'12px',color:'#94a3b8',fontStyle:'italic',background:'#f8f9fc',padding:'8px',borderRadius:'8px'}}>
                No hay ítems desglosados en esta orden.
              </p>:(
                <div style={{display:'grid',gap:'6px',maxHeight:'180px',overflowY:'auto',marginBottom:'10px'}}>
                  {editItems.map((it,idx)=>(
                    <div key={idx} style={{display:'grid',gridTemplateColumns:'120px 1fr 65px 85px 70px 24px',gap:'6px',alignItems:'center',background:'#f8f9fc',padding:'6px 8px',borderRadius:'8px'}}>
                      <select value={it.itemType} onChange={e=>updateEditItem(idx,'itemType',e.target.value)} style={{fontSize:'11px',padding:'5px'}}>
                        <option value="LABOR">Mano de Obra</option>
                        <option value="PART">Repuesto</option>
                      </select>
                      <input placeholder="Concepto / repuesto" value={it.name} onChange={e=>updateEditItem(idx,'name',e.target.value)} style={{fontSize:'11px',padding:'5px'}} required/>
                      <input type="number" min="1" placeholder="Cant" value={it.quantity} onChange={e=>updateEditItem(idx,'quantity',Number(e.target.value))} style={{fontSize:'11px',padding:'5px'}}/>
                      <input type="number" step="0.01" min="0" placeholder="$ Precio" value={it.unitPrice} onChange={e=>updateEditItem(idx,'unitPrice',Number(e.target.value))} style={{fontSize:'11px',padding:'5px'}}/>
                      <strong style={{fontSize:'11px',color:'#3157d5',textAlign:'right'}}>${(it.quantity*it.unitPrice).toFixed(2)}</strong>
                      <button type="button" onClick={()=>removeEditItem(idx)} style={{border:0,background:'transparent',color:'#ef4444',fontWeight:'bold',fontSize:'14px',cursor:'pointer'}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label>Monto Total de la Cotización ($)
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                style={{fontWeight:800,fontSize:'16px',color:'#3157d5'}}
                value={editModal.quote||''}
                onChange={e=>setEditModal({...editModal,quote:e.target.value})}
              />
            </label>

            <label>Notas internas del taller
              <input
                placeholder="Notas técnicas visibles solo para el equipo..."
                value={editModal.technician_notes||editModal.technicianNotes||''}
                onChange={e=>setEditModal({...editModal,technician_notes:e.target.value})}
              />
            </label>

            <label>Estado de la orden
              <select
                value={editModal.status||'OPEN'}
                onChange={e=>setEditModal({...editModal,status:e.target.value})}
              >
                <option value="OPEN">Abierta</option>
                <option value="DIAGNOSIS">En diagnóstico</option>
                <option value="QUOTED">Cotizada (esperando cliente)</option>
                <option value="APPROVED">Aprobada</option>
                <option value="IN_PROGRESS">En reparación</option>
                <option value="COMPLETED">Listo para retiro</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </label>
          </div>

          <div className="editor-footer" style={{marginTop:'18px'}}>
            <button type="button" className="secondary-action" onClick={()=>setEditModal(null)}>Cancelar</button>
            <button className="primary-action" disabled={busy}>
              {busy?'Guardando...':'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>}

    {/* MODAL TICKET DE RECEPCIÓN IMPRIMIBLE */}
    {ticketModal&&<div className="modal-overlay" onClick={()=>setTicketModal(null)}>
      <div className="modal-card" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <h3>🖨️ Ticket de Recepción</h3>
          <button className="close-button" onClick={()=>setTicketModal(null)}>✕</button>
        </div>

        <div id="printable-ticket" className="ticket-preview">
          <h2>FIXMETIENDAS</h2>
          <div className="ticket-center">Servicio Técnico Especializado</div>
          <div className="ticket-divider"></div>
          <div><strong>ORDEN: {ticketModal.order_number||ticketModal.id?.slice(0,8)}</strong></div>
          <div>Fecha: {ticketModal.created_at?new Date(ticketModal.created_at).toLocaleString():''}</div>
          <div>Cliente: {ticketModal.customer_name||'Cliente'}</div>
          <div>Teléfono: {ticketModal.customer_phone||'N/A'}</div>
          <div className="ticket-divider"></div>
          <div><strong>EQUIPO:</strong> {ticketModal.device_brand||''} {ticketModal.device_model||ticketModal.description}</div>
          <div><strong>SERIE/IMEI:</strong> {ticketModal.serial_number||'N/A'}</div>
          <div><strong>ACCESORIOS:</strong> {ticketModal.accessories||'Ninguno'}</div>
          <div><strong>FALLA REPORTADA:</strong> {ticketModal.reported_fault||ticketModal.description}</div>

          {ticketModal.items&&ticketModal.items.length>0&&(
            <>
              <div className="ticket-divider"></div>
              <div><strong>DESGLOSE DE SERVICIO:</strong></div>
              {ticketModal.items.map((it:Any,idx:number)=>(
                <div key={idx} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',margin:'2px 0'}}>
                  <span>{it.quantity}x {it.name} ({it.itemType==='LABOR'?'MO':'Rep'})</span>
                  <span>${Number(it.subtotal||it.quantity*it.unitPrice||0).toFixed(2)}</span>
                </div>
              ))}
            </>
          )}

          <div className="ticket-divider"></div>
          <div style={{fontSize:'13px',fontWeight:800}}>TOTAL COTIZACIÓN: ${Number(ticketModal.quote||0).toFixed(2)}</div>
          <div>ESTADO: {statusLabel(ticketModal.status)}</div>
          <div className="ticket-divider"></div>

          <div className="ticket-center" style={{margin:'10px 0'}}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(getFullUrl(ticketModal))}`}
              alt="QR Ticket"
              width="140"
              height="140"
            />
            <div style={{fontSize:'10px',marginTop:'4px'}}>Escanea para consultar tu orden en tiempo real</div>
          </div>

          <div className="ticket-divider"></div>
          <p style={{fontSize:'9px',textAlign:'center',color:'#64748b'}}>
            * No nos hacemos responsables por equipos no retirados después de 30 días.<br/>
            * Garantía de 90 días en repuestos y mano de obra instalada.
          </p>
        </div>

        <div style={{display:'flex',gap:'10px',marginTop:'18px'}}>
          <button className="secondary-action" style={{flex:1}} onClick={()=>setTicketModal(null)}>Cerrar</button>
          <button className="primary-action" style={{flex:1}} onClick={()=>window.print()}>🖨️ Imprimir Ticket</button>
        </div>
      </div>
    </div>}
  </>;
}
function Reports({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){
  const [r, setR] = React.useState<Any>({});
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    api('/api/reports/summary')
      .then(x => x.ok ? x.json() : {})
      .then(data => { setR(data); setLoading(false); });
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  const dailyTrend: Any[] = r.dailyTrend || [];
  const topProducts: Any[] = r.topProducts || [];
  const channelBreakdown = r.channelBreakdown || {};
  const storeChannel = channelBreakdown.STORE || { count: 0, revenue: 0, cogs: 0, profit: 0 };
  const onlineChannel = channelBreakdown.ONLINE || { count: 0, revenue: 0, cogs: 0, profit: 0 };
  const totalRev = Number(r.revenue || 0);

  const storeRev = Number(storeChannel.revenue || 0);
  const onlineRev = Number(onlineChannel.revenue || 0);
  const storePct = totalRev > 0 ? ((storeRev / totalRev) * 100).toFixed(0) : '0';
  const onlinePct = totalRev > 0 ? ((onlineRev / totalRev) * 100).toFixed(0) : '0';

  const payMethods = r.paymentMethods || {};
  const cashAmount = Number(payMethods.CASH?.amount || 0);
  const cardAmount = Number(payMethods.CARD?.amount || 0);
  const transferAmount = Number(payMethods.TRANSFER?.amount || 0);
  const paySum = (cashAmount + cardAmount + transferAmount) || 1;

  // Max value for SVG chart scaling
  const maxChartVal = dailyTrend.reduce((m, d) => Math.max(m, Number(d.revenue || 0)), 10);

  return (
    <>
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">INTELIGENCIA DE NEGOCIOS & FINANZAS</span>
          <h2>Dashboard Financiero y Rentabilidad</h2>
          <p>Supervisa ingresos reales, costo de venta (COGS), márgenes de ganancia y valorización del stock.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary-action" onClick={() => window.print()}>🖨️ Imprimir Reporte</button>
          <button className="primary-action" onClick={load}>Actualizar</button>
        </div>
      </section>

      {/* TOP FINANCIAL KPIS */}
      <div className="finance-grid">
        <div className="finance-card">
          <small>Ingresos Totales (Ventas)</small>
          <strong className="text-revenue">${Number(r.revenue || 0).toFixed(2)}</strong>
          <span>{r.sales || 0} transacciones cobradas</span>
        </div>
        <div className="finance-card">
          <small>Costo de Mercadería (COGS)</small>
          <strong className="text-cogs">${Number(r.cogs || 0).toFixed(2)}</strong>
          <span>Costo de adquisición de lo vendido</span>
        </div>
        <div className="finance-card">
          <small>Ganancia Bruta Real</small>
          <strong className="text-profit">+${Number(r.grossProfit || 0).toFixed(2)}</strong>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{Number(r.grossMarginPercent || 0).toFixed(1)}% margen comercial real</span>
        </div>
        <div className="finance-card">
          <small>Inversión Activa en Stock</small>
          <strong>${Number(r.inventoryCostValue || 0).toFixed(2)}</strong>
          <span>Capital en mercadería disponible</span>
        </div>
        <div className="finance-card">
          <small>Valorización PVP en Bodega</small>
          <strong style={{ color: '#475569' }}>${Number(r.inventoryRetailValue || 0).toFixed(2)}</strong>
          <span>Ganancia potencial: +${Number(r.inventoryPotentialProfit || 0).toFixed(2)}</span>
        </div>
        <div className="finance-card">
          <small>Unidades en Stock</small>
          <strong>{r.totalStockUnits || 0}</strong>
          <span>{r.lowStock || 0} productos en stock bajo</span>
        </div>
      </div>

      {/* INTERACTIVE DAILY SALES & PROFIT SVG CHART */}
      <div className="chart-panel">
        <div className="chart-header">
          <div>
            <h3 style={{ margin: 0 }}>Tendencia de Ingresos vs. Ganancia Bruta</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Evolución diaria de ventas y utilidad neta en los últimos 30 días</p>
          </div>
          <div className="chart-legend">
            <div><span className="legend-dot" style={{ background: '#3157d5' }}></span>Ingresos ($)</div>
            <div><span className="legend-dot" style={{ background: '#10b981' }}></span>Ganancia Bruta ($)</div>
          </div>
        </div>

        <div className="svg-container">
          {dailyTrend.length > 0 ? (
            <svg className="svg-chart" viewBox={`0 0 ${Math.max(600, dailyTrend.length * 60)} 220`}>
              {/* Background grid lines */}
              <line x1="40" y1="30" x2={Math.max(600, dailyTrend.length * 60)} y2="30" stroke="#f1f5f9" strokeDasharray="4" />
              <line x1="40" y1="90" x2={Math.max(600, dailyTrend.length * 60)} y2="90" stroke="#f1f5f9" strokeDasharray="4" />
              <line x1="40" y1="150" x2={Math.max(600, dailyTrend.length * 60)} y2="150" stroke="#f1f5f9" strokeDasharray="4" />
              <line x1="40" y1="180" x2={Math.max(600, dailyTrend.length * 60)} y2="180" stroke="#e2e8f0" />

              {dailyTrend.map((d, i) => {
                const x = 50 + i * 55;
                const revHeight = Math.max(4, (Number(d.revenue || 0) / maxChartVal) * 140);
                const profHeight = Math.max(2, (Number(d.profit || 0) / maxChartVal) * 140);
                const yRev = 180 - revHeight;
                const yProf = 180 - profHeight;

                return (
                  <g key={d.date || i}>
                    {/* Revenue Bar */}
                    <rect
                      x={x}
                      y={yRev}
                      width="16"
                      height={revHeight}
                      rx="3"
                      fill="#3157d5"
                      opacity="0.85"
                    >
                      <title>{`${d.day}: Ingresos $${Number(d.revenue).toFixed(2)}`}</title>
                    </rect>

                    {/* Profit Bar */}
                    <rect
                      x={x + 18}
                      y={yProf}
                      width="16"
                      height={profHeight}
                      rx="3"
                      fill="#10b981"
                      opacity="0.9"
                    >
                      <title>{`${d.day}: Ganancia +$${Number(d.profit).toFixed(2)}`}</title>
                    </rect>

                    {/* Date label */}
                    <text
                      x={x + 16}
                      y="200"
                      fontSize="10"
                      fill="#64748b"
                      textAnchor="middle"
                    >
                      {d.day}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="empty" style={{ padding: '30px 0' }}>
              <p>Aún no hay suficiente historial diario para graficar.</p>
            </div>
          )}
        </div>
      </div>

      {/* DISTRIBUTION CARDS */}
      <div className="dist-grid">
        {/* CHANNELS BREAKDOWN */}
        <div className="dist-card">
          <h4>🏪 Canales de Venta (Omnicanal)</h4>
          <div className="dist-item">
            <div className="dist-labels">
              <span>Local Físico ({storeChannel.count} ventas)</span>
              <span>${storeRev.toFixed(2)} ({storePct}%)</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${storePct}%`, background: '#3157d5' }}></div>
            </div>
          </div>
          <div className="dist-item" style={{ marginTop: '12px' }}>
            <div className="dist-labels">
              <span>Internet / WhatsApp ({onlineChannel.count} ventas)</span>
              <span>${onlineRev.toFixed(2)} ({onlinePct}%)</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${onlinePct}%`, background: '#8b5cf6' }}></div>
            </div>
          </div>
        </div>

        {/* PAYMENT METHODS SHARE */}
        <div className="dist-card">
          <h4>💳 Métodos de Cobro</h4>
          <div className="dist-item">
            <div className="dist-labels">
              <span>💵 Efectivo</span>
              <span>${cashAmount.toFixed(2)} ({((cashAmount / paySum) * 100).toFixed(0)}%)</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${(cashAmount / paySum) * 100}%`, background: '#10b981' }}></div>
            </div>
          </div>
          <div className="dist-item" style={{ marginTop: '10px' }}>
            <div className="dist-labels">
              <span>💳 Tarjetas</span>
              <span>${cardAmount.toFixed(2)} ({((cardAmount / paySum) * 100).toFixed(0)}%)</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${(cardAmount / paySum) * 100}%`, background: '#3b82f6' }}></div>
            </div>
          </div>
          <div className="dist-item" style={{ marginTop: '10px' }}>
            <div className="dist-labels">
              <span>📲 Transferencia / QR</span>
              <span>${transferAmount.toFixed(2)} ({((transferAmount / paySum) * 100).toFixed(0)}%)</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: `${(transferAmount / paySum) * 100}%`, background: '#f59e0b' }}></div>
            </div>
          </div>
        </div>

        {/* LOGISTICS / DELIVERIES */}
        <div className="dist-card">
          <h4>🛵 Modalidad de Entrega</h4>
          <div className="dist-item">
            <div className="dist-labels">
              <span>🏬 Retiro en Tienda</span>
              <span>{r.fulfillmentBreakdown?.PICKUP || 0} pedidos</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: '80%', background: '#64748b' }}></div>
            </div>
          </div>
          <div className="dist-item" style={{ marginTop: '12px' }}>
            <div className="dist-labels">
              <span>🛵 Entrega a Domicilio</span>
              <span>{r.fulfillmentBreakdown?.DELIVERY || 0} pedidos</span>
            </div>
            <div className="dist-track">
              <div className="dist-bar" style={{ width: '40%', background: '#3157d5' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* TOP PRODUCTS RANKING TABLE */}
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h3>Top Productos con Mayor Rentabilidad</h3>
            <p className="catalog-toolbar-p">Artículos más vendidos ordenados por margen y volumen de ingresos generados.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Unidades Vendidas</th>
                <th>Ingresos Generados</th>
                <th>Costo (COGS)</th>
                <th>Ganancia Bruta</th>
                <th>Margen %</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, idx) => {
                const rev = Number(p.revenue || 0);
                const cost = Number(p.cogs || 0);
                const profit = Number(p.profit || 0);
                const margin = rev > 0 ? ((profit / rev) * 100) : 0;

                return (
                  <tr key={p.id || idx}>
                    <td><b>{p.name}</b></td>
                    <td><span className="sku-label">{p.sku}</span></td>
                    <td><strong>{p.unitsSold}</strong> unids</td>
                    <td style={{ fontWeight: 700 }}>${rev.toFixed(2)}</td>
                    <td style={{ color: '#f43f5e' }}>${cost.toFixed(2)}</td>
                    <td style={{ fontWeight: 800, color: '#10b981' }}>+${profit.toFixed(2)}</td>
                    <td><span className="status-badge status-approved">{margin.toFixed(1)}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!topProducts.length && (
            <div className="empty">
              <b>📊</b>
              <p>No hay ventas registradas aún para rankear productos.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
function Warranties({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){const[rows,setRows]=React.useState<Any[]>([]),[form,setForm]=React.useState({saleId:'',productId:'',expiresAt:'',terms:''}),[msg,setMsg]=React.useState('');const load=React.useCallback(()=>api('/api/warranties').then(r=>r.ok?r.json():[]).then(setRows),[api]);React.useEffect(()=>{load()},[load]);async function add(e:React.FormEvent){e.preventDefault();const r=await api('/api/warranties',{method:'POST',body:JSON.stringify({...form,expiresAt:new Date(form.expiresAt).toISOString()})});setMsg(r.ok?'Garant?a creada':'No se pudo crear');if(r.ok){setForm({saleId:'',productId:'',expiresAt:'',terms:''});load()}}return <><section className="panel"><h3>Nueva garant?a</h3><form className="form-grid" onSubmit={add}><input placeholder="ID de venta" value={form.saleId} onChange={e=>setForm({...form,saleId:e.target.value})} required/><input placeholder="ID de producto" value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})} required/><input type="datetime-local" value={form.expiresAt} onChange={e=>setForm({...form,expiresAt:e.target.value})} required/><input placeholder="T?rminos" value={form.terms} onChange={e=>setForm({...form,terms:e.target.value})}/><button>Guardar garant?a</button>{msg&&<small>{msg}</small>}</form></section><Table title="Garant?as de ventas" columns={['product_id','sale_id','starts_at','expires_at','status','terms']} rows={rows} empty="No hay garant?as registradas."/> </>}
function Table({title,columns,rows,empty,action}:{title:string,columns:string[],rows:Any[],empty:string,action?:string}){return <section className="panel table-panel"><div className="panel-head"><h3>{title}</h3>{action&&<button>{action}</button>}</div>{rows.length?<div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c.replace(/([A-Z])/g,' $1')}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{columns.map(c=><td data-label={c.replace(/([A-Z])/g,' $1')} key={c}>{c==='price'||c==='quote'||c==='total'?`$${Number(r[c]||0).toFixed(2)}`:c==='approval_url'?<a href={r[c]} target="_blank" rel="noreferrer">Abrir autorización</a>:r[c]??'*'}</td>)}</tr>)}</tbody></table></div>:<div className="empty"><b>--</b><p>{empty}</p><small>Los registros aparecerán aquí.</small></div>}</section>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
