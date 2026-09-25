import React from 'react';

type Any = Record<string, any>;

const DEVICE_CATEGORIES = [
  { id: 'SMARTPHONE', label: 'Celular / Smartphone', icon: '📱' },
  { id: 'LAPTOP', label: 'Laptop / Computadora', icon: '💻' },
  { id: 'TABLET', label: 'Tablet / iPad', icon: '📲' },
  { id: 'CONSOLE', label: 'Consola Videojuegos', icon: '🎮' },
  { id: 'DESKTOP', label: 'PC Escritorio / Torre', icon: '🖥️' },
  { id: 'SMARTWATCH', label: 'Smartwatch / Reloj', icon: '⌚' },
  { id: 'OTHER', label: 'Otro Dispositivo', icon: '🔌' }
];

const ECUADOR_CITIES = [
  'Quito', 'Guayaquil', 'Cuenca', 'Ambato', 'Santo Domingo',
  'Machala', 'Loja', 'Manta', 'Portoviejo', 'Ibarra', 'Riobamba', 'Esmeraldas', 'Quevedo', 'Latacunga'
];

interface CustomerPortalProps {
  onBack?: () => void;
  initialPhone?: string;
  initialCedula?: string;
}

export function CustomerPortal({ onBack, initialPhone, initialCedula }: CustomerPortalProps) {
  // Session credentials
  const [phone, setPhone] = React.useState<string>(() => {
    return initialPhone || localStorage.fixmeCustomerPhone || '';
  });
  const [cedula, setCedula] = React.useState<string>(() => {
    return initialCedula || localStorage.fixmeCustomerIdNumber || '';
  });
  const [customerName, setCustomerName] = React.useState(localStorage.fixmeCustomerName || '');

  // Form inputs
  const [inputPhone, setInputPhone] = React.useState(phone);
  const [inputCedula, setInputCedula] = React.useState(cedula);
  const [isAuthenticated, setIsAuthenticated] = React.useState(
    Boolean(phone && phone.trim().length >= 7 && (cedula || localStorage.fixmeCustomerIdNumber))
  );

  // Navigation tab
  const [activeTab, setActiveTab] = React.useState<'repairs' | 'requests' | 'publish' | 'purchases' | 'warranties' | 'profile'>('repairs');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [successToast, setSuccessToast] = React.useState('');
  const [previewPhoto, setPreviewPhoto] = React.useState<{ url: string; title: string; stage?: string } | null>(null);

  // Form for publishing new device directly inside the active customer session
  const [deviceForm, setDeviceForm] = React.useState({
    deviceCategory: 'SMARTPHONE',
    deviceBrand: '',
    deviceModel: '',
    powersOn: true,
    faultDescription: '',
    urgency: 'NORMAL',
    city: 'Quito',
    neighborhood: '',
    customerAddress: '',
    deliveryPreference: 'WORKSHOP'
  });
  const [deviceImages, setDeviceImages] = React.useState<Array<{ imageUrl: string; fileName: string }>>([]);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [publishSuccess, setPublishSuccess] = React.useState<Any | null>(null);
  const [publishError, setPublishError] = React.useState('');

  // Dual auth mode
  const [authMode, setAuthMode] = React.useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [registerForm, setRegisterForm] = React.useState({
    fullName: '',
    phone: '',
    identificationNumber: '',
    email: '',
    city: 'Quito',
    address: ''
  });

  // Portal 360 data
  const [portalData, setPortalData] = React.useState<{
    account?: Any;
    requests: Any[];
    workOrders: Any[];
    sales: Any[];
    warranties: Any[];
  }>({
    requests: [],
    workOrders: [],
    sales: [],
    warranties: []
  });

  // Action states
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [showRejectModal, setShowRejectModal] = React.useState<string | null>(null);
  const [showProfileEdit, setShowProfileEdit] = React.useState(false);

  const [profileForm, setProfileForm] = React.useState({
    fullName: '',
    email: '',
    identificationNumber: '',
    city: 'Quito',
    address: ''
  });

  // Load customer 360 data
  const loadPortal = React.useCallback(async (ph: string, idNum?: string) => {
    if (!ph || ph.trim().length < 7) return;
    setLoading(true);
    setError('');
    try {
      const url = `/api/public/customer/portal?phone=${encodeURIComponent(ph.trim())}` +
        (idNum ? `&identificationNumber=${encodeURIComponent(idNum.trim())}` : '');
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'No se pudo cargar el portal del cliente');
      }
      const data = await res.json();
      setPortalData({
        account: data.account || {},
        requests: Array.isArray(data.requests) ? data.requests : [],
        workOrders: Array.isArray(data.workOrders) ? data.workOrders : [],
        sales: Array.isArray(data.sales) ? data.sales : [],
        warranties: Array.isArray(data.warranties) ? data.warranties : []
      });
      if (data.account?.full_name) {
        setCustomerName(data.account.full_name);
        localStorage.fixmeCustomerName = data.account.full_name;
      }
      if (data.account?.identification_number) {
        setCedula(data.account.identification_number);
        localStorage.fixmeCustomerIdNumber = data.account.identification_number;
      }
      setProfileForm({
        fullName: data.account?.full_name || '',
        email: data.account?.email || '',
        identificationNumber: data.account?.identification_number || idNum || '',
        city: data.account?.city || 'Quito',
        address: data.account?.address || ''
      });
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isAuthenticated && phone) {
      loadPortal(phone, cedula);
    }
  }, [isAuthenticated, phone, cedula, loadPortal]);

  // Handle phone + cédula login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const cleanPh = inputPhone.trim();
    const cleanId = inputCedula.trim().replace(/[^0-9a-zA-Z]/g, '');

    if (cleanPh.length < 7) {
      setError('Por favor ingresa un número de celular o WhatsApp válido (mínimo 7 dígitos).');
      return;
    }
    if (!cleanId) {
      setError('Por favor ingresa tu número de cédula o RUC.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/public/customer/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPh,
          identificationNumber: cleanId,
          action: 'LOGIN',
          fullName: customerName || ''
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setPhone(cleanPh);
        setCedula(cleanId);
        localStorage.fixmeCustomerPhone = cleanPh;
        localStorage.fixmeCustomerIdNumber = cleanId;
        const name = data?.account?.full_name || 'Cliente';
        setCustomerName(name);
        localStorage.fixmeCustomerName = name;
        setIsAuthenticated(true);
        setSuccessToast(`👋 ¡Bienvenido, ${name}! Tu expediente Fixme ha sido cargado.`);
        loadPortal(cleanPh, cleanId);
        setTimeout(() => setSuccessToast(''), 5000);
      } else {
        setError(data?.message || 'Error de autenticación: verifica tu celular y cédula.');
      }
    } catch (err: any) {
      setError('Error al ingresar: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle new customer registration
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const cleanPh = registerForm.phone.trim();
    const cleanId = registerForm.identificationNumber.trim().replace(/[^0-9a-zA-Z]/g, '');

    if (!registerForm.fullName.trim()) {
      setError('Por favor ingresa tu nombre y apellido.');
      return;
    }
    if (cleanPh.length < 7) {
      setError('Por favor ingresa un número de WhatsApp o celular válido (mínimo 7 dígitos).');
      return;
    }
    if (!cleanId) {
      setError('Por favor ingresa tu número de cédula o RUC.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/public/customer/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPh,
          identificationNumber: cleanId,
          action: 'REGISTER',
          fullName: registerForm.fullName.trim(),
          email: registerForm.email.trim() || null,
          city: registerForm.city.trim() || 'Quito',
          address: registerForm.address.trim() || ''
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setPhone(cleanPh);
        setCedula(cleanId);
        localStorage.fixmeCustomerPhone = cleanPh;
        localStorage.fixmeCustomerIdNumber = cleanId;
        const name = data?.account?.full_name || registerForm.fullName;
        setCustomerName(name);
        localStorage.fixmeCustomerName = name;
        setIsAuthenticated(true);
        if (data?.alreadyExisted) {
          setSuccessToast(`🎉 ¡Hola ${name}! Encontramos tu ficha en nuestra red de talleres. Has ingresado a tu portal unificado.`);
        } else {
          setSuccessToast(`🎉 ¡Bienvenido a Fixme, ${name}! Tu cuenta de cliente ha sido creada.`);
        }
        loadPortal(cleanPh, cleanId);
        setTimeout(() => setSuccessToast(''), 6000);
      } else {
        setError(data?.message || 'Error al registrar cliente.');
      }
    } catch (err: any) {
      setError('Error al registrarse: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('fixmeCustomerPhone');
    localStorage.removeItem('fixmeCustomerIdNumber');
    localStorage.removeItem('fixmeCustomerName');
    setPhone('');
    setCedula('');
    setInputPhone('');
    setInputCedula('');
    setCustomerName('');
    setIsAuthenticated(false);
    setPortalData({ requests: [], workOrders: [], sales: [], warranties: [] });
  }

  // Update profile
  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/public/customer/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          fullName: profileForm.fullName,
          email: profileForm.email,
          identificationNumber: profileForm.identificationNumber,
          city: profileForm.city,
          address: profileForm.address
        })
      });
      if (res.ok) {
        setCustomerName(profileForm.fullName);
        localStorage.fixmeCustomerName = profileForm.fullName;
        if (profileForm.identificationNumber) {
          setCedula(profileForm.identificationNumber);
          localStorage.fixmeCustomerIdNumber = profileForm.identificationNumber;
        }
        setShowProfileEdit(false);
        setSuccessToast('Datos de contacto actualizados correctamente');
        loadPortal(phone, profileForm.identificationNumber || cedula);
        setTimeout(() => setSuccessToast(''), 4000);
      }
    } catch (err: any) {
      alert('Error al actualizar datos: ' + err.message);
    }
  }

  // Synchronize city and address when account loads
  React.useEffect(() => {
    const acc = portalData.account;
    if (acc) {
      setDeviceForm(prev => ({
        ...prev,
        city: acc.city || prev.city || 'Quito',
        customerAddress: acc.address || prev.customerAddress || ''
      }));
    }
  }, [portalData.account]);

  // Image upload for new device
  const handleDeviceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (deviceImages.length + files.length > 5) {
      alert('Puedes subir hasta 5 fotos como máximo.');
      return;
    }
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setDeviceImages(prev => [...prev, { imageUrl: String(ev.target?.result), fileName: file.name }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeDeviceImage = (idx: number) => {
    setDeviceImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Submit new device repair request directly inside active customer session
  async function handlePublishDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceForm.deviceBrand.trim() || !deviceForm.deviceModel.trim()) {
      setPublishError('Por favor ingresa la marca y modelo del dispositivo.');
      return;
    }
    if (!deviceForm.faultDescription.trim()) {
      setPublishError('Por favor describe la falla o problema que presenta el equipo.');
      return;
    }

    setPublishError('');
    setIsPublishing(true);
    try {
      const res = await fetch('/api/public/marketplace/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...deviceForm,
          customerName: customerName || portalData.account?.full_name || 'Cliente Fixme',
          customerPhone: phone,
          customerEmail: portalData.account?.email || profileForm.email || null,
          identificationNumber: cedula || portalData.account?.identification_number || null,
          images: deviceImages
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Error al publicar la solicitud');
      }

      const data = await res.json();
      setPublishSuccess(data);
      setSuccessToast('🎉 ¡Tu equipo ha sido publicado exitosamente en la Bolsa de Cotizaciones!');
      loadPortal(phone, cedula);
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err: any) {
      setPublishError(err.message || 'No se pudo conectar con el servidor');
    } finally {
      setIsPublishing(false);
    }
  }

  // Approve quote 1-click
  async function handleApproveQuote(orderId: string) {
    if (!confirm('¿Confirmas la aprobación del presupuesto y repuestos para continuar la reparación?')) return;
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/public/work-orders/${orderId}/approve-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientNotes: 'Aprobado digitalmente por el cliente desde el Portal 360.'
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSuccessToast('🎉 ¡Presupuesto aprobado con éxito! El taller fue notificado para proceder de inmediato.');
        loadPortal(phone, cedula);
        setTimeout(() => setSuccessToast(''), 5000);
      } else {
        alert(data?.message || 'No se pudo aprobar el presupuesto.');
      }
    } catch (err: any) {
      alert('Error al aprobar presupuesto: ' + err.message);
    } finally {
      setApprovingId(null);
    }
  }

  // Reject quote
  async function handleRejectQuote(orderId: string) {
    setRejectingId(orderId);
    try {
      const res = await fetch(`/api/public/work-orders/${orderId}/reject-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason || 'Presupuesto no aceptado por el cliente.'
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setShowRejectModal(null);
        setRejectReason('');
        setSuccessToast('Presupuesto rechazado. El taller se comunicará contigo si tienes dudas.');
        loadPortal(phone, cedula);
        setTimeout(() => setSuccessToast(''), 5000);
      } else {
        alert(data?.message || 'No se pudo registrar la respuesta.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setRejectingId(null);
    }
  }

  // Accept bid from marketplace
  async function handleAcceptBid(requestCode: string, bidId: string) {
    if (!confirm('¿Deseas aceptar esta cotización para que el taller comience tu orden de trabajo?')) return;
    try {
      const res = await fetch(`/api/public/marketplace/requests/${requestCode}/accept-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId, customerPhone: phone })
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSuccessToast('🎉 ¡Cotización aceptada! Tu orden de trabajo ha sido creada automáticamente en el taller.');
        loadPortal(phone, cedula);
        setActiveTab('repairs');
        setTimeout(() => setSuccessToast(''), 6000);
      } else {
        alert(data?.message || 'Error al aceptar la cotización.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  // Helper for tracking steps
  function getTimelineSteps(status: string) {
    const s = (status || '').toUpperCase();
    const steps = [
      { key: 'RECEPTION', label: 'Recepción en Taller', done: true },
      { key: 'DIAGNOSIS', label: 'Diagnóstico & Cotización', done: ['DIAGNOSIS', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'READY', 'DELIVERED', 'COMPLETED'].includes(s) },
      { key: 'APPROVAL', label: 'Aprobación de Repuestos', done: ['APPROVED', 'IN_PROGRESS', 'READY', 'DELIVERED', 'COMPLETED'].includes(s) },
      { key: 'REPAIR', label: 'En Reparación Técnica', done: ['IN_PROGRESS', 'READY', 'DELIVERED', 'COMPLETED'].includes(s) },
      { key: 'DELIVERED', label: 'Listo & Entregado', done: ['READY', 'DELIVERED', 'COMPLETED'].includes(s) }
    ];
    return steps;
  }

  // =========================================================================
  // --- SCREEN 1: LOGIN CON CELULAR Y CÉDULA SI NO ESTÁ AUTENTICADO ---
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: '#2563eb', color: '#fff', padding: '6px 12px', borderRadius: 8, fontWeight: 900 }}>FX</span>
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Fixme · Portal de Clientes</span>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              ← Volver al Inicio
            </button>
          )}
        </header>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 460, padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>📱🪪</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>Acceso a Mi Cuenta Fixme</h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Ingresa con tu <b>Número de Celular</b> y tu <b>Cédula o RUC</b> para consultar tu historial, autorizar reparaciones y ver tus garantías.
              </p>
            </div>

            {/* TAB SELECTOR: LOGIN VS REGISTER */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 12, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => { setAuthMode('LOGIN'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: authMode === 'LOGIN' ? '#ffffff' : 'transparent',
                  color: authMode === 'LOGIN' ? '#2563eb' : '#64748b',
                  boxShadow: authMode === 'LOGIN' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                🔑 Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('REGISTER'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: authMode === 'REGISTER' ? '#ffffff' : 'transparent',
                  color: authMode === 'REGISTER' ? '#2563eb' : '#64748b',
                  boxShadow: authMode === 'REGISTER' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                📝 Crear Cuenta Nueva
              </button>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}

            {authMode === 'LOGIN' ? (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    📱 Número de Celular o WhatsApp *
                  </label>
                  <input
                    type="tel"
                    value={inputPhone}
                    onChange={e => setInputPhone(e.target.value)}
                    placeholder="Ej. 0994175857"
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, outline: 'none' }}
                  />
                  <small style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, display: 'block' }}>
                    El celular que diste al solicitar una reparación o en la tienda.
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    🪪 Número de Cédula o RUC *
                  </label>
                  <input
                    type="text"
                    value={inputCedula}
                    onChange={e => setInputCedula(e.target.value)}
                    placeholder="Ej. 1712345678"
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, outline: 'none' }}
                  />
                  <small style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, display: 'block' }}>
                    Clave de seguridad para verificar tu identidad y proteger tus datos.
                  </small>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '14px',
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: 'pointer',
                    marginTop: 6,
                    boxShadow: '0 4px 6px -1px rgba(37,99,235,0.3)'
                  }}
                >
                  {loading ? 'Verificando datos...' : '🚀 Acceder con Celular y Cédula'}
                </button>

                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('REGISTER'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    ¿Aún no tienes cuenta? Regístrate en 1 minuto
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    👤 Nombre y Apellido *
                  </label>
                  <input
                    type="text"
                    value={registerForm.fullName}
                    onChange={e => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                    placeholder="Ej. Carlos Mendoza"
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      📱 WhatsApp / Celular *
                    </label>
                    <input
                      type="tel"
                      value={registerForm.phone}
                      onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      placeholder="0994175857"
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      🪪 Cédula o RUC *
                    </label>
                    <input
                      type="text"
                      value={registerForm.identificationNumber}
                      onChange={e => setRegisterForm({ ...registerForm, identificationNumber: e.target.value })}
                      placeholder="1712345678"
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      📍 Ciudad *
                    </label>
                    <select
                      value={registerForm.city}
                      onChange={e => setRegisterForm({ ...registerForm, city: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', background: '#fff' }}
                    >
                      <option value="Quito">Quito</option>
                      <option value="Guayaquil">Guayaquil</option>
                      <option value="Cuenca">Cuenca</option>
                      <option value="Ambato">Ambato</option>
                      <option value="Santo Domingo">Santo Domingo</option>
                      <option value="Machala">Machala</option>
                      <option value="Manta">Manta</option>
                      <option value="Portoviejo">Portoviejo</option>
                      <option value="Loja">Loja</option>
                      <option value="Otra Ciudad">Otra Ciudad</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      📧 Correo (Opcional)
                    </label>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                      placeholder="tucorreo@gmail.com"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    🏠 Dirección o Sector (Opcional, para retiros/entregas)
                  </label>
                  <input
                    type="text"
                    value={registerForm.address}
                    onChange={e => setRegisterForm({ ...registerForm, address: e.target.value })}
                    placeholder="Ej. Av. República y 10 de Agosto"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '14px',
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: 'pointer',
                    marginTop: 6,
                    boxShadow: '0 4px 6px -1px rgba(5,150,105,0.3)'
                  }}
                >
                  {loading ? 'Creando cuenta...' : '✨ Registrar Mi Cuenta de Cliente'}
                </button>

                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('LOGIN'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    ¿Ya estás registrado? Inicia sesión con Celular y Cédula
                  </button>
                </div>
              </form>
            )}

            {/* SECURITY TRUST BADGE */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginTop: 18, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16 }}>🛡️</span>
              <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                <b>Seguridad & Privacidad:</b> El ingreso con Celular y Cédula garantiza que únicamente tú puedas ver el diagnóstico técnico, presupuestos de repuestos y certificados de garantía de tus dispositivos.
              </p>
            </div>

            <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>¿Quieres cotizar la reparación de un equipo ahora?</span><br />
              <button
                type="button"
                onClick={() => { window.location.hash = '#solicitar-reparacion'; }}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 800, fontSize: 13, cursor: 'pointer', marginTop: 4 }}
              >
                🛠️ Publicar Solicitud de Reparación Gratis →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // --- SCREEN 2: PORTAL DE CLIENTE 360 CON MENÚ LATERAL MODERNO E INTUITIVO ---
  // =========================================================================
  const pendingQuotes = portalData.workOrders.filter(
    wo => (wo.status === 'QUOTED' || wo.status === 'DIAGNOSIS') && Number(wo.quote || 0) > 0
  );

  const getInitials = (name: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      {/* NAVBAR SUPERIOR */}
      <header style={{
        background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ background: '#2563eb', color: '#fff', padding: '6px 10px', borderRadius: 8, fontWeight: 900, fontSize: 14 }}>FX</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>Portal del Cliente</span>
              <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>
                ● Sesión Segura
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              👤 <b>{customerName || 'Cliente Fixme'}</b> · 🪪 CI: <b>{cedula || 'Registrado'}</b> · 📞 {phone}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => { setActiveTab('publish'); setPublishSuccess(null); }}
            style={{
              background: '#059669', color: '#fff', border: 'none', padding: '8px 14px',
              borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 4px rgba(5,150,105,0.2)'
            }}
          >
            ➕ Publicar Reparación
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              🏠 Ir al Inicio
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            🚪 Salir
          </button>
        </div>
      </header>

      {/* TOAST FLOTANTE */}
      {successToast && (
        <div style={{
          position: 'fixed', top: 70, right: 24, zIndex: 9999,
          background: '#059669', color: '#fff', padding: '12px 20px', borderRadius: 10,
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', fontSize: 14, fontWeight: 700
        }}>
          {successToast}
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL: MENÚ LATERAL + ÁREA DE CONTENIDO */}
      <div style={{
        maxWidth: 1280, width: '100%', margin: '0 auto', padding: '20px 24px', flex: 1,
        display: 'flex', gap: 24, alignItems: 'flex-start'
      }}>
        
        {/* ========================================================================= */}
        {/* MENÚ LATERAL DEL CLIENTE */}
        {/* ========================================================================= */}
        <aside style={{
          width: 270, flexShrink: 0, background: '#ffffff', borderRadius: 16,
          border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          padding: 16, position: 'sticky', top: 80
        }}>
          {/* PERFIL RESUMEN */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', background: '#2563eb', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16
            }}>
              {getInitials(customerName)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {customerName || 'Cliente Fixme'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                🪪 CI: {cedula || 'No registrada'}
              </div>
              <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700 }}>
                📍 {portalData.account?.city || 'Ecuador'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', padding: '4px 8px 8px', letterSpacing: 0.5 }}>
            Menú de Navegación
          </div>

          {/* LISTA DE ÍTEMS DEL MENÚ */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              type="button"
              onClick={() => setActiveTab('repairs')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: 10, border: 'none',
                background: activeTab === 'repairs' ? '#eff6ff' : 'transparent',
                color: activeTab === 'repairs' ? '#2563eb' : '#334155',
                fontWeight: activeTab === 'repairs' ? 800 : 600,
                fontSize: 13, cursor: 'pointer', textAlign: 'left',
                borderLeft: activeTab === 'repairs' ? '4px solid #2563eb' : '4px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🛠️</span>
                <span>Mis Reparaciones</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {pendingQuotes.length > 0 && (
                  <span style={{ background: '#fef3c7', color: '#d97706', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 6 }}>
                    ⚠️ {pendingQuotes.length}
                  </span>
                )}
                <span style={{
                  background: activeTab === 'repairs' ? '#2563eb' : '#f1f5f9',
                  color: activeTab === 'repairs' ? '#ffffff' : '#64748b',
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10
                }}>
                  {portalData.workOrders.length}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: 10, border: 'none',
                background: activeTab === 'requests' ? '#eff6ff' : 'transparent',
                color: activeTab === 'requests' ? '#2563eb' : '#334155',
                fontWeight: activeTab === 'requests' ? 800 : 600,
                fontSize: 13, cursor: 'pointer', textAlign: 'left',
                borderLeft: activeTab === 'requests' ? '4px solid #2563eb' : '4px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🎯</span>
                <span>Bolsa de Cotizaciones</span>
              </div>
              <span style={{
                background: activeTab === 'requests' ? '#2563eb' : '#f1f5f9',
                color: activeTab === 'requests' ? '#ffffff' : '#64748b',
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10
              }}>
                {portalData.requests.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('publish'); setPublishSuccess(null); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: 10, border: 'none',
                background: activeTab === 'publish' ? '#ecfdf5' : 'transparent',
                color: activeTab === 'publish' ? '#059669' : '#334155',
                fontWeight: activeTab === 'publish' ? 800 : 600,
                fontSize: 13, cursor: 'pointer', textAlign: 'left',
                borderLeft: activeTab === 'publish' ? '4px solid #059669' : '4px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>➕</span>
                <span>Publicar Nuevo Equipo</span>
              </div>
              <span style={{
                background: activeTab === 'publish' ? '#059669' : '#dcfce7',
                color: activeTab === 'publish' ? '#ffffff' : '#15803d',
                fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6
              }}>
                ✨ Cotizar
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('warranties')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: 10, border: 'none',
                background: activeTab === 'warranties' ? '#eff6ff' : 'transparent',
                color: activeTab === 'warranties' ? '#2563eb' : '#334155',
                fontWeight: activeTab === 'warranties' ? 800 : 600,
                fontSize: 13, cursor: 'pointer', textAlign: 'left',
                borderLeft: activeTab === 'warranties' ? '4px solid #2563eb' : '4px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🛡️</span>
                <span>Garantías Oficiales</span>
              </div>
              <span style={{
                background: activeTab === 'warranties' ? '#2563eb' : '#f1f5f9',
                color: activeTab === 'warranties' ? '#ffffff' : '#64748b',
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10
              }}>
                {portalData.warranties.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('purchases')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: 10, border: 'none',
                background: activeTab === 'purchases' ? '#eff6ff' : 'transparent',
                color: activeTab === 'purchases' ? '#2563eb' : '#334155',
                fontWeight: activeTab === 'purchases' ? 800 : 600,
                fontSize: 13, cursor: 'pointer', textAlign: 'left',
                borderLeft: activeTab === 'purchases' ? '4px solid #2563eb' : '4px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🧾</span>
                <span>Compras & Facturas</span>
              </div>
              <span style={{
                background: activeTab === 'purchases' ? '#2563eb' : '#f1f5f9',
                color: activeTab === 'purchases' ? '#ffffff' : '#64748b',
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10
              }}>
                {portalData.sales.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: 10, border: 'none',
                background: activeTab === 'profile' ? '#eff6ff' : 'transparent',
                color: activeTab === 'profile' ? '#2563eb' : '#334155',
                fontWeight: activeTab === 'profile' ? 800 : 600,
                fontSize: 13, cursor: 'pointer', textAlign: 'left',
                borderLeft: activeTab === 'profile' ? '4px solid #2563eb' : '4px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>👤</span>
                <span>Mi Perfil & Datos</span>
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>✏️</span>
            </button>
          </nav>

          {/* BOTÓN RÁPIDO DE ACCIÓN */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={() => { setActiveTab('publish'); setPublishSuccess(null); }}
              style={{
                width: '100%', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#fff', border: 'none', padding: '12px 14px', borderRadius: 10,
                fontSize: 13, fontWeight: 800, cursor: 'pointer', textAlign: 'center',
                boxShadow: '0 4px 6px -1px rgba(5,150,105,0.2)'
              }}
            >
              🛠️ Publicar Nuevo Equipo →
            </button>
          </div>

          {/* TRUST CARD EN SIDEBAR */}
          <div style={{ marginTop: 16, background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>
              🛡️ Red Oficial Fixme
            </div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
              Tus equipos y presupuestos están asegurados por la red de talleres certificados.
            </div>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* ÁREA PRINCIPAL DE CONTENIDO */}
        {/* ========================================================================= */}
        <main style={{ flex: 1, minWidth: 0 }}>
          
          {/* BANNER DE ACCIÓN INMEDIATA: PRESUPUESTO PENDIENTE DE APROBACIÓN */}
          {pendingQuotes.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '2px solid #f59e0b',
              borderRadius: 14,
              padding: '16px 20px',
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 14
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>⚠️</span>
                  <strong style={{ fontSize: 16, color: '#92400e' }}>
                    Tienes {pendingQuotes.length} presupuesto(s) pendiente(s) de tu aprobación
                  </strong>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b45309' }}>
                  El taller ha diagnosticado tu equipo y requiere tu autorización digital para proceder con los repuestos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('repairs')}
                style={{
                  background: '#d97706', color: '#fff', border: 'none', padding: '10px 18px',
                  borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer'
                }}
              >
                Revisar y Autorizar Ahora →
              </button>
            </div>
          )}

          {/* 4 TARJETAS KPI DE RESUMEN CLICKEABLES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div
              onClick={() => setActiveTab('repairs')}
              style={{
                background: '#ffffff', borderRadius: 12, padding: '14px 16px',
                border: activeTab === 'repairs' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>🛠️</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{portalData.workOrders.length}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>Reparaciones en Taller</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Órdenes técnicas activas</div>
            </div>

            <div
              onClick={() => setActiveTab('requests')}
              style={{
                background: '#ffffff', borderRadius: 12, padding: '14px 16px',
                border: activeTab === 'requests' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>🎯</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{portalData.requests.length}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>Cotizaciones de Talleres</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Bolsa de marketplace</div>
            </div>

            <div
              onClick={() => setActiveTab('warranties')}
              style={{
                background: '#ffffff', borderRadius: 12, padding: '14px 16px',
                border: activeTab === 'warranties' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>🛡️</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#059669' }}>{portalData.warranties.length}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>Garantías Oficiales</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Certificados con vigencia</div>
            </div>

            <div
              onClick={() => setActiveTab('purchases')}
              style={{
                background: '#ffffff', borderRadius: 12, padding: '14px 16px',
                border: activeTab === 'purchases' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>🧾</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{portalData.sales.length}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>Facturas & Compras</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Comprobantes emitidos</div>
            </div>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
              Cargando tu información...
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: MIS REPARACIONES EN TALLER & APROBACIÓN 1-CLIC */}
          {/* ========================================================================= */}
          {!loading && activeTab === 'repairs' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                  🛠️ Órdenes de Reparación en Curso e Históricas ({portalData.workOrders.length})
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Monitorea el avance técnico de tus equipos, autoriza presupuestos y comunícate con el taller.
                </p>
              </div>

              {portalData.workOrders.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
                  <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>No tienes órdenes de trabajo activas</h3>
                  <p style={{ margin: '0 auto 20px', color: '#64748b', fontSize: 14, maxWidth: 440 }}>
                    Cuando dejes un equipo en un taller afiliado o aceptes una cotización de la bolsa, aquí verás el avance en tiempo real.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('publish'); setPublishSuccess(null); }}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                  >
                    🛠️ Solicitar Cotización de Reparación Ahora
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {portalData.workOrders.map((wo: Any) => {
                    const steps = getTimelineSteps(wo.status);
                    const isPendingApproval = (wo.status === 'QUOTED' || wo.status === 'DIAGNOSIS') && Number(wo.quote || 0) > 0;
                    const isApproved = wo.status === 'APPROVED';
                    const isDelivered = ['DELIVERED', 'COMPLETED', 'ENTREGADO'].includes((wo.status || '').toUpperCase());
                    const isRejected = wo.status === 'REJECTED';
                    const items = Array.isArray(wo.items) ? wo.items : [];

                    return (
                      <div
                        key={wo.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: 16,
                          border: isPendingApproval ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                          boxShadow: isPendingApproval ? '0 10px 25px -5px rgba(245,158,11,0.15)' : '0 2px 4px rgba(0,0,0,0.03)',
                          overflow: 'hidden'
                        }}
                      >
                        {/* HEADER DE LA ORDEN */}
                        <div style={{
                          padding: '16px 20px',
                          background: isPendingApproval ? '#fffbeb' : '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                                Orden #{wo.order_number}
                              </span>
                              <span style={{
                                background: isDelivered ? '#ecfdf5' : isApproved ? '#eff6ff' : isPendingApproval ? '#fef3c7' : '#f1f5f9',
                                color: isDelivered ? '#059669' : isApproved ? '#2563eb' : isPendingApproval ? '#d97706' : '#475569',
                                fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 6
                              }}>
                                {isPendingApproval ? '⚠️ Esperando tu Autorización' : isApproved ? '✓ Presupuesto Autorizado' : isDelivered ? '🎉 Entregado con Garantía' : isRejected ? '❌ Rechazado' : wo.status}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                              🏢 <b>{wo.store_name}</b> {wo.store_address ? `· 📍 ${wo.store_address}` : ''}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {wo.store_phone && (
                              <a
                                href={`https://wa.me/${wo.store_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${wo.store_name}, te consulto sobre mi orden de reparación #${wo.order_number} (${wo.device_brand} ${wo.device_model}).`)}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: '#25d366', color: '#fff', textDecoration: 'none',
                                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                                  display: 'inline-flex', alignItems: 'center', gap: 6
                                }}
                              >
                                💬 WhatsApp del Taller
                              </a>
                            )}
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>
                                ${Number(wo.quote || 0).toFixed(2)}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Total Presupuestado</div>
                            </div>
                          </div>
                        </div>

                        {/* CUERPO: DETALLES DEL EQUIPO & TRACKING */}
                        <div style={{ padding: '20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Equipo</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
                                📱 {wo.device_brand} {wo.device_model}
                              </div>
                              {wo.serial_number && (
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>S/N: {wo.serial_number}</div>
                              )}
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Falla Reportada</div>
                              <div style={{ fontSize: 13, color: '#334155' }}>
                                {wo.reported_fault || 'Revisión técnica general'}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Diagnóstico Técnico</div>
                              <div style={{ fontSize: 13, color: '#334155' }}>
                                {wo.diagnosis || 'En proceso de evaluación por el especialista...'}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Garantía Prometida</div>
                              <div style={{ fontSize: 13, color: '#059669', fontWeight: 700 }}>
                                🛡️ {wo.warranty_days ? `${wo.warranty_days} días de garantía` : (wo.warranty_terms || 'Garantía oficial')}
                              </div>
                            </div>
                          </div>

                          {/* LÍNEA DE TIEMPO / TRACKING VISUAL */}
                          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 12, marginBottom: 20 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 12 }}>
                              Progreso Técnico en Tiempo Real
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                              {steps.map((st, i) => (
                                <div key={st.key} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                                  <div style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    background: st.done ? '#2563eb' : '#cbd5e1',
                                    color: '#fff', fontSize: 11, fontWeight: 800,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 6px', position: 'relative', zIndex: 2
                                  }}>
                                    {st.done ? '✓' : i + 1}
                                  </div>
                                  <div style={{ fontSize: 11, color: st.done ? '#0f172a' : '#94a3b8', fontWeight: st.done ? 700 : 500 }}>
                                    {st.label}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 📸 TRUST-CAM: EVIDENCIA VISUAL Y FOTOS DE DIAGNÓSTICO */}
                          {wo.images && Array.isArray(wo.images) && wo.images.length > 0 && (
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>📸</span> Trust-Cam: Inspección Visual y Evidencia Técnica ({wo.images.length} fotos)
                                </div>
                                <span style={{ fontSize: 11, color: '#64748b' }}>Clic en cualquier foto para ampliar</span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                                {wo.images.map((img: Any, idx: number) => {
                                  const stageLabel = img.stage === 'RECEPTION' ? '📥 Recepción' : img.stage === 'COMPLETED' ? '✨ Culminada' : '🔬 Diagnóstico';
                                  const stageBg = img.stage === 'RECEPTION' ? '#eff6ff' : img.stage === 'COMPLETED' ? '#ecfdf5' : '#fef3c7';
                                  const stageColor = img.stage === 'RECEPTION' ? '#2563eb' : img.stage === 'COMPLETED' ? '#059669' : '#d97706';
                                  return (
                                    <div
                                      key={img.id || idx}
                                      onClick={() => setPreviewPhoto({ url: img.imageUrl || img.image_url, title: img.caption || `${wo.device_brand} ${wo.device_model}`, stage: stageLabel })}
                                      style={{
                                        background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0',
                                        cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                      }}
                                    >
                                      <div style={{ height: 100, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                        <img
                                          src={img.imageUrl || img.image_url}
                                          alt={img.caption || 'Trust-Cam'}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          onError={(e: Any) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                      </div>
                                      <div style={{ padding: '6px 8px' }}>
                                        <span style={{ background: stageBg, color: stageColor, fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                                          {stageLabel}
                                        </span>
                                        {img.caption && (
                                          <div style={{ fontSize: 11, color: '#475569', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {img.caption}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 📋 CHECKLIST DE RECEPCIÓN TÉCNICA & RESPALDO LEGAL */}
                          {wo.intakeChecklist && typeof wo.intakeChecklist === 'object' && Object.keys(wo.intakeChecklist).length > 0 && (
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>📋</span> Checklist de Inspección Inicial al Ingreso
                                </div>
                                <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                                  🔒 Art. 71 Ley Defensa Consumidor
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, fontSize: 12 }}>
                                <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                  <span style={{ color: '#64748b', fontSize: 11 }}>⚡ Encendido</span>
                                  <div style={{ fontWeight: 800, color: wo.intakeChecklist.powersOn === 'YES' ? '#059669' : wo.intakeChecklist.powersOn === 'NO' ? '#dc2626' : '#d97706' }}>
                                    {wo.intakeChecklist.powersOn === 'YES' ? '✓ Enciende OK' : wo.intakeChecklist.powersOn === 'NO' ? '✕ No enciende' : '⚠️ No probado'}
                                  </div>
                                </div>
                                <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                  <span style={{ color: '#64748b', fontSize: 11 }}>📱 Pantalla / Touch</span>
                                  <div style={{ fontWeight: 800, color: wo.intakeChecklist.screenStatus === 'OK' ? '#059669' : wo.intakeChecklist.screenStatus === 'SCRATCHED' ? '#d97706' : '#dc2626' }}>
                                    {wo.intakeChecklist.screenStatus === 'OK' ? '✓ Pantalla OK' : wo.intakeChecklist.screenStatus === 'SCRATCHED' ? '⚠️ Con rayones' : '✕ Pantalla Rota'}
                                  </div>
                                </div>
                                <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                  <span style={{ color: '#64748b', fontSize: 11 }}>📷 Cámaras</span>
                                  <div style={{ fontWeight: 800, color: wo.intakeChecklist.camerasStatus === 'OK' ? '#059669' : '#dc2626' }}>
                                    {wo.intakeChecklist.camerasStatus === 'OK' ? '✓ Cámaras OK' : '✕ Con falla'}
                                  </div>
                                </div>
                                <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                  <span style={{ color: '#64748b', fontSize: 11 }}>🔊 Audio / Parlante</span>
                                  <div style={{ fontWeight: 800, color: wo.intakeChecklist.audioStatus === 'OK' ? '#059669' : '#dc2626' }}>
                                    {wo.intakeChecklist.audioStatus === 'OK' ? '✓ Audio OK' : '✕ Con falla'}
                                  </div>
                                </div>
                                <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                  <span style={{ color: '#64748b', fontSize: 11 }}>📶 WiFi / Señal</span>
                                  <div style={{ fontWeight: 800, color: wo.intakeChecklist.wifiStatus === 'OK' ? '#059669' : '#dc2626' }}>
                                    {wo.intakeChecklist.wifiStatus === 'OK' ? '✓ Conecta OK' : '✕ Con falla'}
                                  </div>
                                </div>
                                <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                  <span style={{ color: '#64748b', fontSize: 11 }}>🔌 Centro de Carga</span>
                                  <div style={{ fontWeight: 800, color: wo.intakeChecklist.chargingStatus === 'OK' ? '#059669' : '#dc2626' }}>
                                    {wo.intakeChecklist.chargingStatus === 'OK' ? '✓ Carga OK' : '✕ Falso contacto'}
                                  </div>
                                </div>
                              </div>

                              <div style={{ marginTop: 10, fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>🛡️</span>
                                <span><b>Respaldo Legal Aceptado:</b> Equipo bajo custodia técnica. Plazo máximo de retiro: 60 días tras la notificación final de retiro según la Ley Orgánica de Defensa del Consumidor del Ecuador.</span>
                              </div>
                            </div>
                          )}

                          {/* DESGLOSE DE REPUESTOS Y MANO DE OBRA */}
                          {items.length > 0 && (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                              <div style={{ padding: '8px 14px', background: '#f8fafc', fontSize: 12, fontWeight: 800, color: '#475569' }}>
                                Desglose de Repuestos & Mano de Obra
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <tbody>
                                  {items.map((it: Any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '8px 14px', color: '#334155' }}>
                                        {it.itemType === 'PART' ? '🔩 Repuesto:' : '👨‍🔧 Servicio:'} <b>{it.name}</b>
                                      </td>
                                      <td style={{ padding: '8px 14px', textAlign: 'center', color: '#64748b' }}>
                                        Cant: {it.quantity || 1}
                                      </td>
                                      <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                        ${Number(it.subtotal || it.unitPrice || 0).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* ACCIONES DE APROBACIÓN DIGITAL 1-CLIC */}
                          {isPendingApproval && (
                            <div style={{
                              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
                              padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
                              alignItems: 'center', flexWrap: 'wrap', gap: 14
                            }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#92400e' }}>
                                  ¿Autorizas el presupuesto de ${Number(wo.quote || 0).toFixed(2)} para continuar la reparación?
                                </div>
                                <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
                                  Al autorizar, el taller adquirirá los repuestos indicados y continuará el trabajo de inmediato.
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                  type="button"
                                  disabled={approvingId === wo.id}
                                  onClick={() => setShowRejectModal(wo.id)}
                                  style={{
                                    background: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5',
                                    padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer'
                                  }}
                                >
                                  Rechazar
                                </button>
                                <button
                                  type="button"
                                  disabled={approvingId === wo.id}
                                  onClick={() => handleApproveQuote(wo.id)}
                                  style={{
                                    background: '#059669', color: '#fff', border: 'none',
                                    padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 800,
                                    cursor: 'pointer', boxShadow: '0 2px 4px rgba(5,150,105,0.2)'
                                  }}
                                >
                                  {approvingId === wo.id ? 'Aprobando...' : '✓ Autorizar Presupuesto'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: BOLSA DE COTIZACIONES (MARKETPLACE) */}
          {/* ========================================================================= */}
          {!loading && activeTab === 'requests' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                  🎯 Mis Solicitudes de Cotización en el Marketplace ({portalData.requests.length})
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Revisa las ofertas recibidas de los talleres y elige la mejor propuesta para tu equipo.
                </p>
              </div>

              {portalData.requests.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>🎯</div>
                  <h4 style={{ margin: '0 0 6px', color: '#1e293b' }}>No tienes solicitudes publicadas</h4>
                  <p style={{ margin: '0 auto 16px', color: '#64748b', fontSize: 13, maxWidth: 440 }}>
                    ¿Tienes un equipo dañado? Publica tu falla para que múltiples talleres de tu ciudad compitan ofreciéndote su mejor precio.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('publish'); setPublishSuccess(null); }}
                    style={{ background: '#059669', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                  >
                    🛠️ Publicar Solicitud de Reparación Gratis
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {portalData.requests.map((r: Any) => {
                    const isAccepted = r.status === 'ACCEPTED' || Boolean(r.selected_bid_id);
                    const rawBids = Array.isArray(r.bids) ? r.bids : [];
                    const bids = isAccepted
                      ? rawBids.filter(b => b.status === 'ACCEPTED' || b.id === r.selected_bid_id)
                      : rawBids;

                    return (
                      <div
                        key={r.id}
                        style={{
                          background: '#fff',
                          borderRadius: 14,
                          border: isAccepted ? '2px solid #10b981' : '1px solid #e2e8f0',
                          padding: 18,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb' }}>{r.request_code}</span>
                            <h4 style={{ margin: '2px 0 0', fontSize: 16, color: '#0f172a' }}>
                              📱 {r.device_brand} {r.device_model} ({r.device_category})
                            </h4>
                          </div>
                          <span style={{
                            background: isAccepted ? '#ecfdf5' : '#eff6ff',
                            color: isAccepted ? '#059669' : '#2563eb',
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800
                          }}>
                            {isAccepted ? '🏆 Cotización Aceptada' : `💬 ${bids.length} Oferta(s) de Talleres`}
                          </span>
                        </div>

                        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px' }}>
                          <b>Falla reportada:</b> {r.fault_description}
                        </p>

                        {/* LISTADO DE COTIZACIONES O GANADOR EXCLUSIVO */}
                        {bids.length === 0 ? (
                          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12, color: '#64748b' }}>
                            ⏳ Esperando cotizaciones de los talleres de tu zona... Te notificaremos cuando respondan.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {isAccepted && (
                              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#065f46', fontWeight: 700 }}>
                                🏆 Taller Asignado & Cotización Elegida · Las demás propuestas fueron descartadas.
                              </div>
                            )}

                            {bids.map((b: Any) => {
                              const isThisAccepted = b.status === 'ACCEPTED' || b.id === r.selected_bid_id;
                              return (
                                <div
                                  key={b.id}
                                  style={{
                                    border: isThisAccepted ? '2px solid #059669' : '1px solid #e2e8f0',
                                    borderRadius: 10,
                                    padding: '12px 16px',
                                    background: isThisAccepted ? '#f0fdf4' : '#ffffff',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: 12
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                                      🏢 {b.store_name}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                      ⏱️ Tiempo: <b>{b.estimated_time}</b> · 🛡️ {b.warranty_terms || 'Garantía oficial'}
                                      {b.spare_part_quality ? ` · ✨ ${b.spare_part_quality}` : ''}
                                    </div>
                                    {b.proposal_notes && (
                                      <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 4 }}>
                                        "{b.proposal_notes}"
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: 18, fontWeight: 900, color: '#2563eb' }}>
                                        ${Number(b.estimated_cost).toFixed(2)}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#64748b' }}>Estimado final</div>
                                    </div>

                                    {isThisAccepted ? (
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                          type="button"
                                          onClick={() => setActiveTab('repairs')}
                                          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                                        >
                                          🛠️ Ver en Reparaciones
                                        </button>
                                        <span style={{ background: '#059669', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
                                          ✓ Aceptada
                                        </span>
                                      </div>
                                    ) : (
                                      !isAccepted && (
                                        <button
                                          type="button"
                                          onClick={() => handleAcceptBid(r.request_code, b.id)}
                                          style={{
                                            background: '#059669', color: '#fff', border: 'none',
                                            padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer'
                                          }}
                                        >
                                          🤝 Aceptar Oferta
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
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: PUBLICAR NUEVO EQUIPO DIRECTAMENTE EN LA SESIÓN DEL CLIENTE */}
          {/* ========================================================================= */}
          {!loading && activeTab === 'publish' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🛠️</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                      Publicar Nuevo Equipo para Reparación
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                      Registra tu requerimiento sin salir de tu panel. Talleres verificados de tu ciudad te enviarán cotizaciones con precios y garantías.
                    </p>
                  </div>
                </div>
              </div>

              {publishSuccess ? (
                /* VISTA DE ÉXITO TRAS PUBLICAR */
                <div style={{
                  background: '#ffffff', borderRadius: 16, border: '2px solid #10b981',
                  padding: 32, textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
                  <h3 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>
                    ¡Solicitud Publicada con Éxito!
                  </h3>
                  <p style={{ color: '#475569', fontSize: 14, margin: '0 auto 20px', maxWidth: 500 }}>
                    Tu equipo ha sido emitido a la red de talleres certificados en <b>{deviceForm.city}</b>.
                    Tu cuenta unificada <b>{customerName || 'Cliente Fixme'}</b> ya tiene este requerimiento vinculado.
                  </p>

                  <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: 18, maxWidth: 520, margin: '0 auto 24px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Código de Solicitud</span>
                      <span style={{ background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>● En Subasta Activa</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#2563eb', marginBottom: 8 }}>
                      {publishSuccess.requestCode || 'SOL-2026-ACTIVA'}
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div>📱 <b>Dispositivo:</b> {deviceForm.deviceBrand} {deviceForm.deviceModel} ({deviceForm.deviceCategory})</div>
                      <div>🔧 <b>Problema:</b> {deviceForm.faultDescription}</div>
                      <div>📍 <b>Ubicación:</b> {deviceForm.city} {deviceForm.neighborhood ? `· ${deviceForm.neighborhood}` : ''}</div>
                      <div>🛵 <b>Modalidad:</b> {deviceForm.deliveryPreference === 'WORKSHOP' ? 'Llevar al taller seleccionado' : 'Retiro / Entrega a domicilio'}</div>
                      {deviceImages.length > 0 && <div>📷 <b>Fotos adjuntas:</b> {deviceImages.length} imagen(es)</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => { setActiveTab('requests'); setPublishSuccess(null); }}
                      style={{
                        background: '#059669', color: '#fff', border: 'none', padding: '12px 24px',
                        borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(5,150,105,0.3)'
                      }}
                    >
                      🎯 Ver Mis Cotizaciones en la Bolsa →
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPublishSuccess(null);
                        setDeviceImages([]);
                        setDeviceForm(prev => ({ ...prev, deviceBrand: '', deviceModel: '', faultDescription: '' }));
                      }}
                      style={{
                        background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', padding: '12px 20px',
                        borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      ➕ Publicar Otro Equipo
                    </button>
                  </div>
                </div>
              ) : (
                /* FORMULARIO DE PUBLICACIÓN DENTRO DEL PANEL */
                <form onSubmit={handlePublishDevice} style={{
                  background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0',
                  padding: 24, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 20
                }}>
                  {/* BARRA DE IDENTIDAD VINCULADA */}
                  <div style={{
                    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8
                  }}>
                    <div style={{ fontSize: 13, color: '#166534' }}>
                      👤 <b>Publicando con tu cuenta:</b> {customerName || 'Cliente Fixme'} · 📱 {phone} {cedula ? `· 🪪 CI: ${cedula}` : ''}
                    </div>
                    <span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                      ✓ Expediente Vinculado
                    </span>
                  </div>

                  {publishError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, color: '#b91c1c', fontSize: 13 }}>
                      ⚠️ {publishError}
                    </div>
                  )}

                  {/* 1. SELECCIÓN DE CATEGORÍA DE EQUIPO */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
                      1. Tipo de Dispositivo
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                      {DEVICE_CATEGORIES.map(cat => {
                        const isSel = deviceForm.deviceCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setDeviceForm({ ...deviceForm, deviceCategory: cat.id })}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                              border: isSel ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              background: isSel ? '#eff6ff' : '#ffffff',
                              color: isSel ? '#1d4ed8' : '#334155',
                              fontWeight: isSel ? 800 : 600,
                              fontSize: 12, transition: 'all 0.15s ease'
                            }}
                          >
                            <span style={{ fontSize: 24, marginBottom: 4 }}>{cat.icon}</span>
                            <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. MARCA, MODELO Y SI ENCIENDE */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
                        Marca del Equipo *
                      </label>
                      <input
                        type="text"
                        value={deviceForm.deviceBrand}
                        onChange={e => setDeviceForm({ ...deviceForm, deviceBrand: e.target.value })}
                        placeholder="Ej. Samsung, Apple, Lenovo, Dell, Xiaomi..."
                        required
                        style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
                        Modelo Exacto *
                      </label>
                      <input
                        type="text"
                        value={deviceForm.deviceModel}
                        onChange={e => setDeviceForm({ ...deviceForm, deviceModel: e.target.value })}
                        placeholder="Ej. Galaxy S22 Ultra, iPhone 14, ThinkPad T14..."
                        required
                        style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
                        ¿El equipo enciende actualmente?
                      </label>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => setDeviceForm({ ...deviceForm, powersOn: true })}
                          style={{
                            flex: 1, padding: '10px', borderRadius: 8, border: deviceForm.powersOn ? '2px solid #059669' : '1px solid #cbd5e1',
                            background: deviceForm.powersOn ? '#ecfdf5' : '#fff', color: deviceForm.powersOn ? '#047857' : '#475569',
                            fontWeight: 800, fontSize: 12, cursor: 'pointer'
                          }}
                        >
                          ⚡ Sí Enciende
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeviceForm({ ...deviceForm, powersOn: false })}
                          style={{
                            flex: 1, padding: '10px', borderRadius: 8, border: !deviceForm.powersOn ? '2px solid #dc2626' : '1px solid #cbd5e1',
                            background: !deviceForm.powersOn ? '#fef2f2' : '#fff', color: !deviceForm.powersOn ? '#b91c1c' : '#475569',
                            fontWeight: 800, fontSize: 12, cursor: 'pointer'
                          }}
                        >
                          ⚠️ Apagado Total
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. DESCRIPCIÓN DE LA FALLA & URGENCIA */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
                      2. Describe el problema o falla que presenta *
                    </label>
                    <textarea
                      rows={3}
                      value={deviceForm.faultDescription}
                      onChange={e => setDeviceForm({ ...deviceForm, faultDescription: e.target.value })}
                      placeholder="Explica qué le sucede (ej. se trizó la pantalla y no da táctil, no carga la batería, se cayó en agua, se calienta y se apaga)..."
                      required
                      style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
                      Nivel de Urgencia
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      {[
                        { id: 'NORMAL', label: '🟢 Normal', time: '1 a 3 días hábiles' },
                        { id: 'URGENT', label: '🟡 Urgente', time: 'Hoy / 24 horas' },
                        { id: 'EMERGENCY', label: '🔴 Emergencia', time: 'Mismo día / Inmediato' }
                      ].map(u => {
                        const isUrg = deviceForm.urgency === u.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setDeviceForm({ ...deviceForm, urgency: u.id })}
                            style={{
                              padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                              border: isUrg ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              background: isUrg ? '#eff6ff' : '#fff'
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: 13, color: isUrg ? '#1d4ed8' : '#1e293b' }}>{u.label}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{u.time}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. FOTOS DEL EQUIPO (OPCIONAL) */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
                      3. Fotos del Equipo (Opcional - Máximo 5 fotos)
                    </label>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b' }}>
                      Adjuntar fotos del estado físico ayuda a los técnicos a darte un presupuesto más preciso.
                    </p>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      {deviceImages.map((img, idx) => (
                        <div key={idx} style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                          <img src={img.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => removeDeviceImage(idx)}
                            style={{
                              position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff',
                              border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 11, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {deviceImages.length < 5 && (
                        <label style={{
                          width: 72, height: 72, borderRadius: 8, border: '2px dashed #94a3b8', display: 'flex',
                          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          background: '#f8fafc', color: '#64748b', fontSize: 11, fontWeight: 700
                        }}>
                          <span style={{ fontSize: 20 }}>📷</span>
                          <span>+ Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleDeviceImageUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* 5. UBICACIÓN Y PREFERENCIA DE ENTREGA */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
                      4. Ubicación & Modalidad de Entrega
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Ciudad *
                        </label>
                        <select
                          value={deviceForm.city}
                          onChange={e => setDeviceForm({ ...deviceForm, city: e.target.value })}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                        >
                          {ECUADOR_CITIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Sector o Barrio
                        </label>
                        <input
                          type="text"
                          value={deviceForm.neighborhood}
                          onChange={e => setDeviceForm({ ...deviceForm, neighborhood: e.target.value })}
                          placeholder="Ej. La Carolina, Urdesa, El Batán..."
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <button
                        type="button"
                        onClick={() => setDeviceForm({ ...deviceForm, deliveryPreference: 'WORKSHOP' })}
                        style={{
                          padding: '12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                          border: deviceForm.deliveryPreference === 'WORKSHOP' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: deviceForm.deliveryPreference === 'WORKSHOP' ? '#eff6ff' : '#fff'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 13, color: deviceForm.deliveryPreference === 'WORKSHOP' ? '#1d4ed8' : '#1e293b' }}>
                          🏪 Llevar al Taller
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          Acudiré directamente al taller técnico seleccionado.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeviceForm({ ...deviceForm, deliveryPreference: 'HOME_DELIVERY' })}
                        style={{
                          padding: '12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                          border: deviceForm.deliveryPreference === 'HOME_DELIVERY' ? '2px solid #059669' : '1px solid #cbd5e1',
                          background: deviceForm.deliveryPreference === 'HOME_DELIVERY' ? '#ecfdf5' : '#fff'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 13, color: deviceForm.deliveryPreference === 'HOME_DELIVERY' ? '#047857' : '#1e293b' }}>
                          🛵 Servicio a Domicilio
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          Retiro y entrega con motorizado de la red Fixme.
                        </div>
                      </button>
                    </div>

                    {deviceForm.deliveryPreference === 'HOME_DELIVERY' && (
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Dirección Exacta de Retiro / Entrega
                        </label>
                        <input
                          type="text"
                          value={deviceForm.customerAddress}
                          onChange={e => setDeviceForm({ ...deviceForm, customerAddress: e.target.value })}
                          placeholder="Calle principal, número de casa, piso / departamento y referencia"
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* BOTONES DE ENVÍO */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab('repairs')}
                      style={{
                        background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '12px 20px',
                        borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      ← Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isPublishing}
                      style={{
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 10,
                        fontSize: 14, fontWeight: 800, cursor: 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(5,150,105,0.3)',
                        opacity: isPublishing ? 0.7 : 1
                      }}
                    >
                      {isPublishing ? 'Publicando equipo...' : '🚀 Publicar en la Bolsa de Cotizaciones'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: GARANTÍAS OFICIALES */}
          {/* ========================================================================= */}
          {!loading && activeTab === 'warranties' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                  🛡️ Mis Certificados de Garantía Vigentes ({portalData.warranties.length})
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Todas tus reparaciones y compras cuentan con respaldo oficial y contador de días de vigencia.
                </p>
              </div>

              {portalData.warranties.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>🛡️</div>
                  <h4 style={{ margin: '0 0 6px', color: '#1e293b' }}>Sin garantías emitidas aún</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                    Al finalizar y cobrar una reparación en cualquier taller afiliado, tu certificado digital aparecerá aquí con los días de vigencia.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                  {portalData.warranties.map((w: Any) => (
                    <div
                      key={w.id}
                      style={{
                        background: '#fff',
                        borderRadius: 14,
                        border: w.is_active ? '2px solid #10b981' : '1px solid #cbd5e1',
                        padding: 18,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{w.warranty_code}</span>
                        <span style={{
                          background: w.is_active ? '#ecfdf5' : '#fef2f2',
                          color: w.is_active ? '#059669' : '#b91c1c',
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800
                        }}>
                          {w.is_active ? `● ${w.days_remaining} días restantes` : 'Expirada'}
                        </span>
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
                        {w.service_description || 'Servicio Técnico Especializado'}
                      </div>

                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                        🏢 Taller Emisor: <b>{w.store_name}</b> {w.store_phone ? `· 📞 ${w.store_phone}` : ''}
                      </div>

                      <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, fontSize: 12, color: '#475569' }}>
                        <b>Términos de Cobertura:</b> {w.terms || 'Cubre mano de obra y repuestos sustituidos contra defectos de fábrica.'}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
                        <span>Emitida: {new Date(w.created_at).toLocaleDateString()}</span>
                        <span>Vence: {new Date(w.expires_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: COMPRAS & FACTURAS */}
          {/* ========================================================================= */}
          {!loading && activeTab === 'purchases' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                  🧾 Comprobantes de Compra & Facturas ({portalData.sales.length})
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Historial de compras de accesorios, repuestos y servicios en tiendas de la red.
                </p>
              </div>

              {portalData.sales.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>🧾</div>
                  <h4 style={{ margin: '0 0 6px', color: '#1e293b' }}>Sin compras registradas aún</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                    Tus compras en tiendas físicas afiliadas aparecerán aquí de forma automática.
                  </p>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '12px 16px' }}>Comprobante</th>
                        <th style={{ padding: '12px 16px' }}>Tienda</th>
                        <th style={{ padding: '12px 16px' }}>Fecha</th>
                        <th style={{ padding: '12px 16px' }}>Forma de Pago</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portalData.sales.map((s: Any) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>
                            {s.invoice_number || 'TICKET'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>{s.store_name}</td>
                          <td style={{ padding: '12px 16px', color: '#64748b' }}>
                            {new Date(s.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              {s.payment_method || 'EFECTIVO'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#059669' }}>
                            ${Number(s.total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: MI PERFIL & DATOS DE CONTACTO */}
          {/* ========================================================================= */}
          {!loading && activeTab === 'profile' && (
            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                  👤 Mi Perfil & Datos de Facturación
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Mantén tus datos actualizados para recibir cotizaciones precisas y comprobantes oficiales.
                </p>
              </div>

              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      Nombre Completo *
                    </label>
                    <input
                      value={profileForm.fullName}
                      onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      🪪 Cédula o RUC *
                    </label>
                    <input
                      value={profileForm.identificationNumber}
                      onChange={e => setProfileForm({ ...profileForm, identificationNumber: e.target.value })}
                      required
                      placeholder="1712345678"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      📱 Celular / WhatsApp (Identificador Canónico)
                    </label>
                    <input
                      value={phone}
                      readOnly
                      disabled
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      📧 Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                      placeholder="ejemplo@correo.com"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      📍 Ciudad Principal
                    </label>
                    <select
                      value={profileForm.city}
                      onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
                    >
                      <option value="Quito">Quito</option>
                      <option value="Guayaquil">Guayaquil</option>
                      <option value="Cuenca">Cuenca</option>
                      <option value="Ambato">Ambato</option>
                      <option value="Santo Domingo">Santo Domingo</option>
                      <option value="Machala">Machala</option>
                      <option value="Manta">Manta</option>
                      <option value="Portoviejo">Portoviejo</option>
                      <option value="Loja">Loja</option>
                      <option value="Otra Ciudad">Otra Ciudad</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      🏠 Dirección para Entregas / Retiros
                    </label>
                    <input
                      value={profileForm.address}
                      onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                      placeholder="Calle principal, secundaria, nro de casa"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    style={{
                      background: '#2563eb', color: '#fff', border: 'none', padding: '12px 24px',
                      borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                    }}
                  >
                    💾 Guardar Mis Datos
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* MODAL EDITAR PERFIL RÁPIDO */}
      {showProfileEdit && (
        <div className="modal-backdrop" onClick={() => setShowProfileEdit(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>✏️ Mis Datos de Contacto</h3>
              <button className="close-btn" onClick={() => setShowProfileEdit(false)}>✕</button>
            </div>
            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Nombre y Apellido
                <input
                  value={profileForm.fullName}
                  onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 600 }}>
                🪪 Cédula o RUC (para Facturación y Garantías)
                <input
                  value={profileForm.identificationNumber}
                  onChange={e => setProfileForm({ ...profileForm, identificationNumber: e.target.value })}
                  placeholder="Ej. 1712345678"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Correo Electrónico
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="ejemplo@correo.com"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Ciudad
                <select
                  value={profileForm.city}
                  onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                >
                  <option value="Quito">Quito</option>
                  <option value="Guayaquil">Guayaquil</option>
                  <option value="Cuenca">Cuenca</option>
                  <option value="Ambato">Ambato</option>
                  <option value="Santo Domingo">Santo Domingo</option>
                  <option value="Machala">Machala</option>
                  <option value="Manta">Manta</option>
                  <option value="Portoviejo">Portoviejo</option>
                  <option value="Loja">Loja</option>
                  <option value="Otra Ciudad">Otra Ciudad</option>
                </select>
              </label>

              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Dirección para Entregas / Retiros
                <input
                  value={profileForm.address}
                  onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                  placeholder="Calle principal, secundaria, nro de casa"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="secondary-action" onClick={() => setShowProfileEdit(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RECHAZAR PRESUPUESTO */}
      {showRejectModal && (
        <div className="modal-backdrop" onClick={() => setShowRejectModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, color: '#dc2626' }}>❌ Rechazar Presupuesto</h3>
              <button className="close-btn" onClick={() => setShowRejectModal(null)}>✕</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
                Indícanos el motivo por el cual no deseas continuar con la reparación presupuestada:
              </p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Ej. El costo excede mi presupuesto, prefiero retirar el equipo..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" className="secondary-action" onClick={() => setShowRejectModal(null)}>
                  Volver
                </button>
                <button
                  type="button"
                  disabled={rejectingId === showRejectModal}
                  onClick={() => handleRejectQuote(showRejectModal)}
                  style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                >
                  {rejectingId === showRejectModal ? 'Enviando...' : 'Confirmar Rechazo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX FOTOS TRUST-CAM */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, maxWidth: 650, width: '100%',
              overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb' }}>{previewPhoto.stage || 'Trust-Cam'}</span>
                <h4 style={{ margin: 0, fontSize: 15, color: '#0f172a' }}>{previewPhoto.title || 'Inspección Fotográfica'}</h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>
            <div style={{ maxHeight: '70vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={previewPhoto.url} alt="Trust-Cam" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '12px 18px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a
                href={previewPhoto.url}
                target="_blank"
                rel="noreferrer"
                download
                style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
              >
                ⬇️ Abrir imagen original en nueva pestaña
              </a>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
