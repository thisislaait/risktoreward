// Turns a firm's rule definition into today's actual limits for one account.
// Every screen and the rule engine read limits from here, so they always agree.

import type { Account, DailyLossBasis, MaxLossType } from '@/types';

export function dailyLossBasis(account: Account): DailyLossBasis {
  return account.rules.dailyLossBasis ?? 'initial';
}

export function maxLossType(account: Account): MaxLossType {
  return account.rules.maxLossType ?? 'trailing';
}

/**
 * Today's loss allowance in account currency, counted from the day's opening balance.
 * 'dayStartHigher' uses the opening balance: FundedDesk doesn't record opening equity yet,
 * which only differs when positions are held over the daily reset.
 */
export function dailyLimitAmount(account: Account): number {
  const pct = account.rules.maxDailyLossPercent / 100;
  return dailyLossBasis(account) === 'initial'
    ? account.rules.maxDailyLossAmount
    : account.dailyStartBalance * pct;
}

/** The equity level that breaches the overall max loss. */
export function maxLossFloor(account: Account): number {
  const { rules } = account;
  const amount = rules.trailingDrawdownAmount;
  const initial = rules.accountSize;
  const type = maxLossType(account);
  if (type === 'static') return initial - amount;
  const peak = type === 'trailing-eod' ? (account.eodHighWaterMark ?? account.highWaterMark) : account.highWaterMark;
  const floor = peak - amount;
  return rules.trailingLocksAtInitial ? Math.min(floor, initial) : floor;
}

export function maxLossTypeLabel(account: Account): string {
  const type = maxLossType(account);
  if (type === 'static') return 'static';
  const base = type === 'trailing-eod' ? 'trailing on end-of-day balance' : 'trailing';
  return account.rules.trailingLocksAtInitial ? `${base}, stops at starting balance` : base;
}

export function dailyBasisLabel(account: Account): string {
  switch (dailyLossBasis(account)) {
    case 'initial': return 'of starting balance';
    case 'dayStartBalance': return 'of the day’s opening balance';
    case 'dayStartHigher': return 'of the day’s opening balance or equity, whichever is higher';
  }
}

/** "FTMO · 2-Step · Phase 1", falling back for accounts made before multi-firm support. */
export function programmeLabel(account: Account): string {
  const r = account.rules;
  if (r.programmeName) return [r.firmName, r.programmeName, r.phaseLabel].filter(Boolean).join(' · ');
  const legacy: Record<string, string> = {
    'zero-instant': 'Zero',
    'challenge-phase1': 'Challenge · Phase 1',
    'challenge-phase2': 'Challenge · Phase 2',
  };
  return `${r.firmName} · ${legacy[account.challengeType] ?? account.challengeType}`;
}
