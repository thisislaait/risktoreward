'use client';
import { Monogram, TradeButton, cx } from './primitives';
import { money, num } from '@/lib/format';

export function BufferMeter({ label, left, limit, note }: { label: string; left: number; limit: number; note?: string }) {
  const remaining = Math.max(0, left);
  const frac = Math.min(1, remaining / (limit || 1));
  const tone = frac < 0.3 ? 'loss' : frac < 0.6 ? 'caution' : 'ok';
  return (
    <div className={cx('fd-bm', `fd-bm--${tone}`)}>
      <div className="fd-bm__top">
        <span className="fd-bm__label">{label}</span>
        <span className="fd-bm__used">{Math.round((1 - frac) * 100)}% used</span>
      </div>
      <div className="fd-bm__value">
        {money(remaining, 0)} left<span> of {money(limit, 0)}</span>
      </div>
      <div className="fd-bm__track" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={remaining} aria-label={`${label} remaining`}>
        <div className="fd-bm__fill" style={{ width: `${(frac * 100).toFixed(1)}%` }} />
      </div>
      {note && <div className="fd-bm__note">{note}</div>}
    </div>
  );
}

export function PositionRow({
  symbol, side, lots, entry, current, digits, pnl, stop, target, note, onClose, closing,
}: {
  symbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  entry: number;
  current: number | undefined;
  digits: number;
  pnl: number;
  stop?: number;
  target?: number | null;
  note?: string;
  onClose?: () => void;
  closing?: boolean;
}) {
  const long = side === 'BUY';
  return (
    <div className="fd-pos">
      <Monogram symbol={symbol} size="sm" />
      <div className="fd-pos__main">
        <div className="fd-pos__sym">
          {symbol}
          <span className={cx('fd-side', long ? 'fd-side--long' : 'fd-side--short')}>{long ? 'Long' : 'Short'}</span>
        </div>
        <div className="fd-pos__meta">
          {lots.toFixed(2)} lots · {num(entry, digits)} → {current != null ? num(current, digits) : '—'}
          {stop != null && ` · SL ${num(stop, digits)}`}
          {target != null && ` · TP ${num(target, digits)}`}
        </div>
        {note && <div className="fd-pos__note">{note}</div>}
      </div>
      <div className="fd-pos__right">
        <div className={cx('fd-pos__pnl', pnl > 0 ? 'fd-up' : pnl < 0 ? 'fd-down' : '')}>{money(pnl, 2, true)}</div>
        {onClose && (
          <TradeButton variant="secondary" size="sm" onClick={onClose} disabled={closing}>
            {closing ? 'Closing…' : 'Close'}
          </TradeButton>
        )}
      </div>
    </div>
  );
}
