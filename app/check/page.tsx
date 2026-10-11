'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useStore } from '@/lib/store';
import { validateTrade } from '@/lib/rules/engine';
import { ValidationResult, TradeEntry } from '@/types';

const INSTRUMENTS = [
  'XAUUSD','EURUSD','GBPUSD','USDJPY','AUDUSD',
  'USDCAD','USDCHF','GBPJPY','EURJPY','NZDUSD',
  'US30','NAS100','SPX500',
];

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusIcon({ status }: { status: 'pass' | 'warn' | 'block' }) {
  if (status === 'pass')  return <CheckCircle  size={15} color="var(--green)" />;
  if (status === 'warn')  return <AlertTriangle size={15} color="var(--amber)" />;
  return <XCircle size={15} color="var(--red)" />;
}

type FormState = { instrument: string; direction: 'BUY' | 'SELL'; lotSize: string; entryPrice: string; stopLoss: string; takeProfit: string };

const defaultForm: FormState = { instrument: 'XAUUSD', direction: 'BUY', lotSize: '', entryPrice: '', stopLoss: '', takeProfit: '' };

export default function CheckPage() {
  const { accounts, tradeLogs, selectedAccountId, hydrated } = useStore();
  const account = accounts.find(a => a.id === selectedAccountId) ?? null;

  const [form, setForm] = useState<FormState>(defaultForm);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const set = (k: keyof FormState) => (v: string) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setResult(null);
  };

  function handleValidate() {
    if (!account) return;
    const trade: TradeEntry = {
      accountId: account.id,
      instrument: form.instrument,
      direction: form.direction,
      lotSize:    parseFloat(form.lotSize)    || 0,
      entryPrice: parseFloat(form.entryPrice) || 0,
      stopLoss:   parseFloat(form.stopLoss)   || 0,
      takeProfit: parseFloat(form.takeProfit) || 0,
    };
    setResult(validateTrade(trade, account, accounts, tradeLogs));
  }

  const canSubmit = form.lotSize && form.entryPrice && form.stopLoss && form.takeProfit;

  if (!hydrated) return null;

  if (!account) {
    return (
      <div style={{ padding: '56px 48px' }}>
        <p style={{ fontSize: '14px', color: 'var(--txt2)' }}>
          No account selected. <Link href="/setup" style={{ color: 'var(--green)' }}>Add one →</Link>
        </p>
      </div>
    );
  }

  /* ── Result screen ───────────────────────────────────── */
  if (result) {
    const overall = result.overall;
    const overallLabel = overall === 'pass' ? 'Clear to Enter' : overall === 'warn' ? 'Caution' : 'Blocked';
    const overallColor = overall === 'pass' ? 'var(--green)' : overall === 'warn' ? 'var(--amber)' : 'var(--red)';
    const overallBg    = overall === 'pass' ? 'rgba(61,171,114,0.07)' : overall === 'warn' ? 'rgba(212,146,15,0.07)' : 'rgba(197,95,80,0.07)';

    return (
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '56px 48px 64px' }}>

        {/* Back */}
        <button
          onClick={() => setResult(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', color: 'var(--txt3)', padding: '0',
            marginBottom: '36px', letterSpacing: '0.03em',
          }}
        >
          <ArrowLeft size={13} /> Back to form
        </button>

        {/* Verdict */}
        <div style={{
          padding: '28px 24px', borderRadius: '10px',
          background: overallBg, border: `1px solid ${overallColor}22`,
          marginBottom: '32px',
        }}>
          <p style={{
            fontSize: '11px', letterSpacing: '0.1em',
            textTransform: 'uppercase', color: overallColor,
            marginBottom: '10px', fontWeight: 600,
          }}>
            {form.instrument} · {form.direction} · {form.lotSize} lot{parseFloat(form.lotSize) !== 1 ? 's' : ''}
          </p>
          <h2 style={{
            fontSize: '32px', fontWeight: 700,
            color: overallColor, marginBottom: '14px', lineHeight: 1,
          }}>
            {overallLabel}
          </h2>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '3px' }}>Risk</p>
              <p style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'ui-monospace, "SF Mono", monospace', color: 'var(--txt)' }}>
                ${fmt(result.riskAmount)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '3px' }}>Reward</p>
              <p style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'ui-monospace, "SF Mono", monospace', color: 'var(--txt)' }}>
                ${fmt(result.rewardAmount)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '3px' }}>R:R</p>
              <p style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'ui-monospace, "SF Mono", monospace', color: 'var(--txt)' }}>
                {result.rr.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Rule checks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#1C1F1C', borderRadius: '8px', overflow: 'hidden' }}>
          {result.checks.map((check, i) => (
            <div key={check.rule} style={{
              padding: '16px 20px',
              background: 'var(--srf)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: check.detail ? '6px' : 0 }}>
                <StatusIcon status={check.status} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt)' }}>{check.rule}</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--txt2)', marginLeft: '25px', lineHeight: 1.5 }}>
                {check.message}
              </p>
              {check.detail && (
                <p style={{
                  fontSize: '11px', color: 'var(--txt3)',
                  marginLeft: '25px', marginTop: '3px',
                  fontFamily: 'ui-monospace, "SF Mono", monospace',
                }}>
                  {check.detail}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Log CTA if clear */}
        {overall !== 'block' && (
          <Link href={`/log/new?instrument=${form.instrument}&direction=${form.direction}&lots=${form.lotSize}&entry=${form.entryPrice}`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: '24px', padding: '13px',
            background: 'var(--srf2)', border: '1px solid var(--border2)',
            borderRadius: '6px', fontSize: '13px', color: 'var(--txt2)',
            textDecoration: 'none', fontWeight: 500,
          }}>
            Log this trade after it closes →
          </Link>
        )}
      </div>
    );
  }

  /* ── Form screen ─────────────────────────────────────── */
  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '56px 48px 64px' }}>

      <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '10px' }}>
        {account.label}
      </p>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--txt)', marginBottom: '8px' }}>
        Check a Trade
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--txt2)', marginBottom: '48px', lineHeight: 1.6 }}>
        Enter the trade details. We&apos;ll check it against every active rule before you enter.
      </p>

      {/* Instrument + Direction */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
        <div>
          <FieldLabel>Instrument</FieldLabel>
          <select
            value={form.instrument}
            onChange={e => set('instrument')(e.target.value)}
            style={selectStyle}
          >
            {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div>
          <FieldLabel>Direction</FieldLabel>
          <div style={{ display: 'flex', gap: '8px', height: '42px' }}>
            {(['BUY', 'SELL'] as const).map(d => (
              <button
                key={d}
                onClick={() => set('direction')(d)}
                style={{
                  flex: 1, borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  border: `1px solid ${form.direction === d
                    ? (d === 'BUY' ? 'var(--green)' : 'var(--red)')
                    : 'var(--border2)'}`,
                  background: form.direction === d
                    ? (d === 'BUY' ? 'rgba(61,171,114,0.12)' : 'rgba(197,95,80,0.12)')
                    : 'var(--srf2)',
                  color: form.direction === d
                    ? (d === 'BUY' ? 'var(--green)' : 'var(--red)')
                    : 'var(--txt3)',
                  cursor: 'pointer', letterSpacing: '0.05em',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prices row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div>
          <FieldLabel>Entry</FieldLabel>
          <input style={inputStyle} type="number" step="0.00001" placeholder="2620.00"
            value={form.entryPrice} onChange={e => set('entryPrice')(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Stop Loss</FieldLabel>
          <input style={inputStyle} type="number" step="0.00001" placeholder="2610.00"
            value={form.stopLoss} onChange={e => set('stopLoss')(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Take Profit</FieldLabel>
          <input style={inputStyle} type="number" step="0.00001" placeholder="2650.00"
            value={form.takeProfit} onChange={e => set('takeProfit')(e.target.value)} />
        </div>
      </div>

      {/* Lot size */}
      <div style={{ marginBottom: '48px', maxWidth: '160px' }}>
        <FieldLabel>Lot Size</FieldLabel>
        <input style={inputStyle} type="number" step="0.01" placeholder="0.10"
          value={form.lotSize} onChange={e => set('lotSize')(e.target.value)} />
      </div>

      {/* Submit */}
      <button
        onClick={handleValidate}
        disabled={!canSubmit}
        style={{
          width: '100%', padding: '14px', borderRadius: '6px', border: 'none',
          background: 'var(--green)', color: '#fff',
          fontSize: '14px', fontWeight: 600, letterSpacing: '0.03em',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: canSubmit ? 1 : 0.35,
        }}
      >
        Validate Trade
      </button>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '10px', letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--txt3)',
      marginBottom: '8px',
    }}>{children}</p>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: '42px',
  background: 'var(--srf2)',
  border: '1px solid var(--border2)',
  borderRadius: '6px',
  color: 'var(--txt)', padding: '0 12px',
  fontSize: '14px',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A504B' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: '32px',
};
