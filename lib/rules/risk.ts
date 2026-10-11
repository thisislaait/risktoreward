// One calculation for every risk figure on screen. The top bar, the ticket, the verdict and the
// meters all read from accountRisk(), so they can't disagree.

import { Account, OpenPosition, RuleCheck, ValidationResult } from '@/types';
import type { Quote } from '@/lib/broker/types';
import { getInstrument, distanceInPips } from '@/lib/instruments';
import { calcPnl } from './fundingpips';
import { dailyLimitAmount, maxLossFloor } from './limits';

export interface AccountRisk {
  balance: number;
  /** Unrealised P&L across this account's open positions. */
  floating: number;
  equity: number;
  dailyLimit: number;
  /** Daily loss allowance left, counting realised and floating P&L. */
  dailyLeft: number;
  drawdownLimit: number;
  /** Equity level that breaches the trailing drawdown. */
  floor: number;
  drawdownLeft: number;
}

/** P&L of an open position at the price it would close at now. */
export function positionPnl(p: OpenPosition, q: Quote | undefined): number {
  if (!q) return 0;
  const exit = p.direction === 'BUY' ? q.bid : q.ask;
  return calcPnl(p.instrument, p.direction, p.lotSize, p.entryPrice, exit);
}

export function accountRisk(account: Account, positions: OpenPosition[], quotes: Record<string, Quote>): AccountRisk {
  const floating = positions
    .filter(p => p.accountId === account.id)
    .reduce((sum, p) => sum + positionPnl(p, quotes[p.instrument]), 0);
  const equity = account.currentBalance + floating;
  const dailyLimit = dailyLimitAmount(account);
  const drawdownLimit = account.rules.trailingDrawdownAmount;
  const floor = maxLossFloor(account);
  return {
    balance: account.currentBalance,
    floating,
    equity,
    dailyLimit,
    dailyLeft: dailyLimit + account.dailyPnl + floating,
    drawdownLimit,
    floor,
    // A trailing floor locked at the starting balance can sit closer than the full limit.
    drawdownLeft: equity - floor,
  };
}

/** The account as the rule engine should see it: floating P&L counts toward today's loss and equity. */
export function accountForRules(account: Account, risk: AccountRisk): Account {
  return { ...account, dailyPnl: account.dailyPnl + risk.floating, currentBalance: risk.equity };
}

export function riskPerLot(symbol: string, entry: number, stop: number): number {
  return distanceInPips(symbol, entry, stop) * getInstrument(symbol).pipValue;
}

export function lotsForRisk(risk: number, perLot: number): number {
  if (perLot <= 0) return 0;
  return Math.floor((risk / perLot) * 100) / 100;
}

/** Largest risk that breaches no firm rule, with 5% held back for slippage. */
export function maxSafeRisk(r: AccountRisk): number {
  return Math.max(0, Math.min(r.dailyLeft, r.drawdownLeft) * 0.95);
}

/** Largest risk that passes every check without a warning. */
export function cleanRisk(account: Account, r: AccountRisk): number {
  const positionCap = r.dailyLimit * (account.rules.maxPositionRiskPercent / 100);
  const drawdownCap = r.drawdownLeft - r.drawdownLimit * 0.15;
  return Math.max(0, Math.min(positionCap, r.dailyLeft - 0.01, drawdownCap));
}

export type VerdictState = 'go' | 'review' | 'stop';

export function verdictState(result: ValidationResult): VerdictState {
  return result.overall === 'pass' ? 'go' : result.overall === 'warn' ? 'review' : 'stop';
}

/** The check that decided the verdict: the first breach, else the first warning. */
export function decidingCheck(result: ValidationResult): RuleCheck | undefined {
  return result.checks.find(c => c.status === 'block') ?? result.checks.find(c => c.status === 'warn');
}
