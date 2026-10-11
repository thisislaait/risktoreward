'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useMarket } from '@/lib/market';
import { getInstrument } from '@/lib/instruments';
import { accountRisk, positionPnl, type AccountRisk } from '@/lib/rules/risk';
import { money, num } from '@/lib/format';
import { programmeLabel, maxLossTypeLabel } from '@/lib/rules/limits';
import type { Account, OpenPosition } from '@/types';
import {
  BufferMeter, Chip, Dialog, PositionRow, Segmented, StatRow, Toast, TradeButton, cx, notice, type Notice,
} from '@/components/fd';

const ALL = 'all';


function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function plural(n: number, one: string, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

function tone(n: number): 'profit' | 'loss' | undefined {
  return n > 0 ? 'profit' : n < 0 ? 'loss' : undefined;
}

/** Which positions a close-all is about to close, for the confirm dialog. */
type CloseScope = { title: string; positions: OpenPosition[] } | null;

export default function PositionsPage() {
  const { accounts, positions, tradeLogs, selectedAccountId, hydrated, closePosition, recordOrder } = useStore();
  const { broker, quotes } = useMarket();
  const [view, setView] = useState<string | null>(null);
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<CloseScope>(null);
  const [toast, setToast] = useState<Notice | null>(null);

  if (!hydrated) return null;
  if (accounts.length === 0) {
    return (
      <div className="empty">
        <h1>No account yet</h1>
        <p>Add the prop account you trade to see its positions and limits.</p>
        <Link href="/setup" className="fd-btn fd-btn--primary fd-btn--md" style={{ textDecoration: 'none' }}>Add account</Link>
      </div>
    );
  }

  // With more than one account, open on everything; otherwise on the one account.
  const current = view ?? (accounts.length > 1 ? ALL : selectedAccountId ?? accounts[0].id);
  const since = startOfToday();
  const byId = new Map(accounts.map(a => [a.id, a]));
  const risks = new Map<string, AccountRisk>(accounts.map(a => [a.id, accountRisk(a, positions, quotes)]));
  const openOf = (id: string) => positions.filter(p => p.accountId === id);
  const closedTodayOf = (ids: Set<string>) => tradeLogs.filter(l => ids.has(l.accountId) && l.closedAt >= since);

  /** Closes positions in parallel and books each fill. Reports partial failures by name. */
  async function closeMany(list: OpenPosition[]) {
    setScope(null);
    setClosing(prev => new Set([...prev, ...list.map(p => p.ticket)]));
    const results = await Promise.allSettled(list.map(p => broker.closePosition(p.ticket, p.instrument, p.direction, p.lotSize)));
    let total = 0;
    const failed: string[] = [];
    results.forEach((r, i) => {
      const p = list[i];
      const ok = r.status === 'fulfilled' && r.value.ok;
      recordOrder({
        accountId: p.accountId, action: 'close', platform: broker.label, instrument: p.instrument, direction: p.direction,
        lotSize: p.lotSize, verdict: null, checks: null,
        result: ok ? 'filled' : 'rejected',
        fillPrice: r.status === 'fulfilled' && r.value.ok ? r.value.value.price : null,
        error: ok ? null : r.status === 'rejected' ? String(r.reason) : r.value.ok ? null : r.value.error,
      });
      if (r.status === 'fulfilled' && r.value.ok) total += closePosition(p.ticket, r.value.value.price, r.value.value.time);
      else failed.push(`${p.instrument} on ${byId.get(p.accountId)?.label ?? 'unknown account'}`);
    });
    setClosing(prev => {
      const next = new Set(prev);
      list.forEach(p => next.delete(p.ticket));
      return next;
    });
    const done = list.length - failed.length;
    const accountsTouched = new Set(list.map(p => p.accountId)).size;
    setToast(failed.length
      ? notice(`Closed ${done} of ${list.length}. Not closed: ${failed.join(', ')}.`, true)
      : notice(`Closed ${plural(done, 'position')}${accountsTouched > 1 ? ` across ${accountsTouched} accounts` : ''}: ${money(total, 2, true)}.`));
  }

  const renderRow = (p: OpenPosition) => {
    const q = quotes[p.instrument];
    return (
      <PositionRow
        key={p.ticket}
        symbol={p.instrument}
        side={p.direction}
        lots={p.lotSize}
        entry={p.entryPrice}
        current={q ? (p.direction === 'BUY' ? q.bid : q.ask) : undefined}
        digits={getInstrument(p.instrument).digits}
        pnl={positionPnl(p, q)}
        stop={p.stopLoss}
        target={p.takeProfit}
        onClose={() => closeMany([p])}
        closing={closing.has(p.ticket)}
      />
    );
  };

  const renderClosed = (ids: Set<string>, showAccount: boolean) => {
    const closed = closedTodayOf(ids);
    const realised = closed.reduce((s, l) => s + l.pnl, 0);
    return (
      <section className="positions__list" aria-label="Closed today">
        <div className="section-head">
          <h2>Closed today</h2>
          <span>{closed.length === 0 ? 'None' : `${plural(closed.length, 'trade')} · ${money(realised, 2, true)}`}</span>
        </div>
        {closed.length === 0 ? (
          <p className="empty-inline">Trades you close today appear here.</p>
        ) : (
          <div>
            {closed.map(l => {
              const d = getInstrument(l.instrument).digits;
              return (
                <div key={l.id} className="closed-row">
                  <span className="closed-row__time">{new Date(l.closedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="closed-row__desc">
                    <b>{l.instrument}</b>
                    {l.direction === 'BUY' ? 'Long' : 'Short'} {l.lotSize.toFixed(2)} · {num(l.entryPrice, d)} → {num(l.exitPrice, d)}
                    {showAccount && ` · ${byId.get(l.accountId)?.label ?? ''}`}
                  </span>
                  <span className={cx('closed-row__pnl', l.pnl > 0 ? 'fd-up' : l.pnl < 0 ? 'fd-down' : '')}>{money(l.pnl, 2, true)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const switcher = accounts.length > 1 && (
    <Segmented
      variant="pill"
      label="Accounts"
      value={current}
      onChange={setView}
      options={[
        { value: ALL, label: `All accounts · ${positions.length}` },
        ...accounts.map(a => ({ value: a.id, label: `${a.label} · ${openOf(a.id).length}` })),
      ]}
    />
  );

  // ── All accounts ─────────────────────────────────────────────
  if (current === ALL) {
    const totalFloating = [...risks.values()].reduce((s, r) => s + r.floating, 0);
    const realisedToday = closedTodayOf(new Set(accounts.map(a => a.id))).reduce((s, l) => s + l.pnl, 0);
    const withOpen = accounts.filter(a => openOf(a.id).length > 0);
    const withoutOpen = accounts.filter(a => openOf(a.id).length === 0);

    const accountGroup = (a: Account) => {
      const r = risks.get(a.id)!;
      const open = openOf(a.id);
      const frac = r.dailyLeft / r.dailyLimit;
      return (
        <section key={a.id} className="acct-group" aria-label={a.label}>
          <div className="acct-group__head">
            <div>
              <div className="acct-group__name">{a.label}</div>
              <div className="acct-group__meta">{programmeLabel(a)} · {money(a.accountSize, 0)}</div>
            </div>
            <dl className="acct-group__stats">
              <div><dt>Equity</dt><dd>{money(r.equity)}</dd></div>
              <div><dt>Open P&amp;L</dt><dd className={cx(r.floating > 0 && 'fd-up', r.floating < 0 && 'fd-down')}>{money(r.floating, 2, true)}</dd></div>
              <div>
                <dt>Daily buffer</dt>
                <dd><Chip tone={frac < 0.3 ? 'loss' : frac < 0.6 ? 'caution' : 'neutral'}><b>{money(Math.max(0, r.dailyLeft), 0)}</b> left</Chip></dd>
              </div>
              {open.length > 1 && (
                <div className="acct-group__action">
                  <TradeButton variant="secondary" size="sm" onClick={() => setScope({ title: `Close ${plural(open.length, 'position')} on ${a.label}`, positions: open })}>
                    Close all here
                  </TradeButton>
                </div>
              )}
            </dl>
          </div>
          <div>{open.map(renderRow)}</div>
        </section>
      );
    };

    return (
      <div className="positions">
        {switcher}
        <section className="positions__top positions__top--all">
          <div className="positions__equity">
            <div>
              <div className="positions__label">Open P&amp;L · all accounts</div>
              <div className={cx('positions__hero', totalFloating > 0 && 'fd-up', totalFloating < 0 && 'fd-down')}>{money(totalFloating, 2, true)}</div>
            </div>
            <StatRow size="lg" items={[
              { label: 'Open positions', value: String(positions.length) },
              { label: 'Accounts with positions', value: `${withOpen.length} of ${accounts.length}` },
              { label: 'Realised today', value: money(realisedToday, 2, true), tone: tone(realisedToday) },
            ]} />
          </div>
          <div className="positions__closeall">
            <TradeButton
              variant="danger" size="lg"
              disabled={positions.length === 0}
              onClick={() => setScope({ title: `Close all ${plural(positions.length, 'position')}`, positions })}
            >
              Close all positions
            </TradeButton>
            <p>Closes every position on every account at market.</p>
          </div>
        </section>

        {withOpen.length === 0
          ? <p className="empty-inline">No open positions on any account. <Link href="/trade" style={{ color: 'var(--accent-ink)' }}>Place an order</Link> from the Trade screen.</p>
          : withOpen.map(accountGroup)}

        {withOpen.length > 0 && withoutOpen.length > 0 && (
          <p className="empty-inline">No open positions on {withoutOpen.map(a => a.label).join(', ')}.</p>
        )}

        {renderClosed(new Set(accounts.map(a => a.id)), true)}
        {closeDialog()}
        <Toast message={toast} />
      </div>
    );
  }

  // ── One account ──────────────────────────────────────────────
  const account = byId.get(current) ?? accounts[0];
  const risk = risks.get(account.id)!;
  const open = openOf(account.id);
  const realisedToday = closedTodayOf(new Set([account.id])).reduce((s, l) => s + l.pnl, 0);

  function closeDialog() {
    if (!scope) return <Dialog open={false} onClose={() => setScope(null)} title="">{null}</Dialog>;
    const groups = accounts
      .map(a => ({ a, list: scope.positions.filter(p => p.accountId === a.id) }))
      .filter(g => g.list.length > 0);
    const pnlOf = (list: OpenPosition[]) => list.reduce((s, p) => s + positionPnl(p, quotes[p.instrument]), 0);
    const total = pnlOf(scope.positions);
    return (
      <Dialog open onClose={() => setScope(null)} title={scope.title}>
        <dl className="fd-kv">
          {groups.map(({ a, list }) => (
            <div key={a.id}>
              <dt>{a.label} · {plural(list.length, 'position')}</dt>
              <dd className={cx(pnlOf(list) > 0 && 'fd-up', pnlOf(list) < 0 && 'fd-down')}>{money(pnlOf(list), 2, true)}</dd>
            </div>
          ))}
          {groups.length > 1 && (
            <div className="fd-kv__total">
              <dt>Total open P&amp;L now</dt>
              <dd className={cx(total > 0 && 'fd-up', total < 0 && 'fd-down')}>{money(total, 2, true)}</dd>
            </div>
          )}
        </dl>
        <p className="fd-dialog__note">Closes at market. The final P&amp;L depends on the prices you get.</p>
        <div className="fd-dialog__actions">
          <TradeButton variant="secondary" size="md" onClick={() => setScope(null)}>Cancel</TradeButton>
          <TradeButton variant="danger" size="md" data-autofocus onClick={() => closeMany(scope.positions)}>
            Close {plural(scope.positions.length, 'position')}
          </TradeButton>
        </div>
      </Dialog>
    );
  }

  return (
    <div className="positions">
      {switcher}
      <section className="positions__top">
        <div className="positions__equity">
          <div>
            <div className="positions__label">Equity · {account.label}</div>
            <div className="positions__hero">{money(risk.equity)}</div>
          </div>
          <StatRow size="lg" items={[
            { label: 'Balance', value: money(risk.balance) },
            { label: 'Open P&L', value: money(risk.floating, 2, true), tone: tone(risk.floating) },
            { label: 'Realised today', value: money(realisedToday, 2, true), tone: tone(realisedToday) },
          ]} />
        </div>
        <div className="positions__meters">
          <BufferMeter label="Daily loss buffer" left={risk.dailyLeft} limit={risk.dailyLimit} note="Counts open P&L. Resets at the start of each trading day." />
          <BufferMeter label="Max loss buffer" left={risk.drawdownLeft} limit={risk.drawdownLimit} note={`Breach level ${money(risk.floor)} (${maxLossTypeLabel(account)}).`} />
        </div>
      </section>

      <section className="positions__list" aria-label="Open positions">
        <div className="section-head">
          <h2>Open positions</h2>
          {open.length > 1
            ? <TradeButton variant="danger" size="sm" onClick={() => setScope({ title: `Close ${plural(open.length, 'position')} on ${account.label}`, positions: open })}>Close all</TradeButton>
            : <span>{open.length === 0 ? 'None' : '1 open'}</span>}
        </div>
        {open.length === 0
          ? <p className="empty-inline">No open positions. <Link href="/trade" style={{ color: 'var(--accent-ink)' }}>Place an order</Link> from the Trade screen.</p>
          : <div>{open.map(renderRow)}</div>}
      </section>

      {renderClosed(new Set([account.id]), false)}
      {closeDialog()}
      <Toast message={toast} />
    </div>
  );
}
