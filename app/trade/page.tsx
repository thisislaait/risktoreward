'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useMarket } from '@/lib/market';
import { INSTRUMENTS, getInstrument } from '@/lib/instruments';
import type { Side, Timeframe } from '@/lib/broker/types';
import type { OpenPosition, RuleCheck, ValidationResult } from '@/types';
import { validateTrade } from '@/lib/rules/engine';
import {
  accountRisk, accountForRules, riskPerLot, lotsForRisk, maxSafeRisk, cleanRisk,
  verdictState, decidingCheck, positionPnl,
} from '@/lib/rules/risk';
import { money, num, pct } from '@/lib/format';
import { programmeLabel, dailyBasisLabel, maxLossTypeLabel } from '@/lib/rules/limits';
import {
  BufferMeter, Dialog, Field, PositionRow, PriceHeader, RiskChart, RiskInput,
  Segmented, StatRow, Toast, TradeButton, Verdict, cx, notice, type Notice,
} from '@/components/fd';

const TIMEFRAMES: Timeframe[] = ['15M', '1H', '4H', '1D', '1W'];
const SIZE_RULES = ['Daily Loss Limit', 'Position Size', 'Trailing Drawdown', 'Max Loss'];

function defaultStop(symbol: string) {
  const inst = getInstrument(symbol);
  return inst.unit === 'points' ? 30 : inst.symbol === 'XAUUSD' ? 50 : 20;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function sentence(s: string) {
  return /[.!?]$/.test(s) ? s : s + '.';
}

interface VerdictView {
  state: 'idle' | 'go' | 'review' | 'stop';
  title: string;
  reason?: string;
  checks?: RuleCheck[];
  action?: { label: string; onClick: () => void } | null;
}

export default function TradePage() {
  const { accounts, positions, tradeLogs, selectedAccountId, hydrated, openPosition, closePosition, recordOrder } = useStore();
  const { broker, quotes } = useMarket();
  const account = accounts.find(a => a.id === selectedAccountId) ?? null;

  const [symbol, setSymbol] = useState('EURUSD');
  const [side, setSide] = useState<Side>('BUY');
  const [tf, setTf] = useState<Timeframe>('4H');
  const [tab, setTab] = useState('Order');
  const [riskInput, setRiskInput] = useState<number | null>(null);
  const [stopPips, setStopPips] = useState(String(defaultStop('EURUSD')));
  const [targetPips, setTargetPips] = useState(String(defaultStop('EURUSD') * 1.5));
  const [confirming, setConfirming] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [closingTicket, setClosingTicket] = useState<string | null>(null);
  const [toast, setToast] = useState<Notice | null>(null);

  const inst = getInstrument(symbol);
  const quote = quotes[symbol];
  const risk = account ? accountRisk(account, positions, quotes) : null;

  function selectSymbol(s: string) {
    setSymbol(s);
    setStopPips(String(defaultStop(s)));
    setTargetPips(String(defaultStop(s) * 1.5));
  }

  // ── Order arithmetic: one place, everything below reads from it ──
  const defaultRisk = account && risk
    ? Math.max(5, Math.floor(Math.min(account.startingBalance * 0.005, cleanRisk(account, risk)) / 5) * 5)
    : 0;
  const riskAmount = riskInput ?? defaultRisk;
  const stopN = parseFloat(stopPips);
  const targetN = parseFloat(targetPips);
  const dir = side === 'BUY' ? 1 : -1;
  const round = (n: number) => Number(n.toFixed(inst.digits));
  const entry = quote ? (side === 'BUY' ? quote.ask : quote.bid) : null;
  const stopPrice = entry != null && stopN > 0 ? round(entry - dir * stopN * inst.pipSize) : null;
  const targetPrice = entry != null && targetN > 0 ? round(entry + dir * targetN * inst.pipSize) : null;
  const perLot = entry != null && stopPrice != null ? riskPerLot(symbol, entry, stopPrice) : null;
  const lots = perLot ? lotsForRisk(riskAmount, perLot) : null;
  const atStop = lots != null && perLot ? lots * perLot : null;
  const reward = lots != null && targetN > 0 ? lots * targetN * inst.pipValue : null;
  const rr = stopN > 0 && targetN > 0 ? targetN / stopN : null;

  // ── Rule check ──
  let result: ValidationResult | null = null;
  if (account && risk && entry != null && stopPrice != null && lots != null && lots >= 0.01) {
    result = validateTrade(
      { accountId: account.id, instrument: symbol, direction: side, lotSize: lots, entryPrice: entry, stopLoss: stopPrice, takeProfit: targetPrice ?? entry },
      accountForRules(account, risk), accounts, tradeLogs,
    );
    if (targetPrice == null) {
      const checks = result.checks.filter(c => c.rule !== 'Risk:Reward' && c.rule !== 'Payout Safety');
      const overall = checks.some(c => c.status === 'block') ? 'block' : checks.some(c => c.status === 'warn') ? 'warn' : 'pass';
      result = { ...result, checks, overall };
    }
  }

  let verdict: VerdictView;
  if (!account || !risk) verdict = { state: 'idle', title: 'Add an account to check orders.' };
  else if (entry == null) verdict = { state: 'idle', title: 'Waiting for a price.' };
  else if (!(stopN > 0)) verdict = { state: 'idle', title: 'Set a stop loss to size the position.' };
  else if (lots == null || lots < 0.01) verdict = {
    state: 'idle',
    title: `${money(riskAmount)} is below the smallest size.`,
    reason: perLot ? `0.01 lots risks ${money(perLot * 0.01)} at this stop.` : undefined,
  };
  else if (result) {
    const state = verdictState(result);
    const deciding = decidingCheck(result);
    let action: VerdictView['action'] = null;
    if (state !== 'go' && deciding && SIZE_RULES.includes(deciding.rule) && perLot) {
      const cleanLots = lotsForRisk(cleanRisk(account, risk), perLot);
      if (cleanLots >= 0.01 && cleanLots < lots) {
        const fixed = Math.round(cleanLots * perLot * 100) / 100;
        action = { label: `Use ${cleanLots.toFixed(2)} lots (${money(fixed)} at stop)`, onClick: () => setRiskInput(fixed) };
      }
    }
    verdict = state === 'go'
      ? {
          state, checks: result.checks, action,
          title: 'Clear to place.',
          reason: `${money(atStop ?? 0)} at stop uses ${Math.round(((atStop ?? 0) / Math.max(risk.dailyLeft, 0.01)) * 100)}% of your ${money(Math.max(0, risk.dailyLeft), 0)} daily buffer.`,
        }
      : { state, checks: result.checks, action, title: sentence(deciding!.message), reason: deciding!.detail };
  } else verdict = { state: 'idle', title: 'Waiting for a price.' };

  // Settle 300ms after the last edit so half-typed values don't flash a verdict.
  // Live price ticks update the verdict immediately; only typing is debounced.
  const inputKey = `${symbol}|${side}|${riskAmount}|${stopPips}|${targetPips}|${account?.id}`;
  const settled = useDebounced(inputKey, 300) === inputKey;
  const verdictKey = JSON.stringify([verdict.state, verdict.title, verdict.reason, verdict.checks, verdict.action?.label]);
  const [shown, setShown] = useState({ key: verdictKey, verdict });
  if (settled && shown.key !== verdictKey) setShown({ key: verdictKey, verdict });

  // ── Chart ──
  const quoteTime = quote?.time;
  const chartData = useMemo(
    () => broker.history(symbol, tf, 120),
    // Re-read on every tick so the last point is the live price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [broker, symbol, tf, quoteTime],
  );

  if (!hydrated) return null;

  if (!account || !risk) {
    return (
      <div className="empty">
        <h1>Add your prop account</h1>
        <p>FundedDesk checks every order against your firm’s rules before it’s placed. Start by adding the account you trade.</p>
        <Link href="/setup" className="fd-btn fd-btn--primary fd-btn--md" style={{ textDecoration: 'none' }}>Add account</Link>
      </div>
    );
  }

  const accountPositions = positions.filter(p => p.accountId === account.id);
  const symbolPositions = accountPositions.filter(p => p.instrument === symbol);
  const mid = quote ? (quote.bid + quote.ask) / 2 : undefined;
  const maxSafe = maxSafeRisk(risk);
  const presets = [
    { label: '0.25%', value: account.startingBalance * 0.0025 },
    { label: '0.5%', value: account.startingBalance * 0.005 },
    { label: '1%', value: account.startingBalance * 0.01 },
    { label: `Max safe ${money(maxSafe, 0)}`, value: Math.floor(maxSafe) },
  ].filter(p => p.value <= maxSafe + 0.005);

  const canPlace = lots != null && lots >= 0.01 && verdict.state !== 'stop' && verdict.state !== 'idle';
  const sideWord = side === 'BUY' ? 'Buy' : 'Sell';

  async function place() {
    if (!account || lots == null || stopPrice == null) return;
    setPlacing(true);
    const res = await broker.placeOrder({ accountId: account.id, symbol, side, lots, stopLoss: stopPrice, takeProfit: targetPrice });
    setPlacing(false);
    setConfirming(false);
    recordOrder({
      accountId: account.id, action: 'place', platform: broker.label, instrument: symbol, direction: side, lotSize: lots,
      verdict: verdict.state === 'idle' ? null : verdict.state, checks: verdict.checks ?? null,
      result: res.ok ? 'filled' : 'rejected', fillPrice: res.ok ? res.value.price : null, error: res.ok ? null : res.error,
    });
    if (!res.ok) {
      setToast(notice(res.error, true));
      return;
    }
    openPosition({
      ticket: res.value.ticket, accountId: account.id, instrument: symbol, direction: side, lotSize: lots,
      entryPrice: res.value.price, stopLoss: stopPrice, takeProfit: targetPrice, openedAt: res.value.time,
    });
    setToast(notice(`${side === 'BUY' ? 'Bought' : 'Sold'} ${lots.toFixed(2)} ${symbol} at ${num(res.value.price, inst.digits)}.`));
  }

  async function close(p: OpenPosition) {
    setClosingTicket(p.ticket);
    const res = await broker.closePosition(p.ticket, p.instrument, p.direction, p.lotSize);
    setClosingTicket(null);
    recordOrder({
      accountId: p.accountId, action: 'close', platform: broker.label, instrument: p.instrument, direction: p.direction,
      lotSize: p.lotSize, verdict: null, checks: null,
      result: res.ok ? 'filled' : 'rejected', fillPrice: res.ok ? res.value.price : null, error: res.ok ? null : res.error,
    });
    if (!res.ok) {
      setToast(notice(res.error, true));
      return;
    }
    const pnl = closePosition(p.ticket, res.value.price, res.value.time);
    setToast(notice(`Closed ${p.instrument}: ${money(pnl, 2, true)}.`));
  }

  const renderPosition = (p: OpenPosition) => {
    const pi = getInstrument(p.instrument);
    const q = quotes[p.instrument];
    return (
      <PositionRow
        key={p.ticket}
        symbol={p.instrument}
        side={p.direction}
        lots={p.lotSize}
        entry={p.entryPrice}
        current={q ? (p.direction === 'BUY' ? q.bid : q.ask) : undefined}
        digits={pi.digits}
        pnl={positionPnl(p, q)}
        stop={p.stopLoss}
        target={p.takeProfit}
        onClose={() => close(p)}
        closing={closingTicket === p.ticket}
      />
    );
  };

  return (
    <div className="trade">
      {/* ── Watchlist ── */}
      <aside className="watch" aria-label="Markets">
        <div className="watch__head"><span>Markets</span><span>Bid</span></div>
        <ul className="watch__list">
          {INSTRUMENTS.map(i => {
            const q = quotes[i.symbol];
            const m = q ? (q.bid + q.ask) / 2 : null;
            const chg = q && m != null ? ((m - q.open) / q.open) * 100 : 0;
            const held = accountPositions.some(p => p.instrument === i.symbol);
            return (
              <li key={i.symbol}>
                <button type="button" className={cx('watch__row', i.symbol === symbol && 'is-on')} onClick={() => selectSymbol(i.symbol)} aria-pressed={i.symbol === symbol}>
                  <span className="watch__sym">{i.symbol}{held && <span className="watch__flag" title="Open position" />}</span>
                  <span className="watch__px">{q ? num(q.bid, i.digits) : '—'}</span>
                  <span className="watch__name">{i.name}</span>
                  <span className={cx('watch__chg', chg > 0 ? 'fd-up' : chg < 0 ? 'fd-down' : 'fd-muted')}>{pct(chg)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Chart ── */}
      <section className="center" aria-label={`${symbol} chart`}>
        <div className="watch-strip">
          <Segmented variant="pill" label="Instrument" value={symbol} onChange={selectSymbol} options={INSTRUMENTS.map(i => i.symbol)} />
        </div>
        <PriceHeader
          symbol={symbol}
          name={inst.name}
          price={mid != null ? round(mid) : undefined}
          digits={inst.digits}
          change={quote && mid != null ? round(mid - quote.open) : undefined}
          changePct={quote && mid != null ? ((mid - quote.open) / quote.open) * 100 : undefined}
          time={quote ? `${broker.live ? 'Live' : 'Simulated'} · ${new Date(quote.time).toLocaleTimeString('en-GB')}` : undefined}
          buffer={{ left: risk.dailyLeft, limit: risk.dailyLimit }}
        />
        <div className="center__chart">
          <RiskChart
            data={chartData}
            digits={inst.digits}
            entry={tab === 'Order' ? entry : null}
            stop={tab === 'Order' ? stopPrice : null}
            target={tab === 'Order' ? targetPrice : null}
            positions={symbolPositions.map(p => p.entryPrice)}
          />
          <Segmented variant="plain" label="Timeframe" value={tf} onChange={v => setTf(v as Timeframe)} options={TIMEFRAMES} />
        </div>
        <div className="center__positions">
          <div className="section-head">
            <h2>Open positions</h2>
            <span>{accountPositions.length === 0 ? 'None' : `${accountPositions.length} open · ${money(risk.floating, 2, true)}`}</span>
          </div>
          {accountPositions.length === 0
            ? <p className="empty-inline">Orders you place appear here.</p>
            : accountPositions.map(renderPosition)}
        </div>
      </section>

      {/* ── Ticket ── */}
      <section className="ticket" aria-label="Order ticket">
        <div className="ticket__body">
          <Segmented
            variant="track" label="Ticket view" value={tab} onChange={setTab}
            options={['Order', { value: 'Position', label: symbolPositions.length ? `Position · ${symbolPositions.length}` : 'Position' }, 'Rules']}
          />

          {tab === 'Order' && (
            <>
              <div className="fd-sides" role="radiogroup" aria-label="Side">
                <button type="button" role="radio" aria-checked={side === 'SELL'} className={cx('fd-sidetile', 'fd-sidetile--sell', side === 'SELL' && 'is-on')} onClick={() => setSide('SELL')}>
                  <span className="fd-sidetile__label">Sell</span>
                  <span className="fd-sidetile__price">{quote ? num(quote.bid, inst.digits) : '—'}</span>
                </button>
                <button type="button" role="radio" aria-checked={side === 'BUY'} className={cx('fd-sidetile', 'fd-sidetile--buy', side === 'BUY' && 'is-on')} onClick={() => setSide('BUY')}>
                  <span className="fd-sidetile__label">Buy</span>
                  <span className="fd-sidetile__price">{quote ? num(quote.ask, inst.digits) : '—'}</span>
                </button>
              </div>

              <RiskInput
                amount={riskAmount}
                onChange={setRiskInput}
                step={account.startingBalance >= 50000 ? 25 : 10}
                max={Math.max(0, risk.dailyLeft)}
                lots={lots}
                stopDistance={stopN > 0 ? stopN : null}
                unit={inst.unit}
                atStop={atStop}
                presets={presets}
              />

              <div className="ticket__levels">
                <Field
                  id="stop-pips" label="Stop loss" suffix={inst.unit}
                  value={stopPips} onChange={e => setStopPips(e.target.value.replace(/[^0-9.]/g, ''))}
                  hint={stopPrice != null ? num(stopPrice, inst.digits) : '—'}
                />
                <Field
                  id="target-pips" label="Take profit" suffix={inst.unit} placeholder="None"
                  value={targetPips} onChange={e => setTargetPips(e.target.value.replace(/[^0-9.]/g, ''))}
                  hint={targetPrice != null ? num(targetPrice, inst.digits) : 'No target'}
                />
              </div>

              <StatRow items={[
                { label: 'Position size', value: lots != null ? `${lots.toFixed(2)} lots` : '—' },
                { label: 'Reward at target', value: reward != null ? money(reward, 2, true) : '—', tone: reward ? 'profit' : undefined },
                { label: 'Risk : reward', value: rr != null ? `1 : ${rr.toFixed(2)}` : '—' },
              ]} />

              <Verdict
                state={shown.verdict.state}
                title={shown.verdict.title}
                reason={shown.verdict.reason}
                checks={shown.verdict.checks}
                action={shown.verdict.action}
                meta={`${account.rules.firmName} rules`}
              />
            </>
          )}

          {tab === 'Position' && (
            <div className="ticket__group">
              {symbolPositions.length === 0
                ? <p className="empty-inline">No open {symbol} positions on this account.</p>
                : <div>{symbolPositions.map(renderPosition)}</div>}
            </div>
          )}

          {tab === 'Rules' && (
            <>
              <div className="ticket__group">
                <BufferMeter label="Daily loss buffer" left={risk.dailyLeft} limit={risk.dailyLimit} note={`Counts open P&L. ${account.rules.dailyLossAction === 'pause' ? 'Hitting it pauses trading for the day.' : 'Resets at the start of each trading day.'}`} />
                <BufferMeter label="Max loss buffer" left={risk.drawdownLeft} limit={risk.drawdownLimit} note={`Breach level ${money(risk.floor)} (${maxLossTypeLabel(account)}).`} />
              </div>
              <div className="ticket__group">
                <h3>{programmeLabel(account)}</h3>
                <dl className="fd-kv">
                  <div><dt>Daily loss limit</dt><dd>{account.rules.maxDailyLossPercent}% {dailyBasisLabel(account)} · {money(risk.dailyLimit, 0)}</dd></div>
                  <div><dt>Max loss</dt><dd>{account.rules.trailingDrawdownPercent}% {maxLossTypeLabel(account)} · {money(risk.drawdownLimit, 0)}</dd></div>
                  <div><dt>Profit target</dt><dd>{account.rules.profitTarget ? money(account.rules.profitTarget, 0) : 'None'}</dd></div>
                  <div><dt>Minimum trading days</dt><dd>{account.rules.minTradingDays ?? 'None'}</dd></div>
                  {account.rules.reEntryMinutes > 0 && <div><dt>Re-entry wait, same instrument</dt><dd>{account.rules.reEntryMinutes} min</dd></div>}
                  <div><dt>FundedDesk per-trade cap</dt><dd>{account.rules.maxPositionRiskPercent}% of daily limit</dd></div>
                  <div><dt>News</dt><dd>{account.rules.newsBlackoutMinutes ? `Restricted ${account.rules.newsBlackoutMinutes} min either side` : 'No restriction'}</dd></div>
                  {account.rules.bestDayPercent ? <div><dt>Best day</dt><dd>Under {account.rules.bestDayPercent}% of profit</dd></div> : null}
                </dl>
                {account.rules.source ? (
                  <p className="ticket__source">
                    {account.rules.source.status === 'partial' ? 'Some figures need confirming. ' : 'Checked against the firm’s published rules. '}
                    {account.rules.source.note ? account.rules.source.note + ' ' : ''}
                    <a href={account.rules.source.url} target="_blank" rel="noreferrer">Firm’s rules</a>
                  </p>
                ) : (
                  <p className="ticket__source">This account was added before firm presets existed and uses FundedDesk’s original Funding Pips figures. Add it again to use current rules.</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="ticket__foot">
          <TradeButton
            variant={side === 'BUY' ? 'buy' : 'sell'}
            block
            disabled={!canPlace || placing}
            onClick={() => setConfirming(true)}
          >
            {lots != null && lots >= 0.01 ? `${sideWord} ${lots.toFixed(2)} ${symbol}` : `${sideWord} ${symbol}`}
          </TradeButton>
          <p className="ticket__footnote">
            {broker.live ? `Sends a market order to ${broker.label}.` : 'Simulated. No real order is sent.'}
          </p>
        </div>
      </section>

      <Dialog open={confirming} onClose={() => !placing && setConfirming(false)} title={`${sideWord} ${lots?.toFixed(2) ?? ''} ${symbol}`}>
        <dl className="fd-kv">
          <div><dt>Account</dt><dd>{account.label}</dd></div>
          <div><dt>Platform</dt><dd>{broker.live ? broker.label : 'Simulated'}</dd></div>
          <div><dt>Entry</dt><dd>Market · {entry != null ? num(entry, inst.digits) : '—'}</dd></div>
          <div><dt>Stop loss</dt><dd>{stopPrice != null ? num(stopPrice, inst.digits) : '—'} · <span className="fd-loss">{money(-(atStop ?? 0))}</span></dd></div>
          <div><dt>Take profit</dt><dd>{targetPrice != null ? <>{num(targetPrice, inst.digits)} · <span className="fd-profit">{money(reward ?? 0, 2, true)}</span></> : 'None'}</dd></div>
        </dl>
        <Verdict state={verdict.state} title={verdict.title} reason={verdict.reason} />
        <div className="fd-dialog__actions">
          <TradeButton variant="secondary" size="md" onClick={() => setConfirming(false)} disabled={placing}>Cancel</TradeButton>
          <TradeButton variant={side === 'BUY' ? 'buy' : 'sell'} size="md" data-autofocus onClick={place} disabled={!canPlace || placing}>
            {placing ? 'Placing…' : 'Place order'}
          </TradeButton>
        </div>
      </Dialog>

      <Toast message={toast} />
    </div>
  );
}
