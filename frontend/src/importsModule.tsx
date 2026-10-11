import React from 'react';
import {
  Truck,
  Plane,
  Building,
  CheckCircle,
  Plus,
  Search,
  ExternalLink,
  DollarSign,
  Package,
  Calendar,
  Eye,
  MessageSquare,
  ArrowRight,
  ShieldAlert,
  Clock,
  Sparkles,
  Info,
  Check,
  Tag,
  UserCheck,
  Send,
  Trash2,
  Printer
} from 'lucide-react';
import { BarcodeTagsModal } from './commercialModals';

type Any = Record<string, any>;

interface ImportsModuleProps {
  api: (url: string, opt?: RequestInit) => Promise<Response>;
}

export function ImportsModule({ api }: ImportsModuleProps) {
  const [tab, setTab] = React.useState<'shipments' | 'quotes'>('shipments');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const [shipments, setShipments] = React.useState<Any[]>([]);
  const [quotes, setQuotes] = React.useState<Any[]>([]);
  const [categories, setCategories] = React.useState<Any[]>([]);

  // Modals
  const [showShipmentModal, setShowShipmentModal] = React.useState(false);
  const [selectedShipment, setSelectedShipment] = React.useState<Any | null>(null);
  const [showAddItemModal, setShowAddItemModal] = React.useState(false);
  const [selectedQuote, setSelectedQuote] = React.useState<Any | null>(null);

  // Barcodes Modal
  const [barcodeProducts, setBarcodeProducts] = React.useState<Any[] | null>(null);

  // Reservation Modal
  const [showReservationModal, setShowReservationModal] = React.useState(false);
  const [reservationForm, setReservationForm] = React.useState({
    itemId: '',
    customerName: '',
    customerPhone: '',
    quantity: 1,
    depositAmount: '0.00',
    notes: ''
  });

  // Advance stage modal
  const [advanceModal, setAdvanceModal] = React.useState<{
    isOpen: boolean;
    shipment: Any | null;
    targetStage: string;
    actualFreightCost: string;
    actualCustomsCost: string;
    targetCategoryId: string;
    regularPrice: string;
  }>({
    isOpen: false,
    shipment: null,
    targetStage: '',
    actualFreightCost: '',
    actualCustomsCost: '',
    targetCategoryId: '',
    regularPrice: ''
  });

  // Forms
  const [shipmentForm, setShipmentForm] = React.useState({
    title: '',
    trackingNumber: '',
    courierName: 'Servientrega Box',
    originStore: 'eBay',
    stage: 'PURCHASED',
    weightLbs: '2.5',
    originCost: '150.00',
    freightCost: '25.00',
    customsCost: '15.00',
    estimatedArrivalDate: '',
    notes: '',
    // Integrated item fields
    productName: '',
    sku: '',
    quantity: 1,
    targetCategoryId: '',
    preorderPrice: '210.00',
    regularPrice: '240.00',
    imageUrl: '',
    isPublicCatalog: true
  });

  const [itemForm, setItemForm] = React.useState({
    productName: '',
    sku: '',
    quantity: 1,
    unitOriginCost: '0.00',
    unitFreightCost: '0.00',
    unitCustomsCost: '0.00',
    preorderPrice: '0.00',
    regularPrice: '0.00',
    imageUrl: '',
    targetCategoryId: '',
    isPublicCatalog: true
  });

  const [quoteAnswerForm, setQuoteAnswerForm] = React.useState({
    estimatedOriginPrice: '0.00',
    estimatedShippingFee: '15.00',
    estimatedCustomsFee: '10.00',
    totalQuotedPrice: '0.00',
    estimatedDeliveryDays: 10,
    sellerNotes: ''
  });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [resShipments, resQuotes, resCategories] = await Promise.all([
        api('/api/imports/shipments').then(r => r.ok ? r.json() : []),
        api('/api/imports/quotes').then(r => r.ok ? r.json() : []),
        api('/api/categories').then(r => r.ok ? r.json() : [])
      ]);
      setShipments(Array.isArray(resShipments) ? resShipments : []);
      setQuotes(Array.isArray(resQuotes) ? resQuotes : []);
      setCategories(Array.isArray(resCategories) ? resCategories : []);
    } catch (e: any) {
      setError(e.message || 'Error al cargar importaciones');
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Stage steps mapping
  const stages = [
    { key: 'PURCHASED', label: 'Comprado en Origen', icon: '🛒' },
    { key: 'WAREHOUSE_MIAMI', label: 'En Bodega Miami', icon: '📦' },
    { key: 'IN_TRANSIT', label: 'Vuelo / En Tránsito', icon: '✈️' },
    { key: 'CUSTOMS', label: 'En Aduana del País', icon: '🏛️' },
    { key: 'ARRIVED_LOCAL', label: 'En Tienda / Bodega Local', icon: '🏬' }
  ];

  const getStageIndex = (stageKey: string) => {
    const idx = stages.findIndex(s => s.key === stageKey);
    return idx >= 0 ? idx : 0;
  };

  // Open smart advance modal
  const handleOpenAdvanceModal = (s: Any) => {
    const idx = getStageIndex(s.stage);
    if (idx >= stages.length - 1) return;
    const nextStage = stages[idx + 1].key;

    const defaultFreight = String(s.actual_freight_cost || s.estimated_freight_cost || s.freight_cost || '25.00');
    const defaultCustoms = String(s.actual_customs_cost || s.estimated_customs_cost || s.customs_cost || '15.00');

    setAdvanceModal({
      isOpen: true,
      shipment: s,
      targetStage: nextStage,
      actualFreightCost: defaultFreight,
      actualCustomsCost: defaultCustoms,
      targetCategoryId: categories.length > 0 ? categories[0].id : '',
      regularPrice: ''
    });
  };

  // Confirm advancing stage with real costs
  const handleConfirmAdvanceStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceModal.shipment) return;

    try {
      const payload: Any = {
        stage: advanceModal.targetStage,
        importToInventory: 'true'
      };

      if (advanceModal.actualFreightCost) {
        payload.actualFreightCost = Number(advanceModal.actualFreightCost) || 0;
      }
      if (advanceModal.actualCustomsCost) {
        payload.actualCustomsCost = Number(advanceModal.actualCustomsCost) || 0;
      }
      if (advanceModal.targetCategoryId) {
        payload.targetCategoryId = advanceModal.targetCategoryId;
      }
      if (advanceModal.regularPrice) {
        payload.regularPrice = Number(advanceModal.regularPrice) || 0;
      }

      const res = await api(`/api/imports/shipments/${advanceModal.shipment.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'No se pudo actualizar la etapa');
      }

      const targetStageLabel = stages.find(st => st.key === advanceModal.targetStage)?.label || advanceModal.targetStage;
      setSuccess(`Lote avanzado con éxito a: ${targetStageLabel}`);
      setAdvanceModal({ ...advanceModal, isOpen: false, shipment: null });
      loadData();

      if (selectedShipment && selectedShipment.id === advanceModal.shipment.id) {
        const updated = await res.json();
        setSelectedShipment(updated);
      }
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Save new shipment (with product integrated)
  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api('/api/imports/shipments', {
        method: 'POST',
        body: JSON.stringify({
          title: shipmentForm.title,
          trackingNumber: shipmentForm.trackingNumber,
          courierName: shipmentForm.courierName,
          originStore: shipmentForm.originStore,
          stage: shipmentForm.stage,
          weightLbs: Number(shipmentForm.weightLbs) || 0,
          originCost: Number(shipmentForm.originCost) || 0,
          freightCost: Number(shipmentForm.freightCost) || 0,
          estimatedFreightCost: Number(shipmentForm.freightCost) || 0,
          customsCost: Number(shipmentForm.customsCost) || 0,
          estimatedCustomsCost: Number(shipmentForm.customsCost) || 0,
          estimatedArrivalDate: shipmentForm.estimatedArrivalDate || null,
          notes: shipmentForm.notes,
          // Product item fields
          productName: shipmentForm.productName || shipmentForm.title,
          sku: shipmentForm.sku || null,
          quantity: Number(shipmentForm.quantity) || 1,
          targetCategoryId: shipmentForm.targetCategoryId || null,
          preorderPrice: Number(shipmentForm.preorderPrice) || 0,
          regularPrice: Number(shipmentForm.regularPrice) || 0,
          imageUrl: shipmentForm.imageUrl || null,
          isPublicCatalog: shipmentForm.isPublicCatalog
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Error al guardar envío');
      }
      setSuccess('Envío de importación y producto registrados con éxito');
      setShowShipmentModal(false);
      setShipmentForm({
        title: '',
        trackingNumber: '',
        courierName: 'Servientrega Box',
        originStore: 'eBay',
        stage: 'PURCHASED',
        weightLbs: '2.5',
        originCost: '150.00',
        freightCost: '25.00',
        customsCost: '15.00',
        estimatedArrivalDate: '',
        notes: '',
        productName: '',
        sku: '',
        quantity: 1,
        targetCategoryId: '',
        preorderPrice: '210.00',
        regularPrice: '240.00',
        imageUrl: '',
        isPublicCatalog: true
      });
      loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Convert Quote directly to Import Shipment
  const handleConvertQuoteToShipment = (q: Any) => {
    setShipmentForm({
      title: `Importación: ${q.product_description}`,
      trackingNumber: '',
      courierName: 'Servientrega Box',
      originStore: 'eBay',
      stage: 'PURCHASED',
      weightLbs: '2.5',
      originCost: String(q.estimated_origin_price || '0.00'),
      freightCost: String(q.estimated_shipping_fee || '15.00'),
      customsCost: String(q.estimated_customs_fee || '10.00'),
      estimatedArrivalDate: '',
      notes: `Cotización de cliente: ${q.customer_name} (${q.customer_phone})`,
      productName: q.product_description,
      sku: '',
      quantity: q.quantity || 1,
      targetCategoryId: categories.length > 0 ? categories[0].id : '',
      preorderPrice: String(q.total_quoted_price || '0.00'),
      regularPrice: String(q.total_quoted_price || '0.00'),
      imageUrl: '',
      isPublicCatalog: true
    });
    setShowShipmentModal(true);
  };

  // Add extra item to shipment
  const handleAddItemToShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;

    try {
      const res = await api(`/api/imports/shipments/${selectedShipment.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          ...itemForm,
          quantity: Number(itemForm.quantity) || 1,
          unitOriginCost: Number(itemForm.unitOriginCost) || 0,
          unitFreightCost: Number(itemForm.unitFreightCost) || 0,
          unitCustomsCost: Number(itemForm.unitCustomsCost) || 0,
          preorderPrice: Number(itemForm.preorderPrice) || 0,
          regularPrice: Number(itemForm.regularPrice) || 0,
          targetCategoryId: itemForm.targetCategoryId || null
        })
      });
      if (!res.ok) throw new Error('Error al agregar producto');
      const updated = await res.json();
      setSelectedShipment(updated);
      setShowAddItemModal(false);
      setItemForm({
        productName: '',
        sku: '',
        quantity: 1,
        unitOriginCost: '0.00',
        unitFreightCost: '0.00',
        unitCustomsCost: '0.00',
        preorderPrice: '0.00',
        regularPrice: '0.00',
        imageUrl: '',
        targetCategoryId: '',
        isPublicCatalog: true
      });
      loadData();
      setSuccess('Producto agregado al lote de importación');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Save Pre-Order Customer Reservation
  const handleSaveReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservationForm.itemId) return;

    try {
      const res = await api(`/api/imports/items/${reservationForm.itemId}/reservations`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: reservationForm.customerName,
          customerPhone: reservationForm.customerPhone,
          quantity: Number(reservationForm.quantity) || 1,
          depositAmount: Number(reservationForm.depositAmount) || 0,
          notes: reservationForm.notes
        })
      });
      if (!res.ok) throw new Error('Error al registrar reserva');
      setSuccess('Pre-compra registrada exitosamente');
      setShowReservationModal(false);
      setReservationForm({
        itemId: '',
        customerName: '',
        customerPhone: '',
        quantity: 1,
        depositAmount: '0.00',
        notes: ''
      });
      if (selectedShipment) {
        const updated = await api(`/api/imports/shipments/${selectedShipment.id}`).then(r => r.json());
        setSelectedShipment(updated);
      }
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 1-Click WhatsApp notification for pre-orders
  const handleNotifyCustomer = async (res: Any, type: 'TRANSIT' | 'ARRIVAL') => {
    const phone = (res.customer_phone || '').replace(/\D/g, '');
    const productName = res.product_name || 'tu producto';
    const qty = res.quantity || 1;
    const price = Number(res.preorder_price || res.regular_price || 0) * qty;
    const deposit = Number(res.deposit_amount || 0);
    const pending = Math.max(0, price - deposit);

    let msg = '';
    if (type === 'TRANSIT') {
      msg = `¡Hola ${res.customer_name}! 👋 Te saludamos de FIXME. Te confirmamos que tu producto reservado: *${productName}* (${qty} unid.) ya despegó y se encuentra en vuelo internacional hacia el país ✈️. Te notificaremos de inmediato apenas sea desaduanizado. ¡Gracias por tu confianza!`;
    } else {
      msg = `¡Hola ${res.customer_name}! 🎉 ¡Excelente noticia! Tu producto reservado: *${productName}* (${qty} unid.) ya arribó a nuestra tienda física y ha sido ingresado a bodega local 🏬. Ya puedes pasar a retirarlo o coordinar tu entrega a domicilio.${pending > 0 ? ` Saldo pendiente: $${pending.toFixed(2)}.` : ''} ¡Te esperamos!`;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');

    try {
      await api(`/api/imports/reservations/${res.id}/notified`, {
        method: 'PATCH',
        body: JSON.stringify({ type })
      });
      if (selectedShipment) {
        const updated = await api(`/api/imports/shipments/${selectedShipment.id}`).then(r => r.json());
        setSelectedShipment(updated);
      }
    } catch {}
  };

  // Delete Reservation
  const handleDeleteReservation = async (resId: string) => {
    if (!confirm('¿Eliminar esta reserva y liberar las unidades separadas?')) return;
    try {
      await api(`/api/imports/reservations/${resId}`, { method: 'DELETE' });
      if (selectedShipment) {
        const updated = await api(`/api/imports/shipments/${selectedShipment.id}`).then(r => r.json());
        setSelectedShipment(updated);
      }
      loadData();
      setSuccess('Reserva eliminada y unidades liberadas');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Submit Quote Answer
  const handleSaveQuoteAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;

    try {
      const orig = Number(quoteAnswerForm.estimatedOriginPrice) || 0;
      const freight = Number(quoteAnswerForm.estimatedShippingFee) || 0;
      const customs = Number(quoteAnswerForm.estimatedCustomsFee) || 0;
      const total = Number(quoteAnswerForm.totalQuotedPrice) || (orig + freight + customs);

      const res = await api(`/api/imports/quotes/${selectedQuote.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'QUOTED',
          estimatedOriginPrice: orig,
          estimatedShippingFee: freight,
          estimatedCustomsFee: customs,
          totalQuotedPrice: total,
          estimatedDeliveryDays: Number(quoteAnswerForm.estimatedDeliveryDays) || 10,
          sellerNotes: quoteAnswerForm.sellerNotes
        })
      });
      if (!res.ok) throw new Error('Error al actualizar cotización');
      setSuccess('Cotización guardada exitosamente');
      setSelectedQuote(null);
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Projected landed calculations for form
  const projectedLanded = (Number(shipmentForm.originCost) || 0) +
    (Number(shipmentForm.freightCost) || 0) +
    (Number(shipmentForm.customsCost) || 0);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1300, margin: '0 auto' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Plane size={26} color="var(--primary)" /> Importaciones & Próximos Arribos
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13.5 }}>
            Rastreo desde compras internacionales (eBay/Miami) hasta desaduanización, pre-ventas automáticas en el catálogo digital y cotizaciones a clientes.
          </p>
        </div>

        <button
          type="button"
          className="primary-action"
          onClick={() => setShowShipmentModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} /> + Registrar Nuevo Envío Internacional
        </button>
      </div>

      {/* NOTIFICATIONS */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#ecfdf5', border: '1px solid #34d399', color: '#065f46', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {success}
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setTab('shipments')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: tab === 'shipments' ? 700 : 500,
            borderBottom: tab === 'shipments' ? '3px solid var(--primary)' : '3px solid transparent',
            color: tab === 'shipments' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          🚢 Lotes y Envíos en Courier ({shipments.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('quotes')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontWeight: tab === 'quotes' ? 700 : 500,
            borderBottom: tab === 'quotes' ? '3px solid var(--primary)' : '3px solid transparent',
            color: tab === 'quotes' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          🛍️ Cotizaciones Solicitadas por Clientes ({quotes.length})
        </button>
      </div>

      {/* TAB 1: SHIPMENTS */}
      {tab === 'shipments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {shipments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
              <Plane size={44} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
              <h3>No tienes envíos de importación registrados</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Registra compras de eBay, Amazon o China para dar seguimiento al courier y publicar productos en preventa antes de que lleguen.
              </p>
              <button type="button" className="primary-action" onClick={() => setShowShipmentModal(true)} style={{ marginTop: 12 }}>
                + Registrar Primer Envío
              </button>
            </div>
          ) : (
            shipments.map(s => {
              const currentIdx = getStageIndex(s.stage);
              const isCatalogActive = ['IN_TRANSIT', 'CUSTOMS'].includes(s.stage);
              const isArrivedLocal = s.stage === 'ARRIVED_LOCAL';

              return (
                <div key={s.id} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{s.title}</h3>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--surface-subtle)', fontWeight: 700 }}>
                          {s.origin_store || 'Origen Exterior'}
                        </span>
                        {isCatalogActive && (
                          <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            🌐 Publicado en 'Próximos Arribos' (Preventa)
                          </span>
                        )}
                        {isArrivedLocal && (
                          <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 6, background: '#ecfdf5', color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            🏬 Ingresado a Inventario Oficial
                          </span>
                        )}
                        {Number(s.total_reserved || 0) > 0 && (
                          <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 6, background: '#fdf2f8', color: '#db2777', fontWeight: 700 }}>
                            👥 {s.total_reserved} unids separadas
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span>Tracking: <strong>{s.tracking_number}</strong> ({s.courier_name || 'Courier'})</span>
                        {s.weight_lbs && <span>Peso: {s.weight_lbs} lbs</span>}
                        {s.estimated_arrival_date && <span>Llegada estimada: {s.estimated_arrival_date}</span>}
                        <span>Artículos en Lote: <strong>{s.total_units || s.items_count || 1} unids</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={async () => {
                          const res = await api(`/api/imports/shipments/${s.id}`).then(r => r.json());
                          setSelectedShipment(res);
                        }}
                        style={{ fontSize: 13, padding: '6px 12px' }}
                      >
                        <Eye size={14} style={{ marginRight: 4 }} /> Ver / Gestionar ({s.items_count || 0})
                      </button>

                      <button
                        type="button"
                        className="secondary-action"
                        onClick={async () => {
                          const res = await api(`/api/imports/shipments/${s.id}`).then(r => r.json());
                          if (res.items && res.items.length > 0) {
                            setBarcodeProducts(res.items);
                          } else {
                            setBarcodeProducts([{ id: s.id, name: s.title, sku: s.tracking_number, price: s.total_landed_cost }]);
                          }
                        }}
                        style={{ fontSize: 13, padding: '6px 12px' }}
                        title="Imprimir etiquetas con código de barras para los productos de este lote"
                      >
                        <Tag size={14} style={{ marginRight: 4 }} /> Etiquetas
                      </button>

                      {currentIdx < stages.length - 1 && (
                        <button
                          type="button"
                          className="primary-action"
                          onClick={() => handleOpenAdvanceModal(s)}
                          style={{ fontSize: 13, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          Avanzar Etapa → {stages[currentIdx + 1].icon}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* STEPPER TRACKING BAR */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-subtle)', padding: '14px 18px', borderRadius: 10 }}>
                    {stages.map((st, idx) => {
                      const isPassed = currentIdx >= idx;
                      const isCurrent = currentIdx === idx;
                      return (
                        <div key={st.key} style={{ display: 'flex', alignItems: 'center', flex: idx < stages.length - 1 ? 1 : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 15,
                              background: isCurrent ? 'var(--primary)' : isPassed ? '#10b981' : 'var(--surface)',
                              color: isCurrent || isPassed ? '#fff' : 'var(--text-muted)',
                              border: isCurrent || isPassed ? 'none' : '1px solid var(--border)'
                            }}>
                              {st.icon}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: isCurrent ? 800 : isPassed ? 600 : 400, color: isCurrent ? 'var(--primary)' : 'var(--text)' }}>
                              {st.label}
                            </span>
                          </div>
                          {idx < stages.length - 1 && (
                            <div style={{
                              flex: 1,
                              height: 2,
                              background: currentIdx > idx ? '#10b981' : 'var(--border)',
                              margin: '0 12px'
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* LANDED COST SUMMARY */}
                  <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>Compra Origen: <strong>${Number(s.origin_cost || 0).toFixed(2)}</strong></span>
                    <span>
                      + Flete Courier: <strong>${Number(s.freight_cost || s.estimated_freight_cost || 0).toFixed(2)}</strong>{' '}
                      <small style={{ color: s.actual_freight_cost ? '#059669' : '#d97706', fontWeight: 600 }}>
                        {s.actual_freight_cost ? '(Real Cobrado ✓)' : '(Referencial ℹ️)'}
                      </small>
                    </span>
                    <span>
                      + Aduana: <strong>${Number(s.customs_cost || s.estimated_customs_cost || 0).toFixed(2)}</strong>{' '}
                      <small style={{ color: s.actual_customs_cost ? '#059669' : '#d97706', fontWeight: 600 }}>
                        {s.actual_customs_cost ? '(Real Liquidado ✓)' : '(Referencial ℹ️)'}
                      </small>
                    </span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                      = Costo Total Aterrizado: <strong>${Number(s.total_landed_cost || 0).toFixed(2)}</strong>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: QUOTES */}
      {tab === 'quotes' && (
        <div>
          {quotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
              <MessageSquare size={44} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
              <h3>No hay solicitudes de cotización de clientes</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Cuando los clientes ingresen en el catálogo digital solicitando cotizaciones de productos especiales, aparecerán aquí.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {quotes.map(q => (
                <div key={q.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <h4 style={{ margin: '0 0 2px', fontSize: 16 }}>{q.customer_name}</h4>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📞 {q.customer_phone}</span>
                    </div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: q.status === 'QUOTED' ? '#eff6ff' : q.status === 'ACCEPTED' ? '#ecfdf5' : '#fffbeb',
                      color: q.status === 'QUOTED' ? '#2563eb' : q.status === 'ACCEPTED' ? '#059669' : '#b45309'
                    }}>
                      {q.status === 'QUOTED' ? 'COTIZADO' : q.status === 'ACCEPTED' ? 'ACEPTADO' : q.status === 'ORDERED' ? 'EN PEDIDO' : 'PENDIENTE'}
                    </span>
                  </div>

                  <div style={{ background: 'var(--surface-subtle)', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                    <strong>Producto Solicitado ({q.quantity}x):</strong>
                    <p style={{ margin: '4px 0 6px', color: 'var(--text)' }}>{q.product_description}</p>
                    {q.product_url && (
                      <a href={q.product_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 11.5 }}>
                        🔗 Ver enlace de compra <ExternalLink size={12} />
                      </a>
                    )}
                  </div>

                  {q.status === 'QUOTED' && (
                    <div style={{ fontSize: 12.5, borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Precio Final Cotizado:</span>
                        <strong style={{ color: 'var(--primary)', fontSize: 14 }}>${Number(q.total_quoted_price || 0).toFixed(2)}</strong>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Tiempo estimado: {q.estimated_delivery_days} días laborables
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="primary-action"
                      style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                      onClick={() => {
                        setSelectedQuote(q);
                        setQuoteAnswerForm({
                          estimatedOriginPrice: String(q.estimated_origin_price || '0.00'),
                          estimatedShippingFee: String(q.estimated_shipping_fee || '15.00'),
                          estimatedCustomsFee: String(q.estimated_customs_fee || '10.00'),
                          totalQuotedPrice: String(q.total_quoted_price || '0.00'),
                          estimatedDeliveryDays: q.estimated_delivery_days || 10,
                          sellerNotes: q.seller_notes || ''
                        });
                      }}
                    >
                      {q.status === 'QUOTED' ? '✏️ Modificar' : '💼 Responder'}
                    </button>

                    <button
                      type="button"
                      className="secondary-action"
                      style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontWeight: 700 }}
                      onClick={() => handleConvertQuoteToShipment(q)}
                      title="Crear envío de importación a partir de esta cotización"
                    >
                      🚀 Importar
                    </button>

                    {q.customer_phone && (
                      <a
                        href={`https://wa.me/${q.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `¡Hola ${q.customer_name}! Te saludamos de FIXME. Respecto a tu cotización de importación para "${q.product_description}", el valor total de importación puesta en tienda es de $${Number(q.total_quoted_price || 0).toFixed(2)} con entrega estimada en ${q.estimated_delivery_days || 10} días. ¿Deseas reservarlo?`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-action"
                        style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center' }}
                      >
                        💬 WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: REGISTRAR ENVÍO UNIFICADO (ENVÍO + PRODUCTO) */}
      {showShipmentModal && (
        <div className="modal-overlay" onClick={() => setShowShipmentModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modal-head">
              <h3>📦 Registrar Envío de Importación</h3>
              <button className="close-button" onClick={() => setShowShipmentModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveShipment}>
              {/* SECCIÓN 1: DATOS DEL ENVÍO */}
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: 8 }}>
                  1. DATOS DEL LOTE / SEGUIMIENTO COURIER
                </span>

                <label>
                  <span>Título / Descripción del Lote *:</span>
                  <input
                    required
                    placeholder="Ej. iPhone 15 Pro Max 256GB Black Titanium"
                    value={shipmentForm.title}
                    onChange={e => {
                      const val = e.target.value;
                      setShipmentForm({
                        ...shipmentForm,
                        title: val,
                        productName: shipmentForm.productName ? shipmentForm.productName : val
                      });
                    }}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label>
                    <span>Número de Tracking Internacional:</span>
                    <input
                      placeholder="Ej. 1Z9999999999999999"
                      value={shipmentForm.trackingNumber}
                      onChange={e => setShipmentForm({ ...shipmentForm, trackingNumber: e.target.value })}
                    />
                  </label>

                  <label>
                    <span>Courier / Casillero Miami:</span>
                    <input
                      placeholder="Ej. Servientrega Box / DHL / Miami Box"
                      value={shipmentForm.courierName}
                      onChange={e => setShipmentForm({ ...shipmentForm, courierName: e.target.value })}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label>
                    <span>Tienda / Proveedor de Origen:</span>
                    <select
                      value={shipmentForm.originStore}
                      onChange={e => setShipmentForm({ ...shipmentForm, originStore: e.target.value })}
                    >
                      <option value="eBay">eBay</option>
                      <option value="Amazon">Amazon</option>
                      <option value="Apple Refurbished">Apple Refurbished</option>
                      <option value="AliExpress">AliExpress</option>
                      <option value="Distribuidor China">Distribuidor China</option>
                      <option value="Otro">Otro Proveedor Exterior</option>
                    </select>
                  </label>

                  <label>
                    <span>Fecha Estimada de Arribo al País:</span>
                    <input
                      type="date"
                      value={shipmentForm.estimatedArrivalDate}
                      onChange={e => setShipmentForm({ ...shipmentForm, estimatedArrivalDate: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              {/* SECCIÓN 2: COSTOS INICIALES (REFERENCIALES) */}
              <div style={{ background: 'var(--surface-subtle)', padding: 14, borderRadius: 10, marginBottom: 16, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                    2. COSTOS DE COMPRA (Flete y Aduana Referenciales)
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    Costo Landed Proyectado: <strong style={{ color: 'var(--primary)', fontSize: 14 }}>${projectedLanded.toFixed(2)}</strong>
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <label>
                    <span>Costo Compra Origen ($):</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={shipmentForm.originCost}
                      onChange={e => setShipmentForm({ ...shipmentForm, originCost: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Flete Courier Ref. ($):</span>
                    <input
                      type="number"
                      step="0.01"
                      value={shipmentForm.freightCost}
                      onChange={e => setShipmentForm({ ...shipmentForm, freightCost: e.target.value })}
                    />
                    <small style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Se confirmará al despachar vuelo</small>
                  </label>
                  <label>
                    <span>Aduana / Impuestos Ref. ($):</span>
                    <input
                      type="number"
                      step="0.01"
                      value={shipmentForm.customsCost}
                      onChange={e => setShipmentForm({ ...shipmentForm, customsCost: e.target.value })}
                    />
                    <small style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Se confirmará al liquidar en país</small>
                  </label>
                </div>
              </div>

              {/* SECCIÓN 3: DATOS DEL PRODUCTO PARA CATÁLOGO E INVENTARIO */}
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: 8 }}>
                  3. PRODUCTO PARA CATÁLOGO DIGITAL & INVENTARIO OFICIAL
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                  <label>
                    <span>Nombre del Producto *:</span>
                    <input
                      required
                      placeholder="Ej. iPhone 15 Pro Max 256GB"
                      value={shipmentForm.productName || shipmentForm.title}
                      onChange={e => setShipmentForm({ ...shipmentForm, productName: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>SKU / Código:</span>
                    <input
                      placeholder="Auto si se omite"
                      value={shipmentForm.sku}
                      onChange={e => setShipmentForm({ ...shipmentForm, sku: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Cantidad:</span>
                    <input
                      type="number"
                      min="1"
                      required
                      value={shipmentForm.quantity}
                      onChange={e => setShipmentForm({ ...shipmentForm, quantity: Number(e.target.value) || 1 })}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                  <label>
                    <span>Precio Pre-Venta en Catálogo ($):</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Precio para separar en camino"
                      value={shipmentForm.preorderPrice}
                      onChange={e => setShipmentForm({ ...shipmentForm, preorderPrice: e.target.value })}
                    />
                    <small style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Visible en 'Próximos Arribos'</small>
                  </label>
                  <label>
                    <span>Precio Venta Regular en Tienda ($):</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Precio al llegar a tienda"
                      value={shipmentForm.regularPrice}
                      onChange={e => setShipmentForm({ ...shipmentForm, regularPrice: e.target.value })}
                    />
                    <small style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Precio oficial en POS</small>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                  <label>
                    <span>Categoría Destino en Inventario:</span>
                    <select
                      value={shipmentForm.targetCategoryId}
                      onChange={e => setShipmentForm({ ...shipmentForm, targetCategoryId: e.target.value })}
                    >
                      <option value="">-- Asignar categoría --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>URL de Imagen del Producto:</span>
                    <input
                      placeholder="https://..."
                      value={shipmentForm.imageUrl}
                      onChange={e => setShipmentForm({ ...shipmentForm, imageUrl: e.target.value })}
                    />
                  </label>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shipmentForm.isPublicCatalog}
                    onChange={e => setShipmentForm({ ...shipmentForm, isPublicCatalog: e.target.checked })}
                  />
                  <span style={{ fontSize: 12.5 }}>
                    Mostrar automáticamente en el Catálogo Digital en '🚢 Próximos Arribos' cuando esté en tránsito o aduana
                  </span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-action" onClick={() => setShowShipmentModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action">
                  ✓ Crear Envío y Registrar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AVANZAR ETAPA Y CONFIRMAR COSTOS REALES */}
      {advanceModal.isOpen && advanceModal.shipment && (
        <div className="modal-overlay" onClick={() => setAdvanceModal({ ...advanceModal, isOpen: false })}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-head">
              <h3>
                {advanceModal.targetStage === 'IN_TRANSIT' && '✈️ Confirmar Envío / En Tránsito al País'}
                {advanceModal.targetStage === 'CUSTOMS' && '🏛️ Ingreso a Aduana del País'}
                {advanceModal.targetStage === 'ARRIVED_LOCAL' && '🏬 Liquidación de Aduana & Arribo a Tienda'}
                {advanceModal.targetStage === 'WAREHOUSE_MIAMI' && '📦 Recepción en Bodega Miami'}
              </h3>
              <button className="close-button" onClick={() => setAdvanceModal({ ...advanceModal, isOpen: false })}>✕</button>
            </div>

            <form onSubmit={handleConfirmAdvanceStage}>
              <div style={{ background: 'var(--surface-subtle)', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                <div>Lote: <strong>{advanceModal.shipment.title}</strong></div>
                <div>Tracking: <strong>{advanceModal.shipment.tracking_number}</strong> ({advanceModal.shipment.courier_name})</div>
              </div>

              {/* STAGE: IN_TRANSIT (VUELO / FLETE REAL) */}
              {advanceModal.targetStage === 'IN_TRANSIT' && (
                <div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                    ℹ️ <strong>Costo de flete courier referencial:</strong> ${Number(advanceModal.shipment.estimated_freight_cost || advanceModal.shipment.freight_cost || 0).toFixed(2)}.
                    Ingrese a continuación el valor REAL facturado por el courier al despachar el vuelo.
                  </div>

                  <label>
                    <span>Costo Real de Flete Courier ($) *:</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={advanceModal.actualFreightCost}
                      onChange={e => setAdvanceModal({ ...advanceModal, actualFreightCost: e.target.value })}
                    />
                  </label>

                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    🌐 Al cambiar a 'En Tránsito', los productos de este envío se publicarán automáticamente en el Catálogo Digital en <strong>'🚢 Próximos Arribos'</strong> para pre-compras.
                  </p>
                </div>
              )}

              {/* STAGE: CUSTOMS (EN ADUANA) */}
              {advanceModal.targetStage === 'CUSTOMS' && (
                <div>
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                    🏛️ El paquete ha arribado al país y ha ingresado al recinto aduanero para aforo e inspección.
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Los productos siguen visibles en el Catálogo Digital en <strong>'🚢 Próximos Arribos'</strong>. Podrás ingresar los valores finales de liquidación aduanera al dar ingreso a bodega local.
                  </p>
                </div>
              )}

              {/* STAGE: ARRIVED_LOCAL (INGRESO A INVENTARIO Y ADUANA REAL) */}
              {advanceModal.targetStage === 'ARRIVED_LOCAL' && (
                <div>
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
                    ✅ <strong>¡Desaduanización Completa!</strong>
                    El producto pasará de 'Próximos Arribos' al <strong>Inventario Oficial de la tienda</strong> con stock físico disponible y movimiento de entrada en Kardex.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label>
                      <span>Costo Real Liquidación Aduana ($) *:</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={advanceModal.actualCustomsCost}
                        onChange={e => setAdvanceModal({ ...advanceModal, actualCustomsCost: e.target.value })}
                      />
                    </label>

                    <label>
                      <span>Categoría Destino en Inventario:</span>
                      <select
                        value={advanceModal.targetCategoryId}
                        onChange={e => setAdvanceModal({ ...advanceModal, targetCategoryId: e.target.value })}
                      >
                        <option value="">-- Sin categoría asignada --</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label style={{ marginTop: 8 }}>
                    <span>Precio de Venta Oficial en Tienda ($):</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Dejar vacío para conservar precio configurado"
                      value={advanceModal.regularPrice}
                      onChange={e => setAdvanceModal({ ...advanceModal, regularPrice: e.target.value })}
                    />
                  </label>
                </div>
              )}

              {/* STAGE: WAREHOUSE_MIAMI */}
              {advanceModal.targetStage === 'WAREHOUSE_MIAMI' && (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text)' }}>
                    ¿Confirmar que el paquete fue entregado y recibido en la bodega / casillero de Miami?
                  </p>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button type="button" className="secondary-action" onClick={() => setAdvanceModal({ ...advanceModal, isOpen: false })}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action">
                  ✓ Confirmar y Avanzar Etapa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VER/GESTIONAR PRODUCTOS Y PRE-COMPRAS DEL ENVÍO */}
      {selectedShipment && (
        <div className="modal-overlay" onClick={() => setSelectedShipment(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 820 }}>
            <div className="modal-head">
              <h3>📦 Lote: {selectedShipment.title}</h3>
              <button className="close-button" onClick={() => setSelectedShipment(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                Tracking: <strong>{selectedShipment.tracking_number}</strong> | Etapa: <strong>{selectedShipment.stage}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="secondary-action"
                  style={{ padding: '6px 12px', fontSize: 12.5 }}
                  onClick={() => {
                    if (selectedShipment.items && selectedShipment.items.length > 0) {
                      setBarcodeProducts(selectedShipment.items);
                    } else {
                      setBarcodeProducts([{ id: selectedShipment.id, name: selectedShipment.title, sku: selectedShipment.tracking_number, price: selectedShipment.total_landed_cost }]);
                    }
                  }}
                >
                  <Tag size={13} style={{ marginRight: 4 }} /> Imprimir Etiquetas
                </button>

                <button
                  type="button"
                  className="primary-action"
                  style={{ padding: '6px 12px', fontSize: 12.5 }}
                  onClick={() => setShowAddItemModal(true)}
                >
                  + Agregar Otro Producto
                </button>
              </div>
            </div>

            {/* PRODUCTOS EN EL LOTE */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, margin: '0 0 8px', color: 'var(--primary)' }}>Artículos en el Envío:</h4>
              {selectedShipment.items && selectedShipment.items.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 8 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: 6 }}>Producto</th>
                      <th style={{ padding: 6 }}>Cant. Total</th>
                      <th style={{ padding: 6 }}>Separadas</th>
                      <th style={{ padding: 6 }}>Costo Landed</th>
                      <th style={{ padding: 6 }}>Precio Pre-Venta</th>
                      <th style={{ padding: 6 }}>Precio Tienda</th>
                      <th style={{ padding: 6 }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedShipment.items.map((it: Any) => (
                      <tr key={it.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: 6 }}>
                          <strong>{it.product_name}</strong>
                          {it.sku && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SKU: {it.sku}</div>}
                        </td>
                        <td style={{ padding: 6 }}>{it.quantity}</td>
                        <td style={{ padding: 6, fontWeight: 700, color: '#db2777' }}>
                          {it.reserved_quantity || 0}
                        </td>
                        <td style={{ padding: 6 }}>${Number(it.unit_landed_cost || 0).toFixed(2)}</td>
                        <td style={{ padding: 6, color: '#2563eb', fontWeight: 700 }}>
                          ${Number(it.preorder_price || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: 6, fontWeight: 700 }}>
                          ${Number(it.regular_price || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: 6 }}>
                          <button
                            type="button"
                            className="primary-action"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => {
                              setReservationForm({
                                itemId: it.id,
                                customerName: '',
                                customerPhone: '',
                                quantity: 1,
                                depositAmount: '0.00',
                                notes: ''
                              });
                              setShowReservationModal(true);
                            }}
                          >
                            + Pre-Compra
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: 18, color: 'var(--text-muted)' }}>
                  No hay productos cargados en este lote todavía.
                </div>
              )}
            </div>

            {/* SECCIÓN PRE-COMPRAS Y ALERTAS DE WHATSAPP */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={{ fontSize: 14, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: '#be185d' }}>
                  👥 Clientes con Pre-Compra / Separación ({selectedShipment.reservations?.length || 0})
                </h4>
                {selectedShipment.items && selectedShipment.items.length > 0 && (
                  <button
                    type="button"
                    className="secondary-action"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => {
                      setReservationForm({
                        itemId: selectedShipment.items[0].id,
                        customerName: '',
                        customerPhone: '',
                        quantity: 1,
                        depositAmount: '0.00',
                        notes: ''
                      });
                      setShowReservationModal(true);
                    }}
                  >
                    + Registrar Nueva Separación
                  </button>
                )}
              </div>

              {selectedShipment.reservations && selectedShipment.reservations.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#fdf2f8', textAlign: 'left' }}>
                      <th style={{ padding: 6 }}>Cliente</th>
                      <th style={{ padding: 6 }}>Producto</th>
                      <th style={{ padding: 6 }}>Cant.</th>
                      <th style={{ padding: 6 }}>Abono ($)</th>
                      <th style={{ padding: 6 }}>Saldo ($)</th>
                      <th style={{ padding: 6, textAlign: 'center' }}>Notificaciones en 1 Clic</th>
                      <th style={{ padding: 6 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedShipment.reservations.map((r: Any) => {
                      const totalVal = Number(r.preorder_price || r.regular_price || 0) * (r.quantity || 1);
                      const deposit = Number(r.deposit_amount || 0);
                      const saldo = Math.max(0, totalVal - deposit);

                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: 6 }}>
                            <strong>{r.customer_name}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📞 {r.customer_phone}</div>
                          </td>
                          <td style={{ padding: 6 }}>{r.product_name}</td>
                          <td style={{ padding: 6 }}>{r.quantity}</td>
                          <td style={{ padding: 6, color: '#059669', fontWeight: 700 }}>${deposit.toFixed(2)}</td>
                          <td style={{ padding: 6, color: saldo > 0 ? '#b91c1c' : '#059669', fontWeight: 700 }}>
                            ${saldo.toFixed(2)}
                          </td>
                          <td style={{ padding: 6, textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => handleNotifyCustomer(r, 'TRANSIT')}
                                style={{
                                  background: r.notified_transit ? '#e0f2fe' : '#2563eb',
                                  color: r.notified_transit ? '#0369a1' : '#ffffff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  fontWeight: 700
                                }}
                                title="Enviar mensaje de WhatsApp avisando que el paquete está en vuelo hacia el país"
                              >
                                ✈️ {r.notified_transit ? 'Vuelo Enviado ✓' : 'Avisar Vuelo'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleNotifyCustomer(r, 'ARRIVAL')}
                                style={{
                                  background: r.notified_arrival ? '#dcfce7' : '#10b981',
                                  color: r.notified_arrival ? '#15803d' : '#ffffff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  fontWeight: 700
                                }}
                                title="Enviar mensaje de WhatsApp avisando que el producto ya llegó a la tienda para retiro"
                              >
                                🏬 {r.notified_arrival ? 'Arribo Enviado ✓' : 'Avisar Arribo'}
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: 6, textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteReservation(r.id)}
                              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                              title="Eliminar reserva"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: 14, color: 'var(--text-muted)', fontSize: 12.5 }}>
                  Aún no hay clientes que hayan separado unidades de este lote.
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button type="button" className="secondary-action" onClick={() => setSelectedShipment(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR PRE-COMPRA DE CLIENTE */}
      {showReservationModal && (
        <div className="modal-overlay" onClick={() => setShowReservationModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <h3>👥 Registrar Pre-Compra / Separación</h3>
              <button className="close-button" onClick={() => setShowReservationModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveReservation}>
              <label>
                <span>Artículo a Reservar:</span>
                <select
                  value={reservationForm.itemId}
                  onChange={e => setReservationForm({ ...reservationForm, itemId: e.target.value })}
                  required
                >
                  <option value="">-- Seleccionar producto del lote --</option>
                  {(selectedShipment?.items || []).map((it: Any) => (
                    <option key={it.id} value={it.id}>
                      {it.product_name} (Disponibles: {(it.quantity || 0) - (it.reserved_quantity || 0)})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <label>
                  <span>Nombre del Cliente *:</span>
                  <input
                    required
                    placeholder="Ej. Juan Pérez"
                    value={reservationForm.customerName}
                    onChange={e => setReservationForm({ ...reservationForm, customerName: e.target.value })}
                  />
                </label>
                <label>
                  <span>Cant. a Separar *:</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={reservationForm.quantity}
                    onChange={e => setReservationForm({ ...reservationForm, quantity: Number(e.target.value) || 1 })}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span>Teléfono / WhatsApp *:</span>
                  <input
                    required
                    placeholder="Ej. 0994175857"
                    value={reservationForm.customerPhone}
                    onChange={e => setReservationForm({ ...reservationForm, customerPhone: e.target.value })}
                  />
                </label>
                <label>
                  <span>Abono / Anticipo ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={reservationForm.depositAmount}
                    onChange={e => setReservationForm({ ...reservationForm, depositAmount: e.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Notas adicionales:</span>
                <textarea
                  rows={2}
                  placeholder="Ej. Retira en local norte o entrega express..."
                  value={reservationForm.notes}
                  onChange={e => setReservationForm({ ...reservationForm, notes: e.target.value })}
                />
              </label>

              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button type="button" className="secondary-action" onClick={() => setShowReservationModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action">
                  ✓ Guardar Pre-Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR PRODUCTO EXTRA AL LOTE */}
      {showAddItemModal && (
        <div className="modal-overlay" onClick={() => setShowAddItemModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
            <div className="modal-head">
              <h3>+ Agregar Producto al Lote</h3>
              <button className="close-button" onClick={() => setShowAddItemModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddItemToShipment}>
              <label>
                <span>Nombre del Producto *:</span>
                <input
                  required
                  placeholder="Ej. Pantalla OLED iPhone 15 Pro Max"
                  value={itemForm.productName}
                  onChange={e => setItemForm({ ...itemForm, productName: e.target.value })}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span>SKU / Código:</span>
                  <input
                    placeholder="Ej. LCD-IP15PM"
                    value={itemForm.sku}
                    onChange={e => setItemForm({ ...itemForm, sku: e.target.value })}
                  />
                </label>
                <label>
                  <span>Cantidad:</span>
                  <input
                    type="number"
                    min="1"
                    value={itemForm.quantity}
                    onChange={e => setItemForm({ ...itemForm, quantity: Number(e.target.value) || 1 })}
                    required
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label>
                  <span>Costo Origen U. ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.unitOriginCost}
                    onChange={e => setItemForm({ ...itemForm, unitOriginCost: e.target.value })}
                  />
                </label>
                <label>
                  <span>Flete U. ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.unitFreightCost}
                    onChange={e => setItemForm({ ...itemForm, unitFreightCost: e.target.value })}
                  />
                </label>
                <label>
                  <span>Aduana U. ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.unitCustomsCost}
                    onChange={e => setItemForm({ ...itemForm, unitCustomsCost: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span>Precio Pre-Venta ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Para pre-comprar"
                    value={itemForm.preorderPrice}
                    onChange={e => setItemForm({ ...itemForm, preorderPrice: e.target.value })}
                  />
                </label>
                <label>
                  <span>Precio de Venta Normal ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Al llegar a tienda"
                    value={itemForm.regularPrice}
                    onChange={e => setItemForm({ ...itemForm, regularPrice: e.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>URL de Imagen del Producto:</span>
                <input
                  placeholder="https://..."
                  value={itemForm.imageUrl}
                  onChange={e => setItemForm({ ...itemForm, imageUrl: e.target.value })}
                />
              </label>

              <label>
                <span>Categoría a la que pasará al llegar a tienda:</span>
                <select
                  value={itemForm.targetCategoryId}
                  onChange={e => setItemForm({ ...itemForm, targetCategoryId: e.target.value })}
                >
                  <option value="">-- Sin categoría asignada --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button type="button" className="secondary-action" onClick={() => setShowAddItemModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action">
                  Guardar en Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESPONDER COTIZACIÓN */}
      {selectedQuote && (
        <div className="modal-overlay" onClick={() => setSelectedQuote(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-head">
              <h3>💼 Responder Cotización a {selectedQuote.customer_name}</h3>
              <button className="close-button" onClick={() => setSelectedQuote(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveQuoteAnswer}>
              <div style={{ background: 'var(--surface-subtle)', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                <strong>Producto:</strong> {selectedQuote.product_description} ({selectedQuote.quantity}x)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span>Costo Compra Origen ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={quoteAnswerForm.estimatedOriginPrice}
                    onChange={e => setQuoteAnswerForm({ ...quoteAnswerForm, estimatedOriginPrice: e.target.value })}
                  />
                </label>
                <label>
                  <span>Flete Estimado ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={quoteAnswerForm.estimatedShippingFee}
                    onChange={e => setQuoteAnswerForm({ ...quoteAnswerForm, estimatedShippingFee: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span>Aduana / Impuestos ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={quoteAnswerForm.estimatedCustomsFee}
                    onChange={e => setQuoteAnswerForm({ ...quoteAnswerForm, estimatedCustomsFee: e.target.value })}
                  />
                </label>
                <label>
                  <span>Días Estimados de Entrega:</span>
                  <input
                    type="number"
                    value={quoteAnswerForm.estimatedDeliveryDays}
                    onChange={e => setQuoteAnswerForm({ ...quoteAnswerForm, estimatedDeliveryDays: Number(e.target.value) || 10 })}
                  />
                </label>
              </div>

              <label>
                <span>Precio Total Cotizado al Cliente ($) *:</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Total final con margen"
                  value={quoteAnswerForm.totalQuotedPrice}
                  onChange={e => setQuoteAnswerForm({ ...quoteAnswerForm, totalQuotedPrice: e.target.value })}
                />
              </label>

              <label>
                <span>Notas adicionales para el cliente:</span>
                <textarea
                  rows={2}
                  placeholder="Ej. Incluye garantía técnica de 60 días."
                  value={quoteAnswerForm.sellerNotes}
                  onChange={e => setQuoteAnswerForm({ ...quoteAnswerForm, sellerNotes: e.target.value })}
                />
              </label>

              <div className="modal-actions" style={{ marginTop: 14 }}>
                <button type="button" className="secondary-action" onClick={() => setSelectedQuote(null)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action">
                  ✓ Guardar Cotización
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPRIMIR ETIQUETAS DE CÓDIGOS DE BARRA */}
      {barcodeProducts && (
        <BarcodeTagsModal
          products={barcodeProducts}
          onClose={() => setBarcodeProducts(null)}
          storeName="FIXME TIENDAS"
        />
      )}
    </div>
  );
}
