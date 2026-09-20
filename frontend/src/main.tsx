import React from 'react';import{createRoot}from'react-dom/client';import'./style.css';
import { PublicCatalog, PublicDeliveryTracking, PublicWorkOrderTracking, CatalogShareModal } from './publicModules';
import { QuotesPage, PublicQuoteView } from './quotesModule';
import { SriRideModal } from './sriRideModal';
import { SriInvoicesListModal } from './sriInvoicesListModal';
import { saveCatalogLocally, getCatalogLocally, saveCustomersLocally, getCustomersLocally, queueOfflineSale, getPendingSales, removePendingSale, clearPendingSales, OfflineSale } from './offlineDb';
import { ThermalTicketModal, QuickCustomerModal, CorteZModal, WorkOrderReceiptModal, BarcodeTagsModal, CsvImportModal, TechnicianWorkbenchModal } from './commercialModals';
type Any=Record<string,any>;let tenantId=localStorage.tenantId||'00000000-0000-0000-0000-000000000001',branchId=localStorage.branchId||'00000000-0000-0000-0000-000000000010';
const nav=[['cash','Caja','C'],['pos','Punto de venta','V'],['sales','Ventas','VT'],['quotes','Cotizaciones','CT'],['administration','Empresa','E'],['home','Resumen','R'],['my-work','Mi Trabajo','MT'],['products','Inventario','I'],['customers','Clientes','CL'],['deliveries','Entregas','D'],['work-orders','Ordenes de servicio','OT'],['warranties','Garantias','G'],['reports','Reportes','RE']];
function App(){const[token,setToken]=React.useState(localStorage.token||''),[page,setPage]=React.useState('home'),[mods,setMods]=React.useState<Any[]>([]),[toast,setToast]=React.useState(''),[menuOpen,setMenuOpen]=React.useState(false),[hash,setHash]=React.useState(window.location.hash||window.location.search),[showCatalogModal,setShowCatalogModal]=React.useState(false),[theme,setTheme]=React.useState<string>(localStorage.theme||'light');React.useEffect(()=>{document.documentElement.setAttribute('data-theme',theme);localStorage.theme=theme;},[theme]);React.useEffect(()=>{const h=()=>setHash(window.location.hash||window.location.search);window.addEventListener('hashchange',h);window.addEventListener('popstate',h);return()=>{window.removeEventListener('hashchange',h);window.removeEventListener('popstate',h);};},[]);let role='';let userPerms:string[]=[];let userTenantId=tenantId;try{const claims=token?JSON.parse(atob(token.split('.')[1])):{};role=(claims.primary_role||claims.scope||'').replace('SCOPE_','').split(' ')[0];if(claims.tenant_id){userTenantId=claims.tenant_id;tenantId=claims.tenant_id;localStorage.tenantId=claims.tenant_id;}if(claims.branch_id){branchId=claims.branch_id;localStorage.branchId=claims.branch_id;}if(Array.isArray(claims.permissions)){userPerms=claims.permissions;if((role==='MANAGER'||role==='SELLER'||role==='ACCOUNTANT')&&!userPerms.includes('quotes')){userPerms=[...userPerms,'quotes'];}}}catch{}const catMatch=hash.match(/#catalog\/([a-f0-9\-]+)/i)||hash.match(/[?&]catalog=([a-f0-9\-]+)/i);const trkMatch=hash.match(/#tracking\/([a-zA-Z0-9\-]+)/i)||hash.match(/[?&]tracking=([a-zA-Z0-9\-]+)/i);const orderMatch=hash.match(/#order\/([a-zA-Z0-9\-\.]+)/i)||hash.match(/[?&]order=([a-zA-Z0-9\-\.]+)/i);const quoteMatch=hash.match(/#quote\/([a-zA-Z0-9\-\.]+)/i)||hash.match(/[?&]quote=([a-zA-Z0-9\-\.]+)/i);if(catMatch)return<PublicCatalog tenantId={catMatch[1]} onBack={()=>{window.location.hash='';setHash('');}} isLogged={!!token}/>;if(trkMatch)return<PublicDeliveryTracking code={trkMatch[1]} onBack={()=>{window.location.hash='';setHash('');}} isLogged={!!token}/>;if(orderMatch)return<PublicWorkOrderTracking code={orderMatch[1]} onBack={()=>{window.location.hash='';setHash('');}} isLogged={!!token}/>;if(quoteMatch)return<PublicQuoteView token={quoteMatch[1]} onBack={()=>{window.location.hash='';setHash('');}} isLogged={!!token}/>;const isSaasOwner=role==='TENANT_ADMIN'||role==='SUPER_ADMIN';const saasNav:[string,string,string][]=[['platform-overview','Panel SaaS','📊'],['platform-companies','Empresas','🏢'],['platform-rates','Tarifas por Empresa','🏷️'],['platform-payments','Cobranzas y Recibos','🧾']];const allowed:Record<string,string[]>={SUPER_ADMIN:saasNav.map(n=>n[0]),TENANT_ADMIN:saasNav.map(n=>n[0]),MANAGER:['home','my-work','cash','pos','sales','quotes','administration','products','customers','deliveries','work-orders','warranties','reports'],SELLER:['home','cash','pos','sales','quotes','products','customers','work-orders','warranties'],DELIVERY:['home','customers','deliveries'],TECHNICIAN:['home','my-work','customers','work-orders','warranties'],ACCOUNTANT:['home','cash','sales','quotes','reports']};React.useEffect(()=>{if(isSaasOwner&&(page==='home'||!saasNav.some(n=>n[0]===page))){setPage('platform-companies')}},[isSaasOwner,page]);const groups:[string,string[]][]=[['VENTAS',['pos','sales','quotes','cash','deliveries']],['OPERACION',['my-work','work-orders','products','customers','warranties']],['GESTION',['reports','administration']]];const api=React.useCallback((url:string,opt:RequestInit={})=>fetch(url,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token}}),[token]);const canReadModules=['SUPER_ADMIN','TENANT_ADMIN','MANAGER'].includes(role);React.useEffect(()=>{if(token&&canReadModules&&!isSaasOwner)api('/api/modules').then(r=>r.ok?r.json():[]).then(setMods)},[token,api,canReadModules,isSaasOwner]);React.useEffect(()=>{if(token&&!isSaasOwner){api('/api/branches').then(r=>r.ok?r.json():[]).then(branches=>{if(Array.isArray(branches)&&branches.length>0){if(!branches.some((b:Any)=>b.id===branchId)){branchId=branches[0].id;localStorage.branchId=branches[0].id;}}}).catch(()=>{});}},[token,api,isSaasOwner]);const moduleKey=(item:string)=>item==='cash'?'CASH_REGISTER':item==='products'?'INVENTORY':item==='my-work'?'WORK_ORDERS':item==='quotes'?'QUOTES':(item==='warranties'||item==='sales'?'POS':item.toUpperCase()).replace('-','_');const enabled=(key:string)=>{if(!canReadModules||mods.length===0)return true;const found=mods.find(m=>m.moduleKey===key);return found?found.enabled:true;};if(!token)return <Login onLogin={t=>{localStorage.token=t;setToken(t)}}/>;function go(k:string){setPage(k);setMenuOpen(false)}const visible=isSaasOwner?saasNav.map(n=>n[0]):(userPerms.length>0?userPerms:(allowed[role]||['home']));const item=(key:string)=>isSaasOwner?saasNav.find(n=>n[0]===key):nav.find(n=>n[0]===key);return <div className="shell"><button className="mobile-menu" aria-label="Abrir menú" onClick={()=>setMenuOpen(!menuOpen)}>☰</button><aside className={menuOpen?'drawer-open':''}><div className="brand"><b>F</b> {isSaasOwner?<>Fixme<span>SaaS</span></>:<>Fixme<span>Tiendas</span></>}</div><div className="branch-switch"><small>{isSaasOwner?'CONTROL MAESTRO':'EMPRESA / SUCURSAL'}</small><strong>{isSaasOwner?'Plataforma Multi-Empresas':(localStorage.tenantName||'Principal')}</strong><span>{isSaasOwner?'● Conectado como SaaS Owner':'● Sucursal Principal Operativa'}</span></div>{isSaasOwner?<section className="nav-group"><small>ADMINISTRACIÓN SAAS</small>{saasNav.map(n=><button key={n[0]} className={page===n[0]?'nav-item active':'nav-item'} onClick={()=>go(n[0])}><i>{n[2]}</i>{n[1]}</button>)}</section>:(<><button className={page==='home'?'nav-item active':'nav-item'} onClick={()=>go('home')}><i>R</i>Resumen</button>{groups.map(g=><section className="nav-group" key={g[0]}><small>{g[0]}</small>{g[1].map(k=>{const n=nav.find(x=>x[0]===k);return n&&visible.includes(k)&&(k==='administration'||enabled(moduleKey(k)))?<button className={page===k?'nav-item active':'nav-item'} onClick={()=>go(k)} key={k}><i>{n[2]}</i>{n[1]}</button>:null})}</section>)}</>)}<div className="sidebar-user"><div className="user-avatar">{isSaasOwner?'👑':(role.slice(0,1)||'U')}</div><div><strong>{isSaasOwner?'DUEÑO DEL SISTEMA':(role||'USUARIO')}</strong><small>{isSaasOwner?'Acceso Global SaaS':'Sesión activa'}</small><button className="theme-toggle-btn" style={{marginTop:'4px',padding:'3px 6px',fontSize:'10px'}} onClick={()=>setTheme((t:string)=>t==='dark'?'light':'dark')}>{theme==='dark'?'☀️ Claro':'🌙 Oscuro'}</button></div><button aria-label="Cerrar sesión" onClick={()=>{localStorage.clear();tenantId='00000000-0000-0000-0000-000000000001';branchId='00000000-0000-0000-0000-000000000010';setToken('');setPage('home')}}>↪</button></div></aside><main><header className="app-header"><div><small>{isSaasOwner?'👑 DUEÑO DEL SISTEMA · ADMINISTRACIÓN GLOBAL SAAS':(role||'USUARIO')+' · '+(localStorage.tenantName?(localStorage.tenantName.toUpperCase()+' · '):'')+'SUCURSAL PRINCIPAL'}</small><h1>{item(page)?.[1]||'Panel'}</h1><p className="header-subtitle">{isSaasOwner?(page==='platform-rates'?'Tarifas mensuales acordadas, planes, descuentos y ciclo de cobro por empresa':page==='platform-payments'?'Registro y comprobantes oficiales de recaudación de suscripciones SaaS':page==='platform-overview'?'Métricas financieras globales, MRR y alertas de cobro':'Directorio de empresas, estado de cuenta y suspensión preventiva'):'Información operativa en tiempo real de tu tienda'}</p></div><div className="header-actions"><button type="button" className="header-icon" onClick={()=>setTheme((t:string)=>t==='dark'?'light':'dark')} title={theme==='dark'?'Cambiar a Modo Claro':'Cambiar a Modo Oscuro'}>{theme==='dark'?'☀️':'🌙'}</button><button type="button" className="header-icon" onClick={()=>setShowCatalogModal(true)} title="📱 Catálogo Digital para Clientes" style={{background:'#eff6ff',color:'#2563eb',fontWeight:700,fontSize:'12px',padding:'5px 12px',borderRadius:'8px',border:'1px solid #bfdbfe',display:'inline-flex',alignItems:'center',gap:'6px',cursor:'pointer'}}>📱 Catálogo Digital</button><button className="header-icon" aria-label="Notificaciones">●</button><div className="header-avatar">{isSaasOwner?'👑':(role.slice(0,1)||'U')}</div></div></header>{toast&&<div className="toast toast-success" onClick={()=>setToast('')}><b>✓</b>{toast}</div>}{isSaasOwner?<ErrorBoundary><PlatformAdministration api={api} notify={setToast} activeTab={page} setTab={setPage}/></ErrorBoundary>:(page==='home'&&visible.includes('home')?<Dashboard api={api} go={go} role={role}/>:page==='my-work'&&visible.includes('my-work')?<MyWork api={api} notify={setToast} go={go}/>:page==='cash'&&visible.includes('cash')?<Cash api={api} notify={setToast}/>:page==='pos'&&visible.includes('pos')?<POS api={api} notify={setToast}/>:page==='sales'&&visible.includes('sales')?<Sales api={api}/>:page==='quotes'&&visible.includes('quotes')?<QuotesPage api={api} notify={setToast} go={go}/>:page==='administration'&&visible.includes('administration')?<Administration api={api} notify={setToast}/>:page==='products'&&visible.includes('products')?<Products api={api} role={role}/>:page==='customers'&&visible.includes('customers')?<Customers api={api} notify={setToast} go={go}/>:page==='deliveries'&&visible.includes('deliveries')?<Deliveries api={api}/>:page==='work-orders'&&visible.includes('work-orders')?<Orders api={api}/>:page==='reports'&&visible.includes('reports')?<Reports api={api}/>:page==='warranties'&&visible.includes('warranties')?<Warranties api={api} notify={setToast} go={go}/>:<section className="panel"><h3>Acceso restringido</h3><p>Este módulo pertenece a la gestión interna de cada tienda o no tienes permisos suficientes.</p></section>)}<nav className="mobile-nav">{(isSaasOwner?saasNav:nav.filter(n=>visible.includes(n[0])).slice(0,5)).map(n=><button className={page===n[0]?'active':''} onClick={()=>go(n[0])} key={n[0]}><i>{n[2]}</i><small>{n[1]}</small></button>)}</nav></main>{showCatalogModal&&<CatalogShareModal tenantId={userTenantId} storeName={isSaasOwner?'Fixme SaaS Multi-Empresas':(localStorage.tenantName||'Mi Tienda')} onClose={()=>setShowCatalogModal(false)} notify={setToast}/>}</div>}
function Login({onLogin}:{onLogin:(t:string)=>void}){const[email,setEmail]=React.useState(''),[password,setPassword]=React.useState(''),[error,setError]=React.useState('');async function submit(e:React.FormEvent){e.preventDefault();const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),password})});if(r.ok){const data=await r.json();if(data.tenantId){tenantId=data.tenantId;localStorage.tenantId=data.tenantId;}if(data.branchId){branchId=data.branchId;localStorage.branchId=data.branchId;}if(data.tenantName){localStorage.tenantName=data.tenantName;}if(data.fullName){localStorage.fullName=data.fullName;}onLogin(data.accessToken);}else{try{const data=await r.json();if(data&&(data.error==='STORE_SUSPENDED'||r.status===402)){setError('🚫 '+(data.message||'Esta tienda se encuentra suspendida por mensualidad pendiente. Contacta al administrador del sistema.'));return;}}catch{}setError('No pudimos validar tus credenciales.')}}return <div className="login"><div className="login-card"><div className="logo">FX</div><h1>Bienvenido a Fixme<span>Tiendas</span></h1><p>Gestiona tu negocio desde un solo lugar.</p><form onSubmit={submit}><label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="ejemplo@correo.com"/></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"/></label><button>Iniciar sesión</button>{error&&<em>{error}</em>}</form></div></div>}
function Cash({api,notify}:{api:(u:string,o?:RequestInit)=>Promise<Response>,notify:(s:string)=>void}){
  const [s, setS] = React.useState<Any|null>(null);
  const [history, setHistory] = React.useState<Any[]>([]);
  const [opening, setOpening] = React.useState('100');
  const [movementFilter, setMovementFilter] = React.useState('ALL');

  // Modals
  const [showMoveModal, setShowMoveModal] = React.useState(false);
  const [showDepositModal, setShowDepositModal] = React.useState(false);
  const [showCloseModal, setShowCloseModal] = React.useState(false);
  const [corteZSummary, setCorteZSummary] = React.useState<Any|null>(null);
  const [useDenom, setUseDenom] = React.useState(false);
  const [denoms, setDenoms] = React.useState<Record<string, number>>({
    b100: 0, b50: 0, b20: 0, b10: 0, b5: 0, b1: 0,
    c100: 0, c50: 0, c25: 0, c10: 0, c5: 0, c1: 0
  });

  const updateDenom = (k: string, v: number) => {
    const next = { ...denoms, [k]: Math.max(0, v) };
    setDenoms(next);
    const tot = (
      (next.b100 || 0) * 100 +
      (next.b50 || 0) * 50 +
      (next.b20 || 0) * 20 +
      (next.b10 || 0) * 10 +
      (next.b5 || 0) * 5 +
      (next.b1 || 0) * 1 +
      (next.c100 || 0) * 1.00 +
      (next.c50 || 0) * 0.50 +
      (next.c25 || 0) * 0.25 +
      (next.c10 || 0) * 0.10 +
      (next.c5 || 0) * 0.05 +
      (next.c1 || 0) * 0.01
    );
    setCloseForm(f => ({ ...f, countedCash: tot.toFixed(2) }));
  };

  // Forms
  const [movement, setMovement] = React.useState({ type: 'CASH_IN', paymentMethod: 'CASH', amount: '', reason: '' });
  const [depositForm, setDepositForm] = React.useState({ destination: 'BANCO_PICHINCHA', amount: '', reference: '', notes: '' });
  const [closeForm, setCloseForm] = React.useState({ countedCash: '', depositDestination: 'BANCO_PICHINCHA', depositReference: '', depositAmount: '', nextDayFund: '50', notes: '' });

  const load = React.useCallback(() => {
    api('/api/cash/current?branchId=' + branchId).then(r => r.json()).then(x => setS(x && x.id ? x : null));
    api('/api/cash/movements?branchId=' + branchId).then(r => r.ok ? r.json() : []).then(setHistory);
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  async function open() {
    const r = await api('/api/cash/open?branchId=' + branchId, {
      method: 'POST',
      body: JSON.stringify({ openingCash: Number(opening), amounts: { CASH: Number(opening) } })
    });
    if (r.ok) { notify('Caja de turno abierta exitosamente'); load(); }
  }

  async function move(e: React.FormEvent) {
    e.preventDefault();
    const r = await api('/api/cash/movement?branchId=' + branchId, {
      method: 'POST',
      body: JSON.stringify({ ...movement, amount: Number(movement.amount) })
    });
    if (r.ok) {
      notify('Movimiento registrado en caja');
      setMovement({ type: 'CASH_IN', paymentMethod: 'CASH', amount: '', reason: '' });
      setShowMoveModal(false);
      load();
    }
  }

  async function recordDeposit(e: React.FormEvent) {
    e.preventDefault();
    const r = await api('/api/cash/deposit?branchId=' + branchId, {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(depositForm.amount),
        destination: depositForm.destination,
        reference: depositForm.reference,
        notes: depositForm.notes
      })
    });
    if (r.ok) {
      notify('Depósito a banco registrado');
      setDepositForm({ destination: 'BANCO_PICHINCHA', amount: '', reference: '', notes: '' });
      setShowDepositModal(false);
      load();
    }
  }

  async function close(e: React.FormEvent) {
    e.preventDefault();
    const counted = Number(closeForm.countedCash || 0);
    const r = await api('/api/cash/close?branchId=' + branchId, {
      method: 'POST',
      body: JSON.stringify({
        counted: {
          CASH: counted,
          CARD: Number(s && s.paymentsSummary && s.paymentsSummary.card || s && s.expected && s.expected.CARD || 0),
          TRANSFER: Number(s && s.paymentsSummary && s.paymentsSummary.transfer || s && s.expected && s.expected.TRANSFER || 0)
        },
        depositDestination: closeForm.depositDestination,
        depositReference: closeForm.depositReference,
        depositAmount: Number(closeForm.depositAmount || 0),
        nextDayFund: Number(closeForm.nextDayFund || 0),
        notes: closeForm.notes,
        countedBreakdown: denoms
      })
    });
    if (r.ok) {
      notify('Caja cerrada y arqueada correctamente');
      setShowCloseModal(false);
      setCorteZSummary({
        openingCash: s?.openingCash || s?.expected?.OPENING || 0,
        salesCash: s?.salesCash || (s?.expected?.CASH ? Math.max(0, s.expected.CASH - (s.openingCash || 0)) : 0),
        inflowsCash: s?.inflowsCash || 0,
        outflowsCash: s?.outflowsCash || 0,
        depositsCash: s?.depositsCash || 0,
        cashInDrawer: inDrawer,
        counted: counted,
        difference: diff,
        depositAmount: Number(closeForm.depositAmount || 0),
        depositDestination: closeForm.depositDestination,
        depositReference: closeForm.depositReference,
        nextDayFund: Number(closeForm.nextDayFund || 0),
        paymentsSummary: s?.paymentsSummary,
        fiscalSummary: s?.fiscalSummary
      });
      load();
    }
  }

  const inDrawer = Number(s?.currentCashInDrawer ?? (s?.expected?.CASH ?? 0));
  const countedNum = Number(closeForm.countedCash || 0);
  const diff = closeForm.countedCash ? countedNum - inDrawer : 0;

  const filteredHistory = history.filter(m => {
    if (movementFilter === 'ALL') return true;
    if (movementFilter === 'DEPOSIT') return m.type === 'DEPOSIT';
    if (movementFilter === 'CASH_IN') return m.type === 'CASH_IN';
    if (movementFilter === 'CASH_OUT') return m.type === 'CASH_OUT';
    return true;
  });

  return (
    <>
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">CONTROL DE EFECTIVO & FONDOS</span>
          <h2>Arqueo de Caja y Depósitos</h2>
          <p>Supervisa el dinero físico en gaveta, ventas en efectivo, gastos menores y destino de depósitos bancarios.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {s && (
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setCorteZSummary({
                  openingCash: s.openingCash || s.expected?.OPENING || 0,
                  salesCash: s.salesCash || (s.expected?.CASH ? Math.max(0, s.expected.CASH - (s.openingCash || 0)) : 0),
                  inflowsCash: s.inflowsCash || 0,
                  outflowsCash: s.outflowsCash || 0,
                  depositsCash: s.depositsCash || 0,
                  cashInDrawer: inDrawer,
                  counted: inDrawer,
                  difference: 0,
                  depositAmount: 0,
                  depositDestination: 'Banco',
                  depositReference: 'ARQUEO-PREVIO',
                  nextDayFund: 50,
                  paymentsSummary: s.paymentsSummary,
                  fiscalSummary: s.fiscalSummary
                });
              }}
              title="Previsualizar e imprimir arqueo Corte Z en formato térmico 80mm"
            >
              📊 Imprimir Corte Z
            </button>
          )}
          <button className="primary-action" onClick={load}>Actualizar Caja</button>
        </div>
      </section>

      {!s ? (
        <section className="panel" style={{ maxWidth: '520px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <span style={{ fontSize: '42px', display: 'block', marginBottom: '8px' }}>🔒</span>
            <h3>No hay turno de caja abierto</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
              Para registrar ventas y movimientos en efectivo en esta sucursal, inicia un nuevo turno con tu fondo base de cambio.
            </p>
            <div className="inline-form" style={{ justifyContent: 'center' }}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={opening}
                onChange={e => setOpening(e.target.value)}
                placeholder="Fondo base ($)"
                style={{ width: '150px', fontSize: '16px', fontWeight: 700 }}
              />
              <button className="primary-action" onClick={open}>
                🟢 Abrir Turno de Caja
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* CASH DRAWER HERO SUMMARY CARD */}
          <div className="cash-drawer-card">
            <div>
              <small style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                💵 DINERO FÍSICO EN GAVETA (ACTUAL ESPERADO)
              </small>
              <div className="cash-drawer-val">
                ${inDrawer.toFixed(2)}
              </div>
              <div style={{ marginTop: '6px' }}>
                <span className="cash-status-tag">
                  ● Turno Activo desde {s.openedAt ? new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="secondary-action"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                onClick={() => setShowDepositModal(true)}
              >
                🏦 Depositar a Banco / Bóveda
              </button>
              <button
                type="button"
                className="secondary-action"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                onClick={() => setShowMoveModal(true)}
              >
                📥 / 📤 Entrada / Gasto
              </button>
              <button
                type="button"
                className="primary-action"
                style={{ background: '#ef4444' }}
                onClick={() => {
                  setCloseForm(f => ({ ...f, countedCash: inDrawer.toFixed(2) }));
                  setShowCloseModal(true);
                }}
              >
                🔒 Cerrar y Arquear
              </button>
            </div>

            <div className="cash-breakdown-strip">
              <div className="cash-sub-item">
                <small>Fondo Apertura</small>
                <strong>+${Number(s.openingCash || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-sub-item">
                <small>Ventas Efectivo</small>
                <strong style={{ color: '#38bdf8' }}>+${Number(s.salesCash || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-sub-item">
                <small>Ingresos Extra</small>
                <strong style={{ color: '#4ade80' }}>+${Number(s.inflows || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-sub-item">
                <small>Gastos / Retiros</small>
                <strong style={{ color: '#f87171' }}>-${Number(s.outflows || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-sub-item">
                <small>Depósitos Banco</small>
                <strong style={{ color: '#fbbf24' }}>-${Number(s.deposits || 0).toFixed(2)}</strong>
              </div>
              <div className="cash-sub-item">
                <small>Tarjeta / Transf</small>
                <strong style={{ color: '#c084fc' }}>${(Number(s.expected?.CARD || 0) + Number(s.expected?.TRANSFER || 0)).toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* CONCILIACIÓN MULTICANAL EN VIVO: ¿DÓNDE ESTÁ EL DINERO? */}
          <div className="panel" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>📍 ¿Dónde está el dinero del turno? (Conciliación Multicanal)</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Identificación de fondos en gaveta física, cuentas bancarias y datáfonos de tarjetas</p>
              </div>
              <span className="cash-status-tag" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                Total Recaudado Ventas: ${Number(s.paymentsSummary?.total || 0).toFixed(2)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>💵 Gaveta de Efectivo</span>
                  <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Físico</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>${inDrawer.toFixed(2)}</div>
                <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                  Apertura (${Number(s.openingCash || 0).toFixed(2)}) + Ventas (${Number(s.salesCash || 0).toFixed(2)})
                </small>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>🏦 Cuentas Bancarias</span>
                  <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Transferencias</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb' }}>${Number(s.paymentsSummary?.transfer || s.expected?.TRANSFER || 0).toFixed(2)}</div>
                <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                  Pichincha / Guayaquil / Produbanco
                </small>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b21a8' }}>💳 Datáfonos POS / Tarjetas</span>
                  <span style={{ fontSize: '10px', background: '#f3e8ff', color: '#7e22ce', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Datafast / Medianet</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed' }}>${Number(s.paymentsSummary?.card || s.expected?.CARD || 0).toFixed(2)}</div>
                <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                  Pendiente de liquidación en lote
                </small>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#854d0e' }}>🏛️ Desglose SRI / Tickets</span>
                  <span style={{ fontSize: '10px', background: '#fef9c3', color: '#a16207', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Fiscal</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                  Facturas SRI: <strong>{s.fiscalSummary?.sriSalesCount || 0}</strong> (${Number(s.fiscalSummary?.sriSalesAmount || 0).toFixed(2)})
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Tickets Internos: <strong>{s.fiscalSummary?.ticketSalesCount || 0}</strong> (${Number(s.fiscalSummary?.ticketSalesAmount || 0).toFixed(2)})
                </div>
                {Number(s.fiscalSummary?.sriIva15 || 0) > 0 && (
                  <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                    IVA 15% SRI: ${Number(s.fiscalSummary?.sriIva15 || 0).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MOVEMENTS HISTORY */}
          <div className="panel table-panel">
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3>Registro Detallado de Movimientos</h3>
                <p className="catalog-toolbar-p">Entradas, salidas de efectivo y depósitos bancarios de este turno</p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  ['ALL', `Todos (${history.length})`],
                  ['DEPOSIT', '🏦 Depósitos'],
                  ['CASH_IN', '📥 Entradas'],
                  ['CASH_OUT', '📤 Salidas']
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`filter-pill ${movementFilter === k ? 'active' : ''}`}
                    onClick={() => setMovementFilter(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Tipo</th>
                    <th>Método</th>
                    <th>Destino / Concepto</th>
                    <th>Referencia / Comprobante</th>
                    <th>Monto ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((m: Any) => (
                    <tr key={m.id}>
                      <td>{new Date(m.created_at).toLocaleDateString()} {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <span className={`deliv-badge ${
                          m.type === 'DEPOSIT' ? 'badge-movement-deposit' :
                          m.type === 'CASH_IN' ? 'badge-movement-in' : 'badge-movement-out'
                        }`}>
                          {m.type === 'DEPOSIT' ? '🏦 Depósito Banco' :
                           m.type === 'CASH_IN' ? '📥 Ingreso Extra' : '📤 Gasto / Salida'}
                        </span>
                      </td>
                      <td><b>{m.payment_method || 'CASH'}</b></td>
                      <td>
                        <strong>{m.destination || m.reason || 'Sin detalle'}</strong>
                        {m.notes && <div style={{ fontSize: '11px', color: '#64748b' }}>{m.notes}</div>}
                      </td>
                      <td>
                        {m.reference ? (
                          <span className="guide-pill">📄 {m.reference}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 800, color: m.type === 'CASH_IN' ? '#10b981' : '#ef4444' }}>
                        {m.type === 'CASH_IN' ? '+' : '-'}${Number(m.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredHistory.length && (
                <div className="empty">
                  <b>💵</b>
                  <p>No se encontraron movimientos para este criterio.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL DEPOSITO BANCARIO */}
      {showDepositModal && (
        <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <h3>🏦 Registrar Depósito a Banco / Bóveda</h3>
              <button className="close-button" onClick={() => setShowDepositModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
              Registra la salida física del dinero de gaveta hacia una cuenta de banco o resguardo en bóveda.
            </p>
            <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', color: '#166534', display: 'flex', justifyContent: 'space-between' }}>
              <span>Efectivo disponible en gaveta:</span>
              <strong>${inDrawer.toFixed(2)}</strong>
            </div>

            <form onSubmit={recordDeposit}>
              <label>
                <span>Destino del Depósito *</span>
                <select
                  value={depositForm.destination}
                  onChange={e => setDepositForm({ ...depositForm, destination: e.target.value })}
                  required
                >
                  <option value="BANCO_PICHINCHA">Banco Pichincha (Cta. Corriente)</option>
                  <option value="BANCO_GUAYAQUIL">Banco Guayaquil</option>
                  <option value="BANCO_PRODUBANCO">Banco Produbanco</option>
                  <option value="BOVEDA_CENTRAL">Bóveda Central / Caja Fuerte</option>
                  <option value="RETIRO_GERENCIA">Retiro Propietario / Gerencia</option>
                  <option value="OTRO">Otro Destino</option>
                </select>
              </label>

              <label>
                <span>Monto a Depositar ($) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={inDrawer > 0 ? inDrawer : undefined}
                  placeholder="0.00"
                  value={depositForm.amount}
                  onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
                  required
                  autoFocus
                />
              </label>

              <label>
                <span>N° Papeleta / Comprobante / Referencia</span>
                <input
                  placeholder="Ej. DEP-9938472"
                  value={depositForm.reference}
                  onChange={e => setDepositForm({ ...depositForm, reference: e.target.value })}
                />
              </label>

              <label>
                <span>Observaciones / Detalle</span>
                <input
                  placeholder="Ej. Depósito cierre parcial mediodía"
                  value={depositForm.notes}
                  onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowDepositModal(false)}>
                  Cancelar
                </button>
                <button className="primary-action">
                  ✓ Confirmar Depósito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MOVIMIENTO MENOR */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-head">
              <h3>📥 / 📤 Registrar Movimiento Menor</h3>
              <button className="close-button" onClick={() => setShowMoveModal(false)}>✕</button>
            </div>

            <form onSubmit={move}>
              <label>
                <span>Tipo de Movimiento</span>
                <select value={movement.type} onChange={e => setMovement({ ...movement, type: e.target.value })}>
                  <option value="CASH_IN">📥 Entrada de Efectivo (Aporte/Cambio)</option>
                  <option value="CASH_OUT">📤 Salida de Efectivo (Gasto menor / Flete)</option>
                </select>
              </label>

              <label>
                <span>Monto ($) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={movement.amount}
                  onChange={e => setMovement({ ...movement, amount: e.target.value })}
                  required
                  autoFocus
                />
              </label>

              <label>
                <span>Motivo o Concepto *</span>
                <input
                  placeholder="Ej. Pago de flete moto, suministros oficina, almuerzo..."
                  value={movement.reason}
                  onChange={e => setMovement({ ...movement, reason: e.target.value })}
                  required
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowMoveModal(false)}>
                  Cancelar
                </button>
                <button className="primary-action">
                  ✓ Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CIERRE Y ARQUEO */}
      {showCloseModal && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-head">
              <h3>🔒 Cierre de Turno & Conciliación Real</h3>
              <button className="close-button" onClick={() => setShowCloseModal(false)}>✕</button>
            </div>

            {/* CONCILIACIÓN GENERAL: DÓNDE ESTÁ EL DINERO */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                📍 ¿DÓNDE ESTÁ EL DINERO DEL TURNO? (CANALES DE RECAUDACIÓN)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                  <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>💵 Gaveta (Efectivo)</small>
                  <strong style={{ fontSize: '15px', color: '#0f172a' }}>${inDrawer.toFixed(2)}</strong>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                  <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>🏦 Banco (Transferencias)</small>
                  <strong style={{ fontSize: '15px', color: '#2563eb' }}>${Number(s?.paymentsSummary?.transfer || s?.expected?.TRANSFER || 0).toFixed(2)}</strong>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                  <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>💳 POS (Datáfonos)</small>
                  <strong style={{ fontSize: '15px', color: '#7c3aed' }}>${Number(s?.paymentsSummary?.card || s?.expected?.CARD || 0).toFixed(2)}</strong>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px' }}>
                  <small style={{ display: 'block', color: '#1e40af', fontSize: '11px' }}>💰 Total Recaudado</small>
                  <strong style={{ fontSize: '15px', color: '#1d4ed8' }}>${Number(s?.paymentsSummary?.total || 0).toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* TAB SELECTOR ARQUEO */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
              <button
                type="button"
                className={`filter-pill ${!useDenom ? 'active' : ''}`}
                style={{ flex: 1, textAlign: 'center', padding: '8px 12px', fontWeight: 700 }}
                onClick={() => setUseDenom(false)}
              >
                ⚡ Ingresar Total Directo
              </button>
              <button
                type="button"
                className={`filter-pill ${useDenom ? 'active' : ''}`}
                style={{ flex: 1, textAlign: 'center', padding: '8px 12px', fontWeight: 700 }}
                onClick={() => setUseDenom(true)}
              >
                🧮 Conteo por Billetes y Monedas
              </button>
            </div>

            <form onSubmit={close}>
              {useDenom ? (
                <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '10px', marginBottom: '14px', border: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>Arqueo Físico por Denominaciones ($ USD)</strong>
                    <button
                      type="button"
                      style={{ fontSize: '11px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => {
                        const reset = { b100:0, b50:0, b20:0, b10:0, b5:0, b1:0, c100:0, c50:0, c25:0, c10:0, c5:0, c1:0 };
                        setDenoms(reset);
                        setCloseForm(f => ({ ...f, countedCash: '0.00' }));
                      }}
                    >
                      Limpiar conteo
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Billetes */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#047857', marginBottom: '6px' }}>💵 BILLETES</div>
                      {[
                        ['b100', 100, '$100'],
                        ['b50', 50, '$50'],
                        ['b20', 20, '$20'],
                        ['b10', 10, '$10'],
                        ['b5', 5, '$5'],
                        ['b1', 1, '$1']
                      ].map(([k, val, lbl]) => (
                        <div key={k as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', background: '#fff', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, width: '45px' }}>{lbl}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>×</span>
                          <input
                            type="number"
                            min="0"
                            value={denoms[k as string] || ''}
                            placeholder="0"
                            onChange={e => updateDenom(k as string, parseInt(e.target.value) || 0)}
                            style={{ width: '55px', padding: '3px 6px', fontSize: '12px', textAlign: 'center', margin: '0 4px' }}
                          />
                          <span style={{ fontSize: '11px', fontWeight: 700, width: '50px', textAlign: 'right', color: '#047857' }}>
                            ${((denoms[k as string] || 0) * (val as number)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Monedas */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', marginBottom: '6px' }}>🪙 MONEDAS</div>
                      {[
                        ['c100', 1.00, '$1.00'],
                        ['c50', 0.50, '$0.50'],
                        ['c25', 0.25, '$0.25'],
                        ['c10', 0.10, '$0.10'],
                        ['c5', 0.05, '$0.05'],
                        ['c1', 0.01, '$0.01']
                      ].map(([k, val, lbl]) => (
                        <div key={k as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', background: '#fff', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, width: '45px' }}>{lbl}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>×</span>
                          <input
                            type="number"
                            min="0"
                            value={denoms[k as string] || ''}
                            placeholder="0"
                            onChange={e => updateDenom(k as string, parseInt(e.target.value) || 0)}
                            style={{ width: '55px', padding: '3px 6px', fontSize: '12px', textAlign: 'center', margin: '0 4px' }}
                          />
                          <span style={{ fontSize: '11px', fontWeight: 700, width: '50px', textAlign: 'right', color: '#d97706' }}>
                            ${((denoms[k as string] || 0) * (val as number)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Total Físico Contado:</span>
                    <strong style={{ fontSize: '16px', color: '#1e40af' }}>${countedNum.toFixed(2)}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '14px' }}>
                  <label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Efectivo Físico Contado en Gaveta ($) *</span>
                      <button
                        type="button"
                        style={{ fontSize: '11px', color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => setCloseForm(f => ({ ...f, countedCash: inDrawer.toFixed(2) }))}
                      >
                        ⚡ Copiar esperado (${inDrawer.toFixed(2)})
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={closeForm.countedCash}
                      onChange={e => setCloseForm({ ...closeForm, countedCash: e.target.value })}
                      required
                      autoFocus
                    />
                  </label>
                </div>
              )}

              {/* CUADRE COMPARATIVO */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Efectivo esperado según sistema:</span>
                  <strong style={{ fontSize: '14px' }}>${inDrawer.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Efectivo físico contado en gaveta:</span>
                  <strong style={{ fontSize: '14px', color: '#3157d5' }}>${countedNum.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '4px' }}>
                  <span style={{ fontWeight: 700 }}>Resultado del Cuadre:</span>
                  <span style={{
                    fontWeight: 800,
                    fontSize: '14px',
                    color: Math.abs(diff) < 0.01 ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444'
                  }}>
                    {Math.abs(diff) < 0.01 ? '✓ Cuadre Perfecto ($0.00)' : diff > 0 ? `+ Sobrante: $${diff.toFixed(2)}` : `- Faltante: $${Math.abs(diff).toFixed(2)}`}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <label>
                  <span>Destino del Depósito de Cierre</span>
                  <select
                    value={closeForm.depositDestination}
                    onChange={e => setCloseForm({ ...closeForm, depositDestination: e.target.value })}
                  >
                    <option value="BANCO_PICHINCHA">Banco Pichincha</option>
                    <option value="BANCO_GUAYAQUIL">Banco Guayaquil</option>
                    <option value="BOVEDA_CENTRAL">Bóveda Central</option>
                    <option value="RETIRO_GERENCIA">Retiro Propietario</option>
                  </select>
                </label>

                <label>
                  <span>Fondo Base para Mañana ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="50.00"
                    value={closeForm.nextDayFund}
                    onChange={e => setCloseForm({ ...closeForm, nextDayFund: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <label>
                  <span>N° Papeleta / Comprobante</span>
                  <input
                    placeholder="Ej. DEP-FINAL-102"
                    value={closeForm.depositReference}
                    onChange={e => setCloseForm({ ...closeForm, depositReference: e.target.value })}
                  />
                </label>

                <label>
                  <span>Monto a Depositar ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={(countedNum > Number(closeForm.nextDayFund || 0) ? (countedNum - Number(closeForm.nextDayFund || 0)).toFixed(2) : '0.00')}
                    value={closeForm.depositAmount}
                    onChange={e => setCloseForm({ ...closeForm, depositAmount: e.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Notas de Cierre del Turno</span>
                <input
                  placeholder="Observaciones de caja..."
                  value={closeForm.notes}
                  onChange={e => setCloseForm({ ...closeForm, notes: e.target.value })}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowCloseModal(false)}>
                  Cancelar
                </button>
                <button className="primary-action" style={{ background: '#ef4444' }}>
                  ✓ Confirmar y Cerrar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {corteZSummary && (
        <CorteZModal
          summary={corteZSummary}
          onClose={() => setCorteZSummary(null)}
          tenantName={localStorage.tenantName || 'Fixme Tiendas'}
        />
      )}
    </>
  );
}
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

  // Dual Invoice & Offline POS states
  const [invoiceType, setInvoiceType] = React.useState<'INTERNAL_TICKET' | 'SRI_INVOICE'>('INTERNAL_TICKET');
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [pendingOffline, setPendingOffline] = React.useState<OfflineSale[]>([]);
  const [syncingOffline, setSyncingOffline] = React.useState(false);
  const [showRideModalId, setShowRideModalId] = React.useState<string | null>(null);

  const [busy, setBusy] = React.useState(false);
  const [receiptModal, setReceiptModal] = React.useState<Any|null>(null);
  const [showQuickCust, setShowQuickCust] = React.useState(false);
  const [discount, setDiscount] = React.useState('0');
  const [showThermalTicket, setShowThermalTicket] = React.useState(false);

  const load = React.useCallback(() => {
    if (navigator.onLine) {
      api(`/api/products?branchId=${branchId}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setProducts(data);
          saveCatalogLocally(data).catch(() => {});
        })
        .catch(() => {
          getCatalogLocally().then(setProducts).catch(() => {});
        });
      api('/api/customers')
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setCustomers(data);
          saveCustomersLocally(data).catch(() => {});
        })
        .catch(() => {
          getCustomersLocally().then(setCustomers).catch(() => {});
        });
      api('/api/categories').then(r => r.ok ? r.json() : []).then(setCats).catch(() => {});
    } else {
      getCatalogLocally().then(setProducts).catch(() => {});
      getCustomersLocally().then(setCustomers).catch(() => {});
    }
    getPendingSales().then(setPendingOffline).catch(() => {});
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  // Online / Offline network listeners
  React.useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      notify('Conexión reestablecida. Sincronizando ventas...');
    };
    const onOffline = () => {
      setIsOnline(false);
      notify('Sin conexión a internet. Modo offline activado.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    getPendingSales().then(setPendingOffline).catch(() => {});
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [notify]);

  const syncOfflineSales = React.useCallback(async () => {
    if (syncingOffline) return;
    const pending = await getPendingSales();
    if (!pending.length) return;
    setSyncingOffline(true);
    try {
      const payload = pending.map(p => ({
        branchId,
        customerId: p.customerId || null,
        warrantyDays: p.warrantyDays || 0,
        channel: p.channel || 'STORE',
        fulfillmentType: p.fulfillmentType || 'PICKUP',
        shippingCost: p.shippingCost || 0,
        delivery: p.delivery,
        items: p.items.map(it => ({ productId: it.productId, quantity: it.quantity })),
        payments: p.payments,
        invoiceType: p.invoiceType || 'INTERNAL_TICKET',
        offlineFolio: p.offlineFolio,
        discount: p.discount || 0
      }));
      const r = await api('/api/sales/sync-offline', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        await clearPendingSales();
        setPendingOffline([]);
        notify(`¡${pending.length} venta(s) offline sincronizada(s) con éxito!`);
        load();
      }
    } catch {
      // Retain offline sales
    } finally {
      setSyncingOffline(false);
    }
  }, [api, syncingOffline, notify, load]);

  React.useEffect(() => {
    if (isOnline && pendingOffline.length > 0) {
      syncOfflineSales();
    }
  }, [isOnline, pendingOffline.length, syncOfflineSales]);

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
  const discountVal = Math.max(0, Number(discount || 0));
  const grandTotal = Math.max(0, subtotal - discountVal + shippingFee);

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

    // 1. Check if Offline Mode
    if (!navigator.onLine) {
      const offlineFolio = 'OFF-' + Math.floor(100000 + Math.random() * 900000);
      const selCustomer = customers.find(c => c.id === customerId);

      const offlineSaleRecord: OfflineSale = {
        offlineFolio,
        createdAt: new Date().toISOString(),
        branchId,
        customerId: customerId || null,
        customerName: selCustomer ? selCustomer.name : 'Consumidor Final',
        customerIdentification: selCustomer ? (selCustomer.identification_number || selCustomer.cedula) : '9999999999999',
        warrantyDays: Number(warrantyDays || 0),
        channel,
        fulfillmentType: fulfillment,
        shippingCost: shippingFee,
        invoiceType,
        items: cart.map(i => ({ productId: i.id, quantity: i.quantity, name: i.name, price: Number(i.price) })),
        payments: paymentsPayload,
        delivery: fulfillment === 'DELIVERY' ? { ...delivery } : null,
        discount: discountVal,
        grandTotal,
        synced: false
      };

      await queueOfflineSale(offlineSaleRecord);
      const updated = await getPendingSales();
      setPendingOffline(updated);

      notify(`⚠️ Venta guardada en MODO OFFLINE (${offlineFolio}). Se sincronizará automáticamente.`);
      setReceiptModal({
        sale: { id: offlineFolio, offlineFolio, invoiceType, total: grandTotal, discount: discountVal },
        items: [...cart],
        subtotal,
        discount: discountVal,
        shippingFee,
        grandTotal,
        channel,
        fulfillment,
        delivery: { ...delivery },
        customer: selCustomer,
        payMethod,
        cashTendered: payMethod === 'CASH' ? tenderedVal : null,
        change: payMethod === 'CASH' ? changeVal : null,
        payments: paymentsPayload,
        isOfflineSale: true,
        invoiceType
      });
      setCart([]);
      setCashTendered('');
      setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
      setDiscount('0');
      return;
    }

    // 2. Normal Online Sale
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
      payments: paymentsPayload,
      invoiceType,
      offlineFolio: null,
      discount: discountVal
    };

    try {
      const r = await api('/api/sales', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setBusy(false);

      if (r.ok) {
        const createdSale = await r.json();
        notify(invoiceType === 'SRI_INVOICE'
          ? '¡Venta y Factura Electrónica SRI generada con éxito!'
          : '¡Venta registrada con éxito!');
        const selCustomer = customers.find(c => c.id === customerId);
        setReceiptModal({
          sale: createdSale,
          items: [...cart],
          subtotal,
          discount: discountVal,
          shippingFee,
          grandTotal,
          channel,
          fulfillment,
          delivery: { ...delivery },
          customer: selCustomer,
          payMethod,
          cashTendered: payMethod === 'CASH' ? tenderedVal : null,
          change: payMethod === 'CASH' ? changeVal : null,
          payments: paymentsPayload,
          invoiceType
        });
        setCart([]);
        setCashTendered('');
        setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
        setDiscount('0');
        load();
      } else {
        notify(await r.text() || 'No se pudo registrar la venta');
      }
    } catch {
      // Network failed during checkout -> fallback to offline queue
      setBusy(false);
      setIsOnline(false);
      const offlineFolio = 'OFF-' + Math.floor(100000 + Math.random() * 900000);
      const selCustomer = customers.find(c => c.id === customerId);
      const offlineSaleRecord: OfflineSale = {
        offlineFolio,
        createdAt: new Date().toISOString(),
        branchId,
        customerId: customerId || null,
        customerName: selCustomer ? selCustomer.name : 'Consumidor Final',
        customerIdentification: selCustomer ? (selCustomer.identification_number || selCustomer.cedula) : '9999999999999',
        warrantyDays: Number(warrantyDays || 0),
        channel,
        fulfillmentType: fulfillment,
        shippingCost: shippingFee,
        invoiceType,
        items: cart.map(i => ({ productId: i.id, quantity: i.quantity, name: i.name, price: Number(i.price) })),
        payments: paymentsPayload,
        delivery: fulfillment === 'DELIVERY' ? { ...delivery } : null,
        discount: discountVal,
        grandTotal,
        synced: false
      };
      await queueOfflineSale(offlineSaleRecord);
      const updated = await getPendingSales();
      setPendingOffline(updated);
      notify(`⚠️ Conexión perdida. Venta guardada en MODO OFFLINE (${offlineFolio}).`);
      setReceiptModal({
        sale: { id: offlineFolio, offlineFolio, invoiceType, total: grandTotal, discount: discountVal },
        items: [...cart],
        subtotal,
        discount: discountVal,
        shippingFee,
        grandTotal,
        channel,
        fulfillment,
        delivery: { ...delivery },
        customer: selCustomer,
        payMethod,
        cashTendered: payMethod === 'CASH' ? tenderedVal : null,
        change: payMethod === 'CASH' ? changeVal : null,
        payments: paymentsPayload,
        isOfflineSale: true,
        invoiceType
      });
      setCart([]);
      setCashTendered('');
      setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
      setDiscount('0');
    }
  }

  async function saveCartAsQuote() {
    if (!cart.length || busy) return;
    setBusy(true);
    try {
      const selCust = customers.find(c => c.id === customerId);
      const res = await api(`/api/quotes?branchId=${branchId}`, {
        method: 'POST',
        body: JSON.stringify({
          customerId: customerId || null,
          customerName: selCust ? selCust.name : 'Consumidor Final',
          customerPhone: selCust ? selCust.phone : '',
          customerEmail: selCust ? selCust.email : '',
          customerIdNumber: selCust ? (selCust.identification_number || selCust.identificationNumber || '') : '',
          validDays: 15,
          notes: 'Cotización generada desde Punto de Venta (POS)',
          terms: 'Precios incluyen IVA (15%). Cotización válida por 15 días.',
          items: cart.map(i => ({
            productId: i.id,
            itemType: 'PRODUCT',
            description: i.name,
            quantity: i.quantity,
            unitPrice: Number(i.price),
            discount: 0,
            taxRate: 15
          }))
        })
      });

      if (res.ok) {
        const q = await res.json();
        const token = q.publicToken || q.public_token || q.id;
        const link = `${window.location.origin}/#quote/${token}`;
        notify(`✓ Cotización #${q.quoteNumber || q.quote_number} generada con éxito.`);
        setCart([]);
        setCashTendered('');
        setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
        setDiscount('0');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).catch(() => {});
        }
        alert(`✓ ¡Cotización #${q.quoteNumber || q.quote_number} generada con éxito!\n\nTotal: $${Number(q.total).toFixed(2)}\n\nEnlace para enviar al cliente:\n${link}\n\n(Enlace copiado al portapapeles)`);
      } else {
        const err = await res.json().catch(() => null);
        notify(err?.message || 'No se pudo generar la cotización');
      }
    } catch (e: any) {
      notify('Error al generar cotización: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  const filteredProducts = products.filter(p => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${p.name} ${p.sku} ${p.barcode || ''}`.toLowerCase().includes(q);
    const matchesCat = !selectedCat || p.category_id === selectedCat || p.categoryId === selectedCat;
    return matchesSearch && matchesCat;
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      const q = search.trim().toLowerCase();
      const match = products.find(p =>
        (p.barcode && p.barcode.toLowerCase() === q) ||
        (p.sku && p.sku.toLowerCase() === q) ||
        p.name.toLowerCase() === q
      ) || filteredProducts[0];

      if (match) {
        if (Number(match.stock) > 0) {
          add(match);
          notify(`✓ "${match.name}" agregado al carrito`);
          setSearch('');
        } else {
          notify(`⚠️ "${match.name}" está agotado`);
        }
      } else {
        notify(`⚠️ No se encontró producto con código/SKU "${search.trim()}"`);
      }
    }
  };

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
                placeholder="Escanear código de barras o buscar producto/SKU (Enter para agregar)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoFocus
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
          {/* OFFLINE STATUS / SYNC BANNER */}
          {(!isOnline || pendingOffline.length > 0) && (
            <div className="offline-status-banner">
              <div>
                <span className={`connection-dot ${isOnline ? 'online' : 'offline'}`} />
                <span>{!isOnline ? 'Modo Offline (Sin Internet)' : 'Conectado a la red'}</span>
                {pendingOffline.length > 0 && (
                  <span style={{ display: 'block', fontSize: '10.5px', marginTop: '2px', color: '#92400e' }}>
                    {pendingOffline.length} venta(s) local(es) pendiente(s) de sincronizar
                  </span>
                )}
              </div>
              {isOnline && pendingOffline.length > 0 && (
                <button
                  type="button"
                  className="offline-sync-btn"
                  onClick={syncOfflineSales}
                  disabled={syncingOffline}
                >
                  {syncingOffline ? 'Sincronizando...' : `🔄 Sincronizar (${pendingOffline.length})`}
                </button>
              )}
            </div>
          )}

          {/* DUAL INVOICE EMISSION SELECTOR (TICKET INTERNO vs FACTURA SRI) */}
          <div>
            <label style={{ marginBottom: '6px', display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
              Tipo de Comprobante
            </label>
            <div className="invoice-mode-selector">
              <button
                type="button"
                className={`invoice-mode-pill ${invoiceType === 'INTERNAL_TICKET' ? 'active ticket' : ''}`}
                onClick={() => setInvoiceType('INTERNAL_TICKET')}
                title="Comprobante interno de tienda (No fiscal / Sin declarar IVA)"
              >
                <i>🧾</i> Ticket Interno
              </button>
              <button
                type="button"
                className={`invoice-mode-pill ${invoiceType === 'SRI_INVOICE' ? 'active sri' : ''}`}
                onClick={() => setInvoiceType('SRI_INVOICE')}
                title="Factura electrónica autorizada por el SRI (Con 15% IVA y Clave de Acceso)"
              >
                <i>🏛️</i> Factura SRI
              </button>
            </div>
            {invoiceType === 'SRI_INVOICE' && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '6px 8px', fontSize: '10.5px', color: '#1e3a8a', marginBottom: '8px' }}>
                🏛️ <b>Facturación SRI Activa:</b> Se generará Clave de Acceso de 49 dígitos, XML firmado y RIDE oficial.
              </div>
            )}
          </div>

          {/* CHANNEL SELECTOR */}
          <div>
            <label style={{ marginBottom: '6px', display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569' }}>Canal de Venta</label>
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
                🌐 Online / WhatsApp
              </button>
            </div>
          </div>

          {/* FULFILLMENT SELECTOR */}
          <div>
            <label style={{ marginBottom: '6px', display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569' }}>Modalidad de Entrega</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${fulfillment === 'PICKUP' ? 'active' : ''}`}
                onClick={() => setFulfillment('PICKUP')}
              >
                🏬 En tienda
              </button>
              <button
                type="button"
                className={`toggle-btn ${fulfillment === 'DELIVERY' ? 'active' : ''}`}
                onClick={() => setFulfillment('DELIVERY')}
              >
                🛵 A domicilio
              </button>
            </div>
          </div>

          {/* DELIVERY FIELDS IF DELIVERY */}
          {fulfillment === 'DELIVERY' && (
            <div className="delivery-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                <strong style={{ fontSize: '12px', color: '#1e293b' }}>📦 Datos de Despacho</strong>
                {customerId && (
                  <button
                    type="button"
                    onClick={fillCustomerData}
                    style={{ border: 0, background: 'transparent', color: '#3157d5', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    ⚡ Usar datos cliente
                  </button>
                )}
              </div>
              <input
                placeholder="Dirección completa de entrega *"
                value={delivery.address}
                onChange={e => setDelivery({ ...delivery, address: e.target.value })}
                required
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
                <input
                  placeholder="Destinatario"
                  value={delivery.recipientName}
                  onChange={e => setDelivery({ ...delivery, recipientName: e.target.value })}
                  style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                />
                <input
                  placeholder="Teléfono"
                  value={delivery.recipientPhone}
                  onChange={e => setDelivery({ ...delivery, recipientPhone: e.target.value })}
                  style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
                <input
                  placeholder="Referencias (Torre, piso...)"
                  value={delivery.notes}
                  onChange={e => setDelivery({ ...delivery, notes: e.target.value })}
                  style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Flete ($)"
                  value={delivery.shippingCost}
                  onChange={e => setDelivery({ ...delivery, shippingCost: e.target.value })}
                  style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* CUSTOMER & WARRANTY */}
          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span>Cliente registrado (opcional)</span>
              <button
                type="button"
                onClick={() => setShowQuickCust(true)}
                style={{
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#2563eb',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Registrar cliente rápido sin salir del POS"
              >
                + Nuevo Cliente
              </button>
            </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              <span>Descuento ($):</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                style={{ width: '80px', padding: '3px 6px', fontSize: '12px', textAlign: 'right', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            {shippingFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                <span>Envío a domicilio:</span>
                <span>${shippingFee.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 800, color: '#3157d5', marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
              <span>Total a Cobrar:</span>
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

          <button
            type="button"
            disabled={!cart.length || busy}
            onClick={saveCartAsQuote}
            style={{
              padding: '10px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              background: cart.length ? '#eff6ff' : '#f1f5f9',
              color: cart.length ? '#2563eb' : '#94a3b8',
              border: '1px solid #bfdbfe',
              cursor: cart.length ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            📋 Guardar Carrito como Cotización
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
              {receiptModal.isOfflineSale ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '6px 8px', borderRadius: '6px', margin: '4px 0', color: '#92400e', fontSize: '11px', fontWeight: 700 }}>
                  ⚠️ Venta registrada Offline (Folio: {receiptModal.sale?.offlineFolio}). Pendiente de sincronización.
                </div>
              ) : receiptModal.invoiceType === 'SRI_INVOICE' || receiptModal.sale?.invoiceNumber || receiptModal.sale?.electronicInvoice ? (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 8px', borderRadius: '6px', margin: '4px 0', color: '#065f46', fontSize: '11px', fontWeight: 700 }}>
                  🏛️ FACTURA ELECTRÓNICA SRI: {receiptModal.sale?.invoiceNumber || receiptModal.sale?.electronicInvoice?.numero_completo || 'EMITIDA'}
                  {(receiptModal.sale?.accessKey || receiptModal.sale?.electronicInvoice?.clave_acceso) && (
                    <div style={{ fontSize: '9px', fontWeight: 'normal', color: '#047857', wordBreak: 'break-all', marginTop: '2px' }}>
                      Clave Acceso: {receiptModal.sale?.accessKey || receiptModal.sale?.electronicInvoice?.clave_acceso}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 6px', borderRadius: '4px', margin: '4px 0', color: '#64748b', fontSize: '10.5px' }}>
                  🧾 Ticket de Venta Interno (Sin declaración de IVA)
                </div>
              )}
              <div>Canal: {receiptModal.channel === 'ONLINE' ? 'Venta Online / Catálogo' : 'Venta en Local'}</div>
              <div>Cliente: {receiptModal.customer ? receiptModal.customer.name : 'Consumidor Final'}</div>
              {receiptModal.customer?.phone && <div>Teléfono: {receiptModal.customer.phone}</div>}

              {receiptModal.fulfillment === 'DELIVERY' && (
                <>
                  <div className="ticket-divider"></div>
                  <div><strong>🛵 DESPACHO A DOMICILIO</strong></div>
                  {receiptModal.sale?.trackingNumber && (
                    <div style={{ background: '#f0fdf4', padding: '6px 8px', borderRadius: '6px', margin: '4px 0', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 700, fontSize: '11.5px' }}>
                      📍 CÓDIGO DE SEGUIMIENTO: {receiptModal.sale.trackingNumber}
                      <div style={{ fontSize: '9.5px', fontWeight: 'normal', color: '#15803d', marginTop: '2px' }}>
                        El cliente puede ver el estado y motorizado en vivo
                      </div>
                    </div>
                  )}
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
              {Number(receiptModal.discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#16a34a', margin: '2px 0' }}>
                  <span>Descuento aplicado:</span>
                  <span>-${Number(receiptModal.discount).toFixed(2)}</span>
                </div>
              )}
              {receiptModal.shippingFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>Flete a domicilio:</span>
                  <span>+${receiptModal.shippingFee.toFixed(2)}</span>
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

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
              <button className="secondary-action" style={{ flex: 1, minWidth: '90px' }} onClick={() => setReceiptModal(null)}>
                Cerrar
              </button>
              <button className="primary-action" style={{ flex: 1, minWidth: '120px' }} onClick={() => window.print()}>
                🖨️ Imprimir
              </button>
              <button
                type="button"
                className="secondary-action"
                style={{ flex: 1, minWidth: '130px', background: '#f8fafc', fontWeight: 700 }}
                onClick={() => setShowThermalTicket(true)}
              >
                🧾 Formato 80mm
              </button>
              {(receiptModal.sale?.electronicInvoice?.id || receiptModal.sale?.electronicInvoiceId) && (
                <button
                  type="button"
                  className="primary-action"
                  style={{ flex: 1, minWidth: '150px', background: '#059669', borderColor: '#047857', fontWeight: 700 }}
                  onClick={() => {
                    const invId = receiptModal.sale?.electronicInvoice?.id || receiptModal.sale?.electronicInvoiceId;
                    if (invId) setShowRideModalId(invId);
                  }}
                >
                  🏛️ Ver RIDE / Factura SRI
                </button>
              )}
              {receiptModal.fulfillment === 'DELIVERY' && receiptModal.sale?.trackingNumber && (
                <a
                  className="secondary-action"
                  style={{ flex: 1, minWidth: '130px', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700 }}
                  href={`#tracking/${receiptModal.sale.trackingNumber}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  📍 Ver Tracking
                </a>
              )}
              {receiptModal.customer?.phone && (
                <a
                  className="whatsapp-btn"
                  style={{ flex: 1, minWidth: '120px', textDecoration: 'none', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '4px' }}
                  href={`https://wa.me/${receiptModal.customer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hola ${receiptModal.customer.name}, gracias por tu compra en FixmeTiendas.\nTotal: $${receiptModal.grandTotal.toFixed(2)}\nModalidad: ${receiptModal.fulfillment === 'DELIVERY' ? 'Envío a domicilio' : 'Retiro en tienda'}\nComprobante #${receiptModal.sale?.id?.slice(0, 8)}${receiptModal.sale?.trackingNumber ? `\n\n🛵 Sigue el estado y motorizado de tu entrega en tiempo real aquí:\n${window.location.origin}${window.location.pathname}#tracking/${receiptModal.sale.trackingNumber}` : ''}`
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

      {showRideModalId && (
        <SriRideModal
          invoiceId={showRideModalId}
          api={api}
          onClose={() => setShowRideModalId(null)}
        />
      )}

      {showQuickCust && (
        <QuickCustomerModal
          api={api}
          notify={notify}
          onCreated={c => {
            setCustomers(prev => [c, ...prev]);
            setCustomerId(c.id);
          }}
          onClose={() => setShowQuickCust(false)}
        />
      )}

      {showThermalTicket && receiptModal && (
        <ThermalTicketModal
          sale={{
            id: receiptModal.sale?.id || receiptModal.sale?.offlineFolio,
            orderNumber: receiptModal.sale?.id?.slice(0, 8).toUpperCase(),
            createdAt: new Date().toISOString(),
            customerName: receiptModal.customer?.name || 'CONSUMIDOR FINAL',
            customerIdentification: receiptModal.customer?.identification_number || receiptModal.customer?.cedula || '',
            items: receiptModal.items.map((it: Any) => ({
              productName: it.name,
              quantity: it.quantity,
              unitPrice: Number(it.price)
            })),
            payments: receiptModal.payments,
            subtotal: receiptModal.subtotal,
            discountAmount: receiptModal.discount != null ? receiptModal.discount : discountVal,
            shippingCost: receiptModal.shippingFee,
            total: receiptModal.grandTotal,
            invoiceType: receiptModal.invoiceType,
            warrantyDays: Number(warrantyDays || 0),
            deliveryTrackingCode: receiptModal.sale?.trackingNumber,
            changeAmount: receiptModal.change
          }}
          onClose={() => setShowThermalTicket(false)}
          tenantName={localStorage.tenantName || 'Fixme Tiendas'}
        />
      )}
    </section>
  );
}

function Sales({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){
  const [rows, setRows] = React.useState<Any[]>([]);
  const [filterChannel, setFilterChannel] = React.useState('ALL');
  const [filterFulfillment, setFilterFulfillment] = React.useState('ALL');
  const [filterSeller, setFilterSeller] = React.useState('ALL');
  const [filterDate, setFilterDate] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [detailModal, setDetailModal] = React.useState<Any|null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [showRideInvoiceId, setShowRideInvoiceId] = React.useState<string | null>(null);
  const [issuingSriId, setIssuingSriId] = React.useState<string | null>(null);
  const [showSriInvoicesModal, setShowSriInvoicesModal] = React.useState(false);

  const load = React.useCallback(() => {
    api(`/api/sales?branchId=${branchId}`).then(r => r.ok ? r.json() : []).then(setRows);
  }, [api]);

  async function issueSriInvoice(saleId: string) {
    if (!confirm('¿Deseas generar la Factura Electrónica SRI oficial con 15% IVA y Clave de Acceso para esta venta?')) return;
    setIssuingSriId(saleId);
    try {
      const res = await api(`/api/sri/invoices/from-sale/${saleId}`, { method: 'POST' });
      if (res.ok) {
        const inv = await res.json();
        alert(`¡Factura Electrónica generada y autorizada con éxito!\nN°: ${inv.numero_completo}\nClave de Acceso: ${inv.clave_acceso}`);
        load();
        setShowRideInvoiceId(inv.id);
      } else {
        const err = await res.text();
        alert(`Error al emitir factura SRI: ${err}`);
      }
    } catch (e: any) {
      alert(`Error de conexión al emitir factura SRI: ${e.message}`);
    } finally {
      setIssuingSriId(null);
    }
  }

  React.useEffect(() => { load(); }, [load]);

  async function openDetail(id: string) {
    setLoadingDetail(true);
    try {
      const res = await api(`/api/sales/${id}`);
      if (res.ok) {
        const fullSale = await res.json();
        setDetailModal(fullSale);
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  // Unique sellers for filter dropdown
  const uniqueSellers = React.useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      const s = r.seller_name || r.seller;
      if (s) set.add(s);
    });
    return Array.from(set);
  }, [rows]);

  const filtered = rows.filter(r => {
    // Channel filter
    if (filterChannel !== 'ALL' && r.channel !== filterChannel) return false;
    // Fulfillment filter
    if (filterFulfillment !== 'ALL' && r.fulfillment_type !== filterFulfillment) return false;
    // Seller filter
    if (filterSeller !== 'ALL' && (r.seller_name || r.seller) !== filterSeller) return false;
    // Date filter
    if (filterDate !== 'ALL') {
      const saleDate = new Date(r.created_at);
      const now = new Date();
      if (filterDate === 'TODAY') {
        if (saleDate.toDateString() !== now.toDateString()) return false;
      } else if (filterDate === 'WEEK') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (saleDate < weekAgo) return false;
      } else if (filterDate === 'MONTH') {
        if (saleDate.getMonth() !== now.getMonth() || saleDate.getFullYear() !== now.getFullYear()) return false;
      }
    }
    // Search filter
    const q = search.toLowerCase().trim();
    if (q) {
      const matchSearch = [
        r.id,
        r.customer,
        r.customer_name,
        r.customer_identification_number,
        r.customer_phone,
        r.seller,
        r.seller_name,
        r.payment_methods,
        r.delivery_address,
        r.courier,
        r.tracking_number,
        r.warranty_code
      ].some(v => v && String(v).toLowerCase().includes(q));
      if (!matchSearch) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalSales = filtered.reduce((acc, r) => acc + Number(r.total || 0), 0);
  const totalCost = filtered.reduce((acc, r) => acc + Number(r.total_cost || 0), 0);
  const totalProfit = filtered.reduce((acc, r) => acc + Number(r.gross_profit || 0), 0);
  const avgMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : '0.0';
  const avgTicket = filtered.length > 0 ? (totalSales / filtered.length).toFixed(2) : '0.00';

  // Export to CSV
  function exportCSV() {
    if (!filtered.length) {
      alert('No hay ventas para exportar con los filtros actuales.');
      return;
    }
    const headers = [
      'ID Ticket',
      'Fecha',
      'Hora',
      'Sucursal',
      'Vendedor',
      'Rol Vendedor',
      'Cliente',
      'Tipo Doc',
      'Nro Identificacion',
      'Telefono',
      'Email',
      'Canal',
      'Modalidad Entrega',
      'Courier',
      'Guia',
      'Direccion',
      'Subtotal',
      'Envio',
      'Total Venta',
      'Costo Inversion',
      'Utilidad Bruta',
      'Margen %',
      'Metodos Pago',
      'Garantia Dias',
      'Codigo Garantia'
    ];

    const csvRows = filtered.map(r => {
      const d = new Date(r.created_at);
      const rev = Number(r.total || 0);
      const cost = Number(r.total_cost || 0);
      const prof = Number(r.gross_profit || 0);
      const marg = rev > 0 ? ((prof / rev) * 100).toFixed(1) : '0';

      return [
        `"${r.id || ''}"`,
        `"${d.toLocaleDateString()}"`,
        `"${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}"`,
        `"${r.branch_name || 'Principal'}"`,
        `"${r.seller_name || r.seller || ''}"`,
        `"${r.seller_role || ''}"`,
        `"${r.customer_name || r.customer || 'Consumidor Final'}"`,
        `"${r.customer_identification_type || ''}"`,
        `"${r.customer_identification_number || ''}"`,
        `"${r.customer_phone || ''}"`,
        `"${r.customer_email || ''}"`,
        `"${r.channel === 'ONLINE' ? 'Internet' : 'Local'}"`,
        `"${r.fulfillment_type === 'DELIVERY' ? 'Domicilio' : 'Retiro'}"`,
        `"${r.courier || ''}"`,
        `"${r.tracking_number || ''}"`,
        `"${(r.delivery_address || r.customer_address || '').replace(/"/g, '""')}"`,
        Number(r.subtotal || 0).toFixed(2),
        Number(r.shipping_cost || 0).toFixed(2),
        rev.toFixed(2),
        cost.toFixed(2),
        prof.toFixed(2),
        marg,
        `"${r.payment_methods || 'CASH'}"`,
        r.warranty_days || 0,
        `"${r.warranty_code || ''}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ventas_fixme_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Generate formatted WhatsApp message
  function getWhatsAppMessage(sale: Any) {
    const itemsText = (sale.items || [])
      .map((it: Any) => `  • ${it.quantity}x ${it.product_name} ($${Number(it.unit_price).toFixed(2)}) = $${Number(it.line_total).toFixed(2)}`)
      .join('\n');

    const paymentText = (sale.payments || [])
      .map((p: Any) => `${p.payment_method}: $${Number(p.amount).toFixed(2)}`)
      .join(', ') || 'Contado';

    const trkUrl = sale.tracking_number ? `${window.location.origin}${window.location.pathname}#tracking/${sale.tracking_number}` : (sale.tracking_url || '');
    const deliveryBlock = sale.fulfillment_type === 'DELIVERY'
      ? `\n🛵 *DESPACHO A DOMICILIO:*\n  • Courier: ${sale.courier || 'Motorizado Express'}\n  • N° Guía / Tracking: ${sale.tracking_number || 'S/N'}${trkUrl ? `\n  • Rastreo en vivo: ${trkUrl}` : ''}\n  • Destino: ${sale.delivery_address || 'Registrada'}`
      : '';

    const warrantyBlock = Number(sale.warranty_days || 0) > 0
      ? `\n🛡️ *GARANTÍA TÉCNICA OFICIAL:*\n  • Cobertura: ${sale.warranty_days} días\n  • Código: ${sale.warranty_code || 'Emitido con ticket'}\n  • Válida ante defectos de fábrica y mano de obra.`
      : '';

    return `🧾 *COMPROBANTE DE VENTA FIXMETIENDAS* 🧾
*Ticket N°:* #${sale.id?.slice(0, 8).toUpperCase()}
*Fecha:* ${new Date(sale.created_at).toLocaleDateString()} ${new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
*Sucursal:* ${sale.branch_name || 'Principal'}
*Atendido por:* ${sale.seller_name || sale.seller}

👤 *CLIENTE:* ${sale.customer_name || sale.customer || 'Consumidor Final'}
📄 *IDENTIFICACIÓN:* ${sale.customer_identification_type || 'C.I.'}: ${sale.customer_identification_number || 'Consumidor Final'}

📦 *DETALLE DE PRODUCTOS:*
${itemsText}
${Number(sale.discount || 0) > 0 ? `\n🏷️ *Descuento Aplicado:* -$${Number(sale.discount).toFixed(2)}` : ''}

💰 *TOTAL PAGADO:* $${Number(sale.total).toFixed(2)}
💳 *Forma de Pago:* ${paymentText}${deliveryBlock}${warrantyBlock}

¡Muchas gracias por confiar en *FixmeTiendas*! 🚀
Cualquier consulta o servicio técnico estamos a la orden.`;
  }

  function copyTicketSummary(sale: Any) {
    const text = getWhatsAppMessage(sale);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <>
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">AUDITORÍA COMERCIAL & REGISTRO DE VENTAS (SALES JOURNAL)</span>
          <h2>Registro General de Ventas</h2>
          <p>
            Bitácora de transacciones: vendedor/cajero responsable, ficha fiscal del cliente, detalle de productos, rentabilidad real (COGS vs Utilidad), canal y logística.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="secondary-action" onClick={exportCSV} title="Descargar reporte en formato Excel/CSV">
            📥 Exportar Excel/CSV
          </button>
          <button
            type="button"
            className="secondary-action"
            style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setShowSriInvoicesModal(true)}
            title="Ver todas las Facturas Electrónicas emitidas al SRI, consultar RIDE y descargar XML"
          >
            🏛️ Facturas SRI
          </button>
          <button type="button" className="primary-action" onClick={load}>
            🔄 Actualizar Ventas
          </button>
        </div>
      </section>

      {/* SALES FINANCIAL SUMMARY KPIS */}
      <div className="finance-grid">
        <div className="finance-card">
          <small>Ventas Totales Cobradas</small>
          <strong className="text-revenue">${totalSales.toFixed(2)}</strong>
          <span>{filtered.length} tickets facturados ({rows.length} en total)</span>
        </div>
        <div className="finance-card">
          <small>Costo de Mercadería (COGS)</small>
          <strong style={{ color: '#f43f5e' }}>${totalCost.toFixed(2)}</strong>
          <span>Capital invertido en productos vendidos</span>
        </div>
        <div className="finance-card">
          <small>Ganancia Bruta Real (Utilidad)</small>
          <strong className="text-profit">+${totalProfit.toFixed(2)}</strong>
          <span>Beneficio comercial neto generado</span>
        </div>
        <div className="finance-card">
          <small>Margen de Rentabilidad</small>
          <strong style={{ color: '#3b82f6' }}>{avgMargin}%</strong>
          <span>Margen bruto promedio sobre ventas</span>
        </div>
        <div className="finance-card">
          <small>Ticket Promedio</small>
          <strong style={{ color: '#8b5cf6' }}>${avgTicket}</strong>
          <span>Gasto promedio por cliente</span>
        </div>
      </div>

      {/* TOOLBAR CONTROLS & MULTI-FILTER BAR */}
      <div className="panel" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Channel and Fulfillment Pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button
                type="button"
                className={`filter-pill ${filterChannel === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterChannel('ALL')}
              >
                Todos los Canales ({rows.length})
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
                📱 Pedidos Catálogo / Web ({rows.filter(r => r.channel === 'ONLINE').length})
              </button>

              <span style={{ borderLeft: '1px solid #cbd5e1', margin: '0 4px' }} />

              <button
                type="button"
                className={`filter-pill ${filterFulfillment === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterFulfillment('ALL')}
              >
                Todas las Entregas
              </button>
              <button
                type="button"
                className={`filter-pill ${filterFulfillment === 'PICKUP' ? 'active' : ''}`}
                onClick={() => setFilterFulfillment('PICKUP')}
              >
                🏬 Retiro ({rows.filter(r => r.fulfillment_type === 'PICKUP').length})
              </button>
              <button
                type="button"
                className={`filter-pill ${filterFulfillment === 'DELIVERY' ? 'active' : ''}`}
                onClick={() => setFilterFulfillment('DELIVERY')}
              >
                🛵 Domicilio ({rows.filter(r => r.fulfillment_type === 'DELIVERY').length})
              </button>
            </div>

            {/* Date Range Selector */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <small style={{ fontWeight: 700, color: '#64748b' }}>Periodo:</small>
              <select
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
              >
                <option value="ALL">Todo el Historial</option>
                <option value="TODAY">Hoy</option>
                <option value="WEEK">Últimos 7 días</option>
                <option value="MONTH">Este Mes</option>
              </select>
            </div>
          </div>

          {/* Search Box and Seller Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div className="search-box" style={{ flex: 1, minWidth: '280px' }}>
              <span>🔍</span>
              <input
                placeholder="Buscar por ticket #, cliente, cédula/RUC, vendedor, teléfono, producto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <small style={{ fontWeight: 700, color: '#64748b' }}>Vendedor / Cajero:</small>
              <select
                value={filterSeller}
                onChange={e => setFilterSeller(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff', minWidth: '180px' }}
              >
                <option value="ALL">👤 Todos los vendedores ({uniqueSellers.length})</option>
                {uniqueSellers.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ENRICHED SALES DATA TABLE */}
      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket / Fecha</th>
                <th>Comprobante</th>
                <th>Vendedor / Cajero</th>
                <th>Cliente & Identificación</th>
                <th>Canal</th>
                <th>Entrega / Courier</th>
                <th>Método Pago</th>
                <th>Garantía</th>
                <th>Costo (COGS)</th>
                <th>Total Venta</th>
                <th>Ganancia Bruta</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const sellerInitial = (r.seller_name || r.seller || 'V').slice(0, 1).toUpperCase();
                const totalVal = Number(r.total || 0);
                const costVal = Number(r.total_cost || 0);
                const profitVal = Number(r.gross_profit || 0);
                const marginVal = totalVal > 0 ? ((profitVal / totalVal) * 100).toFixed(0) : '0';

                return (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ display: 'block', fontSize: '13px', color: '#1e293b' }}>
                        #{r.id?.slice(0, 8).toUpperCase()}
                      </strong>
                      <small style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </small>
                      {r.branch_name && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8' }}>
                          📍 {r.branch_name}
                        </span>
                      )}
                    </td>

                    {/* Comprobante */}
                    <td>
                      {r.invoice_type === 'SRI_INVOICE' || r.electronic_invoice_id || r.invoice_number ? (
                        <div>
                          <span className="status-badge status-approved" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px' }}>
                            🏛️ Factura SRI
                          </span>
                          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                            {r.invoice_number || 'Emitida'}
                          </div>
                          {r.invoice_sri_status && (
                            <span style={{ fontSize: '9.5px', color: r.invoice_sri_status === 'AUTORIZADA' ? '#059669' : '#d97706', fontWeight: 600 }}>
                              ● {r.invoice_sri_status}
                            </span>
                          )}
                        </div>
                      ) : r.offline_folio ? (
                        <div>
                          <span className="status-badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '10.5px' }}>
                            🧾 Offline
                          </span>
                          <div style={{ fontSize: '10px', color: '#78350f', fontFamily: 'monospace' }}>
                            {r.offline_folio}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="status-badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '10.5px' }}>
                            🧾 Ticket Interno
                          </span>
                          <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                            Sin IVA SRI
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Vendedor */}
                    <td>
                      <div className="seller-avatar-chip">
                        <span className="seller-circle">{sellerInitial}</span>
                        <div>
                          <span>{r.seller_name || r.seller || 'Sistema'}</span>
                          {r.seller_role && (
                            <span className="seller-role-badge">{r.seller_role}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Cliente */}
                    <td>
                      <strong style={{ display: 'block', fontSize: '12.5px', color: '#0f172a' }}>
                        {r.customer_name || r.customer || 'Consumidor Final'}
                      </strong>
                      {r.customer_identification_number ? (
                        <div className="customer-id-pill">
                          <span>{r.customer_identification_type || 'CI'}:</span>
                          <strong>{r.customer_identification_number}</strong>
                        </div>
                      ) : (
                        <small style={{ color: '#94a3b8' }}>Consumidor Final</small>
                      )}
                      {r.customer_phone && (
                        <div style={{ fontSize: '11px', marginTop: '2px' }}>
                          <a
                            href={`tel:${r.customer_phone}`}
                            style={{ textDecoration: 'none', color: '#3b82f6' }}
                          >
                            📞 {r.customer_phone}
                          </a>
                        </div>
                      )}
                    </td>

                    {/* Canal */}
                    <td>
                      <span className={`status-badge ${r.channel === 'ONLINE' ? 'status-quoted' : 'status-approved'}`}>
                        {r.channel === 'ONLINE' ? '🌐 Internet' : '🏪 Local'}
                      </span>
                    </td>

                    {/* Entrega / Logística */}
                    <td>
                      {r.fulfillment_type === 'DELIVERY' ? (
                        <div>
                          <span className="courier-pill" title={r.delivery_address || ''}>
                            🛵 {r.courier || 'Domicilio'}
                          </span>
                          {r.tracking_number && (
                            <div style={{ fontSize: '10.5px', marginTop: '3px' }}>
                              <a
                                href={`#tracking/${r.tracking_number}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  background: '#eff6ff',
                                  color: '#2563eb',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                  fontSize: '10px'
                                }}
                                title="Abrir rastreo público del cliente"
                              >
                                📍 {r.tracking_number}
                              </a>
                            </div>
                          )}
                          {r.delivery_status && (
                            <span style={{ display: 'inline-block', fontSize: '10px', color: '#059669', fontWeight: 600 }}>
                              ● {r.delivery_status}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="status-badge status-completed">
                          🏬 Retiro
                        </span>
                      )}
                    </td>

                    {/* Métodos de Pago */}
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '11px', color: '#334155' }}>
                        {r.payment_methods || 'CASH'}
                      </span>
                    </td>

                    {/* Garantía */}
                    <td>
                      {Number(r.warranty_days || 0) > 0 ? (
                        <div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                            🛡️ {r.warranty_days}d
                          </span>
                          {r.warranty_code && (
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                              {r.warranty_code}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sin garantía</span>
                      )}
                    </td>

                    {/* Costo Mercadería */}
                    <td style={{ color: '#f43f5e', fontSize: '12px', fontWeight: 600 }}>
                      ${costVal.toFixed(2)}
                    </td>

                    {/* Total Venta */}
                    <td>
                      <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                        ${totalVal.toFixed(2)}
                      </strong>
                    </td>

                    {/* Ganancia Bruta */}
                    <td>
                      <div style={{ fontWeight: 800, color: '#10b981', fontSize: '13px' }}>
                        +${profitVal.toFixed(2)}
                      </div>
                      <span className="margin-pill">
                        +{marginVal}%
                      </span>
                    </td>

                    {/* Acciones */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="secondary-action"
                          style={{ padding: '5px 9px', fontSize: '11px', whiteSpace: 'nowrap' }}
                          onClick={() => openDetail(r.id)}
                          title="Ver y re-imprimir comprobante térmico oficial"
                        >
                          👁️ Ver Ticket
                        </button>
                        {r.electronic_invoice_id ? (
                          <button
                            type="button"
                            className="secondary-action"
                            style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap', background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0', fontWeight: 700 }}
                            onClick={() => setShowRideInvoiceId(r.electronic_invoice_id)}
                            title="Ver RIDE oficial, descargar XML firmado y consultar SRI"
                          >
                            📄 RIDE SRI
                          </button>
                        ) : r.invoice_type === 'SRI_INVOICE' ? (
                          <button
                            type="button"
                            className="secondary-action"
                            style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap', background: '#fef3c7', color: '#b45309', borderColor: '#fde68a', fontWeight: 700 }}
                            onClick={() => issueSriInvoice(r.id)}
                            disabled={issuingSriId === r.id}
                            title="Completar y emitir Factura Electrónica SRI oficial"
                          >
                            {issuingSriId === r.id ? 'Emitiendo...' : '🏛️ Emitir Factura SRI'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary-action"
                            style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap', background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                            onClick={() => issueSriInvoice(r.id)}
                            disabled={issuingSriId === r.id}
                            title="Generar Factura Electrónica SRI oficial para esta venta"
                          >
                            {issuingSriId === r.id ? 'Emitiendo...' : '🏛️ Facturar SRI'}
                          </button>
                        )}
                        {r.customer_phone && (
                          <a
                            className="whatsapp-btn"
                            style={{ padding: '5px 8px', fontSize: '11px', textDecoration: 'none' }}
                            href={`https://wa.me/${r.customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Hola ${r.customer_name || 'cliente'}, te saludamos de FixmeTiendas. Tu compra #${r.id?.slice(0, 8)} por un total de $${Number(r.total || 0).toFixed(2)} está registrada con éxito. ¡Gracias por tu preferencia!`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Enviar comprobante por WhatsApp"
                          >
                            💬
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">
              <b>🧾</b>
              <p>No se encontraron ventas para los criterios seleccionados.</p>
            </div>
          )}
        </div>
      </div>

      {/* DETAILED SALE & 80MM THERMAL RECEIPT MODAL */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '16px' }}>
            <div className="modal-head no-print" style={{ marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  🧾 Comprobante de Venta #{detailModal.id?.slice(0, 8).toUpperCase()}
                </h3>
                <small style={{ color: '#64748b' }}>
                  Formato estándar para ticketera térmica EPSON / POS-80
                </small>
              </div>
              <button className="close-button" onClick={() => setDetailModal(null)}>✕</button>
            </div>

            {/* 80MM THERMAL PAPER ROLL RECEIPT */}
            <div id="printable-sale-receipt" className="receipt-80mm-container">
              <div className="receipt-header">
                <h2>FIXMETIENDAS</h2>
                <p><b>RUC:</b> 1792345678001</p>
                <p><b>Sucursal:</b> {detailModal.branch_name || 'Principal'}</p>
                <p>Quito, Ecuador · Tel: 0994175857</p>
                <div className="receipt-divider-double" />
                <div style={{ fontWeight: 800, fontSize: '13px', letterSpacing: '0.5px' }}>
                  COMPROBANTE DE VENTA & DESPACHO
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                  CANAL: {detailModal.channel === 'ONLINE' ? 'VENTA EN LÍNEA / WHATSAPP' : 'VENTA EN TIENDA FÍSICA'}
                </div>
                {detailModal.invoice_number ? (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 8px', borderRadius: '4px', margin: '6px 0', fontSize: '11px' }}>
                    <div style={{ fontWeight: 800, color: '#065f46' }}>🏛️ FACTURA ELECTRÓNICA SRI N°: {detailModal.invoice_number}</div>
                    <div style={{ fontSize: '9px', color: '#047857', wordBreak: 'break-all', marginTop: '2px' }}>
                      Clave Acceso: {detailModal.invoice_access_key}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#059669', marginTop: '2px' }}>
                      Estado SRI: {detailModal.invoice_sri_status || 'AUTORIZADA'}
                    </div>
                  </div>
                ) : detailModal.offline_folio ? (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '4px 6px', borderRadius: '4px', margin: '6px 0', color: '#92400e', fontSize: '10.5px', fontWeight: 700 }}>
                    ⚠️ Venta Registrada Offline (Folio: {detailModal.offline_folio})
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 6px', borderRadius: '4px', margin: '6px 0', color: '#64748b', fontSize: '10px' }}>
                    🧾 Ticket de Control Interno (No SRI)
                  </div>
                )}
              </div>

              <div className="receipt-divider-dash" />

              {/* TICKET METADATA */}
              <div className="receipt-meta-row">
                <span>TICKET N°:</span>
                <strong>#{detailModal.id?.slice(0, 8).toUpperCase()}</strong>
              </div>
              <div className="receipt-meta-row">
                <span>FECHA / HORA:</span>
                <span>
                  {new Date(detailModal.created_at).toLocaleDateString()} {new Date(detailModal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="receipt-meta-row">
                <span>VENDEDOR / CAJERO:</span>
                <strong>{detailModal.seller_name || detailModal.seller}</strong>
              </div>
              {detailModal.seller_role && (
                <div className="receipt-meta-row">
                  <span>ROL:</span>
                  <span>{detailModal.seller_role}</span>
                </div>
              )}

              <div className="receipt-divider-dash" />

              {/* CUSTOMER FISCAL DATA */}
              <div className="receipt-section-title">DATOS DEL CLIENTE:</div>
              <div className="receipt-meta-row">
                <span>CLIENTE:</span>
                <strong>{detailModal.customer_name || detailModal.customer || 'Consumidor Final'}</strong>
              </div>
              <div className="receipt-meta-row">
                <span>DOC. FISCAL:</span>
                <span>
                  {detailModal.customer_identification_type || 'C.I.'}: {detailModal.customer_identification_number || '9999999999999'}
                </span>
              </div>
              {detailModal.customer_phone && (
                <div className="receipt-meta-row">
                  <span>TELÉFONO:</span>
                  <span>{detailModal.customer_phone}</span>
                </div>
              )}
              {detailModal.customer_address && (
                <div className="receipt-meta-row">
                  <span>DIRECCIÓN:</span>
                  <span>{detailModal.customer_address}</span>
                </div>
              )}

              {/* DELIVERY DISPATCH INFO IF APPLICABLE */}
              {detailModal.fulfillment_type === 'DELIVERY' && (
                <>
                  <div className="receipt-divider-dash" />
                  <div className="receipt-section-title">🛵 DESPACHO / ENTREGA A DOMICILIO:</div>
                  <div className="receipt-meta-row">
                    <span>COURIER / TRANSPORTE:</span>
                    <strong>{detailModal.courier || 'Motorizado Express'}</strong>
                  </div>
                  {detailModal.tracking_number && (
                    <div className="receipt-meta-row" style={{ alignItems: 'center' }}>
                      <span>N° DE GUÍA / TRACKING:</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <strong style={{ color: '#2563eb' }}>{detailModal.tracking_number}</strong>
                        <a
                          href={`#tracking/${detailModal.tracking_number}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '10px',
                            background: '#2563eb',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            fontWeight: 700
                          }}
                          title="Abrir página pública de rastreo"
                        >
                          📍 Ver Rastreo
                        </a>
                      </div>
                    </div>
                  )}
                  {detailModal.tracking_url && (
                    <div className="receipt-meta-row">
                      <span>ENLACE GPS EN VIVO:</span>
                      <a href={detailModal.tracking_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: '10.5px' }}>
                        Ver ruta en vivo
                      </a>
                    </div>
                  )}
                  {detailModal.recipient_name && (
                    <div className="receipt-meta-row">
                      <span>DESTINATARIO:</span>
                      <span>{detailModal.recipient_name} ({detailModal.recipient_phone || 'S/T'})</span>
                    </div>
                  )}
                  <div className="receipt-meta-row">
                    <span>DIRECCIÓN DE ENTREGA:</span>
                    <span>{detailModal.delivery_address || 'No especificada'}</span>
                  </div>
                  {detailModal.delivery_notes && (
                    <div className="receipt-meta-row">
                      <span>INSTRUCCIONES:</span>
                      <span>{detailModal.delivery_notes}</span>
                    </div>
                  )}
                </>
              )}

              <div className="receipt-divider-dash" />

              {/* PRODUCTS BREAKDOWN TABLE */}
              <div className="receipt-section-title">DETALLE DE ARTÍCULOS:</div>
              <table className="receipt-table">
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th>CANT / PRODUCTO</th>
                    <th style={{ textAlign: 'right' }}>P.UNIT</th>
                    <th style={{ textAlign: 'right' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailModal.items || []).map((it: Any, idx: number) => {
                    const unitP = Number(it.unit_price || 0);
                    const subT = Number(it.line_total || (unitP * Number(it.quantity || 1)));
                    const unitCost = Number(it.cost_price || it.unit_cost || 0);
                    const itemProfit = Number(it.gross_profit || (subT - (unitCost * Number(it.quantity || 1))));

                    return (
                      <tr key={idx} style={{ borderBottom: '1px dotted #cbd5e1' }}>
                        <td style={{ padding: '4px 0' }}>
                          <b>{it.quantity}x</b> {it.product_name || 'Artículo'}
                          {it.product_sku && (
                            <small style={{ display: 'block', color: '#64748b', fontSize: '9.5px' }}>
                              SKU: {it.product_sku}
                            </small>
                          )}
                          {unitCost > 0 && (
                            <small style={{ display: 'block', color: '#94a3b8', fontSize: '9px' }}>
                              (Costo: ${unitCost.toFixed(2)} · Utilidad: +${itemProfit.toFixed(2)})
                            </small>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          ${unitP.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          ${subT.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="receipt-divider-dash" />

              {/* TOTALS AND FINANCIALS */}
              <div className="receipt-meta-row">
                <span>SUBTOTAL PRODUCTOS:</span>
                <span>${Number(detailModal.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(detailModal.shipping_cost || 0) > 0 && (
                <div className="receipt-meta-row">
                  <span>FLETE / ENVÍO DOMICILIO:</span>
                  <span>+${Number(detailModal.shipping_cost || 0).toFixed(2)}</span>
                </div>
              )}
              {Number(detailModal.tax || 0) > 0 && (
                <div className="receipt-meta-row">
                  <span>IVA (15%):</span>
                  <span>+${Number(detailModal.tax || 0).toFixed(2)}</span>
                </div>
              )}

              <div className="receipt-divider-double" />

              <div className="receipt-total-row">
                <span>TOTAL A PAGAR:</span>
                <span>${Number(detailModal.total || 0).toFixed(2)}</span>
              </div>

              {/* RETAIL PROFITABILITY AUDIT (COGS & PROFIT) */}
              <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', margin: '6px 0', border: '1px solid #e2e8f0' }}>
                <div className="receipt-meta-row" style={{ color: '#dc2626', fontSize: '10.5px' }}>
                  <span>Inversión Mercadería (Costo):</span>
                  <span>-${Number(detailModal.total_cost || 0).toFixed(2)}</span>
                </div>
                <div className="receipt-meta-row" style={{ color: '#059669', fontWeight: 800, fontSize: '11.5px' }}>
                  <span>Ganancia Bruta Negocio:</span>
                  <span>+${Number(detailModal.gross_profit || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="receipt-divider-dash" />

              {/* PAYMENTS RECORDED */}
              <div className="receipt-section-title">MÉTODOS DE PAGO:</div>
              {(detailModal.payments || []).map((p: Any, pIdx: number) => (
                <div key={pIdx} className="receipt-meta-row">
                  <span>● {p.payment_method || 'EFECTIVO'}:</span>
                  <strong>${Number(p.amount || 0).toFixed(2)}</strong>
                </div>
              ))}

              {/* WARRANTY BADGE & CLAUSE */}
              {Number(detailModal.warranty_days || 0) > 0 && (
                <>
                  <div className="receipt-divider-dash" />
                  <div className="receipt-section-title">🛡️ GARANTÍA TÉCNICA OFICIAL:</div>
                  <div className="receipt-meta-row">
                    <span>COBERTURA:</span>
                    <strong>{detailModal.warranty_days} DÍAS CALENDARIO</strong>
                  </div>
                  <div className="receipt-meta-row">
                    <span>CÓDIGO ÚNICO:</span>
                    <strong style={{ color: '#2563eb' }}>
                      {detailModal.warranty_code || `GAR-${detailModal.id?.slice(0, 6).toUpperCase()}`}
                    </strong>
                  </div>
                  <p style={{ fontSize: '10px', color: '#475569', margin: '4px 0 0 0', lineHeight: 1.3 }}>
                    * Válida ante defectos de fábrica y funcionamiento. Conserve este comprobante original. No cubre caídas, roturas o derrame de líquidos.
                  </p>
                </>
              )}

              {/* DYNAMIC QR CODE FOR DIGITAL VERIFICATION */}
              <div className="receipt-qr-wrap">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(
                    `https://fixmetiendas.local/ticket/${detailModal.id}`
                  )}`}
                  alt="QR Verificación Comprobante"
                />
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '3px' }}>
                  Escanee para validar ticket y garantía oficial
                </div>
              </div>

              <div className="receipt-divider-double" />
              <div className="receipt-footer-text">
                <p style={{ margin: 0, fontWeight: 700 }}>¡Gracias por confiar en FixmeTiendas!</p>
                <p style={{ margin: '2px 0 0', fontSize: '9.5px' }}>Tecnología y Servicio Especializado</p>
              </div>
            </div>

            {/* ACTION BUTTONS (NO-PRINT) */}
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="primary-action"
                  style={{ flex: 1, padding: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => window.print()}
                >
                  🖨️ Imprimir Térmico (80mm)
                </button>
                {detailModal.electronic_invoice_id ? (
                  <button
                    type="button"
                    className="primary-action"
                    style={{ flex: 1, padding: '10px', fontWeight: 700, background: '#059669', borderColor: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setShowRideInvoiceId(detailModal.electronic_invoice_id)}
                  >
                    🏛️ Ver RIDE SRI
                  </button>
                ) : detailModal.invoice_type === 'SRI_INVOICE' && (
                  <button
                    type="button"
                    className="primary-action"
                    style={{ flex: 1, padding: '10px', fontWeight: 700, background: '#d97706', borderColor: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={async () => {
                      const sId = detailModal.id;
                      setDetailModal(null);
                      await issueSriInvoice(sId);
                    }}
                  >
                    🏛️ Emitir Factura SRI
                  </button>
                )}
                {detailModal.customer_phone && (
                  <a
                    className="whatsapp-btn"
                    style={{ flex: 1, textDecoration: 'none', justifyContent: 'center', padding: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                    href={`https://wa.me/${detailModal.customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      getWhatsAppMessage(detailModal)
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    💬 Enviar WhatsApp
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {detailModal.fulfillment_type === 'DELIVERY' && detailModal.tracking_number && (
                  <a
                    className="secondary-action"
                    style={{ flex: 1, padding: '8px', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700 }}
                    href={`#tracking/${detailModal.tracking_number}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📍 Ver Rastreo en Vivo
                  </a>
                )}
                <button
                  type="button"
                  className="secondary-action"
                  style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                  onClick={() => copyTicketSummary(detailModal)}
                >
                  {copied ? '✅ ¡Copiado al Portapapeles!' : '📋 Copiar Resumen de Venta'}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                  onClick={() => setDetailModal(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRideInvoiceId && (
        <SriRideModal
          invoiceId={showRideInvoiceId}
          api={api}
          onClose={() => setShowRideInvoiceId(null)}
        />
      )}

      {showSriInvoicesModal && (
        <SriInvoicesListModal
          api={api}
          onClose={() => setShowSriInvoicesModal(false)}
          onOpenRide={(id: string) => setShowRideInvoiceId(id)}
        />
      )}
    </>
  );
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', background: '#fff', borderRadius: 12, margin: 20, border: '1px solid #fee2e2' }}>
          <h2 style={{ color: '#dc2626', margin: '0 0 8px 0' }}>⚠️ Ocurrió un error inesperado al cargar esta sección</h2>
          <p style={{ color: '#64748b', fontSize: '13px' }}>{String(this.state.error?.message || this.state.error || 'Error de renderizado')}</p>
          <button className="primary-action" onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: 16 }}>
            🔄 Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PlatformAdministration({api, notify, activeTab, setTab}:{api:(u:string,o?:RequestInit)=>Promise<Response>, notify?:(s:string)=>void, activeTab?:string, setTab?:(t:string)=>void}){
  const [tenants, setTenants] = React.useState<Any[]>([]);
  const [stats, setStats] = React.useState<Any>({
    totalTenants: 0, activeTenants: 0, pastDueTenants: 0, suspendedTenants: 0,
    mrr: 0, collectedThisMonth: 0, totalUsers: 0, totalProducts: 0, totalOrders: 0
  });
  const [payments, setPayments] = React.useState<Any[]>([]);
  const [filter, setFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const currentTab = activeTab && ['platform-overview', 'platform-companies', 'platform-rates', 'platform-payments'].includes(activeTab)
    ? activeTab : 'platform-companies';

  function switchTab(t: string) {
    if (setTab) setTab(t);
  }

  // Detail modal
  const [selectedTenant, setSelectedTenant] = React.useState<Any|null>(null);
  const [tenantPayments, setTenantPayments] = React.useState<Any[]>([]);
  const [overview, setOverview] = React.useState<Any>({});
  const [users, setUsers] = React.useState<Any[]>([]);
  const [detailTab, setDetailTab] = React.useState<'payments'|'users'|'overview'>('payments');

  // Create company modal
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    name: '', plan: 'STARTER', monthlyFee: '49.00', businessType: 'RETAIL',
    billingCycle: 'MONTHLY', discountPercent: '0',
    ownerName: '', ownerEmail: '', ownerPassword: 'password123', phone: '',
    billingContactName: '', billingContactPhone: '', billingContactEmail: '', adminNotes: ''
  });
  const [createMsg, setCreateMsg] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  // Edit Rate modal
  const [editRateModal, setEditRateModal] = React.useState<Any|null>(null);
  const [rateForm, setRateForm] = React.useState({
    monthlyFee: '49.00', plan: 'STARTER', billingCycle: 'MONTHLY', discountPercent: '0',
    nextBillingDate: '', billingContactName: '', billingContactPhone: '', billingContactEmail: '', adminNotes: ''
  });
  const [savingRate, setSavingRate] = React.useState(false);

  // Record payment modal
  const [payModal, setPayModal] = React.useState<Any|null>(null);
  const [payForm, setPayForm] = React.useState({
    amount: '49.00', periodCovered: '', paymentMethod: 'TRANSFER', reference: '', notes: ''
  });
  const [paying, setPaying] = React.useState(false);

  // Official SaaS Receipt modal
  const [receiptModal, setReceiptModal] = React.useState<Any|null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      api('/api/platform/tenants').then(r => r.ok ? r.json() : []),
      api('/api/platform/stats').then(r => r.ok ? r.json() : {}),
      api('/api/platform/payments').then(r => r.ok ? r.json() : [])
    ]).then(([tenantsData, statsData, paymentsData]) => {
      setTenants(tenantsData);
      setStats(statsData);
      setPayments(paymentsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function openDetail(t: Any) {
    setSelectedTenant(t);
    setDetailTab('payments');
    const [paymentsRes, overviewRes, usersRes] = await Promise.all([
      api(`/api/platform/tenants/${t.id}/payments`).then(r => r.ok ? r.json() : []),
      api(`/api/platform/tenants/${t.id}/overview`).then(r => r.ok ? r.json() : {}),
      api(`/api/platform/tenants/${t.id}/users`).then(r => r.ok ? r.json() : [])
    ]);
    setTenantPayments(paymentsRes);
    setOverview(overviewRes);
    setUsers(usersRes);
  }

  function openEditRate(t: Any) {
    setEditRateModal(t);
    setRateForm({
      monthlyFee: String(t.monthly_fee || 49),
      plan: t.plan || 'STARTER',
      billingCycle: t.billing_cycle || 'MONTHLY',
      discountPercent: String(t.discount_percent || 0),
      nextBillingDate: t.next_billing_date ? String(t.next_billing_date).slice(0, 10) : '',
      billingContactName: t.billing_contact_name || t.owner_name || '',
      billingContactPhone: t.billing_contact_phone || t.owner_phone || t.store_phone || '',
      billingContactEmail: t.billing_contact_email || t.owner_email || '',
      adminNotes: t.admin_notes || ''
    });
  }

  async function submitRate(e: React.FormEvent) {
    e.preventDefault();
    if (!editRateModal) return;
    setSavingRate(true);
    const r = await api(`/api/platform/tenants/${editRateModal.id}/rate`, {
      method: 'PATCH',
      body: JSON.stringify(rateForm)
    });
    setSavingRate(false);
    if (r.ok) {
      notify?.(`✓ Tarifa de "${editRateModal.name}" actualizada a $${Number(rateForm.monthlyFee).toFixed(2)}/mes.`);
      setEditRateModal(null);
      load();
    } else {
      notify?.('Error al actualizar la tarifa.');
    }
  }

  async function handleSuspend(t: Any) {
    if (!window.confirm(`¿Confirmas suspender la tienda "${t.name}"? Los empleados y el gerente no podrán operar hasta que se reactive.`)) return;
    const r = await api(`/api/platform/tenants/${t.id}/suspend`, { method: 'PATCH' });
    if (r.ok) {
      notify?.(`Tienda "${t.name}" suspendida por falta de pago.`);
      load();
      if (selectedTenant?.id === t.id) {
        setSelectedTenant({ ...selectedTenant, subscription_status: 'SUSPENDED', payment_status: 'OVERDUE' });
      }
    } else {
      notify?.('No se pudo suspender la tienda');
    }
  }

  async function handleReactivate(t: Any) {
    const r = await api(`/api/platform/tenants/${t.id}/reactivate`, { method: 'PATCH' });
    if (r.ok) {
      notify?.(`✓ Tienda "${t.name}" reactivada exitosamente. Acceso restaurado.`);
      load();
      if (selectedTenant?.id === t.id) {
        setSelectedTenant({ ...selectedTenant, subscription_status: 'ACTIVE', payment_status: 'PAID' });
      }
    } else {
      notify?.('No se pudo reactivar la tienda');
    }
  }

  function openRecordPayment(t: Any) {
    const today = new Date();
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentPeriod = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    const fee = Number(t.monthly_fee || 49);
    const disc = Number(t.discount_percent || 0);
    const net = fee * (1 - disc / 100);
    setPayModal(t);
    setPayForm({
      amount: String(net > 0 ? net.toFixed(2) : fee.toFixed(2)),
      periodCovered: currentPeriod,
      paymentMethod: 'TRANSFER',
      reference: '',
      notes: `Pago mensual de suscripción - Plan ${t.plan || 'STARTER'}`
    });
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payModal) return;
    setPaying(true);
    const r = await api(`/api/platform/tenants/${payModal.id}/payments`, {
      method: 'POST',
      body: JSON.stringify(payForm)
    });
    setPaying(false);
    if (r.ok) {
      const createdPayment = await r.json();
      notify?.(`✓ Mensualidad registrada exitosamente para "${payModal.name}". Tienda al día.`);
      setPayModal(null);
      load();
      if (selectedTenant?.id === payModal.id) {
        openDetail(payModal);
      }
      setReceiptModal({ ...createdPayment, tenant_name: payModal.name, plan: payModal.plan });
    } else {
      notify?.('Error al registrar pago de mensualidad.');
    }
  }

  async function handleCreateTenant(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg('');
    const r = await api('/api/platform/tenants', {
      method: 'POST',
      body: JSON.stringify(createForm)
    });
    setCreating(false);
    if (r.ok) {
      notify?.(`✓ Empresa "${createForm.name}" registrada exitosamente con tarifa de $${createForm.monthlyFee}/mes.`);
      setCreateForm({
        name: '', plan: 'STARTER', monthlyFee: '49.00', businessType: 'RETAIL',
        billingCycle: 'MONTHLY', discountPercent: '0',
        ownerName: '', ownerEmail: '', ownerPassword: 'password123', phone: '',
        billingContactName: '', billingContactPhone: '', billingContactEmail: '', adminNotes: ''
      });
      setShowCreateModal(false);
      load();
    } else {
      setCreateMsg('No se pudo crear la empresa. Verifica que el correo del manager no esté registrado en el sistema.');
    }
  }

  function getDaysUntilDue(d: any): number {
    if (d == null) return 30;
    if (typeof d === 'number') return d;
    if (typeof d === 'object') {
      if (d.days != null) return Number(d.days);
      if (d.value != null) {
        const v = parseInt(String(d.value), 10);
        if (!isNaN(v)) return v;
      }
    }
    const n = parseInt(String(d), 10);
    return isNaN(n) ? 30 : n;
  }

  function getBillingBadge(t: Any) {
    if (t.subscription_status === 'SUSPENDED') {
      return <span className="billing-badge billing-badge-suspended">🚫 Suspendida</span>;
    }
    const days = getDaysUntilDue(t.days_until_due);
    if (days < 0) {
      return <span className="billing-badge billing-badge-overdue">🚨 Vencida hace {Math.abs(days)}d</span>;
    }
    if (days <= 5) {
      return <span className="billing-badge billing-badge-warn">⚠️ Vence en {days}d</span>;
    }
    return <span className="billing-badge billing-badge-ok">🟢 Al día ({days}d)</span>;
  }

  function getCycleLabel(c: string) {
    switch ((c || '').toUpperCase()) {
      case 'ANNUAL': return 'Anual (12m)';
      case 'SEMIANNUAL': return 'Semestral (6m)';
      case 'QUARTERLY': return 'Trimestral (3m)';
      default: return 'Mensual (1m)';
    }
  }

  function calculateNetCycle(feeStr: string, discStr: string, cycleStr: string) {
    const fee = Number(feeStr || 0);
    const disc = Number(discStr || 0);
    const months = cycleStr === 'ANNUAL' ? 12 : cycleStr === 'SEMIANNUAL' ? 6 : cycleStr === 'QUARTERLY' ? 3 : 1;
    const netMonthly = fee * (1 - disc / 100);
    return (netMonthly * months).toFixed(2);
  }

  const filteredTenants = tenants.filter(t => {
    if (filter !== 'ALL') {
      if (filter === 'ACTIVE' && t.subscription_status !== 'ACTIVE') return false;
      if (filter === 'PAST_DUE' && (t.subscription_status !== 'PAST_DUE' && getDaysUntilDue(t.days_until_due) > 0)) return false;
      if (filter === 'SUSPENDED' && t.subscription_status !== 'SUSPENDED') return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = (t.name || '').toLowerCase().includes(q) ||
                    (t.owner_email || '').toLowerCase().includes(q) ||
                    (t.owner_name || '').toLowerCase().includes(q) ||
                    (t.billing_contact_name || '').toLowerCase().includes(q) ||
                    (t.store_phone || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const dueSoonTenants = tenants.filter(t => t.subscription_status === 'ACTIVE' && getDaysUntilDue(t.days_until_due) <= 7);

  return (
    <>
      {/* Subnavigation Bar */}
      <div className="saas-nav-tabs">
        <button
          type="button"
          className={`saas-nav-pill ${currentTab === 'platform-overview' ? 'active' : ''}`}
          onClick={() => switchTab('platform-overview')}
        >
          📊 Panel SaaS
        </button>
        <button
          type="button"
          className={`saas-nav-pill ${currentTab === 'platform-companies' ? 'active' : ''}`}
          onClick={() => switchTab('platform-companies')}
        >
          🏢 Empresas ({tenants.length})
        </button>
        <button
          type="button"
          className={`saas-nav-pill ${currentTab === 'platform-rates' ? 'active' : ''}`}
          onClick={() => switchTab('platform-rates')}
        >
          🏷️ Tarifas por Empresa
        </button>
        <button
          type="button"
          className={`saas-nav-pill ${currentTab === 'platform-payments' ? 'active' : ''}`}
          onClick={() => switchTab('platform-payments')}
        >
          🧾 Cobranzas y Recibos ({payments.length})
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="secondary-action" onClick={load} style={{ padding: '6px 12px', fontSize: '12px' }}>
            🔄 Actualizar
          </button>
          <button className="primary-action" onClick={() => setShowCreateModal(true)} style={{ padding: '6px 14px', fontSize: '12px' }}>
            ＋ Nueva Empresa
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW / DASHBOARD SAAS
          ========================================================================= */}
      {currentTab === 'platform-overview' && (
        <div>
          {dueSoonTenants.length > 0 && (
            <div className="saas-alert-banner">
              <div>
                <strong style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⚠️ {dueSoonTenants.length} {dueSoonTenants.length === 1 ? 'empresa tiene' : 'empresas tienen'} vencimiento de mensualidad en los próximos 7 días:
                </strong>
                <div style={{ fontSize: '12.5px', color: '#b45309', marginTop: 4 }}>
                  {dueSoonTenants.map(t => `${t.name} ($${Number(t.monthly_fee || 49).toFixed(2)} - vence en ${getDaysUntilDue(t.days_until_due)}d)`).join(' · ')}
                </div>
              </div>
              <button
                className="btn-action-pay"
                onClick={() => switchTab('platform-companies')}
                style={{ whiteSpace: 'nowrap' }}
              >
                Ver Empresas por Cobrar →
              </button>
            </div>
          )}

          {/* SaaS Owner KPI Cards */}
          <div className="platform-kpi-grid">
            <div className="platform-kpi-card" onClick={() => { setFilter('ALL'); switchTab('platform-companies'); }} style={{ cursor: 'pointer' }}>
              <small>Empresas Registradas</small>
              <strong>{stats.totalTenants || tenants.length}</strong>
              <span>En la plataforma</span>
            </div>
            <div className="platform-kpi-card" onClick={() => { setFilter('ACTIVE'); switchTab('platform-companies'); }} style={{ cursor: 'pointer' }}>
              <small>Empresas Al Día</small>
              <strong style={{ color: '#059669' }}>{stats.activeTenants || 0}</strong>
              <span>Con servicio habilitado</span>
            </div>
            <div className="platform-kpi-card" onClick={() => { setFilter('PAST_DUE'); switchTab('platform-companies'); }} style={{ cursor: 'pointer' }}>
              <small>Cobros Próximos / Vencidos</small>
              <strong style={{ color: '#d97706' }}>{stats.pastDueTenants || 0}</strong>
              <span>Avisar o registrar cobro</span>
            </div>
            <div className="platform-kpi-card" onClick={() => { setFilter('SUSPENDED'); switchTab('platform-companies'); }} style={{ cursor: 'pointer' }}>
              <small>Empresas Suspendidas</small>
              <strong style={{ color: '#dc2626' }}>{stats.suspendedTenants || 0}</strong>
              <span>Acceso bloqueado por mora</span>
            </div>
            <div className="platform-kpi-card" style={{ background: '#f8faff', borderColor: '#bfdbfe' }}>
              <small style={{ color: '#1d4ed8' }}>MRR Recurrente Estimado</small>
              <strong style={{ color: '#1d4ed8' }}>${Number(stats.mrr || 0).toFixed(2)}</strong>
              <span>Ingreso mensual de empresas activas</span>
            </div>
            <div className="platform-kpi-card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <small style={{ color: '#166534' }}>Recaudado este Mes</small>
              <strong style={{ color: '#166534' }}>${Number(stats.collectedThisMonth || 0).toFixed(2)}</strong>
              <span>Pagos registrados en el mes</span>
            </div>
          </div>

          {/* Quick Action Matrix for upcoming billings */}
          <div className="panel table-panel" style={{ marginTop: 20 }}>
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>🚨 Calendario de Próximos Cobros</h3>
                <p className="catalog-toolbar-p">Empresas ordenadas por fecha de vencimiento más cercana para gestión de cobranza</p>
              </div>
              <button className="btn-action-pay" onClick={() => switchTab('platform-rates')}>
                Ir a Matriz de Tarifas →
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Plan</th>
                    <th>Tarifa Mensual</th>
                    <th>Ciclo</th>
                    <th>Próximo Cobro</th>
                    <th>Estado</th>
                    <th>Gerente / Contacto</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.slice(0, 8).map(t => {
                    const cleanPhone = (t.billing_contact_phone || t.owner_phone || t.store_phone || '').replace(/[^0-9]/g, '');
                    const waMsg = encodeURIComponent(`Hola ${t.billing_contact_name || t.owner_name || 'estimado cliente'}, te saludamos de la administración de FixmeTiendas para coordinar el pago de tu plan ${t.plan || 'STARTER'} ($${Number(t.monthly_fee || 49).toFixed(2)}).`);
                    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMsg}` : '';
                    return (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{t.business_type || 'RETAIL'}</div>
                        </td>
                        <td>
                          <span className={`plan-chip plan-chip-${(t.plan || 'starter').toLowerCase()}`}>
                            {t.plan || 'STARTER'}
                          </span>
                        </td>
                        <td>
                          <strong>${Number(t.monthly_fee || 49).toFixed(2)}</strong>
                          {Number(t.discount_percent || 0) > 0 && (
                            <span className="discount-tag" style={{ marginLeft: 6 }}>-{t.discount_percent}%</span>
                          )}
                        </td>
                        <td>
                          <span className="cycle-badge">{getCycleLabel(t.billing_cycle)}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: getDaysUntilDue(t.days_until_due) <= 5 ? '#d97706' : '#1e293b' }}>
                            {t.next_billing_date ? String(t.next_billing_date).slice(0, 10) : 'Pendiente'}
                          </div>
                          <small style={{ color: '#64748b' }}>en {getDaysUntilDue(t.days_until_due)} días</small>
                        </td>
                        <td>{getBillingBadge(t)}</td>
                        <td>
                          <div>{t.billing_contact_name || t.owner_name || 'Sin asignar'}</div>
                          <small style={{ color: '#64748b' }}>{t.billing_contact_phone || t.owner_phone || 'Sin teléfono'}</small>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-action-pay" onClick={() => openRecordPayment(t)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                              💵 Cobrar
                            </button>
                            <button className="secondary-action" onClick={() => openEditRate(t)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                              ✏️ Tarifa
                            </button>
                            {waUrl && (
                              <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', background: '#25d366', color: '#fff', padding: '4px 8px', borderRadius: 6, fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                                💬 WA
                              </a>
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
        </div>
      )}

      {/* =========================================================================
          TAB 2: COMPANIES / TIENDAS
          ========================================================================= */}
      {currentTab === 'platform-companies' && (
        <div>
          {/* Toolbar */}
          <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="filter-group" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {[
                ['ALL', `Todas (${tenants.length})`],
                ['ACTIVE', `Al Día (${stats.activeTenants || 0})`],
                ['PAST_DUE', `Por Vencer / Mora (${stats.pastDueTenants || 0})`],
                ['SUSPENDED', `Suspendidas (${stats.suspendedTenants || 0})`]
              ].map(([k, label]) => (
                <button
                  key={k}
                  className={filter === k ? 'btn-filter active' : 'btn-filter'}
                  onClick={() => setFilter(k)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: filter === k ? '1px solid #3157d5' : '1px solid #cbd5e1',
                    background: filter === k ? '#eff6ff' : '#ffffff',
                    color: filter === k ? '#1d4ed8' : '#475569',
                    fontWeight: filter === k ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ minWidth: '240px', flex: '1 1 240px', maxWidth: '380px' }}>
              <input
                type="text"
                placeholder="🔍 Buscar por empresa, manager, teléfono o correo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Stores Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Cargando empresas...</div>
          ) : filteredTenants.length === 0 ? (
            <div className="panel empty" style={{ textAlign: 'center', padding: '40px 20px', background: '#ffffff', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
              <h3>No se encontraron empresas</h3>
              <p style={{ color: '#64748b', fontSize: '13px' }}>Prueba con otro filtro o término de búsqueda.</p>
            </div>
          ) : (
            <div className="store-card-grid">
              {filteredTenants.map(t => {
                const isSuspended = t.subscription_status === 'SUSPENDED';
                const cleanPhone = (t.billing_contact_phone || t.owner_phone || t.store_phone || '').replace(/[^0-9]/g, '');
                const waMsg = encodeURIComponent(`Hola ${t.billing_contact_name || t.owner_name || 'estimado cliente'}, te saludamos de la administración de FixmeTiendas para coordinar el cobro de tu mensualidad en "${t.name}" (Plan ${t.plan || 'STARTER'} - $${Number(t.monthly_fee || 49).toFixed(2)}).`);
                const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMsg}` : '';

                return (
                  <div key={t.id} className={isSuspended ? 'store-card suspended' : 'store-card'}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <strong style={{ fontSize: '16px', color: '#0f172a' }}>{t.name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
                            {t.business_type || 'RETAIL'} · Plan <strong style={{ color: '#2563eb' }}>{t.plan || 'STARTER'}</strong>
                          </div>
                        </div>
                        {getBillingBadge(t)}
                      </div>

                      {/* Financial Details Box */}
                      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: 12, border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Tarifa Asignada:</span>
                          <div>
                            <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                              ${Number(t.monthly_fee || 49).toFixed(2)}
                            </strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}> / {getCycleLabel(t.billing_cycle)}</span>
                            {Number(t.discount_percent || 0) > 0 && (
                              <span className="discount-tag" style={{ marginLeft: 4 }}>-{t.discount_percent}%</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: '11.5px' }}>
                          <span style={{ color: '#64748b' }}>Próximo Cobro:</span>
                          <strong style={{ color: getDaysUntilDue(t.days_until_due) < 0 ? '#dc2626' : '#1e293b' }}>
                            {t.next_billing_date ? String(t.next_billing_date).slice(0, 10) : 'Pendiente'}
                          </strong>
                        </div>
                        {t.last_payment_date && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8' }}>
                            <span>Último Pago:</span>
                            <span>{String(t.last_payment_date).slice(0, 10)}</span>
                          </div>
                        )}
                      </div>

                      {/* Contact details */}
                      <div style={{ padding: '6px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', marginBottom: 12, fontSize: '12px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
                          👤 {t.billing_contact_name || t.owner_name || 'Manager no asignado'}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: 4 }}>
                          ✉️ {t.billing_contact_email || t.owner_email || 'Sin correo'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748b', fontSize: '11px' }}>📞 {t.billing_contact_phone || t.owner_phone || t.store_phone || 'Sin teléfono'}</span>
                          {waUrl && (
                            <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#25d366', color: '#ffffff', padding: '3px 7px', borderRadius: 6, fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                              💬 WhatsApp
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Quick metrics summary */}
                      <div style={{ display: 'flex', gap: 8, fontSize: '11px', color: '#64748b', marginBottom: 14 }}>
                        <span>👥 {t.user_count || 0} usuarios</span>
                        <span>•</span>
                        <span>📦 {t.product_count || 0} productos</span>
                        <span>•</span>
                        <span>🛠️ {t.order_count || 0} órdenes</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                      <button className="btn-action-pay" onClick={() => openRecordPayment(t)}>
                        💵 Cobrar
                      </button>
                      <button className="secondary-action" onClick={() => openEditRate(t)} style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 700 }}>
                        🏷️ Tarifa
                      </button>
                      {isSuspended ? (
                        <button className="btn-action-reactivate" onClick={() => handleReactivate(t)}>
                          🟢 Reactivar
                        </button>
                      ) : (
                        <button className="btn-action-suspend" onClick={() => handleSuspend(t)}>
                          🚫 Suspender
                        </button>
                      )}
                      <button className="tech-action-btn tech-action-diag" onClick={() => openDetail(t)}>
                        📋 Ficha
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: TARIFAS Y FACTURACIÓN POR EMPRESA
          ========================================================================= */}
      {currentTab === 'platform-rates' && (
        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>🏷️ Matriz de Tarifas y Facturación por Empresa</h3>
                <p className="catalog-toolbar-p" style={{ margin: '4px 0 0 0' }}>
                  Define valores mensuales personalizados, periodicidad de cobro y descuentos especiales por cada cliente SaaS
                </p>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ background: '#eff6ff', padding: '8px 14px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                  <small style={{ color: '#1e40af', fontSize: '11px', display: 'block' }}>MRR Proyectado</small>
                  <strong style={{ color: '#1e3a8a', fontSize: '18px' }}>${Number(stats.mrr || 0).toFixed(2)}</strong>
                </div>
                <div style={{ background: '#f0fdf4', padding: '8px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <small style={{ color: '#166534', fontSize: '11px', display: 'block' }}>Tarifa Promedio</small>
                  <strong style={{ color: '#14532d', fontSize: '18px' }}>
                    ${tenants.length > 0 ? (Number(stats.mrr || 0) / tenants.length).toFixed(2) : '0.00'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="panel table-panel">
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Filtrar por empresa o plan..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '280px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
              />
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Mostrando {filteredTenants.length} de {tenants.length} empresas
              </span>
            </div>

            <div className="table-wrap">
              <table className="saas-rates-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Plan</th>
                    <th>Tarifa Base</th>
                    <th>Ciclo Facturación</th>
                    <th>Descuento</th>
                    <th>Monto Neto / Ciclo</th>
                    <th>Próximo Cobro</th>
                    <th>Estado</th>
                    <th>Contacto Cobranza</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map(t => {
                    const netCycle = calculateNetCycle(t.monthly_fee, t.discount_percent, t.billing_cycle);
                    return (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{t.business_type || 'RETAIL'}</div>
                        </td>
                        <td>
                          <span className={`plan-chip plan-chip-${(t.plan || 'starter').toLowerCase()}`}>
                            {t.plan || 'STARTER'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                            ${Number(t.monthly_fee || 49).toFixed(2)}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}> / mes</span>
                        </td>
                        <td>
                          <span className="cycle-badge">{getCycleLabel(t.billing_cycle)}</span>
                        </td>
                        <td>
                          {Number(t.discount_percent || 0) > 0 ? (
                            <span className="discount-tag">-{t.discount_percent}% OFF</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Normal (0%)</span>
                          )}
                        </td>
                        <td>
                          <strong style={{ color: '#059669', fontSize: '14px' }}>${netCycle}</strong>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {t.next_billing_date ? String(t.next_billing_date).slice(0, 10) : 'Pendiente'}
                          </div>
                          <small style={{ color: getDaysUntilDue(t.days_until_due) <= 5 ? '#d97706' : '#64748b' }}>
                            {getDaysUntilDue(t.days_until_due)} días restantes
                          </small>
                        </td>
                        <td>{getBillingBadge(t)}</td>
                        <td>
                          <div style={{ fontSize: '12px' }}>{t.billing_contact_name || t.owner_name || 'Sin asignar'}</div>
                          <small style={{ color: '#64748b' }}>{t.billing_contact_phone || t.owner_phone || '-'}</small>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="primary-action"
                            onClick={() => openEditRate(t)}
                            style={{ padding: '5px 10px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                          >
                            ✏️ Modificar Tarifa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: COBRANZAS Y RECIBOS SAAS
          ========================================================================= */}
      {currentTab === 'platform-payments' && (
        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>🧾 Registro y Comprobantes de Recaudación SaaS</h3>
                <p className="catalog-toolbar-p" style={{ margin: '4px 0 0 0' }}>
                  Historial completo de pagos de mensualidad cobrados a todas las tiendas de la plataforma
                </p>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ background: '#f0fdf4', padding: '8px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <small style={{ color: '#166534', fontSize: '11px', display: 'block' }}>Recaudado este Mes</small>
                  <strong style={{ color: '#14532d', fontSize: '18px' }}>${Number(stats.collectedThisMonth || 0).toFixed(2)}</strong>
                </div>
                <div style={{ background: '#f8fafc', padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <small style={{ color: '#475569', fontSize: '11px', display: 'block' }}>Total Recibos Emitidos</small>
                  <strong style={{ color: '#0f172a', fontSize: '18px' }}>{payments.length}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="panel table-panel">
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Buscar por empresa, referencia bancaria o período..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '320px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
              />
              <button
                className="primary-action"
                onClick={() => {
                  if (tenants.length > 0) openRecordPayment(tenants[0]);
                }}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                ＋ Registrar Cobro de Mensualidad
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha Cobro</th>
                    <th>Empresa</th>
                    <th>Plan</th>
                    <th>Período Cubierto</th>
                    <th>Método</th>
                    <th>Comprobante / Ref</th>
                    <th>Monto Recaudado</th>
                    <th>Registrado Por</th>
                    <th style={{ textAlign: 'center' }}>Recibo</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.filter(p => {
                    if (!search.trim()) return true;
                    const q = search.toLowerCase();
                    return (p.tenant_name || '').toLowerCase().includes(q) ||
                           (p.reference || '').toLowerCase().includes(q) ||
                           (p.period_covered || '').toLowerCase().includes(q);
                  }).map(p => (
                    <tr key={p.id}>
                      <td>
                        <strong>{String(p.payment_date).slice(0, 10)}</strong>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{String(p.created_at || '').slice(11, 16)}</div>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{p.tenant_name}</strong>
                      </td>
                      <td>
                        <span className={`plan-chip plan-chip-${(p.plan || 'starter').toLowerCase()}`}>
                          {p.plan || 'STARTER'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{p.period_covered}</span>
                      </td>
                      <td>
                        <span className="cycle-badge">{p.payment_method}</span>
                      </td>
                      <td>
                        <code style={{ fontSize: '11.5px', background: '#f1f5f9', padding: '2px 5px', borderRadius: 4 }}>
                          {p.reference || 'Sin ref'}
                        </code>
                      </td>
                      <td>
                        <strong style={{ color: '#059669', fontSize: '14px' }}>
                          ${Number(p.amount).toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        <small style={{ color: '#64748b' }}>{p.recorded_by || 'SaaS Owner'}</small>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="secondary-action"
                          onClick={() => setReceiptModal(p)}
                          style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700 }}
                        >
                          🧾 Ver Recibo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT RATE / TARIFA POR EMPRESA
          ========================================================================= */}
      {editRateModal && (
        <div className="modal-backdrop" onClick={() => setEditRateModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>🏷️ Configurar Tarifa y Facturación</h3>
                <small style={{ color: '#64748b' }}>Empresa: <strong>{editRateModal.name}</strong></small>
              </div>
              <button className="close-btn" onClick={() => setEditRateModal(null)}>✕</button>
            </div>
            <form onSubmit={submitRate}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 14, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#475569' }}>Cobro neto proyectado:</span>
                  <strong style={{ fontSize: '16px', color: '#059669' }}>
                    ${calculateNetCycle(rateForm.monthlyFee, rateForm.discountPercent, rateForm.billingCycle)} por ciclo
                  </strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Tarifa Mensual ($ USD) *</span>
                  <input
                    type="number"
                    step="0.01"
                    value={rateForm.monthlyFee}
                    onChange={e => setRateForm({ ...rateForm, monthlyFee: e.target.value })}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Plan Asignado</span>
                  <select
                    value={rateForm.plan}
                    onChange={e => setRateForm({ ...rateForm, plan: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  >
                    <option value="STARTER">Starter</option>
                    <option value="PRO">Profesional</option>
                    <option value="ENTERPRISE">Enterprise</option>
                    <option value="CUSTOM">Personalizado</option>
                  </select>
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Ciclo de Facturación</span>
                  <select
                    value={rateForm.billingCycle}
                    onChange={e => setRateForm({ ...rateForm, billingCycle: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  >
                    <option value="MONTHLY">Mensual (1 mes)</option>
                    <option value="QUARTERLY">Trimestral (3 meses)</option>
                    <option value="SEMIANNUAL">Semestral (6 meses)</option>
                    <option value="ANNUAL">Anual (12 meses)</option>
                  </select>
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Descuento Acordado (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={rateForm.discountPercent}
                    onChange={e => setRateForm({ ...rateForm, discountPercent: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Próxima Fecha de Cobro</span>
                  <input
                    type="date"
                    value={rateForm.nextBillingDate}
                    onChange={e => setRateForm({ ...rateForm, nextBillingDate: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginBottom: 10 }}>
                <small style={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Contacto de Pagos / Cobranza</small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Nombre Contacto Cobranzas</span>
                  <input
                    placeholder="Ej: Ing. Marco Pazmiño"
                    value={rateForm.billingContactName}
                    onChange={e => setRateForm({ ...rateForm, billingContactName: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Teléfono Cobranzas</span>
                  <input
                    placeholder="0991234567"
                    value={rateForm.billingContactPhone}
                    onChange={e => setRateForm({ ...rateForm, billingContactPhone: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Email Cobranzas</span>
                  <input
                    type="email"
                    placeholder="contabilidad@tienda.com"
                    value={rateForm.billingContactEmail}
                    onChange={e => setRateForm({ ...rateForm, billingContactEmail: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
              </div>

              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Notas Administrativas / Condiciones del Acuerdo</span>
                <input
                  placeholder="Ej: Precio especial pactado por pago semestral anticipado..."
                  value={rateForm.adminNotes}
                  onChange={e => setRateForm({ ...rateForm, adminNotes: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="secondary-action" onClick={() => setEditRateModal(null)}>Cancelar</button>
                <button type="submit" className="primary-action" disabled={savingRate}>
                  {savingRate ? 'Guardando...' : 'Guardar Tarifa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RECORD MONTHLY PAYMENT
          ========================================================================= */}
      {payModal && (
        <div className="modal-backdrop" onClick={() => setPayModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>💵 Registrar Cobro de Mensualidad</h3>
              <button className="close-btn" onClick={() => setPayModal(null)}>✕</button>
            </div>
            <form onSubmit={submitPayment}>
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 14 }}>
                <strong>Tienda: {payModal.name}</strong>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Plan {payModal.plan} · Tarifa mensual: ${Number(payModal.monthly_fee || 49).toFixed(2)}
                  {Number(payModal.discount_percent || 0) > 0 && ` (-${payModal.discount_percent}%)`}
                </div>
              </div>

              <label style={{ display: 'block', marginBottom: 10 }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Monto Cobrado ($ USD) *</span>
                <input
                  type="number"
                  step="0.01"
                  value={payForm.amount}
                  onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                  required
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 10 }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Período que Cancela *</span>
                <input
                  type="text"
                  placeholder="Ej: Septiembre 2026"
                  value={payForm.periodCovered}
                  onChange={e => setPayForm({ ...payForm, periodCovered: e.target.value })}
                  required
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 10 }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Método de Pago *</span>
                <select
                  value={payForm.paymentMethod}
                  onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                >
                  <option value="TRANSFER">Transferencia Banco Pichincha / Guayaquil</option>
                  <option value="DEUNA">Deuna / PayPhone</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta de Crédito / Débito</option>
                  <option value="DEPOSIT">Depósito en ventanilla</option>
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: 10 }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Comprobante / Número de Referencia</span>
                <input
                  type="text"
                  placeholder="Ej: TRANSF-839210"
                  value={payForm.reference}
                  onChange={e => setPayForm({ ...payForm, reference: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Notas Privadas del Cobro</span>
                <input
                  type="text"
                  placeholder="Observaciones de pago..."
                  value={payForm.notes}
                  onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </label>

              <small style={{ display: 'block', color: '#059669', marginBottom: 14, fontSize: '11.5px' }}>
                ✓ Al registrar el pago, la tienda se activa de inmediato y el próximo vencimiento se extiende según su ciclo de facturación.
              </small>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="secondary-action" onClick={() => setPayModal(null)}>Cancelar</button>
                <button type="submit" className="primary-action" disabled={paying}>
                  {paying ? 'Guardando...' : 'Confirmar Cobro y Generar Recibo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: OFFICIAL SAAS RECEIPT
          ========================================================================= */}
      {receiptModal && (
        <div className="modal-backdrop" onClick={() => setReceiptModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h3>🧾 Comprobante Oficial de Suscripción SaaS</h3>
              <button className="close-btn" onClick={() => setReceiptModal(null)}>✕</button>
            </div>

            <div className="saas-receipt-container">
              <div className="saas-receipt-stamp">PAGADO</div>
              <div className="saas-receipt-header">
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
                  FixmeTiendas SaaS Platform
                </div>
                <h2 className="saas-receipt-title">RECIBO DE MENSUALIDAD</h2>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Comprobante N°: <strong>{String(receiptModal.id).slice(0, 13).toUpperCase()}</strong>
                </div>
              </div>

              <div className="saas-receipt-row">
                <span style={{ color: '#64748b' }}>Empresa Cliente:</span>
                <strong>{receiptModal.tenant_name || 'Tienda Afiliada'}</strong>
              </div>
              <div className="saas-receipt-row">
                <span style={{ color: '#64748b' }}>Plan Contratado:</span>
                <span>Plan {receiptModal.plan || 'STARTER'}</span>
              </div>
              <div className="saas-receipt-row">
                <span style={{ color: '#64748b' }}>Período Cubierto:</span>
                <strong>{receiptModal.period_covered}</strong>
              </div>
              <div className="saas-receipt-row">
                <span style={{ color: '#64748b' }}>Fecha de Emisión:</span>
                <span>{String(receiptModal.payment_date || new Date().toISOString()).slice(0, 10)}</span>
              </div>
              <div className="saas-receipt-row">
                <span style={{ color: '#64748b' }}>Forma de Pago:</span>
                <span>{receiptModal.payment_method}</span>
              </div>
              <div className="saas-receipt-row">
                <span style={{ color: '#64748b' }}>Referencia / Banco:</span>
                <code>{receiptModal.reference || 'N/A'}</code>
              </div>

              <div className="saas-receipt-total">
                <span>TOTAL RECIBIDO:</span>
                <span style={{ color: '#059669' }}>${Number(receiptModal.amount).toFixed(2)} USD</span>
              </div>

              <div className="saas-receipt-footer">
                Este recibo confirma la recepción formal del pago por los servicios de la plataforma FixmeTiendas.
                <br />Suscripción activa y acceso al sistema garantizado.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="secondary-action"
                onClick={() => window.print()}
              >
                🖨️ Imprimir / Guardar PDF
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => setReceiptModal(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE NEW COMPANY
          ========================================================================= */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>＋ Crear Nueva Empresa / Tienda</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTenant}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Nombre Comercial de la Empresa *</span>
                  <input
                    placeholder="Ej: Fixme Tech Samborondón"
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Plan de Suscripción</span>
                  <select
                    value={createForm.plan}
                    onChange={e => {
                      const p = e.target.value;
                      const fee = p === 'ENTERPRISE' ? '99.00' : p === 'PRO' ? '59.00' : '49.00';
                      setCreateForm({ ...createForm, plan: p, monthlyFee: fee });
                    }}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  >
                    <option value="STARTER">Starter ($49/mes)</option>
                    <option value="PRO">Profesional ($59/mes)</option>
                    <option value="ENTERPRISE">Enterprise ($99/mes)</option>
                  </select>
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Tarifa Mensual ($ USD) *</span>
                  <input
                    type="number"
                    step="0.01"
                    value={createForm.monthlyFee}
                    onChange={e => setCreateForm({ ...createForm, monthlyFee: e.target.value })}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Ciclo de Facturación</span>
                  <select
                    value={createForm.billingCycle}
                    onChange={e => setCreateForm({ ...createForm, billingCycle: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  >
                    <option value="MONTHLY">Mensual</option>
                    <option value="QUARTERLY">Trimestral</option>
                    <option value="SEMIANNUAL">Semestral</option>
                    <option value="ANNUAL">Anual</option>
                  </select>
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Descuento Inicial (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={createForm.discountPercent}
                    onChange={e => setCreateForm({ ...createForm, discountPercent: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginBottom: 10 }}>
                <small style={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Datos del Gerente / Manager Inicial</small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Nombres y Apellidos del Gerente *</span>
                  <input
                    placeholder="Ej: Roberto Mendoza"
                    value={createForm.ownerName}
                    onChange={e => setCreateForm({ ...createForm, ownerName: e.target.value })}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Correo Electrónico (Login) *</span>
                  <input
                    type="email"
                    placeholder="manager@tienda.com"
                    value={createForm.ownerEmail}
                    onChange={e => setCreateForm({ ...createForm, ownerEmail: e.target.value })}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Teléfono / WhatsApp</span>
                  <input
                    placeholder="0991234567"
                    value={createForm.phone}
                    onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Contraseña Inicial (mínimo 8 caracteres) *</span>
                  <input
                    type="password"
                    value={createForm.ownerPassword}
                    onChange={e => setCreateForm({ ...createForm, ownerPassword: e.target.value })}
                    minLength={8}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </label>
              </div>

              {createMsg && <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: 10 }}>{createMsg}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="secondary-action" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="primary-action" disabled={creating}>
                  {creating ? 'Creando Empresa...' : '＋ Registrar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: COMPANY AUDIT & DETAILS
          ========================================================================= */}
      {selectedTenant && (
        <div className="modal-backdrop" onClick={() => setSelectedTenant(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>🏢 {selectedTenant.name}</h3>
                <small style={{ color: '#64748b' }}>
                  Plan {selectedTenant.plan} · Tarifa: ${Number(selectedTenant.monthly_fee || 49).toFixed(2)}/mes
                </small>
              </div>
              <button className="close-btn" onClick={() => setSelectedTenant(null)}>✕</button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 8, marginBottom: 14 }}>
              <button
                className={detailTab === 'payments' ? 'btn-filter active' : 'btn-filter'}
                onClick={() => setDetailTab('payments')}
                style={{ padding: '4px 10px', fontSize: '12px', borderRadius: 6, cursor: 'pointer' }}
              >
                💵 Historial de Mensualidades ({tenantPayments.length})
              </button>
              <button
                className={detailTab === 'users' ? 'btn-filter active' : 'btn-filter'}
                onClick={() => setDetailTab('users')}
                style={{ padding: '4px 10px', fontSize: '12px', borderRadius: 6, cursor: 'pointer' }}
              >
                👥 Usuarios ({users.length})
              </button>
              <button
                className={detailTab === 'overview' ? 'btn-filter active' : 'btn-filter'}
                onClick={() => setDetailTab('overview')}
                style={{ padding: '4px 10px', fontSize: '12px', borderRadius: 6, cursor: 'pointer' }}
              >
                📊 Métricas Operativas
              </button>
            </div>

            {/* TAB: Payments History */}
            {detailTab === 'payments' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '12.5px', color: '#475569' }}>Recibos registrados para esta tienda:</span>
                  <button className="btn-action-pay" onClick={() => openRecordPayment(selectedTenant)} style={{ fontSize: '11px', padding: '4px 8px' }}>
                    ＋ Registrar Cobro
                  </button>
                </div>
                {tenantPayments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#64748b', fontSize: '12px' }}>
                    No hay pagos registrados para esta empresa.
                  </div>
                ) : (
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Fecha</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Período</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Método</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Comprobante</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenantPayments.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px 8px' }}>{String(p.payment_date).slice(0, 10)}</td>
                            <td style={{ padding: '6px 8px' }}><strong>{p.period_covered}</strong></td>
                            <td style={{ padding: '6px 8px' }}>{p.payment_method}</td>
                            <td style={{ padding: '6px 8px', color: '#64748b' }}>{p.reference || '-'}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                              ${Number(p.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Users */}
            {detailTab === 'users' && (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Nombre</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Correo</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 8px' }}>{u.full_name || u.email}</td>
                        <td style={{ padding: '6px 8px' }}>{u.email}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <span style={{ padding: '2px 6px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>
                            {u.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB: Overview */}
            {detailTab === 'overview' && (
              <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="summary-card">
                  <small>Usuarios Registrados</small>
                  <strong>{overview.users || 0}</strong>
                </div>
                <div className="summary-card">
                  <small>Productos en Inventario</small>
                  <strong>{overview.products || 0}</strong>
                </div>
                <div className="summary-card">
                  <small>Clientes en Cartera</small>
                  <strong>{overview.customers || 0}</strong>
                </div>
                <div className="summary-card">
                  <small>Órdenes de Servicio</small>
                  <strong>{overview.orders || 0}</strong>
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="secondary-action" onClick={() => setSelectedTenant(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Administration({api, notify}:{api:(u:string,o?:RequestInit)=>Promise<Response>, notify?:(s:string)=>void}){
  const [tab, setTab] = React.useState<'matrix'|'users'|'profile'|'sri'>('matrix');
  const [profile, setProfile] = React.useState<Any>({});
  const [users, setUsers] = React.useState<Any[]>([]);
  const [rolePerms, setRolePerms] = React.useState<Record<string, string[]>>({});
  const [savingMatrix, setSavingMatrix] = React.useState(false);

  // SRI Configuration state
  const [sriConfig, setSriConfig] = React.useState<Any>({
    ruc: '1790012345001',
    razonSocial: 'FixmeTiendas S.A.S.',
    nombreComercial: 'FixmeTiendas',
    direccionMatriz: 'Matriz Central, Quito',
    direccionEstablecimiento: 'Matriz Central, Quito',
    codigoEstablecimiento: '001',
    codigoPuntoEmision: '001',
    obligadoContabilidad: false,
    regimenTributario: 'RIMPE_EMPRENDEDOR',
    ambienteSri: 1,
    secuencialFactura: 1,
    certificadoP12Base64: '',
    certificadoP12Password: '',
    certificadoNombreArchivo: '',
    hasCertificate: false
  });
  const [loadingSri, setLoadingSri] = React.useState(false);
  const [savingSri, setSavingSri] = React.useState(false);

  const loadSri = React.useCallback(() => {
    setLoadingSri(true);
    api('/api/sri/config')
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (cfg) setSriConfig((prev: Any) => ({ ...prev, ...cfg }));
      })
      .finally(() => setLoadingSri(false));
  }, [api]);

  function handleP12File(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setSriConfig((prev: Any) => ({
        ...prev,
        certificadoP12Base64: base64,
        certificadoNombreArchivo: file.name
      }));
      notify?.(`Firma electrónica ${file.name} cargada.`);
    };
    reader.readAsDataURL(file);
  }

  async function saveSriConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingSri(true);
    try {
      const res = await api('/api/sri/config', {
        method: 'POST',
        body: JSON.stringify(sriConfig)
      });
      if (res.ok) {
        const updated = await res.json();
        setSriConfig(updated);
        notify?.('✓ Configuración del SRI guardada exitosamente');
      } else {
        const err = await res.text();
        notify?.(`Error al guardar configuración SRI: ${err}`);
      }
    } catch (e: any) {
      notify?.(`Error de conexión: ${e.message}`);
    } finally {
      setSavingSri(false);
    }
  }
  const [userPermModal, setUserPermModal] = React.useState<Any|null>(null);
  const [selectedPerms, setSelectedPerms] = React.useState<string[]>([]);
  const [isCustomPerms, setIsCustomPerms] = React.useState(false);
  const [savingUserPerms, setSavingUserPerms] = React.useState(false);

  // New user form state
  const [showCreateUser, setShowCreateUser] = React.useState(false);
  const [form, setForm] = React.useState<Any>({
    email: '', password: 'password123', role: 'TECHNICIAN',
    fullName: '', identification: '', address: '', phone: ''
  });
  const [userMsg, setUserMsg] = React.useState('');

  const MODULES = [
    { key: 'home', label: 'Resumen (Dashboard)', group: 'Principal', desc: 'Vista global y métricas' },
    { key: 'my-work', label: 'Mi Trabajo Asignado', group: 'Taller', desc: 'Órdenes de servicio asignadas al técnico con SLA' },
    { key: 'work-orders', label: 'Órdenes de Servicio', group: 'Taller', desc: 'Ingreso de equipos, presupuestos y entregas' },
    { key: 'warranties', label: 'Garantías', group: 'Taller', desc: 'Validación y gestión de tickets de garantía' },
    { key: 'pos', label: 'Punto de Venta (POS)', group: 'Ventas', desc: 'Facturación directa, tickets y ventas' },
    { key: 'sales', label: 'Registro de Ventas', group: 'Ventas', desc: 'Historial de transacciones y comprobantes' },
    { key: 'cash', label: 'Control de Caja', group: 'Ventas', desc: 'Apertura de caja, movimientos y arqueos' },
    { key: 'deliveries', label: 'Entregas a Domicilio', group: 'Ventas', desc: 'Despachos con motorizados y apps' },
    { key: 'products', label: 'Inventario de Productos', group: 'Inventario', desc: 'Catálogo de existencias y alertas de stock' },
    { key: 'customers', label: 'Gestión de Clientes', group: 'Operación', desc: 'Ficha de clientes y cartera comercial' },
    { key: 'reports', label: 'Reportes Financieros', group: 'Gestión', desc: 'COGS, utilidades y balance general' },
    { key: 'administration', label: 'Empresa y Permisos', group: 'Gestión', desc: 'Usuarios y matriz de roles de la empresa' }
  ];

  const ROLES = [
    { key: 'MANAGER', label: 'Manager / Administrador', icon: '👔', color: '#4f46e5' },
    { key: 'TECHNICIAN', label: 'Técnico de Taller', icon: '🛠️', color: '#d97706' },
    { key: 'SELLER', label: 'Vendedor / Asesor', icon: '🛒', color: '#2563eb' },
    { key: 'DELIVERY', label: 'Repartidor / Motorizado', icon: '🛵', color: '#059669' },
    { key: 'ACCOUNTANT', label: 'Contador / Finanzas', icon: '📊', color: '#7c3aed' }
  ];

  const load = React.useCallback(() => {
    api('/api/administration/profile').then(r => r.ok ? r.json() : {}).then(setProfile);
    api('/api/administration/users').then(r => r.ok ? r.json() : []).then(setUsers);
    api('/api/administration/role-permissions').then(r => r.ok ? r.json() : {}).then(setRolePerms);
  }, [api]);

  React.useEffect(() => {
    load();
  }, [load]);

  function toggleRolePermission(roleKey: string, permKey: string, checked: boolean) {
    setRolePerms(prev => {
      const current = prev[roleKey] || [];
      const updated = checked
        ? (current.includes(permKey) ? current : [...current, permKey])
        : current.filter(k => k !== permKey);
      return { ...prev, [roleKey]: updated };
    });
  }

  async function saveMatrix() {
    setSavingMatrix(true);
    let allOk = true;
    for (const r of ROLES) {
      const resp = await api('/api/administration/role-permissions', {
        method: 'PUT',
        body: JSON.stringify({ role: r.key, permissions: rolePerms[r.key] || [] })
      });
      if (!resp.ok) allOk = false;
    }
    setSavingMatrix(false);
    if (allOk) {
      notify?.('✓ Matriz de permisos por rol actualizada exitosamente');
      load();
    } else {
      notify?.('Hubo un error al guardar algunos roles');
    }
  }

  function grantTechPosAndCash() {
    setRolePerms(prev => {
      const current = prev['TECHNICIAN'] || ['home', 'my-work', 'work-orders', 'warranties', 'customers'];
      const needed = ['pos', 'cash', 'sales'];
      const combined = Array.from(new Set([...current, ...needed]));
      return { ...prev, TECHNICIAN: combined };
    });
    notify?.('Se añadieron Punto de Venta, Caja y Ventas al rol Técnico. Haz clic en "Guardar Matriz" para aplicar.');
  }

  function openUserPerms(u: Any) {
    const custom = u.customPermissions || u.custom_permissions;
    const isCustom = Array.isArray(custom) && custom.length > 0;
    setUserPermModal(u);
    setIsCustomPerms(isCustom);
    setSelectedPerms(isCustom ? [...custom] : (rolePerms[u.role] || []));
  }

  function toggleUserPerm(key: string, checked: boolean) {
    setSelectedPerms(prev => checked ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter(k => k !== key));
  }

  async function saveUserPerms() {
    if (!userPermModal) return;
    setSavingUserPerms(true);
    const body = isCustomPerms ? { permissions: selectedPerms } : { permissions: null };
    const r = await api(`/api/administration/users/${userPermModal.id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    setSavingUserPerms(false);
    if (r.ok) {
      notify?.('Permisos de ' + (userPermModal.fullName || userPermModal.email) + ' actualizados');
      setUserPermModal(null);
      load();
    } else {
      notify?.('Error al actualizar permisos individuales');
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const r = await api('/api/administration/users', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    if (r.ok) {
      notify?.('Usuario ' + form.email + ' registrado exitosamente');
      setForm({ email: '', password: 'password123', role: 'TECHNICIAN', fullName: '', identification: '', address: '', phone: '' });
      setShowCreateUser(false);
      load();
    } else {
      setUserMsg('No se pudo crear el usuario. Verifica que el correo no esté duplicado.');
    }
  }

  return (
    <>
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <h2>🏢 Empresa, Usuarios & Permisos</h2>
          <p>Control de roles, permisos dinámicos y personalización del equipo de trabajo.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
        <button
          onClick={() => setTab('matrix')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: tab === 'matrix' ? '1px solid #3157d5' : '1px solid #cbd5e1',
            background: tab === 'matrix' ? '#eff6ff' : '#ffffff',
            color: tab === 'matrix' ? '#1d4ed8' : '#475569',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          🛡️ Matriz de Permisos por Rol
        </button>
        <button
          onClick={() => setTab('users')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: tab === 'users' ? '1px solid #3157d5' : '1px solid #cbd5e1',
            background: tab === 'users' ? '#eff6ff' : '#ffffff',
            color: tab === 'users' ? '#1d4ed8' : '#475569',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          👥 Usuarios de la Empresa ({users.length})
        </button>
        <button
          onClick={() => setTab('profile')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: tab === 'profile' ? '1px solid #3157d5' : '1px solid #cbd5e1',
            background: tab === 'profile' ? '#eff6ff' : '#ffffff',
            color: tab === 'profile' ? '#1d4ed8' : '#475569',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          🏢 Perfil de la Empresa
        </button>
        <button
          onClick={() => { setTab('sri'); loadSri(); }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: tab === 'sri' ? '1px solid #059669' : '1px solid #cbd5e1',
            background: tab === 'sri' ? '#ecfdf5' : '#ffffff',
            color: tab === 'sri' ? '#065f46' : '#475569',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          🏛️ Facturación SRI (Ecuador)
        </button>
      </div>

      {/* TAB 1: MATRIX */}
      {tab === 'matrix' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>Matriz de Autorización por Rol</h3>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                Habilita o deshabilita módulos para cada rol. Los usuarios recibirán permisos dinámicos y acceso a la API inmediatamente.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="secondary-action"
                onClick={grantTechPosAndCash}
                style={{ fontSize: '12px' }}
              >
                ⚡ Otorgar POS + Caja al Técnico
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={savingMatrix}
                onClick={saveMatrix}
                style={{ fontSize: '12px' }}
              >
                {savingMatrix ? 'Guardando...' : '💾 Guardar Matriz de Permisos'}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="matrix-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Módulo / Sección</th>
                  {ROLES.map(r => (
                    <th key={r.key} style={{ textAlign: 'center', minWidth: 120 }}>
                      <div style={{ fontSize: '14px' }}>{r.icon}</div>
                      <div>{r.label}</div>
                      <small style={{ color: '#64748b', fontWeight: 'normal', fontSize: '11px' }}>
                        {(rolePerms[r.key] || []).length} permisos
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map(m => (
                  <tr key={m.key} className="matrix-role-row">
                    <td>
                      <strong style={{ color: '#1e293b' }}>{m.label}</strong>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{m.desc}</div>
                    </td>
                    {ROLES.map(r => {
                      const hasPerm = (rolePerms[r.key] || []).includes(m.key);
                      const isManagerAdmin = r.key === 'MANAGER' && m.key === 'administration';
                      return (
                        <td key={r.key} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            className="matrix-checkbox"
                            checked={hasPerm || isManagerAdmin}
                            disabled={isManagerAdmin}
                            onChange={e => toggleRolePermission(r.key, m.key, e.target.checked)}
                            title={`${m.label} para ${r.label}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="primary-action"
              disabled={savingMatrix}
              onClick={saveMatrix}
            >
              {savingMatrix ? 'Guardando...' : '💾 Guardar Matriz de Permisos'}
            </button>
          </div>
        </section>
      )}

      {/* TAB 2: USERS */}
      {tab === 'users' && (
        <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>Usuarios del Sistema</h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                  Administra las cuentas de tu equipo. Puedes otorgar permisos excepcionales a usuarios concretos.
                </p>
              </div>
              <button
                className="secondary-action"
                onClick={() => setShowCreateUser(!showCreateUser)}
              >
                {showCreateUser ? '✕ Cancelar' : '＋ Nuevo Usuario'}
              </button>
            </div>

            {showCreateUser && (
              <form className="form-grid" onSubmit={createUser} style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 12 }}>
                {[
                  ['fullName', 'Nombres y apellidos'],
                  ['identification', 'Cédula / Identificación'],
                  ['email', 'Correo electrónico'],
                  ['phone', 'Teléfono'],
                  ['address', 'Dirección'],
                  ['password', 'Contraseña inicial']
                ].map(([k, l]) => (
                  <label key={k}>
                    {l}
                    <input
                      value={form[k]}
                      onChange={e => setForm({ ...form, [k]: e.target.value })}
                      required={k === 'fullName' || k === 'email' || k === 'password'}
                    />
                  </label>
                ))}
                <label>
                  Rol Asignado
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    {ROLES.map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                </label>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="primary-action">Crear Usuario</button>
                  {userMsg && <small style={{ color: '#dc2626' }}>{userMsg}</small>}
                </div>
              </form>
            )}
          </section>

          <section className="panel">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Usuario</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Identificación / Teléfono</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Rol</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Configuración de Permisos</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const custom = u.customPermissions || u.custom_permissions;
                    const hasCustom = Array.isArray(custom) && custom.length > 0;
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <strong style={{ color: '#1e293b' }}>{u.fullName || u.full_name || u.email}</strong>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div>{u.identification || 'Sin cédula'}</div>
                          <small style={{ color: '#64748b' }}>{u.phone || 'Sin teléfono'}</small>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '11px',
                            fontWeight: 700,
                            background: u.role === 'MANAGER' ? '#e0e7ff' : u.role === 'TECHNICIAN' ? '#fef3c7' : '#f1f5f9',
                            color: u.role === 'MANAGER' ? '#3730a3' : u.role === 'TECHNICIAN' ? '#92400e' : '#334155'
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {hasCustom ? (
                            <span style={{ background: '#ecfdf5', color: '#065f46', padding: '2px 8px', borderRadius: 6, fontSize: '11.5px', fontWeight: 600 }}>
                              ✓ Personalizado ({custom.length} módulos)
                            </span>
                          ) : (
                            <span style={{ background: '#f8fafc', color: '#64748b', padding: '2px 8px', borderRadius: 6, fontSize: '11.5px' }}>
                              Hereda de rol ({u.role})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            className="tech-action-btn tech-action-diag"
                            onClick={() => openUserPerms(u)}
                            style={{ fontSize: '11.5px' }}
                          >
                            ⚙ Personalizar Permisos
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* TAB 3: PROFILE */}
      {tab === 'profile' && (
        <section className="panel">
          <h3>Perfil de la Empresa y Estado de Suscripción</h3>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginTop: 12 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
              <b>{profile.legal_name || profile.name || 'Fixme Store'}</b>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: '13px', color: '#475569', marginBottom: 14 }}>
              <div>Tipo de Negocio: <strong>{profile.business_type || 'RETAIL'}</strong></div>
              <div>Plan Contratado: <strong>{profile.plan || 'STARTER'}</strong></div>
              <div>Teléfono: <strong>{profile.phone || 'No registrado'}</strong></div>
              <div>Estado de tienda: <strong style={{ color: profile.subscription_status === 'SUSPENDED' ? '#dc2626' : '#059669' }}>{profile.subscription_status || 'ACTIVA'}</strong></div>
            </div>

            <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Mensualidad del Sistema</small>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  ${Number(profile.monthly_fee || 49).toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>/ mes</span>
                </div>
              </div>
              <div>
                <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Próximo Vencimiento</small>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  {profile.next_billing_date ? String(profile.next_billing_date).slice(0, 10) : 'Al día'}
                </div>
              </div>
              <div>
                <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Estado de Pago</small>
                <div>
                  <span className={profile.subscription_status === 'SUSPENDED' ? 'billing-badge billing-badge-suspended' : 'billing-badge billing-badge-ok'}>
                    {profile.subscription_status === 'SUSPENDED' ? '🚫 Suspendida por mora' : '🟢 Al día'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: SRI ECUADOR */}
      {tab === 'sri' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>🏛️ Facturación Electrónica Oficial (SRI Ecuador)</h3>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                Emisión de comprobantes tributarios válidos ante el SRI con firma digital PKCS#12 (.p12) y autorización SOAP en línea.
              </p>
            </div>
            <button
              type="button"
              className="secondary-action"
              onClick={loadSri}
              disabled={loadingSri}
              style={{ fontSize: '12px' }}
            >
              {loadingSri ? 'Cargando...' : '🔄 Actualizar Datos SRI'}
            </button>
          </div>

          <form onSubmit={saveSriConfig} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', fontSize: '12.5px', color: '#166534' }}>
              <strong>⚖️ Normativa Tributaria Vigente:</strong> Facturación electrónica esquema XML v1.1.0, cálculo automático de <b>IVA 15%</b> (código SRI 4), clave de acceso de 49 dígitos generada con algoritmo oficial <b>Módulo 11</b> y soporte de firma digital <b>XAdES-BES</b>.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* BLOQUE 1: DATOS FISCALES */}
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>
                  🏢 Datos Tributarios del Emisor
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    RUC (13 dígitos)
                    <input
                      value={sriConfig.ruc || ''}
                      onChange={e => setSriConfig({ ...sriConfig, ruc: e.target.value })}
                      placeholder="1790012345001"
                      required
                      pattern="[0-9]{13}"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Razón Social (Según RUC)
                    <input
                      value={sriConfig.razonSocial || ''}
                      onChange={e => setSriConfig({ ...sriConfig, razonSocial: e.target.value })}
                      placeholder="Nombre de la empresa o persona natural"
                      required
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Nombre Comercial (Rótulo)
                    <input
                      value={sriConfig.nombreComercial || ''}
                      onChange={e => setSriConfig({ ...sriConfig, nombreComercial: e.target.value })}
                      placeholder="FixmeTiendas"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Dirección Matriz
                    <input
                      value={sriConfig.direccionMatriz || ''}
                      onChange={e => setSriConfig({ ...sriConfig, direccionMatriz: e.target.value })}
                      placeholder="Dirección fiscal matriz"
                      required
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Dirección Sucursal / Establecimiento
                    <input
                      value={sriConfig.direccionEstablecimiento || ''}
                      onChange={e => setSriConfig({ ...sriConfig, direccionEstablecimiento: e.target.value })}
                      placeholder="Dirección donde opera este punto de venta"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>
                      Establecimiento
                      <input
                        value={sriConfig.codigoEstablecimiento || '001'}
                        onChange={e => setSriConfig({ ...sriConfig, codigoEstablecimiento: e.target.value })}
                        placeholder="001"
                        maxLength={3}
                        required
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4, fontFamily: 'monospace' }}
                      />
                    </label>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>
                      Punto Emisión
                      <input
                        value={sriConfig.codigoPuntoEmision || '001'}
                        onChange={e => setSriConfig({ ...sriConfig, codigoPuntoEmision: e.target.value })}
                        placeholder="001"
                        maxLength={3}
                        required
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4, fontFamily: 'monospace' }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>
                      Régimen Tributario
                      <select
                        value={sriConfig.regimenTributario || 'RIMPE_EMPRENDEDOR'}
                        onChange={e => setSriConfig({ ...sriConfig, regimenTributario: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                      >
                        <option value="RIMPE_EMPRENDEDOR">CONTRIBUYENTE RÉGIMEN RIMPE EMPRENDEDOR</option>
                        <option value="RIMPE_NEGOCIO_POPULAR">CONTRIBUYENTE RÉGIMEN RIMPE NEGOCIO POPULAR</option>
                        <option value="GENERAL">RÉGIMEN GENERAL</option>
                        <option value="OTRO">OTRO / DESIGNADO</option>
                      </select>
                    </label>

                    <label style={{ fontSize: '12px', fontWeight: 600 }}>
                      Secuencial Siguiente
                      <input
                        type="number"
                        min={1}
                        value={sriConfig.secuencialFactura || 1}
                        onChange={e => setSriConfig({ ...sriConfig, secuencialFactura: Number(e.target.value) })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4, fontFamily: 'monospace' }}
                      />
                    </label>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '12.5px', marginTop: 4 }}>
                    <input
                      type="checkbox"
                      checked={!!sriConfig.obligadoContabilidad}
                      onChange={e => setSriConfig({ ...sriConfig, obligadoContabilidad: e.target.checked })}
                    />
                    <strong>Obligado a llevar contabilidad</strong>
                  </label>
                </div>
              </div>

              {/* BLOQUE 2: AMBIENTE Y FIRMA DIGITAL */}
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>
                  🔐 Ambiente y Firma Electrónica (.p12)
                </h4>

                <label style={{ fontSize: '12px', fontWeight: 600 }}>
                  Ambiente SRI
                  <select
                    value={sriConfig.ambienteSri || 1}
                    onChange={e => setSriConfig({ ...sriConfig, ambienteSri: Number(e.target.value) })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                  >
                    <option value={1}>1 - PRUEBAS / CERTIFICACIÓN (celcer.sri.gob.ec)</option>
                    <option value={2}>2 - PRODUCCIÓN OFICIAL (cel.sri.gob.ec)</option>
                  </select>
                  <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: 2 }}>
                    Para pruebas se simula o conecta al entorno de pruebas del SRI sin valor legal vinculante.
                  </small>
                </label>

                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: 12 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Archivo de Firma Digital (.p12 / .pfx)
                  </label>
                  <input
                    type="file"
                    accept=".p12,.pfx"
                    onChange={handleP12File}
                    style={{ fontSize: '12px', width: '100%' }}
                  />
                  {sriConfig.hasCertificate ? (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 10px', borderRadius: 6, marginTop: 8, fontSize: '11px', color: '#065f46' }}>
                      ✅ Firma digital activa: <b>{sriConfig.certificadoNombreArchivo || 'firma_electronica.p12'}</b>
                    </div>
                  ) : (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '6px 10px', borderRadius: 6, marginTop: 8, fontSize: '11px', color: '#92400e' }}>
                      ⚠️ No se ha subido archivo .p12 (o se usará simulador de firma para pruebas).
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Contraseña de la Firma Electrónica
                    <input
                      type="password"
                      value={sriConfig.certificadoP12Password || ''}
                      onChange={e => setSriConfig({ ...sriConfig, certificadoP12Password: e.target.value })}
                      placeholder="••••••••••••"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                    />
                  </label>
                  <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: 2 }}>
                    La contraseña se almacena de forma segura para firmar los comprobantes XML en el servidor.
                  </small>
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 12px', fontSize: '11.5px', color: '#1e3a8a', marginTop: 'auto' }}>
                  💡 <b>Emisión Dual:</b> Recuerda que en el Punto de Venta (POS) puedes elegir entre <b>🧾 Ticket Interno</b> (sin declarar IVA) o <b>🏛️ Factura SRI</b> según solicite el cliente.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                type="submit"
                className="primary-action"
                disabled={savingSri}
                style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 700 }}
              >
                {savingSri ? 'Guardando...' : '💾 Guardar Configuración SRI'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Modal for Individual User Permissions */}
      {userPermModal && (
        <div className="modal-backdrop" onClick={() => setUserPermModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>⚙ Permisos de {userPermModal.fullName || userPermModal.email}</h3>
              <button className="close-btn" onClick={() => setUserPermModal(null)}>✕</button>
            </div>
            <div>
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 14, fontSize: '12.5px' }}>
                Rol actual: <strong>{userPermModal.role}</strong> · Correo: <strong>{userPermModal.email}</strong>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    className="matrix-checkbox"
                    checked={isCustomPerms}
                    onChange={e => {
                      setIsCustomPerms(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedPerms(rolePerms[userPermModal.role] || []);
                      }
                    }}
                  />
                  Activar permisos personalizados exclusivos para este usuario
                </label>
                <small style={{ display: 'block', color: '#64748b', marginTop: 4, marginLeft: 26, fontSize: '12px' }}>
                  {isCustomPerms
                    ? 'Este usuario tendrá su propia lista de permisos independientes de su rol.'
                    : 'Si esta opción está desactivada, el usuario hereda automáticamente cualquier cambio que hagas en la matriz de su rol.'}
                </small>
              </div>

              {isCustomPerms && (
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 16 }}>
                  {MODULES.map(m => (
                    <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '12.5px' }}>
                      <input
                        type="checkbox"
                        className="matrix-checkbox"
                        checked={selectedPerms.includes(m.key)}
                        onChange={e => toggleUserPerm(m.key, e.target.checked)}
                      />
                      <div>
                        <strong>{m.label}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{m.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="secondary-action" onClick={() => setUserPermModal(null)}>Cancelar</button>
                <button
                  type="button"
                  className="primary-action"
                  disabled={savingUserPerms}
                  onClick={saveUserPerms}
                >
                  {savingUserPerms ? 'Guardando...' : 'Guardar Permisos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MyWork({api, notify, go}:{api:(u:string,o?:RequestInit)=>Promise<Response>, notify?:(s:string)=>void, go?:(p:string)=>void}){
  const [orders, setOrders] = React.useState<Any[]>([]);
  const [stats, setStats] = React.useState<Any>({ total: 0, active: 0, in_repair: 0, waiting_parts: 0, ready: 0, completed: 0, urgent_sla: 0 });
  const [filter, setFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'KANBAN' | 'TABLE' | 'CARDS'>('KANBAN');
  const [loading, setLoading] = React.useState(true);
  const [workbenchOrder, setWorkbenchOrder] = React.useState<Any|null>(null);
  const [receiptOrder, setReceiptOrder] = React.useState<Any|null>(null);
  const [updating, setUpdating] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      api('/api/work-orders/my-work').then(r => r.ok ? r.json() : []),
      api('/api/work-orders/my-work/stats').then(r => r.ok ? r.json() : {})
    ]).then(([ordersData, statsData]) => {
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setStats(statsData || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(orderId: string, newStatus: string, defaultNote?: string) {
    setUpdating(true);
    const r = await api(`/api/work-orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, technicianNotes: defaultNote || '' })
    });
    setUpdating(false);
    if (r.ok) {
      notify?.('✓ Estado de la orden actualizado a ' + newStatus);
      load();
    } else {
      notify?.('No se pudo actualizar el estado');
    }
  }

  function getSlaBadge(o: Any) {
    if (o.status === 'COMPLETED' || o.status === 'ENTREGADO' || o.status === 'LISTO_ENTREGA') {
      return <span className="sla-badge sla-badge-ok">✓ Culminado</span>;
    }
    const deadline = o.sla_deadline || o.estimated_delivery;
    if (!deadline) {
      return <span className="sla-badge sla-badge-ok">⏱ Meta {o.sla_hours || 48}h</span>;
    }
    const diffMs = new Date(deadline).getTime() - Date.now();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 0) {
      const passed = Math.abs(Math.round(diffHours));
      return <span className="sla-badge sla-badge-overdue">🚨 Vencido hace {passed}h</span>;
    }
    if (diffHours <= 12) {
      const leftH = Math.floor(diffHours);
      const leftM = Math.round((diffHours - leftH) * 60);
      return <span className="sla-badge sla-badge-warning">⚠️ Urgente: {leftH}h {leftM}m</span>;
    }
    const leftDays = Math.floor(diffHours / 24);
    const leftH = Math.round(diffHours % 24);
    return <span className="sla-badge sla-badge-ok">⏱ {leftDays > 0 ? `${leftDays}d ` : ''}{leftH}h</span>;
  }

  function getStatusBadge(st: string) {
    const isRepair = ['EN_REPARACION', 'IN_PROGRESS', 'APPROVED'].includes(st);
    const isWaiting = ['ESPERANDO_REPUESTOS', 'WAITING_PARTS'].includes(st);
    const isReady = ['LISTO_ENTREGA', 'COMPLETED'].includes(st);
    const isDelivered = ['ENTREGADO', 'DELIVERED'].includes(st);

    const bg = isRepair ? '#dbeafe' : isWaiting ? '#fef3c7' : isReady ? '#d1fae5' : isDelivered ? '#e0e7ff' : '#f1f5f9';
    const fg = isRepair ? '#1e40af' : isWaiting ? '#92400e' : isReady ? '#065f46' : isDelivered ? '#3730a3' : '#475569';
    const label = st === 'EN_REPARACION' ? 'En Reparación' :
                  st === 'ESPERANDO_REPUESTOS' ? 'Esperando Repuestos' :
                  st === 'LISTO_ENTREGA' ? 'Listo para Entrega' :
                  st === 'ENTREGADO' ? 'Entregado' :
                  st === 'RECIBIDO' ? 'Recibido' :
                  st === 'EN_DIAGNOSTICO' ? 'En Diagnóstico' : st;

    return (
      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: bg, color: fg }}>
        {label}
      </span>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (filter !== 'ALL') {
      if (filter === 'ACTIVE') {
        if (!['RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REPUESTOS', 'OPEN', 'DIAGNOSIS', 'APPROVED', 'IN_PROGRESS'].includes(o.status)) return false;
      } else if (filter === 'IN_REPAIR') {
        if (!['EN_REPARACION', 'IN_PROGRESS', 'APPROVED'].includes(o.status)) return false;
      } else if (filter === 'WAITING_PARTS') {
        if (!['ESPERANDO_REPUESTOS', 'WAITING_PARTS'].includes(o.status)) return false;
      } else if (filter === 'READY') {
        if (!['LISTO_ENTREGA', 'COMPLETED'].includes(o.status)) return false;
      } else if (filter === 'URGENT') {
        const deadline = o.sla_deadline || o.estimated_delivery;
        if (!deadline) return false;
        const diffHours = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
        if (diffHours > 12) return false;
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = (o.order_number || '').toLowerCase().includes(q) ||
                    (o.device_brand || '').toLowerCase().includes(q) ||
                    (o.device_model || '').toLowerCase().includes(q) ||
                    (o.serial_number || '').toLowerCase().includes(q) ||
                    (o.customer_name || '').toLowerCase().includes(q) ||
                    (o.reported_fault || '').toLowerCase().includes(q) ||
                    (o.diagnosis || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const kanbanColumns = [
    {
      id: 'COL_DIAG',
      title: '🔍 Por Diagnosticar',
      statuses: ['OPEN', 'RECIBIDO', 'EN_DIAGNOSTICO', 'DIAGNOSIS', 'QUOTED'],
      borderColor: '#94a3b8'
    },
    {
      id: 'COL_REPAIR',
      title: '⚙️ En Reparación',
      statuses: ['EN_REPARACION', 'IN_PROGRESS', 'APPROVED'],
      borderColor: '#2563eb'
    },
    {
      id: 'COL_PARTS',
      title: '⏳ Esperando Repuestos',
      statuses: ['ESPERANDO_REPUESTOS', 'WAITING_PARTS'],
      borderColor: '#d97706'
    },
    {
      id: 'COL_READY',
      title: '✅ Listo para Entrega',
      statuses: ['LISTO_ENTREGA', 'COMPLETED'],
      borderColor: '#059669'
    },
    {
      id: 'COL_DELIVERED',
      title: '🤝 Entregado al Cliente',
      statuses: ['ENTREGADO', 'DELIVERED'],
      borderColor: '#64748b'
    }
  ];

  return (
    <>
      {/* Header Section */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <h2>🛠️ Mi Trabajo y Taller Personal</h2>
          <p>Banco técnico de órdenes asignadas. Administra diagnósticos, notas de avance, repuestos del inventario y mano de obra con cálculo en tiempo real.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* View Mode Switcher */}
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === 'KANBAN' ? 'active' : ''}`}
              onClick={() => setViewMode('KANBAN')}
              title="Vista Tablero Kanban"
            >
              📊 Tablero
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'TABLE' ? 'active' : ''}`}
              onClick={() => setViewMode('TABLE')}
              title="Vista Tabla Compacta (Para alto volumen)"
            >
              📋 Tabla
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'CARDS' ? 'active' : ''}`}
              onClick={() => setViewMode('CARDS')}
              title="Vista Cuadrícula de Tarjetas"
            >
              🗂️ Tarjetas
            </button>
          </div>
          <button className="secondary-action" onClick={load} title="Recargar órdenes">🔄 Refrescar</button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="summary-grid" style={{ marginBottom: 18 }}>
        <div
          className="summary-card"
          onClick={() => setFilter('ALL')}
          style={{ cursor: 'pointer', borderLeft: filter === 'ALL' ? '4px solid #3157d5' : undefined }}
        >
          <small>Total Asignadas</small>
          <strong>{stats.total || orders.length}</strong>
          <span>Todas mis órdenes activas</span>
        </div>
        <div
          className="summary-card"
          onClick={() => setFilter('IN_REPAIR')}
          style={{ cursor: 'pointer', borderLeft: filter === 'IN_REPAIR' ? '4px solid #2563eb' : undefined }}
        >
          <small>En Reparación</small>
          <strong style={{ color: '#2563eb' }}>{stats.in_repair || 0}</strong>
          <span>En mi banco de trabajo</span>
        </div>
        <div
          className="summary-card"
          onClick={() => setFilter('WAITING_PARTS')}
          style={{ cursor: 'pointer', borderLeft: filter === 'WAITING_PARTS' ? '4px solid #d97706' : undefined }}
        >
          <small>Esperando Repuestos</small>
          <strong style={{ color: '#d97706' }}>{stats.waiting_parts || 0}</strong>
          <span>Piezas pendientes</span>
        </div>
        <div
          className="summary-card"
          onClick={() => setFilter('READY')}
          style={{ cursor: 'pointer', borderLeft: filter === 'READY' ? '4px solid #059669' : undefined }}
        >
          <small>Listos para Entrega</small>
          <strong style={{ color: '#059669' }}>{stats.ready || 0}</strong>
          <span>Trabajo finalizado</span>
        </div>
        <div
          className="summary-card"
          onClick={() => setFilter('URGENT')}
          style={{
            cursor: 'pointer',
            borderLeft: filter === 'URGENT' ? '4px solid #dc2626' : undefined,
            background: Number(stats.urgent_sla || 0) > 0 ? '#fef2f2' : undefined,
            borderColor: Number(stats.urgent_sla || 0) > 0 ? '#fca5a5' : undefined
          }}
        >
          <small style={{ color: Number(stats.urgent_sla || 0) > 0 ? '#dc2626' : undefined }}>SLA Crítico (&lt;12h)</small>
          <strong style={{ color: Number(stats.urgent_sla || 0) > 0 ? '#dc2626' : '#64748b' }}>{stats.urgent_sla || 0}</strong>
          <span>Prioridad inmediata</span>
        </div>
      </div>

      {/* Filter Tabs & Search Toolbar */}
      <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="filter-group" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            ['ALL', `Todas (${orders.length})`],
            ['ACTIVE', `Activas (${stats.active || 0})`],
            ['IN_REPAIR', `En Reparación (${stats.in_repair || 0})`],
            ['WAITING_PARTS', `Esperando Repuestos (${stats.waiting_parts || 0})`],
            ['READY', `Listas para Entrega (${stats.ready || 0})`],
            ['URGENT', `SLA Crítico (${stats.urgent_sla || 0})`]
          ].map(([k, label]) => (
            <button
              key={k}
              className={filter === k ? 'btn-filter active' : 'btn-filter'}
              onClick={() => setFilter(k)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: filter === k ? '1px solid #3157d5' : '1px solid #cbd5e1',
                background: filter === k ? '#eff6ff' : '#ffffff',
                color: filter === k ? '#1d4ed8' : '#475569',
                fontWeight: filter === k ? 700 : 500,
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap'
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ minWidth: '240px', flex: '1 1 240px', maxWidth: '380px' }}>
          <input
            type="text"
            placeholder="🔍 Buscar por orden, equipo, cliente, serie..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#64748b' }}>Cargando órdenes asignadas a tu taller...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '40px 20px', background: '#ffffff', borderRadius: 14, border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎉</div>
          <h3 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>¡Todo al día en tu banco de trabajo!</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
            {orders.length === 0 ? 'No tienes órdenes de servicio asignadas actualmente.' : 'No hay órdenes que coincidan con los filtros aplicados.'}
          </p>
        </div>
      ) : viewMode === 'KANBAN' ? (
        /* ================= 1. KANBAN VIEW ================= */
        <div className="mywork-kanban">
          {kanbanColumns.map(col => {
            const colOrders = filteredOrders.filter(o => col.statuses.includes(o.status));
            return (
              <div className="kanban-column" key={col.id} style={{ borderTop: `4px solid ${col.borderColor}` }}>
                <div className="kanban-col-head">
                  <span>{col.title}</span>
                  <span className="kanban-badge">{colOrders.length}</span>
                </div>
                <div className="kanban-col-body">
                  {colOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '12px' }}>
                      Sin órdenes aquí
                    </div>
                  ) : (
                    colOrders.map(o => {
                      const cleanPhone = (o.customer_phone || '').replace(/[^0-9]/g, '');
                      const waUrl = cleanPhone
                        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${o.customer_name || 'estimado cliente'}, te escribe tu técnico de Fixme sobre tu equipo ${o.device_brand || ''} ${o.device_model || ''} (Orden ${o.order_number || ''}).`)}`
                        : '';
                      const itemsCount = (o.items || []).length;
                      const quoteVal = Number(o.quote || 0);

                      return (
                        <div className="kanban-card" key={o.id}>
                          <div className="kanban-card-top">
                            <span className="kanban-order-num">{o.order_number || 'OT-#'}</span>
                            <div>{getSlaBadge(o)}</div>
                          </div>

                          <div className="kanban-device-title">
                            📱 {o.device_brand} {o.device_model}
                          </div>
                          {o.serial_number && (
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                              S/N: <code>{o.serial_number}</code>
                            </div>
                          )}

                          <div className="kanban-card-fault">
                            <strong>Falla:</strong> "{o.reported_fault || 'Sin reporte inicial'}"
                          </div>

                          {o.diagnosis && (
                            <div style={{ fontSize: '11px', color: '#166534', background: '#f0fdf4', padding: '5px 8px', borderRadius: 4, border: '1px solid #bbf7d0' }}>
                              <strong>Diagnóstico:</strong> {o.diagnosis}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2px 0' }}>
                            {itemsCount > 0 ? (
                              <span className="kanban-items-pill">
                                📦 {itemsCount} ítems (${quoteVal.toFixed(2)})
                              </span>
                            ) : quoteVal > 0 ? (
                              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>
                                Cotiz: ${quoteVal.toFixed(2)}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Sin cotización</span>
                            )}
                          </div>

                          <div className="kanban-card-customer">
                            <span title={o.customer_name}>👤 {o.customer_name || 'Cliente'}</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 700, fontSize: '12px' }}
                                  title="WhatsApp al cliente"
                                >
                                  💬 WA
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setReceiptOrder(o)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                                title="Imprimir Ticket Térmico 80mm"
                              >
                                🖨️
                              </button>
                            </div>
                          </div>

                          {/* Quick Action Buttons */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4, paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                            <button
                              type="button"
                              className="btn-primary-sm"
                              style={{ flex: 1, padding: '5px 8px', fontSize: '11px', textAlign: 'center', justifyContent: 'center' }}
                              onClick={() => setWorkbenchOrder(o)}
                            >
                              🔧 Ficha & Taller
                            </button>
                            {col.id === 'COL_DIAG' && (
                              <button
                                type="button"
                                className="tech-action-btn tech-action-repair"
                                disabled={updating}
                                onClick={() => updateStatus(o.id, 'EN_REPARACION', 'Técnico inició reparación')}
                                title="Iniciar reparación"
                              >
                                ▶ Iniciar
                              </button>
                            )}
                            {col.id === 'COL_REPAIR' && (
                              <>
                                <button
                                  type="button"
                                  className="tech-action-btn tech-action-parts"
                                  disabled={updating}
                                  onClick={() => updateStatus(o.id, 'ESPERANDO_REPUESTOS', 'Esperando repuestos')}
                                  title="Poner en espera de repuestos"
                                >
                                  ⏳ Repuesto
                                </button>
                                <button
                                  type="button"
                                  className="tech-action-btn tech-action-ready"
                                  disabled={updating}
                                  onClick={() => updateStatus(o.id, 'LISTO_ENTREGA', 'Reparación culminada')}
                                  title="Marcar listo para entrega"
                                >
                                  ✓ Listo
                                </button>
                              </>
                            )}
                            {col.id === 'COL_PARTS' && (
                              <button
                                type="button"
                                className="tech-action-btn tech-action-repair"
                                disabled={updating}
                                onClick={() => updateStatus(o.id, 'EN_REPARACION', 'Repuestos disponibles, reanudando')}
                                title="Reanudar reparación"
                              >
                                ▶ Reanudar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'TABLE' ? (
        /* ================= 2. TABLE VIEW (COMPACT FOR HIGH VOLUME) ================= */
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="items-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>N° Orden</th>
                  <th>SLA / Plazo</th>
                  <th>Equipo & Serie</th>
                  <th>Cliente</th>
                  <th>Falla Reportada</th>
                  <th>Diagnóstico</th>
                  <th>Cotización</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => {
                  const cleanPhone = (o.customer_phone || '').replace(/[^0-9]/g, '');
                  const waUrl = cleanPhone
                    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${o.customer_name || 'estimado cliente'}, te escribe tu técnico sobre tu orden ${o.order_number || ''}.`)}`
                    : '';
                  const itemsCount = (o.items || []).length;
                  const quoteVal = Number(o.quote || 0);

                  return (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setWorkbenchOrder(o)}>
                      <td style={{ fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {o.order_number || 'OT-#'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{getSlaBadge(o)}</td>
                      <td>
                        <strong>{o.device_brand} {o.device_model}</strong>
                        {o.serial_number && <div style={{ fontSize: '10.5px', color: '#64748b' }}>S/N: {o.serial_number}</div>}
                      </td>
                      <td>
                        <div>{o.customer_name || 'Sin nombre'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{o.customer_phone || ''}</div>
                      </td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.reported_fault}>
                        {o.reported_fault || '-'}
                      </td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: o.diagnosis ? '#166534' : '#94a3b8' }} title={o.diagnosis}>
                        {o.diagnosis || 'Pendiente'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700 }}>${quoteVal.toFixed(2)}</div>
                        {itemsCount > 0 && <span style={{ fontSize: '10px', color: '#64748b' }}>{itemsCount} ítems</span>}
                      </td>
                      <td>{getStatusBadge(o.status)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary-sm"
                              style={{ padding: '4px 8px', fontSize: '11px', textDecoration: 'none', color: '#16a34a' }}
                              title="Chat WhatsApp"
                            >
                              💬 WA
                            </a>
                          )}
                          <button
                            type="button"
                            className="btn-secondary-sm"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => setReceiptOrder(o)}
                            title="Imprimir Comprobante 80mm"
                          >
                            🖨️
                          </button>
                          <button
                            type="button"
                            className="btn-primary-sm"
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            onClick={() => setWorkbenchOrder(o)}
                          >
                            🔧 Taller
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= 3. CARDS GRID VIEW ================= */
        <div className="mywork-grid">
          {filteredOrders.map(o => {
            const cleanPhone = (o.customer_phone || '').replace(/[^0-9]/g, '');
            const waMsg = encodeURIComponent(`Hola ${o.customer_name || 'estimado cliente'}, te escribe tu técnico de Fixme sobre tu equipo ${o.device_brand || ''} ${o.device_model || ''} (Orden ${o.order_number || ''}).`);
            const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMsg}` : '';

            const isRepair = ['EN_REPARACION', 'IN_PROGRESS', 'APPROVED'].includes(o.status);
            const isWaiting = ['ESPERANDO_REPUESTOS', 'WAITING_PARTS'].includes(o.status);
            const isReady = ['LISTO_ENTREGA', 'COMPLETED'].includes(o.status);
            const itemsCount = (o.items || []).length;
            const quoteVal = Number(o.quote || 0);

            return (
              <div key={o.id} className="mywork-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b' }}>{o.order_number || 'OT-#'}</span>
                      <div style={{ marginTop: 2 }}>{getSlaBadge(o)}</div>
                    </div>
                    <div>{getStatusBadge(o.status)}</div>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                    📱 {o.device_brand} {o.device_model}
                  </div>
                  {o.serial_number && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: 6 }}>
                      S/N: <code>{o.serial_number}</code>
                    </div>
                  )}

                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 8, fontSize: '12px', color: '#334155', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase', marginBottom: 2 }}>Falla Reportada:</div>
                    <div>"{o.reported_fault || 'Sin detalle de falla'}"</div>
                    {o.accessories && <div style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>Accesorios: {o.accessories}</div>}
                  </div>

                  {o.diagnosis && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 10px', borderRadius: 8, fontSize: '12px', color: '#166534', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: '10.5px', textTransform: 'uppercase', marginBottom: 2 }}>Diagnóstico Técnico:</div>
                      <div>{o.diagnosis}</div>
                    </div>
                  )}

                  {o.technician_notes && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '8px 10px', borderRadius: 8, fontSize: '11.5px', color: '#1e40af', marginBottom: 8 }}>
                      <strong>Nota de avance:</strong> {o.technician_notes}
                    </div>
                  )}

                  {/* Budget & Parts summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, marginBottom: 10, fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Presupuesto:</span>
                    <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                      ${quoteVal.toFixed(2)} {itemsCount > 0 && <small style={{ fontWeight: 500, color: '#64748b' }}>({itemsCount} ítems)</small>}
                    </strong>
                  </div>

                  {/* Customer Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', fontSize: '12px', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>👤 {o.customer_name || 'Cliente'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>📞 {o.customer_phone || 'Sin teléfono'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {waUrl && (
                        <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#25d366', color: '#ffffff', padding: '4px 8px', borderRadius: 6, fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                          💬 WhatsApp
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setReceiptOrder(o)}
                        className="btn-secondary-sm"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        title="Imprimir Ticket Térmico 80mm"
                      >
                        🖨️
                      </button>
                    </div>
                  </div>
                </div>

                {/* Technician Quick Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 6 }}>
                  <button
                    type="button"
                    className="btn-primary-sm"
                    style={{ flex: '1 1 100%', padding: '7px 12px', fontSize: '12px', justifyContent: 'center' }}
                    onClick={() => setWorkbenchOrder(o)}
                  >
                    🔧 Abrir Ficha Técnica & Taller
                  </button>
                  {!isRepair && !isReady && (
                    <button
                      className="tech-action-btn tech-action-repair"
                      disabled={updating}
                      onClick={() => updateStatus(o.id, 'EN_REPARACION', 'Técnico inició la reparación')}
                    >
                      ▶ Iniciar Reparación
                    </button>
                  )}
                  {!isWaiting && !isReady && (
                    <button
                      className="tech-action-btn tech-action-parts"
                      disabled={updating}
                      onClick={() => updateStatus(o.id, 'ESPERANDO_REPUESTOS', 'Esperando repuestos')}
                    >
                      ⏳ Esperar Repuestos
                    </button>
                  )}
                  {!isReady && (
                    <button
                      className="tech-action-btn tech-action-ready"
                      disabled={updating}
                      onClick={() => updateStatus(o.id, 'LISTO_ENTREGA', 'Reparación culminada con éxito')}
                    >
                      ✓ Marcar Listo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Technician Workbench Modal (Ficha Técnica, Repuestos, Mano de Obra, Cotización) */}
      {workbenchOrder && (
        <TechnicianWorkbenchModal
          order={workbenchOrder}
          onClose={() => setWorkbenchOrder(null)}
          onSaved={load}
          api={api}
          notify={notify}
          branchId={branchId}
          tenantName={localStorage.tenantName || 'Fixme Tiendas'}
        />
      )}

      {/* Thermal Receipt Modal (Comprobante 80mm para el cliente o técnico) */}
      {receiptOrder && (
        <WorkOrderReceiptModal
          order={receiptOrder}
          onClose={() => setReceiptOrder(null)}
          tenantName={localStorage.tenantName || 'Fixme Tiendas'}
        />
      )}
    </>
  );
}
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
    ? [['my-work', '🛠️', 'Mi Trabajo Asignado', 'Mis órdenes y estados técnicos'], ['work-orders', '📋', 'Todas las Órdenes', 'Diagnóstico general'], ['pos', '🛒', 'Punto de Venta', 'Vender si tengo permiso']]
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
        minStock: Number(form.minStock || 5),
        barcode: form.barcode.trim() || null,
        price: Number(form.price),
        purchasePrice: Number(form.purchasePrice),
        extraCost: Number(form.extraCost),
        marginPercent: Number(form.marginPercent)
      })
    });
    setBusy(false);
    if (r.ok) {
      setMsg('Producto registrado exitosamente');
      setForm({ sku: '', name: '', barcode: '', minStock: '5', stock: '10', purchasePrice: '0', price: '0', extraCost: '0', marginPercent: '30', categoryId: '' });
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

  const exportCsv = () => {
    if (!rows.length) {
      alert('No hay productos para exportar');
      return;
    }
    const headers = ['SKU', 'Nombre', 'CodigoBarras', 'Stock', 'StockMinimo', 'CostoCompra', 'PrecioPVP', 'Categoria'];
    const lines = rows.map(p => [
      `"${p.sku || ''}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.barcode || ''}"`,
      p.stock || 0,
      p.min_stock ?? p.minStock ?? 5,
      p.purchase_price ?? p.purchasePrice ?? 0,
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
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">INVENTARIO, VALORIZACIÓN Y MÁRGENES</span>
          <h2>Control de Existencias y Rentabilidad</h2>
          <p>Conoce la inversión total en mercadería, valorización proyectada a PVP y calcula márgenes al instante.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="secondary-action" onClick={exportCsv} title="Descargar inventario completo en formato CSV">
            📥 Exportar CSV
          </button>
          {canManage && (
            <>
              <button type="button" className="secondary-action" onClick={() => setShowCsvImport(true)} title="Importar masivamente productos desde archivo CSV">
                📤 Importar CSV
              </button>
              <button type="button" className="secondary-action" onClick={() => setShowBarcodes(true)} title="Generar e imprimir etiquetas de código de barras">
                🏷️ Etiquetas Barcode
              </button>
              <button className="primary-action" onClick={() => { setShowForm(!showForm); setMsg(''); }}>
                {showForm ? '✕ Cancelar' : '＋ Nuevo Producto'}
              </button>
            </>
          )}
        </div>
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
                      <div>
                        <span className="sku-label">{r.sku}</span>
                        {r.barcode && (
                          <small style={{ display: 'block', fontSize: '9.5px', color: '#64748b' }}>
                            🏷️ {r.barcode}
                          </small>
                        )}
                      </div>
                      {(() => {
                        const minS = Number(r.min_stock ?? r.minStock ?? 5);
                        const isOut = stock <= 0;
                        const isLow = stock > 0 && stock <= minS;
                        return (
                          <span
                            className={!isOut && !isLow ? 'stock-badge' : isLow ? 'stock-badge' : 'stock-badge empty-stock'}
                            style={{
                              background: !isOut && !isLow ? '#dcfce7' : isLow ? '#fef3c7' : '#fee2e2',
                              color: !isOut && !isLow ? '#166534' : isLow ? '#92400e' : '#991b1b',
                              fontWeight: 700
                            }}
                            title={`Stock actual: ${stock} unidades · Alerta mínima configurada: ${minS}`}
                          >
                            {!isOut && !isLow ? `🟢 ${stock} en stock` : isLow ? `🟡 Bajo (${stock}/${minS})` : '🔴 Agotado'}
                          </span>
                        );
                      })()}
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

function Customers({api, notify, go}:{api:(u:string,o?:RequestInit)=>Promise<Response>, notify:(s:string)=>void, go?:(page:string)=>void}){
  const [rows, setRows] = React.useState<Any[]>([]);
  const [stats, setStats] = React.useState({ totalCustomers: 0, vipCustomers: 0, totalSalesVolume: 0, activeRepairCustomers: 0 });
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState('ALL');

  // Modals
  const [showModal, setShowModal] = React.useState(false);
  const [editingCustomer, setEditingCustomer] = React.useState<Any|null>(null);
  const [profileCustomer, setProfileCustomer] = React.useState<Any|null>(null);
  const [profileHistory, setProfileHistory] = React.useState<Any|null>(null);
  const [profileTab, setProfileTab] = React.useState<'SUMMARY'|'SALES'|'WORK_ORDERS'|'WARRANTIES'|'DELIVERIES'>('SUMMARY');
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  // Form
  const [form, setForm] = React.useState({
    name: '',
    identificationType: 'CEDULA',
    identificationNumber: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    tag: 'REGULAR',
    notes: ''
  });
  const [submitting, setSubmitting] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (tagFilter && tagFilter !== 'ALL') q.set('tag', tagFilter);
      if (search.trim()) q.set('search', search.trim());

      const [rRows, rStats] = await Promise.all([
        api(`/api/customers?${q.toString()}`),
        api('/api/customers/stats')
      ]);

      if (rRows.ok) setRows(await rRows.json());
      if (rStats.ok) setStats(await rStats.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [api, tagFilter, search]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingCustomer(null);
    setForm({
      name: '',
      identificationType: 'CEDULA',
      identificationNumber: '',
      phone: '',
      email: '',
      city: '',
      address: '',
      tag: 'REGULAR',
      notes: ''
    });
    setShowModal(true);
  };

  const openEdit = (c: Any) => {
    setEditingCustomer(c);
    setForm({
      name: c.name || '',
      identificationType: c.identification_type || 'CEDULA',
      identificationNumber: c.identification_number || '',
      phone: c.phone || '',
      email: c.email || '',
      city: c.city || '',
      address: c.address || '',
      tag: c.tag || 'REGULAR',
      notes: c.notes || ''
    });
    setShowModal(true);
  };

  const openProfile = async (c: Any) => {
    setProfileCustomer(c);
    setProfileTab('SUMMARY');
    setLoadingHistory(true);
    try {
      const res = await api(`/api/customers/${c.id}/history`);
      if (res.ok) {
        setProfileHistory(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('El nombre o razón social es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';
      const res = await api(url, {
        method,
        body: JSON.stringify({
          ...form,
          email: form.email.trim() || null,
          identificationNumber: form.identificationNumber.trim() || null
        })
      });

      if (res.ok) {
        notify(editingCustomer ? 'Cliente actualizado correctamente' : 'Cliente registrado exitosamente');
        setShowModal(false);
        loadData();
        if (profileCustomer && editingCustomer && profileCustomer.id === editingCustomer.id) {
          openProfile(await res.json());
        }
      } else {
        const err = await res.text();
        alert('Error al guardar cliente: ' + (err.includes('unique') ? 'El correo ya está registrado por otro cliente' : err));
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: Any) => {
    if (!confirm(`¿Estás seguro de eliminar al cliente "${c.name}"?`)) return;
    try {
      const res = await api(`/api/customers/${c.id}`, { method: 'DELETE' });
      if (res.ok) {
        notify('Cliente eliminado.');
        if (profileCustomer?.id === c.id) setProfileCustomer(null);
        loadData();
      } else {
        alert('No se pudo eliminar el cliente. Verifique que no tenga ventas u órdenes vinculadas.');
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const exportCSV = () => {
    if (!rows.length) {
      alert('No hay clientes para exportar.');
      return;
    }
    const headers = ['Nombre', 'Tipo Documento', 'Numero Documento', 'Telefono', 'Email', 'Ciudad', 'Direccion', 'Total Gastado ($)', 'Compras', 'Etiqueta'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      const row = [
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${r.identification_type || 'CEDULA'}"`,
        `"${r.identification_number || ''}"`,
        `"${r.phone || ''}"`,
        `"${r.email || ''}"`,
        `"${r.city || ''}"`,
        `"${(r.address || '').replace(/"/g, '""')}"`,
        `"${Number(r.total_spent || 0).toFixed(2)}"`,
        `"${r.total_sales_count || 0}"`,
        `"${r.tag || 'REGULAR'}"`
      ];
      csvRows.push(row.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_fixmetiendas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Directorio de clientes exportado a CSV exitosamente');
  };

  const openWhatsApp = (c: Any) => {
    const raw = (c.phone || '').replace(/\D/g, '');
    const cleanPhone = raw.startsWith('0') ? '593' + raw.slice(1) : (raw || '');
    const text = `Hola ${c.name || 'Estimado cliente'}, le saludamos de *Fixme Tiendas*. ¿En qué podemos asistirle el día de hoy?`;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="customers-page">
      {/* Header & Primary Actions */}
      <section className="panel" style={{marginBottom: 16}}>
        <div className="panel-head" style={{flexWrap: 'wrap', gap: 12}}>
          <div>
            <h2 style={{fontSize: 20, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8}}>
              👥 Directorio y CRM de Clientes 360°
            </h2>
            <p style={{margin: 0, fontSize: 13, color: '#64748b'}}>
              Gestión comercial integral de clientes, identificación fiscal, historial de ventas, taller y garantías.
            </p>
          </div>
          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            <button className="secondary" onClick={() => exportCSV()} title="Exportar a Excel/CSV" style={{display: 'flex', alignItems: 'center', gap: 5}}>
              📥 Exportar CSV
            </button>
            <button className="secondary" onClick={() => loadData()} title="Recargar lista" style={{display: 'flex', alignItems: 'center', gap: 5}}>
              🔄 Refrescar
            </button>
            <button onClick={openCreate} style={{display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700}}>
              ➕ Registrar Cliente
            </button>
          </div>
        </div>

        {/* CRM KPI Cards */}
        <div className="crm-kpi-grid" style={{marginTop: 16}}>
          <div
            className={`crm-kpi-card ${tagFilter === 'ALL' ? 'active-filter' : ''}`}
            onClick={() => setTagFilter('ALL')}
          >
            <span className="kpi-label">👥 Total Clientes</span>
            <span className="kpi-value">{stats.totalCustomers}</span>
          </div>
          <div
            className={`crm-kpi-card kpi-vip ${tagFilter === 'VIP' ? 'active-filter' : ''}`}
            onClick={() => setTagFilter('VIP')}
          >
            <span className="kpi-label">⭐ Clientes VIP</span>
            <span className="kpi-value">{stats.vipCustomers}</span>
          </div>
          <div
            className={`crm-kpi-card kpi-money ${tagFilter === 'WITH_SALES' ? 'active-filter' : ''}`}
            onClick={() => setTagFilter('WITH_SALES')}
          >
            <span className="kpi-label">💰 Facturación Clientes</span>
            <span className="kpi-value">${Number(stats.totalSalesVolume || 0).toFixed(2)}</span>
          </div>
          <div
            className={`crm-kpi-card kpi-repair ${tagFilter === 'ACTIVE_WORK_ORDERS' ? 'active-filter' : ''}`}
            onClick={() => setTagFilter('ACTIVE_WORK_ORDERS')}
          >
            <span className="kpi-label">🛠️ En Taller Activo</span>
            <span className="kpi-value">{stats.activeRepairCustomers}</span>
          </div>
        </div>

        {/* Toolbar: Search and Filter Pills */}
        <div className="warranty-controls">
          <div className="warranty-search-wrap">
            <span className="warranty-search-icon">🔍</span>
            <input
              type="text"
              className="warranty-search-input"
              placeholder="Buscar por nombre, cédula / RUC, teléfono, correo o ciudad..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '2px 6px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="warranty-filter-pills">
            {[
              ['ALL', 'Todos'],
              ['VIP', '⭐ VIP'],
              ['FREQUENT', '🔄 Frecuentes'],
              ['WITH_SALES', '🛍️ Con Compras'],
              ['ACTIVE_WORK_ORDERS', '🛠️ En Taller'],
              ['NEW', '🆕 Nuevos']
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`warranty-pill ${tagFilter === k ? 'active' : ''}`}
                onClick={() => setTagFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Customer Directory Table */}
      <section className="panel table-panel">
        <div className="panel-head">
          <h3>
            Listado de Clientes {tagFilter !== 'ALL' && <small style={{color: '#64748b'}}>({tagFilter})</small>}
          </h3>
          <span style={{fontSize: 12, color: '#64748b'}}>{rows.length} clientes encontrados</span>
        </div>

        {loading ? (
          <div style={{textAlign: 'center', padding: 32, color: '#64748b'}}>
            <p>Cargando directorio de clientes...</p>
          </div>
        ) : rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente & Identificación</th>
                  <th>Contacto Directo</th>
                  <th>Ubicación</th>
                  <th>Métricas CRM (LTV)</th>
                  <th>Servicios Activos</th>
                  <th style={{textAlign: 'right'}}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c: Any) => (
                  <tr key={c.id}>
                    <td data-label="Cliente">
                      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background: '#e0e7ff',
                            color: '#3730a3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 14,
                            flexShrink: 0
                          }}
                        >
                          {(c.name || 'C').slice(0, 1).toUpperCase()}
                        </div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                            <strong style={{fontSize: 13.5, color: '#0f172a'}}>{c.name}</strong>
                            <span className={`tag-chip ${c.tag || 'REGULAR'}`}>
                              {c.tag === 'VIP' ? '⭐ VIP' : c.tag === 'FREQUENT' ? '🔄 FRECUENTE' : c.tag === 'NEW' ? '🆕 NUEVO' : 'REGULAR'}
                            </span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                            <span className="id-chip">
                              {c.identification_type === 'FINAL_CONSUMER'
                                ? 'Consumidor Final'
                                : `${c.identification_type || 'CÉDULA'}: ${c.identification_number || 'S/N'}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Contacto">
                      <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
                        {c.phone ? (
                          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                            <span style={{fontSize: 12, color: '#334155'}}>{c.phone}</span>
                            <button
                              type="button"
                              onClick={() => openWhatsApp(c)}
                              className="btn-wa-link"
                              title="Abrir chat en WhatsApp"
                            >
                              💬 WhatsApp
                            </button>
                          </div>
                        ) : (
                          <small style={{color: '#94a3b8'}}>Sin teléfono</small>
                        )}
                        {c.email ? (
                          <small style={{color: '#64748b', fontSize: 11}}>✉️ {c.email}</small>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Ubicación">
                      <div style={{display: 'flex', flexDirection: 'column', fontSize: 12}}>
                        <strong style={{color: '#334155'}}>{c.city || 'No especificada'}</strong>
                        {c.address && (
                          <small style={{color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={c.address}>
                            {c.address}
                          </small>
                        )}
                      </div>
                    </td>
                    <td data-label="Métricas LTV">
                      <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                        <strong style={{fontSize: 13, color: '#059669'}}>
                          ${Number(c.total_spent || 0).toFixed(2)}
                        </strong>
                        <div style={{fontSize: 11, color: '#64748b'}}>
                          {c.total_sales_count} compras
                          {c.last_purchase_at ? ` • Última: ${new Date(c.last_purchase_at).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                    </td>
                    <td data-label="Servicios">
                      <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                        {c.active_work_orders_count > 0 && (
                          <span
                            className="chip"
                            style={{background: '#eff6ff', color: '#1e40af', width: 'fit-content', fontSize: 11, cursor: 'pointer'}}
                            onClick={() => go && go('work-orders')}
                            title="Ver en Taller Técnico"
                          >
                            🛠️ {c.active_work_orders_count} en taller
                          </span>
                        )}
                        {c.active_warranties_count > 0 && (
                          <span
                            className="chip"
                            style={{background: '#ecfdf5', color: '#065f46', width: 'fit-content', fontSize: 11, cursor: 'pointer'}}
                            onClick={() => go && go('warranties')}
                            title="Ver en Garantías"
                          >
                            🛡️ {c.active_warranties_count} garantías
                          </span>
                        )}
                        {!c.active_work_orders_count && !c.active_warranties_count && (
                          <small style={{color: '#94a3b8', fontSize: 11}}>Sin servicios pendientes</small>
                        )}
                      </div>
                    </td>
                    <td data-label="Acciones" style={{textAlign: 'right'}}>
                      <div style={{display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap'}}>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => openProfile(c)}
                          style={{padding: '5px 9px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4}}
                          title="Ver Perfil CRM 360°"
                        >
                          👁️ Perfil 360°
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => openEdit(c)}
                          style={{padding: '5px 8px', fontSize: 11.5}}
                          title="Editar cliente"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleDelete(c)}
                          style={{padding: '5px 8px', fontSize: 11, color: '#ef4444', borderColor: '#fca5a5'}}
                          title="Eliminar cliente"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <b>👥</b>
            <p>No se encontraron clientes registrados con los filtros seleccionados.</p>
            <small>Agrega tu primer cliente para emitir ventas en el POS, registrar órdenes en taller y emitir garantías.</small>
            <button onClick={openCreate} style={{marginTop: 12}}>
              ➕ Registrar Primer Cliente
            </button>
          </div>
        )}
      </section>

      {/* MODAL / DRAWER: PERFIL CRM 360° DEL CLIENTE */}
      {profileCustomer && (
        <div className="modal-overlay" onClick={() => setProfileCustomer(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: 620, padding: 0}}>
            {/* Header */}
            <div className="customer-360-header">
              <div className="customer-avatar-large">
                {(profileCustomer.name || 'C').slice(0, 1).toUpperCase()}
              </div>
              <div style={{flex: 1}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <h3 style={{margin: 0, fontSize: 17, color: '#0f172a'}}>{profileCustomer.name}</h3>
                  <span className={`tag-chip ${profileCustomer.tag || 'REGULAR'}`}>
                    {profileCustomer.tag === 'VIP' ? '⭐ VIP' : profileCustomer.tag === 'FREQUENT' ? '🔄 FRECUENTE' : profileCustomer.tag === 'NEW' ? '🆕 NUEVO' : 'REGULAR'}
                  </span>
                </div>
                <div style={{display: 'flex', gap: 8, fontSize: 12, color: '#64748b', marginTop: 3}}>
                  <span>{profileCustomer.identification_type || 'CÉDULA'}: {profileCustomer.identification_number || 'S/N'}</span>
                  {profileCustomer.city && <span>• {profileCustomer.city}</span>}
                </div>
              </div>
              <button className="modal-close" onClick={() => setProfileCustomer(null)}>✕</button>
            </div>

            {/* Action Bar */}
            <div style={{display: 'flex', gap: 8, padding: '10px 16px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap'}}>
              {profileCustomer.phone && (
                <button
                  type="button"
                  onClick={() => openWhatsApp(profileCustomer)}
                  className="btn-wa-link"
                  style={{fontSize: 12, padding: '6px 10px'}}
                >
                  💬 Iniciar WhatsApp
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setProfileCustomer(null);
                  if (go) go('pos');
                }}
                style={{fontSize: 12, padding: '6px 10px'}}
              >
                🛒 Nueva Venta POS
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setProfileCustomer(null);
                  if (go) go('work-orders');
                }}
                style={{fontSize: 12, padding: '6px 10px'}}
              >
                🛠️ Nueva Orden Taller
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  openEdit(profileCustomer);
                }}
                style={{fontSize: 12, padding: '6px 10px'}}
              >
                ✏️ Editar Datos
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="customer-360-tabs">
              <button
                type="button"
                className={`customer-tab-btn ${profileTab === 'SUMMARY' ? 'active' : ''}`}
                onClick={() => setProfileTab('SUMMARY')}
              >
                📌 Resumen & Contacto
              </button>
              <button
                type="button"
                className={`customer-tab-btn ${profileTab === 'SALES' ? 'active' : ''}`}
                onClick={() => setProfileTab('SALES')}
              >
                🛒 Ventas ({profileHistory?.sales?.length || 0})
              </button>
              <button
                type="button"
                className={`customer-tab-btn ${profileTab === 'WORK_ORDERS' ? 'active' : ''}`}
                onClick={() => setProfileTab('WORK_ORDERS')}
              >
                🛠️ Taller ({profileHistory?.workOrders?.length || 0})
              </button>
              <button
                type="button"
                className={`customer-tab-btn ${profileTab === 'WARRANTIES' ? 'active' : ''}`}
                onClick={() => setProfileTab('WARRANTIES')}
              >
                🛡️ Garantías ({profileHistory?.warranties?.length || 0})
              </button>
              <button
                type="button"
                className={`customer-tab-btn ${profileTab === 'DELIVERIES' ? 'active' : ''}`}
                onClick={() => setProfileTab('DELIVERIES')}
              >
                🚚 Envíos ({profileHistory?.deliveries?.length || 0})
              </button>
            </div>

            {/* Tab Content */}
            <div className="customer-360-body">
              {loadingHistory ? (
                <div style={{textAlign: 'center', padding: 24, color: '#64748b'}}>
                  Cargando expediente 360°...
                </div>
              ) : profileTab === 'SUMMARY' ? (
                <div>
                  <div className="profile-stats-strip">
                    <div className="strip-stat">
                      <span>Total Invertido (LTV)</span>
                      <strong style={{color: '#059669'}}>
                        ${Number(profileCustomer.total_spent || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div className="strip-stat">
                      <span>Compras Registradas</span>
                      <strong>{profileCustomer.total_sales_count || 0}</strong>
                    </div>
                    <div className="strip-stat">
                      <span>Órdenes en Taller</span>
                      <strong>{profileCustomer.total_work_orders_count || 0}</strong>
                    </div>
                  </div>

                  <div style={{display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6}}>
                      <span style={{color: '#64748b'}}>Documento:</span>
                      <strong>{profileCustomer.identification_type}: {profileCustomer.identification_number || 'N/A'}</strong>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6}}>
                      <span style={{color: '#64748b'}}>Teléfono:</span>
                      <strong>{profileCustomer.phone || 'No registrado'}</strong>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6}}>
                      <span style={{color: '#64748b'}}>Correo electrónico:</span>
                      <strong>{profileCustomer.email || 'No registrado'}</strong>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6}}>
                      <span style={{color: '#64748b'}}>Ciudad:</span>
                      <strong>{profileCustomer.city || 'No especificada'}</strong>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6}}>
                      <span style={{color: '#64748b'}}>Dirección Domiciliaria:</span>
                      <strong style={{textAlign: 'right', maxWidth: '60%'}}>{profileCustomer.address || 'No registrada'}</strong>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6}}>
                      <span style={{color: '#64748b'}}>Fecha de Registro:</span>
                      <strong>{new Date(profileCustomer.created_at).toLocaleDateString()}</strong>
                    </div>
                    {profileCustomer.notes && (
                      <div style={{marginTop: 6}}>
                        <span style={{color: '#64748b', display: 'block', marginBottom: 4}}>Notas Comerciales / Preferencias:</span>
                        <div style={{background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#92400e'}}>
                          {profileCustomer.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : profileTab === 'SALES' ? (
                <div>
                  {profileHistory?.sales?.length ? (
                    <div className="table-wrap">
                      <table style={{fontSize: 12}}>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Total</th>
                            <th>Canal</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileHistory.sales.map((s: Any) => (
                            <tr key={s.id}>
                              <td>{new Date(s.created_at).toLocaleDateString()}</td>
                              <td><strong>${Number(s.total || 0).toFixed(2)}</strong></td>
                              <td>{s.fulfillment_type === 'DELIVERY' ? '🚚 Domicilio' : '🏪 Local'}</td>
                              <td><span className="w-badge ACTIVE">{s.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{textAlign: 'center', padding: 24, color: '#94a3b8'}}>
                      <p>El cliente no tiene compras registradas en el POS.</p>
                    </div>
                  )}
                </div>
              ) : profileTab === 'WORK_ORDERS' ? (
                <div>
                  {profileHistory?.workOrders?.length ? (
                    <div className="table-wrap">
                      <table style={{fontSize: 12}}>
                        <thead>
                          <tr>
                            <th>N° Orden</th>
                            <th>Equipo</th>
                            <th>Falla Reportada</th>
                            <th>Cotización</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileHistory.workOrders.map((w: Any) => (
                            <tr key={w.id}>
                              <td><strong>{w.order_number}</strong></td>
                              <td>{w.device_brand} {w.device_model}</td>
                              <td style={{maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={w.reported_fault || w.description}>
                                {w.reported_fault || w.description}
                              </td>
                              <td>${Number(w.quote || 0).toFixed(2)}</td>
                              <td><span className="w-badge CLAIMED">{w.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{textAlign: 'center', padding: 24, color: '#94a3b8'}}>
                      <p>No hay órdenes técnicas de taller para este cliente.</p>
                    </div>
                  )}
                </div>
              ) : profileTab === 'WARRANTIES' ? (
                <div>
                  {profileHistory?.warranties?.length ? (
                    <div className="table-wrap">
                      <table style={{fontSize: 12}}>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Vencimiento</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileHistory.warranties.map((war: Any) => (
                            <tr key={war.id}>
                              <td><strong>{war.warranty_code}</strong></td>
                              <td>{war.product_name}</td>
                              <td>{new Date(war.expires_at).toLocaleDateString()} ({war.remaining_days}d)</td>
                              <td><span className={`w-badge ${war.status}`}>{war.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{textAlign: 'center', padding: 24, color: '#94a3b8'}}>
                      <p>No hay garantías registradas para este cliente.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {profileHistory?.deliveries?.length ? (
                    <div className="table-wrap">
                      <table style={{fontSize: 12}}>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Dirección</th>
                            <th>Courier</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileHistory.deliveries.map((d: Any) => (
                            <tr key={d.id}>
                              <td>{new Date(d.created_at).toLocaleDateString()}</td>
                              <td style={{maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{d.address}</td>
                              <td>{d.courier || 'Flota Propia'}</td>
                              <td><span className="w-badge ACTIVE">{d.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{textAlign: 'center', padding: 24, color: '#94a3b8'}}>
                      <p>No hay envíos registrados a este cliente.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR O EDITAR CLIENTE */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: 540}}>
            <div className="modal-header">
              <div>
                <h3 style={{margin: 0}}>
                  {editingCustomer ? '✏️ Editar Datos de Cliente' : '➕ Registrar Nuevo Cliente'}
                </h3>
                <small style={{color: '#64748b'}}>Datos fiscales, contacto directo y segmentación</small>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                <div>
                  <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                    Tipo de Documento:
                  </label>
                  <select
                    value={form.identificationType}
                    onChange={e => setForm({...form, identificationType: e.target.value})}
                    style={{width: '100%', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5}}
                  >
                    <option value="CEDULA">Cédula de Identidad (10 d)</option>
                    <option value="RUC">RUC Tributario (13 d)</option>
                    <option value="PASSPORT">Pasaporte / Extranjero</option>
                    <option value="FINAL_CONSUMER">Consumidor Final</option>
                  </select>
                </div>

                <div>
                  <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                    Número de Documento / RUC:
                  </label>
                  <input
                    type="text"
                    disabled={form.identificationType === 'FINAL_CONSUMER'}
                    placeholder={form.identificationType === 'CEDULA' ? 'Ej: 1712345678' : form.identificationType === 'RUC' ? 'Ej: 1712345678001' : 'Número...'}
                    value={form.identificationNumber}
                    onChange={e => setForm({...form, identificationNumber: e.target.value})}
                    style={{width: '100%', boxSizing: 'border-box', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5}}
                  />
                </div>
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Nombres y Apellidos / Razón Social: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Carlos Pérez o Fixme Soluciones S.A."
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  style={{width: '100%', boxSizing: 'border-box', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
                />
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                <div>
                  <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                    Teléfono Celular / WhatsApp:
                  </label>
                  <input
                    type="tel"
                    placeholder="Ej: 0991234567"
                    value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})}
                    style={{width: '100%', boxSizing: 'border-box', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5}}
                  />
                </div>

                <div>
                  <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                    Correo Electrónico (Facturación):
                  </label>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    style={{width: '100%', boxSizing: 'border-box', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5}}
                  />
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10}}>
                <div>
                  <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                    Ciudad:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Quito, Guayaquil..."
                    value={form.city}
                    onChange={e => setForm({...form, city: e.target.value})}
                    style={{width: '100%', boxSizing: 'border-box', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5}}
                  />
                </div>

                <div>
                  <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                    Clasificación / Etiqueta:
                  </label>
                  <select
                    value={form.tag}
                    onChange={e => setForm({...form, tag: e.target.value})}
                    style={{width: '100%', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5}}
                  >
                    <option value="REGULAR">👤 Regular</option>
                    <option value="VIP">⭐ VIP / Corporativo</option>
                    <option value="FREQUENT">🔄 Frecuente</option>
                    <option value="NEW">🆕 Nuevo</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Dirección Domiciliaria / Entrega:
                </label>
                <input
                  type="text"
                  placeholder="Calle principal, número y calle secundaria..."
                  value={form.address}
                  onChange={e => setForm({...form, address: e.target.value})}
                  style={{width: '100%', boxSizing: 'border-box', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5}}
                />
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Notas Comerciales Internas (Opcional):
                </label>
                <textarea
                  rows={2}
                  placeholder="Preferencias de atención, condiciones de crédito o indicaciones de entrega..."
                  value={form.notes}
                  onChange={e => setForm({...form, notes: e.target.value})}
                  style={{width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12}}
                />
              </div>

              <div className="modal-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10}}>
                <button type="button" className="secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} style={{fontWeight: 700}}>
                  {submitting ? 'Guardando...' : (editingCustomer ? 'Guardar Cambios' : 'Registrar Cliente')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Deliveries({api}:{api:(u:string,o?:RequestInit)=>Promise<Response>}){
  const [rows, setRows] = React.useState<Any[]>([]);
  const [drivers, setDrivers] = React.useState<Any[]>([]);
  const [filterTab, setFilterTab] = React.useState<'ALL'|'PENDING'|'IN_TRANSIT'|'DELIVERED'>('ALL');
  const [search, setSearch] = React.useState('');
  const [courierModal, setCourierModal] = React.useState<Any|null>(null);
  const [showDriverModal, setShowDriverModal] = React.useState(false);
  const [newDriver, setNewDriver] = React.useState({ fullName: '', phone: '', vehicleType: 'MOTO' });
  const [dispatchType, setDispatchType] = React.useState<'FLEET' | 'INDRIVE' | 'SERVIENTREGA'>('FLEET');
  const [dispatchForm, setDispatchForm] = React.useState({ driverId: '', courier: '', trackingUrl: '', trackingNumber: '' });
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api('/api/deliveries').then(r => r.ok ? r.json() : []).then(setRows);
    api('/api/delivery-drivers').then(r => r.ok ? r.json() : []).then(setDrivers);
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  async function createDriver(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api('/api/delivery-drivers', {
      method: 'POST',
      body: JSON.stringify(newDriver)
    });
    setBusy(false);
    if (r.ok) {
      setMsg('Repartidor registrado exitosamente');
      setNewDriver({ fullName: '', phone: '', vehicleType: 'MOTO' });
      setShowDriverModal(false);
      load();
    } else {
      setMsg('No se pudo registrar al repartidor');
    }
  }

  async function startDispatch(e: React.FormEvent) {
    e.preventDefault();
    if (!courierModal) return;
    setBusy(true);

    let finalCourier = '';
    let driverId: string | null = null;
    let trackingUrl: string | null = null;
    let trackingNumber: string | null = null;

    if (dispatchType === 'FLEET') {
      const selectedDr = drivers.find(d => d.id === dispatchForm.driverId);
      finalCourier = selectedDr ? selectedDr.fullName : (dispatchForm.courier.trim() || 'Motorizado Flota');
      driverId = dispatchForm.driverId || null;
    } else if (dispatchType === 'INDRIVE') {
      finalCourier = dispatchForm.courier.trim() || 'InDrive';
      trackingUrl = dispatchForm.trackingUrl.trim() || null;
    } else if (dispatchType === 'SERVIENTREGA') {
      finalCourier = dispatchForm.courier.trim() || 'Servientrega Nacional';
      trackingNumber = dispatchForm.trackingNumber.trim() || null;
    }

    const r = await api(`/api/deliveries/${courierModal.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'IN_TRANSIT',
        courier: finalCourier,
        driverId,
        trackingUrl,
        trackingNumber
      })
    });
    setBusy(false);
    if (r.ok) {
      setCourierModal(null);
      setMsg('¡Pedido despachado exitosamente en camino!');
      load();
    } else {
      setMsg('Error al despachar el pedido');
    }
  }

  async function markDelivered(id: string) {
    setBusy(true);
    const r = await api(`/api/deliveries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DELIVERED' })
    });
    setBusy(false);
    if (r.ok) {
      setMsg('¡Entrega completada exitosamente!');
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
      d.address, d.courier, d.driver_name, d.tracking_number, d.tracking_url, d.sale_id
    ].some(v => v && String(v).toLowerCase().includes(q));

    return matchTab && matchSearch;
  });

  return (
    <>
      <section className="inventory-hero">
        <div>
          <span className="eyebrow">LOGÍSTICA Y DESPACHOS A DOMICILIO</span>
          <h2>Tablero de Entregas & Courier</h2>
          <p>Gestiona repartidores propios, enlaces en vivo de InDrive/Uber y números de guía de Servientrega.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setShowDriverModal(true)}
          >
            🛵 Registrar Repartidor
          </button>
          <button className="primary-action" onClick={load}>Actualizar</button>
        </div>
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
          <small>Repartidores Registrados</small>
          <strong style={{ color: '#3157d5' }}>{drivers.length}</strong>
          <span>🛵 Personal activo de flota</span>
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
              placeholder="Buscar destinatario, repartidor, guía o dirección..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ASSIGN COURIER / INDRIVE / SERVIENTREGA DISPATCH MODAL */}
      {courierModal && (
        <div className="modal-overlay" onClick={() => setCourierModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-head">
              <h3>🚀 Despachar Pedido #{courierModal.id?.slice(0, 8)}</h3>
              <button className="close-button" onClick={() => setCourierModal(null)}>✕</button>
            </div>

            {/* RECIPIENT SUMMARY CARD */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                  👤 {courierModal.recipient_name || courierModal.customer_name || 'Consumidor'}
                </strong>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#3157d5', background: '#eff6ff', padding: '3px 8px', borderRadius: '6px' }}>
                  Flete: ${Number(courierModal.shipping_cost || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>📍</span> <span>{courierModal.address}</span>
              </div>
              {(courierModal.recipient_phone || courierModal.customer_phone) && (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  📞 {courierModal.recipient_phone || courierModal.customer_phone}
                </div>
              )}
            </div>

            <form onSubmit={startDispatch}>
              {/* DISPATCH MODE SEGMENTED CARDS */}
              <div className="modal-form-group">
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                  Modalidad de Entrega:
                </span>
                <div className="dispatch-mode-grid">
                  <div
                    className={`dispatch-mode-card ${dispatchType === 'FLEET' ? 'active' : ''}`}
                    onClick={() => {
                      setDispatchType('FLEET');
                      const sel = drivers.find(d => d.id === dispatchForm.driverId);
                      setDispatchForm(prev => ({
                        ...prev,
                        courier: sel ? sel.fullName : (drivers[0]?.fullName || 'Motorizado Flota')
                      }));
                    }}
                  >
                    <span className="dispatch-mode-icon">🛵</span>
                    <span className="dispatch-mode-title">Flota Propia</span>
                    <span className="dispatch-mode-subtitle">Motorizado tienda</span>
                  </div>

                  <div
                    className={`dispatch-mode-card ${dispatchType === 'INDRIVE' ? 'active' : ''}`}
                    onClick={() => {
                      setDispatchType('INDRIVE');
                      setDispatchForm(prev => ({
                        ...prev,
                        courier: prev.courier && (prev.courier.includes('InDrive') || prev.courier.includes('Uber')) ? prev.courier : 'InDrive'
                      }));
                    }}
                  >
                    <span className="dispatch-mode-icon">🚗</span>
                    <span className="dispatch-mode-title">InDrive / Uber</span>
                    <span className="dispatch-mode-subtitle">Rastreo en vivo</span>
                  </div>

                  <div
                    className={`dispatch-mode-card ${dispatchType === 'SERVIENTREGA' ? 'active' : ''}`}
                    onClick={() => {
                      setDispatchType('SERVIENTREGA');
                      setDispatchForm(prev => ({
                        ...prev,
                        courier: prev.courier && (prev.courier.includes('Servientrega') || prev.courier.includes('Tramaco')) ? prev.courier : 'Servientrega'
                      }));
                    }}
                  >
                    <span className="dispatch-mode-icon">📦</span>
                    <span className="dispatch-mode-title">Servientrega</span>
                    <span className="dispatch-mode-subtitle">Guía nacional</span>
                  </div>
                </div>
              </div>

              {/* CONDITIONAL CONTENT: FLEET */}
              {dispatchType === 'FLEET' && (
                <>
                  <label>
                    <span>Seleccionar Repartidor Registrado</span>
                    <select
                      value={dispatchForm.driverId}
                      onChange={e => {
                        const sel = drivers.find(d => d.id === e.target.value);
                        setDispatchForm({
                          ...dispatchForm,
                          driverId: e.target.value,
                          courier: sel ? sel.fullName : dispatchForm.courier
                        });
                      }}
                    >
                      <option value="">-- Elige un conductor de tu flota --</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.vehicleType === 'MOTO' ? '🛵 Moto' : d.vehicleType === 'AUTO' ? '🚗 Auto' : '🚲 Bici'} · {d.fullName} ({d.phone || 'Sin tel'})
                        </option>
                      ))}
                    </select>
                  </label>

                  {(() => {
                    const sel = drivers.find(d => d.id === dispatchForm.driverId);
                    if (sel) {
                      return (
                        <div className="driver-selected-card">
                          <div>
                            <strong>{sel.fullName}</strong>
                            <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                              {sel.vehicleType === 'MOTO' ? '🛵 Motocicleta' : sel.vehicleType === 'AUTO' ? '🚗 Automóvil' : '🚲 Bicicleta'} · {sel.phone || 'Sin teléfono'}
                            </div>
                          </div>
                          {sel.phone && (
                            <a
                              href={`tel:${sel.phone}`}
                              style={{ fontSize: '11px', background: '#16a34a', color: '#fff', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', fontWeight: 700 }}
                            >
                              📞 Llamar
                            </a>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="callout-box info">
                        <span>💡</span>
                        <div>
                          <span>¿El repartidor no está en la lista? </span>
                          <button
                            type="button"
                            style={{ background: 'transparent', border: 0, color: '#2563eb', fontWeight: 700, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
                            onClick={() => {
                              setCourierModal(null);
                              setShowDriverModal(true);
                            }}
                          >
                            + Registrar nuevo repartidor
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  <label>
                    <span>Nombre o Identificador del Courier / Repartidor</span>
                    <input
                      placeholder="Ej. Carlos Mendoza (Motorizado Express)"
                      value={dispatchForm.courier}
                      onChange={e => setDispatchForm({ ...dispatchForm, courier: e.target.value })}
                    />
                  </label>
                </>
              )}

              {/* CONDITIONAL CONTENT: INDRIVE / UBER */}
              {dispatchType === 'INDRIVE' && (
                <>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Plataforma de Viaje:
                    </span>
                    <div className="preset-pills">
                      {['InDrive', 'Uber Flash', 'Uber Direct', 'Didi Entrega', 'Cabify Envíos'].map(app => (
                        <span
                          key={app}
                          className={`preset-pill ${dispatchForm.courier.includes(app) ? 'active' : ''}`}
                          onClick={() => setDispatchForm({ ...dispatchForm, courier: app })}
                        >
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>

                  <label>
                    <span>Conductor / Vehículo / Placa</span>
                    <input
                      placeholder="Ej. Conductor Mario · Chevrolet Spark Gris (ABC-1234)"
                      value={dispatchForm.courier}
                      onChange={e => setDispatchForm({ ...dispatchForm, courier: e.target.value })}
                    />
                  </label>

                  <label>
                    <span>🚗 Link de Seguimiento en Vivo (InDrive / Uber)</span>
                    <input
                      type="url"
                      placeholder="https://indrive.com/track/... o https://trip.uber.com/..."
                      value={dispatchForm.trackingUrl}
                      onChange={e => setDispatchForm({ ...dispatchForm, trackingUrl: e.target.value })}
                      required={dispatchType === 'INDRIVE'}
                    />
                  </label>

                  <div className="callout-box success">
                    <span>📍</span>
                    <div>
                      <strong>Rastreo en vivo:</strong> Abre tu app de InDrive o Uber, presiona <em>"Compartir mi viaje"</em> y pega el enlace aquí. El cliente podrá ver el mapa y el recorrido en tiempo real.
                    </div>
                  </div>
                </>
              )}

              {/* CONDITIONAL CONTENT: SERVIENTREGA / ENCOMIENDA */}
              {dispatchType === 'SERVIENTREGA' && (
                <>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Empresa de Encomienda:
                    </span>
                    <div className="preset-pills">
                      {['Servientrega', 'Tramaco Express', 'LaarCourier', 'Cooperativa / Bus', 'Urbano'].map(comp => (
                        <span
                          key={comp}
                          className={`preset-pill ${dispatchForm.courier.includes(comp) ? 'active' : ''}`}
                          onClick={() => setDispatchForm({ ...dispatchForm, courier: comp })}
                        >
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>

                  <label>
                    <span>Empresa de Transporte</span>
                    <input
                      placeholder="Ej. Servientrega, Tramaco Express, Cooperativa Loja..."
                      value={dispatchForm.courier}
                      onChange={e => setDispatchForm({ ...dispatchForm, courier: e.target.value })}
                    />
                  </label>

                  <label>
                    <span>📦 Número de Guía Nacional / Código de Rastreo *</span>
                    <input
                      placeholder="Ej. SER-98745231 o 001-9928172"
                      style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', letterSpacing: '0.04em' }}
                      value={dispatchForm.trackingNumber}
                      onChange={e => setDispatchForm({ ...dispatchForm, trackingNumber: e.target.value })}
                      required={dispatchType === 'SERVIENTREGA'}
                    />
                  </label>

                  <div className="callout-box warning">
                    <span>🏷️</span>
                    <div>
                      <strong>Número de Guía:</strong> Este código se incluirá en la notificación de WhatsApp para que el cliente lo ingrese directamente en el portal de rastreo del courier.
                    </div>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setCourierModal(null)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-action"
                  disabled={busy}
                >
                  {busy ? 'Despachando...' : '✓ Iniciar Entrega y Despachar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DRIVER MODAL */}
      {showDriverModal && (
        <div className="modal-overlay" onClick={() => setShowDriverModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-head">
              <h3>🛵 Registrar Repartidor de la Empresa</h3>
              <button className="close-button" onClick={() => setShowDriverModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
              Agrega conductores o motorizados de tu tienda para asignarlos fácilmente a los pedidos.
            </p>

            <form onSubmit={createDriver}>
              <label>
                <span>Nombre y Apellidos *</span>
                <input
                  placeholder="Ej. Carlos Mendoza"
                  value={newDriver.fullName}
                  onChange={e => setNewDriver({ ...newDriver, fullName: e.target.value })}
                  required
                  autoFocus
                />
              </label>

              <label>
                <span>Teléfono Celular / WhatsApp *</span>
                <input
                  placeholder="Ej. 0987654321"
                  value={newDriver.phone}
                  onChange={e => setNewDriver({ ...newDriver, phone: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>Tipo de Vehículo</span>
                <select
                  value={newDriver.vehicleType}
                  onChange={e => setNewDriver({ ...newDriver, vehicleType: e.target.value })}
                >
                  <option value="MOTO">🛵 Motocicleta</option>
                  <option value="AUTO">🚗 Automóvil / Camioneta</option>
                  <option value="BICICLETA">🚲 Bicicleta</option>
                  <option value="EXTERNO">📦 Courier Externo Asociado</option>
                </select>
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowDriverModal(false)}>
                  Cancelar
                </button>
                <button className="primary-action" disabled={busy}>
                  {busy ? 'Guardando...' : '✓ Guardar Repartidor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPATCH CARDS GRID */}
      {filtered.length ? (
        <div className="deliv-grid">
          {filtered.map(d => {
            const cleanPhone = (d.recipient_phone || d.customer_phone || '').replace(/[^0-9]/g, '');
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address || '')}`;
            
            const publicTrackUrl = d.tracking_number ? `${window.location.origin}${window.location.pathname}#tracking/${d.tracking_number}` : '';
            let waMsg = `Hola ${d.recipient_name || d.customer_name || 'estimado/a cliente'}, te informamos sobre tu entrega en FixmeTiendas.\nEstado: ${d.status === 'IN_TRANSIT' ? '🚀 EN CAMINO hacia tu dirección' : d.status === 'DELIVERED' ? '✅ ENTREGADO' : '🛵 PREPARANDO DESPACHO'}.\nDirección: ${d.address}`;
            if (d.driver_name || d.courier) {
              waMsg += `\nRepartidor: ${d.driver_name || d.courier}`;
            }
            if (publicTrackUrl) {
              waMsg += `\n📍 Sigue tu entrega en vivo aquí: ${publicTrackUrl}`;
            } else if (d.tracking_url) {
              waMsg += `\nSigue la entrega en vivo aquí: ${d.tracking_url}`;
            }
            if (d.tracking_number) {
              waMsg += `\nN° de Guía / Tracking: ${d.tracking_number}`;
            }
            const waText = encodeURIComponent(waMsg);

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
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
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
                      {d.tracking_number && (
                        <a
                          href={`#tracking/${d.tracking_number}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          title="Abrir seguimiento público para el cliente"
                        >
                          📍 Tracking
                        </a>
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

                  {/* COURIER / DRIVER / TRACKING LINKS */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '4px' }}>
                    <span>
                      Repartidor: <b>{d.driver_name || d.courier || 'Sin asignar'}</b>
                    </span>
                    <span>Flete: <b>${Number(d.shipping_cost || 0).toFixed(2)}</b></span>
                  </div>

                  {/* TRACKING URL OR GUIDE NUMBER BADGES */}
                  {(d.tracking_url || d.tracking_number) && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {d.tracking_number && (
                        <a
                          href={`#tracking/${d.tracking_number}`}
                          target="_blank"
                          rel="noreferrer"
                          className="guide-pill"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                          title="Abrir página pública de rastreo"
                        >
                          📍 Tracking: <b>{d.tracking_number}</b>
                        </a>
                      )}
                      {d.tracking_url && (
                        <a
                          href={d.tracking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-indrive"
                          title="Abrir seguimiento en vivo del conductor"
                        >
                          🚗 GPS Conductor
                        </a>
                      )}
                    </div>
                  )}

                  {d.sale_total != null && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Ticket venta: <b>${Number(d.sale_total).toFixed(2)}</b> ({d.sale_channel === 'ONLINE' ? '🌐 Internet' : '🏪 Local'})
                    </div>
                  )}
                </div>

                <div className="deliv-actions">
                  {d.status === 'PENDING' && (
                    <button
                      type="button"
                      className="btn-deliv-action btn-transit"
                      onClick={() => {
                        setCourierModal(d);
                        const isIndrive = Boolean(d.tracking_url || (d.courier && /indrive|uber|didi/i.test(d.courier)));
                        const isServi = Boolean(d.tracking_number || (d.courier && /servientrega|tramaco|laar|cooperativa/i.test(d.courier)));
                        const initialType = isIndrive ? 'INDRIVE' : isServi ? 'SERVIENTREGA' : 'FLEET';
                        setDispatchType(initialType);
                        const selDr = drivers.find(dr => dr.id === d.driver_id);
                        setDispatchForm({
                          driverId: d.driver_id || '',
                          courier: d.courier || (initialType === 'FLEET' ? (selDr?.fullName || drivers[0]?.fullName || 'Motorizado Flota') : initialType === 'INDRIVE' ? 'InDrive' : 'Servientrega'),
                          trackingUrl: d.tracking_url || '',
                          trackingNumber: d.tracking_number || ''
                        });
                      }}
                    >
                      🚀 Despachar / Iniciar Ruta
                    </button>
                  )}
                  {d.status === 'IN_TRANSIT' && (
                    <button
                      type="button"
                      className="btn-deliv-action btn-delivered"
                      onClick={() => markDelivered(d.id)}
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
  const [techs,setTechs]=React.useState<Any[]>([]);
  const [showCreate,setShowCreate]=React.useState(false);
  const [filterStatus,setFilterStatus]=React.useState('ALL');
  const [filterTech,setFilterTech]=React.useState('ALL');
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
    quote:'',estimatedDelivery:'',assignedTechnicianId:'',slaHours:48
  });

  const [items,setItems]=React.useState<Array<{itemType:string,name:string,quantity:number,unitPrice:number}>>([]);

  const load=React.useCallback(()=>{
    api('/api/work-orders').then(x=>x.ok?x.json():[]).then(setR);
    api('/api/customers').then(x=>x.ok?x.json():[]).then(setCustomers);
    api('/api/work-orders/technicians').then(x=>x.ok?x.json():[]).then(setTechs);
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
        slaHours:Number(form.slaHours||48),
        assignedTechnicianId:form.assignedTechnicianId||null,
        items:items.filter(it=>it.name.trim()!=='')
      })
    });
    setBusy(false);
    if(res.ok){
      const created=await res.json();
      setMsg('Orden registrada y técnico asignado exitosamente');
      setForm({
        customerId:'',deviceBrand:'',deviceModel:'',serialNumber:'',
        reportedFault:'',accessories:'',description:'',diagnosis:'',
        quote:'',estimatedDelivery:'',assignedTechnicianId:'',slaHours:48
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
        assignedTechnicianId:editModal.assigned_technician_id||editModal.assignedTechnicianId||null,
        slaHours:Number(editModal.sla_hours||editModal.slaHours||48),
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

  function getSlaInfo(o:Any){
    if(o.status==='COMPLETED'){
      return {label:'✅ SLA Cumplido a tiempo',cls:'sla-completed'};
    }
    if(o.status==='CANCELLED'||o.status==='REJECTED'){
      return {label:o.status==='REJECTED'?'Cotización Rechazada':'Cancelada',cls:''};
    }
    if(!o.sla_deadline){
      return {label:`⏱️ Meta ${o.sla_hours||48}h SLA`,cls:'sla-ontime'};
    }
    const diffHours=(new Date(o.sla_deadline).getTime()-Date.now())/(1000*60*60);
    if(diffHours<0){
      const passed=Math.abs(Math.round(diffHours));
      return {label:`🚨 SLA Vencido hace ${passed}h`,cls:'sla-expired'};
    }
    if(diffHours<6){
      const left=Math.max(1,Math.round(diffHours));
      return {label:`⚠️ Urgente: Quedan ${left}h`,cls:'sla-warning'};
    }
    const left=Math.round(diffHours);
    return {label:`⏱️ En tiempo (${left}h restantes · SLA ${o.sla_hours||48}h)`,cls:'sla-ontime'};
  }

  const getFullUrl=(o:Any)=>{
    if(!o?.approval_url)return '';
    return window.location.origin+o.approval_url;
  };

  const getWaLink=(o:Any)=>{
    const phone=(o.customer_phone||'').replace(/[^0-9]/g,'');
    const url=getFullUrl(o);
    const folio=o.order_number||o.id?.slice(0,8).toUpperCase()||'';
    const name=o.customer_name||'estimado/a cliente';
    const device=`${o.device_brand||''} ${o.device_model||o.description||'dispositivo'}`.trim();

    let msg=`Hola ${name}, te saludamos de FixmeTiendas.\nTe compartimos el enlace para consultar tu orden #${folio} (${device}):\n${url}`;
    if(o.status==='DIAGNOSIS'||o.status==='OPEN'){
      msg=`Hola ${name}, tu equipo ${device} ha ingresado a taller para diagnóstico.\nOrden #${folio}.\nPuedes hacer seguimiento en vivo aquí:\n${url}`;
    }else if(o.status==='QUOTED'){
      msg=`Hola ${name}, tenemos listo el presupuesto para tu equipo ${device}.\nTotal cotizado: $${Number(o.quote||0).toFixed(2)}.\nPuedes revisar los repuestos y autorizar la reparación aquí:\n${url}`;
    }else if(o.status==='IN_PROGRESS'||o.status==='APPROVED'){
      msg=`Hola ${name}, tu equipo ${device} se encuentra en proceso de reparación técnica.\nOrden #${folio}.\nAvance en tiempo real: ${url}`;
    }else if(o.status==='COMPLETED'){
      msg=`¡Buenas noticias ${name}! 🎉\nTu equipo ${device} (Orden #${folio}) ya está LISTO para retiro en nuestra tienda.\nDetalle final: ${url}\n¡Te esperamos!`;
    }
    const text=encodeURIComponent(msg);
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
    const matchTech=!filterTech||filterTech==='ALL'||(
      filterTech==='UNASSIGNED'?!o.assigned_technician_id:o.assigned_technician_id===filterTech
    );
    const q=search.toLowerCase().trim();
    const matchSearch=!q||[
      o.order_number,o.customer_name,o.customer_phone,
      o.device_brand,o.device_model,o.serial_number,
      o.reported_fault,o.description,o.technician_name
    ].some(v=>v&&String(v).toLowerCase().includes(q));
    return matchStatus&&matchTech&&matchSearch;
  });

  return <>
    <section className="inventory-hero">
      <div>
        <span className="eyebrow">SERVICIO TÉCNICO Y TALLER ESPECIALIZADO</span>
        <h2>Órdenes de Trabajo & SLA</h2>
        <p>Asigna técnicos especializados, controla tiempos de entrega (SLA 24/48/72h) y desglose de mano de obra.</p>
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
          <p>Genera la ficha técnica, asigna el técnico responsable, fija el SLA y genera el QR del cliente.</p>
        </div>
        <button className="close-button" onClick={()=>setShowCreate(false)}>✕</button>
      </div>

      <form onSubmit={add}>
        <div className="form-section">
          <h4>Datos del Cliente y Equipo</h4>
          <div className="form-grid">
            <label>Cliente *
              <select value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})} required>
                <option value="">Selecciona un cliente</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone||c.email||'Sin contacto'}</option>)}
              </select>
            </label>
            <label>Marca *
              <input placeholder="Ej. Apple, Samsung, Lenovo, HP" value={form.deviceBrand} onChange={e=>setForm({...form,deviceBrand:e.target.value})} required/>
            </label>
            <label>Modelo del equipo *
              <input placeholder="Ej. iPhone 13 Pro, Pavilion 15" value={form.deviceModel} onChange={e=>setForm({...form,deviceModel:e.target.value})} required/>
            </label>
            <label>N° Serie o IMEI
              <input placeholder="Ej. 356789012345678" value={form.serialNumber} onChange={e=>setForm({...form,serialNumber:e.target.value})}/>
            </label>
          </div>
        </div>

        <div className="form-section" style={{marginTop:'16px'}}>
          <h4>Asignación Técnica & Compromiso SLA</h4>
          <div className="form-grid">
            <label>👨‍🔧 Técnico Responsable Asignado
              <select
                value={form.assignedTechnicianId}
                onChange={e=>setForm({...form,assignedTechnicianId:e.target.value})}
              >
                <option value="">-- Sin técnico asignado (Por asignar) --</option>
                {techs.map(t=>(
                  <option key={t.id} value={t.id}>
                    👨‍🔧 {t.fullName} ({t.phone||'Sin tel'})
                  </option>
                ))}
              </select>
            </label>

            <div>
              <label style={{marginBottom:'6px',display:'block'}}>⏱️ Compromiso SLA de Entrega</label>
              <div style={{display:'flex',gap:'6px',marginBottom:'6px'}}>
                {[
                  [24,'⚡ 24h Express'],
                  [48,'⏱️ 48h Estándar'],
                  [72,'🔬 72h Complejo']
                ].map(([hrs,lbl])=>(
                  <button
                    key={hrs}
                    type="button"
                    className={`toggle-btn ${Number(form.slaHours)===hrs?'active':''}`}
                    style={{fontSize:'11px',padding:'6px 10px'}}
                    onClick={()=>setForm({...form,slaHours:Number(hrs)})}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                placeholder="Horas SLA personalizadas"
                value={form.slaHours}
                onChange={e=>setForm({...form,slaHours:Number(e.target.value)})}
                style={{fontSize:'12px'}}
              />
            </div>

            <label>Fecha y hora estimada (opcional)
              <input type="datetime-local" value={form.estimatedDelivery} onChange={e=>setForm({...form,estimatedDelivery:e.target.value})}/>
            </label>

            <label>Accesorios recibidos
              <input placeholder="Ej. Funda, cargador original, sin SIM" value={form.accessories} onChange={e=>setForm({...form,accessories:e.target.value})}/>
            </label>
          </div>
        </div>

        <div className="form-section" style={{marginTop:'16px'}}>
          <h4>Falla y Diagnóstico Inicial</h4>
          <div className="form-grid">
            <label>Falla reportada por el cliente *
              <input placeholder="Ej. Pantalla rota, sobrecalentamiento, no enciende..." value={form.reportedFault} onChange={e=>setForm({...form,reportedFault:e.target.value})} required/>
            </label>
            <label>Diagnóstico preliminar
              <input placeholder="Ej. Requiere cambio de pantalla y mantenimiento térmico" value={form.diagnosis} onChange={e=>setForm({...form,diagnosis:e.target.value})}/>
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
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <select
            value={filterTech}
            onChange={e=>setFilterTech(e.target.value)}
            style={{fontSize:'13px',padding:'8px 12px',borderRadius:'8px',border:'1px solid #cbd5e1'}}
          >
            <option value="ALL">👨‍🔧 Todos los técnicos ({r.length})</option>
            {techs.map(t=>(
              <option key={t.id} value={t.id}>
                👨‍🔧 {t.fullName} ({r.filter(o=>o.assigned_technician_id===t.id).length})
              </option>
            ))}
            <option value="UNASSIGNED">Sin técnico asignado ({r.filter(o=>!o.assigned_technician_id).length})</option>
          </select>

          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Buscar orden, cliente, técnico, modelo o serie..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
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
        {filtered.map(o=>{
          const sla=getSlaInfo(o);
          return (
            <article className="order-card" key={o.id}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px',flexWrap:'wrap'}}>
                  <span className="order-folio" style={{fontSize:'11px',padding:'3px 8px'}}>{o.order_number||'OT'}</span>
                  <span className={`status-badge status-${String(o.status).toLowerCase()}`}>{statusLabel(o.status)}</span>
                  <span className={`sla-badge ${sla.cls}`}>{sla.label}</span>
                  <span className="tech-chip">👨‍🔧 {o.technician_name||'Sin técnico'}</span>
                  <small style={{color:'#98a1b2'}}>{o.created_at?new Date(o.created_at).toLocaleDateString():''}</small>
                </div>

                <strong>{o.device_brand||''} {o.device_model||o.description||'Dispositivo'}</strong>
                <small style={{display:'block',marginTop:'2px'}}>
                  👤 {o.customer_name||'Cliente'} {o.customer_phone?`· 📞 ${o.customer_phone}`:''} {o.serial_number?`· 🔢 Serie: ${o.serial_number}`:''}
                </small>

                <div className="order-card-meta" style={{marginTop:'8px'}}>
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

                <button className="btn-sm btn-secondary-sm" onClick={()=>openEditModal(o)} title="Actualizar diagnóstico, técnico, ítems y precio">
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
          );
        })}
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

    {/* MODAL ACTUALIZACIÓN TÉCNICA, SLA E ÍTEMS EN TALLER */}
    {editModal&&<div className="modal-overlay" onClick={()=>setEditModal(null)}>
      <div className="modal-card" style={{width:'min(640px,100%)'}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <h3>🛠️ Actualización Técnica · {editModal.order_number||'Orden'}</h3>
          <button className="close-button" onClick={()=>setEditModal(null)}>✕</button>
        </div>

        <form onSubmit={saveEditModal}>
          <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr',marginBottom:'12px'}}>
            <label>👨‍🔧 Técnico Responsable
              <select
                value={editModal.assigned_technician_id||editModal.assignedTechnicianId||''}
                onChange={e=>setEditModal({...editModal,assigned_technician_id:e.target.value})}
              >
                <option value="">-- Sin técnico asignado --</option>
                {techs.map(t=>(
                  <option key={t.id} value={t.id}>
                    👨‍🔧 {t.fullName} ({t.phone||'Sin tel'})
                  </option>
                ))}
              </select>
            </label>

            <label>⏱️ Horas SLA Comprometidas
              <input
                type="number"
                min="1"
                value={editModal.sla_hours||editModal.slaHours||48}
                onChange={e=>setEditModal({...editModal,sla_hours:Number(e.target.value)})}
              />
            </label>
          </div>

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

    {/* MODAL COMPROBANTE DE RECEPCIÓN TALLER (80mm) */}
    {ticketModal && (
      <WorkOrderReceiptModal
        order={ticketModal}
        onClose={() => setTicketModal(null)}
        tenantName={localStorage.tenantName || 'Fixme Tiendas'}
      />
    )}
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
function Warranties({api, notify, go}:{api:(u:string,o?:RequestInit)=>Promise<Response>, notify?:(msg:string)=>void, go?:(page:string)=>void}){
  const [rows, setRows] = React.useState<Any[]>([]);
  const [stats, setStats] = React.useState({ total: 0, active: 0, expiringSoon: 0, claimed: 0, expired: 0 });
  const [loading, setLoading] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');

  // Modals
  const [selectedCert, setSelectedCert] = React.useState<Any|null>(null);
  const [claimTarget, setClaimTarget] = React.useState<Any|null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [voidTarget, setVoidTarget] = React.useState<Any|null>(null);
  const [voidReason, setVoidReason] = React.useState('');

  // Selectors data
  const [products, setProducts] = React.useState<Any[]>([]);
  const [customers, setCustomers] = React.useState<Any[]>([]);
  const [technicians, setTechnicians] = React.useState<Any[]>([]);

  // Create form
  const [createForm, setCreateForm] = React.useState({
    productId: '',
    customerId: '',
    serialNumber: '',
    days: 365,
    terms: 'Garantía técnica oficial ante defectos de fábrica y mano de obra. No cubre humedad o caídas.'
  });

  // Claim form
  const [claimForm, setClaimForm] = React.useState({
    resolution: 'REPAIR_WORK_ORDER',
    notes: '',
    technicianId: '',
    slaHours: 48
  });
  const [submitting, setSubmitting] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') q.set('status', statusFilter);
      if (search.trim()) q.set('search', search.trim());
      
      const [rRows, rStats] = await Promise.all([
        api(`/api/warranties?${q.toString()}`),
        api('/api/warranties/stats')
      ]);

      if (rRows.ok) setRows(await rRows.json());
      if (rStats.ok) setStats(await rStats.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter, search]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Load auxiliary data for modals
  React.useEffect(() => {
    api(`/api/products?branchId=${branchId}`).then(r => r.ok ? r.json() : []).then(setProducts).catch(() => {});
    api('/api/customers').then(r => r.ok ? r.json() : []).then(setCustomers).catch(() => {});
    api('/api/work-orders/technicians').then(r => r.ok ? r.json() : []).then(setTechnicians).catch(() => {});
  }, [api]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.productId) {
      alert('Debes seleccionar un producto.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api('/api/warranties', {
        method: 'POST',
        body: JSON.stringify({
          productId: createForm.productId,
          customerId: createForm.customerId || null,
          serialNumber: createForm.serialNumber ? createForm.serialNumber.trim() : null,
          days: Number(createForm.days) || 365,
          terms: createForm.terms
        })
      });
      if (res.ok) {
        const created = await res.json();
        if (notify) notify('🛡️ Garantía emitida exitosamente: ' + (created.warranty_code || ''));
        setShowCreate(false);
        setCreateForm({
          productId: '',
          customerId: '',
          serialNumber: '',
          days: 365,
          terms: 'Garantía técnica oficial ante defectos de fábrica y mano de obra. No cubre humedad o caídas.'
        });
        loadData();
        setSelectedCert(created);
      } else {
        const err = await res.text();
        alert('Error al emitir garantía: ' + err);
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimTarget) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/warranties/${claimTarget.id}/claim`, {
        method: 'PATCH',
        body: JSON.stringify({
          notes: claimForm.notes,
          resolution: claimForm.resolution,
          technicianId: claimForm.technicianId || null,
          slaHours: Number(claimForm.slaHours) || 48
        })
      });
      if (res.ok) {
        const updated = await res.json();
        const otMsg = updated.work_order_number ? ` (Orden técnica creada: ${updated.work_order_number})` : '';
        if (notify) notify(`🛡️ Reclamo procesado exitosamente${otMsg}`);
        setClaimTarget(null);
        setClaimForm({
          resolution: 'REPAIR_WORK_ORDER',
          notes: '',
          technicianId: '',
          slaHours: 48
        });
        loadData();
      } else {
        const err = await res.text();
        alert('Error al procesar reclamo: ' + err);
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/warranties/${voidTarget.id}/void`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: voidReason || 'Anulada por administrador' })
      });
      if (res.ok) {
        if (notify) notify('Garantía anulada correctamente.');
        setVoidTarget(null);
        setVoidReason('');
        loadData();
      } else {
        alert('No se pudo anular la garantía.');
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const shareWhatsApp = (w: Any) => {
    const rawPhone = (w.customer_phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('0') ? '593' + rawPhone.slice(1) : (rawPhone || '');
    const verifyUrl = `${window.location.origin}/public/warranties/verify?token=${w.tenant_id}.${w.warranty_code}`;
    const text = `Hola ${w.customer_name || 'Estimado cliente'}, aquí tiene su Certificado Oficial de Garantía de *${w.product_name || 'su equipo'}* emitido por *Fixme Tiendas*.\n\n🛡️ *Código de Garantía:* ${w.warranty_code}\n📅 *Válido hasta:* ${new Date(w.expires_at).toLocaleDateString()}\n🔍 *Consulta tu cobertura en vivo:* ${verifyUrl}`;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="warranties-page">
      {/* Header with Title and Primary Actions */}
      <section className="panel" style={{marginBottom: 16}}>
        <div className="panel-head" style={{flexWrap: 'wrap', gap: 12}}>
          <div>
            <h2 style={{fontSize: 20, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8}}>
              🛡️ Garantías y Pólizas Técnicas
            </h2>
            <p style={{margin: 0, fontSize: 13, color: '#64748b'}}>
              Control integral de garantías, certificados 80mm con QR en tiempo real y flujo automático hacia Taller.
            </p>
          </div>
          <div style={{display: 'flex', gap: 8}}>
            <button className="secondary" onClick={() => loadData()} title="Recargar lista" style={{display: 'flex', alignItems: 'center', gap: 5}}>
              🔄 Refrescar
            </button>
            <button onClick={() => setShowCreate(true)} style={{display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700}}>
              ➕ Emitir Garantía Manual
            </button>
          </div>
        </div>

        {/* KPI Metrics Cards */}
        <div className="warranty-kpi-grid" style={{marginTop: 16}}>
          <div
            className={`warranty-kpi-card ${statusFilter === 'ALL' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            <span className="kpi-label">📋 Total Registradas</span>
            <span className="kpi-value">{stats.total}</span>
          </div>
          <div
            className={`warranty-kpi-card kpi-active ${statusFilter === 'ACTIVE' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            <span className="kpi-label">🟢 Vigentes</span>
            <span className="kpi-value">{stats.active}</span>
          </div>
          <div
            className={`warranty-kpi-card kpi-expiring ${statusFilter === 'EXPIRING_SOON' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('EXPIRING_SOON')}
          >
            <span className="kpi-label">⚠️ Por Vencer (&le;15d)</span>
            <span className="kpi-value">{stats.expiringSoon}</span>
          </div>
          <div
            className={`warranty-kpi-card kpi-claimed ${statusFilter === 'CLAIMED' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('CLAIMED')}
          >
            <span className="kpi-label">🛠️ Reclamadas / Taller</span>
            <span className="kpi-value">{stats.claimed}</span>
          </div>
          <div
            className={`warranty-kpi-card kpi-expired ${statusFilter === 'EXPIRED' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('EXPIRED')}
          >
            <span className="kpi-label">🔴 Vencidas</span>
            <span className="kpi-value">{stats.expired}</span>
          </div>
        </div>

        {/* Toolbar: Search and Filter Pills */}
        <div className="warranty-controls">
          <div className="warranty-search-wrap">
            <span className="warranty-search-icon">🔍</span>
            <input
              type="text"
              className="warranty-search-input"
              placeholder="Buscar por código, serie, producto, cliente o teléfono..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '2px 6px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="warranty-filter-pills">
            {[
              ['ALL', 'Todas'],
              ['ACTIVE', '🟢 Vigentes'],
              ['EXPIRING_SOON', '⚠️ Por Vencer'],
              ['CLAIMED', '🛠️ Reclamadas'],
              ['EXPIRED', '🔴 Vencidas'],
              ['VOID', '⚪ Anuladas']
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`warranty-pill ${statusFilter === k ? 'active' : ''}`}
                onClick={() => setStatusFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Warranties Table */}
      <section className="panel table-panel">
        <div className="panel-head">
          <h3>
            Listado de Garantías {statusFilter !== 'ALL' && <small style={{color: '#64748b'}}>({statusFilter})</small>}
          </h3>
          <span style={{fontSize: 12, color: '#64748b'}}>{rows.length} registros encontrados</span>
        </div>

        {loading ? (
          <div style={{textAlign: 'center', padding: 32, color: '#64748b'}}>
            <p>Cargando garantías...</p>
          </div>
        ) : rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código / Serie</th>
                  <th>Producto</th>
                  <th>Cliente</th>
                  <th>Plazo / Cobertura</th>
                  <th>Estado / Resolución</th>
                  <th style={{textAlign: 'right'}}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: Any) => {
                  const isExpiring = r.status === 'ACTIVE' && r.remaining_days <= 15 && r.remaining_days >= 0;
                  return (
                    <tr key={r.id}>
                      <td data-label="Código">
                        <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
                          <strong style={{fontFamily: 'monospace', fontSize: 13, color: '#1e293b'}}>
                            {r.warranty_code || 'GAR-XXXX'}
                          </strong>
                          {r.serial_number ? (
                            <span className="serial-tag" title={r.serial_number}>
                              S/N: {r.serial_number}
                            </span>
                          ) : (
                            <small style={{color: '#94a3b8', fontSize: 11}}>Sin N° de Serie</small>
                          )}
                        </div>
                      </td>
                      <td data-label="Producto">
                        <div style={{display: 'flex', flexDirection: 'column'}}>
                          <strong style={{fontSize: 13, color: '#0f172a'}}>
                            {r.product_name || 'Producto'}
                          </strong>
                          <div style={{display: 'flex', gap: 6, fontSize: 11, color: '#64748b', marginTop: 2}}>
                            <span>SKU: {r.product_sku || 'N/A'}</span>
                            {r.product_price ? <span>• ${Number(r.product_price).toFixed(2)}</span> : null}
                          </div>
                        </div>
                      </td>
                      <td data-label="Cliente">
                        <div style={{display: 'flex', flexDirection: 'column'}}>
                          <strong style={{fontSize: 12.5, color: '#334155'}}>
                            {r.customer_name || 'Consumidor Final'}
                          </strong>
                          {r.customer_phone && (
                            <small style={{color: '#64748b', display: 'flex', alignItems: 'center', gap: 4}}>
                              📞 {r.customer_phone}
                            </small>
                          )}
                        </div>
                      </td>
                      <td data-label="Plazo">
                        <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
                          <div style={{fontSize: 11.5, color: '#475569'}}>
                            {new Date(r.starts_at).toLocaleDateString()} &rarr; {new Date(r.expires_at).toLocaleDateString()}
                          </div>
                          <div>
                            {r.status === 'ACTIVE' ? (
                              isExpiring ? (
                                <span className="days-counter warning">⚠️ Vence en {r.remaining_days}d</span>
                              ) : (
                                <span className="days-counter good">🟢 {r.remaining_days}d restantes</span>
                              )
                            ) : r.status === 'CLAIMED' ? (
                              <span className="days-counter" style={{background: '#eff6ff', color: '#1e40af'}}>
                                🛡️ Reclamada
                              </span>
                            ) : r.status === 'EXPIRED' ? (
                              <span className="days-counter danger">🔴 Expirada</span>
                            ) : (
                              <span className="days-counter" style={{background: '#f1f5f9', color: '#64748b'}}>
                                ⚪ Anulada
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-label="Estado">
                        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                          <span className={`w-badge ${r.status}`}>
                            {r.status === 'ACTIVE'
                              ? 'VIGENTE'
                              : r.status === 'CLAIMED'
                              ? 'RECLAMADA'
                              : r.status === 'EXPIRED'
                              ? 'VENCIDA'
                              : 'ANULADA'}
                          </span>
                          {r.claim_resolution && (
                            <small style={{fontSize: 11, color: '#475569', fontWeight: 600}}>
                              {r.claim_resolution === 'REPAIR_WORK_ORDER'
                                ? '🛠️ Reparación Taller'
                                : r.claim_resolution === 'REPLACEMENT'
                                ? '🔄 Reemplazo'
                                : r.claim_resolution === 'REFUND'
                                ? '💰 Reembolso'
                                : '🎧 Asistencia'}
                            </small>
                          )}
                          {r.work_order_number && (
                            <button
                              type="button"
                              onClick={() => go && go('work-orders')}
                              style={{
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                color: '#166534',
                                borderRadius: 6,
                                padding: '2px 6px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: 'fit-content'
                              }}
                              title="Ver en Taller"
                            >
                              📋 {r.work_order_number} ({r.work_order_status || 'TALLER'}) &rarr;
                            </button>
                          )}
                        </div>
                      </td>
                      <td data-label="Acciones" style={{textAlign: 'right'}}>
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap'}}>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setSelectedCert(r)}
                            style={{padding: '5px 9px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4}}
                            title="Ver e Imprimir Certificado de Garantía"
                          >
                            📜 Certificado
                          </button>
                          {r.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => {
                                setClaimTarget(r);
                                setClaimForm({
                                  resolution: 'REPAIR_WORK_ORDER',
                                  notes: '',
                                  technicianId: '',
                                  slaHours: 48
                                });
                              }}
                              style={{
                                padding: '5px 9px',
                                fontSize: 11.5,
                                background: '#3157d5',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Procesar reclamo de garantía"
                            >
                              🛡️ Reclamar
                            </button>
                          )}
                          {r.status === 'ACTIVE' && (
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => {
                                setVoidTarget(r);
                                setVoidReason('');
                              }}
                              style={{padding: '5px 8px', fontSize: 11, color: '#ef4444', borderColor: '#fca5a5'}}
                              title="Anular garantía"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <b>🛡️</b>
            <p>No se encontraron garantías registradas con los filtros actuales.</p>
            <small>Puedes emitir una nueva garantía manual o generarla automáticamente al registrar una venta en el POS.</small>
            <button onClick={() => setShowCreate(true)} style={{marginTop: 12}}>
              ➕ Emitir Primera Garantía
            </button>
          </div>
        )}
      </section>

      {/* MODAL: Certificado Oficial Térmico 80mm + QR + WhatsApp */}
      {selectedCert && (
        <div className="modal-overlay" onClick={() => setSelectedCert(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: 420}}>
            <div className="modal-header">
              <div>
                <h3 style={{margin: 0}}>📜 Certificado de Garantía</h3>
                <small style={{color: '#64748b'}}>Ticket oficial 80mm para el cliente</small>
              </div>
              <button className="modal-close" onClick={() => setSelectedCert(null)}>✕</button>
            </div>

            <div className="cert-container">
              <div id="printable-warranty-cert" className="thermal-cert">
                <div className="cert-header">
                  <h4 className="cert-store">Fixme Tiendas</h4>
                  <p className="cert-subtitle">Servicio Técnico y Garantías Oficiales</p>
                  <div className="cert-code-badge">{selectedCert.warranty_code || 'GAR-CERT'}</div>
                </div>

                <div className="cert-section">
                  <div className="cert-row">
                    <span>Estado:</span>
                    <strong>
                      {selectedCert.status === 'ACTIVE' ? '🟢 VIGENTE (COBERTURA TOTAL)' : selectedCert.status}
                    </strong>
                  </div>
                  <div className="cert-row">
                    <span>Emisión:</span>
                    <strong>{new Date(selectedCert.starts_at).toLocaleDateString()}</strong>
                  </div>
                  <div className="cert-row">
                    <span>Vencimiento:</span>
                    <strong>{new Date(selectedCert.expires_at).toLocaleDateString()}</strong>
                  </div>
                  <div className="cert-row">
                    <span>Días Restantes:</span>
                    <strong>{selectedCert.remaining_days} días</strong>
                  </div>
                </div>

                <div className="cert-section">
                  <div className="cert-row">
                    <span>Producto:</span>
                    <strong>{selectedCert.product_name || 'Equipo / Repuesto'}</strong>
                  </div>
                  <div className="cert-row">
                    <span>SKU:</span>
                    <strong>{selectedCert.product_sku || 'N/A'}</strong>
                  </div>
                  <div className="cert-row">
                    <span>N° Serie / IMEI:</span>
                    <strong>{selectedCert.serial_number || 'N/A'}</strong>
                  </div>
                </div>

                <div className="cert-section">
                  <div className="cert-row">
                    <span>Cliente:</span>
                    <strong>{selectedCert.customer_name || 'Consumidor Final'}</strong>
                  </div>
                  {selectedCert.customer_phone && (
                    <div className="cert-row">
                      <span>Teléfono:</span>
                      <strong>{selectedCert.customer_phone}</strong>
                    </div>
                  )}
                </div>

                <div className="cert-terms">
                  <strong>Términos de Cobertura:</strong>
                  <p style={{margin: '4px 0 0'}}>
                    {selectedCert.terms || 'Cubre defectos de fábrica y mano de obra. No cubre caídas, humedad o intervención de terceros no autorizados.'}
                  </p>
                </div>

                {/* QR Code */}
                <div className="cert-qr-wrap">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                      `${window.location.origin}/public/warranties/verify?token=${selectedCert.tenant_id}.${selectedCert.warranty_code}`
                    )}`}
                    alt="QR Garantía"
                  />
                  <div className="cert-qr-hint">Escanee para verificar vigencia oficial en línea</div>
                </div>

                <div className="cert-footer">
                  <p style={{margin: '0 0 2px'}}>¡Gracias por su preferencia!</p>
                  <p style={{margin: 0}}>Fixme Tiendas • Soporte Especializado</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="cert-actions">
                <button
                  type="button"
                  className="btn-whatsapp"
                  onClick={() => shareWhatsApp(selectedCert)}
                >
                  💬 Enviar WhatsApp
                </button>
                <button
                  type="button"
                  className="btn-print"
                  onClick={() => window.print()}
                >
                  🖨️ Imprimir (80mm)
                </button>
                <button
                  type="button"
                  className="secondary"
                  style={{width: '100%'}}
                  onClick={() => {
                    const link = `${window.location.origin}/public/warranties/verify?token=${selectedCert.tenant_id}.${selectedCert.warranty_code}`;
                    navigator.clipboard.writeText(link);
                    if (notify) notify('Enlace público de garantía copiado al portapapeles');
                  }}
                >
                  📋 Copiar Enlace Público de Verificación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Procesar Reclamo de Garantía (Conexión Taller $0.00) */}
      {claimTarget && (
        <div className="modal-overlay" onClick={() => setClaimTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: 520}}>
            <div className="modal-header">
              <div>
                <h3 style={{margin: 0}}>🛡️ Procesar Reclamo de Garantía</h3>
                <small style={{color: '#64748b'}}>
                  {claimTarget.warranty_code} • {claimTarget.product_name}
                </small>
              </div>
              <button className="modal-close" onClick={() => setClaimTarget(null)}>✕</button>
            </div>

            <form onSubmit={handleClaim} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <div style={{background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, fontSize: 12}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                  <span style={{color: '#64748b'}}>Cliente:</span>
                  <strong>{claimTarget.customer_name || 'Consumidor Final'}</strong>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                  <span style={{color: '#64748b'}}>Número de Serie:</span>
                  <strong>{claimTarget.serial_number || 'N/A'}</strong>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{color: '#64748b'}}>Vigencia restante:</span>
                  <span style={{color: '#059669', fontWeight: 700}}>{claimTarget.remaining_days} días de cobertura</span>
                </div>
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 6}}>
                  Resolución del Reclamo:
                </label>
                <div className="resolution-grid">
                  <div
                    className={`resolution-card ${claimForm.resolution === 'REPAIR_WORK_ORDER' ? 'selected' : ''}`}
                    onClick={() => setClaimForm({...claimForm, resolution: 'REPAIR_WORK_ORDER'})}
                  >
                    <input
                      type="radio"
                      name="res"
                      checked={claimForm.resolution === 'REPAIR_WORK_ORDER'}
                      onChange={() => setClaimForm({...claimForm, resolution: 'REPAIR_WORK_ORDER'})}
                    />
                    <div className="resolution-info">
                      <strong>🛠️ Crear Orden de Trabajo en Taller ($0.00 Cobertura Total)</strong>
                      <small>Genera automáticamente la OT técnica con número de seguimiento y SLA garantizado sin costo al cliente.</small>
                    </div>
                  </div>

                  <div
                    className={`resolution-card ${claimForm.resolution === 'REPLACEMENT' ? 'selected' : ''}`}
                    onClick={() => setClaimForm({...claimForm, resolution: 'REPLACEMENT'})}
                  >
                    <input
                      type="radio"
                      name="res"
                      checked={claimForm.resolution === 'REPLACEMENT'}
                      onChange={() => setClaimForm({...claimForm, resolution: 'REPLACEMENT'})}
                    />
                    <div className="resolution-info">
                      <strong>🔄 Reemplazo / Cambio Directo de Unidad</strong>
                      <small>Autoriza entrega de producto sustituto nuevo o refabricado al cliente.</small>
                    </div>
                  </div>

                  <div
                    className={`resolution-card ${claimForm.resolution === 'REFUND' ? 'selected' : ''}`}
                    onClick={() => setClaimForm({...claimForm, resolution: 'REFUND'})}
                  >
                    <input
                      type="radio"
                      name="res"
                      checked={claimForm.resolution === 'REFUND'}
                      onChange={() => setClaimForm({...claimForm, resolution: 'REFUND'})}
                    />
                    <div className="resolution-info">
                      <strong>💰 Nota de Crédito / Reembolso Comercial</strong>
                      <small>Devolución del importe pagado o emisión de saldo a favor en tienda.</small>
                    </div>
                  </div>
                </div>
              </div>

              {claimForm.resolution === 'REPAIR_WORK_ORDER' && (
                <div style={{background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10}}>
                  <strong style={{fontSize: 12, color: '#1e40af'}}>Detalles Técnicos para el Taller:</strong>
                  
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                    <div>
                      <label style={{fontSize: 11, color: '#1e3a8a', display: 'block', marginBottom: 3}}>Técnico Asignado</label>
                      <select
                        value={claimForm.technicianId}
                        onChange={e => setClaimForm({...claimForm, technicianId: e.target.value})}
                        style={{width: '100%', fontSize: 12, padding: 8, borderRadius: 6, border: '1px solid #93c5fd'}}
                      >
                        <option value="">-- Asignación Automática --</option>
                        {technicians.map((t: Any) => (
                          <option key={t.id} value={t.id}>{t.fullName || t.email}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{fontSize: 11, color: '#1e3a8a', display: 'block', marginBottom: 3}}>SLA / Plazo Máximo</label>
                      <select
                        value={claimForm.slaHours}
                        onChange={e => setClaimForm({...claimForm, slaHours: Number(e.target.value)})}
                        style={{width: '100%', fontSize: 12, padding: 8, borderRadius: 6, border: '1px solid #93c5fd'}}
                      >
                        <option value={24}>⚡ Express 24 horas</option>
                        <option value={48}>🕒 Estándar 48 horas</option>
                        <option value={72}>📆 Extendido 72 horas</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Motivo del Reclamo / Falla Reportada por el Cliente:
                </label>
                <textarea
                  required
                  rows={3}
                  value={claimForm.notes}
                  onChange={e => setClaimForm({...claimForm, notes: e.target.value})}
                  placeholder="Ej: La pantalla presenta líneas verticales o el equipo no enciende tras carga..."
                  style={{width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12}}
                />
              </div>

              <div className="modal-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10}}>
                <button type="button" className="secondary" onClick={() => setClaimTarget(null)}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} style={{fontWeight: 700}}>
                  {submitting ? 'Procesando...' : 'Confirmar Reclamo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Nueva Garantía Manual */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: 520}}>
            <div className="modal-header">
              <div>
                <h3 style={{margin: 0}}>➕ Emitir Garantía Manual</h3>
                <small style={{color: '#64748b'}}>Emisión directa con código único y certificado QR</small>
              </div>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Producto Cubierto: *
                </label>
                <select
                  required
                  value={createForm.productId}
                  onChange={e => setCreateForm({...createForm, productId: e.target.value})}
                  style={{width: '100%', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
                >
                  <option value="">-- Selecciona el producto --</option>
                  {products.map((p: Any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (SKU: {p.sku}) - ${Number(p.price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Cliente Titular (Opcional):
                </label>
                <select
                  value={createForm.customerId}
                  onChange={e => setCreateForm({...createForm, customerId: e.target.value})}
                  style={{width: '100%', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
                >
                  <option value="">-- Consumidor Final / Mostrador --</option>
                  {customers.map((c: Any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Número de Serie / IMEI / Código de Equipo:
                </label>
                <input
                  type="text"
                  placeholder="Ej: SN-APP-2026-X01 o IMEI 3548..."
                  value={createForm.serialNumber}
                  onChange={e => setCreateForm({...createForm, serialNumber: e.target.value})}
                  style={{width: '100%', boxSizing: 'border-box', padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
                />
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Plazo de Cobertura (Días):
                </label>
                <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6}}>
                  {[
                    [30, '30 días (1 mes)'],
                    [90, '90 días (3 meses)'],
                    [180, '180 días (6 meses)'],
                    [365, '1 año (365 d)'],
                    [730, '2 años (730 d)']
                  ].map(([d, lbl]) => (
                    <button
                      key={d}
                      type="button"
                      className={`chip ${createForm.days === d ? 'active' : ''}`}
                      onClick={() => setCreateForm({...createForm, days: Number(d)})}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        borderRadius: 16,
                        border: '1px solid #cbd5e1',
                        background: createForm.days === d ? '#1e293b' : '#fff',
                        color: createForm.days === d ? '#fff' : '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={createForm.days}
                  onChange={e => setCreateForm({...createForm, days: Number(e.target.value)})}
                  style={{width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13}}
                />
              </div>

              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Términos y Condiciones:
                </label>
                <textarea
                  rows={2}
                  value={createForm.terms}
                  onChange={e => setCreateForm({...createForm, terms: e.target.value})}
                  style={{width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12}}
                />
              </div>

              <div className="modal-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10}}>
                <button type="button" className="secondary" onClick={() => setShowCreate(false)}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} style={{fontWeight: 700}}>
                  {submitting ? 'Generando...' : 'Emitir Garantía Oficial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Anular Garantía */}
      {voidTarget && (
        <div className="modal-overlay" onClick={() => setVoidTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: 440}}>
            <div className="modal-header">
              <h3 style={{margin: 0, color: '#ef4444'}}>✕ Anular Garantía</h3>
              <button className="modal-close" onClick={() => setVoidTarget(null)}>✕</button>
            </div>
            <form onSubmit={handleVoid} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <p style={{fontSize: 13, color: '#475569', margin: 0}}>
                ¿Estás seguro de que deseas anular la garantía <strong>{voidTarget.warranty_code}</strong> correspondiente a <strong>{voidTarget.product_name}</strong>?
              </p>
              <div>
                <label style={{fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 4}}>
                  Motivo de anulación:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Devolución comercial, producto canjeado o error de registro"
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  style={{width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12}}
                />
              </div>
              <div className="modal-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                <button type="button" className="secondary" onClick={() => setVoidTarget(null)}>
                  Volver
                </button>
                <button type="submit" disabled={submitting} style={{background: '#ef4444', color: '#fff', fontWeight: 700}}>
                  {submitting ? 'Anulando...' : 'Confirmar Anulación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
function Table({title,columns,rows,empty,action}:{title:string,columns:string[],rows:Any[],empty:string,action?:string}){return <section className="panel table-panel"><div className="panel-head"><h3>{title}</h3>{action&&<button>{action}</button>}</div>{rows.length?<div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c.replace(/([A-Z])/g,' $1')}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{columns.map(c=><td data-label={c.replace(/([A-Z])/g,' $1')} key={c}>{c==='price'||c==='quote'||c==='total'?`$${Number(r[c]||0).toFixed(2)}`:c==='approval_url'?<a href={r[c]} target="_blank" rel="noreferrer">Abrir autorización</a>:r[c]??'*'}</td>)}</tr>)}</tbody></table></div>:<div className="empty"><b>--</b><p>{empty}</p><small>Los registros aparecerán aquí.</small></div>}</section>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
