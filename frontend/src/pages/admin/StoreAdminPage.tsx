import React from 'react';
import { Any, Table, moduleKey } from '../../sharedConfig';
import { Search, User, Store } from 'lucide-react';
import { SlideOverDrawer } from '../../components/ui/ModernUiKit';

export function Administration({api, notify, onCompanyUpdate, onModulesUpdate}:{api:(u:string,o?:RequestInit)=>Promise<Response>, notify?:(s:string)=>void, onCompanyUpdate?:(c:Any)=>void, onModulesUpdate?:()=>void}){
  const [tab, setTab] = React.useState<'modules'|'matrix'|'users'|'profile'|'sri'|'deuna'|'payphone'|'activity'>('modules');
  const [tenantModules, setTenantModules] = React.useState<Any[]>([]);
  const [loadingModules, setLoadingModules] = React.useState(false);
  const [togglingModule, setTogglingModule] = React.useState<string | null>(null);

  // Bitácora de Auditoría
  const [activityLogs, setActivityLogs] = React.useState<Any[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [logFilterAction, setLogFilterAction] = React.useState('ALL');
  const [searchLog, setSearchLog] = React.useState('');

  const loadActivityLogs = React.useCallback(() => {
    setLoadingLogs(true);
    const q = logFilterAction !== 'ALL' ? `?action=${logFilterAction}` : '';
    api(`/api/activity-logs${q}`)
      .then(r => r.ok ? r.json() : [])
      .then(setActivityLogs)
      .catch(() => {})
      .finally(() => setLoadingLogs(false));
  }, [api, logFilterAction]);

  const loadTenantModules = React.useCallback(() => {
    setLoadingModules(true);
    api('/api/modules')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) setTenantModules(data);
      })
      .catch(() => {})
      .finally(() => setLoadingModules(false));
  }, [api]);

  React.useEffect(() => {
    loadTenantModules();
  }, [loadTenantModules]);

  const isModEnabled = (key: string) => {
    const found = tenantModules.find(m => m.moduleKey === key);
    return found ? found.enabled : true;
  };

  const SYSTEM_MODULES = [
    {
      key: 'IMPORTS',
      name: 'Importaciones y Arribos',
      icon: '✈️',
      badge: 'Internacional',
      desc: 'Gestión de envíos desde USA/China (eBay, Amazon), fletes y aduana, pre-compras con adelanto y avisos automáticos por WhatsApp.',
      color: '#0284c7'
    },
    {
      key: 'PURCHASES',
      name: 'Compras & Kardex',
      icon: '🛍️',
      badge: 'Proveedores',
      desc: 'Órdenes de compra a distribuidores locales, costeo ponderado y movimientos de stock detallados.',
      color: '#d97706'
    },
    {
      key: 'POS',
      name: 'Punto de Venta & Ventas',
      icon: '💳',
      badge: 'Comercial',
      desc: 'Cobros rápidos, carritos de venta, comprobantes de pago, tickets térmicos e historial de transacciones.',
      color: '#2563eb'
    },
    {
      key: 'CASH_REGISTER',
      name: 'Control de Caja',
      icon: '💵',
      badge: 'Finanzas',
      desc: 'Aperturas de turno, ingresos/egresos menores, arqueos de efectivo y generación de Corte Z.',
      color: '#059669'
    },
    {
      key: 'INVENTORY',
      name: 'Inventario de Productos',
      icon: '📦',
      badge: 'Almacén',
      desc: 'Catálogo de existencias, código de barras, SKU, precios de mayoreo/público y alertas de stock crítico.',
      color: '#7c3aed'
    },
    {
      key: 'WORK_ORDERS',
      name: 'Taller y Servicio Técnico',
      icon: '🛠️',
      badge: 'Técnico',
      desc: 'Órdenes de trabajo, diagnósticos, asignación a técnicos, SLA con semáforos, bolsa de reparaciones y tracking online.',
      color: '#ea580c'
    },
    {
      key: 'QUOTES',
      name: 'Cotizaciones Web & Clientes',
      icon: '📝',
      badge: 'Ventas',
      desc: 'Presupuestos para clientes, enlaces públicos con aceptación/rechazo y conversión directa a importación.',
      color: '#0891b2'
    },
    {
      key: 'DELIVERIES',
      name: 'Entregas a Domicilio',
      icon: '🚚',
      badge: 'Logística',
      desc: 'Despachos de pedidos con motorizados, georreferenciación y estados de entrega.',
      color: 'var(--text-secondary)'
    },
    {
      key: 'WARRANTIES',
      name: 'Garantías y Devoluciones',
      icon: '🛡️',
      badge: 'Post-Venta',
      desc: 'Validación de números de serie, reclamos de garantía y notas de crédito de cambio de producto.',
      color: '#dc2626'
    },
    {
      key: 'CUSTOMERS',
      name: 'Gestión de Clientes',
      icon: '👥',
      badge: 'Clientes',
      desc: 'Base de datos de clientes, historial de servicios, cuentas por cobrar y portal de autogestión.',
      color: '#4f46e5'
    },
    {
      key: 'REPORTS',
      name: 'Reportes & Analítica',
      icon: '📊',
      badge: 'Gerencial',
      desc: 'Informes de utilidad bruta y neta, ventas por vendedor, rotación de inventario y estado financiero.',
      color: '#9333ea'
    },
    {
      key: 'APIS',
      name: 'Pasarelas & Pagos Digitales',
      icon: '⚡',
      badge: 'Integraciones',
      desc: 'Cobros QR con DeUna (Banco Pichincha), cobros con tarjeta de crédito vía Payphone y webhooks.',
      color: '#0d9488'
    }
  ];

  const [profile, setProfile] = React.useState<Any>({});
  const [profileForm, setProfileForm] = React.useState<Any>({
    name: '',
    legal_name: '',
    tax_id: '',
    phone: '',
    email: '',
    slogan: '',
    address: ''
  });
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [users, setUsers] = React.useState<Any[]>([]);
  const [rolePerms, setRolePerms] = React.useState<Record<string, string[]>>({});
  const [savingMatrix, setSavingMatrix] = React.useState(false);

  // DeUna Configuration state
  const [deunaConfig, setDeunaConfig] = React.useState<Any>({
    merchantId: 'DEUNA-DEMO-001',
    merchantName: 'FixmeTiendas',
    phoneNumber: '0999999999',
    apiKey: 'sandbox_key_deuna_fixme',
    apiSecret: 'sandbox_secret_deuna_fixme',
    environment: 'SANDBOX',
    enabled: true,
    autoSimulate: false
  });
  const [loadingDeuna, setLoadingDeuna] = React.useState(false);
  const [savingDeuna, setSavingDeuna] = React.useState(false);

  const loadDeUna = React.useCallback(() => {
    setLoadingDeuna(true);
    api('/api/payments/deuna/config')
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (cfg) {
          setDeunaConfig({
            merchantId: cfg.merchant_id || cfg.merchantId || '',
            merchantName: cfg.merchant_name || cfg.merchantName || '',
            phoneNumber: cfg.phone_number || cfg.phoneNumber || '',
            apiKey: cfg.api_key || cfg.apiKey || '',
            apiSecret: cfg.api_secret || cfg.apiSecret || '',
            environment: cfg.environment || 'SANDBOX',
            enabled: cfg.enabled !== false,
            autoSimulate: !!cfg.auto_simulate
          });
        }
      })
      .finally(() => setLoadingDeuna(false));
  }, [api]);

  async function saveDeUnaConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingDeuna(true);
    try {
      const res = await api('/api/payments/deuna/config', {
        method: 'PUT',
        body: JSON.stringify({
          merchant_id: deunaConfig.merchantId,
          merchant_name: deunaConfig.merchantName,
          phone_number: deunaConfig.phoneNumber,
          api_key: deunaConfig.apiKey,
          api_secret: deunaConfig.apiSecret,
          environment: deunaConfig.environment,
          enabled: deunaConfig.enabled,
          auto_simulate: deunaConfig.autoSimulate
        })
      });
      if (res.ok) {
        notify?.('Configuración de pagos DeUna QR actualizada correctamente');
      } else {
        notify?.('Error al guardar la configuración de DeUna');
      }
    } catch {
      notify?.('Error de conexión al guardar DeUna');
    } finally {
      setSavingDeuna(false);
    }
  }

  // Payphone (Cards) Configuration state
  const [payphoneConfig, setPayphoneConfig] = React.useState<Any>({
    token: '',
    clientId: 'PAYPHONE-DEMO-001',
    storeId: 'STORE-DEMO-001',
    environment: 'SANDBOX',
    enabled: true
  });
  const [loadingPayphone, setLoadingPayphone] = React.useState(false);
  const [savingPayphone, setSavingPayphone] = React.useState(false);

  const loadPayphone = React.useCallback(() => {
    setLoadingPayphone(true);
    api('/api/payments/payphone/config')
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (cfg) {
          setPayphoneConfig({
            token: cfg.token || '',
            clientId: cfg.client_id || cfg.clientId || '',
            storeId: cfg.store_id || cfg.storeId || '',
            environment: cfg.environment || 'SANDBOX',
            enabled: cfg.enabled !== false
          });
        }
      })
      .finally(() => setLoadingPayphone(false));
  }, [api]);

  async function savePayphoneConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingPayphone(true);
    try {
      const res = await api('/api/payments/payphone/config', {
        method: 'PUT',
        body: JSON.stringify({
          token: payphoneConfig.token,
          client_id: payphoneConfig.clientId,
          store_id: payphoneConfig.storeId,
          environment: payphoneConfig.environment,
          enabled: payphoneConfig.enabled
        })
      });
      if (res.ok) {
        notify?.('Configuración de pagos Payphone (Tarjetas) actualizada correctamente');
      } else {
        notify?.('Error al guardar la configuración de Payphone');
      }
    } catch (err: any) {
      notify?.('Error de conexión al guardar Payphone: ' + err.message);
    } finally {
      setSavingPayphone(false);
    }
  }

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
    { key: 'home', label: 'Resumen (Dashboard)', group: 'Principal', desc: 'Vista global y métricas del negocio' },
    { key: 'pos', label: 'Punto de Venta (POS)', group: 'Ventas', desc: 'Facturación directa, tickets y carritos de venta' },
    { key: 'sales', label: 'Registro de Ventas', group: 'Ventas', desc: 'Historial de ventas y comprobantes emitidos' },
    { key: 'cash', label: 'Control de Caja', group: 'Ventas', desc: 'Aperturas de turno, movimientos y arqueos Corte Z' },
    { key: 'quotes', label: 'Cotizaciones Web', group: 'Ventas', desc: 'Presupuestos públicos y solicitudes de clientes' },
    { key: 'deliveries', label: 'Entregas a Domicilio', group: 'Ventas', desc: 'Despachos con motorizados y tracking de pedidos' },
    { key: 'my-work', label: 'Mi Trabajo Asignado', group: 'Taller', desc: 'Órdenes de servicio asignadas al técnico con SLA' },
    { key: 'work-orders', label: 'Órdenes de Servicio', group: 'Taller', desc: 'Ingreso de equipos, repuestos y entregas' },
    { key: 'marketplace', label: 'Bolsa de Reparaciones', group: 'Taller', desc: 'Bolsa de trabajo colaborativa entre técnicos' },
    { key: 'warranties', label: 'Garantías y Devoluciones', group: 'Taller', desc: 'Validación de tickets y control de números de serie' },
    { key: 'products', label: 'Inventario de Productos', group: 'Inventario', desc: 'Catálogo de existencias, códigos de barra y alertas' },
    { key: 'purchases', label: 'Compras & Kardex', group: 'Inventario', desc: 'Órdenes de compra a distribuidores y costo ponderado' },
    { key: 'imports', label: 'Importaciones y Arribos', group: 'Inventario', desc: 'Compras internacionales (eBay/USA), aduanas y pre-compras' },
    { key: 'customers', label: 'Gestión de Clientes', group: 'Operación', desc: 'Directorio de clientes, cartera comercial y portal' },
    { key: 'reports', label: 'Reportes Financieros', group: 'Gestión', desc: 'COGS, utilidades, margen de ganancia y balance' },
    { key: 'administration', label: 'Empresa y Permisos', group: 'Gestión', desc: 'Usuarios, perfil y matriz de roles de la tienda' }
  ];

  const isContracted = (k: string) => {
    if (k === 'home' || k === 'administration') return true;
    const mk = moduleKey(k);
    const found = tenantModules.find(m => m.moduleKey === mk);
    return found ? found.enabled : true;
  };

  const ROLES = [
    { key: 'MANAGER', label: 'Manager / Administrador', icon: '👔', color: '#4f46e5' },
    { key: 'TECHNICIAN', label: 'Técnico de Taller', icon: '🛠️', color: '#d97706' },
    { key: 'SELLER', label: 'Vendedor / Asesor', icon: '🛒', color: '#2563eb' },
    { key: 'DELIVERY', label: 'Repartidor / Motorizado', icon: '🛵', color: '#059669' },
    { key: 'ACCOUNTANT', label: 'Contador / Finanzas', icon: '📊', color: '#7c3aed' }
  ];

  const load = React.useCallback(() => {
    api('/api/administration/profile').then(r => r.ok ? r.json() : {}).then((p: Any) => {
      setProfile(p);
      const initialName = (p.name && p.name !== 'Demo tenant') ? p.name : (p.sri_nombre_comercial || p.name || localStorage.tenantName || 'FIXMETIENDAS');
      const initialLegal = p.legal_name || p.sri_razon_social || p.sri_nombre_comercial || localStorage.tenantLegalName || '';
      const initialRuc = p.tax_id || p.sri_ruc || localStorage.tenantRuc || '1790012345001';
      const initialPhone = p.phone || localStorage.tenantPhone || '0994175857';
      const initialEmail = p.email || p.billing_contact_email || localStorage.tenantEmail || 'contacto@fixmetiendas.com';
      const initialSlogan = p.slogan || p.catalog_description || localStorage.tenantSlogan || 'Con la Mejor Innovación en Tecnología';
      const initialAddress = p.address || p.sri_direccion_matriz || p.sri_direccion_establecimiento || localStorage.tenantAddress || 'Matriz Principal, Ecuador';

      setProfileForm({
        name: initialName,
        legal_name: initialLegal,
        legalName: initialLegal,
        tax_id: initialRuc,
        taxId: initialRuc,
        phone: initialPhone,
        email: initialEmail,
        slogan: initialSlogan,
        address: initialAddress
      });
    });
    api('/api/administration/users').then(r => r.ok ? r.json() : []).then(setUsers);
    api('/api/administration/role-permissions').then(r => r.ok ? r.json() : {}).then(setRolePerms);
  }, [api]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload = {
        name: profileForm.name,
        legal_name: profileForm.legal_name,
        legalName: profileForm.legal_name,
        tax_id: profileForm.tax_id,
        taxId: profileForm.tax_id,
        phone: profileForm.phone,
        email: profileForm.email,
        slogan: profileForm.slogan,
        catalog_description: profileForm.slogan,
        address: profileForm.address
      };
      const res = await api('/api/administration/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        const savedName = updated.name || profileForm.name;
        const savedLegal = updated.legal_name || updated.sri_razon_social || profileForm.legal_name;
        const savedRuc = updated.tax_id || updated.sri_ruc || profileForm.tax_id;
        const savedPhone = updated.phone || profileForm.phone;
        const savedEmail = updated.email || updated.billing_contact_email || profileForm.email;
        const savedSlogan = updated.slogan || updated.catalog_description || profileForm.slogan;
        const savedAddr = updated.address || updated.sri_direccion_matriz || profileForm.address;

        setProfileForm({
          name: savedName,
          legal_name: savedLegal,
          legalName: savedLegal,
          tax_id: savedRuc,
          taxId: savedRuc,
          phone: savedPhone,
          email: savedEmail,
          slogan: savedSlogan,
          address: savedAddr
        });
        if (savedName) localStorage.setItem('tenantName', savedName);
        if (savedLegal) localStorage.setItem('tenantLegalName', savedLegal);
        if (savedRuc) localStorage.setItem('tenantRuc', savedRuc);
        if (savedPhone) localStorage.setItem('tenantPhone', savedPhone);
        if (savedEmail) localStorage.setItem('tenantEmail', savedEmail);
        if (savedSlogan) localStorage.setItem('tenantSlogan', savedSlogan);
        if (savedAddr) localStorage.setItem('tenantAddress', savedAddr);
        localStorage.setItem('companyProfile', JSON.stringify(updated));
        if (onCompanyUpdate) onCompanyUpdate(updated);
        notify?.('✓ Perfil de la empresa y datos de comprobantes actualizados con éxito');
      } else {
        notify?.('Error al guardar el perfil de la empresa');
      }
    } catch (err: any) {
      notify?.('Error de conexión al guardar el perfil: ' + (err?.message || ''));
    } finally {
      setSavingProfile(false);
    }
  }

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
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => { setTab('modules'); loadTenantModules(); }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: tab === 'modules' ? '1px solid #7c3aed' : '1px solid #cbd5e1',
            background: tab === 'modules' ? '#f5f3ff' : '#ffffff',
            color: tab === 'modules' ? '#6d28d9' : '#475569',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          🧩 Módulos Contratados
        </button>
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
        <button
          onClick={() => { setTab('deuna'); loadDeUna(); }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: tab === 'deuna' ? '1px solid #00a896' : '1px solid #cbd5e1',
            background: tab === 'deuna' ? '#f0fdfa' : '#ffffff',
            color: tab === 'deuna' ? '#0f766e' : '#475569',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          📱 Pagos QR DeUna (Banco Pichincha)
        </button>
        <button
          onClick={() => { setTab('payphone'); loadPayphone(); }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: tab === 'payphone' ? '1px solid #f97316' : '1px solid #cbd5e1',
            background: tab === 'payphone' ? '#fff7ed' : '#ffffff',
            color: tab === 'payphone' ? '#c2410c' : '#475569',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          💳 Tarjetas Payphone (Visa / Mastercard)
        </button>
        <button
          onClick={() => { setTab('activity'); loadActivityLogs(); }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: tab === 'activity' ? '1px solid #475569' : '1px solid #cbd5e1',
            background: tab === 'activity' ? '#f1f5f9' : '#ffffff',
            color: tab === 'activity' ? '#0f172a' : '#475569',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          📋 Bitácora de Auditoría
        </button>
      </div>

      {/* TAB 0: CONTRACTED MODULES (MANAGED BY TENANT_ADMIN / SAAS) */}
      {tab === 'modules' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🧩</span> Módulos Contratados de la Empresa
              </h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                Estos son los paquetes y servicios contratados en el plan de tu tienda con Fixme SaaS. Desde aquí puedes supervisar qué módulos tienes habilitados y asignar los permisos de acceso a tus colaboradores en la pestaña <strong>Matriz de Permisos por Rol</strong>.
              </p>
            </div>
            <div>
              <button
                type="button"
                className="secondary-action"
                onClick={loadTenantModules}
                disabled={loadingModules}
                style={{ fontSize: '12px' }}
              >
                {loadingModules ? 'Cargando...' : '🔄 Recargar Módulos'}
              </button>
            </div>
          </div>

          {/* SaaS Plan Notice Banner */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong style={{ color: '#166534', fontSize: '13px' }}>💡 ¿Deseas habilitar un nuevo módulo (ej: Importaciones, Compras o Taller)?</strong>
              <div style={{ color: '#15803d', fontSize: '12px', marginTop: 2 }}>
                La activación de nuevos módulos la gestiona la administración de Fixme según el plan contratado. Puedes solicitar ampliaciones en un clic.
              </div>
            </div>
            <a
              href={`https://wa.me/593991234567?text=${encodeURIComponent(`Hola administración de Fixme! En mi tienda "${localStorage.tenantName || 'Mi Tienda'}" deseamos solicitar la activación de nuevos módulos para nuestro plan.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: '#16a34a', color: '#ffffff', padding: '7px 14px', borderRadius: 8, fontSize: '12px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              💬 Solicitar Activación / Upgrade
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 16 }}>
            {SYSTEM_MODULES.map(m => {
              const isEnabled = isModEnabled(m.key);
              const rolesWithAccess = ROLES.filter(r => {
                const perms = rolePerms[r.key] || [];
                return perms.some(p => moduleKey(p) === m.key);
              });

              return (
                <div
                  key={m.key}
                  style={{
                    background: isEnabled ? '#ffffff' : '#f8fafc',
                    borderRadius: 12,
                    border: isEnabled ? `1.5px solid ${m.color}35` : '1.5px solid #cbd5e1',
                    boxShadow: isEnabled ? `0 2px 8px ${m.color}15` : 'none',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 26, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: `${m.color}15` }}>
                          {m.icon}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</h4>
                          <span style={{ fontSize: 11, fontWeight: 600, color: m.color, background: `${m.color}12`, padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginTop: 2 }}>
                            {m.badge}
                          </span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 12,
                        background: isEnabled ? '#ecfdf5' : '#f1f5f9',
                        color: isEnabled ? '#059669' : '#64748b',
                        border: isEnabled ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                        whiteSpace: 'nowrap'
                      }}>
                        {isEnabled ? '● Contratado' : '🔒 No incluido'}
                      </span>
                    </div>

                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                      {m.desc}
                    </p>

                    {isEnabled ? (
                      <div style={{ background: 'var(--bg-subtle)', padding: '6px 10px', borderRadius: 6, fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: 12, border: '1px solid #f1f5f9' }}>
                        <strong>👥 Roles con acceso:</strong>{' '}
                        {rolesWithAccess.length > 0
                          ? rolesWithAccess.map(r => r.label.split(' ')[0]).join(', ')
                          : <span style={{ color: '#94a3b8' }}>Sin roles asignados</span>}
                      </div>
                    ) : (
                      <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '6px 10px', borderRadius: 6, fontSize: '11px', color: '#92400e', marginBottom: 12 }}>
                        Requiere activación en el plan de tu tienda para ser asignado a tu equipo.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 11.5, color: isEnabled ? '#059669' : '#94a3b8', fontWeight: 600 }}>
                      {isEnabled ? '✓ Activo para la tienda' : '⊘ Bloqueado por plan'}
                    </span>
                    {isEnabled ? (
                      <button
                        type="button"
                        onClick={() => setTab('matrix')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: '1px solid #c7d2fe',
                          background: '#eef2ff',
                          color: '#4338ca',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        🛡️ Asignar Permisos a Roles →
                      </button>
                    ) : (
                      <a
                        href={`https://wa.me/593991234567?text=${encodeURIComponent(`Hola administración de Fixme! En mi tienda "${localStorage.tenantName || 'Mi Tienda'}" deseamos activar el módulo de ${m.name}. ¿Podrían darnos información?`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: '11.5px',
                          fontWeight: 700,
                          textDecoration: 'none',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        💬 Solicitar Módulo
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 1: MATRIX */}
      {tab === 'matrix' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>Matriz de Autorización por Rol</h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
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
                      <small style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '11px' }}>
                        {(rolePerms[r.key] || []).length} permisos
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map(m => {
                  const contracted = isContracted(m.key);
                  return (
                    <tr
                      key={m.key}
                      className="matrix-role-row"
                      style={{
                        background: contracted ? 'transparent' : '#f8fafc',
                        opacity: contracted ? 1 : 0.65
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{m.label}</strong>
                          {!contracted ? (
                            <span style={{ fontSize: '10px', background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              🔒 No Contratado
                            </span>
                          ) : (
                            m.key !== 'home' && m.key !== 'administration' && (
                              <span style={{ fontSize: '10px', background: '#ecfdf5', color: '#047857', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                ✓ En Plan
                              </span>
                            )
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                          {m.desc}
                          {!contracted && (
                            <span style={{ color: '#b91c1c', display: 'block', marginTop: 1 }}>
                              · No contratado en el plan de la tienda. Solicita activación en Fixme para habilitarlo a tus roles.
                            </span>
                          )}
                        </div>
                      </td>
                      {ROLES.map(r => {
                        const hasPerm = (rolePerms[r.key] || []).includes(m.key);
                        const isManagerAdmin = r.key === 'MANAGER' && m.key === 'administration';
                        const isDisabled = !contracted || isManagerAdmin;
                        return (
                          <td key={r.key} style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              className="matrix-checkbox"
                              checked={contracted && (hasPerm || isManagerAdmin)}
                              disabled={isDisabled}
                              onChange={e => toggleRolePermission(r.key, m.key, e.target.checked)}
                              title={!contracted
                                ? 'Módulo no contratado por la tienda. Contacta a Fixme para habilitar este paquete.'
                                : `${m.label} para ${r.label}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
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
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
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
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '2px solid #e2e8f0' }}>
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
                          <strong style={{ color: 'var(--text-primary)' }}>{u.fullName || u.full_name || u.email}</strong>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div>{u.identification || 'Sin cédula'}</div>
                          <small style={{ color: 'var(--text-muted)' }}>{u.phone || 'Sin teléfono'}</small>
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
                            <span style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 6, fontSize: '11.5px' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>🏢 Perfil de la Empresa y Membrete de Comprobantes</h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                Configura los datos fiscales y comerciales de tu negocio. Esta información se imprime automáticamente en los tickets y facturas térmicas (58mm y 80mm).
              </p>
            </div>
            <button
              type="button"
              className="secondary-action"
              onClick={load}
              style={{ fontSize: '12px' }}
            >
              🔄 Recargar Datos
            </button>
          </div>

          <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Nombre Comercial de la Tienda *
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="Ej: TECNAMAX"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '14px' }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Nombre público que aparece en el título principal del ticket.</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Razón Social / Propietario Legal *
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.legal_name}
                  onChange={e => setProfileForm({ ...profileForm, legal_name: e.target.value })}
                  placeholder="Ej: JAMYER CAROLINA MONTILLA LOPEZ"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '14px' }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Nombre del titular de la actividad o persona jurídica.</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  R.U.C. / C.I. de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.tax_id}
                  onChange={e => setProfileForm({ ...profileForm, tax_id: e.target.value })}
                  placeholder="Ej: 1761056884001"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '14px' }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Número de identificación tributaria ante el SRI.</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Teléfono / WhatsApp de Contacto
                </label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="Ej: 0968988607"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '14px' }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Aparece en el membrete y pie de ticket para soporte del cliente.</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Correo Electrónico de Facturación / Contacto
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="Ej: contacto@tecnamax.com"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '14px' }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Email institucional que figura en los comprobantes.</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Slogan o Subtítulo del Comprobante
                </label>
                <input
                  type="text"
                  value={profileForm.slogan}
                  onChange={e => setProfileForm({ ...profileForm, slogan: e.target.value })}
                  placeholder="Ej: Servicio Técnico Especializado en Telefonía Móvil"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '14px' }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Subtítulo visible bajo el nombre comercial en el ticket.</small>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Dirección Matriz / Dirección Comercial Completa *
              </label>
              <textarea
                required
                rows={2}
                value={profileForm.address}
                onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                placeholder="Ej: Av. Martha Bucaram OE-112 y Emilio Uzcategui, Chillogallo, Quito"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '14px', resize: 'vertical' }}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Ubicación física que saldrá impresa como matriz en el comprobante.</small>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button
                type="submit"
                className="primary-action"
                disabled={savingProfile}
                style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {savingProfile ? '💾 Guardando Cambios...' : '💾 Guardar Datos de la Empresa'}
              </button>
            </div>
          </form>

          {/* Estado de Suscripción */}
          <div style={{ background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, marginTop: 24, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
              Estado del Servicio y Suscripción SaaS
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 14 }}>
              <div>Tipo de Negocio: <strong>{profile.business_type || 'RETAIL'}</strong></div>
              <div>Plan Contratado: <strong>{profile.plan || 'STARTER'}</strong></div>
              <div>Estado de tienda: <strong style={{ color: profile.subscription_status === 'SUSPENDED' ? '#dc2626' : '#059669' }}>{profile.subscription_status || 'ACTIVA'}</strong></div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Mensualidad del Sistema</small>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  ${Number(profile.monthly_fee || 49).toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>/ mes</span>
                </div>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Próximo Vencimiento</small>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {profile.next_billing_date ? String(profile.next_billing_date).slice(0, 10) : 'Al día'}
                </div>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Estado de Pago</small>
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
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
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
              <div style={{ background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>
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
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Razón Social (Según RUC)
                    <input
                      value={sriConfig.razonSocial || ''}
                      onChange={e => setSriConfig({ ...sriConfig, razonSocial: e.target.value })}
                      placeholder="Nombre de la empresa o persona natural"
                      required
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Nombre Comercial (Rótulo)
                    <input
                      value={sriConfig.nombreComercial || ''}
                      onChange={e => setSriConfig({ ...sriConfig, nombreComercial: e.target.value })}
                      placeholder="FixmeTiendas"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Dirección Matriz
                    <input
                      value={sriConfig.direccionMatriz || ''}
                      onChange={e => setSriConfig({ ...sriConfig, direccionMatriz: e.target.value })}
                      placeholder="Dirección fiscal matriz"
                      required
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Dirección Sucursal / Establecimiento
                    <input
                      value={sriConfig.direccionEstablecimiento || ''}
                      onChange={e => setSriConfig({ ...sriConfig, direccionEstablecimiento: e.target.value })}
                      placeholder="Dirección donde opera este punto de venta"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
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
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4, fontFamily: 'monospace' }}
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
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4, fontFamily: 'monospace' }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>
                      Régimen Tributario
                      <select
                        value={sriConfig.regimenTributario || 'RIMPE_EMPRENDEDOR'}
                        onChange={e => setSriConfig({ ...sriConfig, regimenTributario: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
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
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4, fontFamily: 'monospace' }}
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
              <div style={{ background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>
                  🔐 Ambiente y Firma Electrónica (.p12)
                </h4>

                <label style={{ fontSize: '12px', fontWeight: 600 }}>
                  Ambiente SRI
                  <select
                    value={sriConfig.ambienteSri || 1}
                    onChange={e => setSriConfig({ ...sriConfig, ambienteSri: Number(e.target.value) })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                  >
                    <option value={1}>1 - PRUEBAS / CERTIFICACIÓN (celcer.sri.gob.ec)</option>
                    <option value={2}>2 - PRODUCCIÓN OFICIAL (cel.sri.gob.ec)</option>
                  </select>
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: 2 }}>
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
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: 2 }}>
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

      {/* TAB 5: DEUNA QR PAYMENTS (BANCO PICHINCHA) */}
      {tab === 'deuna' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <span className="eyebrow">PAGOS DIGITALES INTERBANCARIOS</span>
              <h3 style={{ margin: '4px 0', fontSize: '18px', color: 'var(--text-primary)' }}>📱 Configuración DeUna QR (Banco Pichincha)</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                Acepta pagos instantáneos con código QR interoperable en Ecuador (DeUna, Banco Pichincha, Cooperativas y banca nacional).
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                background: deunaConfig.environment === 'PRODUCTION' ? '#dcfce7' : '#fef9c3',
                color: deunaConfig.environment === 'PRODUCTION' ? '#15803d' : '#854d0e',
                border: deunaConfig.environment === 'PRODUCTION' ? '1px solid #86efac' : '1px solid #fde047',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: '11px',
                fontWeight: 700
              }}>
                {deunaConfig.environment === 'PRODUCTION' ? '🟢 EN PRODUCCIÓN' : '🟡 EN MODO SANDBOX (PRUEBAS)'}
              </span>
            </div>
          </div>

          <form onSubmit={saveDeUnaConfig} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '12px 16px', fontSize: '12.5px', color: '#0f766e' }}>
              <strong>🏦 Red Nacional Interbancaria:</strong> Los pagos generados con DeUna permiten a los clientes escanear desde su teléfono móvil con la app <b>DeUna</b>, app de <b>Banco Pichincha</b>, o cualquier entidad financiera conectada a la red de cobros QR dinámicos de Ecuador.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* BLOQUE 1: ESTADO Y COMERCIO */}
              <div style={{ background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>
                  ⚙️ Parámetros de la Cuenta
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={deunaConfig.enabled}
                      onChange={e => setDeunaConfig({ ...deunaConfig, enabled: e.target.checked })}
                    />
                    Habilitar opción de pago con DeUna QR en POS y Cotizaciones
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Ambiente de Conexión
                    <select
                      value={deunaConfig.environment}
                      onChange={e => setDeunaConfig({ ...deunaConfig, environment: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    >
                      <option value="SANDBOX">Pruebas / Sandbox (Simulación instantánea sin dinero real)</option>
                      <option value="PRODUCTION">Producción (Cobros reales acreditados en Banco Pichincha)</option>
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Nombre Comercial a mostrar al Cliente
                    <input
                      value={deunaConfig.merchantName}
                      onChange={e => setDeunaConfig({ ...deunaConfig, merchantName: e.target.value })}
                      placeholder="FIXMETIENDAS"
                      required
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Teléfono Celular DeUna del Negocio
                    <input
                      value={deunaConfig.phoneNumber}
                      onChange={e => setDeunaConfig({ ...deunaConfig, phoneNumber: e.target.value })}
                      placeholder="0999999999"
                      required
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>
                </div>
              </div>

              {/* BLOQUE 2: CREDENCIALES DE API */}
              <div style={{ background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>
                  🔐 Credenciales DeUna API (Banco Pichincha)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    ID de Comercio (Merchant ID)
                    <input
                      value={deunaConfig.merchantId}
                      onChange={e => setDeunaConfig({ ...deunaConfig, merchantId: e.target.value })}
                      placeholder="DEUNA-DEMO-001"
                      required
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    API Key (Clave Pública)
                    <input
                      value={deunaConfig.apiKey}
                      onChange={e => setDeunaConfig({ ...deunaConfig, apiKey: e.target.value })}
                      placeholder="sandbox_key_..."
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    API Secret (Clave Secreta)
                    <input
                      type="password"
                      value={deunaConfig.apiSecret}
                      onChange={e => setDeunaConfig({ ...deunaConfig, apiSecret: e.target.value })}
                      placeholder="••••••••••••"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 12px', fontSize: '11.5px', color: '#1e3a8a', marginTop: 'auto' }}>
                    🧪 <b>Botón de Simulación:</b> En modo Sandbox, el Punto de Venta y el Portal de Cotizaciones incluyen un botón para simular la confirmación del pago en 1 clic para validar el flujo completo.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                type="submit"
                className="primary-action"
                disabled={savingDeuna}
                style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 700, background: '#028090', borderColor: '#00a896' }}
              >
                {savingDeuna ? 'Guardando...' : '💾 Guardar Configuración DeUna'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAB 5: PAYPHONE CARDS CONFIGURATION */}
      {tab === 'payphone' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💳</span> Configuración Pasarela de Pagos Payphone (Tarjetas de Crédito / Débito)
              </h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                Conecta tu cuenta Payphone Developer para procesar cobros con Visa, Mastercard, Diners y Discover tanto en el Punto de Venta como en el Portal de Cotizaciones.
              </p>
            </div>
            {loadingPayphone && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cargando parámetros...</span>}
          </div>

          <form onSubmit={savePayphoneConfig} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {/* BLOQUE 1: PARAMETROS OPERATIVOS */}
              <div style={{ background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>
                  ⚙️ Parámetros del Servicio
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="matrix-checkbox"
                      checked={payphoneConfig.enabled}
                      onChange={e => setPayphoneConfig({ ...payphoneConfig, enabled: e.target.checked })}
                    />
                    Habilitar cobros con tarjeta Payphone en esta tienda
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Ambiente de Conexión
                    <select
                      value={payphoneConfig.environment}
                      onChange={e => setPayphoneConfig({ ...payphoneConfig, environment: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    >
                      <option value="SANDBOX">Pruebas / Sandbox (Simulación instantánea sin dinero real)</option>
                      <option value="PRODUCTION">Producción (Cobros reales con tarjeta de crédito/débito)</option>
                    </select>
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    ID de Tienda / Sucursal Payphone (Store ID)
                    <input
                      value={payphoneConfig.storeId}
                      onChange={e => setPayphoneConfig({ ...payphoneConfig, storeId: e.target.value })}
                      placeholder="STORE-DEMO-001"
                      required
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '10px 12px', fontSize: '11.5px', color: '#9a3412', marginTop: 8 }}>
                    💡 <b>Conciliación de Caja:</b> Todas las ventas cobradas con Payphone se registran automáticamente bajo la modalidad de pago <b>TARJETA</b> para cuadre automático con tu datáfono y arqueo de caja.
                  </div>
                </div>
              </div>

              {/* BLOQUE 2: CREDENCIALES DE API */}
              <div style={{ background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid #cbd5e1', paddingBottom: 6 }}>
                  🔐 Credenciales de API Payphone Developer
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    ID de Cliente (Client ID)
                    <input
                      value={payphoneConfig.clientId}
                      onChange={e => setPayphoneConfig({ ...payphoneConfig, clientId: e.target.value })}
                      placeholder="PAYPHONE-DEMO-001"
                      required
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    Token de Autenticación Privado (Bearer Token)
                    <input
                      type="password"
                      value={payphoneConfig.token}
                      onChange={e => setPayphoneConfig({ ...payphoneConfig, token: e.target.value })}
                      placeholder="••••••••••••"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                    />
                  </label>

                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 12px', fontSize: '11.5px', color: '#1e3a8a', marginTop: 'auto' }}>
                    🧪 <b>Simulador Sandbox:</b> En modo Sandbox, podrás probar cobros de prueba con botones para Visa Débito, Mastercard Internacional y Diners Club sin costo alguno.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                type="submit"
                className="primary-action"
                disabled={savingPayphone}
                style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 700, background: '#ea580c', borderColor: '#c2410c' }}
              >
                {savingPayphone ? 'Guardando...' : '💾 Guardar Configuración Payphone'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAB: BITÁCORA DE AUDITORÍA */}
      {tab === 'activity' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📋</span> Bitácora de Auditoría & Actividad del Sistema
              </h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                Registro inmutable de acciones sensibles: ventas realizadas, apertura y cierre de caja, abonos a créditos, devoluciones y cobros de taller.
              </p>
            </div>
            <button
              type="button"
              className="secondary-action"
              onClick={loadActivityLogs}
              disabled={loadingLogs}
              style={{ fontSize: '12px' }}
            >
              🔄 Actualizar Bitácora
            </button>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                ['ALL', 'Todas las Acciones'],
                ['SALE_CREATE', '🛒 Ventas POS'],
                ['SALE_RETURN', '↩️ Devoluciones'],
                ['CREDIT_PAYMENT', '💵 Abonos a Crédito'],
                ['CASH_OPEN', '🔓 Aperturas de Caja'],
                ['CASH_CLOSE', '🔒 Cierres de Turno'],
                ['REPAIR_DELIVERY', '🛠️ Entregas de Taller']
              ].map(([act, label]) => (
                <button
                  key={act}
                  type="button"
                  className={`filter-pill ${logFilterAction === act ? 'active' : ''}`}
                  onClick={() => setLogFilterAction(act)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="search-box" style={{ minWidth: 260 }}>
              <span>🔍</span>
              <input
                placeholder="Buscar por usuario, rol o detalle..."
                value={searchLog}
                onChange={e => setSearchLog(e.target.value)}
              />
            </div>
          </div>

          {/* Activity Logs Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Usuario / Responsable</th>
                  <th>Rol</th>
                  <th>Módulo</th>
                  <th>Acción</th>
                  <th>Detalle del Evento</th>
                  <th>IP / Registro</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs
                  .filter(l => {
                    if (searchLog.trim()) {
                      const q = searchLog.toLowerCase();
                      const match = (
                        (l.user_email || '').toLowerCase().includes(q) ||
                        (l.role || '').toLowerCase().includes(q) ||
                        (l.description || '').toLowerCase().includes(q) ||
                        (l.entity_type || '').toLowerCase().includes(q)
                      );
                      if (!match) return false;
                    }
                    return true;
                  })
                  .map(l => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                        <strong>{new Date(l.created_at).toLocaleDateString()}</strong>{' '}
                        <small style={{ color: 'var(--text-muted)' }}>
                          {new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </small>
                      </td>
                      <td>
                        <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>{l.user_email || 'Sistema'}</strong>
                      </td>
                      <td>
                        <span className="seller-role-badge" style={{ fontSize: '10.5px' }}>{l.role || 'USER'}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{l.module || l.entity_type}</span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: l.action === 'SALE_CREATE' ? '#ecfdf5' :
                                      l.action === 'SALE_RETURN' ? '#fef2f2' :
                                      l.action === 'CREDIT_PAYMENT' ? '#f5f3ff' :
                                      l.action === 'CASH_OPEN' ? '#eff6ff' :
                                      l.action === 'CASH_CLOSE' ? '#fffbeb' : '#f1f5f9',
                          color: l.action === 'SALE_CREATE' ? '#065f46' :
                                 l.action === 'SALE_RETURN' ? '#991b1b' :
                                 l.action === 'CREDIT_PAYMENT' ? '#6d28d9' :
                                 l.action === 'CASH_OPEN' ? '#1d4ed8' :
                                 l.action === 'CASH_CLOSE' ? '#92400e' : '#334155'
                        }}>
                          {l.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                        {l.description}
                      </td>
                      <td>
                        <small style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{l.ip_address || '127.0.0.1'}</small>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!activityLogs.length && (
              <div className="empty">
                <b>📋</b>
                <p>{loadingLogs ? 'Cargando eventos de auditoría...' : 'No hay registros de actividad todavía.'}</p>
              </div>
            )}
          </div>
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
              <div style={{ background: 'var(--bg-subtle)', padding: 10, borderRadius: 8, marginBottom: 14, fontSize: '12.5px' }}>
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
                <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4, marginLeft: 26, fontSize: '12px' }}>
                  {isCustomPerms
                    ? 'Este usuario tendrá su propia lista de permisos independientes de su rol.'
                    : 'Si esta opción está desactivada, el usuario hereda automáticamente cualquier cambio que hagas en la matriz de su rol.'}
                </small>
              </div>

              {isCustomPerms && (
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 16 }}>
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
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.desc}</div>
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


export default Administration;
