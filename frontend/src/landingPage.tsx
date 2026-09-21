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
}

export function LandingPage({ onLogin, onOpenDirectLogin }: LandingPageProps) {
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
            <a href="#features">Funcionalidades</a>
            <a href="#modules">Módulos</a>
            <a href="#pricing">Planes & Tarifas</a>
            <a href="#payments">Pagos Digitales</a>
            <a href="#faq">Preguntas Frecuentes</a>
          </nav>

          <div className="landing-nav-actions">
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
          <div className="landing-hero-pill">
            <span>✨ Novedad:</span> Pasarelas DeUna QR y Tarjetas Payphone Integradas
          </div>
          <h1 className="landing-hero-title">
            El Software Punto de Venta & Gestión más potente para tu Negocio en Ecuador
          </h1>
          <p className="landing-hero-subtitle">
            Controla tu inventario multicentro, emite facturación electrónica autorizada por el SRI, administra órdenes de servicio técnico y cobra con DeUna QR y tarjetas Visa/Mastercard desde cualquier dispositivo.
          </p>

          <div className="landing-hero-cta">
            <button
              type="button"
              className="landing-btn-hero-primary"
              onClick={() => handleChoosePlan('PRO')}
            >
              🚀 Comenzar Prueba Gratis (15 Días)
            </button>
            <a href="#pricing" className="landing-btn-hero-secondary">
              Ver Planes & Módulos
            </a>
          </div>

          <div className="landing-hero-badges">
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
              <div className="mockup-title">FixmeTiendas · Punto de Venta & Caja Principal</div>
              <span className="mockup-live-badge">● EN VIVO</span>
            </div>

            <div className="mockup-body">
              <div className="mockup-stats-row">
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
                  <strong style={{ color: '#059669' }}>100% Autorizadas</strong>
                  <span className="positive">Clave 49 dígitos</span>
                </div>
              </div>

              <div className="mockup-pos-preview">
                <div className="mockup-cart-item">
                  <div className="item-icon">📱</div>
                  <div className="item-details">
                    <b>Pantalla OLED Samsung A54 + Instalación</b>
                    <small>Garantía 90 días · Código: REP-SAM-01</small>
                  </div>
                  <div className="item-price">$65.00</div>
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
              <a href="#features">Punto de Venta POS</a>
              <a href="#features">Taller & Reparaciones</a>
              <a href="#features">Inventario & Kardex</a>
              <a href="#payments">Pagos DeUna & Payphone</a>
            </div>
            <div>
              <strong>Acceso</strong>
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

