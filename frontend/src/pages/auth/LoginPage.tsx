import React from 'react';
import { getBranchId, getTenantId } from '../../sharedConfig';

let tenantId = getTenantId();
let branchId = getBranchId();
export function StoreTrialUpgradeModal({tenantName, trialEndsAt, daysRemaining, onClose}:{tenantName:string; trialEndsAt?:string; daysRemaining?:number; onClose:()=>void}){
  const [selectedPlan, setSelectedPlan] = React.useState('PRO');
  const plans = [
    { code: 'STARTER', name: 'Plan Básico / Inventario', price: 25, desc: 'Inventario multicentro, Kardex, Clientes y Reportes.' },
    { code: 'PRO', name: 'Plan Comercial / POS & Caja', price: 49, desc: 'Todo lo básico + Punto de Venta (POS), Facturación SRI, Caja & Corte Z y Cotizaciones Web.', popular: true },
    { code: 'WORKSHOP', name: 'Plan Taller & Servicio Técnico', price: 69, desc: 'Todo lo comercial + Órdenes de Servicio Técnico, Tracking QR y Delivery.' },
    { code: 'ENTERPRISE', name: 'Plan Enterprise / Full APIs', price: 99, desc: 'Acceso Total ilimitado + Pasarelas DeUna QR, PayPhone con tarjeta de crédito y Webhooks API.' }
  ];
  const chosen = plans.find(p=>p.code===selectedPlan) || plans[1];
  const waMsg = encodeURIComponent(`Hola administración de FixmeTiendas! Estoy evaluando la plataforma en mi tienda "${tenantName}" (Prueba 15 días) y deseo contratar el ${chosen.name} ($${chosen.price}/mes). ¿Podrían ayudarme a activar mi suscripción definitiva?`);
  const waUrl = `https://wa.me/593991234567?text=${waMsg}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()} style={{maxWidth:650}}>
        <div className="modal-header">
          <div>
            <span style={{fontSize:'11px',fontWeight:800,color:'#4f46e5',textTransform:'uppercase',letterSpacing:'0.05em'}}>
              🧪 PERÍODO DE PRUEBA ACTIVO (15 DÍAS)
            </span>
            <h3 style={{margin:'2px 0 0'}}>Contratar Plan Definitivo para {tenantName}</h3>
            <small style={{color:'#64748b'}}>
              Te quedan <strong>{daysRemaining!==undefined?(daysRemaining<=0?'0 días (Vence hoy)':`${daysRemaining} días`):'15 días'}</strong> de evaluación completa sin costo.
            </small>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{margin:'14px 0 18px'}}>
          <label style={{fontSize:'12.5px',fontWeight:700,display:'block',marginBottom:8}}>
            Elige el plan que mejor se adapte a tu negocio:
          </label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))',gap:10}}>
            {plans.map(p=>(
              <div
                key={p.code}
                onClick={()=>setSelectedPlan(p.code)}
                style={{
                  padding:'12px 14px',
                  borderRadius:10,
                  border:selectedPlan===p.code?'2px solid #4f46e5':'1px solid #cbd5e1',
                  background:selectedPlan===p.code?'#eef2ff':'#ffffff',
                  cursor:'pointer',
                  position:'relative',
                  boxShadow:selectedPlan===p.code?'0 4px 12px rgba(79, 70, 229, 0.15)':'none'
                }}
              >
                {p.popular&&(
                  <span style={{position:'absolute',top:8,right:8,background:'#4f46e5',color:'#fff',fontSize:'9.5px',fontWeight:800,padding:'2px 6px',borderRadius:4}}>
                    ★ RECOMENDADO
                  </span>
                )}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                  <strong style={{fontSize:'13px',color:selectedPlan===p.code?'#3730a3':'#0f172a'}}>{p.name.split('/')[0].trim()}</strong>
                  <span style={{fontSize:'14px',fontWeight:900,color:'#059669'}}>${p.price}<small style={{fontSize:'10px'}}>/mes</small></span>
                </div>
                <p style={{fontSize:'11.5px',color:'#64748b',margin:'6px 0 0',lineHeight:1.35}}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:'12px',color:'#475569'}}>
          💡 <b>Toda tu información se conserva:</b> Al activar tu plan definitivo se mantendrán intactos todos tus productos, clientes, ventas y órdenes registradas durante la prueba.
        </div>

        <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
          <button type="button" className="secondary-action" onClick={onClose}>Seguir Probando</button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="primary-action"
            style={{display:'inline-flex',alignItems:'center',gap:8,background:'linear-gradient(135deg, #10b981, #059669)',textDecoration:'none',padding:'9px 18px',fontSize:'13px',fontWeight:700}}
          >
            💬 Solicitar Activación por WhatsApp →
          </a>
        </div>
      </div>
    </div>
  );
}

export function Login({ onLogin, onBack }: { onLogin: (t: string, mode?: 'POCKET' | 'DESKTOP') => void; onBack?: () => void }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [targetMode, setTargetMode] = React.useState<'POCKET' | 'DESKTOP'>(() => {
    const saved = localStorage.getItem('fixme_view_mode');
    if (saved === 'DESKTOP' || saved === 'POCKET') return saved;
    return (window.innerWidth <= 768 || window.location.hash.includes('pocket')) ? 'POCKET' : 'DESKTOP';
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      if (r.ok) {
        const data = await r.json();
        if (data.tenantId) { tenantId = data.tenantId; localStorage.tenantId = data.tenantId; }
        if (data.branchId) { branchId = data.branchId; localStorage.branchId = data.branchId; }
        if (data.tenantName) { localStorage.tenantName = data.tenantName; }
        if (data.fullName) { localStorage.fullName = data.fullName; }
        if (data.isTrial) {
          localStorage.isTrial = 'true';
          if (data.trialDaysRemaining !== undefined && data.trialDaysRemaining !== null) {
            localStorage.trialDaysRemaining = String(data.trialDaysRemaining);
          }
          if (data.trialEndsAt) { localStorage.trialEndsAt = data.trialEndsAt; }
        } else {
          localStorage.removeItem('isTrial');
          localStorage.removeItem('trialDaysRemaining');
          localStorage.removeItem('trialEndsAt');
        }
        localStorage.setItem('fixme_view_mode', targetMode);
        onLogin(data.accessToken, targetMode);
      } else {
        try {
          const data = await r.json();
          if (data && (data.error === 'TRIAL_EXPIRED' || data.error === 'STORE_SUSPENDED' || r.status === 402)) {
            setError('🚫 ' + (data.message || 'Tu período de prueba ha finalizado o la tienda se encuentra suspendida. Contacta al administrador del sistema.'));
            return;
          }
        } catch {}
        setError('No pudimos validar tus credenciales. Verifica tu correo y contraseña.');
      }
    } catch (err: any) {
      setError('Error de conexión con el servidor: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pocket-login-container">
      <div className="pocket-login-card">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '12.5px',
              cursor: 'pointer',
              marginBottom: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: 0,
              fontWeight: 600
            }}
          >
            ← Volver a la página principal
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div className="pocket-login-logo">FX</div>
          <span className="pocket-login-badge">
            {targetMode === 'POCKET' ? '⚡ Fixme Pocket Móvil' : '🖥️ Modo Desktop'}
          </span>
        </div>

        <h1 className="pocket-login-title">
          {targetMode === 'POCKET' ? 'Fixme Pocket' : 'FixmeTiendas'}
        </h1>
        <p className="pocket-login-subtitle">
          {targetMode === 'POCKET'
            ? 'Punto de Venta móvil, órdenes de taller y despachos en tu mano.'
            : 'Gestión integral, facturación SRI, inventario y taller desde un solo lugar.'}
        </p>

        {/* MODE TOGGLE */}
        <div className="pocket-mode-toggle">
          <button
            type="button"
            className={`pocket-mode-btn ${targetMode === 'POCKET' ? 'active' : ''}`}
            onClick={() => setTargetMode('POCKET')}
          >
            📱 Pocket Móvil (Técnico / POS)
          </button>
          <button
            type="button"
            className={`pocket-mode-btn ${targetMode === 'DESKTOP' ? 'active' : ''}`}
            onClick={() => setTargetMode('DESKTOP')}
          >
            💻 Panel Desktop
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '10px', color: '#b91c1c', fontSize: '12.5px', marginBottom: 14, lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="pocket-field">
            <label>✉️ Correo electrónico</label>
            <div className="pocket-input-wrap">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="ejemplo@correo.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="pocket-field">
            <label>🔒 Contraseña</label>
            <div className="pocket-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pocket-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="pocket-submit-btn"
            disabled={loading}
          >
            {loading ? 'Validando credenciales...' : targetMode === 'POCKET' ? '⚡ Entrar a Fixme Pocket' : '🚀 Iniciar Sesión en Tienda'}
          </button>
        </form>

        <div className="pocket-login-footer">
          <a
            href="#portal-cliente"
            style={{
              color: '#2563eb',
              fontSize: '12.5px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '6px'
            }}
          >
            👤 ¿Eres cliente? Consulta tu equipo en vivo aquí →
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;
