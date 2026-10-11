// Number formatting rules from the FundedDesk design system:
// true minus sign, explicit + on gains, en-US grouping, instrument precision for prices.

const MINUS = '−';

export function num(n: number, digits: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function price(n: number, digits: number): string {
  return (n < 0 ? MINUS : '') + num(n, digits);
}

export function money(n: number, digits = 2, signed = false): string {
  const sign = n < 0 ? MINUS : signed && n > 0 ? '+' : '';
  return `${sign}$${num(n, digits)}`;
}

export function signedNum(n: number, digits: number): string {
  return (n < 0 ? MINUS : n > 0 ? '+' : '') + num(n, digits);
}

export function pct(n: number, digits = 2, signed = true): string {
  return (n < 0 ? MINUS : signed && n > 0 ? '+' : '') + num(n, digits) + '%';
}

export function toneOf(n: number): 'profit' | 'loss' | undefined {
  return n > 0 ? 'profit' : n < 0 ? 'loss' : undefined;
}
