'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Chip, Monogram, cx } from './primitives';
import { money, num, pct, signedNum } from '@/lib/format';

export function PriceHeader({
  symbol, name, price, digits, change, changePct, time, buffer,
}: {
  symbol: string;
  name: string;
  price: number | undefined;
  digits: number;
  change?: number;
  changePct?: number;
  time?: string;
  buffer?: { left: number; limit: number };
}) {
  // Flash the price on each tick.
  const prev = useRef(price);
  const [tick, setTick] = useState<'' | 'tick-up' | 'tick-down'>('');
  useEffect(() => {
    if (price == null || prev.current == null || price === prev.current) { prev.current = price; return; }
    setTick(price > prev.current ? 'tick-up' : 'tick-down');
    prev.current = price;
    const t = setTimeout(() => setTick(''), 400);
    return () => clearTimeout(t);
  }, [price]);

  const frac = buffer ? buffer.left / buffer.limit : 1;
  return (
    <header className="fd-ph">
      <div className="fd-ph__top">
        <div className="fd-ph__id">
          <Monogram symbol={symbol} />
          <div>
            <div className="fd-ph__sym">{symbol}</div>
            <div className="fd-ph__name">{name}</div>
          </div>
        </div>
        {buffer && (
          <Chip tone={frac < 0.3 ? 'loss' : frac < 0.6 ? 'caution' : 'neutral'}>
            Daily buffer <b>{money(Math.max(0, buffer.left), 0)}</b>
          </Chip>
        )}
      </div>
      <div className="fd-ph__row">
        <div>
          <div className={cx('fd-ph__price', tick)}>{price == null ? '—' : num(price, digits)}</div>
          {time && <div className="fd-ph__time">{time}</div>}
        </div>
        {change != null && (
          <div className="fd-ph__chg">
            <div className="fd-ph__chglabel">Today</div>
            <div className={cx('fd-ph__chgval', change > 0 ? 'fd-up' : change < 0 ? 'fd-down' : '')}>
              {signedNum(change, digits)}{changePct != null && ` (${pct(changePct)})`}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * Price chart with the trade drawn on it. Sizes itself to its container; give the container a height.
 */
export function RiskChart({
  data, digits, entry, stop, target, positions = [], className,
}: {
  data: number[];
  digits: number;
  entry?: number | null;
  stop?: number | null;
  target?: number | null;
  /** Entry prices of open positions on this instrument. */
  positions?: number[];
  className?: string;
}) {
  const uid = 'rc' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w: W, h: H } = size;
  const gutter = 92, padT = 16, padB = 16, plotW = Math.max(0, W - gutter);
  const vals = [...data];
  for (const v of [entry, stop, target]) if (v != null) vals.push(v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || hi * 0.001 || 1;
  lo -= span * 0.08; hi += span * 0.08;
  const y = (v: number) => padT + ((hi - v) / (hi - lo)) * (H - padT - padB);
  const x = (i: number) => (data.length < 2 ? 0 : (i / (data.length - 1)) * plotW);

  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = data[data.length - 1];
  const lastX = x(data.length - 1), lastY = last != null ? y(last) : 0;
  const area = `${line} L${lastX.toFixed(1)},${H - padB} L0,${H - padB} Z`;

  const band = (a: number | null | undefined, b: number | null | undefined, cls: string) => {
    if (a == null || b == null) return null;
    const y1 = Math.min(y(a), y(b)), y2 = Math.max(y(a), y(b));
    return <rect className={cls} x={0} y={y1} width={plotW} height={y2 - y1} />;
  };
  const level = (v: number | null | undefined, cls: string) =>
    v == null ? null : <line className={cls} x1={0} x2={plotW} y1={y(v)} y2={y(v)} />;
  const tag = (v: number | null | undefined, label: string, kind: string) => {
    if (v == null) return null;
    const ty = Math.max(10, Math.min(H - 10, y(v)));
    return (
      <g key={kind}>
        <rect className={`fd-rc__tagbg--${kind}`} x={W - gutter + 6} y={ty - 10} width={gutter - 6} height={20} rx={10} />
        <text className={`fd-rc__tagtext fd-rc__tagtext--${kind}`} x={W - (gutter - 6) / 2} y={ty + 3.5} textAnchor="middle">
          {label} {num(v, digits)}
        </text>
      </g>
    );
  };

  const grid = [0.2, 0.4, 0.6, 0.8].map(f => {
    const gy = padT + f * (H - padT - padB);
    const gv = hi - f * (hi - lo);
    return (
      <g key={f}>
        <line className="fd-rc__grid" x1={0} x2={plotW} y1={gy} y2={gy} />
        <text className="fd-rc__axis" x={4} y={gy - 4}>{num(gv, digits)}</text>
      </g>
    );
  });

  const summary = `Price chart. Last ${last != null ? num(last, digits) : '—'}` +
    (entry != null ? `, entry ${num(entry, digits)}` : '') +
    (stop != null ? `, stop ${num(stop, digits)}` : '') +
    (target != null ? `, target ${num(target, digits)}` : '') + '.';

  return (
    <div ref={box} className={cx('fd-rc', className)}>
      {W > 0 && H > 0 && data.length > 1 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
          <defs>
            <pattern id={`${uid}dots`} width={4} height={4} patternUnits="userSpaceOnUse">
              <circle className="fd-rc__dot" cx={1} cy={1} r={0.75} />
            </pattern>
          </defs>
          {band(entry, stop, 'fd-rc__risk')}
          {band(entry, target, 'fd-rc__reward')}
          <path d={area} fill={`url(#${uid}dots)`} />
          {grid}
          {positions.map((p, i) => <line key={i} className="fd-rc__pos" x1={0} x2={plotW} y1={y(p)} y2={y(p)} />)}
          {level(target, 'fd-rc__target')}
          {level(stop, 'fd-rc__stop')}
          {level(entry, 'fd-rc__entry')}
          <path className="fd-rc__line" d={line} />
          <circle className="fd-rc__lastring" cx={lastX} cy={lastY} r={6} />
          <circle className="fd-rc__last" cx={lastX} cy={lastY} r={3.5} />
          {entry == null && tag(last, '', 'now')}
          {tag(target, 'TP', 'target')}
          {tag(stop, 'SL', 'stop')}
          {tag(entry, 'IN', 'entry')}
        </svg>
      )}
    </div>
  );
}
