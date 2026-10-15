import React from 'react';
import { Any, ALL_MODULES_DEF, Table, nav, moduleKey } from '../../sharedConfig';
import { printTicketElement } from '../../ticketPrinter';
import { SlideOverDrawer } from '../../components/ui/ModernUiKit';
import { Search, Store, Receipt } from 'lucide-react';

export function PlatformAdministration({api, notify, activeTab, setTab}:{api:(u:string,o?:RequestInit)=>Promise<Response>, notify?:(s:string)=>void, activeTab?:string, setTab?:(t:string)=>void}){
  const [tenants, setTenants] = React.useState<Any[]>([]);
  const [stats, setStats] = React.useState<Any>({
    totalTenants: 0, activeTenants: 0, pastDueTenants: 0, suspendedTenants: 0,
    mrr: 0, collectedThisMonth: 0, totalUsers: 0, totalProducts: 0, totalOrders: 0
  });
  const [payments, setPayments] = React.useState<Any[]>([]);
  const [plans, setPlans] = React.useState<Any[]>([]);
  const [trials, setTrials] = React.useState<Any[]>([]);
  const [trialFilter, setTrialFilter] = React.useState('ALL');
  const [trialSearch, setTrialSearch] = React.useState('');
  const [filter, setFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const currentTab = activeTab && ['platform-overview', 'platform-companies', 'platform-trials', 'platform-rates', 'platform-plans', 'platform-payments'].includes(activeTab)
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

  // Convert Trial to Plan modal
  const [convertModalTenant, setConvertModalTenant] = React.useState<Any|null>(null);
  const [convertForm, setConvertForm] = React.useState<Any>({
    planCode: 'PRO',
    monthlyFee: '49.00',
    billingCycle: 'MONTHLY',
    modules: {} as Record<string, boolean>
  });
  const [converting, setConverting] = React.useState(false);

  // Extend Trial modal
  const [extendModalTenant, setExtendModalTenant] = React.useState<Any|null>(null);
  const [extendDaysInput, setExtendDaysInput] = React.useState(15);
  const [extendNotes, setExtendNotes] = React.useState('');
  const [extending, setExtending] = React.useState(false);

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

  // Plan Edit / Create Modal
  const [editPlanModal, setEditPlanModal] = React.useState<Any|null>(null);
  const [planForm, setPlanForm] = React.useState<Any>({
    code: '', name: '', description: '', monthlyPrice: '49.00',
    includedModules: ['INVENTORY', 'POS', 'CASH_REGISTER', 'QUOTES', 'CUSTOMERS', 'REPORTS'] as string[],
    features: ['Acceso multi-usuario', 'Reportes en tiempo real'] as string[],
    badge: '', isPopular: false, isActive: true, displayOrder: 10
  });
  const [newFeatureText, setNewFeatureText] = React.useState('');
  const [savingPlan, setSavingPlan] = React.useState(false);

  // Store Modules Customization Modal
  const [modulesModalTenant, setModulesModalTenant] = React.useState<Any|null>(null);
  const [tenantModulesData, setTenantModulesData] = React.useState<Any|null>(null);
  const [loadingTenantModules, setLoadingTenantModules] = React.useState(false);
  const [savingTenantModules, setSavingTenantModules] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      api('/api/platform/tenants').then(r => r.ok ? r.json() : []),
      api('/api/platform/stats').then(r => r.ok ? r.json() : {}),
      api('/api/platform/payments').then(r => r.ok ? r.json() : []),
      api('/api/platform/plans').then(r => r.ok ? r.json() : []),
      api('/api/platform/trials').then(r => r.ok ? r.json() : [])
    ]).then(([tenantsData, statsData, paymentsData, plansData, trialsData]) => {
      setTenants(tenantsData);
      setStats(statsData);
      setPayments(paymentsData);
      setPlans(plansData);
      setTrials(trialsData);
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

  function openCreatePlan() {
    setEditPlanModal({ isNew: true });
    setPlanForm({
      code: '',
      name: '',
      description: '',
      monthlyPrice: '49.00',
      includedModules: ['INVENTORY', 'POS', 'CASH_REGISTER', 'QUOTES', 'CUSTOMERS', 'REPORTS'],
      features: ['Control de inventario multi-sucursal', 'Facturación electrónica SRI ilimitada', 'Soporte prioritario'],
      badge: '',
      isPopular: false,
      isActive: true,
      displayOrder: (plans.length + 1) * 10
    });
    setNewFeatureText('');
  }

  function openEditPlan(plan: Any) {
    setEditPlanModal(plan);
    setPlanForm({
      code: plan.code,
      name: plan.name,
      description: plan.description || '',
      monthlyPrice: String(plan.monthly_price ?? plan.monthlyPrice ?? 49.00),
      includedModules: Array.isArray(plan.included_modules) ? plan.included_modules : (plan.includedModules || []),
      features: Array.isArray(plan.features) ? plan.features : [],
      badge: plan.badge || '',
      isPopular: !!plan.is_popular,
      isActive: plan.is_active !== false,
      displayOrder: plan.display_order ?? 10
    });
    setNewFeatureText('');
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planForm.code.trim() || !planForm.name.trim()) {
      notify?.('El código y el nombre del plan son obligatorios.');
      return;
    }
    setSavingPlan(true);
    const isNew = editPlanModal?.isNew;
    const url = isNew ? '/api/platform/plans' : `/api/platform/plans/${encodeURIComponent(planForm.code)}`;
    const method = isNew ? 'POST' : 'PUT';
    const r = await api(url, {
      method,
      body: JSON.stringify({
        code: planForm.code.toUpperCase().trim(),
        name: planForm.name.trim(),
        description: planForm.description,
        monthlyPrice: parseFloat(planForm.monthlyPrice) || 0,
        includedModules: planForm.includedModules,
        features: planForm.features,
        badge: planForm.badge.trim() || null,
        isPopular: planForm.isPopular,
        isActive: planForm.isActive,
        displayOrder: parseInt(String(planForm.displayOrder), 10) || 10
      })
    });
    setSavingPlan(false);
    if (r.ok) {
      notify?.(`✓ Plan "${planForm.name}" ${isNew ? 'creado' : 'actualizado'} con éxito.`);
      setEditPlanModal(null);
      load();
    } else {
      const err = await r.json().catch(() => ({}));
      notify?.(`Error al guardar el plan: ${err.message || r.statusText}`);
    }
  }

  async function handleDeletePlan(plan: Any) {
    if (!window.confirm(`¿Confirmas eliminar o desactivar el plan "${plan.name}" (${plan.code})? Si hay empresas suscritas, se desactivará automáticamente para no interrumpir su servicio.`)) return;
    const r = await api(`/api/platform/plans/${encodeURIComponent(plan.code)}`, { method: 'DELETE' });
    if (r.ok) {
      notify?.(`✓ Plan "${plan.name}" actualizado/eliminado con éxito.`);
      load();
    } else {
      notify?.('Error al eliminar el plan.');
    }
  }

  async function openModulesModal(t: Any) {
    setModulesModalTenant(t);
    setLoadingTenantModules(true);
    setTenantModulesData(null);
    try {
      const res = await api(`/api/platform/tenants/${t.id}/modules`);
      if (res.ok) {
        const data = await res.json();
        setTenantModulesData(data);
      } else {
        notify?.('Error al cargar módulos de la empresa.');
      }
    } catch {
      notify?.('Error de conexión al cargar módulos.');
    } finally {
      setLoadingTenantModules(false);
    }
  }

  function handleToggleTenantModule(moduleKey: string) {
    if (!tenantModulesData) return;
    const currentVal = !!tenantModulesData.modules?.[moduleKey];
    setTenantModulesData({
      ...tenantModulesData,
      modules: {
        ...tenantModulesData.modules,
        [moduleKey]: !currentVal
      }
    });
  }

  async function handleSaveTenantModules() {
    if (!modulesModalTenant || !tenantModulesData) return;
    setSavingTenantModules(true);
    const r = await api(`/api/platform/tenants/${modulesModalTenant.id}/modules`, {
      method: 'PUT',
      body: JSON.stringify(tenantModulesData.modules)
    });
    setSavingTenantModules(false);
    if (r.ok) {
      notify?.(`✓ Módulos de "${modulesModalTenant.name}" actualizados correctamente.`);
      setModulesModalTenant(null);
    } else {
      notify?.('Error al guardar configuración de módulos.');
    }
  }

  async function handleApplyPlanToTenant(planCode: string) {
    if (!modulesModalTenant) return;
    if (!window.confirm(`¿Aplicar los módulos predeterminados del plan "${planCode}" a la tienda "${modulesModalTenant.name}"? Los módulos activos se sincronizarán según la configuración de este plan.`)) return;
    setSavingTenantModules(true);
    const r = await api(`/api/platform/tenants/${modulesModalTenant.id}/apply-plan/${encodeURIComponent(planCode)}`, {
      method: 'POST'
    });
    setSavingTenantModules(false);
    if (r.ok) {
      const data = await r.json();
      setTenantModulesData(data);
      notify?.(`✓ Plan "${planCode}" aplicado exitosamente a "${modulesModalTenant.name}".`);
      load();
    } else {
      notify?.('Error al aplicar el plan.');
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

  function openConvertModal(t: Any) {
    setConvertModalTenant(t);
    const chosenPlanCode = (t.intended_plan || t.plan || 'PRO').toUpperCase();
    const foundPlan = plans.find(p => (p.code || '').toUpperCase() === chosenPlanCode);
    const fee = foundPlan ? String(foundPlan.monthly_price ?? foundPlan.monthlyPrice ?? 49.00) : '49.00';
    const planMods: string[] = foundPlan ? (foundPlan.included_modules || foundPlan.includedModules || []) : ['INVENTORY', 'POS', 'CASH_REGISTER', 'QUOTES', 'CUSTOMERS', 'REPORTS'];
    const modsMap: Record<string, boolean> = {};
    ALL_MODULES_DEF.forEach(m => {
      modsMap[m.key] = planMods.includes(m.key);
    });
    setConvertForm({
      planCode: chosenPlanCode,
      monthlyFee: fee,
      billingCycle: 'MONTHLY',
      modules: modsMap
    });
  }

  function handleConvertPlanChange(newCode: string) {
    const foundPlan = plans.find(p => (p.code || '').toUpperCase() === newCode.toUpperCase());
    const fee = foundPlan ? String(foundPlan.monthly_price ?? foundPlan.monthlyPrice ?? 49.00) : convertForm.monthlyFee;
    const planMods: string[] = foundPlan ? (foundPlan.included_modules || foundPlan.includedModules || []) : [];
    const modsMap: Record<string, boolean> = {};
    ALL_MODULES_DEF.forEach(m => {
      modsMap[m.key] = planMods.includes(m.key);
    });
    setConvertForm({
      ...convertForm,
      planCode: newCode,
      monthlyFee: fee,
      modules: modsMap
    });
  }

  async function submitConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!convertModalTenant) return;
    setConverting(true);
    const r = await api(`/api/platform/tenants/${convertModalTenant.id}/convert-trial`, {
      method: 'POST',
      body: JSON.stringify(convertForm)
    });
    setConverting(false);
    if (r.ok) {
      notify?.(`✓ Empresa "${convertModalTenant.name}" vinculada con éxito al plan ${convertForm.planCode} y activada formalmente.`);
      setConvertModalTenant(null);
      load();
    } else {
      notify?.('Error al convertir la empresa de prueba a plan definitivo.');
    }
  }

  function openExtendModal(t: Any) {
    setExtendModalTenant(t);
    setExtendDaysInput(15);
    setExtendNotes('');
  }

  async function submitExtendTrial(e: React.FormEvent) {
    e.preventDefault();
    if (!extendModalTenant) return;
    setExtending(true);
    const r = await api(`/api/platform/tenants/${extendModalTenant.id}/extend-trial`, {
      method: 'POST',
      body: JSON.stringify({ days: extendDaysInput, notes: extendNotes })
    });
    setExtending(false);
    if (r.ok) {
      notify?.(`✓ Período de prueba de "${extendModalTenant.name}" extendido por ${extendDaysInput} días adicionales.`);
      setExtendModalTenant(null);
      load();
    } else {
      notify?.('Error al extender días de prueba.');
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

  const filteredTrials = trials.filter(t => {
    if (trialFilter === 'EXPIRING_SOON') {
      if (t.daysRemaining < 0 || t.daysRemaining > 3) return false;
    } else if (trialFilter === 'HEALTHY') {
      if (t.daysRemaining <= 3) return false;
    } else if (trialFilter === 'EXPIRED') {
      if (t.daysRemaining >= 0) return false;
    }
    if (trialSearch.trim()) {
      const q = trialSearch.toLowerCase();
      const match = (t.name || '').toLowerCase().includes(q) ||
                    (t.contact_name || '').toLowerCase().includes(q) ||
                    (t.contact_email || '').toLowerCase().includes(q) ||
                    (t.contact_phone || '').toLowerCase().includes(q) ||
                    (t.intended_plan || '').toLowerCase().includes(q);
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
          className={`saas-nav-pill ${currentTab === 'platform-trials' ? 'active' : ''}`}
          onClick={() => switchTab('platform-trials')}
        >
          🧪 Empresas de Prueba ({trials.length})
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
          className={`saas-nav-pill ${currentTab === 'platform-plans' ? 'active' : ''}`}
          onClick={() => switchTab('platform-plans')}
        >
          🧩 Planes & Módulos ({plans.length})
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
          {currentTab === 'platform-plans' ? (
            <button className="primary-action" onClick={openCreatePlan} style={{ padding: '6px 14px', fontSize: '12px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              ＋ Nuevo Plan
            </button>
          ) : (
            <button className="primary-action" onClick={() => setShowCreateModal(true)} style={{ padding: '6px 14px', fontSize: '12px' }}>
              ＋ Nueva Empresa
            </button>
          )}
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
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.business_type || 'RETAIL'}</div>
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
                          <small style={{ color: 'var(--text-muted)' }}>en {getDaysUntilDue(t.days_until_due)} días</small>
                        </td>
                        <td>{getBillingBadge(t)}</td>
                        <td>
                          <div>{t.billing_contact_name || t.owner_name || 'Sin asignar'}</div>
                          <small style={{ color: 'var(--text-muted)' }}>{t.billing_contact_phone || t.owner_phone || 'Sin teléfono'}</small>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-action-pay" onClick={() => openRecordPayment(t)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                              💵 Cobrar
                            </button>
                            <button className="secondary-action" onClick={() => openEditRate(t)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                              ✏️ Tarifa
                            </button>
                            <button className="secondary-action" onClick={() => openModulesModal(t)} style={{ padding: '4px 8px', fontSize: '11px', color: '#4f46e5', borderColor: '#c7d2fe', background: '#eef2ff' }} title="Configurar módulos de esta tienda">
                              🧩 Módulos
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
                style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Stores Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando empresas...</div>
          ) : filteredTenants.length === 0 ? (
            <div className="panel empty" style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-surface)', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
              <h3>No se encontraron empresas</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Prueba con otro filtro o término de búsqueda.</p>
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
                          <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{t.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
                            {t.business_type || 'RETAIL'} · Plan <strong style={{ color: '#2563eb' }}>{t.plan || 'STARTER'}</strong>
                          </div>
                        </div>
                        {getBillingBadge(t)}
                      </div>

                      {/* Financial Details Box */}
                      <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Tarifa Asignada:</span>
                          <div>
                            <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                              ${Number(t.monthly_fee || 49).toFixed(2)}
                            </strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}> / {getCycleLabel(t.billing_cycle)}</span>
                            {Number(t.discount_percent || 0) > 0 && (
                              <span className="discount-tag" style={{ marginLeft: 4 }}>-{t.discount_percent}%</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: '11.5px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Próximo Cobro:</span>
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
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                          👤 {t.billing_contact_name || t.owner_name || 'Manager no asignado'}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginBottom: 4 }}>
                          ✉️ {t.billing_contact_email || t.owner_email || 'Sin correo'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>📞 {t.billing_contact_phone || t.owner_phone || t.store_phone || 'Sin teléfono'}</span>
                          {waUrl && (
                            <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#25d366', color: '#ffffff', padding: '3px 7px', borderRadius: 6, fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                              💬 WhatsApp
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Quick metrics summary */}
                      <div style={{ display: 'flex', gap: 8, fontSize: '11px', color: 'var(--text-muted)', marginBottom: 14 }}>
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
                      <button className="secondary-action" onClick={() => openModulesModal(t)} style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 700, color: '#4f46e5', borderColor: '#c7d2fe', background: '#eef2ff' }}>
                        🧩 Módulos
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
          TAB: TRIAL STORES / EMPRESAS DE PRUEBA (15 DÍAS)
          ========================================================================= */}
      {currentTab === 'platform-trials' && (
        <div>
          {/* KPI Header */}
          <div className="trial-kpi-grid">
            <div className="platform-kpi-card" onClick={() => setTrialFilter('ALL')} style={{ cursor: 'pointer' }}>
              <small>Empresas en Prueba</small>
              <strong style={{ color: '#4338ca' }}>{trials.length}</strong>
              <span>Evaluando la plataforma</span>
            </div>
            <div className="platform-kpi-card" onClick={() => setTrialFilter('HEALTHY')} style={{ cursor: 'pointer' }}>
              <small>Pruebas Saludables</small>
              <strong style={{ color: '#059669' }}>{trials.filter(t => t.daysRemaining > 3).length}</strong>
              <span>Más de 3 días restantes</span>
            </div>
            <div className="platform-kpi-card" onClick={() => setTrialFilter('EXPIRING_SOON')} style={{ cursor: 'pointer' }}>
              <small>Por Vencer (≤ 3 Días)</small>
              <strong style={{ color: '#d97706' }}>{trials.filter(t => t.daysRemaining >= 0 && t.daysRemaining <= 3).length}</strong>
              <span>Contactar para atar plan</span>
            </div>
            <div className="platform-kpi-card" onClick={() => setTrialFilter('EXPIRED')} style={{ cursor: 'pointer' }}>
              <small>Pruebas Vencidas</small>
              <strong style={{ color: '#dc2626' }}>{trials.filter(t => t.daysRemaining < 0).length}</strong>
              <span>Requieren plan o extensión</span>
            </div>
          </div>

          {/* Trial Filter and Search Toolbar */}
          <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="filter-group" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {[
                ['ALL', `Todas (${trials.length})`],
                ['EXPIRING_SOON', `Por Vencer (${trials.filter(t => t.daysRemaining >= 0 && t.daysRemaining <= 3).length})`],
                ['HEALTHY', `En Curso (${trials.filter(t => t.daysRemaining > 3).length})`],
                ['EXPIRED', `Vencidas (${trials.filter(t => t.daysRemaining < 0).length})`]
              ].map(([k, label]) => (
                <button
                  key={k}
                  className={trialFilter === k ? 'btn-filter active' : 'btn-filter'}
                  onClick={() => setTrialFilter(k)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: trialFilter === k ? '1px solid #4338ca' : '1px solid #cbd5e1',
                    background: trialFilter === k ? '#eef2ff' : '#ffffff',
                    color: trialFilter === k ? '#4338ca' : '#475569',
                    fontWeight: trialFilter === k ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Buscar por tienda, gerente, email, teléfono..."
                value={trialSearch}
                onChange={e => setTrialSearch(e.target.value)}
                style={{ width: '280px', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '12.5px' }}
              />
              <button className="secondary-action" onClick={load} style={{ padding: '6px 12px', fontSize: '12px' }}>
                🔄 Refrescar
              </button>
            </div>
          </div>

          {/* Trial Stores Table */}
          <div className="panel table-panel">
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>🧪 Directorio de Empresas en Período de Prueba (15 Días)</h3>
                <p className="catalog-toolbar-p" style={{ margin: '4px 0 0 0' }}>
                  Tiendas evaluando la plataforma con <b>todos los módulos y servicios habilitados</b>. Gestiona la extensión de días o átalas a su plan definitivo.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Empresa & Negocio</th>
                    <th>Plan de Interés</th>
                    <th>Días Restantes</th>
                    <th>Fin de Prueba</th>
                    <th>Actividad en Prueba</th>
                    <th>Gerente / Contacto</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrials.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No hay empresas de prueba registradas con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    filteredTrials.map(t => {
                      const days = t.daysRemaining;
                      const isExpired = days < 0;
                      const isWarning = days >= 0 && days <= 3;
                      const pillClass = isExpired ? 'expired' : isWarning ? 'warning' : 'healthy';

                      const cleanPhone = (t.contact_phone || t.tenant_phone || '').replace(/[^0-9]/g, '');
                      const waMsg = encodeURIComponent(`Hola ${t.contact_name || 'estimado cliente'}, te saludamos de la administración de FixmeTiendas. Vemos que estás en tu período de prueba para tu tienda "${t.name}". ¿Qué tal ha sido tu experiencia con la plataforma y qué plan o módulos te gustaría contratar?`);
                      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMsg}` : '';

                      return (
                        <tr key={t.id}>
                          <td>
                            <strong>{t.name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {t.business_type || 'RETAIL'} · Creada: {t.created_at ? String(t.created_at).slice(0, 10) : '-'}
                            </div>
                          </td>
                          <td>
                            <span className={`plan-chip plan-chip-${(t.intended_plan || t.plan || 'pro').toLowerCase()}`}>
                              {t.intended_plan || t.plan || 'PRO'}
                            </span>
                            <div style={{ fontSize: '10.5px', color: '#059669', fontWeight: 600, marginTop: 2 }}>
                              ✓ 9 Módulos Activos
                            </div>
                          </td>
                          <td>
                            <span className={`trial-status-pill ${pillClass}`}>
                              {isExpired
                                ? `🚫 Vencida (${Math.abs(days)}d)`
                                : isWarning
                                ? `⚠️ ${days === 0 ? 'Vence hoy' : `${days}d restantes`}`
                                : `⏱️ ${days}d restantes`}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, fontSize: '12px' }}>
                              {t.trial_ends_at ? String(t.trial_ends_at).slice(0, 10) : '-'}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              <span className="trial-metric-tag" title="Productos agregados">
                                📦 {t.product_count || 0} prod.
                              </span>
                              <span className="trial-metric-tag" title="Ventas realizadas">
                                🛒 {t.sale_count || 0} ventas
                              </span>
                              <span className="trial-metric-tag" title="Órdenes de servicio">
                                🛠️ {t.work_order_count || 0} ord.
                              </span>
                              <span className="trial-metric-tag" title="Clientes registrados">
                                👥 {t.customer_count || 0} cli.
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{t.contact_name || 'Sin nombre'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.contact_email || '-'}</div>
                            <div style={{ fontSize: '11px', color: '#2563eb' }}>{t.contact_phone || '-'}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button
                                className="primary-action"
                                onClick={() => openConvertModal(t)}
                                style={{ padding: '5px 11px', fontSize: '11.5px', background: 'linear-gradient(135deg, #4f46e5, #4338ca)', whiteSpace: 'nowrap' }}
                                title="Atar empresa a plan y módulos definitivos"
                              >
                                ⚡ Atar a Plan
                              </button>
                              <button
                                className="secondary-action"
                                onClick={() => openExtendModal(t)}
                                style={{ padding: '5px 9px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                                title="Extender período de prueba"
                              >
                                ⏱️ Extender
                              </button>
                              <button
                                className="secondary-action"
                                onClick={() => openModulesModal(t)}
                                style={{ padding: '5px 9px', fontSize: '11.5px', color: '#4f46e5', borderColor: '#c7d2fe', background: '#eef2ff' }}
                                title="Configurar módulos de esta tienda"
                              >
                                🧩 Módulos
                              </button>
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: '#25d366',
                                    color: '#fff',
                                    padding: '5px 9px',
                                    borderRadius: 6,
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    textDecoration: 'none'
                                  }}
                                  title="Enviar WhatsApp al gerente"
                                >
                                  💬 WA
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
                style={{ width: '280px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12.5px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.business_type || 'RETAIL'}</div>
                        </td>
                        <td>
                          <span className={`plan-chip plan-chip-${(t.plan || 'starter').toLowerCase()}`}>
                            {t.plan || 'STARTER'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                            ${Number(t.monthly_fee || 49).toFixed(2)}
                          </strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}> / mes</span>
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
                          <small style={{ color: 'var(--text-muted)' }}>{t.billing_contact_phone || t.owner_phone || '-'}</small>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="primary-action"
                              onClick={() => openEditRate(t)}
                              style={{ padding: '5px 10px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                            >
                              ✏️ Modificar Tarifa
                            </button>
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => openModulesModal(t)}
                              style={{ padding: '5px 10px', fontSize: '11.5px', whiteSpace: 'nowrap', color: '#4f46e5', borderColor: '#c7d2fe', background: '#eef2ff', fontWeight: 700 }}
                            >
                              🧩 Módulos
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
                <div style={{ background: 'var(--bg-subtle)', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <small style={{ color: 'var(--text-secondary)', fontSize: '11px', display: 'block' }}>Total Recibos Emitidos</small>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '18px' }}>{payments.length}</strong>
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
                style={{ width: '320px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12.5px' }}
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
                        <strong style={{ color: 'var(--text-primary)' }}>{p.tenant_name}</strong>
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
                        <code style={{ fontSize: '11.5px', background: 'var(--bg-subtle)', padding: '2px 5px', borderRadius: 4 }}>
                          {p.reference || 'Sin ref'}
                        </code>
                      </td>
                      <td>
                        <strong style={{ color: '#059669', fontSize: '14px' }}>
                          ${Number(p.amount).toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        <small style={{ color: 'var(--text-muted)' }}>{p.recorded_by || 'SaaS Owner'}</small>
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
          TAB: PLANES Y MÓDULOS DE SUSCRIPCIÓN SAAS
          ========================================================================= */}
      {currentTab === 'platform-plans' && (
        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>🧩 Catálogo de Planes & Paquetes de Servicio SaaS</h3>
                <p className="catalog-toolbar-p" style={{ margin: '4px 0 0 0' }}>
                  Configura los planes comerciales para las tiendas, sus tarifas mensuales y los módulos activos por defecto.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="primary-action"
                  onClick={openCreatePlan}
                  style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                >
                  ＋ Crear Nuevo Plan
                </button>
              </div>
            </div>
          </div>

          {/* Grid of Plans */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: 24 }}>
            {plans.map(p => {
              const activeCount = tenants.filter(t => (t.plan || '').toUpperCase() === (p.code || '').toUpperCase()).length;
              const incMods: string[] = Array.isArray(p.included_modules) ? p.included_modules : (p.includedModules || []);
              const feats: string[] = Array.isArray(p.features) ? p.features : [];

              return (
                <div
                  key={p.code}
                  style={{
                    background: 'var(--bg-surface)',
                    borderRadius: '16px',
                    border: p.is_popular ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    padding: '24px',
                    boxShadow: p.is_popular ? '0 10px 25px -5px rgba(99, 102, 241, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                  }}
                >
                  {p.is_popular && (
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '24px',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '4px 12px',
                      borderRadius: '20px',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }}>
                      ★ Más Popular
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</h3>
                        {p.badge && (
                          <span style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <code style={{ fontSize: '11px', color: '#6366f1', fontWeight: 700, background: '#eef2ff', padding: '2px 6px', borderRadius: '4px' }}>
                        CÓDIGO: {p.code}
                      </code>
                    </div>
                    <div>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: p.is_active !== false ? '#dcfce7' : '#fee2e2',
                        color: p.is_active !== false ? '#15803d' : '#b91c1c'
                      }}>
                        {p.is_active !== false ? '● Activo' : '○ Inactivo'}
                      </span>
                    </div>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 16px 0', minHeight: '38px', lineHeight: 1.4 }}>
                    {p.description || 'Sin descripción'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                    <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)' }}>
                      ${Number(p.monthly_price ?? p.monthlyPrice ?? 0).toFixed(2)}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>/ mes + IVA</span>
                  </div>

                  {/* Active subscribers badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-subtle)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    marginBottom: 16,
                    border: '1px solid #f1f5f9'
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Empresas suscritas:</span>
                    <strong style={{ fontSize: '13px', color: activeCount > 0 ? '#0f172a' : '#94a3b8' }}>
                      🏢 {activeCount} {activeCount === 1 ? 'empresa' : 'empresas'}
                    </strong>
                  </div>

                  {/* Included Modules Section */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span>MÓDULOS ACTIVOS ({incMods.length}/{ALL_MODULES_DEF.length}):</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {ALL_MODULES_DEF.map(mod => {
                        const isInc = incMods.includes(mod.key);
                        return (
                          <span
                            key={mod.key}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontWeight: 600,
                              background: isInc ? (mod.key === 'APIS' ? '#ede9fe' : '#eff6ff') : '#f8fafc',
                              color: isInc ? (mod.key === 'APIS' ? '#6d28d9' : '#1d4ed8') : '#94a3b8',
                              border: isInc ? (mod.key === 'APIS' ? '1px solid #c4b5fd' : '1px solid #bfdbfe') : '1px solid #e2e8f0',
                              opacity: isInc ? 1 : 0.6
                            }}
                            title={mod.desc}
                          >
                            <span>{mod.icon}</span>
                            <span>{mod.name.split(' ')[0]}</span>
                            {isInc ? '✓' : '✕'}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Commercial Features */}
                  {feats.length > 0 && (
                    <div style={{ marginBottom: 20, flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        BENEFICIOS INCLUIDOS:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {feats.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 'auto' }}>
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => openEditPlan(p)}
                      style={{ flex: 1, padding: '7px 12px', fontSize: '12px', textAlign: 'center' }}
                    >
                      ✏️ Editar Plan
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => handleDeletePlan(p)}
                      style={{ padding: '7px 12px', fontSize: '12px', color: '#ef4444' }}
                      title="Eliminar o desactivar plan"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
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
                <small style={{ color: 'var(--text-muted)' }}>Empresa: <strong>{editRateModal.name}</strong></small>
              </div>
              <button className="close-btn" onClick={() => setEditRateModal(null)}>✕</button>
            </div>
            <form onSubmit={submitRate}>
              <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8, marginBottom: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cobro neto proyectado:</span>
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
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Plan Asignado</span>
                  <select
                    value={rateForm.plan}
                    onChange={e => setRateForm({ ...rateForm, plan: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Próxima Fecha de Cobro</span>
                  <input
                    type="date"
                    value={rateForm.nextBillingDate}
                    onChange={e => setRateForm({ ...rateForm, nextBillingDate: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginBottom: 10 }}>
                <small style={{ fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Contacto de Pagos / Cobranza</small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Nombre Contacto Cobranzas</span>
                  <input
                    placeholder="Ej: Ing. Marco Pazmiño"
                    value={rateForm.billingContactName}
                    onChange={e => setRateForm({ ...rateForm, billingContactName: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Teléfono Cobranzas</span>
                  <input
                    placeholder="0991234567"
                    value={rateForm.billingContactPhone}
                    onChange={e => setRateForm({ ...rateForm, billingContactPhone: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Email Cobranzas</span>
                  <input
                    type="email"
                    placeholder="contabilidad@tienda.com"
                    value={rateForm.billingContactEmail}
                    onChange={e => setRateForm({ ...rateForm, billingContactEmail: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
              </div>

              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Notas Administrativas / Condiciones del Acuerdo</span>
                <input
                  placeholder="Ej: Precio especial pactado por pago semestral anticipado..."
                  value={rateForm.adminNotes}
                  onChange={e => setRateForm({ ...rateForm, adminNotes: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
              <div style={{ background: 'var(--bg-subtle)', padding: 10, borderRadius: 8, marginBottom: 14 }}>
                <strong>Tienda: {payModal.name}</strong>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
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
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 10 }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Método de Pago *</span>
                <select
                  value={payForm.paymentMethod}
                  onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Notas Privadas del Cobro</span>
                <input
                  type="text"
                  placeholder="Observaciones de pago..."
                  value={payForm.notes}
                  onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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

            <div id="printable-saas-receipt" className="saas-receipt-container">
              <div className="saas-receipt-stamp">PAGADO</div>
              <div className="saas-receipt-header">
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
                  FixmeTiendas SaaS Platform
                </div>
                <h2 className="saas-receipt-title">RECIBO DE MENSUALIDAD</h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Comprobante N°: <strong>{String(receiptModal.id).slice(0, 13).toUpperCase()}</strong>
                </div>
              </div>

              <div className="saas-receipt-row">
                <span style={{ color: 'var(--text-muted)' }}>Empresa Cliente:</span>
                <strong>{receiptModal.tenant_name || 'Tienda Afiliada'}</strong>
              </div>
              <div className="saas-receipt-row">
                <span style={{ color: 'var(--text-muted)' }}>Plan Contratado:</span>
                <span>Plan {receiptModal.plan || 'STARTER'}</span>
              </div>
              <div className="saas-receipt-row">
                <span style={{ color: 'var(--text-muted)' }}>Período Cubierto:</span>
                <strong>{receiptModal.period_covered}</strong>
              </div>
              <div className="saas-receipt-row">
                <span style={{ color: 'var(--text-muted)' }}>Fecha de Emisión:</span>
                <span>{String(receiptModal.payment_date || new Date().toISOString()).slice(0, 10)}</span>
              </div>
              <div className="saas-receipt-row">
                <span style={{ color: 'var(--text-muted)' }}>Forma de Pago:</span>
                <span>{receiptModal.payment_method}</span>
              </div>
              <div className="saas-receipt-row">
                <span style={{ color: 'var(--text-muted)' }}>Referencia / Banco:</span>
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
                onClick={() => printTicketElement('printable-saas-receipt')}
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
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Ciclo de Facturación</span>
                  <select
                    value={createForm.billingCycle}
                    onChange={e => setCreateForm({ ...createForm, billingCycle: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginBottom: 10 }}>
                <small style={{ fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Datos del Gerente / Manager Inicial</small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Nombres y Apellidos del Gerente *</span>
                  <input
                    placeholder="Ej: Roberto Mendoza"
                    value={createForm.ownerName}
                    onChange={e => setCreateForm({ ...createForm, ownerName: e.target.value })}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Teléfono / WhatsApp</span>
                  <input
                    placeholder="0991234567"
                    value={createForm.phone}
                    onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <small style={{ color: 'var(--text-muted)' }}>
                    Plan {selectedTenant.plan} · Tarifa: ${Number(selectedTenant.monthly_fee || 49).toFixed(2)}/mes
                  </small>
                  <button
                    type="button"
                    onClick={() => { const t = selectedTenant; setSelectedTenant(null); openModulesModal(t); }}
                    style={{
                      background: '#eef2ff',
                      color: '#4f46e5',
                      border: '1px solid #c7d2fe',
                      borderRadius: 6,
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    🧩 Configurar Módulos del Plan
                  </button>
                </div>
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
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Recibos registrados para esta tienda:</span>
                  <button className="btn-action-pay" onClick={() => openRecordPayment(selectedTenant)} style={{ fontSize: '11px', padding: '4px 8px' }}>
                    ＋ Registrar Cobro
                  </button>
                </div>
                {tenantPayments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '12px' }}>
                    No hay pagos registrados para esta empresa.
                  </div>
                ) : (
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid #e2e8f0' }}>
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
                            <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{p.reference || '-'}</td>
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
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid #e2e8f0' }}>
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

      {/* =========================================================================
          MODAL: EDIT OR CREATE PLAN
          ========================================================================= */}
      {editPlanModal && (
        <div className="modal-backdrop" onClick={() => setEditPlanModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>{editPlanModal.isNew ? '＋ Crear Nuevo Plan de Suscripción' : `✏️ Editar Plan: ${planForm.name}`}</h3>
                <small style={{ color: 'var(--text-muted)' }}>Configura tarifas comerciales y módulos para FixmeTiendas SaaS</small>
              </div>
              <button className="close-btn" onClick={() => setEditPlanModal(null)}>✕</button>
            </div>

            <form onSubmit={handleSavePlan}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Código Único del Plan *</span>
                  <input
                    type="text"
                    placeholder="Ej: ENTERPRISE"
                    value={planForm.code}
                    onChange={e => setPlanForm({ ...planForm, code: e.target.value.toUpperCase() })}
                    disabled={!editPlanModal.isNew}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', textTransform: 'uppercase' }}
                  />
                  {!editPlanModal.isNew && <small style={{ color: 'var(--text-muted)' }}>El código no puede cambiarse una vez creado.</small>}
                </label>

                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Nombre Comercial *</span>
                  <input
                    type="text"
                    placeholder="Ej: Plan Enterprise Digital"
                    value={planForm.name}
                    onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>

                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Precio Mensual ($ USD) *</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={planForm.monthlyPrice}
                    onChange={e => setPlanForm({ ...planForm, monthlyPrice: e.target.value })}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>

                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Badge / Etiqueta Visual</span>
                  <input
                    type="text"
                    placeholder="Ej: RECOMENDADO, MÁS VENDIDO"
                    value={planForm.badge}
                    onChange={e => setPlanForm({ ...planForm, badge: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>

                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Descripción Comercial</span>
                  <textarea
                    rows={2}
                    placeholder="Breve resumen del tipo de empresa al que va dirigido este plan..."
                    value={planForm.description}
                    onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical' }}
                  />
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, gridColumn: '1 / -1', padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={planForm.isPopular}
                      onChange={e => setPlanForm({ ...planForm, isPopular: e.target.checked })}
                    />
                    <strong>Destacar como Más Popular</strong>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={planForm.isActive}
                      onChange={e => setPlanForm({ ...planForm, isActive: e.target.checked })}
                    />
                    <strong>Plan Activo para Venta</strong>
                  </label>
                </div>
              </div>

              {/* Módulos que incluye el plan */}
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Módulos Habilitados en este Plan:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, background: 'var(--bg-subtle)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  {ALL_MODULES_DEF.map(mod => {
                    const isChecked = planForm.includedModules.includes(mod.key);
                    return (
                      <label
                        key={mod.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: '12px',
                          cursor: 'pointer',
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: isChecked ? (mod.key === 'APIS' ? '#ede9fe' : '#ffffff') : '#f1f5f9',
                          border: isChecked ? (mod.key === 'APIS' ? '1px solid #8b5cf6' : '1px solid #3b82f6') : '1px solid transparent',
                          fontWeight: isChecked ? 700 : 500
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const cur = [...planForm.includedModules];
                            if (e.target.checked) {
                              if (!cur.includes(mod.key)) cur.push(mod.key);
                            } else {
                              const idx = cur.indexOf(mod.key);
                              if (idx >= 0) cur.splice(idx, 1);
                            }
                            setPlanForm({ ...planForm, includedModules: cur });
                          }}
                        />
                        <span>{mod.icon}</span>
                        <span>{mod.name.split(' ')[0]}</span>
                        {mod.key === 'APIS' && <span style={{ fontSize: '10px', color: '#7c3aed', background: '#f5f3ff', padding: '1px 4px', borderRadius: 4 }}>API</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Features list */}
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Características y Beneficios Promocionales:
                </span>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Ej: Pasarela de pagos PayPhone y DeUna incluida"
                    value={newFeatureText}
                    onChange={e => setNewFeatureText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newFeatureText.trim()) {
                          setPlanForm({ ...planForm, features: [...planForm.features, newFeatureText.trim()] });
                          setNewFeatureText('');
                        }
                      }
                    }}
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontSize: '12.5px' }}
                  />
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      if (newFeatureText.trim()) {
                        setPlanForm({ ...planForm, features: [...planForm.features, newFeatureText.trim()] });
                        setNewFeatureText('');
                      }
                    }}
                    style={{ padding: '8px 14px', fontSize: '12px' }}
                  >
                    ＋ Agregar
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {planForm.features.map((f: string, idx: number) => (
                    <span
                      key={idx}
                      style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '4px 10px',
                        borderRadius: 16,
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {f}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...planForm.features];
                          updated.splice(idx, 1);
                          setPlanForm({ ...planForm, features: updated });
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0, fontSize: '12px', fontWeight: 700 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                <button type="button" className="secondary-action" onClick={() => setEditPlanModal(null)}>Cancelar</button>
                <button type="submit" className="primary-action" disabled={savingPlan}>
                  {savingPlan ? 'Guardando Plan...' : (editPlanModal.isNew ? '＋ Guardar Nuevo Plan' : '✓ Guardar Cambios')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: TENANT MODULES OVERRIDE & PLAN PRESET
          ========================================================================= */}
      {modulesModalTenant && (
        <div className="modal-backdrop" onClick={() => setModulesModalTenant(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>🧩 Módulos Activos de la Tienda</h3>
                <small style={{ color: 'var(--text-muted)' }}>Empresa: <strong>{modulesModalTenant.name}</strong> · Plan Actual: <strong style={{ color: '#2563eb' }}>{modulesModalTenant.plan || 'STARTER'}</strong></small>
              </div>
              <button className="close-btn" onClick={() => setModulesModalTenant(null)}>✕</button>
            </div>

            {loadingTenantModules ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando configuración de módulos...</div>
            ) : tenantModulesData ? (
              <div>
                {/* Fast Preset Box */}
                <div style={{ background: 'var(--bg-subtle)', padding: 14, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                    ⚡ Aplicar Preset de Módulos por Plan:
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      id="planSelectPreset"
                      defaultValue={tenantModulesData.currentPlan || modulesModalTenant.plan || 'PRO'}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '13px' }}
                    >
                      {plans.map(p => (
                        <option key={p.code} value={p.code}>
                          Plan {p.name} (${Number(p.monthly_price ?? p.monthlyPrice ?? 0).toFixed(2)}/mes)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => {
                        const sel = (document.getElementById('planSelectPreset') as HTMLSelectElement)?.value;
                        if (sel) handleApplyPlanToTenant(sel);
                      }}
                      disabled={savingTenantModules}
                      style={{ padding: '7px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                      {savingTenantModules ? 'Aplicando...' : '⚡ Sincronizar Módulos'}
                    </button>
                  </div>
                  <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 6, fontSize: '11px' }}>
                    Sincroniza en un clic los módulos contratados y actualiza el plan asignado a la empresa.
                  </small>
                </div>

                {/* Individual Module Toggles */}
                <div style={{ maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    PERSONALIZACIÓN INDIVIDUAL DE MÓDULOS:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ALL_MODULES_DEF.map(mod => {
                      const isEnabled = !!tenantModulesData.modules?.[mod.key];
                      return (
                        <div
                          key={mod.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: isEnabled ? (mod.key === 'APIS' ? '#f5f3ff' : '#eff6ff') : '#f8fafc',
                            border: isEnabled ? (mod.key === 'APIS' ? '1px solid #c4b5fd' : '1px solid #bfdbfe') : '1px solid #e2e8f0',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '22px' }}>{mod.icon}</span>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{mod.name}</strong>
                                {mod.key === 'APIS' && (
                                  <span style={{ background: '#7c3aed', color: '#ffffff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                                    PAGOS & APIS
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 2 }}>{mod.desc}</div>
                            </div>
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={() => handleToggleTenantModule(mod.key)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 20,
                                fontSize: '12px',
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                background: isEnabled ? '#10b981' : '#cbd5e1',
                                color: '#ffffff',
                                minWidth: '80px',
                                transition: 'background 0.2s ease'
                              }}
                            >
                              {isEnabled ? '✓ Activo' : '✕ Inactivo'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                  <button type="button" className="secondary-action" onClick={() => setModulesModalTenant(null)}>Cancelar</button>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={handleSaveTenantModules}
                    disabled={savingTenantModules}
                    style={{ padding: '8px 18px', fontSize: '13px' }}
                  >
                    {savingTenantModules ? 'Guardando...' : '✓ Guardar Cambios de Módulos'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CONVERT TRIAL TO DEFINITIVE PLAN & MODULES
          ========================================================================= */}
      {convertModalTenant && (
        <div className="modal-backdrop" onClick={() => setConvertModalTenant(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CONVERSIÓN DE PRUEBA A SUSCRIPCIÓN FORMAL
                </span>
                <h3 style={{ margin: '2px 0 0' }}>⚡ Atar a Plan Definitivo: {convertModalTenant.name}</h3>
                <small style={{ color: 'var(--text-muted)' }}>
                  Plan de interés durante la prueba: <strong>{convertModalTenant.intended_plan || 'PRO'}</strong>
                </small>
              </div>
              <button className="close-btn" onClick={() => setConvertModalTenant(null)}>✕</button>
            </div>

            <form onSubmit={submitConvert}>
              <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8, marginBottom: 14, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  🏢 Datos de la Empresa:
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Gerente: <strong>{convertModalTenant.contact_name || 'Sin nombre'}</strong> ({convertModalTenant.contact_email || '-'}) · Tel: {convertModalTenant.contact_phone || '-'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Plan Definitivo *</span>
                  <select
                    value={convertForm.planCode}
                    onChange={e => handleConvertPlanChange(e.target.value)}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontWeight: 700 }}
                  >
                    {plans.map(p => (
                      <option key={p.code} value={p.code}>
                        Plan {p.name} (${Number(p.monthly_price ?? p.monthlyPrice ?? 0).toFixed(2)}/mes)
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Tarifa Mensual Pactada ($ USD) *</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={convertForm.monthlyFee}
                    onChange={e => setConvertForm({ ...convertForm, monthlyFee: e.target.value })}
                    required
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>

                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Ciclo de Facturación *</span>
                  <select
                    value={convertForm.billingCycle}
                    onChange={e => setConvertForm({ ...convertForm, billingCycle: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                  >
                    <option value="MONTHLY">Mensual (Cobro cada 30 días)</option>
                    <option value="QUARTERLY">Trimestral</option>
                    <option value="SEMIANNUAL">Semestral</option>
                    <option value="ANNUAL">Anual</option>
                  </select>
                </label>
              </div>

              {/* Modules selection */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Módulos Habilitados para esta Empresa:
                  </span>
                  <small style={{ color: '#4f46e5', fontWeight: 600 }}>
                    {Object.values(convertForm.modules || {}).filter(Boolean).length} de {ALL_MODULES_DEF.length} activos
                  </small>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 6, maxHeight: 180, overflowY: 'auto', background: 'var(--bg-subtle)', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                  {ALL_MODULES_DEF.map(m => {
                    const isChecked = !!convertForm.modules?.[m.key];
                    return (
                      <label
                        key={m.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          padding: '5px 8px',
                          borderRadius: 6,
                          background: isChecked ? (m.key === 'APIS' ? '#ede9fe' : '#ffffff') : '#f1f5f9',
                          border: isChecked ? (m.key === 'APIS' ? '1px solid #8b5cf6' : '1px solid #3b82f6') : '1px solid transparent',
                          fontWeight: isChecked ? 700 : 500
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => setConvertForm({
                            ...convertForm,
                            modules: {
                              ...convertForm.modules,
                              [m.key]: e.target.checked
                            }
                          })}
                        />
                        <span>{m.icon}</span>
                        <span>{m.name.split(' ')[0]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: 6, fontSize: '11.5px', color: '#166534', lineHeight: 1.4, marginBottom: 16 }}>
                ✓ Al convertir, la tienda dejará el estado de prueba y pasará a ser una <b>Empresa Activa Definitiva</b>. Su fecha de próximo cobro se programará automáticamente en 30 días y se aplicarán los módulos seleccionados.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="secondary-action" onClick={() => setConvertModalTenant(null)}>Cancelar</button>
                <button type="submit" className="primary-action" disabled={converting} style={{ background: 'linear-gradient(135deg, #4f46e5, #4338ca)', padding: '8px 20px', fontSize: '13px' }}>
                  {converting ? 'Activando...' : '⚡ Confirmar y Atar a Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EXTEND TRIAL DAYS
          ========================================================================= */}
      {extendModalTenant && (
        <div className="modal-backdrop" onClick={() => setExtendModalTenant(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  EXTENSIÓN DE PRUEBA
                </span>
                <h3 style={{ margin: '2px 0 0' }}>⏱️ Extender Prueba: {extendModalTenant.name}</h3>
              </div>
              <button className="close-btn" onClick={() => setExtendModalTenant(null)}>✕</button>
            </div>

            <form onSubmit={submitExtendTrial}>
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: '12px', color: '#92400e' }}>
                Fin actual de prueba: <strong>{extendModalTenant.trial_ends_at ? String(extendModalTenant.trial_ends_at).slice(0, 10) : 'Pendiente'}</strong>
                <div style={{ marginTop: 4 }}>
                  Días restantes actuales: <strong>{extendModalTenant.daysRemaining} días</strong>
                </div>
              </div>

              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Días adicionales a conceder:
                </span>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {[7, 15, 30].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setExtendDaysInput(d)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: 6,
                        border: extendDaysInput === d ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                        background: extendDaysInput === d ? '#eef2ff' : '#ffffff',
                        color: extendDaysInput === d ? '#4338ca' : '#1e293b',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      +{d} días
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={extendDaysInput}
                  onChange={e => setExtendDaysInput(parseInt(e.target.value, 10) || 1)}
                  required
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontWeight: 700 }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Motivo / Notas de la Extensión (opcional)</span>
                <input
                  type="text"
                  placeholder="Ej: Solicitó más tiempo para capacitar a su personal..."
                  value={extendNotes}
                  onChange={e => setExtendNotes(e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="secondary-action" onClick={() => setExtendModalTenant(null)}>Cancelar</button>
                <button type="submit" className="primary-action" disabled={extending} style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', padding: '8px 18px', fontSize: '13px' }}>
                  {extending ? 'Extendiendo...' : `⏱️ Confirmar +${extendDaysInput} Días`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


export default PlatformAdministration;
