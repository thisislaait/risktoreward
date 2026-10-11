'use client';
import { ButtonHTMLAttributes, ReactNode, useEffect, useRef, useState, InputHTMLAttributes } from 'react';

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}
export { cx };

export function Monogram({ symbol, size }: { symbol: string; size?: 'sm' }) {
  return (
    <span className={cx('fd-mono', size === 'sm' && 'fd-mono--sm')} aria-hidden>
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  );
}

interface TradeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'buy' | 'sell' | 'primary' | 'secondary' | 'surface' | 'ghost' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  block?: boolean;
}

export function TradeButton({ variant = 'primary', size = 'lg', block, className, type = 'button', ...rest }: TradeButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cx('fd-btn', `fd-btn--${variant}`, `fd-btn--${size}`, block && 'fd-btn--block', className)}
    />
  );
}

type Option = string | { value: string; label: ReactNode };
const optValue = (o: Option) => (typeof o === 'object' ? o.value : o);
const optLabel = (o: Option) => (typeof o === 'object' ? o.label : o);

export function Segmented({
  options, value, onChange, variant = 'pill', label, className,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  variant?: 'track' | 'pill' | 'plain';
  label?: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cx('fd-seg', `fd-seg--${variant}`, className)}>
      {options.map(o => {
        const v = optValue(o);
        const on = v === value;
        return (
          <button key={v} type="button" role="tab" aria-selected={on}
            className={cx('fd-seg__item', on && 'is-on')} onClick={() => onChange(v)}>
            {optLabel(o)}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ tone = 'neutral', children }: { tone?: 'neutral' | 'caution' | 'loss'; children: ReactNode }) {
  return <span className={cx('fd-chip', tone !== 'neutral' && `fd-chip--${tone}`)}>{children}</span>;
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  suffix?: string;
  hint?: ReactNode;
}

export function Field({ label, suffix, hint, id, ...input }: FieldProps) {
  return (
    <label className="fd-field" htmlFor={id}>
      <span className="fd-field__label">{label}</span>
      <span className="fd-field__box">
        <input id={id} inputMode="decimal" autoComplete="off" {...input} />
        {suffix && <span className="fd-field__suffix">{suffix}</span>}
      </span>
      {hint && <span className="fd-field__hint">{hint}</span>}
    </label>
  );
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fd-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="fd-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="fd-dialog__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export interface Notice { text: string; error?: boolean; id: number }

let noticeSeq = 0;
/** Builds a toast message. Each call gets a new id, so the same text shows again. */
export function notice(text: string, error = false): Notice {
  return { text, error, id: ++noticeSeq };
}

/** A transient message. Shows each new `message` for 3.6 seconds. */
export function Toast({ message }: { message: Notice | null }) {
  return message ? <ToastItem key={message.id} message={message} /> : null;
}

function ToastItem({ message }: { message: Notice }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHidden(true), 3600);
    return () => clearTimeout(t);
  }, []);
  if (hidden) return null;
  return <div className={cx('fd-toast', message.error && 'fd-toast--error')} role="status">{message.text}</div>;
}
