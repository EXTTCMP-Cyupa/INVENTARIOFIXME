import React from 'react';

interface Plan {
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  includedModules: string[];
  features: string[];
  badge?: string;
  isPopular?: boolean;
}

const DEFAULT_PLANS: Plan[] = [
  {
    code: 'STARTER',
    name: 'Plan Básico / Inventario',
    description: 'Ideal para microempresas que requieren control de stock, kardex y clientes.',
    monthlyPrice: 25.0,
    includedModules: ['INVENTORY', 'CUSTOMERS', 'REPORTS'],
    features: [
      'Control de inventario multicentro y almacenes',
      'Kardex y alertas automáticas de stock mínimo',
      'Cartera de clientes y CRM básico',
      'Reportes financieros de movimientos',
      '1 Sucursal operativa incluida',
      'Soporte estándar vía correo'
    ],
    badge: 'INICIAL',
    isPopular: false
  },
  {
    code: 'PRO',
    name: 'Plan Comercial / POS & Caja',
    description: 'Solución completa para tiendas de retail, mostradores comerciales y facturación.',
    monthlyPrice: 49.0,
    includedModules: ['INVENTORY', 'POS', 'CASH_REGISTER', 'QUOTES', 'CUSTOMERS', 'REPORTS'],
    features: [
      'Todo lo incluido en el Plan Básico',
      'Punto de Venta (POS) con ticket 80mm',
      'Apertura, arqueos y cierres de caja (Corte Z)',
      'Facturación Electrónica SRI (Ecuador)',
      'Cotizaciones con enlace web y aprobación digital',
      'Múltiples formas de pago (Efectivo, Tarjeta, Transf.)',
      'Soporte prioritario por WhatsApp'
    ],
    badge: 'MÁS POPULAR',
    isPopular: true
  },
  {
    code: 'WORKSHOP',
    name: 'Plan Taller & Servicio Técnico',
    description: 'Diseñado para talleres de celulares, computadoras, tecnología y motos con tracking.',
    monthlyPrice: 69.0,
    includedModules: ['INVENTORY', 'POS', 'CASH_REGISTER', 'WORK_ORDERS', 'DELIVERIES', 'CUSTOMERS', 'REPORTS'],
    features: [
      'Todo lo incluido en el Plan Comercial',
      'Módulo completo de Órdenes de Servicio Técnico',
      'Diagnóstico, checklist y trazabilidad de técnicos',
      'Portal público de tracking con código QR para clientes',
      'Aprobación online de presupuestos de reparación',
      'Gestión de despachos y entregas a domicilio (Delivery)',
      'Garantías comerciales con tracking digital'
    ],
    badge: 'TALLERES',
    isPopular: false
  },
  {
    code: 'ENTERPRISE',
    name: 'Plan Enterprise / Full APIs & Pagos',
    description: 'Acceso ilimitado a todos los módulos, pasarelas DeUna QR y Payphone, e integraciones API.',
    monthlyPrice: 99.0,
    includedModules: ['INVENTORY', 'POS', 'CASH_REGISTER', 'QUOTES', 'WORK_ORDERS', 'DELIVERIES', 'CUSTOMERS', 'REPORTS', 'APIS'],
    features: [
      'Acceso total a todos los módulos sin restricciones',
      'Módulo Avanzado de APIs y Webhooks para desarrolladores',
      'Pasarela de cobro digital DeUna QR (Banco Pichincha)',
      'Pasarela de tarjetas de crédito/débito Payphone',
      'Catálogo digital interactivo con pedidos a WhatsApp',
      'Usuarios y sucursales ilimitadas',
      'Capacitación y soporte VIP 24/7'
    ],
    badge: 'TODO INCLUIDO',
    isPopular: false
  }
];

const MODULE_LABELS: Record<string, { label: string; icon: string }> = {
  INVENTORY: { label: 'Inventario', icon: '📦' },
  POS: { label: 'Punto de Venta (POS)', icon: '🛒' },
  CASH_REGISTER: { label: 'Caja & Corte Z', icon: '💰' },
  QUOTES: { label: 'Cotizaciones Web', icon: '📑' },
  WORK_ORDERS: { label: 'Taller & Órdenes', icon: '🛠️' },
  DELIVERIES: { label: 'Entregas / Delivery', icon: '🚚' },
  CUSTOMERS: { label: 'Clientes & CRM', icon: '👥' },
  REPORTS: { label: 'Reportes & Analítica', icon: '📊' },
  APIS: { label: 'APIs & Pasarelas (DeUna / Payphone)', icon: '⚡' }
};

