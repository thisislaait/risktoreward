import { FirmRules, ChallengeType, AccountSize } from '@/types';
import { getInstrument, distanceInPips } from '@/lib/instruments';

export function getFundingPipsRules(
  challengeType: ChallengeType,
  accountSize: AccountSize
): FirmRules {
  const base = {
    firmId: 'funding-pips' as const,
    firmName: 'Funding Pips',
    challengeType,
    accountSize,
    profitSplit: 80,
    payoutEveryDays: 14,
    allowNewsTrading: true,
    allowWeekendHolding: true,
    reEntryMinutes: 15,
    maxPositionRiskPercent: 50,   // max 50% of daily loss per single position
    payoutWarningPercent: 65,     // warn if trade targets >65% of payout buffer
  };

  const dailyLossPercent = challengeType === 'zero-instant' ? 4 : 5;
  const drawdownPercent  = challengeType === 'zero-instant' ? 4 : 10;

  const profitTarget =
    challengeType === 'challenge-phase1' ? accountSize * 0.08 :
    challengeType === 'challenge-phase2' ? accountSize * 0.05 :
    null;

  const minTradingDays =
    challengeType === 'zero-instant' ? null : 5;

  return {
    ...base,
    maxDailyLossPercent: dailyLossPercent,
    maxDailyLossAmount: accountSize * dailyLossPercent / 100,
    trailingDrawdownPercent: drawdownPercent,
    trailingDrawdownAmount: accountSize * drawdownPercent / 100,
    profitTarget,
    minTradingDays,
  };
}

export function getPipValue(instrument: string): number {
  return getInstrument(instrument).pipValue;
}

export function calcPips(instrument: string, price1: number, price2: number): number {
  return distanceInPips(instrument, price1, price2);
}

export function calcPnl(
  instrument: string,
  direction: 'BUY' | 'SELL',
  lotSize: number,
  entryPrice: number,
  exitPrice: number
): number {
  const pips = calcPips(instrument, entryPrice, exitPrice);
  const sign = direction === 'BUY'
    ? (exitPrice > entryPrice ? 1 : -1)
    : (exitPrice < entryPrice ? 1 : -1);
  return sign * pips * lotSize * getPipValue(instrument);
}
