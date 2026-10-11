'use client';
import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { Account, OpenPosition, OrderAuditEntry, TradeLog } from '@/types';
import { calcPnl } from './rules/fundingpips';
import { localPersistence, readLocalSnapshot, remotePersistence, type Persistence } from './persistence';
import { getSupabase } from './supabase/client';

interface LogTradeParams {
  accountId: string;
  instrument: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  entryPrice: number;
  exitPrice: number;
  openedAt: number;
  closedAt: number;
}

interface Store {
  accounts: Account[];
  tradeLogs: TradeLog[];
  positions: OpenPosition[];
  selectedAccountId: string | null;
  hydrated: boolean;
  /** 'remote' when signed in and saving to Supabase; 'local' when data stays in this browser. */
  mode: 'local' | 'remote';
  userEmail: string | null;
  /** Set when a save to the server failed, so the screen can say so. */
  syncError: string | null;
  clearSyncError: () => void;
  /** Accounts found in this browser that can be copied into the signed-in account. */
  localImportCount: number;
  importLocal: () => Promise<void>;
  dismissImport: () => void;
  setSelectedAccountId: (id: string) => void;
  addAccount: (account: Account) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  logTrade: (params: LogTradeParams) => number;
  openPosition: (position: OpenPosition) => void;
  /** Removes the position and books its P&L to the account. Returns the realised P&L. */
  closePosition: (ticket: string, exitPrice: number, closedAt: number) => number;
  recordOrder: (entry: OrderAuditEntry) => void;
}

const StoreContext = createContext<Store | null>(null);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Starts a new trading day for accounts last reset on an earlier date. Returns only the accounts that changed. */
function rollDay(accounts: Account[]): Account[] {
  const day = today();
  return accounts
    .filter(a => a.tradingDay !== day)
    .map(a => ({
      ...a,
      // Accounts saved before tradingDay existed keep today's P&L on their first load.
      dailyPnl: a.tradingDay ? 0 : a.dailyPnl,
      dailyStartBalance: a.tradingDay ? a.currentBalance : a.dailyStartBalance,
      eodHighWaterMark: Math.max(a.eodHighWaterMark ?? a.highWaterMark, a.currentBalance),
      tradingDay: day,
    }));
}

const IMPORTED_KEY = 'rtr_imported';
const SELECTED_KEY = 'rtr_selected';

