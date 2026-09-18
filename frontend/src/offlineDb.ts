// IndexedDB offline cache and sync manager for FixmeTiendas POS

const DB_NAME = 'FixmeOfflineDB';
const DB_VERSION = 1;

export interface OfflineSaleItem {
  productId: string;
  quantity: number;
  name?: string;
  price?: number;
}

export interface OfflineSale {
  offlineFolio: string; // e.g. OFF-847291
  createdAt: string;
  branchId: string;
  customerId?: string | null;
  customerName?: string;
  customerIdentification?: string;
  warrantyDays: number;
  channel: string;
  fulfillmentType: string;
  shippingCost: number;
  invoiceType: 'INTERNAL_TICKET' | 'SRI_INVOICE';
  items: OfflineSaleItem[];
  payments: Array<{ method: string; amount: number }>;
  delivery?: {
    recipientName?: string;
    recipientPhone?: string;
    address?: string;
    notes?: string;
    courier?: string;
  } | null;
  grandTotal: number;
  synced: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pendingSales')) {
        db.createObjectStore('pendingSales', { keyPath: 'offlineFolio' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 1. Catalog Caching
export async function saveCatalogLocally(products: any[]): Promise<void> {
  if (!products || !products.length) return;
  const db = await openDB();
  const tx = db.transaction('catalog', 'readwrite');
  const store = tx.objectStore('catalog');
  for (const p of products) {
    store.put(p);
  }
}

export async function getCatalogLocally(): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('catalog', 'readonly');
    const store = tx.objectStore('catalog');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// 2. Customers Caching
export async function saveCustomersLocally(customers: any[]): Promise<void> {
  if (!customers || !customers.length) return;
  const db = await openDB();
  const tx = db.transaction('customers', 'readwrite');
  const store = tx.objectStore('customers');
  for (const c of customers) {
    store.put(c);
  }
}

export async function getCustomersLocally(): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readonly');
    const store = tx.objectStore('customers');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// 3. Offline Sales Queue
export async function queueOfflineSale(sale: OfflineSale): Promise<OfflineSale> {
  const db = await openDB();
  const tx = db.transaction(['pendingSales', 'catalog'], 'readwrite');
  const salesStore = tx.objectStore('pendingSales');
  const catalogStore = tx.objectStore('catalog');

  // Decrement local stock for each product to prevent over-selling while offline
  for (const item of sale.items) {
    const pReq = catalogStore.get(item.productId);
    pReq.onsuccess = () => {
      const prod = pReq.result;
      if (prod && prod.stock != null) {
        prod.stock = Math.max(0, Number(prod.stock) - item.quantity);
        catalogStore.put(prod);
      }
    };
  }

  salesStore.put(sale);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(sale);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSales(): Promise<OfflineSale[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingSales', 'readonly');
    const store = tx.objectStore('pendingSales');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingSale(offlineFolio: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('pendingSales', 'readwrite');
  tx.objectStore('pendingSales').delete(offlineFolio);
}

export async function clearPendingSales(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('pendingSales', 'readwrite');
  tx.objectStore('pendingSales').clear();
}
