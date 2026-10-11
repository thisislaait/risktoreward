'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useStore } from '@/lib/store';
import { calcPnl } from '@/lib/rules/fundingpips';

const INSTRUMENTS = [
  'XAUUSD','EURUSD','GBPUSD','USDJPY','AUDUSD',
  'USDCAD','USDCHF','GBPJPY','EURJPY','NZDUSD',
  'US30','NAS100','SPX500',
];

const inputStyle: React.CSSProperties = {
  width: '100%', height: '44px',
  background: 'var(--srf2)',
  border: '1px solid var(--border2)',
  borderRadius: '6px',
  color: 'var(--txt)', padding: '0 12px',
  fontSize: '14px',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '10px', letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--txt3)',
      marginBottom: '8px',
    }}>{children}</p>
  );
}

function LogTradeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { accounts, selectedAccountId, logTrade } = useStore();
  const account = accounts.find(a => a.id === selectedAccountId);

  const [instrument, setInstrument] = useState(params.get('instrument') ?? 'XAUUSD');
  const [direction, setDirection]   = useState<'BUY' | 'SELL'>((params.get('direction') as 'BUY' | 'SELL') ?? 'BUY');
  const [lots, setLots]             = useState(params.get('lots') ?? '');
  const [entry, setEntry]           = useState(params.get('entry') ?? '');
  const [exit, setExit]             = useState('');
  const [openedAt, setOpenedAt]     = useState('');
  const [closedAt, setClosedAt]     = useState('');

  // Live P&L preview
  const previewPnl = (lots && entry && exit)
    ? calcPnl(instrument, direction, parseFloat(lots), parseFloat(entry), parseFloat(exit))
    : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    logTrade({
      accountId: account.id, instrument, direction,
      lotSize:    parseFloat(lots)  || 0,
      entryPrice: parseFloat(entry) || 0,
      exitPrice:  parseFloat(exit)  || 0,
      openedAt:   openedAt ? new Date(openedAt).getTime() : Date.now() - 3600000,
      closedAt:   closedAt ? new Date(closedAt).getTime() : Date.now(),
    });
    router.push('/log');
  }

  if (!account) return (
    <div style={{ padding: '56px 48px' }}>
      <p style={{ color: 'var(--txt2)', fontSize: '14px' }}>No account selected.</p>
    </div>
  );

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '56px 48px 64px' }}>

      <button
        onClick={() => router.back()}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '12px', color: 'var(--txt3)', padding: 0,
          marginBottom: '36px',
        }}
      >
        <ArrowLeft size={13} /> Back
      </button>

      <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--txt)', marginBottom: '8px' }}>
        Log a Trade
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--txt2)', marginBottom: '48px', lineHeight: 1.6 }}>
        Record a closed position. Your balance and daily P&L will update automatically.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Instrument + Direction */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <FieldLabel>Instrument</FieldLabel>
            <select value={instrument} onChange={e => setInstrument(e.target.value)} style={inputStyle}>
              {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Direction</FieldLabel>
            <div style={{ display: 'flex', gap: '8px', height: '44px' }}>
              {(['BUY', 'SELL'] as const).map(d => (
                <button key={d} type="button" onClick={() => setDirection(d)} style={{
                  flex: 1, borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  border: `1px solid ${direction === d ? (d === 'BUY' ? 'var(--green)' : 'var(--red)') : 'var(--border2)'}`,
                  background: direction === d ? (d === 'BUY' ? 'rgba(61,171,114,0.12)' : 'rgba(197,95,80,0.12)') : 'var(--srf2)',
                  color: direction === d ? (d === 'BUY' ? 'var(--green)' : 'var(--red)') : 'var(--txt3)',
                  cursor: 'pointer', letterSpacing: '0.05em',
                }}>{d}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Lot size */}
        <div style={{ maxWidth: '160px' }}>
          <FieldLabel>Lot Size</FieldLabel>
          <input style={inputStyle} type="number" step="0.01" placeholder="0.10"
            value={lots} onChange={e => setLots(e.target.value)} required />
        </div>

        {/* Prices */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <FieldLabel>Entry Price</FieldLabel>
            <input style={inputStyle} type="number" step="0.00001" placeholder="2620.00"
              value={entry} onChange={e => setEntry(e.target.value)} required />
          </div>
          <div>
            <FieldLabel>Exit Price</FieldLabel>
            <input style={inputStyle} type="number" step="0.00001" placeholder="2640.00"
              value={exit} onChange={e => setExit(e.target.value)} required />
          </div>
        </div>

        {/* P&L preview */}
        {previewPnl !== null && (
          <div style={{
            padding: '14px 16px', borderRadius: '6px',
            background: 'var(--srf2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{ fontSize: '12px', color: 'var(--txt3)' }}>Estimated P&L</p>
            <p style={{
              fontSize: '18px', fontWeight: 700,
              fontFamily: 'ui-monospace, "SF Mono", monospace',
              color: previewPnl >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {previewPnl >= 0 ? '+' : ''}${previewPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}

        {/* Times */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <FieldLabel>Opened At</FieldLabel>
            <input style={inputStyle} type="datetime-local"
              value={openedAt} onChange={e => setOpenedAt(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Closed At</FieldLabel>
            <input style={inputStyle} type="datetime-local"
              value={closedAt} onChange={e => setClosedAt(e.target.value)} />
          </div>
        </div>

        <button
          type="submit"
          disabled={!lots || !entry || !exit}
          style={{
            width: '100%', padding: '14px', borderRadius: '6px', border: 'none',
            background: 'var(--green)', color: '#fff',
            fontSize: '14px', fontWeight: 600, letterSpacing: '0.03em',
            cursor: lots && entry && exit ? 'pointer' : 'not-allowed',
            opacity: lots && entry && exit ? 1 : 0.35,
            marginTop: '8px',
          }}
        >
          Save Trade
        </button>
      </form>
    </div>
  );
}

export default function LogNewPage() {
  return (
    <Suspense>
      <LogTradeForm />
    </Suspense>
  );
}
