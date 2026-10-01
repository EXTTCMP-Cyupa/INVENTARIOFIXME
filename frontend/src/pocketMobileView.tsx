import React from 'react';
import { compressImageFile } from './imageUtils';

export function formatEcuadorPhone(rawPhone?: string): string {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/[^0-9]/g, '');
  if (!cleaned) return '';
  // If already starts with 593:
  if (cleaned.startsWith('593')) {
    return cleaned;
  }
  // If starts with 0 (standard Ecuadorian cell phone like 0991234567):
  if (cleaned.startsWith('0')) {
    return '593' + cleaned.substring(1);
  }
  // If 9 digits (e.g. 991234567):
  if (cleaned.length === 9) {
    return '593' + cleaned;
  }
  // If 8 or more digits and not 593:
  if (cleaned.length >= 8) {
    return '593' + cleaned;
  }
  return cleaned;
}

interface PocketMobileViewProps {
  api: (url: string, options?: RequestInit) => Promise<Response>;
  role?: string;
  companyInfo?: any;
  branchId?: string;
  onSwitchToDesktop: () => void;
  onLogout: () => void;
  notify?: (msg: string) => void;
}

export function PocketMobileView({
  api,
  role = 'OPERATOR',
  companyInfo,
  branchId,
  onSwitchToDesktop,
  onLogout,
  notify
}: PocketMobileViewProps) {
  const [activeTab, setActiveTab] = React.useState<'DASHBOARD' | 'DELIVERIES' | 'WORK_ORDERS' | 'POS' | 'PROFILE'>('DASHBOARD');

  // --- DASHBOARD / SUMMARY METRICS ---
  const [summaryData, setSummaryData] = React.useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = React.useState(false);

  // --- DELIVERIES STATE ---
  const [deliveries, setDeliveries] = React.useState<any[]>([]);
  const [deliveryFilter, setDeliveryFilter] = React.useState<'ACTIVE' | 'DELIVERED' | 'ALL'>('ACTIVE');
  const [deliverySearch, setDeliverySearch] = React.useState('');
  const [loadingDeliveries, setLoadingDeliveries] = React.useState(false);
  const [evidenceModalDelivery, setEvidenceModalDelivery] = React.useState<any | null>(null);
  const [evidencePhoto, setEvidencePhoto] = React.useState<string | null>(null);
  const [evidenceNotes, setEvidenceNotes] = React.useState('');
  const [submittingEvidence, setSubmittingEvidence] = React.useState(false);

  // New Delivery Modal
  const [showNewDeliveryModal, setShowNewDeliveryModal] = React.useState(false);
  const [newRecipientName, setNewRecipientName] = React.useState('');
  const [newRecipientPhone, setNewRecipientPhone] = React.useState('');
  const [newAddress, setNewAddress] = React.useState('');
  const [newDeliveryNotes, setNewDeliveryNotes] = React.useState('');
  const [newShippingCost, setNewShippingCost] = React.useState('2.50');
  const [creatingDelivery, setCreatingDelivery] = React.useState(false);

  // --- WORK ORDERS STATE ---
  const [workOrders, setWorkOrders] = React.useState<any[]>([]);
  const [woFilter, setWoFilter] = React.useState<'ACTIVE' | 'READY' | 'ALL'>('ACTIVE');
  const [woSearch, setWoSearch] = React.useState('');
  const [loadingOrders, setLoadingOrders] = React.useState(false);
  
  // Interactive Order Detail Modal (Ficha Técnica & Seguimiento)
  const [selectedOrderForDetail, setSelectedOrderForDetail] = React.useState<any | null>(null);
  const [detailOrderImages, setDetailOrderImages] = React.useState<any[]>([]);
  const [loadingDetailImages, setLoadingDetailImages] = React.useState(false);
  const [editDiagnosis, setEditDiagnosis] = React.useState('');
  const [editQuote, setEditQuote] = React.useState('');
  const [editDiagFee, setEditDiagFee] = React.useState('10.00');
  const [editItems, setEditItems] = React.useState<{ itemType: 'LABOR' | 'PART'; name: string; quantity: number; unitPrice: number }[]>([]);
  const [updatingOrderDetails, setUpdatingOrderDetails] = React.useState(false);

  // QR Modal for Customer Tracking
  const [qrModalData, setQrModalData] = React.useState<{ orderNumber: string; url: string; customerName: string; customerPhone: string } | null>(null);

  // Photo Upload Modal
  const [woPhotoModal, setWoPhotoModal] = React.useState<any | null>(null);
  const [woPhotoUrl, setWoPhotoUrl] = React.useState('');
  const [woPhotoStage, setWoPhotoStage] = React.useState('DIAGNOSIS');
  const [woPhotoCaption, setWoPhotoCaption] = React.useState('');
  const [submittingWoPhoto, setSubmittingWoPhoto] = React.useState(false);

  // --- NEW WORK ORDER MODAL STATE ---
  const [showNewOrderModal, setShowNewOrderModal] = React.useState(false);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [orderCustomerMode, setOrderCustomerMode] = React.useState<'EXISTING' | 'NEW'>('NEW');
  const [selectedCustomerId, setSelectedCustomerId] = React.useState('');
  const [customerSearch, setCustomerSearch] = React.useState('');
  const [newCustomerName, setNewCustomerName] = React.useState('');
  const [newCustomerPhone, setNewCustomerPhone] = React.useState('');
  const [newCustomerIdNumber, setNewCustomerIdNumber] = React.useState('');
  const [newDeviceBrand, setNewDeviceBrand] = React.useState('Apple');
  const [newDeviceModel, setNewDeviceModel] = React.useState('');
  const [newSerialNumber, setNewSerialNumber] = React.useState('');
  const [newReportedFault, setNewReportedFault] = React.useState('');
  const [newInitialQuote, setNewInitialQuote] = React.useState('');
  const [newDiagnosticFee, setNewDiagnosticFee] = React.useState('10.00');
  const [newOrderItems, setNewOrderItems] = React.useState<{ itemType: 'LABOR' | 'PART'; name: string; quantity: number; unitPrice: number }[]>([]);
  const [intakeChecklist, setIntakeChecklist] = React.useState({
    powersOn: 'YES',
    screenStatus: 'OK',
    cameraStatus: 'OK',
    chargingStatus: 'OK',
    passcode: ''
  });
  const [intakePhoto, setIntakePhoto] = React.useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = React.useState(false);

  // Helper functions for itemized quotes
  const addNewOrderItem = (type: 'LABOR' | 'PART' = 'LABOR') => {
    setNewOrderItems(prev => [...prev, { itemType: type, name: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateNewOrderItem = (idx: number, field: string, val: any) => {
    setNewOrderItems(prev => {
      const updated = prev.map((it, i) => i === idx ? { ...it, [field]: val } : it);
      const sum = updated.reduce((acc, it) => acc + (Number(it.quantity || 1) * Number(it.unitPrice || 0)), 0);
      setNewInitialQuote(sum > 0 ? sum.toFixed(2) : '');
      return updated;
    });
  };

  const removeNewOrderItem = (idx: number) => {
    setNewOrderItems(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      const sum = updated.reduce((acc, it) => acc + (Number(it.quantity || 1) * Number(it.unitPrice || 0)), 0);
      setNewInitialQuote(sum > 0 ? sum.toFixed(2) : '');
      return updated;
    });
  };

  const addEditItem = (type: 'LABOR' | 'PART' = 'LABOR') => {
    setEditItems(prev => [...prev, { itemType: type, name: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateEditItem = (idx: number, field: string, val: any) => {
    setEditItems(prev => {
      const updated = prev.map((it, i) => i === idx ? { ...it, [field]: val } : it);
      const sum = updated.reduce((acc, it) => acc + (Number(it.quantity || 1) * Number(it.unitPrice || 0)), 0);
      setEditQuote(sum > 0 ? sum.toFixed(2) : '');
      return updated;
    });
  };

  const removeEditItem = (idx: number) => {
    setEditItems(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      const sum = updated.reduce((acc, it) => acc + (Number(it.quantity || 1) * Number(it.unitPrice || 0)), 0);
      setEditQuote(sum > 0 ? sum.toFixed(2) : '');
      return updated;
    });
  };

  // --- POS / COBRAR STATE ---
  const [posMode, setPosMode] = React.useState<'WORK_ORDER' | 'PRODUCT' | 'CUSTOM' | 'SALES_HISTORY'>('WORK_ORDER');
  
  // Work Order POS checkout
  const [selectedOrderToPay, setSelectedOrderToPay] = React.useState<any | null>(null);
  const [woPosSearch, setWoPosSearch] = React.useState('');
  const [woPaymentMethod, setWoPaymentMethod] = React.useState('CASH');
  const [woPaymentAmount, setWoPaymentAmount] = React.useState('');
  const [woWarrantyDays, setWoWarrantyDays] = React.useState(30);
  const [submittingWoCheckout, setSubmittingWoCheckout] = React.useState(false);

  // Product Catalog POS checkout
  const [products, setProducts] = React.useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState('');
  const [cart, setCart] = React.useState<{ product: any; qty: number }[]>([]);
  const [productPaymentMethod, setProductPaymentMethod] = React.useState('CASH');
  const [productCustomerPhone, setProductCustomerPhone] = React.useState('');
  const [productCustomerName, setProductCustomerName] = React.useState('');
  const [submittingProductSale, setSubmittingProductSale] = React.useState(false);

  // Custom Numeric POS
  const [posAmount, setPosAmount] = React.useState('');
  const [posConcept, setPosConcept] = React.useState('Venta Mostrador');
  const [posClientPhone, setPosClientPhone] = React.useState('');
  const [posPaymentMethod, setPosPaymentMethod] = React.useState('CASH');
  const [submittingSale, setSubmittingSale] = React.useState(false);

  // Sales History & Invoices List
  const [salesList, setSalesList] = React.useState<any[]>([]);
  const [loadingSalesList, setLoadingSalesList] = React.useState(false);
  const [salesSearch, setSalesSearch] = React.useState('');

  // Receipt / Ticket Modal (after sale or for reprint)
  const [receiptModalData, setReceiptModalData] = React.useState<any | null>(null);

  // --- DATA LOADERS ---
  const loadDashboardSummary = React.useCallback(() => {
    setLoadingDashboard(true);
    api('/api/reports/summary')
      .then(r => r.ok ? r.json() : null)
      .then(setSummaryData)
      .catch(() => setSummaryData(null))
      .finally(() => setLoadingDashboard(false));
  }, [api]);

  const loadDeliveries = React.useCallback(() => {
    setLoadingDeliveries(true);
    api('/api/deliveries')
      .then(r => r.ok ? r.json() : [])
      .then(setDeliveries)
      .catch(() => setDeliveries([]))
      .finally(() => setLoadingDeliveries(false));
  }, [api]);

  const loadWorkOrders = React.useCallback(() => {
    setLoadingOrders(true);
    api('/api/work-orders')
      .then(r => r.ok ? r.json() : [])
      .then(setWorkOrders)
      .catch(() => setWorkOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [api]);

  const loadCustomers = React.useCallback(() => {
    api('/api/customers')
      .then(r => r.ok ? r.json() : [])
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, [api]);

  const loadProducts = React.useCallback(() => {
    setLoadingProducts(true);
    const url = branchId ? `/api/products?branchId=${branchId}` : '/api/products';
    api(url)
      .then(r => r.ok ? r.json() : [])
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [api, branchId]);

  const loadSalesHistory = React.useCallback(() => {
    setLoadingSalesList(true);
    const url = branchId ? `/api/sales?branchId=${branchId}` : '/api/sales';
    api(url)
      .then(r => r.ok ? r.json() : [])
      .then(setSalesList)
      .catch(() => setSalesList([]))
      .finally(() => setLoadingSalesList(false));
  }, [api, branchId]);

  // Initial and reactive effects
  React.useEffect(() => {
    loadDeliveries();
    loadWorkOrders();
    loadCustomers();
    loadDashboardSummary();
  }, [loadDeliveries, loadWorkOrders, loadCustomers, loadDashboardSummary]);

  React.useEffect(() => {
    if (activeTab === 'DASHBOARD') {
      loadDashboardSummary();
      loadDeliveries();
      loadWorkOrders();
    } else if (activeTab === 'DELIVERIES') {
      loadDeliveries();
    } else if (activeTab === 'WORK_ORDERS') {
      loadWorkOrders();
    } else if (activeTab === 'POS') {
      loadWorkOrders();
      loadProducts();
      if (posMode === 'SALES_HISTORY') {
        loadSalesHistory();
      }
    }
  }, [activeTab, posMode, loadDashboardSummary, loadDeliveries, loadWorkOrders, loadProducts, loadSalesHistory]);

  // Load photos when opening order detail
  React.useEffect(() => {
    if (selectedOrderForDetail?.id) {
      setLoadingDetailImages(true);
      api(`/api/work-orders/${selectedOrderForDetail.id}/images`)
        .then(r => r.ok ? r.json() : [])
        .then(setDetailOrderImages)
        .catch(() => setDetailOrderImages([]))
        .finally(() => setLoadingDetailImages(false));

      setEditDiagnosis(selectedOrderForDetail.diagnosis || selectedOrderForDetail.description || '');
      setEditQuote(selectedOrderForDetail.quote ? String(selectedOrderForDetail.quote) : '');
      const rawDiagFee = selectedOrderForDetail.diagnostic_fee != null 
        ? String(selectedOrderForDetail.diagnostic_fee) 
        : (selectedOrderForDetail.diagnosticFee != null ? String(selectedOrderForDetail.diagnosticFee) : '10.00');
      setEditDiagFee(rawDiagFee);

      const rawItems = (selectedOrderForDetail.items || []).map((it: any) => ({
        itemType: it.itemType || it.item_type || 'LABOR',
        name: it.name || '',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || it.unit_price || 0)
      }));
      setEditItems(rawItems);
    } else {
      setDetailOrderImages([]);
      setEditItems([]);
    }
  }, [selectedOrderForDetail, api]);

  // --- ACTIONS: DELIVERIES ---
  async function handleUpdateDeliveryStatus(deliveryId: string, status: string, extra: any = {}) {
    try {
      const res = await api(`/api/deliveries/${deliveryId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra })
      });
      if (res.ok) {
        if (notify) notify(`✓ Entrega actualizada a ${status === 'IN_TRANSIT' ? 'EN RUTA' : status}`);
        loadDeliveries();
        loadDashboardSummary();
      } else {
        alert('Error al actualizar el estado de la entrega.');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    }
  }

  async function handleCreateDelivery(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddress.trim()) return;
    setCreatingDelivery(true);
    try {
      const res = await api('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: newAddress.trim(),
          recipientName: newRecipientName.trim() || 'Cliente',
          recipientPhone: newRecipientPhone.trim(),
          deliveryNotes: newDeliveryNotes.trim(),
          shippingCost: Number(newShippingCost) || 0
        })
      });
      if (res.ok) {
        if (notify) notify('✓ Despacho delivery creado exitosamente');
        setShowNewDeliveryModal(false);
        setNewAddress('');
        setNewRecipientName('');
        setNewRecipientPhone('');
        setNewDeliveryNotes('');
        loadDeliveries();
        loadDashboardSummary();
      } else {
        alert('No se pudo registrar la entrega');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setCreatingDelivery(false);
    }
  }

  async function handleSubmitEvidence() {
    if (!evidenceModalDelivery) return;
    setSubmittingEvidence(true);
    try {
      await handleUpdateDeliveryStatus(evidenceModalDelivery.id, 'DELIVERED', {
        evidenceUrl: evidencePhoto,
        deliveryNotes: evidenceNotes ? `${evidenceModalDelivery.delivery_notes || ''} [Nota final: ${evidenceNotes}]`.trim() : evidenceModalDelivery.delivery_notes
      });
      setEvidenceModalDelivery(null);
      setEvidencePhoto(null);
      setEvidenceNotes('');
    } finally {
      setSubmittingEvidence(false);
    }
  }

  // --- ACTIONS: WORK ORDERS ---
  async function handleSubmitWoPhoto() {
    const targetOrder = woPhotoModal || selectedOrderForDetail;
    if (!targetOrder || !woPhotoUrl) return;
    setSubmittingWoPhoto(true);
    try {
      const res = await api(`/api/work-orders/${targetOrder.id}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: woPhotoStage,
          imageUrl: woPhotoUrl,
          caption: woPhotoCaption.trim() || 'Foto de evidencia Trust-Cam móvil'
        })
      });
      if (res.ok) {
        if (notify) notify('📸 Foto subida con éxito a la orden');
        setWoPhotoModal(null);
        setWoPhotoUrl('');
        setWoPhotoCaption('');
        loadWorkOrders();
        // Refresh detail photos if modal is open
        if (selectedOrderForDetail?.id) {
          const imgRes = await api(`/api/work-orders/${selectedOrderForDetail.id}/images`);
          if (imgRes.ok) setDetailOrderImages(await imgRes.json());
        }
      } else {
        alert('Error al subir la foto');
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSubmittingWoPhoto(false);
    }
  }

  async function handleUpdateWoStatus(orderId: string, status: string, notes?: string) {
    try {
      const res = await api(`/api/work-orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, technicianNotes: notes || 'Actualizado desde Fixme Pocket' })
      });
      if (res.ok) {
        if (notify) notify(`✓ Estado actualizado a ${status}`);
        loadWorkOrders();
        loadDashboardSummary();
        if (selectedOrderForDetail && selectedOrderForDetail.id === orderId) {
          setSelectedOrderForDetail((prev: any) => ({ ...prev, status }));
        }
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  }

  async function handleSaveOrderTechnicalDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderForDetail) return;
    setUpdatingOrderDetails(true);
    try {
      const formattedItems = editItems.filter(it => it.name.trim()).map(it => ({
        itemType: it.itemType,
        name: it.name.trim(),
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0
      }));
      const itemsSum = formattedItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
      const finalQuote = itemsSum > 0 ? itemsSum : (editQuote ? Number(editQuote) : 0);

      const res = await api(`/api/work-orders/${selectedOrderForDetail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosis: editDiagnosis.trim(),
          quote: finalQuote,
          diagnosticFee: Number(editDiagFee) || 10.00,
          items: formattedItems,
          technicianNotes: 'Ficha técnica actualizada desde Fixme Pocket'
        })
      });
      if (res.ok) {
        if (notify) notify('✓ Ficha técnica y presupuesto actualizados');
        loadWorkOrders();
        loadDashboardSummary();
        setSelectedOrderForDetail((prev: any) => ({
          ...prev,
          diagnosis: editDiagnosis.trim(),
          quote: finalQuote,
          diagnostic_fee: Number(editDiagFee) || 10.00,
          diagnosticFee: Number(editDiagFee) || 10.00,
          items: formattedItems
        }));
      } else {
        alert('No se pudo guardar la actualización');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setUpdatingOrderDetails(false);
    }
  }

  // Create new Work Order
  async function handleCreateWorkOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeviceModel.trim()) {
      alert('Por favor ingresa el modelo del equipo');
      return;
    }

    setCreatingOrder(true);
    try {
      let finalCustomerId = selectedCustomerId;

      // Create customer first if new customer mode
      if (orderCustomerMode === 'NEW' || !finalCustomerId) {
        if (!newCustomerName.trim()) {
          alert('Por favor ingresa el nombre del cliente');
          setCreatingOrder(false);
          return;
        }

        const custRes = await api('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newCustomerName.trim(),
            phone: newCustomerPhone.trim(),
            identificationNumber: newCustomerIdNumber.trim(),
            identificationType: newCustomerIdNumber.length === 13 ? 'RUC' : 'CEDULA'
          })
        });

        if (custRes.ok) {
          const createdCust = await custRes.json();
          finalCustomerId = createdCust.id;
        } else {
          throw new Error('No se pudo registrar al nuevo cliente');
        }
      }

      const formattedItems = newOrderItems.filter(it => it.name.trim()).map(it => ({
        itemType: it.itemType,
        name: it.name.trim(),
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0
      }));
      const itemsSum = formattedItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
      const finalQuote = itemsSum > 0 ? itemsSum : (Number(newInitialQuote) || 0);

      // Create Work Order
      const woRes = await api('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: finalCustomerId,
          branchId: branchId || null,
          deviceBrand: newDeviceBrand,
          deviceModel: newDeviceModel.trim(),
          serialNumber: newSerialNumber.trim(),
          reportedFault: newReportedFault.trim() || 'Revisión técnica general',
          diagnosticFee: Number(newDiagnosticFee) || 10.00,
          items: formattedItems,
          quote: finalQuote,
          slaHours: 48,
          intakeChecklist: intakeChecklist,
          legalDisclaimerAccepted: true
        })
      });

      if (!woRes.ok) {
        const err = await woRes.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo crear la orden');
      }

      const createdWo = await woRes.json();
      const orderId = createdWo.id || createdWo.orderId;
      const orderNum = createdWo.orderNumber || createdWo.order_number || 'OT';

      // Upload intake photo if present
      if (intakePhoto && orderId) {
        await api(`/api/work-orders/${orderId}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage: 'RECEPTION',
            imageUrl: intakePhoto,
            caption: 'Foto de recepción inicial (Pocket Móvil)'
          })
        }).catch(() => {});
      }

      if (notify) notify(`✓ Orden #${orderNum} creada exitosamente`);

      const clientPhone = newCustomerPhone.trim() || (customers.find(c => c.id === finalCustomerId)?.phone || '');
      const clientName = newCustomerName.trim() || (customers.find(c => c.id === finalCustomerId)?.name || 'Cliente');
      const trackingLink = `${window.location.origin}/#order/${encodeURIComponent(orderNum)}`;

      // Show QR modal immediately for client tracking
      setQrModalData({
        orderNumber: orderNum,
        url: trackingLink,
        customerName: clientName,
        customerPhone: clientPhone
      });

      // WhatsApp receipt invitation with +593
      if (clientPhone) {
        const formattedPhone = formatEcuadorPhone(clientPhone);
        const msg = encodeURIComponent(
          `¡Hola ${clientName}! 👋 Te saludamos de ${companyInfo?.name || 'FixmeTiendas'}.\n\n` +
          `✅ Confirmamos el ingreso a taller de tu equipo: ${newDeviceBrand} ${newDeviceModel}\n` +
          `📄 Orden de Trabajo: #${orderNum}\n` +
          `💵 Tarifa base de diagnóstico: $${(Number(newDiagnosticFee) || 10).toFixed(2)}\n` +
          (finalQuote > 0 ? `💰 Presupuesto estimado: $${finalQuote.toFixed(2)}\n\n` : `\n`) +
          `🔍 Puedes hacer seguimiento en vivo y ver las fotos de inspección aquí:\n${trackingLink}\n\n` +
          `¡Estamos cuidando tu equipo!`
        );
        window.open(`https://wa.me/${formattedPhone}?text=${msg}`, '_blank');
      }

      // Reset form
      setShowNewOrderModal(false);
      setNewDeviceModel('');
      setNewSerialNumber('');
      setNewReportedFault('');
      setNewInitialQuote('');
      setNewDiagnosticFee('10.00');
      setNewOrderItems([]);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerIdNumber('');
      setIntakePhoto(null);
      loadWorkOrders();
      loadCustomers();
      loadDashboardSummary();
    } catch (e: any) {
      alert('Error al crear la orden: ' + e.message);
    } finally {
      setCreatingOrder(false);
    }
  }

  // --- ACTIONS: POS CHECKOUT & TICKETS ---

  // 1. Checkout Work Order
  async function handleCheckoutWorkOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderToPay) return;
    const amt = parseFloat(woPaymentAmount);
    if (isNaN(amt) || amt < 0) return alert('Ingresa un monto válido a cobrar');

    setSubmittingWoCheckout(true);
    try {
      const isRejected = ['REJECTED', 'RECHAZADO', 'CANCELADO', 'CANCELLED'].includes(selectedOrderToPay.status);
      const wDays = isRejected ? 0 : woWarrantyDays;

      const res = await api(`/api/work-orders/${selectedOrderToPay.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: woPaymentMethod,
          paymentAmount: amt,
          warrantyDays: wDays,
          warrantyTerms: isRejected 
            ? 'Cobro exclusivo de tarifa de diagnóstico técnico. Sin garantía de reparación.' 
            : 'Garantía de servicio técnico en mano de obra y repuestos especificados.',
          technicianNotes: isRejected 
            ? 'Tarifa de diagnóstico cobrada al retirar equipo en Fixme Pocket' 
            : 'Cobrado y entregado en mostrador móvil Fixme Pocket',
          status: 'DELIVERED'
        })
      });

      if (res.ok) {
        const orderNum = selectedOrderToPay.order_number || selectedOrderToPay.orderNumber || 'OT';
        if (notify) notify(`✓ Orden #${orderNum} cobrada y entregada`);

        const clientPhone = selectedOrderToPay.customer_phone || selectedOrderToPay.customerPhone || '';
        const clientName = selectedOrderToPay.customer_name || selectedOrderToPay.customerName || 'Cliente';
        const brand = selectedOrderToPay.device_brand || selectedOrderToPay.deviceBrand || '';
        const model = selectedOrderToPay.device_model || selectedOrderToPay.deviceModel || 'Equipo';

        // Prepare receipt modal data
        const receiptData = {
          type: 'WORK_ORDER',
          orderNumber: orderNum,
          customerName: clientName,
          customerPhone: clientPhone,
          device: `${brand} ${model}`,
          amount: amt,
          paymentMethod: woPaymentMethod,
          warrantyDays: wDays,
          warrantyCode: `GAR-${orderNum}`,
          date: new Date().toLocaleString('es-EC')
        };
        setReceiptModalData(receiptData);

        setSelectedOrderToPay(null);
        setWoPaymentAmount('');
        loadWorkOrders();
        loadDashboardSummary();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'No se pudo procesar el cobro de la orden');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setSubmittingWoCheckout(false);
    }
  }

  // 2. Checkout Products (Cart)
  function addToCart(p: any) {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { product: p, qty: 1 }];
    });
    if (notify) notify(`+ ${p.name} al carrito`);
  }

  function updateCartQty(productId: string, delta: number) {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      }).filter(Boolean) as { product: any; qty: number }[];
    });
  }

  const cartTotal = cart.reduce((acc, item) => acc + (Number(item.product.price || 0) * item.qty), 0);

  async function handleCheckoutProducts(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) return alert('El carrito está vacío');

    setSubmittingProductSale(true);
    try {
      const res = await api('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: branchId || null,
          channel: 'POS',
          fulfillmentType: 'STORE_PICKUP',
          invoiceType: 'INTERNAL_TICKET',
          items: cart.map(it => ({
            productId: it.product.id,
            quantity: it.qty
          })),
          payments: [{
            paymentMethod: productPaymentMethod,
            amount: Number(cartTotal.toFixed(2))
          }]
        })
      });

      if (res.ok) {
        const saleResp = await res.json().catch(() => ({}));
        if (notify) notify(`✓ Venta de $${cartTotal.toFixed(2)} registrada exitosamente`);

        // Prepare receipt modal data
        setReceiptModalData({
          type: 'PRODUCT_SALE',
          saleId: saleResp.id || 'VTA-' + Math.floor(Math.random() * 100000),
          customerName: productCustomerName.trim() || 'Consumidor Final',
          customerPhone: productCustomerPhone.trim(),
          items: cart.map(it => ({ name: it.product.name, qty: it.qty, price: Number(it.product.price || 0) })),
          amount: cartTotal,
          subtotal: Number((cartTotal / 1.15).toFixed(2)),
          tax: Number((cartTotal - (cartTotal / 1.15)).toFixed(2)),
          paymentMethod: productPaymentMethod,
          date: new Date().toLocaleString('es-EC')
        });

        setCart([]);
        setProductCustomerPhone('');
        setProductCustomerName('');
        loadProducts();
        loadDashboardSummary();
        loadSalesHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'No se pudo registrar la venta de productos');
      }
    } catch (e: any) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setSubmittingProductSale(false);
    }
  }

  // 3. Fast Custom Sale (Numeric)
  async function handleFastSale(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(posAmount);
    if (!amt || amt <= 0) return alert('Ingresa un monto válido');
    setSubmittingSale(true);
    try {
      const res = await api('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total: amt,
          subtotal: Number((amt / 1.15).toFixed(2)),
          tax: Number((amt - (amt / 1.15)).toFixed(2)),
          paymentMethod: posPaymentMethod,
          channel: 'POS',
          notes: posConcept
        })
      });
      if (res.ok) {
        const saleData = await res.json().catch(() => ({}));
        if (notify) notify(`✓ Cobro de $${amt.toFixed(2)} registrado con éxito`);

        setReceiptModalData({
          type: 'FAST_SALE',
          saleId: saleData.id || 'TICK-' + Math.floor(Math.random() * 100000),
          customerName: 'Consumidor Mostrador',
          customerPhone: posClientPhone.trim(),
          concept: posConcept,
          amount: amt,
          paymentMethod: posPaymentMethod,
          date: new Date().toLocaleString('es-EC')
        });

        setPosAmount('');
        loadDashboardSummary();
        loadSalesHistory();
      } else {
        alert('No se pudo registrar la venta rápida');
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSubmittingSale(false);
    }
  }

  // Helper to format WhatsApp ticket message with +593
  function sendTicketByWhatsApp(receipt: any) {
    const rawPhone = receipt.customerPhone || receipt.customer_phone || '';
    if (!rawPhone) {
      const promptPhone = prompt('Ingresa el número de WhatsApp del cliente:');
      if (!promptPhone) return;
      receipt.customerPhone = promptPhone;
    }
    const formattedPhone = formatEcuadorPhone(receipt.customerPhone || receipt.customer_phone);
    const store = companyInfo?.name || localStorage.tenantName || 'FixmeTiendas';
    const storePhone = companyInfo?.phone || '0994175857';

    let text = `🧾 *COMPROBANTE DE PAGO DIGITAL*\n`;
    text += `🏢 *${store.toUpperCase()}*\n`;
    text += `📍 Matriz Principal | Tel: ${storePhone}\n`;
    text += `------------------------------------\n`;

    if (receipt.type === 'WORK_ORDER' || receipt.orderNumber) {
      text += `🔧 *SERVICIO TÉCNICO: OT #${receipt.orderNumber}*\n`;
      text += `👤 *Cliente:* ${receipt.customerName || 'Cliente'}\n`;
      text += `📱 *Equipo:* ${receipt.device || 'Equipo'}\n`;
      text += `💰 *Total Cobrado:* $${Number(receipt.amount || 0).toFixed(2)}\n`;
      text += `💳 *Método de Pago:* ${receipt.paymentMethod || 'Efectivo'}\n`;
      text += `🛡️ *Garantía Oficial:* ${receipt.warrantyDays || 30} días (${receipt.warrantyCode || 'GAR-OT'})\n`;
      text += `📅 *Fecha:* ${receipt.date || new Date().toLocaleDateString('es-EC')}\n`;
      text += `------------------------------------\n`;
      text += `🔍 Consulta tu orden y fotos de inspección en:\n${window.location.origin}/#order/${receipt.orderNumber}\n`;
    } else {
      text += `🛒 *VENTA DE PRODUCTOS / SERVICIOS*\n`;
      text += `👤 *Cliente:* ${receipt.customerName || 'Consumidor Final'}\n`;
      if (receipt.items && receipt.items.length > 0) {
        text += `📦 *Detalle:*\n`;
        receipt.items.forEach((it: any) => {
          text += `  • ${it.qty || 1}x ${it.name} - $${(Number(it.price || 0) * (it.qty || 1)).toFixed(2)}\n`;
        });
      } else if (receipt.concept) {
        text += `📋 *Concepto:* ${receipt.concept}\n`;
      }
      text += `------------------------------------\n`;
      text += `💰 *TOTAL PAGADO:* $${Number(receipt.amount || receipt.total || 0).toFixed(2)}\n`;
      text += `💳 *Forma de Pago:* ${receipt.paymentMethod || receipt.payment_methods || 'Efectivo'}\n`;
      text += `📅 *Fecha:* ${receipt.date || receipt.created_at || new Date().toLocaleDateString('es-EC')}\n`;
      if (receipt.invoice_number) {
        text += `📄 *Factura SRI:* ${receipt.invoice_number}\n`;
      }
    }

    text += `------------------------------------\n`;
    text += `🙏 *¡Muchas gracias por su preferencia!*`;

    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  // Helper to send Invoice / Receipt by Email
  function sendInvoiceByEmail(receipt: any) {
    const rawEmail = receipt.customerEmail || receipt.customer_email || '';
    const email = rawEmail || prompt('Ingresa el correo electrónico del cliente:');
    if (!email) return;

    const store = companyInfo?.name || localStorage.tenantName || 'FixmeTiendas';
    const subject = encodeURIComponent(`Comprobante de Pago y Factura - ${store}`);
    const amount = Number(receipt.amount || receipt.total || 0).toFixed(2);
    const body = encodeURIComponent(
      `Estimado/a ${receipt.customerName || receipt.customer || 'Cliente'}:\n\n` +
      `Adjuntamos el detalle de su comprobante emitido por ${store}.\n\n` +
      `Monto Total: $${amount}\n` +
      `Fecha: ${receipt.date || new Date().toLocaleDateString('es-EC')}\n\n` +
      `Puede acceder a su portal de cliente en:\n${window.location.origin}/#portal-cliente\n\n` +
      `Atentamente,\n${store}`
    );

    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  }

  // --- FILTERING & COUNTS ---
  const pendingDeliveriesCount = deliveries.filter(d => d.status === 'PENDING' || d.status === 'IN_TRANSIT').length;
  const deliveredDeliveriesCount = deliveries.filter(d => d.status === 'DELIVERED').length;

  const activeOrdersCount = workOrders.filter(o => o.status !== 'DELIVERED' && o.status !== 'PAGADO').length;
  const readyOrdersCount = workOrders.filter(o => o.status === 'LISTO_ENTREGA' || o.status === 'COMPLETED').length;

  const filteredDeliveries = deliveries.filter(d => {
    if (deliveryFilter === 'ACTIVE' && (d.status === 'DELIVERED' || d.status === 'CANCELLED')) return false;
    if (deliveryFilter === 'DELIVERED' && d.status !== 'DELIVERED') return false;
    if (deliverySearch.trim()) {
      const q = deliverySearch.toLowerCase();
      const name = (d.recipient_name || d.customer_name || '').toLowerCase();
      const addr = (d.address || '').toLowerCase();
      const trk = (d.tracking_number || '').toLowerCase();
      if (!name.includes(q) && !addr.includes(q) && !trk.includes(q)) return false;
    }
    return true;
  });

  const filteredOrders = workOrders.filter(o => {
    if (woFilter === 'ACTIVE' && (o.status === 'DELIVERED' || o.status === 'PAGADO' || o.status === 'LISTO_ENTREGA')) return false;
    if (woFilter === 'READY' && o.status !== 'LISTO_ENTREGA' && o.status !== 'COMPLETED') return false;
    if (woSearch.trim()) {
      const q = woSearch.toLowerCase();
      const num = (o.order_number || o.orderNumber || '').toLowerCase();
      const mod = (o.device_model || o.deviceModel || '').toLowerCase();
      const cli = (o.customer_name || o.customerName || '').toLowerCase();
      if (!num.includes(q) && !mod.includes(q) && !cli.includes(q)) return false;
    }
    return true;
  });

  const ordersToPay = workOrders.filter(o => {
    if (o.status === 'DELIVERED' || o.status === 'PAGADO') return false;
    if (woPosSearch.trim()) {
      const q = woPosSearch.toLowerCase();
      const num = (o.order_number || o.orderNumber || '').toLowerCase();
      const mod = (o.device_model || o.deviceModel || '').toLowerCase();
      const cli = (o.customer_name || o.customerName || '').toLowerCase();
      if (!num.includes(q) && !mod.includes(q) && !cli.includes(q)) return false;
    }
    return true;
  });

  const filteredProducts = products.filter(p => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    const name = (p.name || '').toLowerCase();
    const sku = (p.sku || '').toLowerCase();
    return name.includes(q) || sku.includes(q);
  });

  const filteredSales = salesList.filter(s => {
    if (!salesSearch.trim()) return true;
    const q = salesSearch.toLowerCase();
    const cli = (s.customer || s.customer_name || '').toLowerCase();
    const num = (s.invoice_number || s.id || '').toLowerCase();
    return cli.includes(q) || num.includes(q);
  });

  const todayRevenue = summaryData?.revenue ? Number(summaryData.revenue).toFixed(2) : '0.00';
  const todaySalesCount = summaryData?.sales || 0;
  const lowStockCount = summaryData?.lowStock || 0;

  return (
    <div style={{
      maxWidth: '540px',
      margin: '0 auto',
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: '84px',
      boxSizing: 'border-box'
    }}>
      {/* HEADER TÁCTIL POCKET */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            borderRadius: '10px',
            width: '36px',
            height: '36px',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 900,
            fontSize: '18px',
            boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
          }}>
            ⚡
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              FIXME POCKET
            </div>
            <small style={{ color: '#059669', fontSize: '11px', fontWeight: 700 }}>
              🟢 {companyInfo?.name || localStorage.getItem('tenantName') || 'Mi Negocio'}
            </small>
          </div>
        </div>

        <button
          type="button"
          onClick={onSwitchToDesktop}
          style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '11.5px',
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
          title="Cambiar a la versión de computadora"
        >
          💻 Ver PC
        </button>
      </header>

      {/* BODY CONTENT DEPENDING ON TAB */}
      <main style={{ flex: 1, padding: '14px 16px' }}>

        {/* TAB 0: DASHBOARD / RESUMEN MÓVIL */}
        {activeTab === 'DASHBOARD' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Banner Saludo & Estado */}
            <div style={{
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              color: '#fff',
              borderRadius: '16px',
              padding: '16px',
              boxShadow: '0 4px 14px rgba(15,23,42,0.12)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    PANEL DE CONTROL MÓVIL
                  </span>
                  <h2 style={{ margin: '4px 0 2px', fontSize: '19px', fontWeight: 800 }}>
                    Hola, {role}
                  </h2>
                  <small style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    loadDashboardSummary();
                    loadDeliveries();
                    loadWorkOrders();
                    if (notify) notify('Datos actualizados');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Refrescar
                </button>
              </div>

              {/* Botones de Acción Rápida 2x2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(true)}
                  style={{
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 8px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
                  }}
                >
                  <span>📋</span> + Nueva OT
                </button>

                <button
                  type="button"
                  onClick={() => setShowNewDeliveryModal(true)}
                  style={{
                    background: '#0d9488',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 8px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(13,148,136,0.3)'
                  }}
                >
                  <span>🚚</span> + Nuevo Envío
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPosMode('WORK_ORDER');
                    setActiveTab('POS');
                  }}
                  style={{
                    background: '#16a34a',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 8px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(22,163,74,0.3)'
                  }}
                >
                  <span>⚡</span> Cobrar OT
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPosMode('PRODUCT');
                    setActiveTab('POS');
                  }}
                  style={{
                    background: '#ea580c',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 8px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(234,88,12,0.3)'
                  }}
                >
                  <span>🛒</span> Vender Producto
                </button>
              </div>
            </div>

            {/* Tarjetas KPI de Estado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div
                style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px', cursor: 'pointer' }}
                onClick={() => {
                  setPosMode('SALES_HISTORY');
                  setActiveTab('POS');
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>💰 VENTAS</span>
                  <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                    {todaySalesCount} trx
                  </span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
                  ${todayRevenue}
                </div>
                <small style={{ color: '#2563eb', fontSize: '11px', fontWeight: 600 }}>Ver facturas / tickets →</small>
              </div>

              <div
                style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px', cursor: 'pointer' }}
                onClick={() => setActiveTab('WORK_ORDERS')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>🛠️ TALLER</span>
                  {readyOrdersCount > 0 && (
                    <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                      {readyOrdersCount} listos
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
                  {activeOrdersCount}
                </div>
                <small style={{ color: '#2563eb', fontSize: '11px', fontWeight: 600 }}>Equipos en taller →</small>
              </div>

              <div
                style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px', cursor: 'pointer' }}
                onClick={() => setActiveTab('DELIVERIES')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>🚚 ENTREGAS</span>
                  <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                    {deliveredDeliveriesCount} ok
                  </span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
                  {pendingDeliveriesCount}
                </div>
                <small style={{ color: '#0d9488', fontSize: '11px', fontWeight: 600 }}>Despachos activos →</small>
              </div>

              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>📦 STOCK BAJO</span>
                  {lowStockCount > 0 ? (
                    <span style={{ fontSize: '11px', background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                      Alerta
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                      OK
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: lowStockCount > 0 ? '#dc2626' : '#0f172a' }}>
                  {lowStockCount}
                </div>
                <small style={{ color: '#64748b', fontSize: '11px' }}>Ítems con stock ≤ 5</small>
              </div>
            </div>

            {/* SECCIÓN: Órdenes Listas para Retiro Inmediato */}
            {readyOrdersCount > 0 && (
              <div style={{ background: '#fff', borderRadius: '14px', border: '1.5px solid #86efac', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '14px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ✨ Listos para Entrega & Cobro ({readyOrdersCount})
                  </strong>
                  <button
                    type="button"
                    onClick={() => {
                      setWoFilter('READY');
                      setActiveTab('WORK_ORDERS');
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#16a34a', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Ver todos →
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {workOrders.filter(o => o.status === 'LISTO_ENTREGA' || o.status === 'COMPLETED').slice(0, 3).map(o => (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <div onClick={() => setSelectedOrderForDetail(o)} style={{ cursor: 'pointer', flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                          #{o.order_number || o.orderNumber} · {o.device_brand || o.deviceBrand} {o.device_model || o.deviceModel}
                        </div>
                        <small style={{ color: '#64748b', fontSize: '11.5px' }}>
                          👤 {o.customer_name || o.customerName || 'Cliente'}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderToPay(o);
                          setWoPaymentAmount(String(o.quote || '0'));
                          setPosMode('WORK_ORDER');
                          setActiveTab('POS');
                        }}
                        style={{
                          background: '#16a34a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ Cobrar ${(Number(o.quote || 0)).toFixed(2)}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECCIÓN: Despachos Activos en Ruta */}
            {pendingDeliveriesCount > 0 && (
              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🚚 Envíos en Curso ({pendingDeliveriesCount})
                  </strong>
                  <button
                    type="button"
                    onClick={() => setActiveTab('DELIVERIES')}
                    style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Ver ruta →
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {deliveries.filter(d => d.status === 'PENDING' || d.status === 'IN_TRANSIT').slice(0, 3).map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ maxWidth: '65%' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          👤 {d.recipient_name || d.customer_name || 'Destinatario'}
                        </div>
                        <small style={{ color: '#64748b', fontSize: '11px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          📍 {d.address}
                        </small>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          textDecoration: 'none'
                        }}
                      >
                        🗺️ Mapa
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: ENTREGAS & REPARTIDORES */}
        {activeTab === 'DELIVERIES' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  🚚 Despachos & Rutas
                </h2>
                <small style={{ color: '#64748b', fontSize: '12px' }}>
                  {pendingDeliveriesCount} entregas pendientes
                </small>
              </div>

              <button
                type="button"
                onClick={() => setShowNewDeliveryModal(true)}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
                }}
              >
                + Nuevo Envío
              </button>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setDeliveryFilter('ACTIVE')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: deliveryFilter === 'ACTIVE' ? '#2563eb' : '#cbd5e1',
                  background: deliveryFilter === 'ACTIVE' ? '#eff6ff' : '#fff',
                  color: deliveryFilter === 'ACTIVE' ? '#1d4ed8' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                🚨 Por Entregar ({pendingDeliveriesCount})
              </button>
              <button
                type="button"
                onClick={() => setDeliveryFilter('DELIVERED')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: deliveryFilter === 'DELIVERED' ? '#16a34a' : '#cbd5e1',
                  background: deliveryFilter === 'DELIVERED' ? '#f0fdf4' : '#fff',
                  color: deliveryFilter === 'DELIVERED' ? '#15803d' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                🟢 Entregados
              </button>
              <button
                type="button"
                onClick={() => setDeliveryFilter('ALL')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: deliveryFilter === 'ALL' ? '#0f172a' : '#cbd5e1',
                  background: deliveryFilter === 'ALL' ? '#0f172a' : '#fff',
                  color: deliveryFilter === 'ALL' ? '#fff' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                Todos
              </button>
            </div>

            {/* Search Input */}
            <div style={{ marginBottom: '14px' }}>
              <input
                type="text"
                placeholder="🔍 Buscar por cliente, dirección o guía..."
                value={deliverySearch}
                onChange={e => setDeliverySearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  background: '#fff',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Deliveries List */}
            {loadingDeliveries ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                Cargando despachos...
              </div>
            ) : filteredDeliveries.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#fff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛵</div>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>No hay despachos en esta lista</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredDeliveries.map(d => {
                  const clientName = d.recipient_name || d.customer_name || 'Destinatario';
                  const phone = d.recipient_phone || d.customer_phone || '';
                  const formattedPhone = formatEcuadorPhone(phone);
                  const isDelivered = d.status === 'DELIVERED';
                  const isInTransit = d.status === 'IN_TRANSIT';

                  return (
                    <div
                      key={d.id}
                      style={{
                        background: '#fff',
                        borderRadius: '14px',
                        border: '1.5px solid #e2e8f0',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: isDelivered ? '#dcfce7' : isInTransit ? '#fef3c7' : '#eff6ff',
                          color: isDelivered ? '#166534' : isInTransit ? '#92400e' : '#1d4ed8',
                          border: '1px solid',
                          borderColor: isDelivered ? '#86efac' : isInTransit ? '#fde68a' : '#bfdbfe'
                        }}>
                          {isDelivered ? 'ENTREGADO' : isInTransit ? 'EN RUTA' : 'PENDIENTE'}
                        </span>

                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
                          #{d.tracking_number || 'TRK'}
                        </span>
                      </div>

                      <div>
                        <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>
                          {clientName}
                        </strong>
                        <div style={{ fontSize: '13px', color: '#475569', marginTop: '3px', lineHeight: 1.3 }}>
                          📍 {d.address}
                        </div>
                      </div>

                      {/* Map & Call Buttons */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: '12px',
                            fontWeight: 700,
                            textAlign: 'center',
                            textDecoration: 'none',
                            border: '1px solid #bfdbfe'
                          }}
                        >
                          🗺️ Ver Mapa
                        </a>

                        {phone && (
                          <>
                            <a
                              href={`tel:${phone}`}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                background: '#f1f5f9',
                                color: '#334155',
                                fontSize: '12px',
                                fontWeight: 700,
                                textDecoration: 'none',
                                border: '1px solid #cbd5e1'
                              }}
                            >
                              📞 Llamar
                            </a>
                            <a
                              href={`https://wa.me/${formattedPhone}?text=${encodeURIComponent(
                                `Hola ${clientName}, soy tu repartidor de Fixme. Voy en camino con tu pedido a la dirección: ${d.address}`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                background: '#f0fdf4',
                                color: '#16a34a',
                                fontSize: '12px',
                                fontWeight: 700,
                                textDecoration: 'none',
                                border: '1px solid #bbf7d0'
                              }}
                            >
                              💬 WhatsApp
                            </a>
                          </>
                        )}
                      </div>

                      {/* Delivery Actions */}
                      {!isDelivered && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          {!isInTransit ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateDeliveryStatus(d.id, 'IN_TRANSIT')}
                              style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#2563eb',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              🚀 Iniciar Ruta (En camino)
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEvidenceModalDelivery(d);
                                setEvidencePhoto(null);
                                setEvidenceNotes('');
                              }}
                              style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#16a34a',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                boxShadow: '0 3px 10px rgba(22,163,74,0.3)'
                              }}
                            >
                              📸 Confirmar Entrega con Foto
                            </button>
                          )}
                        </div>
                      )}

                      {/* If already delivered, show badge */}
                      {isDelivered && (
                        <div style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '11.5px',
                          color: '#15803d',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>✓ Entrega finalizada con éxito</span>
                          {d.evidence_url && (
                            <a
                              href={d.evidence_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ marginLeft: 'auto', color: '#15803d', fontWeight: 700 }}
                            >
                              Ver Foto ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TALLER & ÓRDENES (INTERACCIÓN & SEGUIMIENTO COMPLETO) */}
        {activeTab === 'WORK_ORDERS' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  🛠️ Taller Técnico
                </h2>
                <small style={{ color: '#64748b', fontSize: '12px' }}>
                  Toca cualquier orden para ver la ficha técnica, QR y seguimiento
                </small>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(true)}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
                  }}
                >
                  + Nueva OT
                </button>
                <button
                  type="button"
                  onClick={loadWorkOrders}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🔄
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setWoFilter('ACTIVE')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: woFilter === 'ACTIVE' ? '#2563eb' : '#cbd5e1',
                  background: woFilter === 'ACTIVE' ? '#eff6ff' : '#fff',
                  color: woFilter === 'ACTIVE' ? '#1d4ed8' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                ⚡ En Proceso ({activeOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setWoFilter('READY')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: woFilter === 'READY' ? '#16a34a' : '#cbd5e1',
                  background: woFilter === 'READY' ? '#f0fdf4' : '#fff',
                  color: woFilter === 'READY' ? '#15803d' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                ✨ Listos Retiro ({readyOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setWoFilter('ALL')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: woFilter === 'ALL' ? '#0f172a' : '#cbd5e1',
                  background: woFilter === 'ALL' ? '#0f172a' : '#fff',
                  color: woFilter === 'ALL' ? '#fff' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                Todos
              </button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: '14px' }}>
              <input
                type="text"
                placeholder="🔍 Buscar por N° orden, modelo o cliente..."
                value={woSearch}
                onChange={e => setWoSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  background: '#fff',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Work Orders List */}
            {loadingOrders ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                Cargando órdenes de taller...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#fff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛠️</div>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>No se encontraron órdenes de trabajo</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredOrders.map(o => {
                  const num = o.order_number || o.orderNumber || 'OT';
                  const brand = o.device_brand || o.deviceBrand || '';
                  const model = o.device_model || o.deviceModel || 'Equipo';
                  const client = o.customer_name || o.customerName || 'Cliente';
                  const phone = o.customer_phone || o.customerPhone || '';
                  const formattedPhone = formatEcuadorPhone(phone);
                  const quote = Number(o.quote || 0);
                  const status = o.status || 'OPEN';
                  const trackingUrl = `${window.location.origin}/#order/${encodeURIComponent(num)}`;
                  const isRejected = ['REJECTED', 'RECHAZADO', 'CANCELADO', 'CANCELLED'].includes(status);
                  const diagFee = Number(o.diagnostic_fee || o.diagnosticFee || 10);
                  const dueAmount = isRejected ? diagFee : (quote > 0 ? quote : diagFee);

                  return (
                    <div
                      key={o.id}
                      style={{
                        background: '#fff',
                        borderRadius: '14px',
                        border: '1.5px solid #e2e8f0',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Top Header of Card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: isRejected 
                            ? '#fee2e2' 
                            : (status.includes('LISTO') || status.includes('COMPLETED') ? '#dcfce7' : status === 'IN_PROGRESS' ? '#e0e7ff' : '#fef3c7'),
                          color: isRejected 
                            ? '#991b1b' 
                            : (status.includes('LISTO') || status.includes('COMPLETED') ? '#15803d' : status === 'IN_PROGRESS' ? '#3730a3' : '#92400e'),
                          border: '1px solid',
                          borderColor: isRejected 
                            ? '#fca5a5' 
                            : (status.includes('LISTO') || status.includes('COMPLETED') ? '#86efac' : status === 'IN_PROGRESS' ? '#c7d2fe' : '#fde68a')
                        }}>
                          {status}
                        </span>

                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                          #{num}
                        </span>
                      </div>

                      {/* Main Clickable Body -> Opens Detail */}
                      <div
                        onClick={() => setSelectedOrderForDetail(o)}
                        style={{ cursor: 'pointer' }}
                        title="Toca para ver la ficha técnica completa y seguimiento"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>
                              {brand} {model}
                            </strong>
                            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                              👤 {client}
                            </span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            {isRejected ? (
                              <div style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626' }}>
                                Diagnóstico: ${diagFee.toFixed(2)}
                              </div>
                            ) : quote > 0 ? (
                              <strong style={{ fontSize: '16px', color: '#2563eb' }}>
                                ${quote.toFixed(2)}
                              </strong>
                            ) : null}
                          </div>
                        </div>

                        {o.reported_fault && (
                          <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                            <b>Falla:</b> {o.reported_fault}
                          </div>
                        )}

                        {/* Items badges: Labor & Parts (truncated if high volume) */}
                        {o.items && o.items.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                            {o.items.slice(0, 3).map((it: any, idx: number) => {
                              const isLabor = (it.itemType || it.item_type) === 'LABOR';
                              return (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    background: isLabor ? '#e0e7ff' : '#fef3c7',
                                    color: isLabor ? '#3730a3' : '#92400e',
                                    border: `1px solid ${isLabor ? '#c7d2fe' : '#fde68a'}`
                                  }}
                                >
                                  {isLabor ? '🛠️' : '📦'} {it.quantity || 1}x {it.name} (${Number(it.subtotal || (it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)})
                                </span>
                              );
                            })}
                            {o.items.length > 3 && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1'
                                }}
                              >
                                +{o.items.length - 3} más ({o.items.length} total)
                              </span>
                            )}
                          </div>
                        )}

                        {isRejected && (
                          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 8px', borderRadius: '6px', fontSize: '11.5px', color: '#991b1b', marginTop: '6px' }}>
                            <b>❌ Cotización No Aprobada:</b> Pendiente de retiro con cobro de diagnóstico ($ {diagFee.toFixed(2)}).
                          </div>
                        )}
                      </div>

                      {/* Action Buttons: Ficha Técnica, QR, WhatsApp (+593), Cobrar */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForDetail(o)}
                          style={{
                            flex: 1,
                            padding: '8px 6px',
                            borderRadius: '8px',
                            border: '1px solid #2563eb',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px'
                          }}
                        >
                          📋 Ficha
                        </button>

                        <button
                          type="button"
                          onClick={() => setQrModalData({
                            orderNumber: num,
                            url: trackingUrl,
                            customerName: client,
                            customerPhone: formattedPhone
                          })}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            color: '#0f172a',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Mostrar Código QR para que el cliente lo escanee en mostrador"
                        >
                          📱 QR
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setWoPhotoModal(o);
                            setWoPhotoUrl('');
                            setWoPhotoCaption('');
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #fed7aa',
                            background: '#fff7ed',
                            color: '#ea580c',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Tomar y subir foto de la reparación con la cámara"
                        >
                          📸 Foto
                        </button>

                        {phone && (
                          <a
                            href={`https://wa.me/${formattedPhone}?text=${encodeURIComponent(
                              `¡Hola ${client}! 👋 Te saludamos de ${companyInfo?.name || 'Fixme'}.\n` +
                              `Tu equipo ${brand} ${model} (#${num}) se encuentra en estado: *${status}*.\n\n` +
                              `🔍 Puedes hacer seguimiento en vivo aquí:\n${trackingUrl}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid #bbf7d0',
                              background: '#f0fdf4',
                              color: '#16a34a',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '3px'
                            }}
                          >
                            💬 WhatsApp
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderToPay(o);
                            setWoPaymentAmount(dueAmount.toFixed(2));
                            setPosMode('WORK_ORDER');
                            setActiveTab('POS');
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: isRejected ? '#dc2626' : '#16a34a',
                            color: '#fff',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isRejected ? `🤝 Diagnóstico $${diagFee.toFixed(2)}` : `⚡ Cobrar $${dueAmount.toFixed(2)}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COBRO EXPRESS / POS MÓVIL (PRODUCTO, ORDEN O FACTURAS) */}
        {activeTab === 'POS' && (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                ⚡ Cobro Móvil & Facturas
              </h2>
              <small style={{ color: '#64748b', fontSize: '12px' }}>
                Selecciona si vas a cobrar una orden, vender productos o reenviar comprobantes
              </small>
            </div>

            {/* SEGMENTED CONTROL: 4 MODOS */}
            <div style={{
              display: 'flex',
              background: '#e2e8f0',
              padding: '3px',
              borderRadius: '12px',
              marginBottom: '14px',
              gap: '2px',
              overflowX: 'auto'
            }}>
              <button
                type="button"
                onClick={() => setPosMode('WORK_ORDER')}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '9px',
                  border: 'none',
                  background: posMode === 'WORK_ORDER' ? '#fff' : 'transparent',
                  color: posMode === 'WORK_ORDER' ? '#2563eb' : '#475569',
                  fontWeight: posMode === 'WORK_ORDER' ? 800 : 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                🛠️ Cobrar OT
              </button>

              <button
                type="button"
                onClick={() => setPosMode('PRODUCT')}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '9px',
                  border: 'none',
                  background: posMode === 'PRODUCT' ? '#fff' : 'transparent',
                  color: posMode === 'PRODUCT' ? '#2563eb' : '#475569',
                  fontWeight: posMode === 'PRODUCT' ? 800 : 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                📦 Producto
              </button>

              <button
                type="button"
                onClick={() => setPosMode('CUSTOM')}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '9px',
                  border: 'none',
                  background: posMode === 'CUSTOM' ? '#fff' : 'transparent',
                  color: posMode === 'CUSTOM' ? '#2563eb' : '#475569',
                  fontWeight: posMode === 'CUSTOM' ? 800 : 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                🔢 Cobro Libre
              </button>

              <button
                type="button"
                onClick={() => {
                  setPosMode('SALES_HISTORY');
                  loadSalesHistory();
                }}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '9px',
                  border: 'none',
                  background: posMode === 'SALES_HISTORY' ? '#fff' : 'transparent',
                  color: posMode === 'SALES_HISTORY' ? '#2563eb' : '#475569',
                  fontWeight: posMode === 'SALES_HISTORY' ? 800 : 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                🧾 Facturas
              </button>
            </div>

            {/* MODO 1: COBRO DE ORDEN DE TRABAJO */}
            {posMode === 'WORK_ORDER' && (
              <div>
                {!selectedOrderToPay ? (
                  <div>
                    <input
                      type="text"
                      placeholder="🔍 Buscar orden por N°, cliente o modelo..."
                      value={woPosSearch}
                      onChange={e => setWoPosSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        background: '#fff',
                        fontSize: '13px',
                        marginBottom: '12px',
                        boxSizing: 'border-box'
                      }}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {ordersToPay.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px 20px', background: '#fff', borderRadius: '12px', color: '#64748b' }}>
                          No hay órdenes pendientes de cobro
                        </div>
                      ) : (
                        ordersToPay.map(o => {
                          const isRejected = ['REJECTED', 'RECHAZADO', 'CANCELADO', 'CANCELLED'].includes(o.status);
                          const diagFee = Number(o.diagnostic_fee || o.diagnosticFee || 10);
                          const quote = Number(o.quote || 0);
                          const dueAmount = isRejected ? diagFee : (quote > 0 ? quote : diagFee);
                          const isReady = o.status === 'LISTO_ENTREGA' || o.status === 'COMPLETED';

                          return (
                            <div
                              key={o.id}
                              onClick={() => {
                                setSelectedOrderToPay(o);
                                setWoPaymentAmount(dueAmount.toFixed(2));
                                if (isRejected) setWoWarrantyDays(0);
                              }}
                              style={{
                                background: '#fff',
                                borderRadius: '12px',
                                border: '1.5px solid',
                                borderColor: isRejected ? '#fca5a5' : (isReady ? '#86efac' : '#e2e8f0'),
                                padding: '12px 14px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                boxShadow: isReady ? '0 2px 8px rgba(34,197,94,0.1)' : 'none'
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                                    #{o.order_number || o.orderNumber}
                                  </span>
                                  {isRejected ? (
                                    <span style={{ fontSize: '10px', background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: '8px', fontWeight: 800 }}>
                                      RECHAZADO / CANCELADO
                                    </span>
                                  ) : isReady ? (
                                    <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '8px', fontWeight: 800 }}>
                                      LISTO
                                    </span>
                                  ) : null}
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                                  {o.device_brand || o.deviceBrand} {o.device_model || o.deviceModel}
                                </div>
                                <small style={{ color: '#64748b', fontSize: '12px' }}>
                                  👤 {o.customer_name || o.customerName || 'Cliente'}
                                </small>
                                {isRejected && (
                                  <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '2px', fontWeight: 600 }}>
                                    Tarifa de diagnóstico técnico
                                  </div>
                                )}
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '16px', fontWeight: 900, color: isRejected ? '#dc2626' : '#16a34a' }}>
                                  ${dueAmount.toFixed(2)}
                                </div>
                                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>
                                  {isRejected ? 'Cobrar Diagnóstico →' : 'Cobrar →'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCheckoutWorkOrder} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(() => {
                      const isSelectedRejected = ['REJECTED', 'RECHAZADO', 'CANCELADO', 'CANCELLED'].includes(selectedOrderToPay.status);
                      const selectedDiagFee = Number(selectedOrderToPay.diagnostic_fee || selectedOrderToPay.diagnosticFee || 10);

                      return (
                        <>
                          <div style={{ background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                                ORDEN SELECCIONADA
                              </span>
                              <h3 style={{ margin: '2px 0', fontSize: '16px', color: '#0f172a' }}>
                                #{selectedOrderToPay.order_number || selectedOrderToPay.orderNumber} · {selectedOrderToPay.device_brand || selectedOrderToPay.deviceBrand} {selectedOrderToPay.device_model || selectedOrderToPay.deviceModel}
                              </h3>
                              <small style={{ color: '#475569' }}>
                                👤 {selectedOrderToPay.customer_name || selectedOrderToPay.customerName || 'Cliente'}
                              </small>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedOrderToPay(null)}
                              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer' }}
                            >
                              ✕ Cambiar
                            </button>
                          </div>

                          {isSelectedRejected && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: '#991b1b' }}>
                              <b>⚠️ Cobro de Tarifa de Diagnóstico:</b> El cliente canceló o no aprobó la cotización técnica. Se cobra únicamente la tarifa de diagnóstico acordada (${selectedDiagFee.toFixed(2)}) al retirar el equipo sin reparación.
                            </div>
                          )}

                          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                              {isSelectedRejected ? 'Tarifa de Diagnóstico a Cobrar ($) *' : 'Monto a Cobrar ($) *'}
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={woPaymentAmount}
                                onChange={e => setWoPaymentAmount(e.target.value)}
                                style={{ padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}
                              />
                            </label>

                            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                              Forma de Cobro
                              <select
                                value={woPaymentMethod}
                                onChange={e => setWoPaymentMethod(e.target.value)}
                                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                              >
                                <option value="CASH">💵 Efectivo</option>
                                <option value="DEUNA_QR">📱 DeUna QR</option>
                                <option value="CARD">💳 Tarjeta de Crédito / Débito</option>
                                <option value="TRANSFER">🏦 Transferencia Bancaria</option>
                              </select>
                            </label>

                            {isSelectedRejected ? (
                              <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px', color: '#64748b' }}>
                                🛡️ <b>Garantía:</b> 0 días (Cobro exclusivo de diagnóstico por equipo retirado sin reparación).
                              </div>
                            ) : (
                              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                                Garantía Oficial por Servicio
                                <select
                                  value={woWarrantyDays}
                                  onChange={e => setWoWarrantyDays(Number(e.target.value))}
                                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                >
                                  <option value={15}>15 Días de Garantía</option>
                                  <option value={30}>30 Días de Garantía (Recomendado)</option>
                                  <option value={60}>60 Días de Garantía</option>
                                  <option value={90}>90 Días de Garantía</option>
                                  <option value={180}>180 Días de Garantía</option>
                                </select>
                              </label>
                            )}
                          </div>

                          <button
                            type="submit"
                            disabled={submittingWoCheckout || !woPaymentAmount}
                            style={{
                              background: isSelectedRejected ? '#dc2626' : '#16a34a',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '12px',
                              padding: '14px',
                              fontSize: '15px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              boxShadow: isSelectedRejected ? '0 4px 12px rgba(220,38,38,0.3)' : '0 4px 12px rgba(22,163,74,0.3)'
                            }}
                          >
                            {submittingWoCheckout 
                              ? 'Procesando cobro...' 
                              : (isSelectedRejected ? `✓ Cobrar Diagnóstico ($${woPaymentAmount}) y Entregar Equipo` : `✓ Cobrar y Entregar Equipo ($${woPaymentAmount})`)}
                          </button>
                        </>
                      );
                    })()}
                  </form>
                )}
              </div>
            )}

            {/* MODO 2: VENTA DE PRODUCTO */}
            {posMode === 'PRODUCT' && (
              <div>
                <input
                  type="text"
                  placeholder="🔍 Buscar producto por nombre o SKU..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '13px',
                    marginBottom: '10px',
                    boxSizing: 'border-box'
                  }}
                />

                {/* Carrito Flotante */}
                {cart.length > 0 && (
                  <div style={{
                    background: '#fff',
                    borderRadius: '14px',
                    border: '2px solid #2563eb',
                    padding: '12px',
                    marginBottom: '14px',
                    boxShadow: '0 4px 14px rgba(37,99,235,0.1)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '13px', color: '#2563eb' }}>
                        🛒 Carrito ({cart.reduce((a, b) => a + b.qty, 0)} ítems)
                      </strong>
                      <button
                        type="button"
                        onClick={() => setCart([])}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Vaciar
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                      {cart.map(it => (
                        <div key={it.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a', maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {it.product.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => updateCartQty(it.product.id, -1)}
                              style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                            >
                              -
                            </button>
                            <span style={{ fontWeight: 800 }}>{it.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(it.product.id, 1)}
                              style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                            >
                              +
                            </button>
                            <span style={{ fontWeight: 700, color: '#16a34a', minWidth: '45px', textAlign: 'right' }}>
                              ${(Number(it.product.price || 0) * it.qty).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800 }}>TOTAL A COBRAR:</span>
                      <strong style={{ fontSize: '18px', fontWeight: 900, color: '#16a34a' }}>
                        ${cartTotal.toFixed(2)}
                      </strong>
                    </div>

                    {/* Forma de pago y cliente */}
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <select
                        value={productPaymentMethod}
                        onChange={e => setProductPaymentMethod(e.target.value)}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                      >
                        <option value="CASH">💵 Efectivo</option>
                        <option value="DEUNA_QR">📱 DeUna QR</option>
                        <option value="CARD">💳 Tarjeta</option>
                        <option value="TRANSFER">🏦 Transferencia</option>
                      </select>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="Nombre del cliente"
                          value={productCustomerName}
                          onChange={e => setProductCustomerName(e.target.value)}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                        />
                        <input
                          type="tel"
                          placeholder="WhatsApp (ej: 0991234567)"
                          value={productCustomerPhone}
                          onChange={e => setProductCustomerPhone(e.target.value)}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleCheckoutProducts}
                        disabled={submittingProductSale}
                        style={{
                          background: '#16a34a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '12px',
                          fontSize: '14px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {submittingProductSale ? 'Registrando...' : `✓ Finalizar Venta $${cartTotal.toFixed(2)}`}
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de Productos disponibles */}
                {loadingProducts ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                    Cargando catálogo...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', background: '#fff', borderRadius: '12px', color: '#64748b' }}>
                    No se encontraron productos
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {filteredProducts.map(p => {
                      const price = Number(p.price || 0);
                      const stock = p.stock !== undefined ? p.stock : (p.quantity || 0);

                      return (
                        <div
                          key={p.id}
                          style={{
                            background: '#fff',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '6px'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                              {p.name}
                            </div>
                            <small style={{ color: '#64748b', fontSize: '10.5px' }}>
                              {p.sku || 'SKU'} · Stock: <b>{stock}</b>
                            </small>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 900, color: '#16a34a' }}>
                              ${price.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => addToCart(p)}
                              style={{
                                background: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              + Agregar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* MODO 3: COBRO RÁPIDO LIBRE (TECLADO NUMÉRICO) */}
            {posMode === 'CUSTOM' && (
              <form onSubmit={handleFastSale} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #cbd5e1', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Monto Libre a Cobrar ($)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={posAmount}
                    onChange={e => setPosAmount(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      fontSize: '36px',
                      fontWeight: 900,
                      color: '#0f172a',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[5, 10, 20, 50].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPosAmount(v.toFixed(2))}
                      style={{
                        padding: '10px 0',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      +${v}
                    </button>
                  ))}
                </div>

                <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                    Concepto / Detalle
                    <input
                      type="text"
                      value={posConcept}
                      onChange={e => setPosConcept(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                    Celular del Cliente (Para enviar ticket por WhatsApp)
                    <input
                      type="tel"
                      placeholder="0999999999"
                      value={posClientPhone}
                      onChange={e => setPosClientPhone(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                    Forma de Cobro
                    <select
                      value={posPaymentMethod}
                      onChange={e => setPosPaymentMethod(e.target.value)}
                      style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="CASH">💵 Efectivo</option>
                      <option value="DEUNA_QR">📱 DeUna QR</option>
                      <option value="CARD">💳 Tarjeta / Payphone</option>
                    </select>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submittingSale || !posAmount}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '16px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(22,163,74,0.3)'
                  }}
                >
                  {submittingSale ? 'Procesando...' : `✓ Cobrar $${Number(posAmount || 0).toFixed(2)}`}
                </button>
              </form>
            )}

            {/* MODO 4: HISTORIAL DE VENTAS & REENVÍO DE TICKETS/FACTURAS */}
            {posMode === 'SALES_HISTORY' && (
              <div>
                <input
                  type="text"
                  placeholder="🔍 Buscar por cliente o número de factura..."
                  value={salesSearch}
                  onChange={e => setSalesSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '13px',
                    marginBottom: '10px',
                    boxSizing: 'border-box'
                  }}
                />

                {loadingSalesList ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                    Cargando ventas y facturas...
                  </div>
                ) : filteredSales.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', background: '#fff', borderRadius: '12px', color: '#64748b' }}>
                    No se encontraron ventas registradas
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredSales.map(s => {
                      const total = Number(s.total || 0);
                      const client = s.customer || s.customer_name || 'Consumidor Final';
                      const phone = s.customer_phone || '';
                      const dateStr = s.created_at ? new Date(s.created_at).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '';
                      const invNumber = s.invoice_number || `VTA-${String(s.id).substring(0, 6)}`;

                      return (
                        <div
                          key={s.id}
                          style={{
                            background: '#fff',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>
                              #{invNumber}
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: 900, color: '#16a34a' }}>
                              ${total.toFixed(2)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <strong style={{ fontSize: '13.5px', color: '#1e293b', display: 'block' }}>
                                👤 {client}
                              </strong>
                              <small style={{ color: '#64748b', fontSize: '11px' }}>
                                {dateStr} · {s.payment_methods || 'Efectivo'}
                              </small>
                            </div>
                            {s.invoice_sri_status === 'AUTORIZADO' && (
                              <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '8px', fontWeight: 800 }}>
                                SRI AUTORIZADA
                              </span>
                            )}
                          </div>

                          {/* Acciones de reenvío */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                            <button
                              type="button"
                              onClick={() => sendTicketByWhatsApp({
                                saleId: s.id,
                                invoice_number: s.invoice_number,
                                customerName: client,
                                customerPhone: phone,
                                amount: total,
                                paymentMethod: s.payment_methods || 'Efectivo',
                                date: dateStr
                              })}
                              style={{
                                flex: 1,
                                padding: '7px 8px',
                                borderRadius: '8px',
                                border: '1px solid #bbf7d0',
                                background: '#f0fdf4',
                                color: '#16a34a',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '3px'
                              }}
                            >
                              💬 Reenviar WhatsApp
                            </button>

                            <button
                              type="button"
                              onClick={() => sendInvoiceByEmail({
                                saleId: s.id,
                                customerName: client,
                                customerEmail: s.customer_email,
                                amount: total,
                                date: dateStr
                              })}
                              style={{
                                flex: 1,
                                padding: '7px 8px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                color: '#334155',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '3px'
                              }}
                            >
                              📧 Correo
                            </button>

                            <button
                              type="button"
                              onClick={() => setReceiptModalData({
                                type: 'PRODUCT_SALE',
                                saleId: s.id,
                                invoice_number: s.invoice_number,
                                customerName: client,
                                customerPhone: phone,
                                amount: total,
                                paymentMethod: s.payment_methods || 'Efectivo',
                                date: dateStr
                              })}
                              style={{
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: '1px solid #2563eb',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              📄 Ver Ticket
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PERFIL & MODO */}
        {activeTab === 'PROFILE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>👤</div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', color: '#0f172a' }}>
                {localStorage.getItem('tenantName') || 'Operador Fixme'}
              </h3>
              <span style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                ROL: {role}
              </span>
            </div>

            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>⚙️ Opciones del Dispositivo</h4>
              
              <button
                type="button"
                onClick={onSwitchToDesktop}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1.5px solid #2563eb',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                💻 Cambiar a Vista Escritorio (PC)
              </button>

              <button
                type="button"
                onClick={onLogout}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #fee2e2',
                  background: '#fff1f2',
                  color: '#e11d48',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🚪 Cerrar Sesión
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: FICHA TÉCNICA, INTERACCIÓN & SEGUIMIENTO COMPLETO DE ORDEN */}
      {selectedOrderForDetail && (
        <div className="modal-overlay" onClick={() => setSelectedOrderForDetail(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
            {/* Header Sticky */}
            <div className="modal-head" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, paddingBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 800 }}>FICHA TÉCNICA MÓVIL</span>
                <h3 style={{ fontSize: '16px', margin: '2px 0 0' }}>
                  #{selectedOrderForDetail.order_number || selectedOrderForDetail.orderNumber} · {selectedOrderForDetail.device_brand || selectedOrderForDetail.deviceBrand} {selectedOrderForDetail.device_model || selectedOrderForDetail.deviceModel}
                </h3>
              </div>
              <button className="close-button" onClick={() => setSelectedOrderForDetail(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '6px 0 16px' }}>
              
              {/* Badge de Estado y Botones de Transición Rápida */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>ESTADO DE LA ORDEN:</span>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe'
                  }}>
                    {selectedOrderForDetail.status}
                  </span>
                </div>

                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Cambiar estado en 1 toque:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '6px' }}>
                  {[
                    { key: 'EN_DIAGNOSTICO', label: '🔬 Diagnóstico', bg: '#eff6ff', col: '#1d4ed8' },
                    { key: 'COTIZADO', label: '💰 Cotizado', bg: '#fef3c7', col: '#92400e' },
                    { key: 'WAITING_PARTS', label: '⏳ Repuestos', bg: '#fff7ed', col: '#ea580c' },
                    { key: 'IN_PROGRESS', label: '🛠️ Reparando', bg: '#e0e7ff', col: '#3730a3' },
                    { key: 'EN_PRUEBAS', label: '🧪 Pruebas', bg: '#f3e8ff', col: '#6b21a8' },
                    { key: 'LISTO_ENTREGA', label: '✨ Listo Retiro', bg: '#dcfce7', col: '#166534' },
                    { key: 'DELIVERED', label: '🤝 Pagado', bg: '#ecfdf5', col: '#047857' },
                    { key: 'REJECTED', label: '❌ Rechazado', bg: '#fee2e2', col: '#991b1b' }
                  ].map(st => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => handleUpdateWoStatus(selectedOrderForDetail.id, st.key)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '8px',
                        border: selectedOrderForDetail.status === st.key ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.08)',
                        background: selectedOrderForDetail.status === st.key ? '#eff6ff' : st.bg,
                        color: selectedOrderForDetail.status === st.key ? '#1d4ed8' : st.col,
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: selectedOrderForDetail.status === st.key ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none'
                      }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Información del Cliente */}
              <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                  👤 CLIENTE
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                      {selectedOrderForDetail.customer_name || selectedOrderForDetail.customerName || 'Cliente'}
                    </strong>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      📞 {selectedOrderForDetail.customer_phone || selectedOrderForDetail.customerPhone || 'Sin teléfono'}
                    </div>
                  </div>

                  {selectedOrderForDetail.customer_phone && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <a
                        href={`tel:${selectedOrderForDetail.customer_phone}`}
                        style={{ padding: '6px 10px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', fontSize: '12px', fontWeight: 700, textDecoration: 'none', border: '1px solid #cbd5e1' }}
                      >
                        📞
                      </a>
                      <a
                        href={`https://wa.me/${formatEcuadorPhone(selectedOrderForDetail.customer_phone)}?text=${encodeURIComponent(
                          `Hola ${selectedOrderForDetail.customer_name || 'estimado/a'}, te saludamos de ${companyInfo?.name || 'FixmeTiendas'}. Te escribimos con respecto a tu orden #${selectedOrderForDetail.order_number || selectedOrderForDetail.orderNumber}.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: '6px 10px', borderRadius: '6px', background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: 700, textDecoration: 'none', border: '1px solid #bbf7d0' }}
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Falla Reportada & Diagnóstico Técnico Editable */}
              <form onSubmit={handleSaveOrderTechnicalDetails} style={{ background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                  🔬 DIAGNÓSTICO & PRESUPUESTO
                </span>

                {selectedOrderForDetail.reported_fault && (
                  <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', color: '#475569' }}>
                    <b>Falla reportada:</b> {selectedOrderForDetail.reported_fault}
                  </div>
                )}

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                  Diagnóstico Técnico / Trabajo Realizado:
                  <textarea
                    rows={3}
                    value={editDiagnosis}
                    onChange={e => setEditDiagnosis(e.target.value)}
                    placeholder="Escribe el diagnóstico, repuestos utilizados o pruebas hechas..."
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontFamily: 'inherit' }}
                  />
                </label>

                {/* Tarifa Base de Diagnóstico */}
                <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                      💵 Tarifa Base de Diagnóstico ($):
                    </label>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                      Se cobra si el cliente rechaza o cancela la cotización.
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={editDiagFee}
                    onChange={e => setEditDiagFee(e.target.value)}
                    style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 800, textAlign: 'right' }}
                  />
                </div>

                {/* Desglose de Cotización: Mano de Obra y Repuestos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                      📋 ÍTEMS DE COTIZACIÓN
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => addEditItem('LABOR')}
                        style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #c7d2fe', background: '#e0e7ff', color: '#3730a3', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        + 🛠️ Mano Obra
                      </button>
                      <button
                        type="button"
                        onClick={() => addEditItem('PART')}
                        style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        + 📦 Repuesto
                      </button>
                    </div>
                  </div>

                  {editItems.map((it, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select
                          value={it.itemType}
                          onChange={e => updateEditItem(idx, 'itemType', e.target.value)}
                          style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 700 }}
                        >
                          <option value="LABOR">🛠️ Mano de Obra</option>
                          <option value="PART">📦 Repuesto</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Descripción o repuesto..."
                          value={it.name}
                          onChange={e => updateEditItem(idx, 'name', e.target.value)}
                          style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                        />
                        <button
                          type="button"
                          onClick={() => removeEditItem(idx)}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span>Cant:</span>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={e => updateEditItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                            style={{ width: '40px', padding: '3px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}
                          />
                          <span>P. Unit:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.unitPrice}
                            onChange={e => updateEditItem(idx, 'unitPrice', Number(e.target.value))}
                            style={{ width: '60px', padding: '3px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'right' }}
                          />
                        </div>
                        <strong style={{ color: '#2563eb' }}>
                          ${(Number(it.quantity || 1) * Number(it.unitPrice || 0)).toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  ))}

                  {editItems.length === 0 && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '6px', background: '#f8fafc', borderRadius: '6px' }}>
                      Sin desglose de ítems aún. Agrega Mano de Obra o Repuestos arriba.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#eff6ff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <label style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>
                    <span>Total Presupuesto ($):</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editQuote}
                      onChange={e => setEditQuote(e.target.value)}
                      placeholder="0.00"
                      style={{ width: '90px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '14px', fontWeight: 800, textAlign: 'right', color: '#1e40af' }}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={updatingOrderDetails}
                  style={{
                    padding: '11px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {updatingOrderDetails ? 'Guardando...' : '✓ Guardar Ficha y Cotización'}
                </button>
              </form>

              {/* SECCIÓN: SEGUIMIENTO DEL CLIENTE & CÓDIGO QR */}
              <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', display: 'block', marginBottom: '4px' }}>
                  📱 SEGUIMIENTO EN VIVO & CÓDIGO QR
                </span>
                <p style={{ fontSize: '12px', color: '#334155', margin: '0 0 10px 0' }}>
                  El cliente puede seguir el estado de su equipo y ver las fotos de inspección en vivo desde su celular sin contraseñas.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const num = selectedOrderForDetail.order_number || selectedOrderForDetail.orderNumber;
                      const trackingUrl = `${window.location.origin}/#order/${encodeURIComponent(num)}`;
                      setQrModalData({
                        orderNumber: num,
                        url: trackingUrl,
                        customerName: selectedOrderForDetail.customer_name || 'Cliente',
                        customerPhone: selectedOrderForDetail.customer_phone || ''
                      });
                    }}
                    style={{
                      padding: '9px 8px',
                      borderRadius: '8px',
                      border: '1px solid #2563eb',
                      background: '#fff',
                      color: '#2563eb',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>📱</span> Ver Código QR
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const num = selectedOrderForDetail.order_number || selectedOrderForDetail.orderNumber;
                      const trackingUrl = `${window.location.origin}/#order/${encodeURIComponent(num)}`;
                      navigator.clipboard.writeText(trackingUrl);
                      if (notify) notify('✓ Enlace copiado al portapapeles');
                    }}
                    style={{
                      padding: '9px 8px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#334155',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>📋</span> Copiar Link
                  </button>
                </div>

                {selectedOrderForDetail.customer_phone && (
                  <button
                    type="button"
                    onClick={() => {
                      const num = selectedOrderForDetail.order_number || selectedOrderForDetail.orderNumber;
                      const trackingUrl = `${window.location.origin}/#order/${encodeURIComponent(num)}`;
                      const phone = formatEcuadorPhone(selectedOrderForDetail.customer_phone);
                      const msg = encodeURIComponent(
                        `¡Hola ${selectedOrderForDetail.customer_name || 'Cliente'}! 👋 Te saludamos de ${companyInfo?.name || 'FixmeTiendas'}.\n\n` +
                        `Tu equipo ${selectedOrderForDetail.device_brand || ''} ${selectedOrderForDetail.device_model || ''} se encuentra en estado: *${selectedOrderForDetail.status}*.\n\n` +
                        `🔍 Puedes consultar el seguimiento en vivo, fotos de diagnóstico y presupuesto aquí:\n${trackingUrl}\n\n` +
                        `¡Gracias por confiar en nuestro servicio técnico! 🛠️`
                      );
                      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                    }}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#16a34a',
                      color: '#fff',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>💬</span> Enviar Link de Seguimiento por WhatsApp
                  </button>
                )}
              </div>

              {/* FOTOS TRUST-CAM */}
              <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                    📸 EVIDENCIAS FOTOGRÁFICAS (TRUST-CAM)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setWoPhotoModal(selectedOrderForDetail);
                      setWoPhotoUrl('');
                      setWoPhotoCaption('');
                    }}
                    style={{
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Tomar Foto
                  </button>
                </div>

                {loadingDetailImages ? (
                  <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '10px' }}>
                    Cargando fotos...
                  </div>
                ) : detailOrderImages.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                    No hay fotos registradas aún para este equipo
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {detailOrderImages.map((img, idx) => (
                      <div key={img.id || idx} style={{ position: 'relative' }}>
                        <img
                          src={img.image_url || img.imageUrl}
                          alt="Trust cam"
                          style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                          onClick={() => window.open(img.image_url || img.imageUrl, '_blank')}
                        />
                        <span style={{
                          position: 'absolute',
                          bottom: '3px',
                          left: '3px',
                          background: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          fontSize: '8px',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}>
                          {img.stage}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botón Flotante para Cobrar Orden en POS */}
              {(() => {
                const isRejected = ['REJECTED', 'RECHAZADO', 'CANCELADO', 'CANCELLED'].includes(selectedOrderForDetail.status);
                const diagFee = Number(selectedOrderForDetail.diagnostic_fee || selectedOrderForDetail.diagnosticFee || editDiagFee || 10);
                const quoteVal = Number(selectedOrderForDetail.quote || editQuote || 0);
                const dueVal = isRejected ? diagFee : (quoteVal > 0 ? quoteVal : diagFee);

                return (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderToPay(selectedOrderForDetail);
                      setWoPaymentAmount(dueVal.toFixed(2));
                      if (isRejected) setWoWarrantyDays(0);
                      setSelectedOrderForDetail(null);
                      setPosMode('WORK_ORDER');
                      setActiveTab('POS');
                    }}
                    style={{
                      padding: '13px',
                      borderRadius: '10px',
                      border: 'none',
                      background: isRejected ? '#dc2626' : '#16a34a',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: isRejected ? '0 4px 12px rgba(220,38,38,0.25)' : '0 4px 12px rgba(22,163,74,0.25)'
                    }}
                  >
                    <span>{isRejected ? '🤝' : '⚡'}</span>
                    <span>
                      {isRejected 
                        ? `Cobrar Tarifa Diagnóstico ($${diagFee.toFixed(2)}) y Retirar` 
                        : `Cobrar Orden en Mostrador ($${dueVal.toFixed(2)})`}
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CÓDIGO QR PARA ESCANEO DEL CLIENTE */}
      {qrModalData && (
        <div className="modal-overlay" onClick={() => setQrModalData(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', width: '90vw', textAlign: 'center', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                Escanea para Seguimiento en Vivo
              </strong>
              <button className="close-button" onClick={() => setQrModalData(null)}>✕</button>
            </div>

            <div style={{
              background: '#fff',
              padding: '16px',
              borderRadius: '16px',
              display: 'inline-block',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '2px solid #e2e8f0',
              marginBottom: '12px'
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(qrModalData.url)}`}
                alt="QR Tracking"
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>

            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              Orden #{qrModalData.orderNumber}
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.4 }}>
              Apunta la cámara del celular al código QR para ver el estado, fotos de inspección y presupuesto sin contraseñas.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(qrModalData.url);
                  if (notify) notify('✓ Enlace copiado al portapapeles');
                }}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                📋 Copiar Enlace Directo
              </button>

              {qrModalData.customerPhone && (
                <button
                  type="button"
                  onClick={() => {
                    const phone = formatEcuadorPhone(qrModalData.customerPhone);
                    const msg = encodeURIComponent(
                      `¡Hola ${qrModalData.customerName}! 👋 Te enviamos el código y enlace para el seguimiento de tu equipo (Orden #${qrModalData.orderNumber}):\n${qrModalData.url}\n\n¡Gracias por tu confianza!`
                    );
                    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                  }}
                  style={{
                    padding: '11px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#16a34a',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  💬 Enviar Enlace por WhatsApp (+593)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: COMPROBANTE / FACTURA EMITIDA */}
      {receiptModalData && (
        <div className="modal-overlay" onClick={() => setReceiptModalData(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '92vw', padding: '18px' }}>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '32px', marginBottom: '4px' }}>🧾</div>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>
                ¡Comprobante Emitido con Éxito!
              </h3>
              <small style={{ color: '#16a34a', fontWeight: 700 }}>
                {receiptModalData.type === 'WORK_ORDER' ? 'Orden de Trabajo Cobrada' : 'Venta Registrada'}
              </small>
            </div>

            {/* Tarjeta del Ticket */}
            <div style={{
              background: '#f8fafc',
              border: '1.5px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '14px',
              fontFamily: 'monospace',
              fontSize: '12.5px',
              color: '#1e293b',
              marginBottom: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                {companyInfo?.name || localStorage.tenantName || 'FIXMETIENDAS'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cliente:</span>
                <b>{receiptModalData.customerName || 'Cliente'}</b>
              </div>

              {receiptModalData.device && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Equipo:</span>
                  <b>{receiptModalData.device}</b>
                </div>
              )}

              {receiptModalData.orderNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Orden N°:</span>
                  <b>#{receiptModalData.orderNumber}</b>
                </div>
              )}

              {receiptModalData.items && receiptModalData.items.map((it: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <span>{it.qty}x {it.name}</span>
                  <span>${(it.qty * it.price).toFixed(2)}</span>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '6px', fontSize: '14px' }}>
                <strong>TOTAL PAGADO:</strong>
                <strong style={{ color: '#16a34a' }}>${Number(receiptModalData.amount || 0).toFixed(2)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                <span>Método de pago:</span>
                <span>{receiptModalData.paymentMethod}</span>
              </div>

              {receiptModalData.warrantyDays && (
                <div style={{ background: '#f0fdf4', padding: '4px 6px', borderRadius: '4px', color: '#15803d', fontSize: '11px', textAlign: 'center', marginTop: '4px' }}>
                  🛡️ Garantía Oficial: {receiptModalData.warrantyDays} días ({receiptModalData.warrantyCode})
                </div>
              )}
            </div>

            {/* Acciones para Compartir */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => sendTicketByWhatsApp(receiptModalData)}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#16a34a',
                  color: '#fff',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>💬</span> Enviar Ticket por WhatsApp (+593)
              </button>

              <button
                type="button"
                onClick={() => sendInvoiceByEmail(receiptModalData)}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>📧</span> Enviar Factura por Correo
              </button>

              <button
                type="button"
                onClick={() => setReceiptModalData(null)}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ✓ Aceptar y Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: NUEVA ORDEN DE TRABAJO TÉCNICA */}
      {showNewOrderModal && (
        <div className="modal-overlay" onClick={() => setShowNewOrderModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-head" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '16px', margin: 0 }}>📋 Ingresar Equipo a Taller</h3>
              <button className="close-button" onClick={() => setShowNewOrderModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateWorkOrder} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px 0' }}>
              
              {/* Selector de Cliente */}
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>DATOS DEL CLIENTE</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setOrderCustomerMode('NEW')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        borderRadius: '6px',
                        border: 'none',
                        background: orderCustomerMode === 'NEW' ? '#2563eb' : '#e2e8f0',
                        color: orderCustomerMode === 'NEW' ? '#fff' : '#475569',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      + Nuevo
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderCustomerMode('EXISTING')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        borderRadius: '6px',
                        border: 'none',
                        background: orderCustomerMode === 'EXISTING' ? '#2563eb' : '#e2e8f0',
                        color: orderCustomerMode === 'EXISTING' ? '#fff' : '#475569',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Buscar
                    </button>
                  </div>
                </div>

                {orderCustomerMode === 'NEW' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="text"
                      required
                      placeholder="Nombre del Cliente *"
                      value={newCustomerName}
                      onChange={e => setNewCustomerName(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="tel"
                        placeholder="Celular (ej: 0991234567)"
                        value={newCustomerPhone}
                        onChange={e => setNewCustomerPhone(e.target.value)}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                      <input
                        type="text"
                        placeholder="Cédula / RUC (opc)"
                        value={newCustomerIdNumber}
                        onChange={e => setNewCustomerIdNumber(e.target.value)}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="🔍 Buscar cliente por nombre o teléfono..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }}
                    />
                    <select
                      value={selectedCustomerId}
                      onChange={e => setSelectedCustomerId(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="">-- Selecciona un cliente --</option>
                      {customers
                        .filter(c => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch))
                        .slice(0, 15)
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Datos del Equipo */}
              <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>EQUIPO A REPARAR</span>

                <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Huawei', 'HP', 'Lenovo', 'Dell', 'Otro'].map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setNewDeviceBrand(b)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '14px',
                        border: '1px solid',
                        borderColor: newDeviceBrand === b ? '#2563eb' : '#cbd5e1',
                        background: newDeviceBrand === b ? '#eff6ff' : '#fff',
                        color: newDeviceBrand === b ? '#1d4ed8' : '#475569',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    required
                    placeholder="Modelo (ej: iPhone 13, Galaxy A54) *"
                    value={newDeviceModel}
                    onChange={e => setNewDeviceModel(e.target.value)}
                    style={{ flex: 2, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                  <input
                    type="text"
                    placeholder="Serie / IMEI (opc)"
                    value={newSerialNumber}
                    onChange={e => setNewSerialNumber(e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>Fallas comunes:</span>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {['Pantalla Rota', 'Batería Agotada', 'No Enciende', 'Puerto de Carga', 'Mojado', 'Mantenimiento'].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setNewReportedFault(f)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  placeholder="Detalle de la falla reportada por el cliente..."
                  value={newReportedFault}
                  onChange={e => setNewReportedFault(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', boxSizing: 'border-box' }}
                />

                {/* Tarifa Base de Diagnóstico */}
                <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                      💵 Tarifa de Diagnóstico ($):
                    </label>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                      Monto si el cliente no aprueba la cotización.
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={newDiagnosticFee}
                    onChange={e => setNewDiagnosticFee(e.target.value)}
                    style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 800, textAlign: 'right' }}
                  />
                </div>

                {/* Desglose de Cotización / Ítems */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                      🛠️ PRESUPUESTO INICIAL (OPCIONAL)
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => addNewOrderItem('LABOR')}
                        style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #c7d2fe', background: '#e0e7ff', color: '#3730a3', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        + 🛠️ Mano Obra
                      </button>
                      <button
                        type="button"
                        onClick={() => addNewOrderItem('PART')}
                        style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        + 📦 Repuesto
                      </button>
                    </div>
                  </div>

                  {newOrderItems.map((it, idx) => (
                    <div key={idx} style={{ background: '#fff', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select
                          value={it.itemType}
                          onChange={e => updateNewOrderItem(idx, 'itemType', e.target.value)}
                          style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 700 }}
                        >
                          <option value="LABOR">🛠️ Mano de Obra</option>
                          <option value="PART">📦 Repuesto</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Descripción o repuesto..."
                          value={it.name}
                          onChange={e => updateNewOrderItem(idx, 'name', e.target.value)}
                          style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                        />
                        <button
                          type="button"
                          onClick={() => removeNewOrderItem(idx)}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 800 }}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span>Cant:</span>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={e => updateNewOrderItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                            style={{ width: '40px', padding: '3px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}
                          />
                          <span>P. Unit:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.unitPrice}
                            onChange={e => updateNewOrderItem(idx, 'unitPrice', Number(e.target.value))}
                            style={{ width: '60px', padding: '3px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'right' }}
                          />
                        </div>
                        <strong style={{ color: '#2563eb' }}>
                          ${(Number(it.quantity || 1) * Number(it.unitPrice || 0)).toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Total Presupuesto Estimado:</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newInitialQuote}
                      onChange={e => setNewInitialQuote(e.target.value)}
                      style={{ width: '85px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 800, textAlign: 'right' }}
                    />
                  </div>
                </div>
              </div>

              {/* Checklist Rápido de Recepción */}
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>INSPECCIÓN INICIAL (30 SEGUNDOS)</span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    ¿Enciende?
                    <select
                      value={intakeChecklist.powersOn}
                      onChange={e => setIntakeChecklist({ ...intakeChecklist, powersOn: e.target.value })}
                      style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="YES">✓ Sí enciende</option>
                      <option value="NO">✗ No enciende</option>
                      <option value="INTERMITTENT">Intermitente</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    Estado Pantalla
                    <select
                      value={intakeChecklist.screenStatus}
                      onChange={e => setIntakeChecklist({ ...intakeChecklist, screenStatus: e.target.value })}
                      style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="OK">✓ Intacta / OK</option>
                      <option value="BROKEN">⚡ Rota / Trizada</option>
                      <option value="NO_IMAGE">Sin Imagen</option>
                    </select>
                  </label>
                </div>

                <input
                  type="text"
                  placeholder="PIN / Patrón de desbloqueo (opcional)"
                  value={intakeChecklist.passcode}
                  onChange={e => setIntakeChecklist({ ...intakeChecklist, passcode: e.target.value })}
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              {/* Foto de Recepción con Cámara del Celular */}
              <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                  📸 FOTO DE RECEPCIÓN (TRUST-CAM)
                </span>
                
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1.5px dashed #2563eb',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}>
                  📷 Tomar Foto con Cámara
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const comp = await compressImageFile(file);
                          setIntakePhoto(comp);
                        } catch {
                          const reader = new FileReader();
                          reader.onload = ev => setIntakePhoto(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }
                    }}
                  />
                </label>

                {intakePhoto && (
                  <div style={{ position: 'relative', marginTop: '8px' }}>
                    <img
                      src={intakePhoto}
                      alt="Foto de recepción"
                      style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                    <button
                      type="button"
                      onClick={() => setIntakePhoto(null)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={creatingOrder}
                style={{
                  marginTop: '6px',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
                }}
              >
                {creatingOrder ? 'Creando orden técnica...' : '✓ Ingresar Orden a Taller'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: TRUST-CAM FOTO */}
      {woPhotoModal && (
        <div className="modal-overlay" onClick={() => setWoPhotoModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '92vw' }}>
            <div className="modal-head">
              <h3 style={{ fontSize: '16px' }}>📸 Foto Trust-Cam #{woPhotoModal.order_number || woPhotoModal.orderNumber}</h3>
              <button className="close-button" onClick={() => setWoPhotoModal(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px 0' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                Etapa de la Reparación
                <select
                  value={woPhotoStage}
                  onChange={e => setWoPhotoStage(e.target.value)}
                  style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="RECEPTION">📥 Recepción Inicial</option>
                  <option value="DIAGNOSIS">🔬 Diagnóstico / Microscopio</option>
                  <option value="PARTS">⏳ Repuestos / Piezas Nuevas</option>
                  <option value="REPAIR">🛠️ Proceso de Reparación</option>
                  <option value="TESTING">⚡ Pruebas y Control Calidad</option>
                  <option value="COMPLETED">✨ Equipo Listo / Reparado</option>
                </select>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                border: '1.5px dashed #2563eb',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}>
                📷 Disparar Cámara del Celular
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const comp = await compressImageFile(file);
                        setWoPhotoUrl(comp);
                      } catch {
                        const reader = new FileReader();
                        reader.onload = ev => setWoPhotoUrl(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }
                  }}
                />
              </label>

              {woPhotoUrl && (
                <div style={{ position: 'relative' }}>
                  <img
                    src={woPhotoUrl}
                    alt="Evidencia"
                    style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="button"
                    onClick={() => setWoPhotoUrl('')}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <input
                type="text"
                placeholder="Descripción (ej: flex de pantalla roto)"
                value={woPhotoCaption}
                onChange={e => setWoPhotoCaption(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />

              <button
                type="button"
                onClick={handleSubmitWoPhoto}
                disabled={submittingWoPhoto || !woPhotoUrl}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {submittingWoPhoto ? 'Subiendo...' : '✓ Guardar Foto Trust-Cam'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: EVIDENCIA DE ENTREGA DELIVERY */}
      {evidenceModalDelivery && (
        <div className="modal-overlay" onClick={() => setEvidenceModalDelivery(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '92vw' }}>
            <div className="modal-head">
              <h3 style={{ fontSize: '16px' }}>📸 Foto de Evidencia de Entrega</h3>
              <button className="close-button" onClick={() => setEvidenceModalDelivery(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px 0' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                Toma una foto del paquete recibido por <b>{evidenceModalDelivery.recipient_name || evidenceModalDelivery.customer_name || 'el cliente'}</b>.
              </p>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '14px',
                borderRadius: '10px',
                border: '2px dashed #16a34a',
                background: '#f0fdf4',
                color: '#15803d',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer'
              }}>
                📷 Abrir Cámara del Teléfono
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const comp = await compressImageFile(file);
                        setEvidencePhoto(comp);
                      } catch {
                        const reader = new FileReader();
                        reader.onload = ev => setEvidencePhoto(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }
                  }}
                />
              </label>

              {evidencePhoto && (
                <div style={{ position: 'relative' }}>
                  <img
                    src={evidencePhoto}
                    alt="Evidencia entrega"
                    style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="button"
                    onClick={() => setEvidencePhoto(null)}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <input
                type="text"
                placeholder="Observación final (opcional, ej: recibido en garita)"
                value={evidenceNotes}
                onChange={e => setEvidenceNotes(e.target.value)}
                style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />

              <button
                type="button"
                onClick={handleSubmitEvidence}
                disabled={submittingEvidence}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#16a34a',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {submittingEvidence ? 'Guardando entrega...' : '✓ Confirmar Entrega Realizada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: NUEVA ENTREGA DELIVERY */}
      {showNewDeliveryModal && (
        <div className="modal-overlay" onClick={() => setShowNewDeliveryModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '92vw' }}>
            <div className="modal-head">
              <h3 style={{ fontSize: '16px' }}>📦 Nuevo Despacho Delivery</h3>
              <button className="close-button" onClick={() => setShowNewDeliveryModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateDelivery} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px 0' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                Nombre del Cliente / Destinatario *
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={newRecipientName}
                  onChange={e => setNewRecipientName(e.target.value)}
                  style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                Teléfono Celular
                <input
                  type="tel"
                  placeholder="0999999999"
                  value={newRecipientPhone}
                  onChange={e => setNewRecipientPhone(e.target.value)}
                  style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                Dirección Completa de Entrega *
                <input
                  type="text"
                  required
                  placeholder="Ej. Av. 6 de Diciembre y Orellana, Edif. Torre Azul"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                Instrucciones / Referencias
                <input
                  type="text"
                  placeholder="Ej. Timbre 4B, frente a la farmacia"
                  value={newDeliveryNotes}
                  onChange={e => setNewDeliveryNotes(e.target.value)}
                  style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                Costo de Envío ($)
                <input
                  type="number"
                  step="0.25"
                  value={newShippingCost}
                  onChange={e => setNewShippingCost(e.target.value)}
                  style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </label>

              <button
                type="submit"
                disabled={creatingDelivery}
                style={{
                  marginTop: '6px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {creatingDelivery ? 'Guardando...' : '✓ Crear Orden de Entrega'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* BARRA INFERIOR FIJA (BOTTOM NAVIGATION BAR) - 5 PESTAÑAS */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '6px 0 max(8px, env(safe-area-inset-bottom, 8px))',
        zIndex: 40,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.06)'
      }}>
        {/* TAB 0: DASHBOARD */}
        <button
          type="button"
          onClick={() => setActiveTab('DASHBOARD')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: activeTab === 'DASHBOARD' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            padding: '4px 8px'
          }}
        >
          <span style={{ fontSize: '19px' }}>📊</span>
          <span style={{ fontSize: '10px', fontWeight: activeTab === 'DASHBOARD' ? 800 : 600 }}>Resumen</span>
        </button>

        {/* TAB 1: ENTREGAS */}
        <button
          type="button"
          onClick={() => setActiveTab('DELIVERIES')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: activeTab === 'DELIVERIES' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            padding: '4px 8px',
            position: 'relative'
          }}
        >
          <span style={{ fontSize: '19px' }}>🚚</span>
          <span style={{ fontSize: '10px', fontWeight: activeTab === 'DELIVERIES' ? 800 : 600 }}>Entregas</span>
          {pendingDeliveriesCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '8px',
              background: '#ef4444',
              color: '#fff',
              borderRadius: '10px',
              fontSize: '9px',
              fontWeight: 800,
              padding: '1px 5px'
            }}>
              {pendingDeliveriesCount}
            </span>
          )}
        </button>

        {/* TAB 2: TALLER */}
        <button
          type="button"
          onClick={() => setActiveTab('WORK_ORDERS')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: activeTab === 'WORK_ORDERS' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            padding: '4px 8px',
            position: 'relative'
          }}
        >
          <span style={{ fontSize: '19px' }}>🛠️</span>
          <span style={{ fontSize: '10px', fontWeight: activeTab === 'WORK_ORDERS' ? 800 : 600 }}>Taller</span>
          {activeOrdersCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '8px',
              background: '#2563eb',
              color: '#fff',
              borderRadius: '10px',
              fontSize: '9px',
              fontWeight: 800,
              padding: '1px 5px'
            }}>
              {activeOrdersCount}
            </span>
          )}
        </button>

        {/* TAB 3: COBRAR */}
        <button
          type="button"
          onClick={() => setActiveTab('POS')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: activeTab === 'POS' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            padding: '4px 8px'
          }}
        >
          <span style={{ fontSize: '19px' }}>⚡</span>
          <span style={{ fontSize: '10px', fontWeight: activeTab === 'POS' ? 800 : 600 }}>Cobrar</span>
        </button>

        {/* TAB 4: PERFIL */}
        <button
          type="button"
          onClick={() => setActiveTab('PROFILE')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: activeTab === 'PROFILE' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            padding: '4px 8px'
          }}
        >
          <span style={{ fontSize: '19px' }}>👤</span>
          <span style={{ fontSize: '10px', fontWeight: activeTab === 'PROFILE' ? 800 : 600 }}>Mi Perfil</span>
        </button>
      </nav>
    </div>
  );
}
