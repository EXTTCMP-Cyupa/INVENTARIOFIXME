import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import './design-system.css';

// Public & external modules
import { PublicCatalog, PublicDeliveryTracking, PublicWorkOrderTracking, CatalogShareModal, PublicRepairRequestWizard, PublicLeadTracking } from './publicModules';
import { CustomerPortal } from './customerPortal';
import { MarketplaceView } from './marketplaceView';
import { QuotesPage, PublicQuoteView } from './quotesModule';
import { PocketMobileView } from './pocketMobileView';
import { getPendingSales } from './offlineDb';
import { LandingPage } from './landingPage';
import { Sidebar } from './Sidebar';
import { PurchasesModule } from './purchasesModule';
import { ImportsModule } from './importsModule';

// Shared config & utilities
import { Any, getTenantId, setTenantId, getBranchId, setBranchId, nav, moduleKey, ErrorBoundary } from './sharedConfig';

// Extracted Page Components
import { Login, StoreTrialUpgradeModal } from './pages/auth/LoginPage';
import { Cash } from './pages/pos/CashPage';
import { POS } from './pages/pos/PosPage';
import { Sales } from './pages/pos/SalesPage';
import { PlatformAdministration } from './pages/admin/PlatformSaasPage';
import { Administration } from './pages/admin/StoreAdminPage';
import { Dashboard } from './pages/dashboard/DashboardPage';
import { MyWork } from './pages/workshop/MyWorkPage';
import { Orders } from './pages/workshop/WorkOrdersPage';
import { Warranties } from './pages/workshop/WarrantiesPage';
import { Products } from './pages/inventory/ProductsPage';
import { Customers } from './pages/operations/CustomersPage';
import { Deliveries } from './pages/operations/DeliveriesPage';
import { Reports } from './pages/operations/ReportsPage';
import { ToastStack, ToastMessage } from './components/ui/ModernUiKit';

// Lucide Icons
import {
  Search, Smartphone, User, Wrench, Sun, Moon, QrCode, Sparkles, Store
} from 'lucide-react';

