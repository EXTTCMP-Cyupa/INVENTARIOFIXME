import React from 'react';
import QRCode from 'qrcode';

interface DeUnaModalProps {
  amount: number;
  branchId?: string;
  quoteId?: string;
  saleId?: string;
  customerName?: string;
  customerPhone?: string;
  isPublicQuote?: boolean;
  quoteToken?: string;
  onSuccess: (paymentResult: {
    transactionId: string;
    authorizationCode: string;
    amount: number;
    payerPhone?: string;
  }) => void;
  onClose: () => void;
  api?: (url: string, opts?: RequestInit) => Promise<Response>;
}

export function DeUnaModal({
  amount,
  branchId,
  quoteId,
  saleId,
  customerName,
  customerPhone,
  isPublicQuote,
  quoteToken,
  onSuccess,
  onClose,
  api
}: DeUnaModalProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [txData, setTxData] = React.useState<{
    transactionId: string;
    amount: number;
    currency: string;
    status: string;
    qrPayload: string;
    deeplinkUrl: string;
    merchantName: string;
    environment: string;
    expiresAt: string;
  } | null>(null);

  const [qrDataUrl, setQrDataUrl] = React.useState('');
  const [timeLeft, setTimeLeft] = React.useState(900); // 15 mins default
  const [status, setStatus] = React.useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'>('PENDING');
  const [authCode, setAuthCode] = React.useState('');
  const [payerPhone, setPayerPhone] = React.useState('');
  const [simulating, setSimulating] = React.useState(false);

  // 1. Request QR from Backend
  React.useEffect(() => {
    let active = true;

    async function generate() {
      setLoading(true);
      setError('');
      try {
        let res: Response;
        if (isPublicQuote && quoteToken) {
          res = await fetch(`/api/public/quotes/${encodeURIComponent(quoteToken)}/deuna/qr`, {
            method: 'POST'
          });
        } else if (api) {
          res = await api('/api/payments/deuna/qr', {
            method: 'POST',
            body: JSON.stringify({
              amount,
              branchId,
              quoteId,
              saleId,
              customerName,
              customerPhone
            })
          });
        } else {
          res = await fetch('/api/payments/deuna/qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount,
              branchId,
              quoteId,
              saleId,
              customerName,
              customerPhone
            })
          });
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || 'No se pudo generar el código QR de DeUna');
        }

        const data = await res.json();
        if (!active) return;

        setTxData(data);
        setStatus(data.status || 'PENDING');

        // Render QR Code to Data URL
        const url = await QRCode.toDataURL(data.qrPayload || data.deeplinkUrl, {
          width: 280,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        });

        if (active) {
          setQrDataUrl(url);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Error al comunicarse con DeUna');
          setLoading(false);
        }
      }
    }

    generate();
    return () => {
      active = false;
    };
  }, [amount, branchId, quoteId, saleId, customerName, customerPhone, isPublicQuote, quoteToken, api]);

  // 2. Countdown Timer
  React.useEffect(() => {
    if (status !== 'PENDING' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setStatus('EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, timeLeft]);

  // 3. Status Polling Loop (every 2.5 seconds)
  React.useEffect(() => {
    if (!txData?.transactionId || status !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const url = isPublicQuote
          ? `/api/public/payments/deuna/status/${encodeURIComponent(txData.transactionId)}`
          : `/api/payments/deuna/status/${encodeURIComponent(txData.transactionId)}`;

        const res = api && !isPublicQuote ? await api(url) : await fetch(url);
        if (res.ok) {
          const check = await res.json();
          if (check.status === 'APPROVED') {
            setStatus('APPROVED');
            setAuthCode(check.authorization_code || check.authorizationCode || 'AUTH-OK');
            setPayerPhone(check.payer_phone || check.payerPhone || '');

            setTimeout(() => {
              onSuccess({
                transactionId: txData.transactionId,
                authorizationCode: check.authorization_code || check.authorizationCode || 'AUTH-OK',
                amount: txData.amount,
                payerPhone: check.payer_phone || check.payerPhone
              });
            }, 1200);
          } else if (check.status === 'REJECTED' || check.status === 'EXPIRED') {
            setStatus(check.status);
          }
        }
      } catch (ignored) {}
    }, 2500);

    return () => clearInterval(interval);
  }, [txData, status, isPublicQuote, api, onSuccess]);

  // 4. Sandbox Test Simulation
  async function handleSimulate() {
    if (!txData?.transactionId || simulating) return;
    setSimulating(true);
    try {
      const url = isPublicQuote
        ? `/api/public/payments/deuna/simulate/${encodeURIComponent(txData.transactionId)}`
        : `/api/payments/deuna/simulate/${encodeURIComponent(txData.transactionId)}`;

      const res = api && !isPublicQuote
        ? await api(url, { method: 'POST', body: JSON.stringify({ payerPhone: '0987654321' }) })
        : await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payerPhone: '0987654321' })
          });

      if (res.ok) {
        const simResult = await res.json();
        setStatus('APPROVED');
        setAuthCode(simResult.authorization_code || simResult.authorizationCode || 'AUTH-SANDBOX-SUCCESS');
        setPayerPhone('0987654321');

        setTimeout(() => {
          onSuccess({
            transactionId: txData.transactionId,
            authorizationCode: simResult.authorization_code || simResult.authorizationCode || 'AUTH-SANDBOX-SUCCESS',
            amount: txData.amount,
            payerPhone: '0987654321'
          });
        }, 1200);
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'No se pudo simular el pago');
      }
    } catch (e: any) {
      alert('Error en simulación: ' + e.message);
    } finally {
      setSimulating(false);
    }
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '440px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* MODAL HEADER WITH DEUNA TEAL IDENTITY */}
        <div
          style={{
            background: 'linear-gradient(135deg, #00a896 0%, #028090 100%)',
            color: '#ffffff',
            padding: '20px 24px',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '26px' }}>📱</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                  Pago con DeUna QR
                </h3>
                <small style={{ opacity: 0.9, fontSize: '12px', fontWeight: 500 }}>
                  Banco Pichincha & Red Interbancaria
                </small>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 0,
                color: '#fff',
                fontSize: '16px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>
          </div>

          {txData?.environment === 'SANDBOX' && (
            <div
              style={{
                marginTop: '12px',
                background: 'rgba(254, 240, 138, 0.25)',
                border: '1px solid rgba(254, 240, 138, 0.6)',
                color: '#fef08a',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🧪</span> MODO PRUEBAS / SANDBOX ACTIVO
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ padding: '24px', textAlign: 'center' }}>
          {loading && (
            <div style={{ padding: '40px 0' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔄</div>
              <p style={{ color: '#475569', fontWeight: 600 }}>Generando QR dinámico de DeUna...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: '20px 0' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
              <p style={{ color: '#dc2626', fontWeight: 700, fontSize: '14px', marginBottom: '16px' }}>
                {error}
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cerrar
              </button>
            </div>
          )}

          {!loading && !error && txData && (
            <>
              {/* AMOUNT DISPLAY */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total a pagar
                </span>
                <div style={{ fontSize: '34px', fontWeight: 900, color: '#028090', letterSpacing: '-1px' }}>
                  ${Number(txData.amount).toFixed(2)} <span style={{ fontSize: '16px', fontWeight: 600 }}>USD</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Ref: <strong style={{ color: '#334155' }}>{txData.transactionId}</strong>
                </div>
              </div>

              {/* SUCCESS STATE */}
              {status === 'APPROVED' ? (
                <div
                  style={{
                    background: '#ecfdf5',
                    border: '2px solid #10b981',
                    borderRadius: '16px',
                    padding: '24px 16px',
                    margin: '16px 0'
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>✅</div>
                  <h4 style={{ color: '#065f46', margin: '0 0 6px', fontSize: '18px', fontWeight: 800 }}>
                    ¡Pago Confirmado con Éxito!
                  </h4>
                  <p style={{ color: '#047857', fontSize: '13px', margin: '0 0 10px' }}>
                    DeUna ha registrado el cobro satisfactoriamente.
                  </p>
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px dashed #6ee7b7',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#065f46',
                      fontWeight: 700,
                      display: 'inline-block'
                    }}
                  >
                    Código de Autorización: {authCode}
                  </div>
                </div>
              ) : status === 'EXPIRED' ? (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '2px solid #ef4444',
                    borderRadius: '16px',
                    padding: '24px 16px',
                    margin: '16px 0'
                  }}
                >
                  <div style={{ fontSize: '42px', marginBottom: '8px' }}>⏰</div>
                  <h4 style={{ color: '#991b1b', margin: '0 0 6px' }}>Código QR Expirado</h4>
                  <p style={{ color: '#b91c1c', fontSize: '13px', margin: 0 }}>
                    Por seguridad, el tiempo de pago ha finalizado. Genera un nuevo cobro.
                  </p>
                </div>
              ) : (
                <>
                  {/* QR CODE CONTAINER */}
                  <div
                    style={{
                      background: '#ffffff',
                      padding: '12px',
                      borderRadius: '16px',
                      border: '2px solid #e2e8f0',
                      display: 'inline-block',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      marginBottom: '12px'
                    }}
                  >
                    {qrDataUrl && (
                      <img
                        src={qrDataUrl}
                        alt="Código QR DeUna"
                        style={{ width: '240px', height: '240px', display: 'block' }}
                      />
                    )}
                  </div>

                  {/* STATUS & TIMER */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      color: '#028090',
                      fontWeight: 700,
                      marginBottom: '14px'
                    }}
                  >
                    <span style={{ display: 'inline-block', animation: 'spin 1.5s linear infinite' }}>🔄</span>
                    <span>Esperando escaneo del cliente...</span>
                    <span
                      style={{
                        background: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#475569',
                        marginLeft: '4px'
                      }}
                    >
                      ⏳ {formatTimer(timeLeft)}
                    </span>
                  </div>

                  {/* ACTION FOR SMARTPHONE USERS (DEEPLINK) */}
                  <div style={{ marginBottom: '14px' }}>
                    <a
                      href={txData.deeplinkUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: '#f0fdfa',
                        color: '#0f766e',
                        border: '1px solid #99f6e4',
                        fontSize: '13px',
                        fontWeight: 700,
                        textDecoration: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      📲 Pagar abriendo la App DeUna
                    </a>
                  </div>

                  {/* SANDBOX SIMULATE BUTTON */}
                  <button
                    type="button"
                    onClick={handleSimulate}
                    disabled={simulating}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      border: 0,
                      fontSize: '14px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 10px rgba(16, 185, 129, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>🧪</span>
                    {simulating ? 'Aprobando pago de prueba...' : 'Simular Pago Exitoso (Modo Sandbox)'}
                  </button>
                </>
              )}
            </>
          )}

          {/* FOOTER INSTRUCTIONS */}
          <div style={{ marginTop: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '11px', color: '#94a3b8' }}>
            Acepta pagos con Banco Pichincha, Cooperativas y cualquier banco de la red nacional interbancaria de Ecuador.
          </div>
        </div>
      </div>
    </div>
  );
}

