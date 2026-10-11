'use client';
import { ReactNode, useState } from 'react';
import { TradeButton, cx } from './primitives';
import { money } from '@/lib/format';
import type { RuleCheck } from '@/types';

export function RiskInput({
  amount, onChange, step = 25, max, lots, stopDistance, unit, atStop, presets,
}: {
  amount: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  lots: number | null;
  stopDistance: number | null;
  unit: string;
  atStop: number | null;
  presets: { label: string; value: number }[];
}) {
  // While the field has focus, show what was typed; otherwise show the amount.
  const [draft, setDraft] = useState<string | null>(null);

  const set = (v: number) => {
    let next = Math.max(0, Math.round(v * 100) / 100);
    if (max != null) next = Math.min(next, Math.floor(max * 100) / 100);
    onChange(next);
  };

  return (
    <div className="fd-ri">
      <label className="fd-ri__label" htmlFor="risk-amount">Risk if stopped out</label>
      <div className="fd-ri__row">
        <button type="button" className="fd-ri__step" aria-label={`Decrease risk by $${step}`} onClick={() => set(amount - step)}>−</button>
        <div className="fd-ri__amount">
          <span aria-hidden>$</span>
          <input
            id="risk-amount"
            inputMode="decimal"
            value={draft ?? String(amount)}
            onFocus={e => { setDraft(String(amount)); e.target.select(); }}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9.]/g, '');
              setDraft(raw);
              const n = parseFloat(raw);
              if (!Number.isNaN(n)) set(n);
            }}
            onBlur={() => setDraft(null)}
          />
        </div>
        <button type="button" className="fd-ri__step" aria-label={`Increase risk by $${step}`} onClick={() => set(amount + step)}>+</button>
      </div>
      <div className="fd-ri__calc">
        {lots != null && atStop != null && stopDistance != null ? (
          <><b>{lots.toFixed(2)} lots</b> · {stopDistance.toFixed(1)} {unit} stop · {money(atStop)} at stop</>
        ) : 'Set a stop to size the position'}
      </div>
      <div className="fd-ri__presets">
        {presets.map(p => (
          <button key={p.label} type="button"
            className={cx('fd-ri__preset', Math.abs(p.value - amount) < 0.005 && 'is-on')}
            onClick={() => set(p.value)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const STATE_WORD = { idle: 'Waiting', go: 'Go', review: 'Review', stop: 'Stop' } as const;
const STATUS_WORD = { pass: 'Clear', warn: 'Review', block: 'Breach' } as const;

export function Verdict({
  state, title, reason, checks, action, meta,
}: {
  state: 'idle' | 'go' | 'review' | 'stop';
  title: string;
  reason?: ReactNode;
  checks?: RuleCheck[];
  action?: { label: string; onClick: () => void } | null;
  meta?: string;
}) {
  return (
    <section className={cx('fd-verdict', `fd-verdict--${state}`)} role="status" aria-live="polite">
      <div className="fd-verdict__head">
        <span className="fd-verdict__state">{STATE_WORD[state]}</span>
        {meta && <span className="fd-verdict__meta">{meta}</span>}
      </div>
      <p className="fd-verdict__title">{title}</p>
      {reason && <p className="fd-verdict__reason">{reason}</p>}
      {checks && checks.length > 0 && (
        <ul className="fd-verdict__checks">
          {checks.map(c => (
            <li key={c.rule}>
              <span>{c.rule}</span>
              <span className={`fd-verdict__status fd-verdict__status--${c.status}`}>{STATUS_WORD[c.status]}</span>
            </li>
          ))}
        </ul>
      )}
      {action && (
        <TradeButton variant="surface" size="sm" className="fd-verdict__action" onClick={action.onClick}>
          {action.label}
        </TradeButton>
      )}
    </section>
  );
}

export function StatRow({ items, size }: { items: { label: string; value: ReactNode; tone?: 'profit' | 'loss' | 'caution' }[]; size?: 'lg' }) {
  return (
    <dl className={cx('fd-stats', size === 'lg' && 'fd-stats--lg')} style={{ ['--fd-cols' as string]: items.length }}>
      {items.map(it => (
        <div key={it.label} className="fd-stat">
          <dt className="fd-stat__label">{it.label}</dt>
          <dd className={cx('fd-stat__value', it.tone && `fd-${it.tone}`)}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
