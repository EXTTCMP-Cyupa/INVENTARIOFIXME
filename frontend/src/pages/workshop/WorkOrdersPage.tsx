import React from 'react';
import { Any, getBranchId } from '../../sharedConfig';
import { WorkOrderCheckoutModal } from '../../marketplaceView';
import { WorkOrderReceiptModal, QuickCustomerModal } from '../../commercialModals';
import { compressImageFile } from '../../imageUtils';
import { PageHeader, KpiStrip, FilterTabs } from '../../sharedLayout';
import { SkeletonTable } from '../../components/ui/ModernUiKit';
import {
  Search,
  Plus,
  ArrowLeft,
  Camera,
  ShieldCheck,
  Zap,
  Wrench,
  Package,
  Trash2,
  CheckCircle2,
  Smartphone,
  KeyRound,
  Sparkles
} from 'lucide-react';

const BRAND_CHIPS = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Lenovo', 'HP', 'Dell', 'Asus'];
const ACCESSORY_CHIPS = ['Sin accesorios', 'Cargador original', 'Funda / Estuche', 'Chip / SIM', 'Memoria SD', 'Mochila / Bolso'];
const FAULT_CHIPS = ['Pantalla rota', 'No carga', 'Batería degradada', 'Mantenimiento general', 'Mojado / Sulfatado', 'No enciende'];

