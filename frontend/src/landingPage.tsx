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
  const [loggingIn, setLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');

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

  return (
    <div className="landing-shell">
      {/* 1. TOP NAVBAR */}
      <header className="landing-nav">
        <div className="landing-nav-container">
          <div className="landing-brand">
            <span className="landing-logo-badge">FX</span>
            <span className="landing-logo-text">Fixme<span>Tiendas</span></span>
            <span className="landing-country-badge">🇪🇨 Ecuador</span>
          </div>

          <nav className="landing-nav-links">
            <a href="#marketplace-service" style={{ color: '#059669', fontWeight: 800 }}>🛠️ Red de Talleres</a>
            <a href="#features">Funcionalidades</a>
            <a href="#modules">Módulos</a>
            <a href="#pricing">Planes & Tarifas</a>
            <a href="#payments">Pagos Digitales</a>
            <a href="#faq">Preguntas Frecuentes</a>
          </nav>

          <div className="landing-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => navigateTo('#portal-cliente')}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(37,99,235,0.25)'
              }}
              title="Acceso seguro con Celular y Cédula a tus reparaciones activas, autorizaciones, facturas y garantías"
            >
              <span>👤 Portal Clientes</span>
              <span style={{ background: 'rgba(255,255,255,0.22)', padding: '2px 7px', borderRadius: 6, fontSize: '11px', fontWeight: 700 }}>
                Reparaciones · Facturas · Garantías
              </span>
            </button>

            <button
              type="button"
              className="landing-btn-secondary"
              onClick={() => {
                if (onOpenDirectLogin) onOpenDirectLogin();
                else setShowLoginModal(true);
              }}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              className="landing-btn-primary"
              onClick={() => handleChoosePlan('PRO')}
            >
              Crear Tienda Gratis
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span>🔥 Red de Talleres & Marketplace:</span> Cotiza reparaciones gratis o capta clientes para tu taller
          </div>
          <h1 className="landing-hero-title">
            El Software POS, Facturación SRI y <span style={{ color: '#2563eb' }}>Gestión de Reparaciones</span> más potente de Ecuador
          </h1>
          <p className="landing-hero-subtitle">
            La plataforma integral que conecta a talleres técnicos y tiendas comerciales de Ecuador con sus clientes. <b>Para negocios:</b> Punto de Venta POS, Facturación Electrónica SRI, inventario y gestión de órdenes técnicas. <b>Para clientes:</b> Portal unificado de seguimiento en tiempo real, aprobación de presupuestos, facturas y garantías con Celular y Cédula.
          </p>

          <div className="landing-hero-cta" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="landing-btn-hero-primary"
              onClick={() => handleChoosePlan('PRO')}
            >
              🚀 Registrar Tienda o Taller (15 Días Gratis)
            </button>

            <button
              type="button"
              onClick={() => navigateTo('#portal-cliente')}
              style={{
                background: '#ffffff',
                color: '#2563eb',
                border: '2px solid #2563eb',
                padding: '12px 20px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(37,99,235,0.1)'
              }}
            >
              👤 Portal Clientes: Mis Reparaciones & Facturas →
            </button>

            <a href="#pricing" className="landing-btn-hero-secondary">
              Ver Planes & Módulos
            </a>
          </div>

          {/* BANNER EXPLICATIVO PARA CLIENTES FINALES */}
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
            border: '1.5px solid #bfdbfe',
            borderRadius: 14,
            padding: '16px 20px',
            marginTop: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 280 }}>
              <span style={{ fontSize: 32 }}>📱🪪</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#1e3a8a' }}>
                  ¿Dejaste un equipo en un taller o compraste en una tienda Fixme?
                </div>
                <div style={{ fontSize: 12.5, color: '#475569', marginTop: 3, lineHeight: 1.4 }}>
                  Ingresa con tu <b>Número de Celular y Cédula</b>: no necesitas crear contraseñas. Podrás ver el estado en vivo de tu reparación, autorizar presupuestos de repuestos en 1 clic, descargar tus facturas electrónicas y consultar garantías oficiales.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('#portal-cliente')}
              style={{
                background: '#2563eb', color: '#fff', border: 'none', padding: '10px 18px',
                borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
              }}
            >
              <span>Acceder al Portal del Cliente</span>
              <span>→</span>
            </button>
          </div>

          <div className="landing-hero-badges">
            <div className="landing-badge-item">
              <span className="badge-icon">🎯</span>
              <span>Bolsa de Reparaciones</span>
            </div>
            <div className="landing-badge-item">
              <span className="badge-icon">🏛️</span>
              <span>Facturación SRI Lista</span>
            </div>
            <div className="landing-badge-item">
              <span className="badge-icon">📱</span>
              <span>DeUna QR Pichincha</span>
            </div>
            <div className="landing-badge-item">
              <span className="badge-icon">💳</span>
              <span>Tarjetas con Payphone</span>
            </div>
            <div className="landing-badge-item">
              <span className="badge-icon">📶</span>
              <span>Modo Offline & Cloud</span>
            </div>
          </div>
        </div>

        {/* HERO MOCKUP CARD */}
        <div className="landing-hero-mockup-wrapper">
          <div className="landing-mockup-card">
            <div className="mockup-header">
              <div className="mockup-dots">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <div className="mockup-title">FixmeTiendas · Centro Operativo & Bolsa en Vivo</div>
              <span className="mockup-live-badge">● RED CONECTADA</span>
            </div>

            <div className="mockup-body">
              <div className="mockup-stats-row">
                <div className="mockup-stat">
                  <small>Solicitudes Abiertas</small>
                  <strong style={{ color: '#059669' }}>28 en tu ciudad</strong>
                  <span className="positive">↑ 6 nuevas hoy</span>
                </div>
                <div className="mockup-stat">
                  <small>Ventas Hoy</small>
                  <strong>$1,420.50</strong>
                  <span className="positive">↑ +18% vs ayer</span>
                </div>
                <div className="mockup-stat">
                  <small>Órdenes Taller</small>
                  <strong>14 en curso</strong>
                  <span className="neutral">8 diagnósticos</span>
                </div>
                <div className="mockup-stat">
                  <small>Facturación SRI</small>
                  <strong style={{ color: '#2563eb' }}>100% Autorizadas</strong>
                  <span className="positive">Clave 49 dígitos</span>
                </div>
              </div>

              <div className="mockup-pos-preview">
                {/* Cotización de Reparación Card */}
                <div style={{ background: '#ffffff', borderRadius: 10, padding: 12, border: '1.5px solid #2563eb', marginBottom: 10, boxShadow: '0 4px 6px -1px rgba(37,99,235,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>📱</span>
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>iPhone 13 · Cambio de Pantalla OLED</strong>
                    </div>
                    <span style={{ background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                      $75.00 · Aprobado
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>
                    Cliente: Juan Pérez · 📍 Quito Norte · Retiro a Domicilio
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <span style={{ background: '#f1f5f9', color: '#334155', fontSize: 10.5, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                      ⏱️ 24 Horas
                    </span>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: 10.5, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                      🛡️ Garantía 180 Días
                    </span>
                    <span style={{ background: '#faf5ff', color: '#7e22ce', fontSize: 10.5, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                      ✨ Pantalla Grado OEM
                    </span>
                  </div>
                </div>

                <div className="mockup-cart-item">
                  <div className="item-icon">🎧</div>
                  <div className="item-details">
                    <b>Auriculares Gamer Pro Hi-Fi RGB</b>
                    <small>Stock: 8 unidades en Sucursal</small>
                  </div>
                  <div className="item-price">$35.00</div>
                </div>

                <div className="mockup-payment-buttons">
                  <div className="payment-chip p-cash">💵 Efectivo ($100)</div>
                  <div className="payment-chip p-deuna">📱 DeUna QR ($100)</div>
                  <div className="payment-chip p-payphone">💳 Payphone Card ($100)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2.5 SECTION: MARKETPLACE & RED NACIONAL DE TALLERES */}
      <section id="marketplace-service" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '70px 20px' }}>
        <div className="landing-container">
          <div className="section-header" style={{ textAlign: 'center', maxWidth: 840, margin: '0 auto 50px' }}>
            <span className="section-kicker" style={{ color: '#059669', background: '#ecfdf5', padding: '4px 14px', borderRadius: 20, display: 'inline-block', fontSize: 12, fontWeight: 800 }}>
              REPARACIONES INTELIGENTES & CAPTACIÓN DE CLIENTES
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '14px 0 10px' }}>
              La Primera Red & Marketplace de Reparaciones de Ecuador
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
              Un ecosistema donde clientes con equipos averiados reciben las mejores propuestas de talleres técnicos certificados, con garantía formal y aprobación de repuestos en 1 solo clic.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 30 }}>
            {/* COLUMNA 1: PARA CLIENTES */}
            <div style={{ background: '#ffffff', borderRadius: 20, padding: 32, border: '1.5px solid #bbf7d0', boxShadow: '0 20px 25px -5px rgba(5,150,105,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#ecfdf5', color: '#059669', fontSize: 26, width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  👤
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Para Usuarios & Clientes</span>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f172a' }}>Portal del Cliente Fixme</h3>
                </div>
              </div>

              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>
                El centro unificado para todo lo que ocurre con tus dispositivos y compras. Accede simplemente con tu <b>Número de Celular y Cédula</b> sin recordar contraseñas.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ background: '#f0fdf4', color: '#16a34a', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    1
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1e293b' }}>Seguimiento en Vivo de Reparaciones</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      Mira en qué etapa técnica está tu equipo: Ingresado, Diagnosticado, En Reparación o Listo para entrega.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ background: '#f0fdf4', color: '#16a34a', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    2
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1e293b' }}>Autorización Digital de Repuestos con 1 Clic</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      Si el taller descubre un repuesto adicional o daño oculto, apruebas o rechazas el presupuesto desde tu pantalla sin sorpresas.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ background: '#f0fdf4', color: '#16a34a', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    3
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1e293b' }}>Garantías Oficiales & Facturación Electrónica</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      Pólizas con conteo regresivo de días de vigencia y recibos oficiales de tus compras en locales afiliados.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ background: '#f0fdf4', color: '#16a34a', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    4
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1e293b' }}>Bolsa de Cotizaciones para Nuevos Equipos</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      ¿Otro equipo averiado? Publícalo desde tu panel para que talleres especializados de tu ciudad compitan con sus mejores ofertas.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => navigateTo('#portal-cliente')}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff', border: 'none',
                    padding: '14px 20px', borderRadius: 10, fontSize: 14, fontWeight: 800,
                    cursor: 'pointer', flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 6px -1px rgba(37,99,235,0.25)'
                  }}
                >
                  👤 Entrar al Portal del Cliente (Reparaciones, Facturas & Garantías) →
                </button>
              </div>
            </div>

            {/* COLUMNA 2: PARA TALLERES Y TIENDAS */}
            <div style={{ background: '#ffffff', borderRadius: 20, padding: 32, border: '1.5px solid #bfdbfe', boxShadow: '0 20px 25px -5px rgba(37,99,235,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#eff6ff', color: '#2563eb', fontSize: 26, width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  🏢
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Para Talleres & Tiendas</span>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f172a' }}>Multiplica los trabajos de tu taller</h3>
                </div>
              </div>

              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>
                Conéctate a la Bolsa de Reparaciones y recibe solicitudes reales de clientes en tu ciudad que necesitan arreglar celulares, computadoras o tecnología.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ background: '#eff6ff', color: '#2563eb', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    1
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1e293b' }}>Bolsa de Leads en Tiempo Real</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      Visualiza equipos con fotos y fallas reportadas en tu ciudad y postula en segundos.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ background: '#eff6ff', color: '#2563eb', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    2
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1e293b' }}>Deduplicación Inteligente de Clientes</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      Cuando el cliente acepta tu cotización, el sistema verifica si ya existía en tu base por teléfono o correo para evitar perfiles duplicados.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ background: '#eff6ff', color: '#2563eb', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    3
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1e293b' }}>Aprobación Digital de Extras</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      Agrega repuestos o mano de obra adicional en tu panel y el cliente recibe la alerta para autorizar con 1 solo clic. Cero reclamos.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ background: '#eff6ff', color: '#2563eb', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    4
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1e293b' }}>Cobro Digital & Emisión de Garantías</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      Cobra con DeUna QR, tarjetas Payphone o efectivo y genera el certificado formal con días de garantía automáticamente.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleChoosePlan('WORKSHOP')}
                  style={{
                    background: '#2563eb', color: '#fff', border: 'none',
                    padding: '12px 20px', borderRadius: 10, fontSize: 13.5, fontWeight: 800,
                    cursor: 'pointer', flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  🚀 Activar Mi Taller en la Red (15 Días Gratis)
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2.8 SECTION: CÓMO FUNCIONA EL SISTEMA */}
      <section style={{ background: '#ffffff', padding: '60px 20px', borderBottom: '1px solid #e2e8f0' }}>
        <div className="landing-container">
          <div className="section-header" style={{ textAlign: 'center', maxWidth: 840, margin: '0 auto 40px' }}>
            <span className="section-kicker" style={{ color: '#2563eb', background: '#eff6ff', padding: '4px 14px', borderRadius: 20, display: 'inline-block', fontSize: 12, fontWeight: 800 }}>
              FLUJO INTELIGENTE & TRANSPARENTE
            </span>
            <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: '12px 0 8px' }}>
              ¿Cómo funciona el Sistema Fixme?
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              La tecnología que une la gestión operativa de los talleres técnicos con la tranquilidad y confianza de los clientes finales.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {/* PASO 1 */}
            <div style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 32 }}>📥</span>
                <span style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 900, fontSize: 12, padding: '4px 10px', borderRadius: 20 }}>
                  PASO 1
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                1. Recepción en el Taller
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                El técnico recibe el equipo en el sistema Fixme, registra la falla reportada, fotos de estado físico y asocia el celular y cédula del cliente.
              </p>
            </div>

            {/* PASO 2 */}
            <div style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 32 }}>📱🪪</span>
                <span style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 900, fontSize: 12, padding: '4px 10px', borderRadius: 20 }}>
                  PASO 2
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                2. Acceso al Portal del Cliente
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                El cliente entra al <b>Portal de Clientes</b> con su Celular y Cédula. No necesita contraseñas complejas y ve el avance en vivo de su orden técnica.
              </p>
            </div>

            {/* PASO 3 */}
            <div style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 32 }}>✍️</span>
                <span style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 900, fontSize: 12, padding: '4px 10px', borderRadius: 20 }}>
                  PASO 3
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                3. Aprobación Digital en 1 Clic
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                Si el diagnóstico requiere un repuesto adicional, el taller lo carga y el cliente lo aprueba o rechaza digitalmente desde su teléfono sin llamadas molestas.
              </p>
            </div>

            {/* PASO 4 */}
            <div style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 32 }}>🛡️🧾</span>
                <span style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 900, fontSize: 12, padding: '4px 10px', borderRadius: 20 }}>
                  PASO 4
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                4. Factura SRI & Garantía Oficial
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                Al retirar el equipo, la tienda emite la factura electrónica autorizada ante el SRI y la póliza digital de garantía con contador regresivo de días.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. KEY FEATURES SHOWCASE */}
      <section id="features" className="landing-section">
        <div className="landing-container">
          <div className="section-header">
            <span className="section-kicker">MÓDULOS DE ALTO IMPACTO</span>
            <h2>Todo lo que tu tienda o taller necesita para operar y crecer</h2>
            <p>Diseñado específicamente para las exigencias tributarias, operativas y comerciales de Ecuador.</p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ background: '#ecfdf5', color: '#059669' }}>
                🛒
              </div>
              <h3>Punto de Venta (POS) & SRI</h3>
              <p>
                Cobra en segundos, genera comprobantes térmicos de 80mm y emite facturas electrónicas autorizadas ante el SRI sin complicaciones técnicas.
              </p>
              <ul className="feature-bullets">
                <li>✓ Ticket térmico 80mm y RIDE oficial PDF</li>
                <li>✓ Modos con y sin datos (Consumidor Final)</li>
                <li>✓ Modo Offline resistente a caídas de internet</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ background: '#eff6ff', color: '#2563eb' }}>
                📦
              </div>
              <h3>Inventario Inteligente Multicentro</h3>
              <p>
                Controla entradas, salidas, mermas y traslados entre sucursales con kardex valorizado y alertas de stock bajo automáticas.
              </p>
              <ul className="feature-bullets">
                <li>✓ Lector de código de barras y generación de etiquetas</li>
                <li>✓ Importación masiva por archivo Excel/CSV</li>
                <li>✓ Precios al por mayor, costo y margen de ganancia</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ background: '#fef3c7', color: '#d97706' }}>
                🛠️
              </div>
              <h3>Taller & Servicio Técnico Especializado</h3>
              <p>
                El flujo de trabajo perfecto para recepción de equipos, diagnóstico preliminar, cotización con aprobación web y asignación a técnicos.
              </p>
              <ul className="feature-bullets">
                <li>✓ Portal de seguimiento para clientes por código QR</li>
                <li>✓ Aprobación digital de presupuestos con WhatsApp</li>
                <li>✓ Control de garantías comerciales y números de serie</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ background: '#f0fdfa', color: '#0f766e' }}>
                📱
              </div>
              <h3>Pagos Digitales DeUna QR & Payphone</h3>
              <p>
                Acepta pagos al instante escaneando código QR de Banco Pichincha o tarjetas de crédito y débito internacionales Visa, Mastercard y Diners.
              </p>
              <ul className="feature-bullets">
                <li>✓ Conciliación automática con la caja del día</li>
                <li>✓ Botón de cobro en el POS y en cotizaciones web</li>
                <li>✓ Modo Sandbox para pruebas sin dinero real</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ background: '#faf5ff', color: '#9333ea' }}>
                📑
              </div>
              <h3>Cotizaciones & Proformas Online</h3>
              <p>
                Envía cotizaciones con enlace interactivo directo al WhatsApp de tus clientes. El cliente puede revisar el detalle, aprobar y pagar en línea.
              </p>
              <ul className="feature-bullets">
                <li>✓ Conversión a venta en un solo clic</li>
                <li>✓ Catálogo digital público para compartir en redes</li>
                <li>✓ Notificaciones inmediatas de aprobación</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ background: '#fff1f2', color: '#e11d48' }}>
                🚚
              </div>
              <h3>Entregas & Despachos a Domicilio</h3>
              <p>
                Gestiona motorizados, rutas de entrega y seguimiento en vivo para que tus clientes sepan exactamente cuándo llegará su pedido.
              </p>
              <ul className="feature-bullets">
                <li>✓ Registro de costo de envío y comprobante de entrega</li>
                <li>✓ Seguimiento público con enlace de tracking</li>
                <li>✓ Estado: En camino, Entregado, Reprogramado</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PRICING & SUBSCRIPTION PLANS */}
      <section id="pricing" className="landing-section landing-pricing-bg">
        <div className="landing-container">
          <div className="section-header">
            <span className="section-kicker">PLANES & TARIFAS FLEXIBLES</span>
            <h2>Elige el paquete de módulos ideal para tu negocio</h2>
            <p>
              Planes configurables sin contratos forzosos. Comienza con 15 días gratis y activa solo los módulos que tu tienda realmente necesita.
            </p>
          </div>

          <div className="pricing-grid">
            {plans.map(p => (
              <div
                key={p.code}
                className={`pricing-card ${p.isPopular ? 'popular-card' : ''}`}
              >
                {p.isPopular && (
                  <div className="popular-badge">
                    ⭐ MÁS POPULAR
                  </div>
                )}
                {p.badge && !p.isPopular && (
                  <div className="plan-badge">
                    {p.badge}
                  </div>
                )}

                <div className="plan-header">
                  <h3 className="plan-name">{p.name}</h3>
                  <p className="plan-desc">{p.description}</p>
                  <div className="plan-price-wrapper">
                    <span className="price-currency">$</span>
                    <span className="price-amount">{Number(p.monthlyPrice).toFixed(0)}</span>
                    <span className="price-cents">.{Number(p.monthlyPrice).toFixed(2).split('.')[1]}</span>
                    <span className="price-period">/ mes</span>
                  </div>
                </div>

                <div className="plan-modules-box">
                  <small>MÓDULOS ACTIVOS EN ESTE PAQUETE:</small>
                  <div className="modules-chips">
                    {p.includedModules.map(m => {
                      const info = MODULE_LABELS[m] || { label: m, icon: '✓' };
                      return (
                        <span key={m} className="module-chip">
                          <i>{info.icon}</i> {info.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="plan-divider"></div>

                <ul className="plan-features-list">
                  {p.features.map((feat, idx) => (
                    <li key={idx}>
                      <span className="check">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={p.isPopular ? 'btn-plan-popular' : 'btn-plan-normal'}
                  onClick={() => handleChoosePlan(p.code)}
                >
                  Comenzar con {p.name.split('/')[0].trim()}
                </button>
              </div>
            ))}
          </div>

          <div className="pricing-guarantee">
            <div className="guarantee-icon">🛡️</div>
            <div>
              <strong>Garantía de Satisfacción 100%:</strong> Cancela o cambia de plan en cualquier momento desde tu panel de administración. Sin letras pequeñas ni cláusulas de permanencia.
            </div>
          </div>
        </div>
      </section>

      {/* 5. FAQ SECTION */}
      <section id="faq" className="landing-section">
        <div className="landing-container" style={{ maxWidth: 860 }}>
          <div className="section-header">
            <span className="section-kicker">DUDAS COMUNES</span>
            <h2>Preguntas Frecuentes</h2>
          </div>

          <div className="faq-accordion">
            <details className="faq-item" open>
              <summary>¿Qué requisitos necesito para facturar electrónicamente con el SRI?</summary>
              <p>
                Solo necesitas tu RUC de Ecuador y tu firma electrónica en formato `.p12` (emitida por el Registro Civil, Security Data, ANF, Uanataca, etc.). Nuestro sistema se encarga de firmar los XML y validar ante el web service oficial del SRI.
              </p>
            </details>

            <details className="faq-item">
              <summary>¿Cómo funcionan los cobros con DeUna QR y Payphone?</summary>
              <p>
                Puedes usar el modo Sandbox para probar cobros simulados inmediatamente. Cuando desees cobrar dinero real, ingresas tus credenciales de comercio en la pestaña Empresa y los cobros caerán directamente en tu cuenta bancaria o saldo Payphone.
              </p>
            </details>

            <details className="faq-item">
              <summary>¿Puedo cambiar de plan o activar módulos adicionales después?</summary>
              <p>
                Sí, puedes solicitar la activación de módulos específicos (como el módulo de APIs o el taller de servicio técnico) en cualquier momento manteniendo tu información y productos intactos.
              </p>
            </details>

            <details className="faq-item">
              <summary>¿Funciona si se cae el internet en mi local?</summary>
              <p>
                ¡Sí! FixmeTiendas cuenta con arquitectura de sincronización offline: puedes seguir registrando ventas y cuando vuelva el internet, el sistema sincroniza automáticamente con la nube y emite las facturas pendientes.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION FOOTER */}
      <section className="landing-cta-banner">
        <div className="landing-container">
          <h2>¿Listo para digitalizar y ordenar tu negocio hoy?</h2>
          <p>Únete a cientos de dueños de tiendas y talleres que ahorran más de 15 horas a la semana con FixmeTiendas.</p>
          <button
            type="button"
            className="landing-btn-hero-primary"
            onClick={() => handleChoosePlan('PRO')}
            style={{ margin: '0 auto', display: 'inline-flex' }}
          >
            🚀 Crear Mi Tienda Ahora · Prueba Gratuita
          </button>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="landing-footer">
        <div className="landing-container footer-flex">
          <div className="footer-left">
            <div className="landing-brand">
              <span className="landing-logo-badge">FX</span>
              <span className="landing-logo-text">Fixme<span>Tiendas</span></span>
            </div>
            <p>Plataforma SaaS integral de Punto de Venta, Inventario, Taller Técnico y Facturación SRI para Ecuador.</p>
            <small>© {new Date().getFullYear()} FixmeTiendas S.A.S. Todos los derechos reservados.</small>
          </div>

          <div className="footer-links">
            <div>
              <strong>Plataforma</strong>
              <a href="#marketplace-service">Red de Talleres & Cotizaciones</a>
              <a href="#features">Punto de Venta POS</a>
              <a href="#features">Taller & Reparaciones</a>
              <a href="#features">Inventario & Kardex</a>
              <a href="#payments">Pagos DeUna & Payphone</a>
            </div>
            <div>
              <strong>Clientes & Reparaciones</strong>
              <button type="button" onClick={() => navigateTo('#portal-cliente')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' }}>👤 Portal Clientes (Reparaciones, Facturas & Garantías)</button>
              <a href="#faq">Preguntas Frecuentes</a>
            </div>
            <div>
              <strong>Acceso Comercios</strong>
              <button type="button" onClick={() => setShowLoginModal(true)}>Iniciar Sesión</button>
              <button type="button" onClick={() => handleChoosePlan('PRO')}>Registrar Tienda</button>
              <a href="#pricing">Tarifas Mensuales</a>
            </div>
            <div>
              <strong>Soporte</strong>
              <a href="https://wa.me/593999999999" target="_blank" rel="noreferrer">WhatsApp Oficial</a>
              <a href="mailto:soporte@fixmetiendas.com">soporte@fixmetiendas.com</a>
              <span>Quito & Guayaquil, Ecuador</span>
            </div>
          </div>
        </div>
      </footer>

      {/* --- MODAL 1: REGISTRO DE TIENDA AUTOPROVISIÓN --- */}
      {showRegisterModal && (
        <div className="modal-backdrop" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-content modal-register-content" onClick={e => e.stopPropagation()}>
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
        <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
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

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Correo electrónico
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </label>

              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Contraseña
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </label>

              <button
                type="submit"
                className="primary-action"
                disabled={loggingIn}
                style={{ width: '100%', padding: '11px', marginTop: 8, justifyContent: 'center' }}
              >
                {loggingIn ? 'Validando...' : 'Entrar a Mi Panel'}
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

