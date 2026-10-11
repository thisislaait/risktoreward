// Prop firm rule presets.
//
// Each programme cites where its figures came from and when they were checked. Firms change
// their rules often: re-check `source.url` before relying on a preset, update `checked`, and
// mark `status: 'partial'` when any figure comes from somewhere other than the firm itself.

import type { DailyLossBasis, FirmId, FirmRules, MaxLossType, RuleSource } from '@/types';

export interface Phase {
  id: string;
  label: string;
  /** % of initial balance; null = no target (funded or instant account). */
  target: number | null;
  minTradingDays: number | null;
}

export interface Programme {
  id: string;
  name: string;
  summary: string;
  dailyLossPercent: number;
  dailyLossBasis: DailyLossBasis;
  dailyLossAction: 'breach' | 'pause';
  maxLossPercent: number;
  maxLossType: MaxLossType;
  trailingLocksAtInitial?: boolean;
  phases: Phase[];
  newsBlackoutMinutes?: number | null;
  bestDayPercent?: number | null;
  sizes: number[];
  source: RuleSource;
}

export interface Firm {
  id: FirmId;
  name: string;
  programmes: Programme[];
}

const CHECKED = '2026-10-11';

const funded = (minTradingDays: number | null = null): Phase => ({ id: 'funded', label: 'Funded', target: null, minTradingDays });