export function StoreProvider({ children }: { children: ReactNode }) {
  const persistence: Persistence = useMemo(() => {
    const supabase = getSupabase();
    return supabase ? remotePersistence(supabase) : localPersistence;
  }, []);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [localImportCount, setLocalImportCount] = useState(0);

  // Read by mutations so a change that lands after an await sees the latest data
  // and can't, for example, close the same position twice.
  const accountsRef = useRef(accounts);
  const positionsRef = useRef(positions);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  const persist = (work: Promise<void>) => {
    work.catch((e: unknown) => setSyncError(e instanceof Error ? e.message : 'Couldn’t save your changes.'));
  };

  async function loadAll() {
    const snap = await persistence.load();
    const rolled = rollDay(snap.accounts);
    const byId = new Map(rolled.map(a => [a.id, a]));
    const loaded = snap.accounts.map(a => byId.get(a.id) ?? a);
    if (rolled.length) await persistence.saveAccounts(rolled);
    accountsRef.current = loaded;
    positionsRef.current = snap.positions;
    setAccounts(loaded);
    setTradeLogs(snap.tradeLogs);
    setPositions(snap.positions);
    return loaded;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        try { setSelectedAccountIdState(localStorage.getItem(SELECTED_KEY)); } catch {}
        const loaded = await loadAll();
        if (persistence.kind === 'remote') {
          const { data } = await getSupabase()!.auth.getUser();
          if (!cancelled) setUserEmail(data.user?.email ?? null);
          let imported = false;
          try { imported = localStorage.getItem(IMPORTED_KEY) === '1'; } catch {}
          const local = readLocalSnapshot();
          if (!cancelled && !imported && loaded.length === 0 && local.accounts.length > 0) {
            setLocalImportCount(local.accounts.length);
          }
        }
      } catch (e) {
        if (!cancelled) setSyncError(e instanceof Error ? e.message : 'Couldn’t load your data.');
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
    // Runs once on mount; loadAll only reads stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistence]);

  const setSelectedAccountId = (id: string) => {
    setSelectedAccountIdState(id);
    try { localStorage.setItem(SELECTED_KEY, id); } catch {}
  };

  const commitAccounts = (next: Account[], changed: Account[]) => {
    accountsRef.current = next;
    setAccounts(next);
    persist(persistence.saveAccounts(changed));
  };

  const addAccount = (account: Account) => {
    const withDay = { ...account, tradingDay: account.tradingDay ?? today() };
    commitAccounts([...accountsRef.current, withDay], [withDay]);
    setSelectedAccountId(withDay.id);
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    const next = accountsRef.current.map(a => (a.id === id ? { ...a, ...updates } : a));
    const changed = next.find(a => a.id === id);
    if (changed) commitAccounts(next, [changed]);
  };

  const deleteAccount = (id: string) => {
    const next = accountsRef.current.filter(a => a.id !== id);
    accountsRef.current = next;
    setAccounts(next);
    positionsRef.current = positionsRef.current.filter(p => p.accountId !== id);
    setPositions(positionsRef.current);
    if (selectedAccountId === id && next[0]) setSelectedAccountId(next[0].id);
    persist(persistence.deleteAccount(id));
  };

  const logTrade = ({ accountId, instrument, direction, lotSize, entryPrice, exitPrice, openedAt, closedAt }: LogTradeParams) => {
    const pnl = calcPnl(instrument, direction, lotSize, entryPrice, exitPrice);
    const log: TradeLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      accountId, instrument, direction, lotSize, entryPrice, exitPrice, pnl, openedAt, closedAt,
    };
    setTradeLogs(prev => [log, ...prev]);
    persist(persistence.addTradeLog(log));
    const next = accountsRef.current.map(a => {
      if (a.id !== accountId) return a;
      const newBalance = a.currentBalance + pnl;
      return { ...a, currentBalance: newBalance, dailyPnl: a.dailyPnl + pnl, highWaterMark: Math.max(a.highWaterMark, newBalance) };
    });
    const changed = next.find(a => a.id === accountId);
    if (changed) commitAccounts(next, [changed]);
    return pnl;
  };

  const openPosition = (position: OpenPosition) => {
    positionsRef.current = [position, ...positionsRef.current];
    setPositions(positionsRef.current);
    persist(persistence.addPosition(position));
  };

  const closePosition = (ticket: string, exitPrice: number, closedAt: number) => {
    const pos = positionsRef.current.find(p => p.ticket === ticket);
    if (!pos) return 0;
    positionsRef.current = positionsRef.current.filter(p => p.ticket !== ticket);
    setPositions(positionsRef.current);
    persist(persistence.removePosition(ticket));
    return logTrade({
      accountId: pos.accountId, instrument: pos.instrument, direction: pos.direction, lotSize: pos.lotSize,
      entryPrice: pos.entryPrice, exitPrice, openedAt: pos.openedAt, closedAt,
    });
  };

  const recordOrder = (entry: OrderAuditEntry) => {
    persist(persistence.recordOrder(entry));
  };

  const importLocal = async () => {
    const local = readLocalSnapshot();
    try {
      await persistence.saveAccounts(local.accounts);
      for (const p of local.positions) await persistence.addPosition(p);
      for (const l of local.tradeLogs) await persistence.addTradeLog(l);
      try { localStorage.setItem(IMPORTED_KEY, '1'); } catch {}
      setLocalImportCount(0);
      await loadAll();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Couldn’t import your accounts.');
    }
  };

  const dismissImport = () => {
    try { localStorage.setItem(IMPORTED_KEY, '1'); } catch {}
    setLocalImportCount(0);
  };

  return (
    <StoreContext.Provider value={{
      accounts, tradeLogs, positions, hydrated,
      // Fall back to the first account when none is chosen or the chosen one was deleted.
      selectedAccountId: accounts.some(a => a.id === selectedAccountId) ? selectedAccountId : accounts[0]?.id ?? null,
      mode: persistence.kind,
      userEmail,
      syncError,
      clearSyncError: () => setSyncError(null),
      localImportCount,
      importLocal,
      dismissImport,
      setSelectedAccountId, addAccount, updateAccount, deleteAccount, logTrade,
      openPosition, closePosition, recordOrder,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