function App() {
  // 1. ALL useState hooks
  const [token, setToken] = React.useState(localStorage.token || '');
  const [page, setPage] = React.useState('home');
  const [mods, setMods] = React.useState<Any[]>([]);
  const [toast, setToast] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const notify = React.useCallback((msg: string | { message: string; type?: 'success' | 'error' | 'warning' | 'info'; title?: string }) => {
    const id = Math.random().toString(36).substring(2, 9);
    const text = typeof msg === 'string' ? msg : msg.message;
    const isErr = text.toLowerCase().includes('error') || text.toLowerCase().includes('falló') || text.toLowerCase().includes('no se pudo');
    const isWarn = text.toLowerCase().includes('alerta') || text.toLowerCase().includes('atención') || text.toLowerCase().includes('pendiente');
    const type = typeof msg === 'object' && msg.type ? msg.type : (isErr ? 'error' : isWarn ? 'warning' : 'success');
    const title = typeof msg === 'object' && msg.title ? msg.title : undefined;
    setToasts(prev => [...prev.slice(-4), { id, message: text, type, title }]);
    setToast(text);
  }, []);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [hash, setHash] = React.useState(window.location.hash || window.location.search);
  const [showCatalogModal, setShowCatalogModal] = React.useState(false);
  const [theme, setTheme] = React.useState<string>(localStorage.theme || 'light');
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState<boolean>(() => localStorage.getItem('fixme_sidebar_collapsed') === 'true');
  const [shellOrderCounts, setShellOrderCounts] = React.useState<Any | null>(null);
  const [viewMode, setViewMode] = React.useState<'DESKTOP' | 'POCKET'>(() => {
    const saved = localStorage.getItem('fixme_view_mode');
    if (saved === 'DESKTOP' || saved === 'POCKET') return saved;
    return (window.innerWidth <= 768 || window.location.hash.includes('pocket')) ? 'POCKET' : 'DESKTOP';
  });
  const [trialInfo, setTrialInfo] = React.useState<{isTrial?:boolean;daysRemaining?:number;trialEndsAt?:string}|null>(() => {
    if (localStorage.isTrial === 'true') {
      return {
        isTrial: true,
        daysRemaining: localStorage.trialDaysRemaining !== undefined && localStorage.trialDaysRemaining !== '' ? parseInt(localStorage.trialDaysRemaining, 10) : 15,
        trialEndsAt: localStorage.trialEndsAt || ''
      };
    }
    return null;
  });
  const [showTrialModal, setShowTrialModal] = React.useState(false);
  const [showQuickAccess, setShowQuickAccess] = React.useState(false);
  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  const [commandQuery, setCommandQuery] = React.useState('');
  const [commandSelectedIndex, setCommandSelectedIndex] = React.useState(0);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [pendingOfflineSalesCount, setPendingOfflineSalesCount] = React.useState(0);
  const [companyInfo, setCompanyInfo] = React.useState<Any>(() => ({
    name: localStorage.tenantName || 'FIXMETIENDAS',
    legalName: localStorage.tenantLegalName || localStorage.tenantName || 'FIXMETIENDAS',
    ruc: localStorage.tenantRuc || '1790012345001',
    address: localStorage.tenantAddress || 'Matriz Principal, Ecuador',
    phone: localStorage.tenantPhone || '0994175857',
    email: localStorage.tenantEmail || 'contacto@fixmetiendas.com',
    slogan: localStorage.tenantSlogan || 'Con la Mejor Innovación en Tecnología'
  }));

  const toggleSidebarCollapsed = () => setSidebarCollapsed(prev => {
    const next = !prev;
    localStorage.setItem('fixme_sidebar_collapsed', String(next));
    return next;
  });

  const handleLogout = React.useCallback(() => {
    localStorage.clear();
    setTenantId('00000000-0000-0000-0000-000000000001');
    setBranchId('00000000-0000-0000-0000-000000000010');
    setToken('');
    setPage('home');
    window.location.hash = '';
    setHash('');
  }, []);

  const go = React.useCallback((k: string) => {
    setPage(k);
    setMenuOpen(false);
  }, []);

  // Claims decoding
  let role = '';
  let userPerms: string[] = [];
  let userTenantId = getTenantId();
  let branchId = getBranchId();

  try {
    if (token) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const claims = JSON.parse(jsonPayload);
        role = (claims.primary_role || claims.scope || '').replace('SCOPE_', '').split(' ')[0];
        if (claims.tenant_id) {
          userTenantId = claims.tenant_id;
          setTenantId(claims.tenant_id);
        }
        if (claims.branch_id) {
          branchId = claims.branch_id;
          setBranchId(claims.branch_id);
        }
        if (Array.isArray(claims.permissions)) {
          userPerms = claims.permissions;
          if ((role === 'MANAGER' || role === 'SELLER' || role === 'ACCOUNTANT') && !userPerms.includes('quotes')) {
            userPerms = [...userPerms, 'quotes'];
          }
          if ((role === 'MANAGER' || role === 'SELLER') && !userPerms.includes('purchases')) {
            userPerms = [...userPerms, 'purchases', 'imports'];
          }
          if (!userPerms.includes('marketplace')) {
            userPerms = [...userPerms, 'marketplace'];
          }
        }
      }
    }
  } catch (e) {
    console.error('Error decoding JWT token:', e);
  }

  const isSaasOwner = role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN';
  const saasNav: [string, string, string][] = [
    ['platform-overview', 'Panel SaaS', '📊'],
    ['platform-companies', 'Empresas', '🏢'],
    ['platform-trials', 'Empresas de Prueba', '🧪'],
    ['platform-rates', 'Tarifas por Empresa', '🏷️'],
    ['platform-plans', 'Planes & Módulos', '🧩'],
    ['platform-payments', 'Cobranzas y Recibos', '🧾']
  ];
  const allowed: Record<string, string[]> = {
    SUPER_ADMIN: saasNav.map(n => n[0]),
    TENANT_ADMIN: saasNav.map(n => n[0]),
    MANAGER: ['home','my-work','cash','pos','sales','quotes','administration','products','purchases','imports','customers','deliveries','work-orders','marketplace','warranties','reports'],
    SELLER: ['home','cash','pos','sales','quotes','products','purchases','imports','customers','work-orders','marketplace','warranties'],
    DELIVERY: ['home','customers','deliveries'],
    TECHNICIAN: ['home','my-work','customers','work-orders','marketplace','warranties'],
    ACCOUNTANT: ['home','cash','sales','quotes','reports']
  };

  const enabled = React.useCallback((key: string) => {
    if (isSaasOwner || mods.length === 0) return true;
    const found = mods.find(m => m.moduleKey === key);
    return found ? found.enabled : true;
  }, [isSaasOwner, mods]);

  const rawVisible = isSaasOwner ? saasNav.map(n => n[0]) : (userPerms.length > 0 ? userPerms : (allowed[role] || ['home']));
  const visible = isSaasOwner ? rawVisible : rawVisible.filter(p => p === 'home' || p === 'administration' || enabled(moduleKey(p)));
  const item = (key: string) => isSaasOwner ? saasNav.find(n => n[0] === key) : nav.find(n => n[0] === key);

  const api = React.useCallback((url: string, opt: RequestInit = {}) => {
    return fetch(url, {
      ...opt,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        ...(opt.headers || {})
      }
    });
  }, [token]);

  React.useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      getPendingSales().then(list => setPendingOfflineSalesCount(list.length)).catch(() => {});
    };
    const onOffline = () => {
      setIsOnline(false);
      getPendingSales().then(list => setPendingOfflineSalesCount(list.length)).catch(() => {});
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    getPendingSales().then(list => setPendingOfflineSalesCount(list.length)).catch(() => {});
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        setCommandQuery('');
        setCommandSelectedIndex(0);
      }
      if (e.key === 'Escape' && showCommandPalette) {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCommandPalette]);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.theme = theme;
  }, [theme]);

  React.useEffect(() => {
    const h = () => setHash(window.location.hash || window.location.search);
    window.addEventListener('hashchange', h);
    window.addEventListener('popstate', h);
    return () => {
      window.removeEventListener('hashchange', h);
      window.removeEventListener('popstate', h);
    };
  }, []);

  React.useEffect(() => {
    if (!showQuickAccess) return;
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.header-quick-access-wrap')) {
        setShowQuickAccess(false);
      }
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [showQuickAccess]);

  React.useEffect(() => {
    if (isSaasOwner && (page === 'home' || !saasNav.some(n => n[0] === page))) {
      setPage('platform-companies');
    }
  }, [isSaasOwner, page]);

  React.useEffect(() => {
    if (token && !isSaasOwner) {
      api('/api/modules').then(r => r.ok ? r.json() : []).then(setMods).catch(() => {});
    }
  }, [token, api, isSaasOwner]);

  React.useEffect(() => {
    if (token && !isSaasOwner) {
      api('/api/branches').then(r => r.ok ? r.json() : []).then(branches => {
        if (Array.isArray(branches) && branches.length > 0) {
          if (!branches.some((b: Any) => b.id === branchId)) {
            setBranchId(branches[0].id);
          }
        }
      }).catch(() => {});
    }
  }, [token, api, isSaasOwner, branchId]);

  React.useEffect(() => {
    if (token && !isSaasOwner) {
      api('/api/administration/profile')
        .then(r => r.ok ? r.json() : null)
        .then((p: Any) => {
          if (p) {
            const lName = p.sri_razon_social || p.legal_name || p.name || localStorage.tenantName || 'FIXMETIENDAS';
            const rucVal = p.sri_ruc || p.tax_id || localStorage.tenantRuc || '1790012345001';
            const addr = p.sri_direccion_matriz || p.address || localStorage.tenantAddress || 'Matriz Principal, Ecuador';
            const ph = p.phone || localStorage.tenantPhone || '0994175857';
            const em = p.email || p.billing_contact_email || localStorage.tenantEmail || 'contacto@fixmetiendas.com';
            const slog = p.slogan || p.catalog_description || localStorage.tenantSlogan || 'Con la Mejor Innovación en Tecnología';
            const nm = p.name || localStorage.tenantName || 'FIXMETIENDAS';

            localStorage.tenantName = nm;
            localStorage.tenantLegalName = lName;
            localStorage.tenantRuc = rucVal;
            localStorage.tenantAddress = addr;
            localStorage.tenantPhone = ph;
            localStorage.tenantEmail = em;
            localStorage.tenantSlogan = slog;

            setCompanyInfo({
              name: nm,
              legalName: lName,
              ruc: rucVal,
              address: addr,
              phone: ph,
              email: em,
              slogan: slog,
              sriRegimen: p.sri_regimen_tributario,
              sriAmbiente: p.sri_ambiente
            });
          }
        })
        .catch(() => {});
    }
  }, [token, api, isSaasOwner]);

  React.useEffect(() => {
    if (token && !isSaasOwner) {
      api('/api/tenant/trial-status')
        .then(r => r.ok ? r.json() : null)
        .then(info => {
          if (info && info.is_trial) {
            setTrialInfo({
              isTrial: true,
              daysRemaining: info.daysRemaining,
              trialEndsAt: info.trial_ends_at
            });
            localStorage.isTrial = 'true';
            localStorage.trialDaysRemaining = String(info.daysRemaining);
            localStorage.trialEndsAt = info.trial_ends_at || '';
          } else {
            setTrialInfo(null);
            localStorage.removeItem('isTrial');
            localStorage.removeItem('trialDaysRemaining');
            localStorage.removeItem('trialEndsAt');
          }
        })
        .catch(() => {});
    }
  }, [token, api, isSaasOwner]);

  const availableCommands = React.useMemo(() => {
    const list: { id: string; label: string; group: string; action: () => void }[] = [];
    if (isSaasOwner) {
      saasNav.forEach(([k, label]) => {
        list.push({ id: k, label: `Ir a ${label}`, group: 'Administración SaaS', action: () => { setPage(k); setShowCommandPalette(false); } });
      });
    } else {
      const pageTitles: Record<string, string> = {
        home: 'Panel Resumen Ejecutivo',
        pos: 'Punto de Venta (POS)',
        cash: 'Control de Caja & Turnos',
        sales: 'Registro General de Ventas',
        quotes: 'Cotizaciones Comerciales',
        'my-work': 'Mi Banco de Trabajo',
        'work-orders': 'Órdenes de Servicio Técnico',
        marketplace: 'Bolsa de Reparaciones',
        products: 'Catálogo de Inventario',
        purchases: 'Compras Locales & Kardex',
        imports: 'Importaciones y Arribos',
        customers: 'Directorio de Clientes & Créditos',
        deliveries: 'Tablero de Entregas & Courier',
        warranties: 'Control de Garantías',
        reports: 'Reportes Financieros & Utilidad',
        administration: 'Configuración de Empresa & Roles'
      };
      visible.forEach(p => {
        if (pageTitles[p]) {
          list.push({ id: p, label: `Ir a ${pageTitles[p]}`, group: 'Módulos Habilitados', action: () => { go(p); setShowCommandPalette(false); } });
        }
      });
    }

    list.push({
      id: 'toggle-theme',
      label: theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro',
      group: 'Acciones Rápidas',
      action: () => { setTheme(t => t === 'dark' ? 'light' : 'dark'); setShowCommandPalette(false); }
    });

    if (!isSaasOwner) {
      list.push({
        id: 'pocket-mode',
        label: 'Abrir Fixme Pocket (Modo Móvil)',
        group: 'Acciones Rápidas',
        action: () => { setViewMode('POCKET'); localStorage.setItem('fixme_view_mode', 'POCKET'); setShowCommandPalette(false); }
      });
      list.push({
        id: 'qr-catalog',
        label: 'Compartir Catálogo Digital con QR',
        group: 'Acciones Rápidas',
        action: () => { setShowCatalogModal(true); setShowCommandPalette(false); }
      });
      list.push({
        id: 'public-repair',
        label: 'Portal Público de Recepción Online',
        group: 'Acciones Rápidas',
        action: () => { window.location.hash = '#solicitar-reparacion'; setHash('#solicitar-reparacion'); setShowCommandPalette(false); }
      });
      list.push({
        id: 'customer-portal',
        label: 'Portal de Seguimiento de Clientes',
        group: 'Acciones Rápidas',
        action: () => { window.location.hash = '#portal-cliente'; setHash('#portal-cliente'); setShowCommandPalette(false); }
      });
    }

    return list;
  }, [isSaasOwner, visible, theme, saasNav, go]);

  const filteredCommands = React.useMemo(() => {
    if (!commandQuery.trim()) return availableCommands;
    const q = commandQuery.toLowerCase();
    return availableCommands.filter(c => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
  }, [availableCommands, commandQuery]);

  // Public match routes
  const catMatch = hash.match(/#catalog\/([a-f0-9\-]+)/i) || hash.match(/[?&]catalog=([a-f0-9\-]+)/i);
  const trkMatch = hash.match(/#tracking\/([a-zA-Z0-9\-]+)/i) || hash.match(/[?&]tracking=([a-zA-Z0-9\-]+)/i);
  const orderMatch = hash.match(/#order\/([a-zA-Z0-9\-\.]+)/i) || hash.match(/[?&]order=([a-zA-Z0-9\-\.]+)/i);
  const quoteMatch = hash.match(/#quote\/([a-zA-Z0-9\-\.]+)/i) || hash.match(/[?&]quote=([a-zA-Z0-9\-\.]+)/i);
  const reqMatch = hash.match(/#solicitud\/([a-zA-Z0-9\-\.]+)/i) || hash.match(/[?&]solicitud=([a-zA-Z0-9\-\.]+)/i);
  const newReqMatch = hash.match(/#solicitar-reparacion/i) || hash.match(/#reparar/i);
  const portalMatch = hash.match(/#portal-cliente/i) || hash.match(/#mi-cuenta/i) || hash.match(/#portal/i);

  if (catMatch) return <PublicCatalog tenantId={catMatch[1]} onBack={() => { window.location.hash = ''; setHash(''); }} isLogged={!!token} />;
  if (trkMatch) return <PublicDeliveryTracking code={trkMatch[1]} onBack={() => { window.location.hash = ''; setHash(''); }} isLogged={!!token} />;
  if (orderMatch) return <PublicWorkOrderTracking code={orderMatch[1]} onBack={() => { window.location.hash = ''; setHash(''); }} isLogged={!!token} />;
  if (quoteMatch) return <PublicQuoteView token={quoteMatch[1]} onBack={() => { window.location.hash = ''; setHash(''); }} isLogged={!!token} />;
  if (reqMatch) return <PublicLeadTracking code={reqMatch[1]} onBack={() => { window.location.hash = ''; setHash(''); }} />;
  if (newReqMatch) return <PublicRepairRequestWizard onBack={() => { window.location.hash = ''; setHash(''); }} isLogged={!!token} />;
  if (portalMatch) return <CustomerPortal onBack={() => { window.location.hash = ''; setHash(''); }} />;

  if (!token) {
    const isDirectLogin = hash === '#login' || hash === 'login' || hash.includes('login') || hash.includes('pocket');
    if (isDirectLogin) {
      return (
        <Login
          onLogin={(t: string, mode?: 'POCKET' | 'DESKTOP') => {
            if (mode) setViewMode(mode);
            localStorage.token = t;
            setToken(t);
            window.location.hash = '';
            setHash('');
          }}
          onBack={() => { window.location.hash = ''; setHash(''); }}
        />
      );
    }
    return (
      <LandingPage
        onLogin={(t: string) => {
          const m = localStorage.getItem('fixme_view_mode') as 'POCKET' | 'DESKTOP';
          if (m) setViewMode(m);
          localStorage.token = t;
          setToken(t);
          window.location.hash = '';
          setHash('');
        }}
        onOpenDirectLogin={() => { window.location.hash = '#login'; setHash('#login'); }}
      />
    );
  }

  if (viewMode === 'POCKET' && !isSaasOwner) {
    return (
      <PocketMobileView
        api={api}
        role={role}
        companyInfo={companyInfo}
        branchId={branchId}
        onSwitchToDesktop={() => { setViewMode('DESKTOP'); localStorage.setItem('fixme_view_mode', 'DESKTOP'); }}
        onLogout={handleLogout}
        notify={notify}
      />
    );
  }

  return (
    <div className="shell">
      <button className="mobile-menu" aria-label="Abrir menú" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      <Sidebar
        page={page}
        go={go}
        role={role}
        isSaasOwner={isSaasOwner}
        companyInfo={companyInfo}
        visiblePages={visible}
        theme={theme}
        setTheme={setTheme}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        mobileMenuOpen={menuOpen}
        onCloseMobileMenu={() => setMenuOpen(false)}
        orderCounts={shellOrderCounts}
      />
      <main>
        {!isSaasOwner && trialInfo?.isTrial && (
          <div className="trial-top-banner">
            <div className="trial-banner-info">
              <span className="trial-banner-badge">PRUEBA GRATIS (15 DÍAS)</span>
              <span>
                Tienes <strong>{trialInfo.daysRemaining !== undefined ? (trialInfo.daysRemaining <= 0 ? '0 días (Vence hoy)' : `${trialInfo.daysRemaining} días`) : '15 días'}</strong> restantes con <b>todos los módulos habilitados</b> para evaluar el sistema.
              </span>
            </div>
            <div className="trial-banner-actions">
              <button type="button" className="trial-btn-upgrade" onClick={() => setShowTrialModal(true)}>
                Contratar Plan Definitivo
              </button>
              <a
                href={`https://wa.me/593991234567?text=${encodeURIComponent(`Hola administración de FixmeTiendas! Estoy evaluando la plataforma en mi tienda "${localStorage.tenantName || 'Mi Tienda'}" y me gustaría consultar sobre planes y módulos definitivos.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="trial-btn-wa"
              >
                WhatsApp Soporte
              </a>
            </div>
          </div>
        )}
        <header className="app-header">
          <div className="header-breadcrumb">
            <div className="header-store-badge">
              <Store size={14} style={{ color: 'var(--primary)' }} />
              <span>{isSaasOwner ? 'Fixme SaaS SuperAdmin' : (companyInfo.name || 'Fixme Tiendas')}</span>
            </div>
            <span style={{ color: 'var(--text-subtle)' }}>/</span>
            <div className="header-module-badge">
              <span>{item(page)?.[1] || 'Panel'}</span>
            </div>
          </div>
          <div className="header-actions">
            <div className={`net-status-pill ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Conexión activa con el servidor' : 'Modo Offline: las ventas se sincronizarán al reconectar'}>
              <span className="net-dot" />
              <span>{isOnline ? 'En línea' : `Offline (${pendingOfflineSalesCount} pendientes)`}</span>
            </div>

            <button
              type="button"
              className="command-palette-trigger"
              onClick={() => { setShowCommandPalette(true); setCommandQuery(''); setCommandSelectedIndex(0); }}
              title="Abrir paleta de comandos (Ctrl + K)"
            >
              <Search size={14} />
              <span>Buscar módulo...</span>
              <span className="kbd-badge">Ctrl+K</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme((t: string) => t === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <div className="header-quick-access-wrap" style={{ position: 'relative' }}>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setShowQuickAccess(!showQuickAccess)}
                title="Accesos rápidos y enlaces públicos"
                aria-label="Accesos rápidos"
                style={{ fontSize: 13, gap: 6, height: 32 }}
              >
                <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                <span>Accesos</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
              </button>
              {showQuickAccess && (
                <div
                  className="header-quick-access-dropdown"
                  onClick={() => setShowQuickAccess(false)}
                >
                  <button type="button" className="qa-menu-btn" onClick={() => { setViewMode('POCKET'); localStorage.setItem('fixme_view_mode', 'POCKET'); }}>
                    <span className="qa-icon"><Smartphone size={15} /></span>
                    <div><div className="qa-label">Modo Pocket</div><div className="qa-hint">Taller y POS para celulares</div></div>
                  </button>
                  <button type="button" className="qa-menu-btn" onClick={() => setShowCatalogModal(true)}>
                    <span className="qa-icon"><QrCode size={15} /></span>
                    <div><div className="qa-label">Catálogo digital</div><div className="qa-hint">Compartir productos con QR</div></div>
                  </button>
                  <button type="button" className="qa-menu-btn" onClick={() => { window.location.hash = '#solicitar-reparacion'; setHash('#solicitar-reparacion'); }}>
                    <span className="qa-icon"><Wrench size={15} /></span>
                    <div><div className="qa-label">Solicitar reparación</div><div className="qa-hint">Portal de recepción online</div></div>
                  </button>
                  <button type="button" className="qa-menu-btn" onClick={() => { window.location.hash = '#portal-cliente'; setHash('#portal-cliente'); }}>
                    <span className="qa-icon"><User size={15} /></span>
                    <div><div className="qa-label">Portal de clientes</div><div className="qa-hint">Consulta por cédula / celular</div></div>
                  </button>
                </div>
              )}
            </div>
            <div className="header-avatar" title={`Sesión activa · ${role || 'Usuario'}`}>
              {isSaasOwner ? '♛' : (role.slice(0, 1).toUpperCase() || 'U')}
            </div>
          </div>
        </header>

        {toast && <div className="toast toast-success" onClick={() => setToast('')}><b>✓</b>{toast}</div>}

        {isSaasOwner ? (
          <ErrorBoundary>
            <PlatformAdministration api={api} notify={notify} activeTab={page} setTab={setPage} />
          </ErrorBoundary>
        ) : (
          page === 'home' && visible.includes('home') ? <Dashboard api={api} go={go} role={role} /> :
          page === 'my-work' && visible.includes('my-work') ? <MyWork api={api} notify={notify} go={go} branchId={branchId} /> :
          page === 'cash' && visible.includes('cash') ? <Cash api={api} notify={notify} branchId={branchId} /> :
          page === 'pos' && visible.includes('pos') ? <POS api={api} notify={notify} companyInfo={companyInfo} branchId={branchId} /> :
          page === 'sales' && visible.includes('sales') ? <Sales api={api} companyInfo={companyInfo} role={role} branchId={branchId} /> :
          page === 'quotes' && visible.includes('quotes') ? <QuotesPage api={api} notify={notify} go={go} /> :
          page === 'administration' && visible.includes('administration') ? <Administration api={api} notify={notify} onCompanyUpdate={setCompanyInfo} onModulesUpdate={() => api('/api/modules').then(r => r.ok ? r.json() : []).then(setMods).catch(() => {})} /> :
          page === 'products' && visible.includes('products') ? <Products api={api} role={role} branchId={branchId} /> :
          page === 'purchases' && visible.includes('purchases') ? <PurchasesModule api={api} /> :
          page === 'imports' && visible.includes('imports') ? <ImportsModule api={api} /> :
          page === 'customers' && visible.includes('customers') ? <Customers api={api} notify={notify} go={go} branchId={branchId} /> :
          page === 'deliveries' && visible.includes('deliveries') ? <Deliveries api={api} /> :
          page === 'work-orders' && visible.includes('work-orders') ? <Orders api={api} companyInfo={companyInfo} branchId={branchId} notify={notify} /> :
          page === 'marketplace' && visible.includes('marketplace') ? <MarketplaceView api={api} notify={notify} go={go} /> :
          page === 'reports' && visible.includes('reports') ? <ErrorBoundary><Reports api={api} /></ErrorBoundary> :
          page === 'warranties' && visible.includes('warranties') ? <Warranties api={api} notify={notify} go={go} branchId={branchId} /> :
          <section className="panel"><h3>Acceso restringido</h3><p>Este módulo pertenece a la gestión interna de cada tienda o no tienes permisos suficientes.</p></section>
        )}

        <nav className="mobile-nav">
          {(isSaasOwner ? saasNav : nav.filter(n => visible.includes(n[0])).slice(0, 5)).map(n => (
            <button className={page === n[0] ? 'active' : ''} onClick={() => go(n[0])} key={n[0]}>
              <i>{n[2]}</i>
              <small>{n[1]}</small>
            </button>
          ))}
        </nav>
      </main>

      {showCommandPalette && (
        <div className="command-palette-backdrop" onClick={() => setShowCommandPalette(false)}>
          <div className="command-palette-modal" onClick={e => e.stopPropagation()}>
            <div className="command-palette-header">
              <Search size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                className="command-palette-input"
                placeholder="Escribe para buscar un módulo o acción..."
                value={commandQuery}
                onChange={e => { setCommandQuery(e.target.value); setCommandSelectedIndex(0); }}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCommandSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCommandSelectedIndex(i => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredCommands[commandSelectedIndex]) {
                      filteredCommands[commandSelectedIndex].action();
                    }
                  }
                }}
              />
              <span className="kbd-badge">ESC</span>
            </div>
            <div className="command-palette-list">
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  type="button"
                  className={`command-palette-item ${commandSelectedIndex === idx ? 'active' : ''}`}
                  onClick={cmd.action}
                  onMouseEnter={() => setCommandSelectedIndex(idx)}
                >
                  <div className="command-palette-item-left">
                    <span style={{ color: 'var(--primary)', opacity: 0.85 }}>●</span>
                    <span>{cmd.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cmd.group}</span>
                </button>
              ))}
              {!filteredCommands.length && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No se encontraron módulos ni acciones para "{commandQuery}"
                </div>
              )}
            </div>
            <div className="command-palette-footer">
              <span>Navega con <kbd className="kbd-badge">↑</kbd> <kbd className="kbd-badge">↓</kbd> y presiona <kbd className="kbd-badge">Enter</kbd></span>
              <span>FixmeTiendas</span>
            </div>
          </div>
        </div>
      )}

      {showCatalogModal && (
        <CatalogShareModal
          tenantId={userTenantId}
          storeName={isSaasOwner ? 'Fixme SaaS Multi-Empresas' : (localStorage.tenantName || 'Mi Tienda')}
          onClose={() => setShowCatalogModal(false)}
          notify={notify}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {showTrialModal && (
        <StoreTrialUpgradeModal
          tenantName={localStorage.tenantName || 'Mi Tienda'}
          daysRemaining={trialInfo?.daysRemaining}
          trialEndsAt={trialInfo?.trialEndsAt}
          onClose={() => setShowTrialModal(false)}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