export const FIRMS: Firm[] = [
  {
    id: 'ftmo',
    name: 'FTMO',
    programmes: [
      {
        id: 'ftmo-2step',
        name: '2-Step',
        summary: '5% daily · 10% static max loss · 10% then 5% target',
        dailyLossPercent: 5, dailyLossBasis: 'initial', dailyLossAction: 'breach',
        maxLossPercent: 10, maxLossType: 'static',
        phases: [
          { id: 'phase1', label: 'Challenge', target: 10, minTradingDays: 4 },
          { id: 'phase2', label: 'Verification', target: 5, minTradingDays: 4 },
          funded(),
        ],
        sizes: [10000, 25000, 50000, 100000, 200000],
        source: { url: 'https://ftmo.com/en/trading-objectives/', checked: CHECKED, status: 'verified' },
      },
      {
        id: 'ftmo-1step',
        name: '1-Step',
        summary: '3% daily · 10% max loss trailing on end-of-day balance · 10% target',
        dailyLossPercent: 3, dailyLossBasis: 'initial', dailyLossAction: 'breach',
        maxLossPercent: 10, maxLossType: 'trailing-eod',
        phases: [
          { id: 'phase1', label: 'Challenge', target: 10, minTradingDays: null },
          funded(),
        ],
        bestDayPercent: 50,
        sizes: [10000, 25000, 50000, 100000, 200000],
        source: {
          url: 'https://ftmo.com/en/trading-objectives/', checked: CHECKED, status: 'verified',
          note: 'Best Day rule: your best day must be under 50% of positive days’ profit. FTMO says exceeding it is not a breach.',
        },
      },
    ],
  },
  {
    id: 'fundednext',
    name: 'FundedNext',
    programmes: [
      {
        id: 'fn-stellar-2step',
        name: 'Stellar 2-Step',
        summary: '5% daily · 10% static max loss · 8% then 5% target',
        dailyLossPercent: 5, dailyLossBasis: 'initial', dailyLossAction: 'breach',
        maxLossPercent: 10, maxLossType: 'static',
        phases: [
          { id: 'phase1', label: 'Phase 1', target: 8, minTradingDays: 5 },
          { id: 'phase2', label: 'Phase 2', target: 5, minTradingDays: 5 },
          funded(),
        ],
        newsBlackoutMinutes: 5,
        sizes: [6000, 15000, 25000, 50000, 100000, 200000],
        source: {
          url: 'https://help.fundednext.com/en/articles/17255124-stellar-2-step-challenge', checked: CHECKED, status: 'verified',
          note: 'News: on funded accounts, only 40% of profit from trades within 5 minutes of high-impact news counts.',
        },
      },
      {
        id: 'fn-stellar-1step',
        name: 'Stellar 1-Step',
        summary: '3% daily · 6% static max loss · 10% target',
        dailyLossPercent: 3, dailyLossBasis: 'initial', dailyLossAction: 'breach',
        maxLossPercent: 6, maxLossType: 'static',
        phases: [
          { id: 'phase1', label: 'Challenge', target: 10, minTradingDays: 2 },
          funded(),
        ],
        sizes: [6000, 15000, 25000, 50000, 100000, 200000],
        source: { url: 'https://fundednext.com/cfds/stellar-1-step', checked: CHECKED, status: 'verified' },
      },
    ],
  },
  {
    id: 'the5ers',
    name: 'The5ers',
    programmes: [
      {
        id: '5ers-high-stakes',
        name: 'High Stakes',
        summary: '5% daily · 10% static max loss · 10% then 5% target',
        dailyLossPercent: 5, dailyLossBasis: 'dayStartHigher', dailyLossAction: 'breach',
        maxLossPercent: 10, maxLossType: 'static',
        phases: [
          { id: 'phase1', label: 'Step 1', target: 10, minTradingDays: 3 },
          { id: 'phase2', label: 'Step 2', target: 5, minTradingDays: 3 },
          funded(),
        ],
        newsBlackoutMinutes: 2,
        sizes: [5000, 10000, 20000, 60000, 100000],
        source: {
          url: 'https://the5ers.com/high-stakes/', checked: CHECKED, status: 'partial',
          note: 'The High Stakes page doesn’t say how the 5% daily loss is measured. FundedDesk assumes the higher of the previous day’s closing balance or equity, as The5ers’ 2-Step FAQ states. Minimum days are profitable days (0.5%+ of initial balance).',
        },
      },
      {
        id: '5ers-hyper-growth',
        name: 'Hyper Growth',
        summary: '3% daily pause · 6% static stop-out · 10% target',
        dailyLossPercent: 3, dailyLossBasis: 'dayStartBalance', dailyLossAction: 'pause',
        maxLossPercent: 6, maxLossType: 'static',
        phases: [
          { id: 'phase1', label: 'Level 1', target: 10, minTradingDays: null },
          funded(),
        ],
        sizes: [5000, 10000, 20000],
        source: {
          url: 'https://the5ers.com/hyper-growth/', checked: CHECKED, status: 'verified',
          note: 'Hitting the 3% daily loss pauses trading until the next day; it does not fail the account.',
        },
      },
    ],
  },
  {
    id: 'alpha-capital',
    name: 'Alpha Capital',
    programmes: [
      {
        id: 'alpha-one',
        name: 'Alpha One',
        summary: '4% daily · 6% trailing max loss · 10% target',
        dailyLossPercent: 4, dailyLossBasis: 'dayStartHigher', dailyLossAction: 'breach',
        maxLossPercent: 6, maxLossType: 'trailing', trailingLocksAtInitial: true,
        phases: [
          { id: 'phase1', label: 'Evaluation', target: 10, minTradingDays: 1 },
          funded(),
        ],
        sizes: [5000, 10000, 25000, 50000, 100000, 200000],
        source: {
          url: 'https://alphacapitalgroup.uk/posts/alpha-capital-rules-explained-drawdown-profit-targets-daily-loss-and-evaluation-rules-2026',
          checked: CHECKED, status: 'verified',
          note: 'The trailing max loss stops rising once it reaches the starting balance.',
        },
      },
      {
        id: 'alpha-pro-6',
        name: 'Alpha Pro 6%',
        summary: '3% daily · 6% static max loss · 6% then 6% target',
        dailyLossPercent: 3, dailyLossBasis: 'dayStartHigher', dailyLossAction: 'breach',
        maxLossPercent: 6, maxLossType: 'static',
        phases: [
          { id: 'phase1', label: 'Phase 1', target: 6, minTradingDays: 3 },
          { id: 'phase2', label: 'Phase 2', target: 6, minTradingDays: 3 },
          funded(),
        ],
        sizes: [5000, 10000, 25000, 50000, 100000, 200000],
        source: {
          url: 'https://alphacapitalgroup.uk/posts/alpha-capital-rules-explained-drawdown-profit-targets-daily-loss-and-evaluation-rules-2026',
          checked: CHECKED, status: 'verified',
        },
      },
      {
        id: 'alpha-pro-8',
        name: 'Alpha Pro 8%',
        summary: '4% daily · 8% static max loss · 8% then 5% target',
        dailyLossPercent: 4, dailyLossBasis: 'dayStartBalance', dailyLossAction: 'breach',
        maxLossPercent: 8, maxLossType: 'static',
        phases: [
          { id: 'phase1', label: 'Phase 1', target: 8, minTradingDays: 3 },
          { id: 'phase2', label: 'Phase 2', target: 5, minTradingDays: 3 },
          funded(),
        ],
        sizes: [5000, 10000, 25000, 50000, 100000, 200000],
        source: {
          url: 'https://alphacapitalgroup.uk/posts/alpha-capital-rules-explained-drawdown-profit-targets-daily-loss-and-evaluation-rules-2026',
          checked: CHECKED, status: 'verified',
        },
      },
    ],
  },
  {
    id: 'funding-pips',
    name: 'Funding Pips',
    programmes: [
      {
        id: 'fp-2step-standard-5',
        name: '2-Step Standard (5% daily)',
        summary: '5% daily · 10% static max loss · 8% then 5% target',
        dailyLossPercent: 5, dailyLossBasis: 'dayStartHigher', dailyLossAction: 'breach',
        maxLossPercent: 10, maxLossType: 'static',
        phases: [
          { id: 'phase1', label: 'Phase 1', target: 8, minTradingDays: 3 },
          { id: 'phase2', label: 'Phase 2', target: 5, minTradingDays: 3 },
          funded(),
        ],
        sizes: [5000, 10000, 25000, 50000, 100000],
        source: {
          url: 'https://help.fundingpips.com/hc/en-us/articles/34501809112081-2-Step-Standard', checked: CHECKED, status: 'partial',
          note: 'Funding Pips’ help centre blocked automated reading. The daily-loss basis comes from its help-centre text as quoted in search results; the max loss, targets and minimum days come from secondary summaries. Confirm before trading.',
        },
      },
      {
        id: 'fp-2step-standard-3',
        name: '2-Step Standard (3% daily)',
        summary: '3% daily · 10% static max loss · 8% then 5% target',
        dailyLossPercent: 3, dailyLossBasis: 'dayStartHigher', dailyLossAction: 'breach',
        maxLossPercent: 10, maxLossType: 'static',
        phases: [
          { id: 'phase1', label: 'Phase 1', target: 8, minTradingDays: 3 },
          { id: 'phase2', label: 'Phase 2', target: 5, minTradingDays: 3 },
          funded(),
        ],
        sizes: [5000, 10000, 25000, 50000, 100000],
        source: {
          url: 'https://help.fundingpips.com/hc/en-us/articles/34501809112081-2-Step-Standard', checked: CHECKED, status: 'partial',
          note: 'Funding Pips’ help centre blocked automated reading. The daily-loss basis comes from its help-centre text as quoted in search results; the max loss, targets and minimum days come from secondary summaries. Confirm before trading.',
        },
      },
      {
        id: 'fp-zero',
        name: 'Zero',
        summary: '3% daily · 5% trailing max loss · no evaluation',
        dailyLossPercent: 3, dailyLossBasis: 'dayStartHigher', dailyLossAction: 'breach',
        maxLossPercent: 5, maxLossType: 'trailing',
        phases: [funded()],
        sizes: [5000, 10000, 25000, 50000, 100000],
        source: {
          url: 'https://help.fundingpips.com/hc/en-us/articles/34502157694865-FundingPips-Zero', checked: CHECKED, status: 'partial',
          note: 'The 3% daily loss on the higher of opening balance or equity is from Funding Pips’ help-centre text. The 5% trailing max loss comes from secondary summaries. Zero also has consistency and profitable-day conditions FundedDesk doesn’t check yet.',
        },
      },
    ],
  },
];

