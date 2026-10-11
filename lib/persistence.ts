// Where FundedDesk keeps a user's data.
// Local mode: this browser's localStorage. Signed in: the user's rows in Supabase, protected by row-level security.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, OpenPosition, OrderAuditEntry, TradeLog } from '@/types';

export interface Snapshot {
  accounts: Account[];
  tradeLogs: TradeLog[];
  positions: OpenPosition[];
}

export interface Persistence {
  readonly kind: 'local' | 'remote';
  load(): Promise<Snapshot>;
  saveAccounts(accounts: Account[]): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  addTradeLog(log: TradeLog): Promise<void>;
  addPosition(position: OpenPosition): Promise<void>;
  removePosition(ticket: string): Promise<void>;
  recordOrder(entry: OrderAuditEntry): Promise<void>;
}

// ── Local ──────────────────────────────────────────────────────

const KEYS = { accounts: 'rtr_accounts', logs: 'rtr_logs', positions: 'rtr_positions' };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function readLocalSnapshot(): Snapshot {
  return {
    accounts: readJson<Account[]>(KEYS.accounts, []),
    tradeLogs: readJson<TradeLog[]>(KEYS.logs, []),
    positions: readJson<OpenPosition[]>(KEYS.positions, []),
  };
}

export const localPersistence: Persistence = {
  kind: 'local',
  async load() {
    return readLocalSnapshot();
  },
  async saveAccounts(accounts) {
    const all = readJson<Account[]>(KEYS.accounts, []);
    const byId = new Map(all.map(a => [a.id, a]));
    accounts.forEach(a => byId.set(a.id, a));
    writeJson(KEYS.accounts, [...byId.values()]);
  },
  async deleteAccount(id) {
    writeJson(KEYS.accounts, readJson<Account[]>(KEYS.accounts, []).filter(a => a.id !== id));
    writeJson(KEYS.positions, readJson<OpenPosition[]>(KEYS.positions, []).filter(p => p.accountId !== id));
  },
  async addTradeLog(log) {
    writeJson(KEYS.logs, [log, ...readJson<TradeLog[]>(KEYS.logs, [])]);
  },
  async addPosition(position) {
    writeJson(KEYS.positions, [position, ...readJson<OpenPosition[]>(KEYS.positions, [])]);
  },
  async removePosition(ticket) {
    writeJson(KEYS.positions, readJson<OpenPosition[]>(KEYS.positions, []).filter(p => p.ticket !== ticket));
  },
  async recordOrder() {
    // Local mode keeps no audit log; it starts once you sign in.
  },
};

// ── Supabase ───────────────────────────────────────────────────

type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null ? 0 : Number(v));
const nOrNull = (v: unknown) => (v == null ? null : Number(v));
const ms = (v: unknown) => new Date(String(v)).getTime();
const iso = (t: number) => new Date(t).toISOString();

function accountToRow(a: Account): Row {
  return {
    id: a.id,
    label: a.label,
    firm_id: a.firmId,
    challenge_type: a.challengeType,
    account_size: a.accountSize,
    starting_balance: a.startingBalance,
    current_balance: a.currentBalance,
    high_water_mark: a.highWaterMark,
    eod_high_water_mark: a.eodHighWaterMark ?? null,
    daily_start_balance: a.dailyStartBalance,
    daily_pnl: a.dailyPnl,
    trading_day: a.tradingDay ?? null,
    rules: a.rules,
  };
}
function rowToAccount(r: Row): Account {
  return {
    id: String(r.id),
    label: String(r.label),
    firmId: r.firm_id as Account['firmId'],
    challengeType: String(r.challenge_type),
    accountSize: n(r.account_size),
    startingBalance: n(r.starting_balance),
    currentBalance: n(r.current_balance),
    highWaterMark: n(r.high_water_mark),
    eodHighWaterMark: nOrNull(r.eod_high_water_mark) ?? undefined,
    dailyStartBalance: n(r.daily_start_balance),
    dailyPnl: n(r.daily_pnl),
    tradingDay: (r.trading_day as string | null) ?? undefined,
    rules: r.rules as Account['rules'],
  };
}
function rowToLog(r: Row): TradeLog {
  return {
    id: String(r.id), accountId: String(r.account_id), instrument: String(r.instrument),
    direction: r.direction as TradeLog['direction'], lotSize: n(r.lot_size),
    entryPrice: n(r.entry_price), exitPrice: n(r.exit_price), pnl: n(r.pnl),
    openedAt: ms(r.opened_at), closedAt: ms(r.closed_at),
  };
}
function rowToPosition(r: Row): OpenPosition {
  return {
    ticket: String(r.ticket), accountId: String(r.account_id), instrument: String(r.instrument),
    direction: r.direction as OpenPosition['direction'], lotSize: n(r.lot_size),
    entryPrice: n(r.entry_price), stopLoss: n(r.stop_loss), takeProfit: nOrNull(r.take_profit),
    openedAt: ms(r.opened_at),
  };
}

function check<T extends { error: { message: string } | null }>(res: T, what: string): T {
  if (res.error) throw new Error(`Couldn’t ${what}: ${res.error.message}`);
  return res;
}

export function remotePersistence(supabase: SupabaseClient): Persistence {
  return {
    kind: 'remote',
    async load() {
      const [a, l, p] = await Promise.all([
        supabase.from('trading_accounts').select('*').order('created_at'),
        // Recent history only; older trades stay in the database.
        supabase.from('trade_logs').select('*').order('closed_at', { ascending: false }).limit(500),
        supabase.from('positions').select('*').order('opened_at', { ascending: false }),
      ]);
      check(a, 'load your accounts');
      check(l, 'load your trades');
      check(p, 'load your positions');
      return {
        accounts: (a.data ?? []).map(rowToAccount),
        tradeLogs: (l.data ?? []).map(rowToLog),
        positions: (p.data ?? []).map(rowToPosition),
      };
    },
    async saveAccounts(accounts) {
      if (accounts.length === 0) return;
      check(await supabase.from('trading_accounts').upsert(accounts.map(accountToRow)), 'save your account');
    },
    async deleteAccount(id) {
      check(await supabase.from('trading_accounts').delete().eq('id', id), 'delete the account');
    },
    async addTradeLog(log) {
      check(await supabase.from('trade_logs').insert({
        id: log.id, account_id: log.accountId, instrument: log.instrument, direction: log.direction,
        lot_size: log.lotSize, entry_price: log.entryPrice, exit_price: log.exitPrice, pnl: log.pnl,
        opened_at: iso(log.openedAt), closed_at: iso(log.closedAt),
      }), 'save the closed trade');
    },
    async addPosition(p) {
      check(await supabase.from('positions').insert({
        ticket: p.ticket, account_id: p.accountId, instrument: p.instrument, direction: p.direction,
        lot_size: p.lotSize, entry_price: p.entryPrice, stop_loss: p.stopLoss, take_profit: p.takeProfit,
        opened_at: iso(p.openedAt),
      }), 'save the position');
    },
    async removePosition(ticket) {
      check(await supabase.from('positions').delete().eq('ticket', ticket), 'remove the position');
    },
    async recordOrder(e) {
      check(await supabase.from('order_audit').insert({
        account_id: e.accountId, action: e.action, platform: e.platform, instrument: e.instrument,
        direction: e.direction, lot_size: e.lotSize, verdict: e.verdict, checks: e.checks,
        result: e.result, fill_price: e.fillPrice, error: e.error,
      }), 'record the order');
    },
  };
}
