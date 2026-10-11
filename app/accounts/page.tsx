'use client';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AccountsPage() {
  const { accounts, deleteAccount, selectedAccountId, setSelectedAccountId } = useStore();

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '56px 48px 64px' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '48px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--txt)' }}>Accounts</h1>
        <Link href="/setup" style={{
          padding: '10px 18px', borderRadius: '6px',
          background: 'var(--green)', color: '#fff',
          fontSize: '12px', fontWeight: 600, textDecoration: 'none',
          letterSpacing: '0.03em', marginTop: '4px',
        }}>
          + Add Account
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ fontSize: '14px', color: 'var(--txt3)', lineHeight: 1.7, marginBottom: '24px' }}>
            No accounts yet.
          </p>
          <Link href="/setup" style={{ fontSize: '13px', color: 'var(--green)', textDecoration: 'none', fontWeight: 500 }}>
            Add your first account →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {accounts.map(a => {
            const trailingFloor   = a.highWaterMark - a.rules.trailingDrawdownAmount;
            const drawdownBuffer  = a.currentBalance - trailingFloor;
            const drawdownUsedPct = Math.round(((a.highWaterMark - a.currentBalance) / a.rules.trailingDrawdownAmount) * 100);
            const active          = a.id === selectedAccountId;

            return (
              <div
                key={a.id}
                onClick={() => setSelectedAccountId(a.id)}
                style={{
                  padding: '24px', borderRadius: '10px',
                  background: 'var(--srf)',
                  border: `1px solid ${active ? 'rgba(61,171,114,0.4)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {active && (
                  <div style={{
                    position: 'absolute', top: '16px', right: '16px',
                    fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'var(--green)', fontWeight: 700,
                  }}>Active</div>
                )}

                <p style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '6px' }}>
                  {a.rules.firmName} · {a.challengeType.replace(/-/g, ' ')} · ${a.accountSize.toLocaleString()}
                </p>
                <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--txt)', marginBottom: '20px' }}>
                  {a.label}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                  {[
                    { label: 'Balance', value: `$${fmt(a.currentBalance)}`, color: 'var(--txt)' },
                    { label: 'Daily P&L', value: `${a.dailyPnl >= 0 ? '+' : ''}$${fmt(a.dailyPnl)}`, color: a.dailyPnl >= 0 ? 'var(--green)' : 'var(--red)' },
                    { label: 'DD Buffer', value: `$${fmt(drawdownBuffer)}`, color: drawdownBuffer < a.rules.trailingDrawdownAmount * 0.2 ? 'var(--red)' : 'var(--txt)' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '4px' }}>{label}</p>
                      <p style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'ui-monospace, "SF Mono", monospace', color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Drawdown bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <p style={{ fontSize: '10px', color: 'var(--txt3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Trailing Drawdown</p>
                    <p style={{ fontSize: '10px', color: drawdownUsedPct > 75 ? 'var(--red)' : 'var(--txt3)', fontFamily: 'ui-monospace, "SF Mono", monospace' }}>
                      {drawdownUsedPct}% used
                    </p>
                  </div>
                  <div style={{ height: '3px', background: '#1C1F1C', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, drawdownUsedPct)}%`,
                      background: drawdownUsedPct > 75 ? 'var(--red)' : drawdownUsedPct > 50 ? 'var(--amber)' : 'var(--green)',
                      borderRadius: '2px',
                    }} />
                  </div>
                </div>

                <button
                  onClick={e => { e.stopPropagation(); deleteAccount(a.id); }}
                  style={{
                    position: 'absolute', bottom: '20px', right: '20px',
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', color: 'var(--txt3)', padding: '4px',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