export function findProgramme(programmeId: string): { firm: Firm; programme: Programme } | null {
  for (const firm of FIRMS) {
    const programme = firm.programmes.find(p => p.id === programmeId);
    if (programme) return { firm, programme };
  }
  return null;
}

/** Builds the stored rule set for one account from a firm programme, phase and size. */
export function buildRules(firm: Firm, programme: Programme, phase: Phase, accountSize: number): FirmRules {
  return {
    firmId: firm.id,
    firmName: firm.name,
    programmeId: programme.id,
    programmeName: programme.name,
    phaseId: phase.id,
    phaseLabel: phase.label,
    challengeType: `${programme.id}:${phase.id}`,
    accountSize,
    maxDailyLossPercent: programme.dailyLossPercent,
    maxDailyLossAmount: accountSize * programme.dailyLossPercent / 100,
    dailyLossBasis: programme.dailyLossBasis,
    dailyLossAction: programme.dailyLossAction,
    trailingDrawdownPercent: programme.maxLossPercent,
    trailingDrawdownAmount: accountSize * programme.maxLossPercent / 100,
    maxLossType: programme.maxLossType,
    trailingLocksAtInitial: programme.trailingLocksAtInitial ?? false,
    profitTarget: phase.target != null ? accountSize * phase.target / 100 : null,
    minTradingDays: phase.minTradingDays,
    profitSplit: 80,
    payoutEveryDays: 14,
    allowNewsTrading: !programme.newsBlackoutMinutes,
    newsBlackoutMinutes: programme.newsBlackoutMinutes ?? null,
    allowWeekendHolding: true,
    reEntryMinutes: 0,
    maxPositionRiskPercent: 50,
    payoutWarningPercent: 65,
    bestDayPercent: programme.bestDayPercent ?? null,
    source: programme.source,
  };
}
