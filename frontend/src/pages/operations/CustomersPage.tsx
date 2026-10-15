import React from 'react';
import { Any, getBranchId, Table } from '../../sharedConfig';
import { PageHeader, KpiStrip, FilterTabs, IconButton } from '../../sharedLayout';
import { SkeletonTable } from '../../components/ui/ModernUiKit';
import { RefreshCw, Search, Plus, Download } from 'lucide-react';

export function Customers({api, notify, go, branchId: propBranchId}:{api:(u:string,o?:RequestInit)=>Promise<Response>, notify:(s:string)=>void, go?:(page:string)=>void, branchId?: string}){
const branchId = propBranchId || getBranchId();
  const [rows, setRows] = React.useState<Any[]>([]);
  const [stats, setStats] = React.useState({ totalCustomers: 0, vipCustomers: 0, totalSalesVolume: 0, activeRepairCustomers: 0 });
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState('ALL');

  // Cuentas por Cobrar & Créditos
  const [customerTab, setCustomerTab] = React.useState<'CUSTOMERS' | 'RECEIVABLES'>('CUSTOMERS');
  const [receivables, setReceivables] = React.useState<Any[]>([]);
  const [receivablesFilter, setReceivablesFilter] = React.useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('ALL');
  const [loadingReceivables, setLoadingReceivables] = React.useState(false);
  const [searchReceivables, setSearchReceivables] = React.useState('');
  const [payModalRec, setPayModalRec] = React.useState<Any | null>(null);
  const [payAmount, setPayAmount] = React.useState('');
  const [payMethod, setPayMethod] = React.useState('CASH');
  const [payNotes, setPayNotes] = React.useState('');
  const [payingBusy, setPayingBusy] = React.useState(false);
  const [historyModalRec, setHistoryModalRec] = React.useState<Any | null>(null);
  const [loadingHistoryRec, setLoadingHistoryRec] = React.useState(false);

  const loadReceivables = React.useCallback(async () => {
    setLoadingReceivables(true);
    try {
      const res = await api(`/api/receivables?branchId=${branchId}`);
      if (res.ok) {
        setReceivables(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReceivables(false);
    }
  }, [api]);

  async function submitReceivablePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payModalRec) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Ingresa un monto válido mayor a 0');
      return;
    }
    if (amt > Number(payModalRec.pending_amount || 0) + 0.001) {
      alert(`El monto no puede superar el saldo pendiente de $${Number(payModalRec.pending_amount).toFixed(2)}`);
      return;
    }
    setPayingBusy(true);
    try {
      const res = await api(`/api/receivables/${payModalRec.id}/pay?branchId=${branchId}`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          paymentMethod: payMethod,
          notes: payNotes.trim()
        })
      });
      if (res.ok) {
        const data = await res.json();
        notify(`¡Abono de $${amt.toFixed(2)} registrado con éxito! Saldo restante: $${Number(data.pending_amount || 0).toFixed(2)}`);
        setPayModalRec(null);
        setPayAmount('');
        setPayNotes('');
        loadReceivables();
      } else {
        const err = await res.text();
        alert('Error al registrar abono: ' + err);
      }
    } catch (err: any) {
      alert('Error de conexión: ' + err.message);
    } finally {
      setPayingBusy(false);
    }
  }

  async function openReceivableHistory(rec: Any) {
    setHistoryModalRec(rec);
    setLoadingHistoryRec(true);
    try {
      const res = await api(`/api/receivables/${rec.id}`);
      if (res.ok) {
        setHistoryModalRec(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistoryRec(false);
    }
  }

  function sendWhatsAppReceivableReminder(rec: Any) {
    const phone = (rec.customer_phone || '').replace(/\D/g, '');
    const cleanPhone = phone.startsWith('0') ? '593' + phone.slice(1) : phone;
    const text = `Estimado(a) ${rec.customer_name || 'cliente'}, le saludamos de *FixmeTiendas*. Le recordamos que mantiene un saldo pendiente de *$${Number(rec.pending_amount || 0).toFixed(2)}* correspondiente a su compra #${rec.sale_id?.slice(0, 8).toUpperCase()}, con fecha límite de pago ${new Date(rec.due_date).toLocaleDateString()}. Puede acercarse a cancelar en sucursal o solicitar datos bancarios. ¡Muchas gracias!`;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  }

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
      <PageHeader
        title="Clientes"
        description="Directorio comercial, identificación fiscal, historial de ventas y taller"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="secondary-action" onClick={() => exportCSV()} title="Exportar a Excel/CSV">
              <Download size={14} /> <span>Exportar CSV</span>
            </button>
            <IconButton icon={RefreshCw} label="Recargar lista" onClick={() => loadData()} />
            <button type="button" className="primary-action" onClick={openCreate}>
              <Plus size={16} /> <span>Registrar cliente</span>
            </button>
          </div>
        }
      />

      {/* Sub-tabs: Clientes vs Cuentas por Cobrar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
        <button
          type="button"
          onClick={() => setCustomerTab('CUSTOMERS')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: customerTab === 'CUSTOMERS' ? '1px solid #3b82f6' : '1px solid #cbd5e1',
            background: customerTab === 'CUSTOMERS' ? '#eff6ff' : '#ffffff',
            color: customerTab === 'CUSTOMERS' ? '#1d4ed8' : '#475569',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          👥 Directorio de Clientes ({rows.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setCustomerTab('RECEIVABLES');
            loadReceivables();
          }}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: customerTab === 'RECEIVABLES' ? '1px solid #8b5cf6' : '1px solid #cbd5e1',
            background: customerTab === 'RECEIVABLES' ? '#f5f3ff' : '#ffffff',
            color: customerTab === 'RECEIVABLES' ? '#6d28d9' : '#475569',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          📑 Cuentas por Cobrar & Créditos ({receivables.filter(r => r.status !== 'PAID').length})
        </button>
      </div>

      {customerTab === 'CUSTOMERS' && (
        <>
          {/* CRM KPI Cards */}
          <KpiStrip
        items={[
          {
            label: 'Total clientes',
            value: stats.totalCustomers || rows.length,
            active: tagFilter === 'ALL',
            onClick: () => setTagFilter('ALL')
          },
          {
            label: 'Clientes VIP',
            value: stats.vipCustomers || 0,
            active: tagFilter === 'VIP',
            tone: 'warning',
            onClick: () => setTagFilter('VIP')
          },
          {
            label: 'Facturación clientes',
            value: `$${Number(stats.totalSalesVolume || 0).toFixed(2)}`,
            active: tagFilter === 'WITH_SALES',
            tone: 'success',
            onClick: () => setTagFilter('WITH_SALES')
          },
          {
            label: 'En taller activo',
            value: stats.activeRepairCustomers || 0,
            active: tagFilter === 'ACTIVE_WORK_ORDERS',
            tone: 'default',
            onClick: () => setTagFilter('ACTIVE_WORK_ORDERS')
          }
        ]}
      />

      {/* Toolbar: Search and Filter Pills */}
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="search-box" style={{ width: '100%', maxWidth: 420 }}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Buscar por nombre, cédula / RUC, teléfono, correo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
              title="Limpiar"
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <FilterTabs
            tabs={[
              { id: 'ALL', label: 'Todos', count: rows.length },
              { id: 'VIP', label: 'VIP', count: stats.vipCustomers || 0 },
              { id: 'FREQUENT', label: 'Frecuentes' },
              { id: 'WITH_SALES', label: 'Con compras' },
              { id: 'ACTIVE_WORK_ORDERS', label: 'En taller', count: stats.activeRepairCustomers || 0 },
              { id: 'NEW', label: 'Nuevos' }
            ]}
            activeTab={tagFilter}
            onChange={(k: string) => setTagFilter(k)}
          />
        </div>
      </div>

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
        </>
      )}

      {customerTab === 'RECEIVABLES' && (() => {
        const filteredReceivables = receivables.filter(r => {
          if (receivablesFilter === 'PENDING' && r.status !== 'PENDING' && r.status !== 'PARTIAL') return false;
          if (receivablesFilter === 'OVERDUE' && r.status !== 'OVERDUE' && !(new Date(r.due_date) < new Date() && Number(r.pending_amount) > 0)) return false;
          if (receivablesFilter === 'PAID' && r.status !== 'PAID') return false;
          if (searchReceivables.trim()) {
            const q = searchReceivables.toLowerCase();
            const match = (
              (r.customer_name || '').toLowerCase().includes(q) ||
              (r.customer_identification_number || '').toLowerCase().includes(q) ||
              (r.customer_phone || '').includes(q) ||
              (r.sale_id || '').toLowerCase().includes(q)
            );
            if (!match) return false;
          }
          return true;
        });

        const totalPendingRec = receivables.reduce((sum, r) => sum + Number(r.pending_amount || 0), 0);
        const totalPaidRec = receivables.reduce((sum, r) => sum + Number(r.total_paid || 0), 0);
        const overdueRecCount = receivables.filter(r => r.status === 'OVERDUE' || (new Date(r.due_date) < new Date() && Number(r.pending_amount) > 0)).length;
        const activeDebtorsCount = new Set(receivables.filter(r => Number(r.pending_amount) > 0).map(r => r.customer_id)).size;

        return (
          <>
            {/* Receivables KPIs */}
            <div className="finance-grid" style={{ marginBottom: 16 }}>
              <div className="finance-card">
                <small>Saldo Total por Cobrar</small>
                <strong style={{ color: '#dc2626' }}>${totalPendingRec.toFixed(2)}</strong>
                <span>{receivables.filter(r => Number(r.pending_amount) > 0).length} créditos con saldo pendiente</span>
              </div>
              <div className="finance-card">
                <small>Clientes con Deuda Activa</small>
                <strong style={{ color: '#8b5cf6' }}>{activeDebtorsCount}</strong>
                <span>Titulares con crédito vigente</span>
              </div>
              <div className="finance-card">
                <small>Créditos en Mora / Vencidos</small>
                <strong style={{ color: overdueRecCount > 0 ? '#ef4444' : '#10b981' }}>{overdueRecCount}</strong>
                <span>Requieren seguimiento inmediato</span>
              </div>
              <div className="finance-card">
                <small>Total Cobrado / Recaudado</small>
                <strong style={{ color: '#10b981' }}>${totalPaidRec.toFixed(2)}</strong>
                <span>Abonos ingresados en caja</span>
              </div>
            </div>

            {/* Controls: Search and Filters */}
            <div className="panel" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`filter-pill ${receivablesFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setReceivablesFilter('ALL')}
                  >
                    Todos ({receivables.length})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${receivablesFilter === 'PENDING' ? 'active' : ''}`}
                    onClick={() => setReceivablesFilter('PENDING')}
                  >
                    ⏳ Pendientes ({receivables.filter(r => r.status === 'PENDING' || r.status === 'PARTIAL').length})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${receivablesFilter === 'OVERDUE' ? 'active' : ''}`}
                    onClick={() => setReceivablesFilter('OVERDUE')}
                  >
                    ⚠️ En Mora ({overdueRecCount})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${receivablesFilter === 'PAID' ? 'active' : ''}`}
                    onClick={() => setReceivablesFilter('PAID')}
                  >
                    ✓ Pagados ({receivables.filter(r => r.status === 'PAID').length})
                  </button>
                </div>

                <div className="search-box" style={{ minWidth: 260 }}>
                  <span>🔍</span>
                  <input
                    placeholder="Buscar deudor por nombre, cédula, teléfono..."
                    value={searchReceivables}
                    onChange={e => setSearchReceivables(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Receivables Table */}
            <div className="panel table-panel">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente / Deudor</th>
                      <th>Venta Origen</th>
                      <th>Emisión / Vencimiento</th>
                      <th>Monto Crédito</th>
                      <th>Abonado</th>
                      <th>Saldo Pendiente</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceivables.map(r => {
                      const isOverdue = r.status === 'OVERDUE' || (new Date(r.due_date) < new Date() && Number(r.pending_amount) > 0);
                      return (
                        <tr key={r.id}>
                          <td>
                            <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>{r.customer_name || 'Cliente'}</strong>
                            <small style={{ color: '#64748b' }}>{r.customer_identification_type || 'CI'}: {r.customer_identification_number || 'S/N'}</small>
                            {r.customer_phone && (
                              <div style={{ fontSize: '11px', marginTop: 2 }}>
                                <a href={`tel:${r.customer_phone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                                  📞 {r.customer_phone}
                                </a>
                              </div>
                            )}
                          </td>
                          <td>
                            <strong style={{ fontSize: '12.5px', color: '#334155' }}>#{r.sale_id?.slice(0, 8).toUpperCase()}</strong>
                            <small style={{ display: 'block', color: '#94a3b8' }}>Crédito Comercial</small>
                          </td>
                          <td>
                            <div style={{ fontSize: '12px' }}>
                              <span style={{ color: '#64748b' }}>Emisión: </span>{new Date(r.created_at).toLocaleDateString()}
                            </div>
                            <div style={{ fontSize: '12px', marginTop: 2 }}>
                              <span style={{ color: '#64748b' }}>Vence: </span>
                              <strong style={{ color: isOverdue ? '#dc2626' : '#334155' }}>
                                {new Date(r.due_date).toLocaleDateString()}
                              </strong>
                              {isOverdue && (
                                <span style={{ marginLeft: 4, fontSize: '10px', background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                  VENCIDO
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <strong style={{ fontSize: '13px' }}>${Number(r.total_amount || 0).toFixed(2)}</strong>
                          </td>
                          <td>
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>${Number(r.total_paid || 0).toFixed(2)}</span>
                          </td>
                          <td>
                            <strong style={{ fontSize: '13.5px', color: Number(r.pending_amount) > 0 ? '#dc2626' : '#16a34a' }}>
                              ${Number(r.pending_amount || 0).toFixed(2)}
                            </strong>
                          </td>
                          <td>
                            {r.status === 'PAID' ? (
                              <span className="status-badge status-approved">✓ Pagado</span>
                            ) : isOverdue ? (
                              <span className="status-badge" style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>⚠️ En Mora</span>
                            ) : r.status === 'PARTIAL' ? (
                              <span className="status-badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>⏳ Abono Parcial</span>
                            ) : (
                              <span className="status-badge" style={{ background: '#eff6ff', color: '#1e40af', fontWeight: 700 }}>⏱️ Pendiente</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                              {Number(r.pending_amount || 0) > 0 && (
                                <button
                                  type="button"
                                  className="primary-action"
                                  style={{ padding: '5px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                  onClick={() => {
                                    setPayModalRec(r);
                                    setPayAmount(Number(r.pending_amount).toFixed(2));
                                    setPayMethod('CASH');
                                    setPayNotes('');
                                  }}
                                  title="Registrar un abono o cancelación total del saldo"
                                >
                                  💵 Abonar
                                </button>
                              )}
                              <button
                                type="button"
                                className="secondary-action"
                                style={{ padding: '5px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                onClick={() => openReceivableHistory(r)}
                                title="Ver historial de abonos"
                              >
                                📜 Pagos ({r.payments_count || (r.payments ? r.payments.length : 0)})
                              </button>
                              {r.customer_phone && Number(r.pending_amount || 0) > 0 && (
                                <button
                                  type="button"
                                  className="whatsapp-btn"
                                  style={{ padding: '5px 8px', fontSize: '11px' }}
                                  onClick={() => sendWhatsAppReceivableReminder(r)}
                                  title="Enviar recordatorio de cobro por WhatsApp"
                                >
                                  💬
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filteredReceivables.length && (
                  <div className="empty">
                    <b>📑</b>
                    <p>No se encontraron cuentas por cobrar con los filtros seleccionados.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

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

      {/* MODAL: REGISTRAR ABONO */}
      {payModalRec && (
        <div className="modal-overlay" onClick={() => setPayModalRec(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, color: '#15803d' }}>
                💵 Registrar Abono a Crédito
              </h3>
              <button className="close-button" onClick={() => setPayModalRec(null)}>✕</button>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', margin: '12px 0', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Cliente:</span>
                <strong>{payModalRec.customer_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Venta Origen:</span>
                <span>#{payModalRec.sale_id?.slice(0, 8).toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Saldo Pendiente Actual:</span>
                <strong style={{ fontSize: '15px', color: '#dc2626' }}>${Number(payModalRec.pending_amount || 0).toFixed(2)}</strong>
              </div>
            </div>

            <form onSubmit={submitReceivablePayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Monto a Abonar ($ USD) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(payModalRec.pending_amount || 0)}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  autoFocus
                  style={{ fontSize: '18px', fontWeight: 700, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </label>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="secondary-action"
                  style={{ flex: 1, padding: '4px 6px', fontSize: '11px' }}
                  onClick={() => setPayAmount((Number(payModalRec.pending_amount) / 2).toFixed(2))}
                >
                  50% (${(Number(payModalRec.pending_amount) / 2).toFixed(2)})
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  style={{ flex: 1, padding: '4px 6px', fontSize: '11px' }}
                  onClick={() => setPayAmount(Number(payModalRec.pending_amount).toFixed(2))}
                >
                  Total (${Number(payModalRec.pending_amount).toFixed(2)})
                </button>
              </div>

              <label>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Método de Pago *</span>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="CASH">💵 Efectivo (Ingresa a Caja de Turno)</option>
                  <option value="TRANSFER">🏦 Transferencia Bancaria</option>
                  <option value="CARD">💳 Tarjeta / POS Físico</option>
                </select>
              </label>

              <label>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Notas / Referencia (Opcional)</span>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="Ej: Depósito #48123 Banco Pichincha"
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </label>

              <div className="modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="secondary-action" onClick={() => setPayModalRec(null)} disabled={payingBusy}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-action"
                  style={{ background: '#16a34a', borderColor: '#15803d' }}
                  disabled={payingBusy}
                >
                  {payingBusy ? 'Procesando...' : '✓ Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL DE ABONOS */}
      {historyModalRec && (
        <div className="modal-overlay" onClick={() => setHistoryModalRec(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>
                📜 Historial de Pagos & Abonos
              </h3>
              <button className="close-button" onClick={() => setHistoryModalRec(null)}>✕</button>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', margin: '10px 0', fontSize: '12.5px', border: '1px solid #e2e8f0' }}>
              <div><strong>Cliente:</strong> {historyModalRec.customer_name}</div>
              <div><strong>Crédito Total:</strong> ${Number(historyModalRec.total_amount || 0).toFixed(2)} | <strong>Pendiente:</strong> <span style={{ color: '#dc2626', fontWeight: 700 }}>${Number(historyModalRec.pending_amount || 0).toFixed(2)}</span></div>
            </div>

            {loadingHistoryRec ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>Cargando pagos...</div>
            ) : Array.isArray(historyModalRec.payments) && historyModalRec.payments.length > 0 ? (
              <div className="table-wrap">
                <table style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Método</th>
                      <th>Recibo #</th>
                      <th>Cajero</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyModalRec.payments.map((p: Any) => (
                      <tr key={p.id}>
                        <td>{new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td><strong style={{ color: '#16a34a' }}>+${Number(p.amount || 0).toFixed(2)}</strong></td>
                        <td>{p.payment_method}</td>
                        <td><small style={{ fontFamily: 'monospace' }}>{p.receipt_number || p.id?.slice(0, 8)}</small></td>
                        <td>{p.received_by_name || 'Cajero'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                No se han registrado abonos todavía para este crédito.
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="secondary-action" onClick={() => setHistoryModalRec(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default Customers;
