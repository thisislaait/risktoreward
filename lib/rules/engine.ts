import { Account, TradeEntry, TradeLog, ValidationResult, RuleCheck, RuleStatus } from '@/types';
import { calcPnl } from './fundingpips';
import { dailyLimitAmount, maxLossFloor, maxLossType } from './limits';

function check(rule: string, status: RuleStatus, message: string, detail?: string): RuleCheck {
  return { rule, status, message, detail };
}

export function validateTrade(
  trade: TradeEntry,
  account: Account,
  allAccounts: Account[],
  recentLogs: TradeLog[]   // all closed trades today across all accounts
): ValidationResult {
  const checks: RuleCheck[] = [];
  const { rules } = account;

  // ── Derived values ─────────────────────────────────────────────
  const riskPnl  = calcPnl(trade.instrument, trade.direction, trade.lotSize, trade.entryPrice, trade.stopLoss);
  const rewardPnl = calcPnl(trade.instrument, trade.direction, trade.lotSize, trade.entryPrice, trade.takeProfit);
  const riskAmount   = Math.abs(riskPnl);
  const rewardAmount = Math.abs(rewardPnl);
  const rr = rewardAmount / riskAmount;

  // ── 1. Daily loss limit ─────────────────────────────────────────
  const dailyLimit = dailyLimitAmount(account);
  const remainingDailyLoss = dailyLimit + account.dailyPnl; // dailyPnl is negative when losing
  const maxPositionRisk = dailyLimit * (rules.maxPositionRiskPercent / 100);

  if (riskAmount >= remainingDailyLoss) {
    checks.push(check(
      'Daily Loss Limit',
      'block',
      rules.dailyLossAction === 'pause'
        ? 'This trade would hit your daily loss limit and pause trading for today'
        : 'This trade would breach your daily loss limit',
      `Max allowed: $${remainingDailyLoss.toFixed(2)} | Trade risk: $${riskAmount.toFixed(2)}`
    ));
  } else if (riskAmount > maxPositionRisk) {
    checks.push(check(
      'Position Size',
      'warn',
      `Single position risk exceeds ${rules.maxPositionRiskPercent}% of daily limit`,
      `Recommended max: $${maxPositionRisk.toFixed(2)} | Trade risk: $${riskAmount.toFixed(2)}`
    ));
  } else {
    checks.push(check(
      'Daily Loss Limit',
      'pass',
      `Within limit — $${(remainingDailyLoss - riskAmount).toFixed(2)} remaining buffer`,
    ));
  }

  // ── 2. Max loss (static or trailing floor) ──────────────────────
  const trailingFloor = maxLossFloor(account);
  const maxLossRule = maxLossType(account) === 'static' ? 'Max Loss' : 'Trailing Drawdown';
  const balanceAfterLoss = account.currentBalance - riskAmount;

  if (balanceAfterLoss <= trailingFloor) {
    checks.push(check(
      maxLossRule,
      'block',
      'Stop loss would breach your max loss limit',
      `Floor: $${trailingFloor.toFixed(2)} | Balance after loss: $${balanceAfterLoss.toFixed(2)}`
    ));
  } else if (balanceAfterLoss <= trailingFloor + rules.trailingDrawdownAmount * 0.15) {
    checks.push(check(
      maxLossRule,
      'warn',
      'Stop loss would put you close to your max loss limit',
      `Floor: $${trailingFloor.toFixed(2)} | Buffer remaining: $${(balanceAfterLoss - trailingFloor).toFixed(2)}`
    ));
  } else {
    checks.push(check(
      maxLossRule,
      'pass',
      `Safe — $${(balanceAfterLoss - trailingFloor).toFixed(2)} above floor`
    ));
  }

  // ── 3. Re-entry rule (15 min on same instrument) ───────────────
  const now = Date.now();
  const reEntryMs = rules.reEntryMinutes * 60 * 1000;
  const thisAccountLogs = recentLogs.filter(l =>
    l.accountId === account.id &&
    l.instrument.toUpperCase() === trade.instrument.toUpperCase() &&
    (now - l.closedAt) < reEntryMs
  );

  if (rules.reEntryMinutes <= 0) {
    // No re-entry rule at this firm.
  } else if (thisAccountLogs.length > 0) {
    const minutesAgo = Math.floor((now - thisAccountLogs[0].closedAt) / 60000);
    const waitMins = rules.reEntryMinutes - minutesAgo;
    checks.push(check(
      'Re-Entry Rule',
      'block',
      `Cannot re-enter ${trade.instrument} for another ${waitMins} min`,
      `Last exit: ${minutesAgo} min ago. Wait ${rules.reEntryMinutes} min between same-pair trades`
    ));
  } else {
    checks.push(check('Re-Entry Rule', 'pass', 'Clear — no recent exit on this pair'));
  }

  // ── 4. Cross-account copy detection ────────────────────────────
  const otherSameFirmAccounts = allAccounts.filter(a =>
    a.id !== account.id && a.firmId === account.firmId
  );

  if (otherSameFirmAccounts.length > 0) {
    const recentCrossLogs = recentLogs.filter(l => {
      const otherAccount = otherSameFirmAccounts.find(a => a.id === l.accountId);
      return (
        otherAccount &&
        l.instrument.toUpperCase() === trade.instrument.toUpperCase() &&
        (now - l.closedAt) < 5 * 60 * 1000   // within 5 min
      );
    });

    if (recentCrossLogs.length > 0) {
      checks.push(check(
        'Copy Detection',
        'block',
        'Another account at this firm recently traded this pair',
        'Same-direction entries within 5 min across accounts at the same firm = copy trade flag'
      ));
    } else {
      checks.push(check(
        'Copy Detection',
        'pass',
        'No cross-account conflict detected'
      ));
    }
  }

  // ── 5. R:R and payout warning ───────────────────────────────────
  const estimatedPayout = (account.currentBalance - account.startingBalance) * (rules.profitSplit / 100);
  const payoutWarningThreshold = estimatedPayout * (rules.payoutWarningPercent / 100);

  if (rr < 1) {
    checks.push(check(
      'Risk:Reward',
      'warn',
      `R:R is ${rr.toFixed(2)} — below 1:1. Consider adjusting TP`,
      `Risk: $${riskAmount.toFixed(2)} | Reward: $${rewardAmount.toFixed(2)}`
    ));
  } else {
    checks.push(check(
      'Risk:Reward',
      'pass',
      `R:R ${rr.toFixed(2)} — Risk $${riskAmount.toFixed(2)} | Reward $${rewardAmount.toFixed(2)}`
    ));
  }

  if (rewardAmount > payoutWarningThreshold && estimatedPayout > 0) {
    checks.push(check(
      'Payout Safety',
      'warn',
      `This trade targets ${((rewardAmount / estimatedPayout) * 100).toFixed(0)}% of your pending payout`,
      `Winning this trade will attract consistency review. Consider reducing size.`
    ));
  }

  // ── Overall status ──────────────────────────────────────────────
  const overall: RuleStatus = checks.some(c => c.status === 'block')
    ? 'block'
    : checks.some(c => c.status === 'warn')
    ? 'warn'
    : 'pass';

  return { overall, riskAmount, rewardAmount, rr, checks };
}
