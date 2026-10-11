'use client';
import { useStore } from '@/lib/store';

export function Header() {
  const { accounts, selectedAccountId } = useStore();
  const account = accounts.find(a => a.id === selectedAccountId);

  return (
    <header style={{
      height: '52px',
      background: 'var(--card)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* Wordmark */}
      <p style={{
        fontSize: '14px', fontWeight: 700,
        letterSpacing: '-0.01em', color: 'var(--txt)',
      }}>
        FundedDesk
      </p>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {account && (
          <p style={{ fontSize: '12px', color: 'var(--txt3)' }}>
            {account.label}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: account ? 'var(--go-color)' : 'var(--txt3)',
          }} />
          <span style={{ fontSize: '12px', color: account ? 'var(--go-color)' : 'var(--txt3)', fontWeight: 500 }}>
            {account ? 'Manual mode' : 'No account'}
          </span>
        </div>
      </div>
    </header>
  );
}