export function Orders({
  api,
  companyInfo,
  branchId: propBranchId,
  notify
}: {
  api: (u: string, o?: RequestInit) => Promise<Response>;
  companyInfo?: Any;
  branchId?: string;
  notify?: (s: string) => void;
}) {
  const branchId = propBranchId || getBranchId();
  // Sincronización de estado en la URL (Principio 4 del plan de arquitectura)
  const urlInit = React.useMemo(() => {
    try {
      const h = window.location.hash || '';
      const qIdx = h.indexOf('?');
      if (qIdx !== -1) {
        const sp = new URLSearchParams(h.slice(qIdx + 1));
        return {
          view: (sp.get('view') === 'list' || sp.get('view') === 'kanban') ? (sp.get('view') as 'kanban'|'list') : null,
          status: sp.get('status') || null,
          tech: sp.get('tech') || null,
          q: sp.get('q') || '',
          col: sp.get('col') || null
        };
      }
    } catch {}
    return { view: null, status: null, tech: null, q: '', col: null };
  }, []);

  const [r,setR]=React.useState<Any[]>([]);
  const [customers,setCustomers]=React.useState<Any[]>([]);
  const [techs,setTechs]=React.useState<Any[]>([]);
  const [showCreate,setShowCreate]=React.useState(false);
  const [showQuickCust, setShowQuickCust] = React.useState(false);
  const [viewMode,setViewMode]=React.useState<'kanban'|'list'>(urlInit.view || 'kanban');
  const [filterStatus,setFilterStatus]=React.useState(urlInit.status || 'ALL');
  const [filterTech,setFilterTech]=React.useState(urlInit.tech || 'ALL');
  const [search,setSearch]=React.useState(urlInit.q || '');
  const [msg,setMsg]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [qrModal,setQrModal]=React.useState<Any|null>(null);
  const [editModal,setEditModal]=React.useState<Any|null>(null);
  const [editItems,setEditItems]=React.useState<Array<{itemType:string,name:string,quantity:number,unitPrice:number}>>([]);
  const [ticketModal,setTicketModal]=React.useState<Any|null>(null);
  const [checkoutModal,setCheckoutModal]=React.useState<Any|null>(null);

  const [form,setForm]=React.useState({
    customerId:'',deviceBrand:'',deviceModel:'',serialNumber:'',
    reportedFault:'',accessories:'',description:'',diagnosis:'',
    quote:'',diagnosticFee:'10.00',estimatedDelivery:'',assignedTechnicianId:'',slaHours:48
  });

  const [items,setItems]=React.useState<Array<{itemType:string,name:string,quantity:number,unitPrice:number}>>([]);

  const [intakeChecklist, setIntakeChecklist] = React.useState({
    powersOn: 'YES',
    screenStatus: 'OK',
    camerasStatus: 'OK',
    audioStatus: 'OK',
    wifiStatus: 'OK',
    chargingStatus: 'OK',
    cosmetic: 'BUENO',
    passcode: ''
  });
  const [legalDisclaimerAccepted, setLegalDisclaimerAccepted] = React.useState(true);
  const [intakePhotos, setIntakePhotos] = React.useState<Array<{stage: string, imageUrl: string, caption: string}>>([]);

  const [trustCamModal, setTrustCamModal] = React.useState<Any | null>(null);
  const [trustCamImages, setTrustCamImages] = React.useState<Any[]>([]);
  const [newPhotoStage, setNewPhotoStage] = React.useState<'RECEPTION' | 'DIAGNOSIS' | 'REPAIR' | 'TESTING' | 'COMPLETED'>('DIAGNOSIS');
  const [newPhotoUrl, setNewPhotoUrl] = React.useState('');
  const [newPhotoCaption, setNewPhotoCaption] = React.useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);

  const [notifyModal, setNotifyModal] = React.useState<Any | null>(null);
  const [notifyType, setNotifyType] = React.useState<string>('STATUS_UPDATE');
  const [notifyCustomMsg, setNotifyCustomMsg] = React.useState('');
  const [notifyHistory, setNotifyHistory] = React.useState<Any[]>([]);
  const [sendingNotify, setSendingNotify] = React.useState(false);
  const [openMenuOrderId, setOpenMenuOrderId] = React.useState<string | null>(null);
  const [mobileKanbanCol, setMobileKanbanCol] = React.useState<string>(urlInit.col || 'all');
  const [orderCounts, setOrderCounts] = React.useState<Any>({});
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // Sincronizar estado actual en la URL mediante replaceState (Principio 4)
  React.useEffect(() => {
    try {
      const sp = new URLSearchParams();
      if (viewMode !== 'kanban') sp.set('view', viewMode);
      if (filterStatus !== 'ALL') sp.set('status', filterStatus);
      if (filterTech !== 'ALL') sp.set('tech', filterTech);
      if (search.trim()) sp.set('q', search.trim());
      if (mobileKanbanCol !== 'all') sp.set('col', mobileKanbanCol);
      const qs = sp.toString();
      const targetHash = '#work-orders' + (qs ? `?${qs}` : '');
      if (window.location.hash.startsWith('#work-orders') && window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    } catch {}
  }, [viewMode, filterStatus, filterTech, search, mobileKanbanCol]);

  // Escuchar cambios de hash (ej. desde accesos rápidos del Dashboard)
  React.useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash || '';
      if (h.startsWith('#work-orders')) {
        const qIdx = h.indexOf('?');
        if (qIdx !== -1) {
          const sp = new URLSearchParams(h.slice(qIdx + 1));
          if (sp.has('status')) setFilterStatus(sp.get('status') || 'ALL');
          if (sp.has('tech')) setFilterTech(sp.get('tech') || 'ALL');
          if (sp.has('q')) setSearch(sp.get('q') || '');
          if (sp.has('view')) {
            const v = sp.get('view');
            if (v === 'kanban' || v === 'list') setViewMode(v);
          }
          if (sp.has('col')) setMobileKanbanCol(sp.get('col') || 'all');
        }
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  async function openTrustCam(o: Any) {
    setTrustCamModal(o);
    setNewPhotoStage(o.status === 'COMPLETED' ? 'COMPLETED' : o.status === 'OPEN' ? 'RECEPTION' : 'DIAGNOSIS');
    setNewPhotoUrl('');
    setNewPhotoCaption('');
    try {
      const res = await api(`/api/work-orders/${o.id}/images`);
      if (res.ok) {
        const imgs = await res.json();
        setTrustCamImages(Array.isArray(imgs) ? imgs : []);
      } else {
        setTrustCamImages(Array.isArray(o.images) ? o.images : []);
      }
    } catch {
      setTrustCamImages(Array.isArray(o.images) ? o.images : []);
    }
  }

  async function addTrustCamPhoto() {
    if (!trustCamModal || !newPhotoUrl.trim()) return;
    setIsUploadingPhoto(true);
    try {
      const res = await api(`/api/work-orders/${trustCamModal.id}/images`, {
        method: 'POST',
        body: JSON.stringify({
          stage: newPhotoStage,
          imageUrl: newPhotoUrl.trim(),
          caption: newPhotoCaption.trim()
        })
      });
      if (res.ok) {
        const created = await res.json();
        setTrustCamImages(prev => [...prev, created]);
        setNewPhotoUrl('');
        setNewPhotoCaption('');
        load();
      } else {
        alert('Error al guardar la foto');
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function deleteTrustCamPhoto(imgId: string) {
    if (!trustCamModal || !confirm('¿Eliminar esta evidencia fotográfica?')) return;
    const res = await api(`/api/work-orders/${trustCamModal.id}/images/${imgId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      setTrustCamImages(prev => prev.filter(img => img.id !== imgId));
      load();
    }
  }

  async function openNotifyModal(o: Any) {
    setNotifyModal(o);
    let initialType = 'STATUS_UPDATE';
    if (['OPEN', 'RECIBIDO'].includes(o.status)) initialType = 'ORDER_CREATED';
    else if (['QUOTED', 'DIAGNOSIS'].includes(o.status)) initialType = 'QUOTE_READY';
    else if (['COMPLETED', 'LISTO_ENTREGA'].includes(o.status)) initialType = 'READY_FOR_PICKUP';
    else if (['WAITING_PARTS', 'ESPERANDO_REPUESTOS'].includes(o.status)) initialType = 'WAITING_PARTS';
    setNotifyType(initialType);
    setNotifyCustomMsg('');
    try {
      const res = await api(`/api/work-orders/${o.id}/notifications`);
      if (res.ok) {
        const history = await res.json();
        setNotifyHistory(Array.isArray(history) ? history : []);
      } else {
        setNotifyHistory([]);
      }
    } catch {
      setNotifyHistory([]);
    }
  }

  async function sendNotification() {
    if (!notifyModal) return;
    setSendingNotify(true);
    try {
      const res = await api(`/api/work-orders/${notifyModal.id}/notify`, {
        method: 'POST',
        body: JSON.stringify({
          channel: 'WHATSAPP',
          notificationType: notifyType,
          customMessage: notifyCustomMsg.trim() || null
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.whatsappUrl) {
          window.open(data.whatsappUrl, '_blank');
        }
        setMsg('Notificación registrada y enviada a WhatsApp');
        const histRes = await api(`/api/work-orders/${notifyModal.id}/notifications`);
        if (histRes.ok) {
          const h = await histRes.json();
          setNotifyHistory(Array.isArray(h) ? h : []);
        }
      } else {
        alert('Error al registrar notificación');
      }
    } finally {
      setSendingNotify(false);
    }
  }

  const loadCounts = React.useCallback(() => {
    const params = new URLSearchParams();
    if (filterTech !== 'ALL') params.append('technicianId', filterTech);
    if (search.trim()) params.append('q', search.trim());
    const qs = params.toString();
    api('/api/orders/counts' + (qs ? '?' + qs : ''))
      .then(x => x.ok ? x.json() : null)
      .then(c => { if (c) setOrderCounts(c); })
      .catch(() => {});
  }, [api, filterTech, search]);

  const load = React.useCallback((isLoadMore = false) => {
    if (isLoadMore) {
      if (!nextCursor || loadingMore) return;
      setLoadingMore(true);
      const params = new URLSearchParams({ paged: 'true', limit: '30', cursor: nextCursor });
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterTech !== 'ALL') params.append('technicianId', filterTech);
      if (search.trim()) params.append('q', search.trim());
      api('/api/orders?' + params.toString())
        .then(x => x.ok ? x.json() : null)
        .then(res => {
          if (res && Array.isArray(res.data)) {
            setR(prev => {
              const existingIds = new Set(prev.map((item: Any) => item.id));
              const newItems = res.data.filter((item: Any) => !existingIds.has(item.id));
              return [...prev, ...newItems];
            });
            setNextCursor(res.nextCursor || null);
            setHasMore(!!res.hasMore);
          }
        })
        .finally(() => setLoadingMore(false));
      return;
    }

    setBusy(true);
    const params = new URLSearchParams({ paged: 'true', limit: '40' });
    if (filterStatus !== 'ALL') params.append('status', filterStatus);
    if (filterTech !== 'ALL') params.append('technicianId', filterTech);
    if (search.trim()) params.append('q', search.trim());

    Promise.all([
      api('/api/orders?' + params.toString()).then(x => x.ok ? x.json() : null),
      api('/api/customers').then(x => x.ok ? x.json() : []),
      api('/api/work-orders/technicians').then(x => x.ok ? x.json() : [])
    ]).then(([ordersRes, custs, techsList]) => {
      if (ordersRes) {
        if (Array.isArray(ordersRes)) {
          setR(ordersRes);
          setNextCursor(null);
          setHasMore(false);
        } else if (ordersRes.data) {
          setR(ordersRes.data);
          setNextCursor(ordersRes.nextCursor || null);
          setHasMore(!!ordersRes.hasMore);
        }
      }
      setCustomers(Array.isArray(custs) ? custs : []);
      setTechs(Array.isArray(techsList) ? techsList : []);
      loadCounts();
    }).finally(() => setBusy(false));
  }, [api, filterStatus, filterTech, search, nextCursor, loadingMore, loadCounts]);

  React.useEffect(() => {
    load();
  }, [filterStatus, filterTech]);

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
        diagnosticFee:form.diagnosticFee?Number(form.diagnosticFee):10,
        slaHours:Number(form.slaHours||48),
        assignedTechnicianId:form.assignedTechnicianId||null,
        items:items.filter(it=>it.name.trim()!==''),
        intakeChecklist,
        legalDisclaimerAccepted,
        images: intakePhotos
      })
    });
    setBusy(false);
    if(res.ok){
      const created=await res.json();
      setMsg('Orden registrada con Trust-Cam y checklist legal exitosamente');
      setForm({
        customerId:'',deviceBrand:'',deviceModel:'',serialNumber:'',
        reportedFault:'',accessories:'',description:'',diagnosis:'',
        quote:'',diagnosticFee:'10.00',estimatedDelivery:'',assignedTechnicianId:'',slaHours:48
      });
      setIntakeChecklist({
        powersOn: 'YES', screenStatus: 'OK', camerasStatus: 'OK', audioStatus: 'OK',
        wifiStatus: 'OK', chargingStatus: 'OK', cosmetic: 'BUENO', passcode: ''
      });
      setLegalDisclaimerAccepted(true);
      setIntakePhotos([]);
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
        diagnosticFee:editModal.diagnosticFee!==undefined?Number(editModal.diagnosticFee):Number(editModal.diagnostic_fee||0),
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
    RECIBIDO:'Recibida',
    DIAGNOSIS:'En diagnóstico',
    EN_DIAGNOSTICO:'En diagnóstico',
    QUOTED:'Cotizada',
    COTIZADO:'Cotizada',
    APPROVED:'Aprobada',
    APROBADO:'Aprobada',
    REJECTED:'Rechazada (Solo diagnóstico)',
    RECHAZADO:'Rechazada (Solo diagnóstico)',
    WAITING_PARTS:'Esperando repuestos',
    ESPERANDO_REPUESTOS:'Esperando repuestos',
    IN_PROGRESS:'En reparación',
    EN_REPARACION:'En reparación',
    TESTING:'En pruebas',
    EN_PRUEBAS:'En pruebas',
    PRUEBAS:'En pruebas',
    COMPLETED:'Listo para entrega',
    LISTO_ENTREGA:'Listo para entrega',
    ENTREGADO:'Entregado',
    DELIVERED:'Entregado',
    PAGADO:'Pagado',
    CANCELLED:'Cancelada',
    CANCELADO:'Cancelada'
  }[s]||s);

  function getSlaInfo(o:Any){
    if(['COMPLETED', 'DELIVERED', 'PAGADO', 'ENTREGADO'].includes(o.status)){
      return {label:'✓ Completado',cls:'sla-completed'};
    }
    if(['CANCELLED', 'CANCELADO', 'REJECTED', 'RECHAZADO'].includes(o.status)){
      return {label:['REJECTED', 'RECHAZADO'].includes(o.status)?'Cotización Rechazada':'Cancelada',cls:''};
    }
    if(!o.sla_deadline){
      return {label:`Meta ${o.sla_hours||48}h`,cls:'sla-ontime'};
    }
    const diffHours=(new Date(o.sla_deadline).getTime()-Date.now())/(1000*60*60);
    if(diffHours<0){
      const passedHours=Math.abs(Math.round(diffHours));
      if(passedHours>=48){
        const days=Math.round(passedHours/24);
        if(days>=5){
          return {label:`Atrasada ${days} d`,cls:'sla-archived-overdue'};
        }
        return {label:`Vencida hace ${days} d`,cls:'sla-expired'};
      }
      return {label:`Vencida hace ${passedHours}h`,cls:'sla-expired'};
    }
    if(diffHours<2){
      const mins=Math.max(1,Math.round(diffHours*60));
      return {label:`⚠️ Crítico: ${mins} min`,cls:'sla-critical'};
    }
    if(diffHours<12){
      return {label:`⏱️ Urgente: ${Math.round(diffHours)}h`,cls:'sla-warning'};
    }
    if(diffHours<48){
      return {label:`⏱️ En tiempo (${Math.round(diffHours)}h)`,cls:'sla-ontime'};
    }
    const daysLeft=Math.round(diffHours/24);
    return {label:`⏱️ En tiempo (${daysLeft} días)`,cls:'sla-ontime'};
  }

  const getFullUrl=(o:Any)=>{
    if(!o)return '';
    const num=o.order_number||o.orderNumber||o.id;
    if(!num)return '';
    return `${window.location.origin}/#order/${encodeURIComponent(num)}`;
  };

  const getWaLink=(o:Any)=>{
    let phone=(o.customer_phone||'').replace(/[^0-9]/g,'');
    if(phone.startsWith('0')){
      phone='593'+phone.substring(1);
    }else if(phone&&!phone.startsWith('593')&&phone.length===9){
      phone='593'+phone;
    }
    const url=getFullUrl(o);
    const folio=o.order_number||o.id?.slice(0,8).toUpperCase()||'';
    const name=o.customer_name||'estimado/a cliente';
    const device=`${o.device_brand||''} ${o.device_model||o.description||'dispositivo'}`.trim();

    let msg=`Hola ${name}, te saludamos de FixmeTiendas.\nTe compartimos el enlace para consultar tu orden #${folio} (${device}):\n${url}`;
    if(['DIAGNOSIS','OPEN','EN_DIAGNOSTICO','RECIBIDO'].includes(o.status)){
      msg=`Hola ${name}, tu equipo ${device} ha ingresado a taller para diagnóstico y evaluación técnica.\nOrden #${folio}.\nPuedes hacer seguimiento en vivo y ver fotos aquí:\n${url}`;
    }else if(['QUOTED','COTIZADO'].includes(o.status)){
      msg=`Hola ${name}, tenemos listo el presupuesto para tu equipo ${device}.\nTotal cotizado: $${Number(o.quote||0).toFixed(2)}.\n⚠️ Por favor revisa los repuestos y aprueba o cancela la reparación desde este enlace:\n${url}`;
    }else if(['WAITING_PARTS','ESPERANDO_REPUESTOS'].includes(o.status)){
      msg=`Hola ${name}, tu presupuesto para ${device} fue aprobado. Estamos esperando repuestos para continuar la reparación.\nOrden #${folio}.\nSeguimiento en vivo: ${url}`;
    }else if(['IN_PROGRESS','APPROVED','APROBADO','EN_REPARACION'].includes(o.status)){
      msg=`Hola ${name}, tu equipo ${device} se encuentra en proceso de reparación técnica activa.\nOrden #${folio}.\nAvance en tiempo real y fotos: ${url}`;
    }else if(['TESTING','EN_PRUEBAS','PRUEBAS'].includes(o.status)){
      msg=`Hola ${name}, tu equipo ${device} está en fase de pruebas finales y control de calidad.\nOrden #${folio}.\nAvance: ${url}`;
    }else if(['COMPLETED','LISTO_ENTREGA'].includes(o.status)){
      msg=`¡Buenas noticias ${name}! 🎉\nTu equipo ${device} (Orden #${folio}) ya está LISTO para retiro en nuestra tienda.\nDetalle final y fotos: ${url}\n¡Te esperamos!`;
    }else if(['DELIVERED','PAGADO','ENTREGADO'].includes(o.status)){
      msg=`¡Hola ${name}! Agradecemos tu confianza. Tu equipo ${device} (Orden #${folio}) ha sido entregado.\nComprobante y garantía: ${url}`;
    }
    const text=encodeURIComponent(msg);
    return phone?`https://wa.me/${phone}?text=${text}`:`https://wa.me/?text=${text}`;
  };

  const diagCount=r.filter(o=>['OPEN','DIAGNOSIS','RECIBIDO','EN_DIAGNOSTICO'].includes(o.status)).length;
  const quotedCount=r.filter(o=>['QUOTED','COTIZADO'].includes(o.status)).length;
  const inProgCount=r.filter(o=>['APPROVED','APROBADO','IN_PROGRESS','EN_REPARACION','WAITING_PARTS','ESPERANDO_REPUESTOS','TESTING','EN_PRUEBAS'].includes(o.status)).length;
  const readyCount=r.filter(o=>['COMPLETED','LISTO_ENTREGA','REJECTED','RECHAZADO'].includes(o.status)).length;

  const filtered=r.filter(o=>{
    const matchStatus=!filterStatus||filterStatus==='ALL'||(
      filterStatus==='DIAGNOSIS'?['OPEN','DIAGNOSIS','RECIBIDO','EN_DIAGNOSTICO'].includes(o.status):
      filterStatus==='QUOTED'?['QUOTED','COTIZADO'].includes(o.status):
      filterStatus==='WAITING_PARTS'?['WAITING_PARTS','ESPERANDO_REPUESTOS'].includes(o.status):
      filterStatus==='IN_PROGRESS'?['APPROVED','APROBADO','IN_PROGRESS','EN_REPARACION','TESTING','EN_PRUEBAS','PRUEBAS'].includes(o.status):
      filterStatus==='LISTO_ENTREGA'?['COMPLETED','LISTO_ENTREGA','REJECTED','RECHAZADO'].includes(o.status):
      filterStatus==='DELIVERED'?['DELIVERED','PAGADO','ENTREGADO'].includes(o.status):
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
    <PageHeader
      title="Órdenes de servicio"
      description="Taller, diagnósticos técnicos y control de SLA"
      actions={
        <button
          type="button"
          className="primary-action"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={16} />
          <span>Nueva orden</span>
        </button>
      }
    />

    <KpiStrip
      items={[
        {
          label: 'Total órdenes',
          value: orderCounts.total || r.length,
          hint: 'En flujo de taller',
          active: filterStatus === 'ALL',
          onClick: () => { setFilterStatus('ALL'); setMobileKanbanCol('all'); }
        },
        {
          label: 'En diagnóstico',
          value: (orderCounts.diagnosis || 0) + (orderCounts.open || 0),
          hint: 'Por evaluar',
          active: filterStatus === 'DIAGNOSIS',
          onClick: () => { setFilterStatus('DIAGNOSIS'); setMobileKanbanCol('diag'); }
        },
        {
          label: 'En reparación',
          value: (orderCounts.repair || 0) + (orderCounts.testing || 0),
          hint: 'En proceso activo',
          active: filterStatus === 'IN_PROGRESS',
          onClick: () => { setFilterStatus('IN_PROGRESS'); setMobileKanbanCol('in_progress'); }
        },
        {
          label: 'Listas para entrega',
          value: orderCounts.ready || 0,
          hint: 'Retiro en tienda',
          tone: (orderCounts.ready || 0) > 0 ? 'success' : 'default',
          active: filterStatus === 'LISTO_ENTREGA',
          onClick: () => { setFilterStatus('LISTO_ENTREGA'); setMobileKanbanCol('ready'); }
        },
        {
          label: 'Entregadas',
          value: orderCounts.delivered || 0,
          hint: 'Servicio completado',
          active: filterStatus === 'DELIVERED',
          onClick: () => { setFilterStatus('DELIVERED'); setMobileKanbanCol('delivered'); }
        }
      ]}
    />

    {showCreate && (
      <section className="panel order-intake-container" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 16px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                marginBottom: '8px'
              }}
            >
              <ArrowLeft size={16} /> Volver al listado de órdenes
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--primary-soft)', color: 'var(--primary)', padding: '3px 8px', borderRadius: '6px' }}>
                RECEPCIÓN EN MOSTRADOR
              </span>
            </div>
            <h3 style={{ margin: '6px 0 4px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Ingresar Nuevo Dispositivo a Taller
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Genera la ficha técnica, asigna el técnico responsable, fija el SLA y emite el comprobante térmico con código QR.
            </p>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={() => setShowCreate(false)}
            title="Cerrar formulario"
          >
            ✕
          </button>
        </div>

        <form onSubmit={add}>
          <div className="order-intake-grid">
            {/* ── COLUMNA IZQUIERDA: FLUJO TÉCNICO EN CARDS NUMERADAS ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* CARD 1: CLIENTE E IDENTIFICACIÓN DEL EQUIPO */}
              <div className="intake-card">
                <div className="intake-card-header">
                  <h4 className="intake-card-title">
                    <span className="intake-badge-step">1</span>
                    Cliente e Identificación del Dispositivo
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    * Campos requeridos
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Cliente select + botón rápido nuevo */}
                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <span>Cliente *</span>
                      <button
                        type="button"
                        onClick={() => setShowQuickCust(true)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: 0
                        }}
                      >
                        <Plus size={13} /> + Nuevo Cliente
                      </button>
                    </label>
                    <select
                      value={form.customerId}
                      onChange={e => setForm({ ...form, customerId: e.target.value })}
                      required
                      style={{ width: '100%' }}
                    >
                      <option value="">Selecciona un cliente registrado</option>
                      {customers.map(c => (
                        <option key={c.id || c._id} value={c.id || c._id}>
                          {c.name} · {c.phone || c.email || 'Sin contacto'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Marca con Chips rápidos */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Marca del Dispositivo *
                    </label>
                    <input
                      placeholder="Ej. Apple, Samsung, Lenovo, HP..."
                      value={form.deviceBrand}
                      onChange={e => setForm({ ...form, deviceBrand: e.target.value })}
                      required
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {BRAND_CHIPS.map(b => {
                        const isSelected = form.deviceBrand.trim().toLowerCase() === b.toLowerCase();
                        return (
                          <button
                            key={b}
                            type="button"
                            className={`intake-chip-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => setForm(f => ({ ...f, deviceBrand: b }))}
                          >
                            {b}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Modelo y N° Serie en 2 columnas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span>Modelo del equipo *</span>
                      <input
                        placeholder="Ej. iPhone 13 Pro, Pavilion 15"
                        value={form.deviceModel}
                        onChange={e => setForm({ ...form, deviceModel: e.target.value })}
                        required
                      />
                    </label>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span>N° Serie o IMEI</span>
                      <input
                        placeholder="Ej. 356789012345678"
                        value={form.serialNumber}
                        onChange={e => setForm({ ...form, serialNumber: e.target.value })}
                      />
                    </label>
                  </div>

                  {/* Accesorios recibidos con Chips rápidos */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Accesorios recibidos
                    </label>
                    <input
                      placeholder="Ej. Cargador original, Funda, sin SIM"
                      value={form.accessories}
                      onChange={e => setForm({ ...form, accessories: e.target.value })}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {ACCESSORY_CHIPS.map(acc => {
                        const isPresent = form.accessories.includes(acc);
                        return (
                          <button
                            key={acc}
                            type="button"
                            className={`intake-chip-btn ${isPresent ? 'active' : ''}`}
                            onClick={() => {
                              setForm(f => {
                                if (acc === 'Sin accesorios') return { ...f, accessories: 'Sin accesorios' };
                                const curr = f.accessories.trim();
                                if (!curr || curr === 'Sin accesorios') return { ...f, accessories: acc };
                                if (curr.includes(acc)) return f;
                                return { ...f, accessories: `${curr}, ${acc}` };
                              });
                            }}
                          >
                            + {acc}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: FALLA, DIAGNÓSTICO Y COMPROMISO SLA */}
              <div className="intake-card">
                <div className="intake-card-header">
                  <h4 className="intake-card-title">
                    <span className="intake-badge-step">2</span>
                    Falla, Diagnóstico y Compromiso SLA
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Falla reportada con chips frecuentes */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Falla reportada por el cliente *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ej. Pantalla estrellada tras caída, no da imagen, touch no responde..."
                      value={form.reportedFault}
                      onChange={e => setForm({ ...form, reportedFault: e.target.value })}
                      required
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {FAULT_CHIPS.map(fc => {
                        const isPresent = form.reportedFault.includes(fc);
                        return (
                          <button
                            key={fc}
                            type="button"
                            className={`intake-chip-btn ${isPresent ? 'active' : ''}`}
                            onClick={() => {
                              setForm(f => {
                                const curr = f.reportedFault.trim();
                                if (!curr) return { ...f, reportedFault: fc };
                                if (curr.includes(fc)) return f;
                                return { ...f, reportedFault: `${curr}, ${fc}` };
                              });
                            }}
                          >
                            + {fc}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Diagnóstico preliminar */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Diagnóstico preliminar en mostrador
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ej. Requiere cambio de display OLED y verificación de puerto de carga."
                      value={form.diagnosis}
                      onChange={e => setForm({ ...form, diagnosis: e.target.value })}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  {/* Asignación Técnica & SLA en 2 columnas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        👨‍🔧 Técnico Responsable Asignado
                      </label>
                      <select
                        value={form.assignedTechnicianId}
                        onChange={e => setForm({ ...form, assignedTechnicianId: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Sin técnico asignado (Por asignar) --</option>
                        {techs.map(t => (
                          <option key={t.id} value={t.id}>
                            👨‍🔧 {t.fullName} ({t.phone || 'Sin tel'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        ⏱️ Compromiso SLA de Entrega
                      </label>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        {[
                          [24, '⚡ 24h Express'],
                          [48, '⏱️ 48h Estándar'],
                          [72, '🔬 72h Complejo']
                        ].map(([hrs, lbl]) => {
                          const isActive = Number(form.slaHours) === hrs;
                          return (
                            <button
                              key={hrs}
                              type="button"
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 600,
                                padding: '6px 12px',
                                borderRadius: 'var(--radius-sm, 8px)',
                                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                                background: isActive ? 'var(--primary)' : 'var(--bg-subtle)',
                                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onClick={() => setForm({ ...form, slaHours: Number(hrs) })}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          placeholder="Horas SLA personalizadas"
                          value={form.slaHours}
                          onChange={e => setForm({ ...form, slaHours: Number(e.target.value) })}
                          style={{ width: '100px', fontSize: '12px' }}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>horas compromiso</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Fecha y hora estimada de retiro (opcional)
                    </label>
                    <input
                      type="datetime-local"
                      value={form.estimatedDelivery}
                      onChange={e => setForm({ ...form, estimatedDelivery: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {/* CARD 3: CHECKLIST RÁPIDO DE RECEPCIÓN (SEMÁFORO EN GRILLA) */}
              <div className="intake-card">
                <div className="intake-card-header">
                  <div>
                    <h4 className="intake-card-title">
                      <span className="intake-badge-step">3</span>
                      Checklist Rápido de Recepción (Semáforo de Estado)
                    </h4>
                    <small style={{ color: 'var(--text-muted)', fontSize: '11.5px', display: 'block', marginTop: '2px' }}>
                      Inspección inicial de 30s para proteger al taller y cliente ante reclamos sobre daños previos.
                    </small>
                  </div>
                  <button
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      padding: '5px 11px',
                      borderRadius: '8px',
                      background: 'var(--warning-soft, rgba(217, 119, 6, 0.1))',
                      color: 'var(--warning, #d97706)',
                      border: '1px solid var(--warning, #d97706)',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setIntakeChecklist(prev => ({
                        ...prev,
                        powersOn: 'NO',
                        screenStatus: 'UNTESTED',
                        camerasStatus: 'UNTESTED',
                        audioStatus: 'UNTESTED',
                        wifiStatus: 'UNTESTED',
                        chargingStatus: 'UNTESTED'
                      }));
                    }}
                  >
                    <Zap size={13} /> ⚡ Equipo No Enciende (Marcar 'Sin probar')
                  </button>
                </div>

                {/* Grilla Semáforo de 7 puntos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
                  {/* Encendido */}
                  {(() => {
                    const tone = intakeChecklist.powersOn === 'YES' ? 'ok' : intakeChecklist.powersOn === 'NO' ? 'bad' : 'warn';
                    const borderColor = tone === 'ok' ? 'var(--success, #16a34a)' : tone === 'bad' ? 'var(--danger, #dc2626)' : 'var(--warning, #d97706)';
                    return (
                      <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: '8px', padding: '10px', background: 'var(--bg-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>⚡ Encendido</span>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: borderColor }} />
                        </div>
                        <select
                          value={intakeChecklist.powersOn}
                          onChange={e => setIntakeChecklist({ ...intakeChecklist, powersOn: e.target.value })}
                          style={{ fontSize: '11.5px', padding: '6px', width: '100%' }}
                        >
                          <option value="YES">✓ Enciende normal</option>
                          <option value="NO">✕ No enciende / Apagado total</option>
                          <option value="UNTESTED">⚠️ Descargado / No probado</option>
                        </select>
                      </div>
                    );
                  })()}

                  {/* Pantalla / Touch */}
                  {(() => {
                    const tone = intakeChecklist.screenStatus === 'OK' ? 'ok' : intakeChecklist.screenStatus === 'BROKEN' ? 'bad' : 'warn';
                    const borderColor = tone === 'ok' ? 'var(--success, #16a34a)' : tone === 'bad' ? 'var(--danger, #dc2626)' : 'var(--warning, #d97706)';
                    return (
                      <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: '8px', padding: '10px', background: 'var(--bg-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>📱 Pantalla / Touch</span>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: borderColor }} />
                        </div>
                        <select
                          value={intakeChecklist.screenStatus}
                          onChange={e => setIntakeChecklist({ ...intakeChecklist, screenStatus: e.target.value })}
                          style={{ fontSize: '11.5px', padding: '6px', width: '100%' }}
                        >
                          <option value="OK">✓ Pantalla y táctil OK</option>
                          <option value="SCRATCHED">⚠️ Pantalla con rayones leves</option>
                          <option value="BROKEN">✕ Rota / manchas / líneas</option>
                        </select>
                      </div>
                    );
                  })()}

                  {/* Cámaras */}
                  {(() => {
                    const tone = intakeChecklist.camerasStatus === 'OK' ? 'ok' : intakeChecklist.camerasStatus === 'FAULTY' ? 'bad' : 'warn';
                    const borderColor = tone === 'ok' ? 'var(--success, #16a34a)' : tone === 'bad' ? 'var(--danger, #dc2626)' : 'var(--warning, #d97706)';
                    return (
                      <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: '8px', padding: '10px', background: 'var(--bg-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>📷 Cámaras</span>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: borderColor }} />
                        </div>
                        <select
                          value={intakeChecklist.camerasStatus}
                          onChange={e => setIntakeChecklist({ ...intakeChecklist, camerasStatus: e.target.value })}
                          style={{ fontSize: '11.5px', padding: '6px', width: '100%' }}
                        >
                          <option value="OK">✓ Cámaras OK</option>
                          <option value="FAULTY">✕ Cámara dañada / lente roto</option>
                          <option value="UNTESTED">⚠️ Bloqueado / No probado</option>
                        </select>
                      </div>
                    );
                  })()}

                  {/* Audio / Micrófono */}
                  {(() => {
                    const tone = intakeChecklist.audioStatus === 'OK' ? 'ok' : 'bad';
                    const borderColor = tone === 'ok' ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)';
                    return (
                      <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: '8px', padding: '10px', background: 'var(--bg-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>🔊 Audio / Micro</span>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: borderColor }} />
                        </div>
                        <select
                          value={intakeChecklist.audioStatus}
                          onChange={e => setIntakeChecklist({ ...intakeChecklist, audioStatus: e.target.value })}
                          style={{ fontSize: '11.5px', padding: '6px', width: '100%' }}
                        >
                          <option value="OK">✓ Altavoz y micro OK</option>
                          <option value="FAULTY">✕ Con distorsión o mudo</option>
                        </select>
                      </div>
                    );
                  })()}

                  {/* WiFi / Red Celular */}
                  {(() => {
                    const tone = intakeChecklist.wifiStatus === 'OK' ? 'ok' : 'bad';
                    const borderColor = tone === 'ok' ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)';
                    return (
                      <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: '8px', padding: '10px', background: 'var(--bg-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>📶 WiFi / Red</span>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: borderColor }} />
                        </div>
                        <select
                          value={intakeChecklist.wifiStatus}
                          onChange={e => setIntakeChecklist({ ...intakeChecklist, wifiStatus: e.target.value })}
                          style={{ fontSize: '11.5px', padding: '6px', width: '100%' }}
                        >
                          <option value="OK">✓ WiFi y antena OK</option>
                          <option value="FAULTY">✕ Sin señal o no conecta</option>
                        </select>
                      </div>
                    );
                  })()}

                  {/* Puerto de Carga */}
                  {(() => {
                    const tone = intakeChecklist.chargingStatus === 'OK' ? 'ok' : 'bad';
                    const borderColor = tone === 'ok' ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)';
                    return (
                      <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: '8px', padding: '10px', background: 'var(--bg-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>🔌 Puerto Carga</span>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: borderColor }} />
                        </div>
                        <select
                          value={intakeChecklist.chargingStatus}
                          onChange={e => setIntakeChecklist({ ...intakeChecklist, chargingStatus: e.target.value })}
                          style={{ fontSize: '11.5px', padding: '6px', width: '100%' }}
                        >
                          <option value="OK">✓ Carga rápido / normal</option>
                          <option value="FAULTY">✕ Falso contacto / no carga</option>
                        </select>
                      </div>
                    );
                  })()}

                  {/* Condición Estética */}
                  {(() => {
                    const tone = (intakeChecklist.cosmetic === 'EXCELENTE' || intakeChecklist.cosmetic === 'BUENO') ? 'ok' : intakeChecklist.cosmetic === 'GOLPES' ? 'bad' : 'warn';
                    const borderColor = tone === 'ok' ? 'var(--success, #16a34a)' : tone === 'bad' ? 'var(--danger, #dc2626)' : 'var(--warning, #d97706)';
                    return (
                      <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: '8px', padding: '10px', background: 'var(--bg-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>🔍 Estética Chasis</span>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: borderColor }} />
                        </div>
                        <select
                          value={intakeChecklist.cosmetic}
                          onChange={e => setIntakeChecklist({ ...intakeChecklist, cosmetic: e.target.value })}
                          style={{ fontSize: '11.5px', padding: '6px', width: '100%' }}
                        >
                          <option value="EXCELENTE">✨ Excelente (Como nuevo)</option>
                          <option value="BUENO">👍 Buen estado (Uso normal)</option>
                          <option value="RAYONES">⚠️ Rayones visibles</option>
                          <option value="GOLPES">🚨 Golpes o fisuras</option>
                        </select>
                      </div>
                    );
                  })()}
                </div>

                {/* Clave / Patrón de Desbloqueo */}
                <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    <KeyRound size={14} style={{ color: 'var(--primary)' }} />
                    <span>🔐 Clave / Patrón de Desbloqueo</span>
                  </div>
                  <input
                    placeholder="Ej. 1234, o haz clic en los accesos rápidos abajo"
                    value={intakeChecklist.passcode}
                    onChange={e => setIntakeChecklist({ ...intakeChecklist, passcode: e.target.value })}
                    style={{ fontSize: '12px', padding: '7px 10px', width: '100%' }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="intake-chip-btn"
                      onClick={() => setIntakeChecklist(prev => ({ ...prev, passcode: 'Sin clave' }))}
                    >
                      Sin clave
                    </button>
                    <button
                      type="button"
                      className="intake-chip-btn"
                      onClick={() => setIntakeChecklist(prev => ({ ...prev, passcode: prev.passcode.startsWith('PIN: ') ? prev.passcode : 'PIN: ' }))}
                    >
                      PIN:
                    </button>
                    <button
                      type="button"
                      className="intake-chip-btn"
                      onClick={() => setIntakeChecklist(prev => ({ ...prev, passcode: prev.passcode.startsWith('Patrón: ') ? prev.passcode : 'Patrón: ' }))}
                    >
                      Patrón:
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── COLUMNA DERECHA STICKY: TRUST-CAM, COSTOS Y CTA ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '80px', alignSelf: 'start' }}>
              {/* CARD 1: TRUST-CAM */}
              <div className="intake-card">
                <div className="intake-card-header">
                  <h4 className="intake-card-title">
                    <Camera size={17} style={{ color: 'var(--primary)' }} />
                    Trust-Cam: Fotos de Recepción
                  </h4>
                  <span style={{ fontSize: '11px', fontWeight: 700, background: 'var(--primary-soft)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px' }}>
                    {intakePhotos.length} {intakePhotos.length === 1 ? 'foto' : 'fotos'}
                  </span>
                </div>

                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '16px 12px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  border: '2px dashed var(--border-strong)',
                  background: 'var(--bg-subtle)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  margin: 0
                }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera size={20} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Tomar foto o adjuntar archivo
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Comprime y guarda evidencia automáticamente
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        try {
                          const compressed = await compressImageFile(file);
                          setIntakePhotos(prev => [...prev, { stage: 'RECEPTION', imageUrl: compressed, caption: `Foto de recepción ${prev.length + 1}` }]);
                        } catch (err) {
                          console.error('Error comprimiendo foto:', err);
                        }
                      }
                      e.target.value = '';
                    }}
                  />
                </label>

                {intakePhotos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))', gap: '8px', marginTop: '10px' }}>
                    {intakePhotos.map((p, idx) => (
                      <div key={idx} style={{ position: 'relative', height: '68px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
                        <img src={p.imageUrl} alt={`Recepción ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => setIntakePhotos(prev => prev.filter((_, i) => i !== idx))}
                          style={{
                            position: 'absolute',
                            top: 3,
                            right: 3,
                            background: 'rgba(0,0,0,0.65)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            fontSize: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0
                          }}
                          title="Eliminar foto"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CARD 2: RESUMEN DE COSTOS E ÍTEMS */}
              <div className="intake-card">
                <div className="intake-card-header">
                  <h4 className="intake-card-title">
                    <Package size={17} style={{ color: 'var(--primary)' }} />
                    Presupuesto & Desglose
                  </h4>
                  <button
                    type="button"
                    className="secondary-action"
                    style={{ fontSize: '11.5px', padding: '4px 10px', height: '28px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={addItem}
                  >
                    <Plus size={13} /> Ítem
                  </button>
                </div>

                {items.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', lineHeight: 1.4 }}>
                    Sin ítems desglosados aún. Puedes añadir mano de obra o repuestos arriba, o fijar una cotización global abajo.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                    {items.map((it, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <select
                            value={it.itemType}
                            onChange={e => updateItem(idx, 'itemType', e.target.value)}
                            style={{ width: '105px', fontSize: '11px', padding: '4px 6px' }}
                          >
                            <option value="LABOR">🛠️ Mano obra</option>
                            <option value="PART">📦 Repuesto</option>
                          </select>
                          <input
                            placeholder="Descripción..."
                            value={it.name}
                            onChange={e => updateItem(idx, 'name', e.target.value)}
                            style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                            title="Eliminar ítem"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Cant:</span>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                              style={{ width: '46px', fontSize: '11px', padding: '3px 5px' }}
                            />
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>$ c/u:</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={it.unitPrice}
                              onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                              style={{ width: '60px', fontSize: '11px', padding: '3px 5px' }}
                            />
                          </div>
                          <strong style={{ color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                            $${(Number(it.quantity || 1) * Number(it.unitPrice || 0)).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                      Tarifa Diagnóstico ($):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="10.00"
                      style={{ width: '90px', fontWeight: 700, fontSize: '13px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                      value={form.diagnosticFee}
                      onChange={e => setForm({ ...form, diagnosticFee: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                      Total Cotización ($):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      style={{ width: '110px', fontWeight: 800, fontSize: '15px', textAlign: 'right', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}
                      value={form.quote}
                      onChange={e => setForm({ ...form, quote: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* CARD 3: ACEPTACIÓN LEGAL & BOTÓN CTA */}
              <div className="intake-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm, 8px)',
                  padding: '12px'
                }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '11.5px', color: 'var(--text-secondary)', cursor: 'pointer', margin: 0, lineHeight: 1.45 }}>
                    <input
                      type="checkbox"
                      checked={legalDisclaimerAccepted}
                      onChange={e => setLegalDisclaimerAccepted(e.target.checked)}
                      style={{ marginTop: '2px', accentColor: 'var(--primary)' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        <ShieldCheck size={14} style={{ color: 'var(--primary)' }} />
                        Custodia Legal (Art. 71 Ley Defensa Consumidor)
                      </div>
                      <span>
                        El cliente autoriza revisión técnica. Retiro dentro de 60 días tras notificación.
                      </span>
                    </div>
                  </label>
                </div>

                {msg && (
                  <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--success-soft)', color: 'var(--success)', fontSize: '12px', fontWeight: 600 }}>
                    {msg}
                  </div>
                )}

                <button
                  type="submit"
                  className="primary-action"
                  disabled={busy}
                  style={{
                    width: '100%',
                    height: '46px',
                    fontSize: '14px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: 'var(--radius-md, 12px)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {busy ? (
                    <>Generando orden y ticket...</>
                  ) : (
                    <>
                      <CheckCircle2 size={17} />
                      Registrar Orden e Imprimir Ticket QR
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setShowCreate(false)}
                  style={{ width: '100%', justifyContent: 'center', height: '36px', fontSize: '13px' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </form>
      </section>
    )}

    <div style={{ marginTop: 16 }}>
      {/* 1. FilterTabs único */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <FilterTabs
          tabs={[
            { id: 'ALL', label: 'Todas', count: orderCounts.total || r.length },
            { id: 'DIAGNOSIS', label: 'Por diagnosticar', count: (orderCounts.diagnosis || 0) + (orderCounts.open || 0) },
            { id: 'IN_PROGRESS', label: 'En reparación', count: (orderCounts.repair || 0) + (orderCounts.testing || 0) },
            { id: 'LISTO_ENTREGA', label: 'Listas', count: orderCounts.ready || 0 },
            { id: 'DELIVERED', label: 'Entregadas', count: orderCounts.delivered || 0 }
          ]}
          activeTab={filterStatus}
          onChange={(id: string) => {
            setFilterStatus(id);
            const colMap: Record<string, string> = {
              ALL: 'all',
              DIAGNOSIS: 'diag',
              IN_PROGRESS: 'in_progress',
              LISTO_ENTREGA: 'ready',
              DELIVERED: 'delivered'
            };
            if (colMap[id]) setMobileKanbanCol(colMap[id]);
          }}
        />

        {/* 2. Barra de Búsqueda, Filtro de Técnico y Selector de Vista */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={filterTech}
            onChange={e => setFilterTech(e.target.value)}
            style={{ width: 190 }}
          >
            <option value="ALL">Todos los técnicos ({r.length})</option>
            {techs.map(t => (
              <option key={t.id} value={t.id}>
                {t.fullName} ({r.filter(o => o.assigned_technician_id === t.id).length})
              </option>
            ))}
            <option value="UNASSIGNED">Sin técnico asignado ({r.filter(o => !o.assigned_technician_id).length})</option>
          </select>

          <div className="search-box" style={{ width: 260 }}>
            <Search size={14} />
            <input
              placeholder="Buscar orden, cliente, modelo..."
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

          <div className="view-mode-pill-toggle">
            <button
              type="button"
              className={`view-mode-item ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              Tablero
            </button>
            <button
              type="button"
              className={`view-mode-item ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' && mobileKanbanCol !== 'all' && (
        <div style={{ margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="secondary-action"
            onClick={() => { setMobileKanbanCol('all'); setFilterStatus('ALL'); }}
            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            ← Ver todas las columnas del taller
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Filtro de columna activo
          </span>
        </div>
      )}

      {viewMode === 'kanban' ? (
        <div>
          <div className="kanban-board-canvas">
            {[
              {
                id: 'diag',
                title: 'En diagnóstico',
                color: '#2563eb',
                subtitle: 'Evaluación y presupuesto preliminar',
                items: filtered.filter(o => ['OPEN', 'DIAGNOSIS', 'RECIBIDO', 'EN_DIAGNOSTICO'].includes(o.status)),
                emptyText: 'No hay equipos en diagnóstico'
              },
              {
                id: 'quoted',
                title: 'Cotizadas',
                color: '#d97706',
                subtitle: 'Esperando autorización del cliente',
                items: filtered.filter(o => ['QUOTED', 'COTIZADO'].includes(o.status)),
                emptyText: 'No hay cotizaciones pendientes'
              },
              {
                id: 'parts',
                title: 'Esperando repuestos',
                color: '#ea580c',
                subtitle: 'Aprobado, esperando repuestos',
                items: filtered.filter(o => ['WAITING_PARTS', 'ESPERANDO_REPUESTOS'].includes(o.status)),
                emptyText: 'No hay repuestos pendientes'
              },
              {
                id: 'in_progress',
                title: 'En reparación y pruebas',
                color: '#7c3aed',
                subtitle: 'Trabajo activo en banco técnico',
                items: filtered.filter(o => ['APPROVED', 'APROBADO', 'IN_PROGRESS', 'EN_REPARACION', 'TESTING', 'EN_PRUEBAS', 'PRUEBAS'].includes(o.status)),
                emptyText: 'No hay reparaciones en curso'
              },
              {
                id: 'ready',
                title: 'Listas para entrega',
                color: '#059669',
                subtitle: 'Terminadas o listas para retiro',
                items: filtered.filter(o => ['COMPLETED', 'LISTO_ENTREGA', 'REJECTED', 'RECHAZADO'].includes(o.status)),
                emptyText: 'No hay equipos listos'
              },
              {
                id: 'delivered',
                title: 'Pagadas / Retiradas',
                color: '#475569',
                subtitle: 'Cobro y garantía registrados',
                items: filtered.filter(o => ['DELIVERED', 'PAGADO', 'ENTREGADO'].includes(o.status)),
                emptyText: 'No hay órdenes entregadas'
              }
            ]
            .filter(col => mobileKanbanCol === 'all' || mobileKanbanCol === col.id)
            .map(col => (
              <div
                className={`kanban-column ${mobileKanbanCol !== 'all' ? 'single-focus' : ''}`}
                key={col.id}
                id={`kcol-${col.id}`}
              >
                <div className="kanban-col-head" style={{ borderTop: `3px solid ${col.color}`, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="col-dot" style={{ background: col.color }} />
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
                        {col.title.replace(/^[0-9]\.\s*/, '')}
                      </div>
                      <small style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{col.subtitle}</small>
                    </div>
                  </div>
                  <span className="kanban-badge" style={{ background: `${col.color}18`, color: col.color, fontWeight: 800, padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                    {(() => {
                      const sCount = col.id === 'diag' ? ((orderCounts.diagnosis || 0) + (orderCounts.open || 0)) :
                                     col.id === 'quoted' ? (orderCounts.quoted || 0) :
                                     col.id === 'parts' ? (orderCounts.waiting_parts || 0) :
                                     col.id === 'in_progress' ? ((orderCounts.repair || 0) + (orderCounts.testing || 0)) :
                                     col.id === 'ready' ? (orderCounts.ready || 0) :
                                     col.id === 'delivered' ? (orderCounts.delivered || 0) : 0;
                      return sCount > 0 ? sCount : col.items.length;
                    })()}
                  </span>
                </div>

                <div className="kanban-col-body col-scroll">
                  {busy && r.length === 0 ? (
                    <>
                      <div className="kanban-skeleton-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div className="skeleton-box" style={{ width: '48px', height: '16px' }} />
                          <div className="skeleton-box" style={{ width: '56px', height: '16px' }} />
                        </div>
                        <div className="skeleton-box" style={{ width: '85%', height: '18px' }} />
                        <div className="skeleton-box" style={{ width: '60%', height: '13px' }} />
                        <div className="skeleton-box" style={{ width: '100%', height: '30px', marginTop: 4 }} />
                      </div>
                      <div className="kanban-skeleton-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div className="skeleton-box" style={{ width: '48px', height: '16px' }} />
                          <div className="skeleton-box" style={{ width: '56px', height: '16px' }} />
                        </div>
                        <div className="skeleton-box" style={{ width: '75%', height: '18px' }} />
                        <div className="skeleton-box" style={{ width: '50%', height: '13px' }} />
                      </div>
                    </>
                  ) : (
                    col.items.map(o => {
                    const sla = getSlaInfo(o);
                    return (
                      <article
                        className="kanban-card-enhanced"
                        key={o.id}
                        onClick={() => openEditModal(o)}
                        style={{ cursor: 'pointer' }}
                        title="Clic para abrir Banco de Trabajo"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="card-folio">{o.order_number || 'OT'}</span>
                            {o.is_warranty_return && (
                              <span style={{ fontSize: '9.5px', background: '#fee2e2', color: '#dc2626', fontWeight: 800, padding: '1px 5px', borderRadius: 4 }}>
                                🔄 GARANTÍA
                              </span>
                            )}
                          </div>
                          <span className={`sla-badge ${sla.cls}`} style={{ fontSize: '10px', padding: '2px 6px' }}>{sla.label}</span>
                        </div>

                        <div className="card-device">📱 {o.device_brand || ''} {o.device_model || o.description || 'Dispositivo'}</div>

                        <div className="card-customer">
                          <span>👤 {o.customer_name || 'Cliente'}</span>
                          {o.customer_phone && <span style={{ color: 'var(--accent)' }}>📞 {o.customer_phone}</span>}
                        </div>

                        <div className="card-fault">
                          <strong>Falla:</strong> {o.reported_fault || o.description || 'Sin detalle'}
                        </div>

                        {o.diagnosis && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--surface-subtle)', padding: '5px 8px', borderRadius: 'var(--r-sm)', marginBottom: 6, borderLeft: '2px solid var(--accent-border)' }}>
                            <b>Diag:</b> {o.diagnosis}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span>👨‍🔧 {o.technician_name || 'Sin técnico'}</span>
                          <strong style={{ fontSize: '14px', color: 'var(--accent)', letterSpacing: '-.02em' }}>${Number(o.quote || 0).toFixed(2)}</strong>
                        </div>

                        {/* ACTIONS: 1 Primary Action Button + 1 Dropdown "⋯" */}
                        <div
                          style={{ borderTop: '1px solid var(--surface-muted)', paddingTop: 8, marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{ flex: 1 }}>
                            {['OPEN', 'RECIBIDO'].includes(o.status) && (
                              <button type="button" className="primary-action" style={{ width: '100%', padding: '7px 10px', fontSize: '11px', justifyContent: 'center', background: 'var(--accent)' }} onClick={() => updateStatus(o.id, 'DIAGNOSIS')}>
                                🔍 Pasar a Diagnóstico
                              </button>
                            )}
                            {['DIAGNOSIS', 'EN_DIAGNOSTICO'].includes(o.status) && (
                              <button type="button" className="primary-action" style={{ width: '100%', padding: '7px 10px', fontSize: '11px', justifyContent: 'center', background: 'var(--accent)' }} onClick={() => openEditModal(o)}>
                                💰 Fijar Presupuesto
                              </button>
                            )}
                            {['QUOTED', 'COTIZADO'].includes(o.status) && (
                              <button type="button" className="primary-action" style={{ width: '100%', padding: '7px 10px', fontSize: '11px', justifyContent: 'center', background: 'var(--success-hover)' }} onClick={() => updateStatus(o.id, 'ESPERANDO_REPUESTOS')}>
                                👍 Autorizar Presupuesto
                              </button>
                            )}
                            {['WAITING_PARTS', 'ESPERANDO_REPUESTOS'].includes(o.status) && (
                              <button type="button" className="primary-action" style={{ width: '100%', padding: '7px 10px', fontSize: '11px', justifyContent: 'center', background: '#7c3aed' }} onClick={() => updateStatus(o.id, 'EN_REPARACION')}>
                                ⚙️ Iniciar Reparación
                              </button>
                            )}
                            {['APPROVED', 'APROBADO', 'IN_PROGRESS', 'EN_REPARACION'].includes(o.status) && (
                              <button type="button" className="primary-action" style={{ width: '100%', padding: '7px 10px', fontSize: '11px', justifyContent: 'center', background: '#9333ea' }} onClick={() => updateStatus(o.id, 'TESTING')}>
                                🧪 Pasar a Pruebas
                              </button>
                            )}
                            {['TESTING', 'EN_PRUEBAS', 'PRUEBAS'].includes(o.status) && (
                              <button type="button" className="primary-action" style={{ width: '100%', padding: '7px 10px', fontSize: '11px', justifyContent: 'center', background: 'var(--success-hover)' }} onClick={() => updateStatus(o.id, 'LISTO_ENTREGA')}>
                                ✅ Marcar Listo Retiro
                              </button>
                            )}
                            {['COMPLETED', 'LISTO_ENTREGA', 'REJECTED', 'RECHAZADO'].includes(o.status) && (
                              <button type="button" className="primary-action" style={{ width: '100%', padding: '7px 10px', fontSize: '11px', justifyContent: 'center', background: ['REJECTED', 'RECHAZADO'].includes(o.status) ? '#b91c1c' : 'var(--success-hover)' }} onClick={() => setCheckoutModal(o)}>
                                {['REJECTED', 'RECHAZADO'].includes(o.status) ? '🤝 Cobrar Diagnóstico' : '🤝 Cobrar y Entregar'}
                              </button>
                            )}
                            {['DELIVERED', 'PAGADO', 'ENTREGADO'].includes(o.status) && (
                              <div style={{ padding: '6px', fontSize: '11px', textAlign: 'center', background: 'var(--success-light)', color: '#047857', borderRadius: 'var(--r-sm)', fontWeight: 700 }}>
                                🤝 Entregado
                              </div>
                            )}
                          </div>

                          {/* Dropdown Menu "⋯" */}
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => setOpenMenuOrderId(openMenuOrderId === o.id ? null : o.id)}
                              title="Más opciones de la orden"
                              style={{
                                padding: '6px 9px',
                                borderRadius: '7px',
                                border: '1px solid #cbd5e1',
                                background: openMenuOrderId === o.id ? 'var(--accent-light)' : '#f8fafc',
                                color: openMenuOrderId === o.id ? 'var(--accent)' : '#475569',
                                fontSize: '13px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                lineHeight: 1
                              }}
                            >
                              ⋯
                            </button>

                            {openMenuOrderId === o.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 'calc(100% + 4px)',
                                  right: 0,
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '10px',
                                  boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                                  width: '185px',
                                  zIndex: 60,
                                  padding: '5px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px'
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuOrderId(null); openEditModal(o); }}
                                  style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b' }}
                                >
                                  🛠️ Banco de Trabajo
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuOrderId(null); openTrustCam(o); }}
                                  style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b' }}
                                >
                                  📸 Fotos {o.images && o.images.length > 0 ? `(${o.images.length})` : ''}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuOrderId(null); openNotifyModal(o); }}
                                  style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a' }}
                                >
                                  💬 Avisar por WhatsApp
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuOrderId(null); setQrModal(o); }}
                                  style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb' }}
                                >
                                  📱 Código QR Cliente
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuOrderId(null); setTicketModal(o); }}
                                  style={{ padding: '7px 8px', borderRadius: '6px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b' }}
                                >
                                  🖨️ Imprimir Ticket
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
                {busy && r.length === 0 ? null : col.items.length === 0 && (
                  <div className="kanban-empty-micro">
                    <span style={{ fontSize: '20px' }}>
                      {col.id === 'diag' ? '🔍' : col.id === 'quoted' ? '💬' : col.id === 'parts' ? '📦' : col.id === 'in_progress' ? '⚙️' : col.id === 'ready' ? '🎉' : '🤝'}
                    </span>
                    <strong style={{ color: '#475569' }}>{col.emptyText}</strong>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sin equipos en esta fase</span>
                    {col.id === 'diag' && (
                      <button
                        type="button"
                        onClick={() => { const btn = document.querySelector('button.primary-action') as HTMLButtonElement; if (btn) btn.click(); }}
                        style={{ marginTop: 6, padding: '4px 10px', fontSize: '11px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ＋ Recibir Equipo
                      </button>
                    )}
                  </div>
                )}
              </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center', margin: '20px 0 10px', padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ marginBottom: 10, fontSize: '13px', color: '#475569' }}>
                Mostrando <strong>{r.length}</strong> órdenes en pantalla{orderCounts.total ? ` de un total de ${orderCounts.total} en el sistema` : ''}.
              </div>
              <button
                type="button"
                className="primary-action"
                onClick={() => load(true)}
                disabled={loadingMore}
                style={{ padding: '9px 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                {loadingMore ? '⏳ Cargando siguientes órdenes...' : '⬇️ Cargar más órdenes (+30 por cursor)'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* LIST VIEW */
        busy && r.length === 0 ? (
          <div className="order-list" style={{ marginTop: '16px' }}>
            {[1, 2, 3, 4].map(idx => (
              <div className="kanban-skeleton-card" key={idx} style={{ padding: '16px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div className="skeleton-box" style={{ width: '80px', height: '22px' }} />
                  <div className="skeleton-box" style={{ width: '100px', height: '22px' }} />
                  <div className="skeleton-box" style={{ width: '70px', height: '22px' }} />
                </div>
                <div className="skeleton-box" style={{ width: '40%', height: '20px', margin: '8px 0' }} />
                <div className="skeleton-box" style={{ width: '60%', height: '14px' }} />
              </div>
            ))}
          </div>
        ) : filtered.length ? (
          <div className="order-list" style={{ marginTop: '16px' }}>
            {filtered.map(o => {
              const sla = getSlaInfo(o);
              return (
                <article className="order-card" key={o.id}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span className="order-folio" style={{ fontSize: '11px', padding: '3px 8px' }}>{o.order_number || 'OT'}</span>
                      <span className={`status-badge status-${String(o.status).toLowerCase()}`}>{statusLabel(o.status)}</span>
                      <span className={`sla-badge ${sla.cls}`}>{sla.label}</span>
                      <span className="tech-chip">👨‍🔧 {o.technician_name || 'Sin técnico'}</span>
                      <small style={{ color: '#98a1b2' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</small>
                    </div>

                    <strong>{o.device_brand || ''} {o.device_model || o.description || 'Dispositivo'}</strong>
                    <small style={{ display: 'block', marginTop: '2px' }}>
                      👤 {o.customer_name || 'Cliente'} {o.customer_phone ? `· 📞 ${o.customer_phone}` : ''} {o.serial_number ? `· 🔢 Serie: ${o.serial_number}` : ''}
                    </small>

                    <div className="order-card-meta" style={{ marginTop: '8px' }}>
                      <div>
                        <small>Falla reportada</small>
                        <strong>{o.reported_fault || o.description || 'Sin detalle'}</strong>
                      </div>
                      <div>
                        <small>Diagnóstico</small>
                        <strong>{o.diagnosis || 'Pendiente de evaluación'}</strong>
                      </div>
                      <div>
                        <small>Cotización total</small>
                        <strong style={{ color: '#3157d5' }}>${Number(o.quote || 0).toFixed(2)}</strong>
                      </div>
                    </div>

                    {o.items && o.items.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {o.items.slice(0, 3).map((it: Any, idx: number) => (
                          <span key={idx} className="order-folio" style={{ fontSize: '10px', padding: '2px 7px', background: it.itemType === 'LABOR' ? '#e0e7ff' : '#fef3c7', color: it.itemType === 'LABOR' ? '#3730a3' : '#92400e' }}>
                            {it.quantity}x {it.name} (${Number(it.subtotal || it.quantity * it.unitPrice || 0).toFixed(2)})
                          </span>
                        ))}
                        {o.items.length > 3 && (
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                            +{o.items.length - 3} ítems más ({o.items.length} total)
                          </span>
                        )}
                      </div>
                    )}

                    {/* QUICK TRANSITION BAR IN LIST (Unified 8-State Lifecycle) */}
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {['OPEN', 'RECIBIDO'].includes(o.status) && (
                        <button
                          type="button"
                          className="btn-sm btn-primary-sm"
                          style={{ background: '#2563eb' }}
                          onClick={() => updateStatus(o.id, 'DIAGNOSIS')}
                        >
                          🔍 Pasar a Diagnóstico
                        </button>
                      )}

                      {['DIAGNOSIS', 'EN_DIAGNOSTICO'].includes(o.status) && (
                        <button
                          type="button"
                          className="btn-sm btn-primary-sm"
                          style={{ background: '#2563eb' }}
                          onClick={() => openEditModal(o)}
                        >
                          💰 Fijar Presupuesto / Cotizar
                        </button>
                      )}

                      {['QUOTED', 'COTIZADO'].includes(o.status) && (
                        <>
                          <button
                            type="button"
                            className="btn-sm btn-primary-sm"
                            style={{ background: '#059669', color: '#fff' }}
                            onClick={() => updateStatus(o.id, 'ESPERANDO_REPUESTOS')}
                          >
                            👍 Autorizar Presupuesto
                          </button>
                          <a className="btn-sm btn-wa-sm" href={getWaLink(o)} target="_blank" rel="noreferrer">
                            💬 Enviar Presupuesto por WhatsApp
                          </a>
                        </>
                      )}

                      {['WAITING_PARTS', 'ESPERANDO_REPUESTOS'].includes(o.status) && (
                        <button
                          type="button"
                          className="btn-sm btn-primary-sm"
                          style={{ background: '#7c3aed', color: '#fff' }}
                          onClick={() => updateStatus(o.id, 'EN_REPARACION')}
                        >
                          ⚙️ Iniciar Reparación
                        </button>
                      )}

                      {['APPROVED', 'APROBADO', 'IN_PROGRESS', 'EN_REPARACION'].includes(o.status) && (
                        <button
                          type="button"
                          className="btn-sm btn-primary-sm"
                          style={{ background: '#9333ea', color: '#fff' }}
                          onClick={() => updateStatus(o.id, 'TESTING')}
                        >
                          🧪 Pasar a Pruebas Finales
                        </button>
                      )}

                      {['TESTING', 'EN_PRUEBAS', 'PRUEBAS'].includes(o.status) && (
                        <button
                          type="button"
                          className="btn-sm btn-primary-sm"
                          style={{ background: '#059669', color: '#fff' }}
                          onClick={() => updateStatus(o.id, 'LISTO_ENTREGA')}
                        >
                          ✅ Listo para Retiro
                        </button>
                      )}

                      {['COMPLETED', 'LISTO_ENTREGA', 'REJECTED', 'RECHAZADO'].includes(o.status) && (
                        <>
                          <button
                            type="button"
                            className="btn-sm btn-primary-sm"
                            style={{ background: ['REJECTED', 'RECHAZADO'].includes(o.status) ? '#b91c1c' : '#059669', color: '#fff' }}
                            onClick={() => setCheckoutModal(o)}
                          >
                            {['REJECTED', 'RECHAZADO'].includes(o.status) ? '🤝 Cobrar Diagnóstico' : '🤝 Cobrar y Entregar'}
                          </button>
                          <a className="btn-sm btn-wa-sm" href={getWaLink(o)} target="_blank" rel="noreferrer">
                            💬 Avisar Retiro
                          </a>
                        </>
                      )}

                      {['DELIVERED', 'PAGADO', 'ENTREGADO'].includes(o.status) && (
                        <div style={{ padding: '6px 12px', fontSize: '11px', textAlign: 'center', background: '#ecfdf5', color: '#047857', borderRadius: 6, fontWeight: 700 }}>
                          🤝 Pagado y Entregado
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="order-actions">
                    <button className="btn-sm btn-secondary-sm" onClick={() => openTrustCam(o)} title="Trust-Cam Evidencia Visual">
                      📸 Trust-Cam {o.images && o.images.length > 0 ? `(${o.images.length})` : ''}
                    </button>

                    <button className="btn-sm btn-wa-sm" onClick={() => openNotifyModal(o)} title="Notificar al cliente por WhatsApp">
                      💬 Notificar
                    </button>

                    <button className="btn-sm btn-primary-sm" onClick={() => setQrModal(o)} title="Ver QR de seguimiento">
                      📱 QR
                    </button>

                    <button className="btn-sm btn-secondary-sm" onClick={() => openEditModal(o)} title="Actualizar diagnóstico, técnico, ítems y precio">
                      🛠️ Taller
                    </button>

                    <button className="btn-sm btn-secondary-sm" onClick={() => setTicketModal(o)} title="Imprimir comprobante">
                      🖨️ Ticket
                    </button>

                    <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)}>
                      <option value="OPEN">1. Orden Abierta</option>
                      <option value="DIAGNOSIS">2. En Diagnóstico</option>
                      <option value="COTIZADO">3. Cotizado (Requiere Aprobación)</option>
                      <option value="ESPERANDO_REPUESTOS">4. Esperando Repuestos</option>
                      <option value="EN_REPARACION">5. En Reparación</option>
                      <option value="TESTING">6. Pruebas Finales</option>
                      <option value="LISTO_ENTREGA">7. Listo para Entrega</option>
                      <option value="DELIVERED">8. Pagado / Retirado</option>
                      <option value="CANCELLED">Cancelada</option>
                      {o.status === 'RECIBIDO' && <option value="RECIBIDO">📥 Recibido</option>}
                      {o.status === 'EN_DIAGNOSTICO' && <option value="EN_DIAGNOSTICO">🔍 En diagnóstico</option>}
                      {o.status === 'QUOTED' && <option value="QUOTED">💰 Cotizada</option>}
                      {o.status === 'APROBADO' && <option value="APROBADO">👍 Cotización Aprobada</option>}
                      {o.status === 'APPROVED' && <option value="APPROVED">👍 Cotización Aprobada</option>}
                      {o.status === 'WAITING_PARTS' && <option value="WAITING_PARTS">⏳ Esperando repuestos</option>}
                      {o.status === 'IN_PROGRESS' && <option value="IN_PROGRESS">⚙️ En reparación</option>}
                      {o.status === 'EN_PRUEBAS' && <option value="EN_PRUEBAS">🧪 En pruebas</option>}
                      {o.status === 'COMPLETED' && <option value="COMPLETED">📦 Listo para retiro</option>}
                      {o.status === 'ENTREGADO' && <option value="ENTREGADO">🤝 Entregado</option>}
                      {o.status === 'PAGADO' && <option value="PAGADO">🤝 Pagado</option>}
                      {o.status === 'REJECTED' && <option value="REJECTED">❌ Rechazada</option>}
                      {o.status === 'RECHAZADO' && <option value="RECHAZADO">❌ Rechazada</option>}
                    </select>
                  </div>
                </article>
              );
            })}
            {hasMore && (
              <div style={{ textAlign: 'center', margin: '20px 0 10px', padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ marginBottom: 10, fontSize: '13px', color: '#475569' }}>
                  Mostrando <strong>{r.length}</strong> órdenes en lista{orderCounts.total ? ` de un total de ${orderCounts.total} en el sistema` : ''}.
                </div>
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => load(true)}
                  disabled={loadingMore}
                  style={{ padding: '9px 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {loadingMore ? '⏳ Cargando más órdenes...' : '⬇️ Cargar más órdenes (+30 por cursor)'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="actionable-empty-state">
            <div className="empty-hero-icon">📋</div>
            <h3>No se encontraron órdenes de servicio</h3>
            <p>
              {search || filterStatus !== 'ALL' || filterTech !== 'ALL'
                ? `No hay órdenes que coincidan con los filtros aplicados. Intenta restablecer los filtros para ver todos los registros.`
                : 'Aún no tienes órdenes registradas en este período. Ingresa el primer equipo para iniciar el ciclo técnico del taller.'}
            </p>
            <div className="empty-actions">
              {(search || filterStatus !== 'ALL' || filterTech !== 'ALL') && (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setSearch('');
                    setFilterStatus('ALL');
                    setFilterTech('ALL');
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  🔄 Limpiar Filtros
                </button>
              )}
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  const btn = document.querySelector('button.primary-action') as HTMLButtonElement;
                  if (btn) btn.click();
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                ＋ Recibir Nueva Orden
              </button>
            </div>
          </div>
        )
      )}
    </div>

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
                        <option value="LABOR">🛠️ Mano de Obra</option>
                        <option value="PART">📦 Repuesto</option>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label>Tarifa de Diagnóstico ($)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="10.00"
                  style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}
                  value={editModal.diagnosticFee !== undefined ? editModal.diagnosticFee : (editModal.diagnostic_fee || '10.00')}
                  onChange={e => setEditModal({ ...editModal, diagnosticFee: e.target.value })}
                />
              </label>

              <label>Total Cotización ($)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  style={{ fontWeight: 800, fontSize: '16px', color: '#3157d5' }}
                  value={editModal.quote || ''}
                  onChange={e => setEditModal({ ...editModal, quote: e.target.value })}
                />
              </label>
            </div>

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
                <option value="RECIBIDO">📥 Recibido / Ingreso</option>
                <option value="EN_DIAGNOSTICO">🔍 En diagnóstico</option>
                <option value="COTIZADO">💰 Cotizada (esperando cliente)</option>
                <option value="APROBADO">👍 Cotización Aprobada</option>
                <option value="ESPERANDO_REPUESTOS">⏳ Esperando repuestos</option>
                <option value="EN_REPARACION">⚙️ En reparación</option>
                <option value="EN_PRUEBAS">🧪 En pruebas</option>
                <option value="LISTO_ENTREGA">📦 Listo para retiro</option>
                <option value="ENTREGADO">🤝 Entregado</option>
                <option value="RECHAZADO">❌ Cotización Rechazada (Cobro diagnóstico)</option>
                <option value="CANCELLED">🚫 Cancelada</option>
              </select>
            </label>
          </div>

          {['ENTREGADO', 'DELIVERED', 'PAGADO'].includes(editModal.status) && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 12, margin: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <strong style={{ color: '#991b1b', fontSize: 13, display: 'block' }}>¿Equipo reingresado por falla de reparación?</strong>
                <span style={{ fontSize: 11.5, color: '#b91c1c' }}>
                  Abre una orden de garantía oficial a costo $0.00 vinculando la orden original.
                </span>
              </div>
              <button
                type="button"
                className="secondary-action"
                style={{ background: '#ffffff', color: '#dc2626', borderColor: '#f87171', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}
                onClick={async () => {
                  const reason = prompt('Describe la falla técnica reportada por el cliente bajo garantía:');
                  if (!reason || !reason.trim()) return;
                  try {
                    setBusy(true);
                    const res = await api(`/api/work-orders/${editModal.id}/warranty-return`, {
                      method: 'POST',
                      body: JSON.stringify({ reason: reason.trim() })
                    });
                    if (!res.ok) throw new Error('Error al procesar reingreso de garantía');
                    const newOrder = await res.json();
                    setEditModal(null);
                    setMsg(`¡Reingreso de garantía creado con éxito! Nueva orden #${newOrder.order_number}`);
                    load();
                  } catch (err: any) {
                    alert(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                🔄 Reingreso por Garantía (RMA)
              </button>
            </div>
          )}

          <div className="editor-footer" style={{marginTop:'18px'}}>
            <button type="button" className="secondary-action" onClick={()=>setEditModal(null)}>Cancelar</button>
            <button className="primary-action" disabled={busy}>
              {busy?'Guardando...':'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>}

    {/* MODAL COBRO Y GARANTÍA DE TRABAJO */}
    {checkoutModal && (
      <WorkOrderCheckoutModal
        order={checkoutModal}
        onClose={() => setCheckoutModal(null)}
        onSuccess={(data: Any) => {
          setCheckoutModal(null);
          setMsg(`¡Trabajo finalizado! Cobro registrado y Garantía #${data.warrantyCode} emitida con éxito.`);
          load();
          setTicketModal({
            ...checkoutModal,
            status: data.status,
            warranty_code: data.warrantyCode,
            warranty_days: data.warrantyDays,
            payment_method: data.paymentMethod,
            payment_amount: data.paymentAmount
          });
        }}
      />
    )}

    {/* MODAL GESTOR TRUST-CAM (FOTOS DE EVIDENCIA VISUAL) */}
    {trustCamModal && (
      <div className="modal-overlay" onClick={() => setTrustCamModal(null)}>
        <div className="modal-card" style={{ width: 'min(720px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <div>
              <span className="eyebrow" style={{ color: '#2563eb' }}>INSPECCIÓN TÉCNICA VISUAL</span>
              <h3 style={{ margin: 0 }}>📸 Trust-Cam · {trustCamModal.order_number || 'Orden'}</h3>
              <small style={{ color: '#64748b' }}>
                {trustCamModal.device_brand} {trustCamModal.device_model} · {trustCamModal.customer_name || 'Cliente'}
              </small>
            </div>
            <button className="close-button" onClick={() => setTrustCamModal(null)}>✕</button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: '13px', color: '#475569', marginTop: 0, marginBottom: '14px', background: '#eff6ff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              💡 <b>Transparencia Total:</b> Las fotos adjuntas aquí son visibles de inmediato para el cliente en su <b>Portal 360</b>. Úsalas para certificar el estado en que recibiste el equipo, mostrar sulfato o componentes quemados y probar la reparación culminada.
            </p>

            {/* FORMULARIO AGREGAR FOTO */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '18px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px', color: '#0f172a' }}>
                ＋ Adjuntar Nueva Evidencia Visual
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {[
                  ['RECEPTION', '📥 Recepción'],
                  ['DIAGNOSIS', '🔬 Diagnóstico'],
                  ['REPAIR', '⚙️ Reparación'],
                  ['TESTING', '🧪 Pruebas'],
                  ['COMPLETED', '✨ Culminada']
                ].map(([stg, lbl]) => (
                  <button
                    key={stg}
                    type="button"
                    onClick={() => setNewPhotoStage(stg as any)}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      border: newPhotoStage === stg ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: newPhotoStage === stg ? '#2563eb' : '#fff',
                      color: newPhotoStage === stg ? '#fff' : '#475569'
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px' }}>
                <input
                  placeholder="URL de la imagen (o selecciona un archivo abajo)..."
                  value={newPhotoUrl}
                  onChange={e => setNewPhotoUrl(e.target.value)}
                  style={{ fontSize: '13px', padding: '8px 12px' }}
                />
                <label style={{
                  background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1',
                  padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  📁 Seleccionar Archivo
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e: Any) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const compressed = await compressImageFile(file);
                          setNewPhotoUrl(compressed);
                        } catch (err) {
                          console.error('Error comprimiendo evidencia:', err);
                        }
                      }
                    }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                <input
                  placeholder="Descripción de la foto (Ej. Conector de carga sulfatado, chasis quebrado)..."
                  value={newPhotoCaption}
                  onChange={e => setNewPhotoCaption(e.target.value)}
                  style={{ fontSize: '13px', padding: '8px 12px' }}
                />
                <button
                  type="button"
                  className="primary-action"
                  disabled={!newPhotoUrl.trim() || isUploadingPhoto}
                  onClick={addTrustCamPhoto}
                  style={{ fontSize: '12px', padding: '8px 16px' }}
                >
                  {isUploadingPhoto ? 'Guardando...' : '📸 Guardar Evidencia'}
                </button>
              </div>

              {newPhotoUrl && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={newPhotoUrl} alt="Preview" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>✓ Vista previa lista para subir</span>
                </div>
              )}
            </div>

            {/* LISTADO DE FOTOS EXISTENTES */}
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '10px' }}>
              Evidencias Registradas ({trustCamImages.length})
            </div>

            {trustCamImages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: '10px', color: '#94a3b8', fontSize: '13px' }}>
                📷 No se han adjuntado fotos aún para esta orden de trabajo.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                {trustCamImages.map((img: Any, idx: number) => {
                  const stageBadge = img.stage === 'RECEPTION' ? '📥 Recepción' : img.stage === 'COMPLETED' ? '✨ Culminada' : '🔬 Diagnóstico';
                  const stageBg = img.stage === 'RECEPTION' ? '#eff6ff' : img.stage === 'COMPLETED' ? '#ecfdf5' : '#fef3c7';
                  const stageCol = img.stage === 'RECEPTION' ? '#2563eb' : img.stage === 'COMPLETED' ? '#059669' : '#d97706';
                  return (
                    <div key={img.id || idx} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ height: '120px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                        <img src={img.imageUrl || img.image_url} alt="Trust-Cam" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => deleteTrustCamPhoto(img.id)}
                          style={{
                            position: 'absolute', top: 4, right: 4, background: 'rgba(220,38,38,0.85)', color: '#fff',
                            border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 11, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="Eliminar foto"
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        <span style={{ background: stageBg, color: stageCol, fontSize: '10.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                          {stageBadge}
                        </span>
                        <div style={{ fontSize: '12px', color: '#334155', fontWeight: 600, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {img.caption || 'Sin descripción'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="editor-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="primary-action" onClick={() => setTrustCamModal(null)}>
              Listo / Cerrar
            </button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL NOTIFICADOR WHATSAPP & AUDITORÍA DE AVISOS */}
    {notifyModal && (
      <div className="modal-overlay" onClick={() => setNotifyModal(null)}>
        <div className="modal-card" style={{ width: 'min(680px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <div>
              <span className="eyebrow" style={{ color: '#25d366' }}>WHATSAPP & PORTAL CLIENTE</span>
              <h3 style={{ margin: 0 }}>💬 Notificar al Cliente · {notifyModal.order_number || 'Orden'}</h3>
              <small style={{ color: '#64748b' }}>
                👤 {notifyModal.customer_name || 'Cliente'} {notifyModal.customer_phone ? `· 📞 ${notifyModal.customer_phone}` : ''}
              </small>
            </div>
            <button className="close-button" onClick={() => setNotifyModal(null)}>✕</button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                Selecciona la plantilla de notificación:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                {[
                  ['ORDER_CREATED', '🛠️ Ingreso / Recepción'],
                  ['QUOTE_READY', '💰 Cotización Lista'],
                  ['WAITING_PARTS', '⏳ Esperando Repuestos'],
                  ['READY_FOR_PICKUP', '✅ Listo para Retiro'],
                  ['STATUS_UPDATE', '🔄 Actualización Estado']
                ].map(([typeCode, lbl]) => (
                  <button
                    key={typeCode}
                    type="button"
                    onClick={() => {
                      setNotifyType(typeCode);
                      setNotifyCustomMsg('');
                    }}
                    style={{
                      padding: '8px 10px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', textAlign: 'center',
                      border: notifyType === typeCode ? '2px solid #25d366' : '1px solid #cbd5e1',
                      background: notifyType === typeCode ? '#f0fdf4' : '#fff',
                      color: notifyType === typeCode ? '#166534' : '#475569'
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  📱 Vista previa del mensaje (Incluye enlace directo con credenciales pre-cargadas al Portal):
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Editable</span>
              </div>
              <textarea
                rows={5}
                value={notifyCustomMsg}
                onChange={e => setNotifyCustomMsg(e.target.value)}
                placeholder="Si dejas este campo vacío, se enviará la plantilla oficial con enlace directo al portal del cliente..."
                style={{ width: '100%', fontSize: '12.5px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
              />
              <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                🔗 El enlace al portal del cliente 360 se adjuntará automáticamente para que el cliente no tenga que recordar contraseñas ni registrarse de nuevo.
              </small>
            </div>

            {/* BOTÓN DE DISPARO */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                className="primary-action"
                disabled={sendingNotify}
                onClick={sendNotification}
                style={{ flex: 1, background: '#25d366', color: '#fff', fontSize: '13px', padding: '12px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>💬</span>
                {sendingNotify ? 'Registrando y abriendo...' : '🚀 Abrir WhatsApp y Registrar Notificación'}
              </button>
            </div>

            {/* HISTORIAL DE NOTIFICACIONES */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                📋 Historial de Notificaciones de esta Orden ({notifyHistory.length})
              </div>

              {notifyHistory.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>
                  Aún no se han enviado notificaciones registradas para esta orden.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {notifyHistory.map((nh: Any) => (
                    <div key={nh.id} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: '#2563eb' }}>{nh.notification_type} · {nh.channel}</span>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>{nh.sent_at ? new Date(nh.sent_at).toLocaleString() : ''}</span>
                      </div>
                      <div style={{ color: '#334155', whiteSpace: 'pre-wrap', fontSize: '11.5px', background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                        {nh.message_payload}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="editor-footer" style={{ marginTop: '14px' }}>
            <button type="button" className="secondary-action" onClick={() => setNotifyModal(null)}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL COMPROBANTE DE RECEPCIÓN TALLER (80mm / 58mm) */}
        {/* MODAL CREAR CLIENTE RÁPIDO */}
    {showQuickCust && (
      <QuickCustomerModal
        api={api}
        onClose={() => setShowQuickCust(false)}
        onCreated={(newCust: Any) => {
          setCustomers(prev => [newCust, ...prev]);
          setForm(prev => ({ ...prev, customerId: newCust.id || newCust._id }));
          setShowQuickCust(false);
          if (notify) notify(`Cliente "${newCust.name}" registrado`);
        }}
        notify={notify}
      />
    )}

{ticketModal && (
      <WorkOrderReceiptModal
        order={ticketModal}
        onClose={() => setTicketModal(null)}
        tenantName={companyInfo?.name || localStorage.tenantName || 'Fixme Tiendas'}
        companyProfile={companyInfo}
      />
    )}
  </>;
}

export default Orders;
