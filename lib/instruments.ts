// Contract specs for the instruments FundedDesk trades.
// pipSize: the price move that counts as one pip (FX) or one point (indices, gold uses $0.10).
// pipValue: account currency per pip per 1.00 lot (approximate USD).

export interface Instrument {
  symbol: string;
  name: string;
  digits: number;
  pipSize: number;
  pipValue: number;
  unit: 'pips' | 'points';
  spread: number;      // typical spread, in price
  startPrice: number;  // seed for the simulated feed
}

export const INSTRUMENTS: Instrument[] = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar',          digits: 5, pipSize: 0.0001, pipValue: 10,  unit: 'pips',   spread: 0.00008, startPrice: 1.08720 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', digits: 5, pipSize: 0.0001, pipValue: 10,  unit: 'pips',   spread: 0.00012, startPrice: 1.30610 },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen',  digits: 3, pipSize: 0.01,   pipValue: 9.1, unit: 'pips',   spread: 0.012,   startPrice: 149.820 },
  { symbol: 'XAUUSD', name: 'Gold / US Dollar',          digits: 2, pipSize: 0.1,    pipValue: 10,  unit: 'pips',   spread: 0.25,    startPrice: 2658.40 },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', digits: 5, pipSize: 0.0001, pipValue: 10, unit: 'pips', spread: 0.0001,  startPrice: 0.66420 },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', digits: 5, pipSize: 0.0001, pipValue: 7.3, unit: 'pips',  spread: 0.00014, startPrice: 1.37150 },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc',   digits: 5, pipSize: 0.0001, pipValue: 11.6, unit: 'pips',  spread: 0.00013, startPrice: 0.86240 },
  { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', digits: 3, pipSize: 0.01, pipValue: 6.7, unit: 'pips',  spread: 0.025,   startPrice: 195.620 },
  { symbol: 'EURJPY', name: 'Euro / Japanese Yen',       digits: 3, pipSize: 0.01,   pipValue: 6.7, unit: 'pips',   spread: 0.018,   startPrice: 162.880 },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', digits: 5, pipSize: 0.0001, pipValue: 10, unit: 'pips', spread: 0.00014, startPrice: 0.60150 },
  { symbol: 'US30',   name: 'Dow Jones 30',              digits: 1, pipSize: 1,      pipValue: 1,   unit: 'points', spread: 2.0,     startPrice: 42350.0 },
  { symbol: 'NAS100', name: 'Nasdaq 100',                digits: 1, pipSize: 1,      pipValue: 1,   unit: 'points', spread: 1.2,     startPrice: 18563.2 },
  { symbol: 'SPX500', name: 'S&P 500',                   digits: 1, pipSize: 1,      pipValue: 10,  unit: 'points', spread: 0.5,     startPrice: 5815.4 },
];

const BY_SYMBOL: Record<string, Instrument> = Object.fromEntries(INSTRUMENTS.map(i => [i.symbol, i]));

export function getInstrument(symbol: string): Instrument {
  return BY_SYMBOL[symbol.toUpperCase()] ?? INSTRUMENTS[0];
}

/** Distance between two prices in pips (FX, gold) or points (indices). */
export function distanceInPips(symbol: string, a: number, b: number): number {
  return Math.abs(a - b) / getInstrument(symbol).pipSize;
}
