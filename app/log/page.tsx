'use client';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { TrendingUp, TrendingDown } from 'lucide-react';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LogPage() {
  const { accounts, tradeLogs, selectedAccountId } = useStore();
  const account = accounts.find(a => a.id === selectedAccountId);
  const logs = tradeLogs.filter(l => !selectedAccountId || l.accountId === selectedAccountId);

  const totalPnl = logs.reduce((s, l) => s + l.pnl, 0);
  const wins     = logs.filter(l => l.pnl > 0).length;
  const losses   = logs.filter(l => l.pnl < 0).length;
  const winRate  = logs.length > 0 ? Math.round((wins / logs.length) * 100) : 0;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '56px 48px 64px' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '48px' }}>
        <div>
          <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '10px' }}>
            {account?.label ?? 'All accounts'}
          </p>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--txt)' }}>Trade Log</h1>
        </div>
        <Link href="/log/new" style={{
          padding: '10px 18px', borderRadius: '6px',
          background: 'var(--green)', color: '#fff',
          fontSize: '12px', fontWeight: 600, textDecoration: 'none',
          letterSpacing: '0.03em', marginTop: '4px',
        }}>
          + Log Trade
        </Link>
      </div>

      {/* Summary stats */}
      {logs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '48px' }}>
          {[
            {
              label: 'Total P&L',
              value: `${totalPnl >= 0 ? '+' : ''}$${fmt(totalPnl)}`,
              color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
            },
            { label: 'Win Rate', value: `${winRate}%`, color: 'var(--txt)', sub: `${wins}W · ${losses}L` },
            { label: 'Trades',   value: String(logs.length), color: 'var(--txt)' },
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{
              padding: '20px', borderRadius: '8px',
              background: 'var(--srf)', border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '10px' }}>
                {label}
              </p>
              <p style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'ui-monospace, "SF Mono", monospace', color }}>
                {value}
              </p>
              {sub && <p style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '4px' }}>{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ fontSize: '14px', color: 'var(--txt3)', lineHeight: 1.7, marginBottom: '24px' }}>
            No trades logged yet.
          </p>
          <Link href="/log/new" style={{
            fontSize: '13px', color: 'var(--green)', textDecoration: 'none', fontWeight: 500,
          }}>
            Log your first trade →
          </Link>
        </div>
      )}

      {/* Trade rows */}
      {logs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          {logs.map(log => (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', background: 'var(--srf)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: log.pnl >= 0 ? 'rgba(61,171,114,0.12)' : 'rgba(197,95,80,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {log.pnl >= 0
                    ? <TrendingUp size={14} color="var(--green)" />
                    : <TrendingDown size={14} color="var(--red)" />}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--txt)', marginBottom: '2px' }}>
                    {log.instrument}
                    <span style={{
                      marginLeft: '8px', fontSize: '10px', fontWeight: 700,
                      letterSpacing: '0.06em', color: log.direction === 'BUY' ? 'var(--green)' : 'var(--red)',
                    }}>
                      {log.direction}
                    </span>
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--txt3)' }}>
                    {log.lotSize} lot · {log.entryPrice} → {log.exitPrice}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{
                  fontSize: '16px', fontWeight: 700,
                  fontFamily: 'ui-monospace, "SF Mono", monospace',
                  color: log.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                  marginBottom: '2px',
                }}>
                  {log.pnl >= 0 ? '+' : ''}${fmt(log.pnl)}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                  {new Date(log.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(log.closedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
