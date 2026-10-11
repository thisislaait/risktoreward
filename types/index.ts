export type FirmId = 'funding-pips' | 'ftmo' | 'fundednext' | 'the5ers' | 'alpha-capital';

/** Legacy Funding Pips programme ids; new accounts store "<programmeId>:<phaseId>". */
export type ChallengeType = string;

export type AccountSize = number;

/** How a firm measures today's loss allowance. */
export type DailyLossBasis =
  | 'initial'          // fixed % of the initial balance, counted from the day's opening balance
  | 'dayStartBalance'  // % of the day's opening balance
  | 'dayStartHigher';  // % of the higher of the day's opening balance or equity

/** How the overall loss floor moves. */
export type MaxLossType =
  | 'static'        // floor = initial balance − limit, never moves
  | 'trailing'      // floor follows the highest balance reached
  | 'trailing-eod'; // floor follows the highest end-of-day balance

export interface RuleSource {
  url: string;
  /** ISO date the figures were checked against the firm's own pages. */
  checked: string;
  /** 'partial' means some figures came from secondary sources and should be confirmed. */
  status: 'verified' | 'partial';
  note?: string;
}

export interface FirmRules {
  firmId: FirmId;
  firmName: string;
  programmeId?: string;
  programmeName?: string;
  phaseId?: string;
  phaseLabel?: string;
  challengeType: ChallengeType;
  accountSize: AccountSize;
  maxDailyLossPercent: number;     // e.g. 4 = 4%
  maxDailyLossAmount: number;      // accountSize * maxDailyLossPercent / 100 (the amount on the initial balance)
  dailyLossBasis?: DailyLossBasis; // absent on old accounts: 'initial'
  /** 'pause' = hitting the limit stops trading for the day; 'breach' = the account fails. */
  dailyLossAction?: 'breach' | 'pause';
  trailingDrawdownPercent: number; // the overall max loss %, whatever its type (name kept for old accounts)
  trailingDrawdownAmount: number;  // accountSize * trailingDrawdownPercent / 100
  maxLossType?: MaxLossType;       // absent on old accounts: 'trailing'
  /** Alpha One: the trailing floor stops rising once it reaches the initial balance. */
  trailingLocksAtInitial?: boolean;
  profitTarget: number | null;     // null = no target (funded or instant)
  minTradingDays: number | null;
  profitSplit: number;             // e.g. 80
  payoutEveryDays: number;
  allowNewsTrading: boolean;
  /** Minutes either side of high-impact news when trading is restricted. */
  newsBlackoutMinutes?: number | null;
  allowWeekendHolding: boolean;
  reEntryMinutes: number;          // min minutes before re-entry on same pair (0 = no rule)
  maxPositionRiskPercent: number;  // FundedDesk guardrail: max % of daily loss per single position
  payoutWarningPercent: number;    // warn if single trade targets > X% of payout buffer
  /** Best-day / consistency share, if the programme has one. */
  bestDayPercent?: number | null;
  source?: RuleSource;
}

export interface Account {
  id: string;
  label: string;
  firmId: FirmId;
  challengeType: ChallengeType;
  accountSize: AccountSize;
  startingBalance: number;
  currentBalance: number;
  highWaterMark: number;
  dailyStartBalance: number;       // balance at start of trading day
  /** Highest balance recorded at a day rollover; drives end-of-day trailing floors. */
  eodHighWaterMark?: number;
  /** Local date (YYYY-MM-DD) of the last daily reset, so each account resets once per day on any device. */
  tradingDay?: string;
  dailyPnl: number;
  rules: FirmRules;
}

export interface TradeEntry {
  instrument: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  accountId: string;
}

export interface TradeLog {
  id: string;
  accountId: string;
  instrument: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  openedAt: number;   // timestamp ms
  closedAt: number;   // timestamp ms
}

export type RuleStatus = 'pass' | 'warn' | 'block';

export interface RuleCheck {
  rule: string;
  status: RuleStatus;
  message: string;
  detail?: string;
}

export interface ValidationResult {
  overall: RuleStatus;
  riskAmount: number;
  rewardAmount: number;
  rr: number;
  checks: RuleCheck[];
}

export interface OpenPosition {
  ticket: string;
  accountId: string;
  instrument: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number | null;
  openedAt: number;   // timestamp ms
}

/** One order attempt, as recorded in the audit log. */
export interface OrderAuditEntry {
  accountId: string;
  action: 'place' | 'close';
  platform: string;
  instrument: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  verdict: 'go' | 'review' | 'stop' | null;
  checks: RuleCheck[] | null;
  result: 'filled' | 'rejected';
  fillPrice: number | null;
  error: string | null;
}
