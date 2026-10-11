'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Activity, ClipboardList, Wallet } from 'lucide-react';

const NAV = [
  { href: '/',         label: 'Overview',    Icon: Activity      },
  { href: '/check',    label: 'Check Trade', Icon: Shield        },
  { href: '/log',      label: 'Trade Log',   Icon: ClipboardList },
  { href: '/accounts', label: 'Accounts',    Icon: Wallet        },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside style={{
      width: '200px',
      flexShrink: 0,
      height: '100vh',
      background: '#0F1210',
      borderRight: '1px solid #1C1F1C',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Wordmark */}
      <div style={{ padding: '32px 20px 28px' }}>
        <p style={{
          fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.12em', color: 'var(--txt)',
          textTransform: 'uppercase',
        }}>
          Risk to Reward
        </p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 10px' }}>
        {NAV.map(({ href, label, Icon }) => {
          const active = path === href || (href !== '/' && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 10px',
                borderRadius: '6px',
                marginBottom: '2px',
                fontSize: '13px',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--txt)' : 'var(--txt3)',
                background: active ? '#1A1D1A' : 'transparent',
                textDecoration: 'none',
              }}
            >
              <Icon size={14} color={active ? 'var(--green)' : 'var(--txt3)'} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '20px', borderTop: '1px solid #1C1F1C' }}>
        <Link
          href="/setup"
          style={{
            fontSize: '11px', color: 'var(--txt3)',
            textDecoration: 'none', letterSpacing: '0.03em',
          }}
        >
          + Add Account
        </Link>
      </div>
    </aside>
  );
}
