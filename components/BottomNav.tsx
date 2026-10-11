'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    href: '/trade',
    label: 'Trade',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--green)' : 'var(--txt3)'} strokeWidth="1.8">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    href: '/positions',
    label: 'Positions',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--green)' : 'var(--txt3)'} strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    href: '/account',
    label: 'Account',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--green)' : 'var(--txt3)'} strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const path = usePathname();

  return (
    <nav style={{
      height: '60px',
      background: 'var(--card)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {TABS.map(({ href, label, icon }) => {
        const active = path === href || (path === '/' && href === '/trade');
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '3px', padding: '4px 32px',
              textDecoration: 'none',
            }}
          >
            {icon(active)}
            <span style={{
              fontSize: '10px', fontWeight: active ? 600 : 400,
              color: active ? 'var(--green)' : 'var(--txt3)',
              letterSpacing: '0.03em',
            }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
