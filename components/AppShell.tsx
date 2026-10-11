'use client';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartCandlestick, LayoutList, UserRound } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useMarket } from '@/lib/market';
import { accountRisk } from '@/lib/rules/risk';
import { money } from '@/lib/format';
import { Chip, Toast, notice, cx, type Notice } from '@/components/fd';

const NAV = [
  { href: '/trade', label: 'Trade', Icon: ChartCandlestick },
  { href: '/positions', label: 'Positions', Icon: LayoutList },
  { href: '/account', label: 'Account', Icon: UserRound },
];

/**
 * The simulated platform has no server to enforce stops and targets, so the app does it:
 * when the closing price crosses a position's stop or target, the position closes at that level.
 * Real platforms enforce these themselves; this does nothing when the adapter is live.
 */
function useSimulatedStops(onClosed: (text: string) => void) {
  const { positions, closePosition, recordOrder } = useStore();
  const { broker, quotes } = useMarket();
  const closing = useRef(new Set<string>());

  useEffect(() => {
    if (broker.live) return;
    for (const p of positions) {
      const q = quotes[p.instrument];
      if (!q || closing.current.has(p.ticket)) continue;
      const px = p.direction === 'BUY' ? q.bid : q.ask;
      const long = p.direction === 'BUY';
      const hitStop = long ? px <= p.stopLoss : px >= p.stopLoss;
      const hitTarget = p.takeProfit != null && (long ? px >= p.takeProfit : px <= p.takeProfit);
      if (!hitStop && !hitTarget) continue;
      closing.current.add(p.ticket);
      const level = hitStop ? p.stopLoss : p.takeProfit!;
      const pnl = closePosition(p.ticket, level, Date.now());
      recordOrder({
        accountId: p.accountId, action: 'close', platform: broker.label, instrument: p.instrument, direction: p.direction,
        lotSize: p.lotSize, verdict: null, checks: null, result: 'filled', fillPrice: level,
        error: hitStop ? 'Stop loss hit' : 'Take profit hit',
      });
      onClosed(`${p.instrument} ${hitStop ? 'stopped out' : 'hit target'}: ${money(pnl, 2, true)}`);
    }
  }, [quotes, positions, broker.live, broker.label, closePosition, recordOrder, onClosed]);
}

function initials(email: string) {
  return email.split('@')[0].split(/[._-]/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join('') || '?';
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  // Sign-in screens stand alone, without the trading chrome.
  if (path === '/login' || path.startsWith('/login/')) return <div className="shell shell--bare">{children}</div>;
  return <TradingShell path={path}>{children}</TradingShell>;
}

function TradingShell({ path, children }: { path: string; children: ReactNode }) {
  const {
    accounts, positions, selectedAccountId, setSelectedAccountId, hydrated,
    mode, userEmail, syncError, clearSyncError, localImportCount, importLocal, dismissImport,
  } = useStore();
  const [importing, setImporting] = useState(false);
  const { broker, quotes } = useMarket();
  const account = accounts.find(a => a.id === selectedAccountId) ?? null;
  const risk = account ? accountRisk(account, positions, quotes) : null;
  const [toast, setToast] = useState<Notice | null>(null);
  const notify = useCallback((text: string) => setToast(notice(text)), []);

  useSimulatedStops(notify);

  const isActive = (href: string) => path === href || path.startsWith(href + '/') || (path === '/' && href === '/trade');

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/trade" className="topbar__brand">FundedDesk</Link>
        <nav className="topbar__nav" aria-label="Main">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={cx('topbar__link', isActive(href) && 'is-on')} aria-current={isActive(href) ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="topbar__right">
          {hydrated && account && risk && (
            <dl className="topbar__stats">
              <div><dt>Balance</dt><dd>{money(risk.balance)}</dd></div>
              <div><dt>Equity</dt><dd>{money(risk.equity)}</dd></div>
              <div className="topbar__stat--wide">
                <dt>Open P&amp;L</dt>
                <dd className={risk.floating > 0 ? 'fd-up' : risk.floating < 0 ? 'fd-down' : ''}>{money(risk.floating, 2, true)}</dd>
              </div>
            </dl>
          )}
          {hydrated && accounts.length > 0 && (
            <select
              className="topbar__account"
              aria-label="Trading account"
              value={selectedAccountId ?? ''}
              onChange={e => setSelectedAccountId(e.target.value)}
            >
              {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          )}
          <span title={broker.live ? `Connected to ${broker.label}` : 'Prices are simulated and orders do not reach a market'}>
            <Chip tone={broker.live ? 'neutral' : 'caution'}>
              <span className="fd-dot" />
              {broker.live ? broker.label : 'Simulated feed'}
            </Chip>
          </span>
          {mode === 'remote' && userEmail && (
            <Link href="/security" className={cx('topbar__user', isActive('/security') && 'is-on')} title={`${userEmail} · Security and sign out`} aria-label="Security and sign out">
              {initials(userEmail)}
            </Link>
          )}
        </div>
      </header>

      {syncError && (
        <div className="banner banner--error" role="alert">
          <span>{syncError} Changes on this screen may not be saved.</span>
          <button type="button" onClick={clearSyncError}>Dismiss</button>
        </div>
      )}
      {localImportCount > 0 && (
        <div className="banner" role="status">
          <span>This browser has {localImportCount === 1 ? '1 account' : `${localImportCount} accounts`} from before you signed in. Copy them into your FundedDesk account?</span>
          <button type="button" disabled={importing} onClick={async () => { setImporting(true); await importLocal(); setImporting(false); }}>
            {importing ? 'Copying…' : 'Copy accounts'}
          </button>
          <button type="button" onClick={dismissImport}>Not now</button>
        </div>
      )}
      {hydrated && mode === 'local' && (
        <div className="banner banner--quiet" role="status">
          <span>Local mode: sign-in isn’t set up, so your data stays in this browser only.</span>
        </div>
      )}

      <main className="shell__main">{children}</main>

      <nav className="bottomnav" aria-label="Main">
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={cx('bottomnav__link', isActive(href) && 'is-on')} aria-current={isActive(href) ? 'page' : undefined}>
            <Icon size={20} strokeWidth={1.75} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <Toast message={toast} />
    </div>
  );
}
