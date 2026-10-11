// Simulated platform: a random-walk price feed and instant market fills.
// It stands in for a real platform until an adapter for one is written. Nothing here reaches a market.

import { INSTRUMENTS, getInstrument } from '@/lib/instruments';
import type { BrokerAdapter, BrokerResult, Fill, OrderRequest, Quote, Side, Timeframe } from './types';

const TICK_MS = 1000;
const TICK_VOL = 0.00004; // per-tick move as a fraction of price
const TF_VOL: Record<Timeframe, number> = { '15M': 0.0005, '1H': 0.001, '4H': 0.002, '1D': 0.005, '1W': 0.012 };

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class SimulatedBroker implements BrokerAdapter {
  readonly label = 'Simulated';
  readonly live = false;

  private mids = new Map<string, number>();
  private opens = new Map<string, number>();
  private listeners = new Set<{ symbols: Set<string>; cb: (q: Quote) => void }>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private shapes = new Map<string, number[]>();
  private rand = Math.random;

  constructor() {
    for (const inst of INSTRUMENTS) {
      const r = seeded(hash(inst.symbol));
      this.mids.set(inst.symbol, inst.startPrice);
      this.opens.set(inst.symbol, inst.startPrice * (1 - (r() - 0.45) * 0.004));
    }
  }

  private quote(symbol: string): Quote {
    const inst = getInstrument(symbol);
    const mid = this.mids.get(inst.symbol) ?? inst.startPrice;
    const half = inst.spread / 2;
    const round = (n: number) => Number(n.toFixed(inst.digits));
    return { symbol: inst.symbol, bid: round(mid - half), ask: round(mid + half), open: this.opens.get(inst.symbol) ?? mid, time: Date.now() };
  }

  private tick = () => {
    for (const inst of INSTRUMENTS) {
      const mid = this.mids.get(inst.symbol)!;
      const drift = (inst.startPrice - mid) * 0.002; // keeps the walk near its seed
      this.mids.set(inst.symbol, mid + (this.rand() - 0.5) * 2 * mid * TICK_VOL + drift);
    }
    for (const l of this.listeners) for (const s of l.symbols) l.cb(this.quote(s));
  };

  subscribe(symbols: string[], onQuote: (q: Quote) => void) {
    const entry = { symbols: new Set(symbols.map(s => s.toUpperCase())), cb: onQuote };
    this.listeners.add(entry);
    for (const s of entry.symbols) onQuote(this.quote(s));
    if (!this.timer) this.timer = setInterval(this.tick, TICK_MS);
    return () => {
      this.listeners.delete(entry);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  history(symbol: string, timeframe: Timeframe, bars: number): number[] {
    const inst = getInstrument(symbol);
    const key = `${inst.symbol}:${timeframe}:${bars}`;
    let shape = this.shapes.get(key);
    if (!shape) {
      // A fixed random walk per symbol and timeframe, stored as offsets from its last point.
      const r = seeded(hash(key));
      const pts = [0];
      for (let i = 1; i < bars; i++) pts.push(pts[i - 1] + (r() - 0.5) * 2 * TF_VOL[timeframe] + Math.sin(i / 9) * TF_VOL[timeframe] * 0.3);
      const last = pts[pts.length - 1];
      shape = pts.map(p => p - last);
      this.shapes.set(key, shape);
    }
    const mid = this.mids.get(inst.symbol) ?? inst.startPrice;
    return shape.map(o => Number((mid * (1 + o)).toFixed(inst.digits)));
  }

  async placeOrder(req: OrderRequest): Promise<BrokerResult<Fill>> {
    if (req.lots <= 0) return { ok: false, error: 'Size must be at least 0.01 lots.' };
    await new Promise(r => setTimeout(r, 250));
    const q = this.quote(req.symbol);
    const fillPrice = req.side === 'BUY' ? q.ask : q.bid;
    if (req.side === 'BUY' ? req.stopLoss >= fillPrice : req.stopLoss <= fillPrice) {
      return { ok: false, error: 'The market moved past your stop. Check the stop and try again.' };
    }
    return { ok: true, value: { price: fillPrice, time: Date.now(), ticket: `SIM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` } };
  }

  async closePosition(ticket: string, symbol: string, side: Side): Promise<BrokerResult<Fill>> {
    await new Promise(r => setTimeout(r, 200));
    const q = this.quote(symbol);
    return { ok: true, value: { price: side === 'BUY' ? q.bid : q.ask, time: Date.now(), ticket } };
  }
}
