import React from 'react';

export type TicketPaperWidth = '80mm' | '58mm';

const STORAGE_KEY = 'fixme_printer_format';

/**
 * Obtiene el formato de papel térmico preferido de la tienda (80mm por defecto, o 58mm mini).
 */
export function getStoredPaperWidth(): TicketPaperWidth {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === '58mm' || val === '80mm') {
      return val;
    }
  } catch (e) {
    // LocalStorage fallback
  }
  return '80mm';
}

/**
 * Guarda la preferencia de papel térmico en el almacenamiento local para que se recuerde en toda la app.
 */
export function setStoredPaperWidth(format: TicketPaperWidth) {
  try {
    localStorage.setItem(STORAGE_KEY, format);
  } catch (e) {
    // LocalStorage fallback
  }
  document.documentElement.setAttribute('data-print-format', format);
  document.body.setAttribute('data-print-format', format);
}

/**
 * Imprime cualquier elemento o ticket en un iframe aislado e independiente.
 * Esto elimina de raíz el problema de páginas en blanco en Chrome/Edge al imprimir
 * desde ventanas modales o aplicaciones SPA complejas.
 */
export function printTicketElement(elementId: string, customWidth?: TicketPaperWidth) {
  const width = customWidth || getStoredPaperWidth();
  setStoredPaperWidth(width);

  const el = document.getElementById(elementId);
  if (!el) {
    console.warn(`[TicketPrinter] Elemento #${elementId} no encontrado en el DOM.`);
    window.print();
    return;
  }

  // 1. Identificar tipo de documento
  const isA4 = ['printable-ride', 'printable-quote', 'printable-saas-receipt', 'printable-financial-report'].includes(elementId);
  const isBarcodes = elementId === 'printable-barcodes';
  const is58mm = !isA4 && !isBarcodes && width === '58mm';

  // 2. Clonar el contenido objetivo y sanitizarlo para impresión limpia
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print, button, .close-button, .close-btn, .modal-close, .ticket-size-toggle').forEach(n => n.remove());

  if (is58mm) {
    clone.classList.remove('paper-80mm');
    clone.classList.add('paper-58mm');
  } else if (!isA4 && !isBarcodes) {
    clone.classList.remove('paper-58mm');
    clone.classList.add('paper-80mm');
  }

  // 3. Crear o reutilizar el iframe oculto dedicado a la impresión
  let printIframe = document.getElementById('fixme-print-isolated-frame') as HTMLIFrameElement | null;
  if (!printIframe) {
    printIframe = document.createElement('iframe');
    printIframe.id = 'fixme-print-isolated-frame';
    printIframe.name = 'fixme-print-frame';
    printIframe.style.position = 'fixed';
    printIframe.style.left = '-9999px';
    printIframe.style.top = '-9999px';
    printIframe.style.width = '1000px';
    printIframe.style.height = '1000px';
    printIframe.style.border = '0';
    printIframe.style.opacity = '0';
    printIframe.style.pointerEvents = 'none';
    printIframe.style.zIndex = '-9999';
    document.body.appendChild(printIframe);
  }

  const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
  if (!iframeDoc) {
    console.warn('[TicketPrinter] No se pudo acceder al documento del iframe. Usando fallback.');
    window.print();
    return;
  }

  // 4. Extraer estilos y hojas de estilo del documento actual
  const existingStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => node.outerHTML)
    .join('\n');

  // 5. Dimensiones exactas según estándar térmico POS (58mm = ~48mm imprimibles, 80mm = ~72mm imprimibles)
  const pageSizeRule = isA4 ? 'A4 portrait' : isBarcodes ? 'auto' : (is58mm ? '58mm auto' : '80mm auto');
  const targetWidth = isA4 ? '100%' : (is58mm ? '48mm' : '72mm');

  const isolatedHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${isA4 ? 'Documento FIXME' : isBarcodes ? 'Etiquetas de Código de Barras' : `Ticket ${width}`}</title>
  ${existingStyles}
  <style>
    @page {
      size: ${pageSizeRule};
      margin: ${isA4 ? '8mm' : '0mm'} !important;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }
    body {
      display: flex !important;
      flex-direction: column !important;
      align-items: ${isA4 ? 'center' : 'flex-start'} !important;
      justify-content: flex-start !important;
      padding: ${isA4 ? '0' : '0'} !important;
      margin: 0 !important;
      font-family: ${isA4 ? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" : "'Courier New', Courier, monospace"} !important;
    }
    .no-print, button, .close-button, .close-btn, .modal-close, .ticket-size-toggle {
      display: none !important;
    }

    /* Reglas para contenedor principal */
    #${elementId},
    .thermal-receipt,
    .receipt-80mm-container,
    .ticket-preview,
    .thermal-cert {
      position: static !important;
      display: block !important;
      visibility: visible !important;
      margin: ${isA4 ? '0 auto' : '0'} !important;
      background: #ffffff !important;
      color: #000000 !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      width: ${targetWidth} !important;
      max-width: ${targetWidth} !important;
      padding: ${isA4 ? '0' : (is58mm ? '0 1mm' : '0 2.5mm')} !important;
      font-size: ${is58mm ? '9.5px' : '11.5px'} !important;
      line-height: ${is58mm ? '1.25' : '1.35'} !important;
      font-family: 'Courier New', Courier, monospace !important;
    }

    /* Tipografía y espaciado térmico ultra-nítido */
    .thermal-center { text-align: center !important; }
    .receipt-header { text-align: center !important; margin-bottom: 8px !important; }
    .receipt-header h2, .thermal-title {
      font-size: ${is58mm ? '13px' : '16px'} !important;
      font-weight: 900 !important;
      margin: 0 0 2px 0 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
    }
    .receipt-header p, .thermal-sub {
      font-size: ${is58mm ? '8.5px' : '10.5px'} !important;
      margin: 1.5px 0 !important;
      color: #000000 !important;
    }
    .receipt-divider-dash, .thermal-divider {
      border-top: 1px dashed #000000 !important;
      margin: ${is58mm ? '4px 0' : '6px 0'} !important;
    }
    .receipt-divider-double {
      border-top: 2px dashed #000000 !important;
      margin: ${is58mm ? '5px 0' : '8px 0'} !important;
    }
    .receipt-table, .thermal-table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: ${is58mm ? '8.5px' : '11px'} !important;
      margin: 4px 0 !important;
    }
    .receipt-table th, .thermal-table th {
      border-bottom: 1px dashed #000000 !important;
      padding: 2px 0 !important;
      font-weight: 800 !important;
      text-align: left !important;
    }
    .receipt-table td, .thermal-table td {
      padding: 2px 0 !important;
      vertical-align: top !important;
    }
    .receipt-meta-row, .thermal-row {
      display: flex !important;
      justify-content: space-between !important;
      font-size: ${is58mm ? '9px' : '11px'} !important;
      margin: 1.5px 0 !important;
    }
    .receipt-total-row, .thermal-row.total-highlight {
      display: flex !important;
      justify-content: space-between !important;
      font-size: ${is58mm ? '12px' : '14px'} !important;
      font-weight: 900 !important;
      margin: 4px 0 !important;
    }
    .receipt-qr-wrap, .cert-qr-wrap {
      text-align: center !important;
      margin: 8px 0 4px !important;
    }
    .receipt-qr-wrap img, .cert-qr-wrap img, img {
      max-width: ${is58mm ? '80px' : '105px'} !important;
      max-height: ${is58mm ? '80px' : '105px'} !important;
      display: inline-block !important;
      height: auto !important;
    }
    .receipt-footer-text {
      text-align: center !important;
      font-size: ${is58mm ? '8.5px' : '10.5px'} !important;
      margin-top: 8px !important;
    }

    /* Barcodes Grid */
    .barcode-print-grid {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) !important;
      gap: 12px !important;
      padding: 10px !important;
      width: 100% !important;
    }
    .barcode-tag-card {
      border: 1px solid #000 !important;
      border-radius: 6px !important;
      padding: 10px !important;
      text-align: center !important;
      font-family: monospace !important;
      page-break-inside: avoid !important;
    }

    /* Documentos A4 */
    .sri-ride-container, .quote-preview-container, .saas-receipt-container {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: none !important;
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`;

  iframeDoc.open();
  iframeDoc.write(isolatedHtml);
  iframeDoc.close();

  // 6. Esperar a que las imágenes (QR, logos) se hayan cargado antes de abrir el diálogo de impresión
  const iframeWin = printIframe.contentWindow;
  if (!iframeWin) {
    window.print();
    return;
  }

  const doPrint = () => {
    try {
      iframeWin.focus();
      iframeWin.print();
    } catch (err) {
      console.error('[TicketPrinter] Error en iframe.print(), fallback a window.print()', err);
      window.print();
    }
  };

  const imgs = Array.from(iframeDoc.images);
  const pendingImgs = imgs.filter(img => !img.complete && img.src);

  if (pendingImgs.length > 0) {
    let completedCount = 0;
    const onImgComplete = () => {
      completedCount++;
      if (completedCount >= pendingImgs.length) {
        setTimeout(doPrint, 60);
      }
    };
    pendingImgs.forEach(img => {
      img.addEventListener('load', onImgComplete, { once: true });
      img.addEventListener('error', onImgComplete, { once: true });
    });
    setTimeout(doPrint, 500); // Timeout de contingencia
  } else {
    setTimeout(doPrint, 80);
  }
}

/**
 * Escucha global para atajos de teclado (Ctrl + P) para asegurar que el formato configurado se respete.
 */
let listenerRegistered = false;
export function initGlobalPrintProtection() {
  if (listenerRegistered || typeof window === 'undefined') return;
  listenerRegistered = true;

  window.addEventListener('beforeprint', () => {
    const width = getStoredPaperWidth();
    document.documentElement.setAttribute('data-print-format', width);
    document.body.setAttribute('data-print-format', width);

    // Si hay un modal abierto con ticket imprimible, marcar sus ancestros
    const activeTicket = document.querySelector(
      '#printable-thermal, #printable-ticket, #printable-sale-receipt, #printable-work-receipt, #printable-z-report, #printable-warranty-cert, #printable-barcodes, #printable-ride, #printable-quote, #printable-saas-receipt, #printable-financial-report'
    ) as HTMLElement | null;

    if (activeTicket) {
      activeTicket.classList.add('printable-active');
      let parent = activeTicket.parentElement;
      while (parent && parent !== document.body) {
        parent.classList.add('print-ancestor');
        parent = parent.parentElement;
      }
    }
  });

  window.addEventListener('afterprint', () => {
    document.querySelectorAll('.print-ancestor').forEach(el => el.classList.remove('print-ancestor'));
    document.querySelectorAll('.printable-active').forEach(el => el.classList.remove('printable-active'));
  });
}

// Inicializar de inmediato al cargar el módulo
initGlobalPrintProtection();

/**
 * Selector interactivo de formato térmico: [ 🖨️ 80mm ] [ 📱 58mm ]
 */
export function TicketFormatSelector({
  value,
  onChange
}: {
  value: TicketPaperWidth;
  onChange: (w: TicketPaperWidth) => void;
}) {
  return (
    <div className="ticket-size-toggle no-print" role="group" aria-label="Tamaño de papel de ticket">
      <span className="ticket-size-label">Ancho Papel:</span>
      <button
        type="button"
        className={`ticket-size-btn ${value === '80mm' ? 'active' : ''}`}
        onClick={() => onChange('80mm')}
        title="Impresora Térmica Estándar (80mm / EPSON / Bixolon / POS-80)"
      >
        🖨️ 80mm
      </button>
      <button
        type="button"
        className={`ticket-size-btn ${value === '58mm' ? 'active' : ''}`}
        onClick={() => onChange('58mm')}
        title="Impresora Térmica Mini / Portátil / Bluetooth (58mm / POS-58 / Xprinter)"
      >
        📱 58mm
      </button>
    </div>
  );
}
