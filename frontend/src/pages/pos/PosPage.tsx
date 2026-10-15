import React from 'react';
import { Any, getBranchId } from '../../sharedConfig';
import { SriRideModal } from '../../sriRideModal';
import { saveCatalogLocally, getCatalogLocally, saveCustomersLocally, getCustomersLocally, queueOfflineSale, getPendingSales, clearPendingSales, OfflineSale } from '../../offlineDb';
import { ThermalTicketModal, QuickCustomerModal } from '../../commercialModals';
import { DeUnaModal } from '../../deunaModal';
import { PayphoneModal } from '../../payphoneModal';
import { TicketFormatSelector, TicketPaperWidth, getStoredPaperWidth, setStoredPaperWidth, printTicketElement, getCompanyReceiptInfo } from '../../ticketPrinter';
import { Search, Check, QrCode, AlertTriangle, CreditCard, Banknote, FileText, ArrowRightLeft, PauseCircle, PlayCircle, Trash2, Clock, ShoppingCart } from 'lucide-react';
import { SlideOverDrawer } from '../../components/ui/ModernUiKit';

export function POS({api, notify, companyInfo, branchId: propBranchId}: {api: (u:string,o?:RequestInit)=>Promise<Response>, notify: (s:string)=>void, companyInfo?: Any, branchId?: string}){
const branchId = propBranchId || getBranchId();
  const [products, setProducts] = React.useState<Any[]>([]);
  const [customers, setCustomers] = React.useState<Any[]>([]);
  const [cats, setCats] = React.useState<Any[]>([]);
  const [cart, setCart] = React.useState<Any[]>([]);
  const [search, setSearch] = React.useState('');
  const deferredSearch = React.useDeferredValue(search);
  const [parkedSales, setParkedSales] = React.useState<Any[]>(() => {
    try { return JSON.parse(localStorage.getItem('fixme_pos_parked') || '[]'); } catch { return []; }
  });
  const [showParkedDrawer, setShowParkedDrawer] = React.useState(false);
  const [selectedCat, setSelectedCat] = React.useState('');

  // Omnichannel & Delivery states
  const [channel, setChannel] = React.useState<'STORE'|'ONLINE'>('STORE');
  const [fulfillment, setFulfillment] = React.useState<'PICKUP'|'DELIVERY'>('PICKUP');
  const [delivery, setDelivery] = React.useState({
    recipientName: '',
    recipientPhone: '',
    address: '',
    notes: '',
    courier: '',
    shippingCost: '0'
  });

  const [customerId, setCustomerId] = React.useState('');
  const [warrantyDays, setWarrantyDays] = React.useState('0');

  // Cash Session & Shift Enforcement
  const [cashSession, setCashSession] = React.useState<Any | null>(null);
  const [showOpenCashModal, setShowOpenCashModal] = React.useState(false);
  const [openingFund, setOpeningFund] = React.useState('50.00');
  const [openingBusy, setOpeningBusy] = React.useState(false);

  // Payment methods
  const [payMethod, setPayMethod] = React.useState<'CASH'|'CARD'|'TRANSFER'|'CREDIT'|'SPLIT'|'DEUNA'|'PAYPHONE'>('CASH');
  const [cashTendered, setCashTendered] = React.useState('');
  const [splitAmounts, setSplitAmounts] = React.useState({ CASH: '', CARD: '', TRANSFER: '' });
  const [showDeUnaModal, setShowDeUnaModal] = React.useState(false);
  const [deUnaDetails, setDeUnaDetails] = React.useState<Any | null>(null);
  const [showPayphoneModal, setShowPayphoneModal] = React.useState(false);
  const [payphoneDetails, setPayphoneDetails] = React.useState<Any | null>(null);

  // Dual Invoice & Offline POS states
  const [invoiceType, setInvoiceType] = React.useState<'INTERNAL_TICKET' | 'SRI_INVOICE'>('INTERNAL_TICKET');
  const [sriTaxRate, setSriTaxRate] = React.useState<15 | 0>(15);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [pendingOffline, setPendingOffline] = React.useState<OfflineSale[]>([]);
  const [syncingOffline, setSyncingOffline] = React.useState(false);
  const [showRideModalId, setShowRideModalId] = React.useState<string | null>(null);

  const [busy, setBusy] = React.useState(false);
  const [receiptModal, setReceiptModal] = React.useState<Any|null>(null);
  const [showQuickCust, setShowQuickCust] = React.useState(false);
  const [discount, setDiscount] = React.useState('0');
  const [showThermalTicket, setShowThermalTicket] = React.useState(false);
  const [ticketPaperWidth, setTicketPaperWidth] = React.useState<TicketPaperWidth>(getStoredPaperWidth());

  const load = React.useCallback(() => {
    if (navigator.onLine) {
      api(`/api/products?branchId=${branchId}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setProducts(data);
          saveCatalogLocally(data).catch(() => {});
        })
        .catch(() => {
          getCatalogLocally().then(setProducts).catch(() => {});
        });
      api('/api/customers')
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setCustomers(data);
          saveCustomersLocally(data).catch(() => {});
        })
        .catch(() => {
          getCustomersLocally().then(setCustomers).catch(() => {});
        });
      api('/api/categories').then(r => r.ok ? r.json() : []).then(setCats).catch(() => {});
      api(`/api/cash/current?branchId=${branchId}`)
        .then(r => r.ok ? r.json() : null)
        .then(c => setCashSession(c && c.id ? c : null))
        .catch(() => setCashSession(null));
    } else {
      getCatalogLocally().then(setProducts).catch(() => {});
      getCustomersLocally().then(setCustomers).catch(() => {});
    }
    getPendingSales().then(setPendingOffline).catch(() => {});
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  async function submitOpenCash(e: React.FormEvent) {
    e.preventDefault();
    setOpeningBusy(true);
    try {
      const fund = parseFloat(openingFund) || 0;
      const r = await api(`/api/cash/open?branchId=${branchId}`, {
        method: 'POST',
        body: JSON.stringify({ openingCash: fund, amounts: { CASH: fund } })
      });
      if (r.ok) {
        const data = await r.json();
        setCashSession(data);
        setShowOpenCashModal(false);
        notify('¡Caja abierta exitosamente! Ya puedes procesar ventas.');
      } else {
        notify('Error al abrir la caja. Verifica tus permisos.');
      }
    } catch (err: any) {
      notify('Error de conexión al abrir la caja: ' + err.message);
    } finally {
      setOpeningBusy(false);
    }
  }

  // Online / Offline network listeners
  React.useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      notify('Conexión reestablecida. Sincronizando ventas...');
    };
    const onOffline = () => {
      setIsOnline(false);
      notify('Sin conexión a internet. Modo offline activado.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    getPendingSales().then(setPendingOffline).catch(() => {});
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [notify]);

  const syncOfflineSales = React.useCallback(async () => {
    if (syncingOffline) return;
    const pending = await getPendingSales();
    if (!pending.length) return;
    setSyncingOffline(true);
    try {
      const payload = pending.map(p => ({
        branchId,
        customerId: p.customerId || null,
        warrantyDays: p.warrantyDays || 0,
        channel: p.channel || 'STORE',
        fulfillmentType: p.fulfillmentType || 'PICKUP',
        shippingCost: p.shippingCost || 0,
        delivery: p.delivery,
        items: p.items.map(it => ({ productId: it.productId, quantity: it.quantity })),
        payments: p.payments,
        invoiceType: p.invoiceType || 'INTERNAL_TICKET',
        offlineFolio: p.offlineFolio,
        discount: p.discount || 0
      }));
      const r = await api('/api/sales/sync-offline', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        await clearPendingSales();
        setPendingOffline([]);
        notify(`¡${pending.length} venta(s) offline sincronizada(s) con éxito!`);
        load();
      }
    } catch {
      // Retain offline sales
    } finally {
      setSyncingOffline(false);
    }
  }, [api, syncingOffline, notify, load]);

  React.useEffect(() => {
    if (isOnline && pendingOffline.length > 0) {
      syncOfflineSales();
    }
  }, [isOnline, pendingOffline.length, syncOfflineSales]);

  const add = (p: Any) => setCart(c => {
    const x = c.find(i => i.id === p.id);
    return x
      ? c.map(i => i.id === p.id ? { ...i, quantity: Math.min(Number(i.stock), i.quantity + 1) } : i)
      : [...c, { ...p, quantity: 1 }];
  });

  const updateQty = (id: string, delta: number) => {
    setCart(c => c.map(i => {
      if (i.id === id) {
        const next = i.quantity + delta;
        return next > 0 && next <= Number(i.stock) ? { ...i, quantity: next } : i;
      }
      return i;
    }));
  };

  const removeItem = (id: string) => setCart(c => c.filter(i => i.id !== id));

  const subtotal = cart.reduce((n, i) => n + Number(i.price) * i.quantity, 0);
  const shippingFee = fulfillment === 'DELIVERY' ? Number(delivery.shippingCost || 0) : 0;
  const discountVal = Math.max(0, Number(discount || 0));
  const taxableSubtotal = Math.max(0, subtotal - discountVal);
  const effectiveTaxRate = invoiceType === 'INTERNAL_TICKET' ? 0 : sriTaxRate;
  const taxVal = effectiveTaxRate === 15 ? Number((taxableSubtotal * 0.15).toFixed(2)) : 0;
  const grandTotal = Math.max(0, taxableSubtotal + taxVal + shippingFee);

  const tenderedVal = Number(cashTendered || 0);
  const changeVal = tenderedVal >= grandTotal ? tenderedVal - grandTotal : 0;

  // Auto-fill delivery info from selected customer
  const fillCustomerData = () => {
    const c = customers.find(x => x.id === customerId);
    if (c) {
      setDelivery(d => ({
        ...d,
        recipientName: c.name || '',
        recipientPhone: c.phone || '',
        address: c.address || ''
      }));
      if (c.tag && String(c.tag).toUpperCase().includes('POPULAR')) {
        setSriTaxRate(0);
      }
    }
  };

  async function executeCheckoutWithDeUna(deunaRes: Any) {
    if (!cart.length || busy) return;
    setBusy(true);
    const selCustomer = customers.find(c => c.id === customerId);
    const paymentsPayload = [{ method: 'TRANSFER', amount: grandTotal }];
    const discountVal = Number(discount || 0);

    const body = {
      branchId,
      customerId: customerId || null,
      warrantyDays: Number(warrantyDays || 0),
      channel,
      fulfillmentType: fulfillment,
      shippingCost: shippingFee,
      delivery: fulfillment === 'DELIVERY' ? {
        recipientName: delivery.recipientName,
        recipientPhone: delivery.recipientPhone,
        address: delivery.address,
        notes: delivery.notes,
        courier: delivery.courier,
        shippingCost: shippingFee
      } : null,
      items: cart.map(i => ({ productId: i.id, quantity: i.quantity })),
      payments: paymentsPayload,
      invoiceType,
      offlineFolio: null,
      discount: discountVal,
      tax: taxVal,
      taxRate: effectiveTaxRate
    };

    try {
      const r = await api('/api/sales', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setBusy(false);
      if (r.ok) {
        const createdSale = await r.json();
        notify(invoiceType === 'SRI_INVOICE'
          ? '¡Venta cobrada con DeUna y Factura SRI generada!'
          : '¡Venta cobrada con DeUna QR exitosamente!');
        setReceiptModal({
          sale: createdSale,
          items: [...cart],
          subtotal,
          discount: discountVal,
          tax: taxVal,
          taxRate: effectiveTaxRate,
          shippingFee,
          grandTotal,
          channel,
          fulfillment,
          delivery: { ...delivery },
          customer: selCustomer,
          payMethod: 'DEUNA',
          deUnaDetails: deunaRes,
          cashTendered: null,
          change: null,
          payments: paymentsPayload,
          invoiceType
        });
        setCart([]);
        setCashTendered('');
        setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
        setDiscount('0');
        setDeUnaDetails(null);
        load();
      } else {
        notify(await r.text() || 'No se pudo registrar la venta tras el cobro');
      }
    } catch (e: any) {
      setBusy(false);
      notify('Error al registrar la venta: ' + e.message);
    }
  }

  async function executeCheckoutWithPayphone(ppRes: Any) {
    if (!cart.length || busy) return;
    setBusy(true);
    const selCustomer = customers.find(c => c.id === customerId);
    const paymentsPayload = [{ method: 'CARD', amount: grandTotal }];
    const discountVal = Number(discount || 0);

    const body = {
      branchId,
      customerId: customerId || null,
      warrantyDays: Number(warrantyDays || 0),
      channel,
      fulfillmentType: fulfillment,
      shippingCost: shippingFee,
      delivery: fulfillment === 'DELIVERY' ? {
        recipientName: delivery.recipientName,
        recipientPhone: delivery.recipientPhone,
        address: delivery.address,
        notes: delivery.notes,
        courier: delivery.courier,
        shippingCost: shippingFee
      } : null,
      items: cart.map(i => ({ productId: i.id, quantity: i.quantity })),
      payments: paymentsPayload,
      invoiceType,
      offlineFolio: null,
      discount: discountVal,
      tax: taxVal,
      taxRate: effectiveTaxRate
    };

    try {
      const r = await api('/api/sales', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setBusy(false);
      if (r.ok) {
        const createdSale = await r.json();
        notify(invoiceType === 'SRI_INVOICE'
          ? '¡Venta cobrada con Tarjeta (Payphone) y Factura SRI generada!'
          : '¡Venta cobrada con Tarjeta (Payphone) exitosamente!');
        setReceiptModal({
          sale: createdSale,
          items: [...cart],
          subtotal,
          discount: discountVal,
          tax: taxVal,
          taxRate: effectiveTaxRate,
          shippingFee,
          grandTotal,
          channel,
          fulfillment,
          delivery: { ...delivery },
          customer: selCustomer,
          payMethod: 'PAYPHONE',
          payphoneDetails: ppRes,
          cashTendered: null,
          change: null,
          payments: paymentsPayload,
          invoiceType
        });
        setCart([]);
        setCashTendered('');
        setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
        setDiscount('0');
        setPayphoneDetails(null);
        load();
      } else {
        notify(await r.text() || 'No se pudo registrar la venta tras el cobro');
      }
    } catch (e: any) {
      setBusy(false);
      notify('Error al registrar la venta: ' + e.message);
    }
  }

  async function checkout() {
    if (!cart.length || busy) return;
    if (!cashSession || !cashSession.id || cashSession.status !== 'OPEN') {
      setShowOpenCashModal(true);
      notify('🔒 Debes realizar la Apertura de Caja con el fondo inicial antes de procesar ventas.');
      return;
    }
    if (payMethod === 'CREDIT' && !customerId) {
      notify('⚠️ Para vender a crédito debes seleccionar un cliente registrado.');
      return;
    }
    if (fulfillment === 'DELIVERY' && (!delivery.address || !delivery.address.trim())) {
      notify('Por favor ingresa la dirección de entrega a domicilio');
      return;
    }

    if (payMethod === 'DEUNA') {
      if (!deUnaDetails) {
        setShowDeUnaModal(true);
        return;
      }
      executeCheckoutWithDeUna(deUnaDetails);
      return;
    }

    if (payMethod === 'PAYPHONE') {
      if (!payphoneDetails) {
        setShowPayphoneModal(true);
        return;
      }
      executeCheckoutWithPayphone(payphoneDetails);
      return;
    }

    let paymentsPayload: Array<{ method: string, amount: number }> = [];
    if (payMethod === 'SPLIT') {
      const pList = Object.entries(splitAmounts)
        .filter(([_, val]) => Number(val) > 0)
        .map(([m, val]) => ({ method: m, amount: Number(val) }));
      const sum = pList.reduce((acc, p) => acc + p.amount, 0);
      if (sum < grandTotal) {
        notify(`Los montos divididos ($${sum.toFixed(2)}) no cubren el total ($${grandTotal.toFixed(2)})`);
        return;
      }
      paymentsPayload = pList;
    } else {
      paymentsPayload = [{ method: payMethod, amount: grandTotal }];
    }

    // 1. Check if Offline Mode
    if (!navigator.onLine) {
      const offlineFolio = 'OFF-' + Math.floor(100000 + Math.random() * 900000);
      const selCustomer = customers.find(c => c.id === customerId);

      const offlineSaleRecord: OfflineSale = {
        offlineFolio,
        createdAt: new Date().toISOString(),
        branchId,
        customerId: customerId || null,
        customerName: selCustomer ? selCustomer.name : 'Consumidor Final',
        customerIdentification: selCustomer ? (selCustomer.identification_number || selCustomer.cedula) : '9999999999999',
        warrantyDays: Number(warrantyDays || 0),
        channel,
        fulfillmentType: fulfillment,
        shippingCost: shippingFee,
        invoiceType,
        items: cart.map(i => ({ productId: i.id, quantity: i.quantity, name: i.name, price: Number(i.price) })),
        payments: paymentsPayload,
        delivery: fulfillment === 'DELIVERY' ? { ...delivery } : null,
        discount: discountVal,
        grandTotal,
        synced: false
      };

      await queueOfflineSale(offlineSaleRecord);
      const updated = await getPendingSales();
      setPendingOffline(updated);

      notify(`⚠️ Venta guardada en MODO OFFLINE (${offlineFolio}). Se sincronizará automáticamente.`);
      setReceiptModal({
        sale: { id: offlineFolio, offlineFolio, invoiceType, total: grandTotal, discount: discountVal },
        items: [...cart],
        subtotal,
        discount: discountVal,
        shippingFee,
        grandTotal,
        channel,
        fulfillment,
        delivery: { ...delivery },
        customer: selCustomer,
        payMethod,
        cashTendered: payMethod === 'CASH' ? tenderedVal : null,
        change: payMethod === 'CASH' ? changeVal : null,
        payments: paymentsPayload,
        isOfflineSale: true,
        invoiceType
      });
      setCart([]);
      setCashTendered('');
      setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
      setDiscount('0');
      return;
    }

    // 2. Normal Online Sale
    setBusy(true);
    const body = {
      branchId,
      customerId: customerId || null,
      warrantyDays: Number(warrantyDays || 0),
      channel,
      fulfillmentType: fulfillment,
      shippingCost: shippingFee,
      delivery: fulfillment === 'DELIVERY' ? {
        recipientName: delivery.recipientName,
        recipientPhone: delivery.recipientPhone,
        address: delivery.address,
        notes: delivery.notes,
        courier: delivery.courier,
        shippingCost: shippingFee
      } : null,
      items: cart.map(i => ({ productId: i.id, quantity: i.quantity })),
      payments: paymentsPayload,
      invoiceType,
      offlineFolio: null,
      discount: discountVal,
      tax: taxVal,
      taxRate: effectiveTaxRate
    };

    try {
      const r = await api('/api/sales', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setBusy(false);

      if (r.ok) {
        const createdSale = await r.json();
        notify(invoiceType === 'SRI_INVOICE'
          ? '¡Venta y Factura Electrónica SRI generada con éxito!'
          : '¡Venta registrada con éxito!');
        const selCustomer = customers.find(c => c.id === customerId);
        setReceiptModal({
          sale: createdSale,
          items: [...cart],
          subtotal,
          discount: discountVal,
          tax: taxVal,
          taxRate: effectiveTaxRate,
          shippingFee,
          grandTotal,
          channel,
          fulfillment,
          delivery: { ...delivery },
          customer: selCustomer,
          payMethod,
          cashTendered: payMethod === 'CASH' ? tenderedVal : null,
          change: payMethod === 'CASH' ? changeVal : null,
          payments: paymentsPayload,
          invoiceType
        });
        setCart([]);
        setCashTendered('');
        setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
        setDiscount('0');
        load();
      } else {
        notify(await r.text() || 'No se pudo registrar la venta');
      }
    } catch {
      // Network failed during checkout -> fallback to offline queue
      setBusy(false);
      setIsOnline(false);
      const offlineFolio = 'OFF-' + Math.floor(100000 + Math.random() * 900000);
      const selCustomer = customers.find(c => c.id === customerId);
      const offlineSaleRecord: OfflineSale = {
        offlineFolio,
        createdAt: new Date().toISOString(),
        branchId,
        customerId: customerId || null,
        customerName: selCustomer ? selCustomer.name : 'Consumidor Final',
        customerIdentification: selCustomer ? (selCustomer.identification_number || selCustomer.cedula) : '9999999999999',
        warrantyDays: Number(warrantyDays || 0),
        channel,
        fulfillmentType: fulfillment,
        shippingCost: shippingFee,
        invoiceType,
        items: cart.map(i => ({ productId: i.id, quantity: i.quantity, name: i.name, price: Number(i.price) })),
        payments: paymentsPayload,
        delivery: fulfillment === 'DELIVERY' ? { ...delivery } : null,
        discount: discountVal,
        grandTotal,
        synced: false
      };
      await queueOfflineSale(offlineSaleRecord);
      const updated = await getPendingSales();
      setPendingOffline(updated);
      notify(`⚠️ Conexión perdida. Venta guardada en MODO OFFLINE (${offlineFolio}).`);
      setReceiptModal({
        sale: { id: offlineFolio, offlineFolio, invoiceType, total: grandTotal, discount: discountVal },
        items: [...cart],
        subtotal,
        discount: discountVal,
        shippingFee,
        grandTotal,
        channel,
        fulfillment,
        delivery: { ...delivery },
        customer: selCustomer,
        payMethod,
        cashTendered: payMethod === 'CASH' ? tenderedVal : null,
        change: payMethod === 'CASH' ? changeVal : null,
        payments: paymentsPayload,
        isOfflineSale: true,
        invoiceType
      });
      setCart([]);
      setCashTendered('');
      setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
      setDiscount('0');
    }
  }

  async function saveCartAsQuote() {
    if (!cart.length || busy) return;
    setBusy(true);
    try {
      const selCust = customers.find(c => c.id === customerId);
      const res = await api(`/api/quotes?branchId=${branchId}`, {
        method: 'POST',
        body: JSON.stringify({
          customerId: customerId || null,
          customerName: selCust ? selCust.name : 'Consumidor Final',
          customerPhone: selCust ? selCust.phone : '',
          customerEmail: selCust ? selCust.email : '',
          customerIdNumber: selCust ? (selCust.identification_number || selCust.identificationNumber || '') : '',
          validDays: 15,
          notes: 'Cotización generada desde Punto de Venta (POS)',
          terms: 'Precios incluyen IVA (15%). Cotización válida por 15 días.',
          items: cart.map(i => ({
            productId: i.id,
            itemType: 'PRODUCT',
            description: i.name,
            quantity: i.quantity,
            unitPrice: Number(i.price),
            discount: 0,
            taxRate: 15
          }))
        })
      });

      if (res.ok) {
        const q = await res.json();
        const token = q.publicToken || q.public_token || q.id;
        const link = `${window.location.origin}/#quote/${token}`;
        notify(`✓ Cotización #${q.quoteNumber || q.quote_number} generada con éxito.`);
        setCart([]);
        setCashTendered('');
        setSplitAmounts({ CASH: '', CARD: '', TRANSFER: '' });
        setDiscount('0');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).catch(() => {});
        }
        alert(`✓ ¡Cotización #${q.quoteNumber || q.quote_number} generada con éxito!\n\nTotal: $${Number(q.total).toFixed(2)}\n\nEnlace para enviar al cliente:\n${link}\n\n(Enlace copiado al portapapeles)`);
      } else {
        const err = await res.json().catch(() => null);
        notify(err?.message || 'No se pudo generar la cotización');
      }
    } catch (e: any) {
      notify('Error al generar cotización: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  
  const parkCurrentSale = () => {
    if (!cart.length) {
      notify('El carrito está vacío, no hay nada que poner en espera.');
      return;
    }
    const newParked = {
      id: Date.now().toString(),
      parkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart],
      customerId,
      channel,
      fulfillment,
      delivery: { ...delivery },
      warrantyDays,
      payMethod,
      invoiceType,
      grandTotal
    };
    const updated = [...parkedSales, newParked];
    setParkedSales(updated);
    localStorage.setItem('fixme_pos_parked', JSON.stringify(updated));
    setCart([]);
    notify('⏸️ Venta guardada en espera exitosamente');
  };

  const restoreParkedSale = (parkedId: string) => {
    const found = parkedSales.find(p => p.id === parkedId);
    if (!found) return;
    if (cart.length > 0) {
      if (!window.confirm('Hay productos en el ticket actual. ¿Deseas reemplazarlos por la venta en espera?')) {
        return;
      }
    }
    setCart(found.cart || []);
    if (found.customerId) setCustomerId(found.customerId);
    if (found.channel) setChannel(found.channel);
    if (found.fulfillment) setFulfillment(found.fulfillment);
    if (found.delivery) setDelivery(found.delivery);
    if (found.warrantyDays) setWarrantyDays(found.warrantyDays);
    if (found.payMethod) setPayMethod(found.payMethod);
    if (found.invoiceType) setInvoiceType(found.invoiceType);
    const updated = parkedSales.filter(p => p.id !== parkedId);
    setParkedSales(updated);
    localStorage.setItem('fixme_pos_parked', JSON.stringify(updated));
    setShowParkedDrawer(false);
    notify('✓ Venta restaurada al ticket activo');
  };

  const deleteParkedSale = (parkedId: string) => {
    const updated = parkedSales.filter(p => p.id !== parkedId);
    setParkedSales(updated);
    localStorage.setItem('fixme_pos_parked', JSON.stringify(updated));
    notify('Venta en espera eliminada');
  };

  const filteredProducts = products.filter(p => {
    const q = deferredSearch.trim().toLowerCase();
    const matchesSearch = !q || `${p.name} ${p.sku} ${p.barcode || ''}`.toLowerCase().includes(q);
    const matchesCat = !selectedCat || p.category_id === selectedCat || p.categoryId === selectedCat;
    return matchesSearch && matchesCat;
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      const q = search.trim().toLowerCase();
      const match = products.find(p =>
        (p.barcode && p.barcode.toLowerCase() === q) ||
        (p.sku && p.sku.toLowerCase() === q) ||
        p.name.toLowerCase() === q
      ) || filteredProducts[0];

      if (match) {
        if (Number(match.stock) > 0) {
          add(match);
          notify(`✓ "${match.name}" agregado al carrito`);
          setSearch('');
        } else {
          notify(`⚠️ "${match.name}" está agotado`);
        }
      } else {
        notify(`⚠️ No se encontró producto con código/SKU "${search.trim()}"`);
      }
    }
  };

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const onPosKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F4') {
        if (!isInput || target === searchInputRef.current) {
          e.preventDefault();
          setPayMethod('CASH');
          setCashTendered(grandTotal.toFixed(2));
        }
      } else if (e.key === 'F9') {
        if (!isInput || target === searchInputRef.current) {
          e.preventDefault();
          if (cart.length > 0 && !busy) {
            checkout();
          }
        }
      }
    };
    window.addEventListener('keydown', onPosKeyDown);
    return () => window.removeEventListener('keydown', onPosKeyDown);
  }, [cart, busy, grandTotal]);

  return (
    <section className="panel">
      <div className="panel-head" style={{ marginBottom: 16 }}>
        <div>
          <span className="eyebrow">PUNTO DE VENTA PROFESIONAL</span>
          <h3>Terminal de Ventas y Despacho</h3>
          <p>Registra ventas presenciales u online con entrega a domicilio y múltiples formas de pago.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="kbd-badge">F2: Buscar</span>
          <span className="kbd-badge">F4: Efectivo</span>
          <span className="kbd-badge">F9: Cobrar</span>
        </div>
      </div>

      {(!cashSession || !cashSession.id || cashSession.status !== 'OPEN') && (
        <div style={{
          background: 'var(--warning-soft)',
          border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={24} style={{ color: 'var(--warning-text)' }} />
            <div>
              <strong style={{ fontSize: '14px', color: 'var(--warning-text)', display: 'block' }}>
                Caja Cerrada en esta Sucursal
              </strong>
              <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Para comenzar a vender y cobrar, debes realizar la Apertura de Turno con el fondo inicial.
              </small>
            </div>
          </div>
          <button
            type="button"
            className="primary-action"
            style={{ background: 'var(--warning-text)', borderColor: 'var(--warning-border)', padding: '8px 16px', fontWeight: 700, fontSize: '13px' }}
            onClick={() => setShowOpenCashModal(true)}
          >
            <Banknote size={15} style={{ marginRight: 6 }} /> Abrir Caja e Iniciar Turno
          </button>
        </div>
      )}

      <div className="pos-layout-modern">
        {/* CATALOG PANEL */}
        <div>
          {/* SEARCH & CATEGORY CHIPS */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: 1, minWidth: '240px', position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ color: 'var(--text-muted)', position: 'absolute', left: 12, pointerEvents: 'none' }} />
              <input
                ref={searchInputRef}
                placeholder="Escanear código de barras o buscar producto/SKU (Enter para agregar)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoFocus
                style={{ paddingLeft: 34, paddingRight: 40, width: '100%', boxSizing: 'border-box' }}
              />
              <span className="kbd-badge" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>F2</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                className={`filter-pill ${selectedCat === '' ? 'active' : ''}`}
                onClick={() => setSelectedCat('')}
              >
                Todos
              </button>
              {cats.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`filter-pill ${selectedCat === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedCat(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="product-grid">
            {filteredProducts.map(p => {
              const inCart = cart.find(ci => ci.id === p.id);
              const stockNum = Number(p.stock || 0);
              const stockClass = stockNum > 3 ? 'high' : stockNum > 0 ? 'medium' : 'out';
              const stockText = stockNum > 0 ? `${stockNum} disp.` : 'Agotado';

              return (
                <button
                  key={p.id}
                  disabled={!p.stock}
                  onClick={() => add(p)}
                  className="pos-catalog-card"
                  style={{ textAlign: 'left', opacity: p.stock ? 1 : 0.6 }}
                >
                  {inCart && (
                    <span className="pos-in-cart-indicator">
                      {inCart.quantity} en ticket
                    </span>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <code style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '2px 5px', borderRadius: 4 }}>
                      {p.sku || p.barcode || 'S/N'}
                    </code>
                    <span className={`pos-stock-badge ${stockClass}`}>
                      {stockText}
                    </span>
                  </div>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.name}
                  </strong>
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="num" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--primary)' }}>
                      ${Number(p.price).toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CART & CHECKOUT PANEL (STICKY SPLIT-VIEW) */}
        <div className="pos-checkout-sticky-col">
          <div className="pos-cart-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={16} style={{ color: 'var(--primary)' }} />
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Ticket Actual ({cart.reduce((acc, i) => acc + (i.quantity || 1), 0)})</strong>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {parkedSales.length > 0 && (
                  <button
                    type="button"
                    style={{
                      background: 'var(--warning-soft)',
                      color: 'var(--warning-text)',
                      border: '1px solid var(--warning-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onClick={() => setShowParkedDrawer(true)}
                    title="Ver tickets en espera"
                  >
                    <Clock size={12} /> {parkedSales.length} en espera
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-action"
                  style={{ fontSize: '11px', padding: '3px 8px', height: 26, gap: '4px' }}
                  onClick={parkCurrentSale}
                  disabled={!cart.length || busy}
                  title="Pausar ticket actual para atender a otro cliente rápido"
                >
                  <PauseCircle size={13} /> Pausar
                </button>
              </div>
            </div>
          {/* OFFLINE STATUS / SYNC BANNER */}
          {(!isOnline || pendingOffline.length > 0) && (
            <div className="offline-status-banner">
              <div>
                <span className={`connection-dot ${isOnline ? 'online' : 'offline'}`} />
                <span>{!isOnline ? 'Modo Offline (Sin Internet)' : 'Conectado a la red'}</span>
                {pendingOffline.length > 0 && (
                  <span style={{ display: 'block', fontSize: '10.5px', marginTop: '2px', color: '#92400e' }}>
                    {pendingOffline.length} venta(s) local(es) pendiente(s) de sincronizar
                  </span>
                )}
              </div>
              {isOnline && pendingOffline.length > 0 && (
                <button
                  type="button"
                  className="offline-sync-btn"
                  onClick={syncOfflineSales}
                  disabled={syncingOffline}
                >
                  {syncingOffline ? 'Sincronizando...' : `🔄 Sincronizar (${pendingOffline.length})`}
                </button>
              )}
            </div>
          )}

          {/* DUAL INVOICE EMISSION SELECTOR (TICKET INTERNO vs FACTURA SRI) */}
          <div>
            <label style={{ marginBottom: '6px', display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
              Tipo de Comprobante
            </label>
            <div className="invoice-mode-selector">
              <button
                type="button"
                className={`invoice-mode-pill ${invoiceType === 'INTERNAL_TICKET' ? 'active ticket' : ''}`}
                onClick={() => setInvoiceType('INTERNAL_TICKET')}
                title="Comprobante interno de tienda (Tarifa 0% IVA / No fiscal)"
              >
                <i>🧾</i> Ticket Interno (0% IVA)
              </button>
              <button
                type="button"
                className={`invoice-mode-pill ${invoiceType === 'SRI_INVOICE' ? 'active sri' : ''}`}
                onClick={() => setInvoiceType('SRI_INVOICE')}
                title="Factura electrónica autorizada por el SRI (15% o 0% según régimen)"
              >
                <i>🏛️</i> Factura SRI
              </button>
            </div>
            {invoiceType === 'SRI_INVOICE' && (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', marginTop: '6px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                    Tarifa según Régimen:
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: sriTaxRate === 15 ? '#dbeafe' : '#fef3c7', color: sriTaxRate === 15 ? '#1e40af' : '#92400e', fontWeight: 700 }}>
                    {sriTaxRate === 15 ? 'IVA 15% (General / Emprendedor)' : 'IVA 0% (RIMPE Popular / Exento)'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    style={{
                      padding: '6px 8px',
                      fontSize: '11px',
                      fontWeight: sriTaxRate === 15 ? 700 : 500,
                      background: sriTaxRate === 15 ? '#3157d5' : '#fff',
                      color: sriTaxRate === 15 ? '#fff' : '#475569',
                      border: sriTaxRate === 15 ? '1px solid #3157d5' : '1px solid #cbd5e1',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSriTaxRate(15)}
                  >
                    Tarifa 15% IVA
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '6px 8px',
                      fontSize: '11px',
                      fontWeight: sriTaxRate === 0 ? 700 : 500,
                      background: sriTaxRate === 0 ? '#059669' : '#fff',
                      color: sriTaxRate === 0 ? '#fff' : '#475569',
                      border: sriTaxRate === 0 ? '1px solid #059669' : '1px solid #cbd5e1',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSriTaxRate(0)}
                  >
                    Tarifa 0% (RIMPE Popular)
                  </button>
                </div>
              </div>
            )}
            {invoiceType === 'INTERNAL_TICKET' && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px', fontSize: '10.5px', color: '#64748b', marginTop: '6px', marginBottom: '8px' }}>
                🧾 <b>Ticket Interno (IVA 0%):</b> Comprobante de venta para control de tienda y taller. No genera impuestos tributarios.
              </div>
            )}
          </div>

          {/* CHANNEL SELECTOR */}
          <div>
            <label style={{ marginBottom: '6px', display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569' }}>Canal de Venta</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${channel === 'STORE' ? 'active' : ''}`}
                onClick={() => setChannel('STORE')}
              >
                🏪 Local
              </button>
              <button
                type="button"
                className={`toggle-btn ${channel === 'ONLINE' ? 'active' : ''}`}
                onClick={() => setChannel('ONLINE')}
              >
                🌐 Online / WhatsApp
              </button>
            </div>
          </div>

          {/* FULFILLMENT SELECTOR */}
          <div>
            <label style={{ marginBottom: '6px', display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569' }}>Modalidad de Entrega</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${fulfillment === 'PICKUP' ? 'active' : ''}`}
                onClick={() => setFulfillment('PICKUP')}
              >
                🏬 En tienda
              </button>
              <button
                type="button"
                className={`toggle-btn ${fulfillment === 'DELIVERY' ? 'active' : ''}`}
                onClick={() => setFulfillment('DELIVERY')}
              >
                🛵 A domicilio
              </button>
            </div>
          </div>

          {/* DELIVERY FIELDS IF DELIVERY */}
          {fulfillment === 'DELIVERY' && (
            <div className="delivery-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                <strong style={{ fontSize: '12px', color: '#1e293b' }}>📦 Datos de Despacho</strong>
                {customerId && (
                  <button
                    type="button"
                    onClick={fillCustomerData}
                    style={{ border: 0, background: 'transparent', color: '#3157d5', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    ⚡ Usar datos cliente
                  </button>
                )}
              </div>
              <input
                placeholder="Dirección completa de entrega *"
                value={delivery.address}
                onChange={e => setDelivery({ ...delivery, address: e.target.value })}
                required
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
                <input
                  placeholder="Destinatario"
                  value={delivery.recipientName}
                  onChange={e => setDelivery({ ...delivery, recipientName: e.target.value })}
                  style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                />
                <input
                  placeholder="Teléfono"
                  value={delivery.recipientPhone}
                  onChange={e => setDelivery({ ...delivery, recipientPhone: e.target.value })}
                  style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
                <input
                  placeholder="Referencias (Torre, piso...)"
                  value={delivery.notes}
                  onChange={e => setDelivery({ ...delivery, notes: e.target.value })}
                  style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Flete ($)"
                  value={delivery.shippingCost}
                  onChange={e => setDelivery({ ...delivery, shippingCost: e.target.value })}
                  style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* CUSTOMER & WARRANTY */}
          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span>Cliente registrado (opcional)</span>
              <button
                type="button"
                onClick={() => setShowQuickCust(true)}
                style={{
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#2563eb',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Registrar cliente rápido sin salir del POS"
              >
                + Nuevo Cliente
              </button>
            </div>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Consumidor Final (Sin cliente)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone || c.email || 'sin contacto'}
                </option>
              ))}
            </select>
          </label>

          <label>
            Garantía comercial
            <select value={warrantyDays} onChange={e => setWarrantyDays(e.target.value)} disabled={!customerId}>
              <option value="0">Sin garantía</option>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
              <option value="180">180 días</option>
              <option value="365">1 año</option>
            </select>
          </label>

          {/* CART ITEMS LIST */}
          <div className="pos-item-list-scroll" style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
            {cart.map(i => (
              <div key={i.id} className="cart-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{i.name}</div>
                  <small style={{ color: 'var(--text-muted)' }} className="num">${Number(i.price).toFixed(2)} c/u</small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    style={{ padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    onClick={() => updateQty(i.id, -1)}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }} className="num">{i.quantity}</span>
                  <button
                    type="button"
                    style={{ padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    onClick={() => updateQty(i.id, 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    style={{ border: 0, background: 'transparent', color: 'var(--danger)', fontWeight: 'bold', cursor: 'pointer', padding: '0 4px' }}
                    onClick={() => removeItem(i.id)}
                  >
                    ✕
                  </button>
                </div>
                <strong style={{ minWidth: '65px', textAlign: 'right', color: 'var(--text-primary)' }} className="num">
                  ${(Number(i.price) * i.quantity).toFixed(2)}
                </strong>
              </div>
            ))}
            {!cart.length && <p className="empty" style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Agrega productos al ticket.</p>}
          </div>

          {/* TOTAL BREAKDOWN */}
          <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <span>Subtotal:</span>
              <span className="num">${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <span>Descuento ($):</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                style={{ width: '85px', padding: '3px 8px', fontSize: '12px', textAlign: 'right', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                className="num"
              />
            </div>
            {invoiceType === 'SRI_INVOICE' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>
                <span>IVA ({effectiveTaxRate}%):</span>
                <span className="num">${taxVal.toFixed(2)}</span>
              </div>
            )}
            {invoiceType === 'INTERNAL_TICKET' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>IVA (0% Ticket):</span>
                <span className="num">$0.00</span>
              </div>
            )}
            {shippingFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <span>Envío a domicilio:</span>
                <span className="num">${shippingFee.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '19px', fontWeight: 800, color: 'var(--primary)', marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
              <span>Total a Cobrar:</span>
              <span className="num">${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* PAYMENT METHODS SELECTOR */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ margin: 0, fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>Forma de Pago</label>
              {payMethod === 'CASH' && <span className="kbd-badge" style={{ fontSize: '10px' }}>F4</span>}
            </div>
            <div className="pay-tiles-grid">
              <button
                type="button"
                className={`pay-tile-btn ${payMethod === 'CASH' ? 'active' : ''}`}
                onClick={() => setPayMethod('CASH')}
              >
                <Banknote size={18} />
                <span>Efectivo</span>
              </button>
              <button
                type="button"
                className={`pay-tile-btn ${payMethod === 'CARD' ? 'active' : ''}`}
                onClick={() => setPayMethod('CARD')}
              >
                <CreditCard size={18} />
                <span>Tarjeta</span>
              </button>
              <button
                type="button"
                className={`pay-tile-btn ${payMethod === 'TRANSFER' ? 'active' : ''}`}
                onClick={() => setPayMethod('TRANSFER')}
              >
                <ArrowRightLeft size={18} />
                <span>Transf.</span>
              </button>
              <button
                type="button"
                className={`pay-tile-btn ${payMethod === 'DEUNA' ? 'active' : ''}`}
                onClick={() => setPayMethod('DEUNA')}
                style={payMethod === 'DEUNA' ? { borderColor: 'var(--teal, #00a896)', background: 'var(--teal-soft, #f0fdfa)', color: '#0f766e' } : {}}
              >
                <QrCode size={18} style={{ color: '#00a896' }} />
                <span>DeUna QR</span>
              </button>
              <button
                type="button"
                className={`pay-tile-btn ${payMethod === 'PAYPHONE' ? 'active' : ''}`}
                onClick={() => setPayMethod('PAYPHONE')}
                style={payMethod === 'PAYPHONE' ? { borderColor: 'var(--orange, #f97316)', background: 'var(--orange-soft, #fff7ed)', color: '#c2410c' } : {}}
              >
                <CreditCard size={18} style={{ color: '#ea580c' }} />
                <span>Payphone</span>
              </button>
              <button
                type="button"
                className={`pay-tile-btn ${payMethod === 'CREDIT' ? 'active' : ''}`}
                onClick={() => setPayMethod('CREDIT')}
                style={payMethod === 'CREDIT' ? { borderColor: 'var(--purple)', background: 'var(--purple-soft)', color: 'var(--purple)' } : {}}
              >
                <FileText size={18} style={{ color: 'var(--purple)' }} />
                <span>A Crédito</span>
              </button>
            </div>
          </div>

          {/* CREDIT HELPER */}
          {payMethod === 'CREDIT' && (
            <div style={{ background: 'var(--purple-soft)', border: '1px solid var(--purple-border, #ddd6fe)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--purple)', fontWeight: 700, fontSize: '13px' }}>
                <FileText size={16} />
                <span>Venta a Crédito (Cuenta por Cobrar)</span>
              </div>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-primary)' }}>
                {customerId ? (
                  <>Se registrará como Cuenta por Cobrar a nombre de <b>{customers.find(c => c.id === customerId)?.name || 'Cliente'}</b> por <b className="num">${grandTotal.toFixed(2)}</b> a 30 días de plazo.</>
                ) : (
                  <strong style={{ color: 'var(--danger)' }}>⚠️ Debes seleccionar un cliente registrado en la sección superior para habilitar la venta a crédito.</strong>
                )}
              </p>
            </div>
          )}

          {/* DEUNA QR HELPER */}
          {payMethod === 'DEUNA' && (
            <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 'var(--radius-md)', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#0f766e', fontWeight: 700, fontSize: '13px' }}>
                <QrCode size={18} />
                <span>Pago Digital DeUna (Banco Pichincha / Interbancario)</span>
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', color: '#047857', lineHeight: 1.4 }}>
                Al cobrar se generará un código QR dinámico por <b className="num">${grandTotal.toFixed(2)}</b> para escanear con DeUna o cualquier banco de la red nacional.
              </p>
              <button
                type="button"
                onClick={() => setShowDeUnaModal(true)}
                disabled={!cart.length || busy}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, #00a896 0%, #028090 100%)',
                  color: '#fff',
                  border: 0,
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(0, 168, 150, 0.25)'
                }}
              >
                <QrCode size={16} /> <span>Abrir Pantalla de Cobro QR DeUna</span>
              </button>
            </div>
          )}

          {/* PAYPHONE CARD HELPER */}
          {payMethod === 'PAYPHONE' && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-md)', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#c2410c', fontWeight: 700, fontSize: '13px' }}>
                <CreditCard size={18} />
                <span>Pago con Tarjetas Débito / Crédito (Payphone)</span>
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', color: '#9a3412', lineHeight: 1.4 }}>
                Se procesará el cobro de <b className="num">${grandTotal.toFixed(2)}</b> con Visa, Mastercard, Diners o Discover mediante enlace seguro o simulación sandbox.
              </p>
              <button
                type="button"
                onClick={() => setShowPayphoneModal(true)}
                disabled={!cart.length || busy}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  color: '#fff',
                  border: 0,
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)'
                }}
              >
                <CreditCard size={16} /> <span>Abrir Pasarela de Pago Payphone</span>
              </button>
            </div>
          )}

          {/* CASH TENDER & CHANGE CALCULATION */}
          {payMethod === 'CASH' && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Monto Recibido en Efectivo ($)
                <input
                  type="number"
                  step="0.01"
                  placeholder={grandTotal.toFixed(2)}
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value)}
                  className="num"
                  style={{ marginTop: 4, width: '100%', boxSizing: 'border-box' }}
                />
              </label>
              <div className="bills-grid" style={{ marginTop: 6 }}>
                <button type="button" className="bill-btn num" onClick={() => setCashTendered(grandTotal.toFixed(2))}>
                  Exacto (${grandTotal.toFixed(2)})
                </button>
                {[5, 10, 20, 50, 100].map(bill => (
                  <button key={bill} type="button" className="bill-btn num" onClick={() => setCashTendered(String(bill))}>
                    ${bill}
                  </button>
                ))}
              </div>
              {tenderedVal >= grandTotal && grandTotal > 0 && (
                <div className="change-card" style={{ marginTop: 8 }}>
                  <span>Cambio / Vuelto:</span>
                  <strong className="num">${changeVal.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}

          {/* CHECKOUT BUTTON WITH [F9] */}
          <button
            disabled={!cart.length || busy}
            onClick={checkout}
            className="primary-action"
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '15px',
              fontWeight: 800,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: 'var(--shadow-md)',
              cursor: (!cart.length || busy) ? 'not-allowed' : 'pointer'
            }}
          >
            <span>{busy ? 'Registrando...' : `Cobrar $${grandTotal.toFixed(2)}`}</span>
            <span className="kbd-badge" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', fontSize: 11 }}>F9</span>
          </button>

          <button
            type="button"
            disabled={!cart.length || busy}
            onClick={saveCartAsQuote}
            className="secondary-action"
            style={{
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 700,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <FileText size={15} /> Guardar Carrito como Cotización
          </button>
        </div>
      </div>
    </div>

      {/* POST-SALE RECEIPT MODAL */}
      {receiptModal && (
        <div className="modal-overlay" onClick={() => setReceiptModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: ticketPaperWidth === '58mm' ? '330px' : '420px', transition: 'max-width 0.2s' }}>
            <div className="modal-head no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>🧾 Comprobante de Venta</h3>
                <small style={{ color: '#64748b' }}>Formato térmico ({ticketPaperWidth})</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TicketFormatSelector
                  value={ticketPaperWidth}
                  onChange={w => {
                    setTicketPaperWidth(w);
                    setStoredPaperWidth(w);
                  }}
                />
                <button className="close-button" onClick={() => setReceiptModal(null)}>✕</button>
              </div>
            </div>

            <div id="printable-ticket" className={`ticket-preview paper-${ticketPaperWidth}`}>
              {/* CABECERA COMPACTA ESTILO TECNAMAX CON DATOS REALES DE LA EMPRESA */}
              {(() => {
                const comp = getCompanyReceiptInfo(receiptModal.sale, companyInfo);
                const custName = receiptModal.customer?.name || (typeof receiptModal.customer === 'string' ? receiptModal.customer : '') || 'CONSUMIDOR FINAL';
                const custRuc = receiptModal.customer?.identification || receiptModal.customer?.idNumber || receiptModal.customer?.identification_number || '9999999999999';
                const custAddress = receiptModal.fulfillment === 'DELIVERY' && receiptModal.delivery?.address
                  ? receiptModal.delivery.address
                  : (receiptModal.customer?.address || 'QUITO, ECUADOR');
                const custPhone = receiptModal.customer?.phone || receiptModal.delivery?.recipientPhone || '9999999999';
                const custEmail = receiptModal.customer?.email || 'consumidor@final.com';
                const sellerName = receiptModal.sale?.seller || receiptModal.sale?.sellerName || localStorage.fullName || 'VENDEDOR';

                return (
                  <>
                    <div className="receipt-header-fiscal">
                      <div className="receipt-store-title">{comp.storeName}</div>
                      <div className="receipt-store-slogan">{comp.slogan}</div>
                      <div className="receipt-company-line" style={{ fontWeight: 800 }}>{comp.legalName}</div>
                      <div className="receipt-company-line" style={{ fontWeight: 800 }}>RUC: {comp.ruc}</div>
                      <div className="receipt-company-line">DIR MATRIZ: {comp.matrixAddress}</div>
                      <div className="receipt-company-line">SUCURSAL: {comp.branchAddress}</div>
                      <div className="receipt-company-line">Tlf: {comp.phone}</div>
                      <div className="receipt-company-line">Email: {comp.email}</div>
                      <div className="receipt-company-line" style={{ fontWeight: 800, marginTop: '2px' }}>
                        CONTRIBUYENTE RÉGIMEN {comp.taxRegime}
                      </div>
                      <div className="receipt-company-line" style={{ fontWeight: 800 }}>
                        NÚMERO: {receiptModal.sale?.invoiceNumber || `001-001-${(receiptModal.sale?.id || '00000000').slice(0, 8).toUpperCase()}`}
                      </div>
                      {(receiptModal.sale?.accessKey || receiptModal.sale?.electronicInvoice?.clave_acceso) && (
                        <div className="receipt-company-line" style={{ fontSize: '9px', wordBreak: 'break-all' }}>
                          <strong>N AUTORIZACION:</strong> {receiptModal.sale?.accessKey || receiptModal.sale?.electronicInvoice?.clave_acceso}
                        </div>
                      )}
                    </div>

                    <div className="receipt-divider-dash" />

                    {/* METADATOS Y CLIENTE (ETIQUETAS A LA IZQUIERDA EN NEGRITA) */}
                    <div className="receipt-meta-block">
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">AMBIENTE:</span>
                        <span className="receipt-meta-content">{comp.sriEnvText}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">RUC:</span>
                        <span className="receipt-meta-content">{custRuc}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">NOMBRE:</span>
                        <span className="receipt-meta-content">{custName}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">DIRECCIÓN:</span>
                        <span className="receipt-meta-content">{custAddress}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">TELÉFONO:</span>
                        <span className="receipt-meta-content">{custPhone}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">EMAIL:</span>
                        <span className="receipt-meta-content">{custEmail}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">VENDEDOR:</span>
                        <span className="receipt-meta-content">{sellerName}</span>
                      </div>
                      <div className="receipt-meta-entry">
                        <span className="receipt-meta-tag">FECHA:</span>
                        <span className="receipt-meta-content">
                          {new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      {receiptModal.fulfillment === 'DELIVERY' && (
                        <div className="receipt-meta-entry">
                          <span className="receipt-meta-tag">DESPACHO:</span>
                          <span className="receipt-meta-content">
                            Motorizado Express {receiptModal.sale?.trackingNumber ? `(Guía: ${receiptModal.sale.trackingNumber})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              <div className="receipt-divider-dash" />

              {/* TABLA DE PRODUCTOS EN 2 NIVELES (COD - CANT - DETALLE / PRECIO - TOTAL) */}
              <div className="receipt-products-table">
                <div className="receipt-col-headers">
                  <span style={{ minWidth: '60px' }}>COD</span>
                  <span style={{ minWidth: '25px', textAlign: 'center' }}>CANT</span>
                  <span style={{ flex: 1, textAlign: 'left', paddingLeft: '5px' }}>DETALLE</span>
                </div>
                {receiptModal.items.map((it: Any, idx: number) => {
                  const qty = Number(it.quantity || 1);
                  const price = Number(it.price || 0);
                  const lineTotal = (qty * price).toFixed(2);
                  const code = it.sku || it.barcode || `TEG${String(idx + 895).padStart(5, '0')}`;

                  return (
                    <div className="receipt-item-group" key={idx}>
                      <div className="receipt-item-line-main">
                        <span className="receipt-item-sku-col">{code}</span>
                        <span className="receipt-item-qty-col">{qty}</span>
                        <span className="receipt-item-desc-col">{it.name}</span>
                      </div>
                      <div className="receipt-item-line-sub">
                        <span>PRECIO: ${price.toFixed(2)}</span>
                        <span><strong>TOTAL: ${lineTotal}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="receipt-divider-dash" />

              {/* TOTALES FISCALES ALINEADOS A LA DERECHA */}
              {(() => {
                const total = Number(receiptModal.grandTotal || 0);
                const discount = Number(receiptModal.discount || 0);
                const shipping = Number(receiptModal.shippingFee || 0);
                const isTicket = receiptModal.invoiceType === 'INTERNAL_TICKET' || receiptModal.invoice_type === 'INTERNAL_TICKET';
                const tax = isTicket ? 0 : Number(receiptModal.tax || 0);
                const isTax15 = !isTicket && tax > 0;
                const subtotalSinImp = Math.max(0, Number(receiptModal.subtotal || 0) - discount);
                const subtotal15 = isTax15 ? subtotalSinImp : 0.00;
                const subtotal0 = !isTax15 ? subtotalSinImp : 0.00;

                return (
                  <div className="receipt-fiscal-totals">
                    {isTax15 ? (
                      <div className="receipt-fiscal-row">
                        <span>Subtotal 15%</span>
                        <span>${subtotal15.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="receipt-fiscal-row">
                        <span>Subtotal 0% (Tarifa 0)</span>
                        <span>${subtotal0.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="receipt-fiscal-row">
                      <span>Subtotal sin Impuesto</span>
                      <span>${subtotalSinImp.toFixed(2)}</span>
                    </div>
                    <div className="receipt-fiscal-row">
                      <span>Descuento %</span>
                      <span>{discount > 0 ? `-$${discount.toFixed(2)}` : '$0.00'}</span>
                    </div>
                    {shipping > 0 && (
                      <div className="receipt-fiscal-row">
                        <span>Flete a Domicilio</span>
                        <span>+${shipping.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="receipt-fiscal-row">
                      <span>{isTax15 ? 'IVA 15%' : 'IVA (0%)'}</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>
                    <div className="receipt-fiscal-row highlight">
                      <span>Valor Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="receipt-divider-dash" />

              {/* SECCIÓN DE OBSERVACIÓN Y FORMA DE PAGO */}
              <div className="receipt-obs-section">
                <div><strong>OBSERVACIÓN:</strong></div>
                {receiptModal.payMethod === 'DEUNA' || receiptModal.deUnaDetails ? (
                  <div>
                    PAGO CON DEUNA QR (BANCO PICHINCHA)<br />
                    Ref: {receiptModal.deUnaDetails?.transactionId || 'DU-ONLINE'} · Aut: {receiptModal.deUnaDetails?.authorizationCode || 'AUTH-OK'}
                  </div>
                ) : receiptModal.payMethod === 'PAYPHONE' || receiptModal.payphoneDetails ? (
                  <div>
                    PAGO CON TARJETA {receiptModal.payphoneDetails?.cardBrand || 'CRÉDITO/DÉBITO'}<br />
                    Ref: {receiptModal.payphoneDetails?.authorizationCode || 'PP-AUTH'}
                  </div>
                ) : (
                  <div>
                    {receiptModal.payMethod === 'CASH' || !receiptModal.payMethod ? 'EFECTIVO' : receiptModal.payMethod.toUpperCase()}
                    {receiptModal.cashTendered != null ? ` $${Number(receiptModal.cashTendered).toFixed(2)}` : ` $${receiptModal.grandTotal.toFixed(2)}`}
                    {receiptModal.change != null && receiptModal.change > 0 ? ` · CAMBIO: $${receiptModal.change.toFixed(2)}` : ''}
                  </div>
                )}
                {receiptModal.delivery?.notes && (
                  <div style={{ marginTop: '2px' }}>Notas: {receiptModal.delivery.notes}</div>
                )}
              </div>

              <div className="receipt-divider-dash" />

              {/* CLÁUSULA OFICIAL DE GARANTÍA */}
              <div className="receipt-warranty-box">
                PARA TERMINOS DE GARANTIA DEBE PRESENTAR SU TICKET<br />
                DE LO CONTRARIO NO TIENE GARANTIA EL PRODUCTO
              </div>

              {/* CÓDIGO QR PARA VALIDACIÓN DIGITAL */}
              <div className="receipt-qr-wrap" style={{ textAlign: 'center', margin: '8px 0 4px' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `https://fixmetiendas.local/ticket/${receiptModal.sale?.id || 'TICKET'}`
                  )}`}
                  alt="QR Verificación"
                  style={{
                    width: ticketPaperWidth === '58mm' ? '120px' : '145px',
                    height: ticketPaperWidth === '58mm' ? '120px' : '145px',
                    display: 'inline-block',
                    margin: '0 auto'
                  }}
                />
                <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#000', marginTop: '3px' }}>
                  Escanee para validar ticket y garantía oficial
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
              <button className="secondary-action" style={{ flex: 1, minWidth: '90px' }} onClick={() => setReceiptModal(null)}>
                Cerrar
              </button>
              <button
                className="primary-action"
                style={{ flex: 1, minWidth: '120px' }}
                onClick={() => printTicketElement('printable-ticket', ticketPaperWidth)}
              >
                🖨️ Imprimir ({ticketPaperWidth})
              </button>
              <button
                type="button"
                className="secondary-action"
                style={{ flex: 1, minWidth: '130px', background: '#f8fafc', fontWeight: 700 }}
                onClick={() => setShowThermalTicket(true)}
              >
                🧾 Formato Térmico Extendido
              </button>
              {(receiptModal.sale?.electronicInvoice?.id || receiptModal.sale?.electronicInvoiceId) && (
                <button
                  type="button"
                  className="primary-action"
                  style={{ flex: 1, minWidth: '150px', background: '#059669', borderColor: '#047857', fontWeight: 700 }}
                  onClick={() => {
                    const invId = receiptModal.sale?.electronicInvoice?.id || receiptModal.sale?.electronicInvoiceId;
                    if (invId) setShowRideModalId(invId);
                  }}
                >
                  🏛️ Ver RIDE / Factura SRI
                </button>
              )}
              {receiptModal.fulfillment === 'DELIVERY' && receiptModal.sale?.trackingNumber && (
                <a
                  className="secondary-action"
                  style={{ flex: 1, minWidth: '130px', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700 }}
                  href={`#tracking/${receiptModal.sale.trackingNumber}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  📍 Ver Tracking
                </a>
              )}
              {receiptModal.customer?.phone && (
                <a
                  className="whatsapp-btn"
                  style={{ flex: 1, minWidth: '120px', textDecoration: 'none', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '4px' }}
                  href={`https://wa.me/${receiptModal.customer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hola ${receiptModal.customer.name}, gracias por tu compra en FixmeTiendas.\nTotal: $${receiptModal.grandTotal.toFixed(2)}\nModalidad: ${receiptModal.fulfillment === 'DELIVERY' ? 'Envío a domicilio' : 'Retiro en tienda'}\nComprobante #${receiptModal.sale?.id?.slice(0, 8)}${receiptModal.sale?.trackingNumber ? `\n\n🛵 Sigue el estado y motorizado de tu entrega en tiempo real aquí:\n${window.location.origin}${window.location.pathname}#tracking/${receiptModal.sale.trackingNumber}` : ''}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {showRideModalId && (
        <SriRideModal
          invoiceId={showRideModalId}
          api={api}
          onClose={() => setShowRideModalId(null)}
        />
      )}

      
      {/* DRAWER DE VENTAS EN ESPERA */}
      <SlideOverDrawer
        isOpen={showParkedDrawer}
        onClose={() => setShowParkedDrawer(false)}
        title="Ventas en Espera (Pausadas)"
        subtitle="Recupera tickets guardados temporalmente para continuar el cobro"
        width={460}
      >
        {parkedSales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <PauseCircle size={40} style={{ opacity: 0.35, marginBottom: 12 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No hay ventas en espera</p>
            <small>Usa el botón "Pausar" en el ticket para guardar carritos temporales.</small>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {parkedSales.map((ps, idx) => (
              <div
                key={ps.id || idx}
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={13} /> Pausada a las {ps.parkedAt || 'Reciente'}
                  </span>
                  <span className="num" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>
                    ${Number(ps.grandTotal || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <b>{ps.cart?.length || 0} productos:</b>{' '}
                  {ps.cart?.map((item: Any) => item.name).slice(0, 3).join(', ')}
                  {(ps.cart?.length || 0) > 3 ? '...' : ''}
                </div>
                {ps.customerId && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Cliente: {customers.find(c => c.id === ps.customerId)?.name || 'Cliente registrado'}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--danger-border)',
                      color: 'var(--danger)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    onClick={() => deleteParkedSale(ps.id)}
                  >
                    <Trash2 size={12} /> Descartar
                  </button>
                  <button
                    type="button"
                    className="primary-action"
                    style={{ fontSize: '12px', padding: '4px 12px', height: 30 }}
                    onClick={() => restoreParkedSale(ps.id)}
                  >
                    <PlayCircle size={13} /> Recuperar Ticket
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SlideOverDrawer>

      {showQuickCust && (
        <QuickCustomerModal
          api={api}
          notify={notify}
          onCreated={c => {
            setCustomers(prev => [c, ...prev]);
            setCustomerId(c.id);
          }}
          onClose={() => setShowQuickCust(false)}
        />
      )}

      {showThermalTicket && receiptModal && (
        <ThermalTicketModal
          sale={{
            id: receiptModal.sale?.id || receiptModal.sale?.offlineFolio,
            orderNumber: receiptModal.sale?.id?.slice(0, 8).toUpperCase(),
            createdAt: new Date().toISOString(),
            customerName: receiptModal.customer?.name || 'CONSUMIDOR FINAL',
            customerIdentification: receiptModal.customer?.identification_number || receiptModal.customer?.cedula || '',
            items: receiptModal.items.map((it: Any) => ({
              productName: it.name,
              quantity: it.quantity,
              unitPrice: Number(it.price)
            })),
            payments: receiptModal.payments,
            subtotal: receiptModal.subtotal,
            discountAmount: receiptModal.discount != null ? receiptModal.discount : discountVal,
            shippingCost: receiptModal.shippingFee,
            total: receiptModal.grandTotal,
            invoiceType: receiptModal.invoiceType,
            warrantyDays: Number(warrantyDays || 0),
            deliveryTrackingCode: receiptModal.sale?.trackingNumber,
            changeAmount: receiptModal.change
          }}
          onClose={() => setShowThermalTicket(false)}
          tenantName={localStorage.tenantName || 'Fixme Tiendas'}
        />
      )}
      {showDeUnaModal && (
        <DeUnaModal
          amount={grandTotal}
          branchId={branchId}
          customerName={customers.find(c => c.id === customerId)?.name}
          customerPhone={customers.find(c => c.id === customerId)?.phone}
          api={api}
          onSuccess={(res) => {
            setShowDeUnaModal(false);
            setDeUnaDetails(res);
            notify(`✅ Cobro DeUna aprobado (${res.authorizationCode})`);
            executeCheckoutWithDeUna(res);
          }}
          onClose={() => setShowDeUnaModal(false)}
        />
      )}
      {showPayphoneModal && (
        <PayphoneModal
          amount={grandTotal}
          branchId={branchId}
          customerEmail={customers.find(c => c.id === customerId)?.email}
          customerPhone={customers.find(c => c.id === customerId)?.phone}
          api={api}
          onSuccess={(res) => {
            setShowPayphoneModal(false);
            setPayphoneDetails(res);
            notify(`✅ Cobro Payphone aprobado (${res.cardBrand} **** ${res.cardLastDigits})`);
            executeCheckoutWithPayphone(res);
          }}
          onClose={() => setShowPayphoneModal(false)}
        />
      )}
      {showOpenCashModal && (
        <div className="modal-overlay" onClick={() => setShowOpenCashModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-head">
              <h3>💵 Apertura de Turno de Caja</h3>
              <button className="close-button" onClick={() => setShowOpenCashModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
              Ingresa el monto de efectivo inicial (fondo de cambio / sencillo en gaveta) para iniciar el turno de ventas.
            </p>
            <form onSubmit={submitOpenCash}>
              <label>
                <span>Fondo de Inicio en Efectivo ($ USD) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={openingFund}
                  onChange={e => setOpeningFund(e.target.value)}
                  placeholder="50.00"
                  style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}
                  required
                  autoFocus
                />
              </label>
              <div style={{ display: 'flex', gap: '6px', margin: '8px 0 14px' }}>
                {['20.00', '50.00', '100.00'].map(val => (
                  <button
                    key={val}
                    type="button"
                    className="secondary-action"
                    style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }}
                    onClick={() => setOpeningFund(val)}
                  >
                    ${val}
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowOpenCashModal(false)}>
                  Cancelar
                </button>
                <button className="primary-action" disabled={openingBusy}>
                  {openingBusy ? 'Abriendo...' : '✓ Confirmar Apertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}


export default POS;