interface LandingPageProps {
  onLogin: (token: string) => void;
  onOpenDirectLogin?: () => void;
  onNavigate?: (hash: string) => void;
}

export function LandingPage({ onLogin, onOpenDirectLogin, onNavigate }: LandingPageProps) {
  const navigateTo = (hash: string) => {
    window.location.hash = hash;
    if (onNavigate) onNavigate(hash);
  };
  const [plans, setPlans] = React.useState<Plan[]>(DEFAULT_PLANS);
  const [loadingPlans, setLoadingPlans] = React.useState(true);
  const [showRegisterModal, setShowRegisterModal] = React.useState(false);
  const [showLoginModal, setShowLoginModal] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = React.useState<string>('PRO');

  // Registration Form State
  const [regForm, setRegForm] = React.useState({
    storeName: '',
    businessType: 'RETAIL',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
    plan: 'PRO'
  });
  const [registering, setRegistering] = React.useState(false);
  const [regError, setRegError] = React.useState('');

  // Login Form State
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [showLoginPassword, setShowLoginPassword] = React.useState(false);
  const [loggingIn, setLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');
  const [loginTargetMode, setLoginTargetMode] = React.useState<'POCKET' | 'DESKTOP'>(() => {
    const saved = localStorage.getItem('fixme_view_mode');
    if (saved === 'DESKTOP' || saved === 'POCKET') return saved;
    return (window.innerWidth <= 768) ? 'POCKET' : 'DESKTOP';
  });

  // Load public plans from backend
  React.useEffect(() => {
    fetch('/api/public/plans')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPlans(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  function handleChoosePlan(planCode: string) {
    setSelectedPlanCode(planCode);
    setRegForm(prev => ({ ...prev, plan: planCode }));
    setShowRegisterModal(true);
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegError('');
    setRegistering(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm)
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.accessToken) {
        if (data.tenantId) localStorage.tenantId = data.tenantId;
        if (data.branchId) localStorage.branchId = data.branchId;
        if (data.tenantName) localStorage.tenantName = data.tenantName;
        if (data.fullName) localStorage.fullName = data.fullName;
        if (data.isTrial) {
          localStorage.isTrial = 'true';
          if (data.trialDaysRemaining !== undefined && data.trialDaysRemaining !== null) {
            localStorage.trialDaysRemaining = String(data.trialDaysRemaining);
          }
          if (data.trialEndsAt) {
            localStorage.trialEndsAt = data.trialEndsAt;
          }
        } else {
          localStorage.removeItem('isTrial');
          localStorage.removeItem('trialDaysRemaining');
          localStorage.removeItem('trialEndsAt');
        }
        onLogin(data.accessToken);
      } else {
        setRegError(data?.message || 'No se pudo crear la tienda. Verifica los datos.');
      }
    } catch (err: any) {
      setRegError('Error de conexión: ' + (err.message || 'Intenta nuevamente'));
    } finally {
      setRegistering(false);
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword })
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.accessToken) {
        if (data.tenantId) localStorage.tenantId = data.tenantId;
        if (data.branchId) localStorage.branchId = data.branchId;
        if (data.tenantName) localStorage.tenantName = data.tenantName;
        if (data.fullName) localStorage.fullName = data.fullName;
        if (data.isTrial) {
          localStorage.isTrial = 'true';
          if (data.trialDaysRemaining !== undefined && data.trialDaysRemaining !== null) {
            localStorage.trialDaysRemaining = String(data.trialDaysRemaining);
          }
          if (data.trialEndsAt) {
            localStorage.trialEndsAt = data.trialEndsAt;
          }
        } else {
          localStorage.removeItem('isTrial');
          localStorage.removeItem('trialDaysRemaining');
          localStorage.removeItem('trialEndsAt');
        }
        localStorage.setItem('fixme_view_mode', loginTargetMode);
        onLogin(data.accessToken);
      } else {
        if (data?.error === 'TRIAL_EXPIRED') {
          setLoginError('⏳ Tu período de prueba de 15 días ha finalizado. Contacta a la administración para activar tu plan definitivo.');
        } else if (data?.error === 'STORE_SUSPENDED' || res.status === 402) {
          setLoginError('🚫 ' + (data?.message || 'Esta tienda se encuentra suspendida por mensualidad pendiente.'));
        } else {
          setLoginError(data?.message || 'Credenciales incorrectas. Verifica tu correo y contraseña.');
        }
      }
    } catch (err: any) {
      setLoginError('Error al iniciar sesión: ' + err.message);
    } finally {
      setLoggingIn(false);
    }
  }


  const [openFaqIdx, setOpenFaqIdx] = React.useState<number|null>(null);
  const [headerScrolled, setHeaderScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setHeaderScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const PLAN_DISPLAY_NAMES: Record<string, string> = {
    'STARTER': 'Inicial',
    'PRO': 'Comercial',
    'WORKSHOP': 'Taller',
    'ENTERPRISE': 'Enterprise'
  };

  const MODULE_LABELS_CLEAN: Record<string, string> = {
    INVENTORY: 'Inventario',
    POS: 'Punto de Venta',
    CASH_REGISTER: 'Caja & Corte Z',
    QUOTES: 'Cotizaciones',
    WORK_ORDERS: 'Taller & Órdenes',
    DELIVERIES: 'Entregas',
    CUSTOMERS: 'Clientes & CRM',
    REPORTS: 'Reportes',
    APIS: 'APIs & Pasarelas'
  };

  const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  );

  return (
    <div className="landing-shell">
      {/* 1. HEADER */}
      <header className={`lp-header ${headerScrolled ? 'scrolled' : ''}`}>
        <div className="lp-nav">
          <div className="landing-brand">
            <span className="landing-logo-badge">FX</span>
            <span className="landing-logo-text">Fixme<span>Tiendas</span></span>
            <span className="landing-country-badge">🇪🇨 Ecuador</span>
          </div>
          <nav className="lp-nav-links">
            <a href="#features">Funciones</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#pricing">Planes</a>
            <a href="#faq">Preguntas</a>
          </nav>
          <div className="lp-nav-actions">
            <button className="discrete-link" style={{ background: 'none', border: 'none' }} onClick={() => navigateTo('#portal-cliente')}>¿Eres cliente?</button>
            <button className="lp-btn-secondary" onClick={() => {
              if (onOpenDirectLogin) onOpenDirectLogin();
              else setShowLoginModal(true);
            }}>Iniciar sesión</button>
            <button className="lp-btn-primary" onClick={() => handleChoosePlan('PRO')}>Probar gratis</button>
          </div>
          <button
            type="button"
            className="lp-mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menú"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Slide-down Drawer */}
        <div className={`lp-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Funciones & Módulos</a>
          <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)}>Cómo funciona</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Planes & Precios</a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)}>Preguntas Frecuentes</a>
          <a href="#portal-cliente" onClick={() => { setMobileMenuOpen(false); navigateTo('#portal-cliente'); }} style={{ color: 'var(--lp-primary)' }}>
            Portal del Cliente (Rastreo) →
          </a>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              className="lp-btn-secondary"
              style={{ flex: 1, height: 42, fontSize: 13 }}
              onClick={() => {
                setMobileMenuOpen(false);
                if (onOpenDirectLogin) onOpenDirectLogin();
                else setShowLoginModal(true);
              }}
            >
              Iniciar sesión
            </button>
            <button
              className="lp-btn-primary"
              style={{ flex: 1, height: 42, fontSize: 13 }}
              onClick={() => {
                setMobileMenuOpen(false);
                handleChoosePlan('PRO');
              }}
            >
              Probar gratis
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO */}
      <section className="lp-hero">
        <div className="lp-hero-left">
          <div className="eyebrow">Sistema de gestión para Ecuador</div>
          <h1>Vende, factura al SRI y gestiona tus reparaciones en un solo sistema.</h1>
          <p>POS, inventario, caja y órdenes de servicio para tiendas y talleres de Ecuador. Tus clientes siguen su reparación con solo su celular y cédula.</p>
          <div className="lp-hero-buttons">
            <button className="lp-btn-primary" onClick={() => handleChoosePlan('PRO')}>Probar 15 días gratis</button>
            <a href="#como-funciona" className="lp-btn-secondary">Ver cómo funciona</a>
          </div>
          <div className="trust-line">Sin contratos forzosos · Facturación electrónica SRI incluida</div>
          <button className="discrete-link" style={{ background: 'none', border: 'none', padding: 0, marginTop: '8px' }} onClick={() => navigateTo('#portal-cliente')}>
            ¿Eres cliente? Consulta tu reparación →
          </button>
        </div>
        <div className="lp-hero-right">
          <div className="lp-browser-frame">
            <div className="lp-browser-chrome">
              <span></span><span></span><span></span>
              <div style={{ marginLeft: 12, background: '#ffffff', borderRadius: 4, padding: '2px 10px', fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6, width: '60%' }}>
                <span style={{ color: '#16a34a' }}>🔒</span> app.fixmetiendas.com/dashboard
              </div>
            </div>
            <div className="lp-browser-content">
              <div className="lp-mock-dash">
                {/* Header bar of app */}
                <div className="lp-mock-topbar">
                  <div className="lp-mock-store">
                    <span style={{ background: 'var(--lp-primary)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>FX</span>
                    <span>ElectroFix Quito · Matriz</span>
                  </div>
                  <span className="lp-mock-live">En línea</span>
                </div>

                {/* 3 KPIs */}
                <div className="lp-mock-kpi-row">
                  <div className="lp-mock-kpi">
                    <span className="lp-mock-kpi-label">Ventas del Día</span>
                    <span className="lp-mock-kpi-val green">$ 1,420.50</span>
                    <span className="lp-mock-kpi-sub">↑ +18% vs ayer</span>
                  </div>
                  <div className="lp-mock-kpi">
                    <span className="lp-mock-kpi-label">Órdenes Taller</span>
                    <span className="lp-mock-kpi-val blue">14 activas</span>
                    <span className="lp-mock-kpi-sub neutral">8 en diagnóstico</span>
                  </div>
                  <div className="lp-mock-kpi">
                    <span className="lp-mock-kpi-label">Facturas SRI</span>
                    <span className="lp-mock-kpi-val">100% Aut.</span>
                    <span className="lp-mock-kpi-sub">Clave 49 dígitos</span>
                  </div>
                </div>

                {/* 2 Interactive panels: Work Order tracking & POS sale */}
                <div className="lp-mock-panels">
                  {/* Panel 1: Workshop Order Card */}
                  <div className="lp-mock-card">
                    <div className="lp-mock-card-head">
                      <span className="lp-mock-card-title">Orden #1042 · Taller</span>
                      <span className="lp-mock-card-tag green">Presupuesto Aprobado</span>
                    </div>
                    <div className="lp-mock-device">iPhone 13 Pro · Pantalla OLED</div>
                    <div className="lp-mock-repair-desc">Cliente: Juan Pérez · Cel: 099***421</div>
                    <div className="lp-mock-chips">
                      <span className="lp-mock-chip">Técnico: Carlos M.</span>
                      <span className="lp-mock-chip ok">Garantía 180 días</span>
                      <span className="lp-mock-chip">Repuesto OEM</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Aprobado desde celular</span>
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>$ 85.00</strong>
                    </div>
                  </div>

                  {/* Panel 2: Fast POS Ticket */}
                  <div className="lp-mock-card">
                    <div className="lp-mock-card-head">
                      <span className="lp-mock-card-title">Caja / POS Rápido</span>
                      <span className="lp-mock-card-tag blue">Factura #001-042</span>
                    </div>
                    <div className="lp-mock-pos-item">
                      <span>Cargador Rápido 30W USB-C</span>
                      <strong>$ 18.00</strong>
                    </div>
                    <div className="lp-mock-pos-item">
                      <span>Mica Cerámica Antiespía</span>
                      <strong>$ 6.00</strong>
                    </div>
                    <div className="lp-mock-pay-chips">
                      <span className="lp-mock-pay-chip active">DeUna QR</span>
                      <span className="lp-mock-pay-chip">Payphone</span>
                      <span className="lp-mock-pay-chip">Efectivo</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TRUST BAR */}
      <section className="lp-trust-bar">
        <div className="lp-trust-items">
          <div className="lp-trust-item"><CheckIcon /> Facturación electrónica SRI</div>
          <div className="lp-trust-item"><CheckIcon /> Cobros DeUna QR y Payphone</div>
          <div className="lp-trust-item"><CheckIcon /> Modo sin internet</div>
          <div className="lp-trust-item"><CheckIcon /> Garantías digitales</div>
          <div className="lp-trust-item"><CheckIcon /> Sin contratos forzosos</div>
        </div>
      </section>

      {/* 4. PARA NEGOCIOS Y CLIENTES */}
      <section id="para-negocios" className="lp-section">
        <div className="lp-para-grid">
          <div className="lp-para-card">
            <h3>Para talleres y tiendas</h3>
            <ul>
              <li><CheckIcon /> Controla tu inventario y evita pérdidas</li>
              <li><CheckIcon /> Factura electrónicamente en segundos</li>
              <li><CheckIcon /> Organiza tus órdenes de reparación</li>
            </ul>
            <button className="lp-btn-primary" style={{ width: '100%' }} onClick={() => handleChoosePlan('WORKSHOP')}>Activar mi taller gratis</button>
          </div>
          <div className="lp-para-card">
            <h3>Para tus clientes</h3>
            <ul>
              <li><CheckIcon /> Consultan el estado de su equipo online</li>
              <li><CheckIcon /> Aprueban presupuestos desde el celular</li>
              <li><CheckIcon /> Descargan sus facturas y garantías</li>
            </ul>
            <button className="lp-btn-secondary" style={{ width: '100%' }} onClick={() => navigateTo('#portal-cliente')}>Acceder al portal</button>
          </div>
        </div>
      </section>

      {/* 5. CÓMO FUNCIONA */}
      <section id="como-funciona" className="lp-section bg-alt">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <div className="lp-section-label">Cómo funciona</div>
            <h2 className="lp-section-title">Cuatro pasos, cero papeleo</h2>
          </div>
          <div className="lp-how-steps">
            <div className="lp-step">
              <div className="lp-step-number">1</div>
              <h4>Recepción</h4>
              <p>Ingresa el equipo y genera la orden de servicio en el sistema.</p>
              <div className="lp-step-connector"></div>
            </div>
            <div className="lp-step">
              <div className="lp-step-number">2</div>
              <h4>Portal del cliente</h4>
              <p>El cliente recibe un enlace para seguir el estado de su reparación.</p>
              <div className="lp-step-connector"></div>
            </div>
            <div className="lp-step">
              <div className="lp-step-number">3</div>
              <h4>Aprobación en 1 clic</h4>
              <p>Aprueba el presupuesto enviado desde su celular sin ir al local.</p>
              <div className="lp-step-connector"></div>
            </div>
            <div className="lp-step">
              <div className="lp-step-number">4</div>
              <h4>Factura y garantía</h4>
              <p>Genera la factura electrónica y entrega la garantía digital.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. MÓDULOS & FUNCIONES */}
      <section id="features" className="lp-section">
        <div className="lp-section-header">
          <div className="lp-section-label">Funcionalidades</div>
          <h2 className="lp-section-title">Todo lo que necesita tu negocio</h2>
        </div>
        <div className="lp-bento-grid">
          <div className="lp-bento-card lp-bento-large">
            <div className="lp-bento-icon">1</div>
            <h3>Punto de Venta (POS) y Caja</h3>
            <p>Vende rápido con código de barras, abre y cierra caja (Corte Z), acepta múltiples métodos de pago y emite facturas electrónicas al instante.</p>
          </div>
          <div className="lp-bento-card">
            <div className="lp-bento-icon">2</div>
            <h3>Inventario</h3>
            <p>Control de stock, kardex de productos, alertas de stock mínimo y gestión multialmacén.</p>
          </div>
          <div className="lp-bento-card">
            <div className="lp-bento-icon">3</div>
            <h3>Taller y Órdenes</h3>
            <p>Checklist de recepción, asignación de técnicos, estados de reparación y garantías.</p>
          </div>
          <div className="lp-bento-card">
            <div className="lp-bento-icon">4</div>
            <h3>Pagos Digitales</h3>
            <p>Integración directa con DeUna QR y Payphone para cobros seguros y sin contacto.</p>
          </div>
          <div className="lp-bento-card">
            <div className="lp-bento-icon">5</div>
            <h3>Cotizaciones Web</h3>
            <p>Envía proformas profesionales por WhatsApp que tus clientes pueden aprobar digitalmente.</p>
          </div>
        </div>
      </section>

      {/* 7. PLANES */}
      <section id="pricing" className="lp-section bg-alt">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <div className="lp-section-label">Planes</div>
            <h2 className="lp-section-title">Elige el plan de tu negocio</h2>
          </div>
          <div className="lp-pricing-grid">
            {plans.map(p => {
              const displayName = PLAN_DISPLAY_NAMES[p.code] || p.name.split('/')[0].trim();
              const isPopular = p.isPopular;
              const badge = p.badge === 'ECONOMICO' ? 'Económico' : p.badge;
              
              return (
                <div key={p.code} className={`lp-pricing-card ${isPopular ? 'popular' : ''}`}>
                  {isPopular && <div className="lp-pricing-badge">{badge || 'RECOMENDADO'}</div>}
                  <div className="lp-pricing-header">
                    <h3>{displayName}</h3>
                    <div className="lp-pricing-price">$ {p.monthlyPrice.toFixed(2)} <span>/ mes</span></div>
                    <div className="lp-pricing-note">Precios + IVA</div>
                  </div>
                  <p className="lp-pricing-desc">{p.description}</p>
                  
                  <div className="lp-pricing-modules">
                    {p.includedModules.map(mod => (
                      <span key={mod} className="lp-module-chip">
                        {MODULE_LABELS_CLEAN[mod] || mod}
                      </span>
                    ))}
                  </div>
                  
                  <ul className="lp-pricing-features">
                    {p.features.map((f, i) => (
                      <li key={i}><CheckIcon /> {f}</li>
                    ))}
                  </ul>
                  
                  <button 
                    className={isPopular ? 'lp-btn-primary' : 'lp-btn-secondary'} 
                    style={{ width: '100%' }}
                    onClick={() => handleChoosePlan(p.code)}
                  >
                    Probar 15 días gratis
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. FAQ */}
      <section id="faq" className="lp-section">
        <div className="lp-section-header">
          <div className="lp-section-label">Preguntas frecuentes</div>
          <h2 className="lp-section-title">Preguntas frecuentes</h2>
        </div>
        <div className="lp-faq-list">
          {[
            {
              q: '¿Qué necesito para facturar con el SRI?',
              a: <>Solo necesitas tu RUC activo y tu firma electrónica <code>.p12</code>. Nosotros nos encargamos del resto de la configuración.</>
            },
            {
              q: '¿Cómo funcionan los cobros con DeUna QR y Payphone?',
              a: <>Los cobros se integran directamente en el POS. El sistema genera un código QR de DeUna o envía una solicitud de pago por Payphone, y la factura se emite automáticamente cuando el cliente paga.</>
            },
            {
              q: '¿Puedo cambiar de plan o activar módulos después?',
              a: <>Sí, puedes subir o bajar de plan en cualquier momento. Los cambios se aplicarán en tu siguiente ciclo de facturación.</>
            },
            {
              q: '¿Funciona si se cae el internet?',
              a: <>Sí, el sistema incluye un modo sin internet que te permite seguir registrando ventas y reparaciones. Todo se sincronizará automáticamente cuando vuelva la conexión.</>
            },
            {
              q: '¿Cómo pruebo el sistema? ¿Qué pasa al terminar los 15 días?',
              a: <>Puedes registrarte y usar todas las funciones gratis por 15 días. Al terminar, podrás elegir un plan y pagar con tarjeta o transferencia para seguir usando tu cuenta sin perder información.</>
            },
            {
              q: '¿Puedo importar mis productos y clientes actuales?',
              a: <>Sí, contamos con plantillas de Excel para importar todo tu inventario y base de clientes en pocos minutos.</>
            },
            {
              q: '¿Qué impresoras y lectores de código de barras son compatibles?',
              a: <>Cualquier impresora térmica USB, Bluetooth o WiFi (80mm o 58mm) y cualquier lector de código de barras USB/Bluetooth que funcione como teclado.</>
            },
            {
              q: '¿Cuántos usuarios y sucursales incluye cada plan?',
              a: <>Cada plan incluye 1 sucursal. Los usuarios varían por plan. El plan Enterprise incluye sucursales y usuarios ilimitados.</>
            },
            {
              q: '¿Mis datos están respaldados y seguros?',
              a: <>Sí, utilizamos servidores seguros en la nube con copias de seguridad automáticas diarias. Tu información está encriptada y protegida.</>
            },
            {
              q: '¿Cómo puedo cancelar? ¿Hay soporte por WhatsApp?',
              a: <>No hay contratos forzosos, puedes cancelar tu suscripción en cualquier momento. Ofrecemos soporte por WhatsApp de lunes a viernes en horario laborable para planes Comercial en adelante.</>
            }
          ].map((faq, idx) => (
            <div key={idx} className="lp-faq-item">
              <button 
                className="lp-faq-question"
                aria-expanded={openFaqIdx === idx}
                onClick={() => setOpenFaqIdx(openFaqIdx === idx ? null : idx)}
              >
                {faq.q}
                <svg className="lp-faq-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              {openFaqIdx === idx && (
                <div className="lp-faq-answer">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 9. CTA CLOSING BAND */}
      <section className="lp-cta-band">
        <h2>Empieza a vender y reparar con orden.</h2>
        <p>15 días gratis, sin tarjeta de crédito.</p>
        <button className="lp-btn-primary" onClick={() => handleChoosePlan('PRO')}>Probar 15 días gratis</button>
      </section>

      {/* 10. FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div>
            <div className="landing-brand" style={{ marginBottom: '16px' }}>
              <span className="landing-logo-badge">FX</span>
              <span className="landing-logo-text" style={{ color: 'white' }}>Fixme<span style={{ color: 'var(--lp-primary)' }}>Tiendas</span></span>
            </div>
            <p style={{ fontSize: '0.875rem', marginBottom: '16px' }}>Sistema de gestión para Ecuador.<br/>Vende, factura y repara con orden.</p>
          </div>
          <div>
            <h4>Plataforma</h4>
            <ul>
              <li><a href="#features">Funciones</a></li>
              <li><a href="#como-funciona">Cómo funciona</a></li>
              <li><a href="#modules">Módulos</a></li>
              <li><a href="#pricing">Planes</a></li>
            </ul>
          </div>
          <div>
            <h4>Para clientes</h4>
            <ul>
              <li><a href="#portal-cliente" onClick={(e) => { e.preventDefault(); navigateTo('#portal-cliente'); }}>Portal de clientes</a></li>
              <li><a href="#faq">Preguntas frecuentes</a></li>
            </ul>
          </div>
          <div>
            <h4>Contacto</h4>
            <ul>
              <li><a href="https://wa.me/593999999999" target="_blank" rel="noreferrer">WhatsApp: +593 999 999 999</a></li>
              <li><a href="mailto:soporte@fixmetiendas.com">soporte@fixmetiendas.com</a></li>
              <li>Quito & Guayaquil, Ecuador</li>
            </ul>
          </div>
        </div>
        <div className="lp-footer-bottom">
          &copy; {new Date().getFullYear()} FixmeTiendas Ecuador. Todos los derechos reservados.
        </div>
      </footer>

      {/* 11. FLOATING WHATSAPP BUTTON */}
      <a href="https://wa.me/593999999999" target="_blank" rel="noreferrer" className="lp-wa-fab" aria-label="Chat en WhatsApp">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
      </a>

      {/* --- MODAL 1: REGISTRO DE TIENDA AUTOPROVISIÓN --- */}
      {showRegisterModal && (
        <div className="lp-modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="lp-modal-card modal-register-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                  🚀 Registra tu Tienda en FixmeTiendas
                </h3>
                <small style={{ color: '#64748b' }}>
                  15 días de prueba gratis con acceso completo. Sin tarjeta de crédito requerida.
                </small>
              </div>
              <button className="close-btn" onClick={() => setShowRegisterModal(false)}>✕</button>
            </div>

            {regError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, color: '#b91c1c', fontSize: '12.5px', marginBottom: 14 }}>
                ⚠️ {regError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>
                  Nombre Comercial de la Tienda / Negocio *
                  <input
                    value={regForm.storeName}
                    onChange={e => setRegForm({ ...regForm, storeName: e.target.value })}
                    placeholder="Ej. ElectroFix Guayaquil"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                  />
                </label>

                <label style={{ fontSize: '12px', fontWeight: 600 }}>
                  Giro o Tipo de Negocio
                  <select
                    value={regForm.businessType}
                    onChange={e => setRegForm({ ...regForm, businessType: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                  >
                    <option value="RETAIL">Comercio / Tienda Retail / Mostrador</option>
                    <option value="WORKSHOP">Taller de Servicio Técnico / Reparaciones</option>
                    <option value="ELECTRONICS">Electrónica, Celulares & Computación</option>
                    <option value="PARTS">Repuestos, Ferretería & Autopartes</option>
                    <option value="SERVICES">Empresa de Servicios Profesionales</option>
                  </select>
                </label>

                <label style={{ fontSize: '12px', fontWeight: 600 }}>
                  Nombre del Dueño o Administrador *
                  <input
                    value={regForm.ownerName}
                    onChange={e => setRegForm({ ...regForm, ownerName: e.target.value })}
                    placeholder="Ej. Juan Pérez"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                  />
                </label>

                <label style={{ fontSize: '12px', fontWeight: 600 }}>
                  Teléfono Celular / WhatsApp
                  <input
                    value={regForm.phone}
                    onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
                    placeholder="0999999999"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                  />
                </label>

                <label style={{ fontSize: '12px', fontWeight: 600 }}>
                  Correo Electrónico (Tu usuario de acceso) *
                  <input
                    type="email"
                    value={regForm.email}
                    onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                  />
                </label>

                <label style={{ fontSize: '12px', fontWeight: 600 }}>
                  Contraseña Segura (mínimo 8 caracteres) *
                  <input
                    type="password"
                    value={regForm.password}
                    onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                  />
                </label>
              </div>

              {/* SELECTOR DE PLAN EN EL REGISTRO */}
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Plan Seleccionado para tu Tienda:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                  {plans.map(p => (
                    <div
                      key={p.code}
                      onClick={() => setRegForm({ ...regForm, plan: p.code })}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: regForm.plan === p.code ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: regForm.plan === p.code ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: regForm.plan === p.code ? '#1d4ed8' : '#1e293b' }}>
                          {p.name.split('/')[0].trim()}
                        </strong>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#059669' }}>
                          ${Number(p.monthlyPrice).toFixed(0)}/m
                        </span>
                      </div>
                      <small style={{ display: 'block', color: '#64748b', fontSize: '11px', marginTop: 2 }}>
                        {p.includedModules.length} módulos incluidos
                      </small>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: 6, fontSize: '11.5px', color: '#166534', lineHeight: 1.4 }}>
                🧪 <b>15 Días de Prueba Gratuita con TODO Incluido:</b> Tu tienda se creará de inmediato con <b>TODOS los módulos y servicios habilitados al 100%</b> (Inventario, POS, Caja, Cotizaciones, Órdenes de Servicio, Facturación SRI, DeUna QR, Payphone y APIs) para que puedas probar todo el potencial de FixmeTiendas.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setShowRegisterModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-action"
                  disabled={registering}
                  style={{ padding: '11px 24px', fontSize: '13.5px', fontWeight: 700 }}
                >
                  {registering ? 'Creando Tienda...' : '🚀 Crear Mi Tienda y Comenzar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: INICIO DE SESIÓN DIRECTO --- */}
      {showLoginModal && (
        <div className="lp-modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="lp-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#2563eb', color: '#fff', padding: '3px 8px', borderRadius: 6, fontWeight: 800, fontSize: '13px' }}>FX</span>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Iniciar Sesión en tu Tienda</h3>
              </div>
              <button className="close-btn" onClick={() => setShowLoginModal(false)}>✕</button>
            </div>

            {loginError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px', borderRadius: 6, color: '#b91c1c', fontSize: '12px', marginBottom: 12 }}>
                ⚠️ {loginError}
              </div>
            )}


            {/* MODE SWITCHER */}
            <div className="pocket-mode-toggle" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={`pocket-mode-btn ${loginTargetMode === 'POCKET' ? 'active' : ''}`}
                onClick={() => setLoginTargetMode('POCKET')}
              >
                📱 Pocket Móvil (Técnico / POS)
              </button>
              <button
                type="button"
                className={`pocket-mode-btn ${loginTargetMode === 'DESKTOP' ? 'active' : ''}`}
                onClick={() => setLoginTargetMode('DESKTOP')}
              >
                💻 Panel Desktop
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Correo electrónico
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4, boxSizing: 'border-box' }}
                />
              </label>

              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Contraseña
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ width: '100%', padding: '9px 36px 9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4, boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '55%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#64748b',
                      padding: 2
                    }}
                    title={showLoginPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showLoginPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                className="primary-action"
                disabled={loggingIn}
                style={{ width: '100%', padding: '11px', marginTop: 8, justifyContent: 'center' }}
              >
                {loggingIn ? 'Validando...' : loginTargetMode === 'POCKET' ? '⚡ Entrar a Fixme Pocket' : '🚀 Entrar a Mi Panel'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', margin: '8px 0 0 0' }}>
                ¿Aún no tienes cuenta?{' '}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  onClick={() => {
                    setShowLoginModal(false);
                    setShowRegisterModal(true);
                  }}
                >
                  Regístrate aquí
                </button>
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

