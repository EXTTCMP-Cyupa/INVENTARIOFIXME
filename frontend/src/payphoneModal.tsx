import React from 'react';

interface PayphoneModalProps {
  amount: number;
  tax?: number;
  branchId?: string;
  quoteId?: string;
  saleId?: string;
  customerEmail?: string;
  customerPhone?: string;
  isPublicQuote?: boolean;
  quoteToken?: string;
  onSuccess: (paymentResult: {
    clientTransactionId: string;
    transactionId: string;
    authorizationCode: string;
    cardBrand: string;
    cardLastDigits: string;
    amount: number;
  }) => void;
  onClose: () => void;
  api?: (url: string, opts?: RequestInit) => Promise<Response>;
}

export function PayphoneModal({
  amount,
  tax = 0,
  branchId,
  quoteId,
  saleId,
  customerEmail,
  customerPhone,
  isPublicQuote,
  quoteToken,
  onSuccess,
  onClose,
  api
}: PayphoneModalProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [txData, setTxData] = React.useState<{
    clientTransactionId: string;
    transactionId: string;
    amount: number;
    currency: string;
    status: string;
    paymentUrl: string;
    environment: string;
    expiresAt: string;
  } | null>(null);

  const [status, setStatus] = React.useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'>('PENDING');
  const [authCode, setAuthCode] = React.useState('');
  const [cardBrand, setCardBrand] = React.useState('VISA');
  const [cardDigits, setCardDigits] = React.useState('4242');
  const [simulating, setSimulating] = React.useState(false);

  // 1. Prepare payment order in Backend
  React.useEffect(() => {
    let active = true;

    async function prepare() {
      setLoading(true);
      setError('');
      try {
        let res: Response;
        if (isPublicQuote && quoteToken) {
          res = await fetch(`/api/public/quotes/${encodeURIComponent(quoteToken)}/payphone/prepare`, {
            method: 'POST'
          });
        } else if (api) {
          res = await api('/api/payments/payphone/prepare', {
            method: 'POST',
            body: JSON.stringify({
              amount,
              tax,
              branchId,
              quoteId,
              saleId,
              customerEmail,
              customerPhone
            })
          });
        } else {
          res = await fetch('/api/payments/payphone/prepare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount,
              tax,
              branchId,
              quoteId,
              saleId,
              customerEmail,
              customerPhone
            })
          });
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || 'No se pudo preparar la orden de pago con Payphone');
        }

        const data = await res.json();
        if (!active) return;

        setTxData(data);
        setStatus(data.status || 'PENDING');
        setLoading(false);
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Error al comunicarse con Payphone');
          setLoading(false);
        }
      }
    }

    prepare();
    return () => {
      active = false;
    };
  }, [amount, tax, branchId, quoteId, saleId, customerEmail, customerPhone, isPublicQuote, quoteToken, api]);

  // 2. Status Polling Loop (every 2.5 seconds)
  React.useEffect(() => {
    if (!txData?.clientTransactionId || status !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const url = isPublicQuote
          ? `/api/public/payments/payphone/status/${encodeURIComponent(txData.clientTransactionId)}`
          : `/api/payments/payphone/status/${encodeURIComponent(txData.clientTransactionId)}`;

        const res = api && !isPublicQuote ? await api(url) : await fetch(url);
        if (res.ok) {
          const check = await res.json();
          if (check.status === 'APPROVED') {
            setStatus('APPROVED');
            setAuthCode(check.authorization_code || check.authorizationCode || 'AUTH-OK');
            setCardBrand(check.card_brand || check.cardBrand || 'VISA');
            setCardDigits(check.card_last_digits || check.cardLastDigits || '4242');

            setTimeout(() => {
              onSuccess({
                clientTransactionId: txData.clientTransactionId,
                transactionId: check.transaction_id || txData.transactionId,
                authorizationCode: check.authorization_code || check.authorizationCode || 'AUTH-OK',
                cardBrand: check.card_brand || check.cardBrand || 'VISA',
                cardLastDigits: check.card_last_digits || check.cardLastDigits || '4242',
                amount: txData.amount
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

  // 3. Sandbox Test Simulation
  async function handleSimulate(brand: string) {
    if (!txData?.clientTransactionId || simulating) return;
    setSimulating(true);
    const digits = String(Math.floor(1000 + Math.random() * 9000));
    try {
      const url = isPublicQuote
        ? `/api/public/payments/payphone/simulate/${encodeURIComponent(txData.clientTransactionId)}`
        : `/api/payments/payphone/simulate/${encodeURIComponent(txData.clientTransactionId)}`;

      const res = api && !isPublicQuote
        ? await api(url, { method: 'POST', body: JSON.stringify({ cardBrand: brand, lastDigits: digits }) })
        : await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardBrand: brand, lastDigits: digits })
          });

      if (res.ok) {
        const simResult = await res.json();
        setStatus('APPROVED');
        setAuthCode(simResult.authorization_code || simResult.authorizationCode || 'AUTH-SANDBOX-SUCCESS');
        setCardBrand(brand);
        setCardDigits(digits);

        setTimeout(() => {
          onSuccess({
            clientTransactionId: txData.clientTransactionId,
            transactionId: simResult.transaction_id || txData.transactionId,
            authorizationCode: simResult.authorization_code || simResult.authorizationCode || 'AUTH-SANDBOX-SUCCESS',
            cardBrand: brand,
            cardLastDigits: digits,
            amount: txData.amount
          });
        }, 1200);
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'No se pudo simular el cobro');
      }
    } catch (e: any) {
      alert('Error en simulación: ' + e.message);
    } finally {
      setSimulating(false);
    }
  }

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
          maxWidth: '460px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* MODAL HEADER WITH PAYPHONE ORANGE IDENTITY */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ff5722 0%, #e64a19 100%)',
            color: '#ffffff',
            padding: '20px 24px',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '26px' }}>💳</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                  Cobro con Tarjeta · Payphone
                </h3>
                <small style={{ opacity: 0.9, fontSize: '12px', fontWeight: 500 }}>
                  Visa, Mastercard, Diners, Discover & Amex
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
              <span>🧪</span> MODO PRUEBAS / SANDBOX PAYPHONE
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ padding: '24px', textAlign: 'center' }}>
          {loading && (
            <div style={{ padding: '40px 0' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔄</div>
              <p style={{ color: '#475569', fontWeight: 600 }}>Generando orden de pago con tarjeta...</p>
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
                  Total a cobrar con tarjeta
                </span>
                <div style={{ fontSize: '34px', fontWeight: 900, color: '#e64a19', letterSpacing: '-1px' }}>
                  ${Number(txData.amount).toFixed(2)} <span style={{ fontSize: '16px', fontWeight: 600 }}>USD</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Ref: <strong style={{ color: '#334155' }}>{txData.clientTransactionId}</strong>
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
                    ¡Tarjeta Aprobada con Éxito!
                  </h4>
                  <p style={{ color: '#047857', fontSize: '13px', margin: '0 0 10px' }}>
                    Cobro procesado correctamente con <b>{cardBrand}</b> terminada en <b>•••• {cardDigits}</b>.
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
                  <h4 style={{ color: '#991b1b', margin: '0 0 6px' }}>Orden Expirada</h4>
                  <p style={{ color: '#b91c1c', fontSize: '13px', margin: 0 }}>
                    El tiempo para pagar con tarjeta ha finalizado. Genera un nuevo cobro.
                  </p>
                </div>
              ) : (
                <>
                  {/* CARD BRANDS BADGES */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {['💳 Visa', '💳 Mastercard', '💳 Diners', '💳 Discover'].map(b => (
                      <span
                        key={b}
                        style={{
                          background: '#fff7ed',
                          border: '1px solid #ffedd5',
                          color: '#c2410c',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  {/* STATUS WAITING */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      color: '#ea580c',
                      fontWeight: 700,
                      marginBottom: '16px'
                    }}
                  >
                    <span style={{ display: 'inline-block', animation: 'spin 1.5s linear infinite' }}>🔄</span>
                    <span>Esperando procesamiento de tarjeta...</span>
                  </div>

                  {/* PAYPHONE CHECKOUT LINK */}
                  <div style={{ marginBottom: '16px' }}>
                    <a
                      href={txData.paymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#fff7ed',
                        color: '#c2410c',
                        border: '1px solid #fdba74',
                        fontSize: '13px',
                        fontWeight: 700,
                        textDecoration: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      🔗 Abrir Pasarela Segura Payphone en Navegador
                    </a>
                  </div>

                  {/* SANDBOX SIMULATION BUTTONS */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                      🧪 Simular Aprobación Inmediata (Sandbox)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleSimulate('VISA')}
                        disabled={simulating}
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          background: '#2563eb',
                          color: '#fff',
                          border: 0,
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {simulating ? 'Procesando...' : '✓ Visa Débito'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulate('MASTERCARD')}
                        disabled={simulating}
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          background: '#ea580c',
                          color: '#fff',
                          border: 0,
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {simulating ? 'Procesando...' : '✓ Mastercard'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSimulate('DINERS')}
                      disabled={simulating}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '10px',
                        borderRadius: '8px',
                        background: '#047857',
                        color: '#fff',
                        border: 0,
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {simulating ? 'Procesando...' : '✓ Diners Club / Discover'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* FOOTER */}
          <div style={{ marginTop: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '11px', color: '#94a3b8' }}>
            Acepta tarjetas de crédito y débito nacionales e internacionales con liquidación bancaria en Ecuador.
          </div>
        </div>
      </div>
    </div>
  );
}

