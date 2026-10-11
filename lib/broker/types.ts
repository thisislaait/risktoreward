// The boundary between FundedDesk and a trading platform.
// Each platform (TradeLocker, MT5, cTrader, DXtrade…) gets one adapter implementing BrokerAdapter.
// The rest of the app only talks to this interface, so swapping the simulated feed for a real
// platform means writing one adapter and changing the line in lib/market.tsx that picks it.

export type Side = 'BUY' | 'SELL';

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  /** Session open, for today's change. */
  open: number;
  time: number;
}

export type Timeframe = '15M' | '1H' | '4H' | '1D' | '1W';

export interface OrderRequest {
  accountId: string;
  symbol: string;
  side: Side;
  lots: number;
  stopLoss: number;
  takeProfit: number | null;
}

export interface Fill {
  price: number;
  time: number;
  /** Platform order/position id. */
  ticket: string;
}

export type BrokerResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface BrokerAdapter {
  /** Shown to the trader wherever an order is confirmed, e.g. "Simulated" or "TradeLocker". */
  readonly label: string;
  /** True when orders reach a real account. */
  readonly live: boolean;
  /** Streams quotes for the given symbols. Returns an unsubscribe function. */
  subscribe(symbols: string[], onQuote: (q: Quote) => void): () => void;
  /** Closing prices, oldest first, ending at the current mid. */
  history(symbol: string, timeframe: Timeframe, bars: number): number[];
  /** Places a market order with attached stop and target. */
  placeOrder(req: OrderRequest): Promise<BrokerResult<Fill>>;
  /** Closes an open position at market. */
  closePosition(ticket: string, symbol: string, side: Side, lots: number): Promise<BrokerResult<Fill>>;
}
