'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { FIRMS, buildRules } from '@/lib/firms';
import { dailyBasisLabel, maxLossTypeLabel, dailyLimitAmount, maxLossFloor } from '@/lib/rules/limits';
import { money } from '@/lib/format';
import type { Account } from '@/types';
import { Field, Segmented, TradeButton, cx } from '@/components/fd';

function newAccountId(firmId: string) {
  return `${firmId}-${Date.now().toString(36)}`;
}

function shortSize(n: number) {
  return n >= 1000 ? `$${n / 1000}K` : `$${n}`;
}

export default function SetupPage() {
  const router = useRouter();
  const { addAccount } = useStore();

  const [firmId, setFirmId] = useState(FIRMS[0].id);
  const firm = FIRMS.find(f => f.id === firmId)!;
  const [programmeId, setProgrammeId] = useState(firm.programmes[0].id);
  const programme = firm.programmes.find(p => p.id === programmeId) ?? firm.programmes[0];
  const [phaseId, setPhaseId] = useState(programme.phases[0].id);
  const phase = programme.phases.find(p => p.id === phaseId) ?? programme.phases[0];
  const [size, setSize] = useState<number>(programme.sizes.includes(50000) ? 50000 : programme.sizes[0]);
  const [customSize, setCustomSize] = useState('');
  const [label, setLabel] = useState('');
  const [balance, setBalance] = useState('');
  const [peak, setPeak] = useState('');
  const [todayPnl, setTodayPnl] = useState('');

  function pickFirm(id: string) {
    const f = FIRMS.find(x => x.id === id)!;
    setFirmId(f.id);
    pickProgramme(f.programmes[0].id, f);
  }
  function pickProgramme(id: string, f = firm) {
    const p = f.programmes.find(x => x.id === id)!;
    setProgrammeId(p.id);
    setPhaseId(p.phases[0].id);
    setSize(p.sizes.includes(50000) ? 50000 : p.sizes[0]);
    setCustomSize('');
  }

  const accountSize = parseFloat(customSize) > 0 ? parseFloat(customSize) : size;
  const rules = buildRules(firm, programme, phase, accountSize);
  const current = parseFloat(balance) > 0 ? parseFloat(balance) : accountSize;
  const dpnl = parseFloat(todayPnl) || 0;
  const highest = Math.max(parseFloat(peak) || 0, current, accountSize);
  const draft: Account = {
    id: 'draft',
    label: label.trim() || `${firm.name} ${programme.name} ${shortSize(accountSize)}`,
    firmId: firm.id,
    challengeType: rules.challengeType,
    accountSize,
    startingBalance: accountSize,
    currentBalance: current,
    highWaterMark: highest,
    eodHighWaterMark: highest,
    dailyStartBalance: current - dpnl,
    dailyPnl: dpnl,
    rules,
  };
  const trailing = programme.maxLossType !== 'static';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    addAccount({ ...draft, id: newAccountId(firm.id) });
    router.push('/trade');
  }

  return (
    <form className="setup" onSubmit={submit}>
      <div className="setup__main">
        <header className="setup__head">
          <h1>Add a prop account</h1>
          <p>FundedDesk checks every order against this account’s rules before it’s placed.</p>
        </header>

        <section className="setup__group">
          <h2>Firm</h2>
          <Segmented variant="pill" label="Firm" value={firmId} onChange={pickFirm} options={FIRMS.map(f => ({ value: f.id, label: f.name }))} />
        </section>

        <section className="setup__group">
          <h2>Programme</h2>
          <div className="setup__options" role="radiogroup" aria-label="Programme">
            {firm.programmes.map(p => (
              <button key={p.id} type="button" role="radio" aria-checked={p.id === programme.id}
                className={cx('setup__option', p.id === programme.id && 'is-on')} onClick={() => pickProgramme(p.id)}>
                <span className="setup__option-name">{p.name}</span>
                <span className="setup__option-desc">{p.summary}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="setup__group">
          <h2>Phase</h2>
          <Segmented variant="track" label="Phase" value={phase.id} onChange={setPhaseId}
            options={programme.phases.map(p => ({ value: p.id, label: p.label }))} />
        </section>

        <section className="setup__group">
          <h2>Account size</h2>
          <div className="setup__sizes">
            <Segmented variant="pill" label="Account size" value={customSize ? '' : String(size)}
              onChange={v => { setSize(Number(v)); setCustomSize(''); }}
              options={programme.sizes.map(s => ({ value: String(s), label: shortSize(s) }))} />
            <Field id="custom-size" label="Other size" suffix="USD" placeholder="e.g. 80000"
              value={customSize} onChange={e => setCustomSize(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
        </section>

        <section className="setup__group">
          <h2>Account details</h2>
          <div className="setup__fields">
            <Field id="label" label="Name" placeholder={draft.label} value={label} onChange={e => setLabel(e.target.value)} inputMode="text" />
            <Field id="balance" label="Current balance" suffix="USD" placeholder={String(accountSize)}
              value={balance} onChange={e => setBalance(e.target.value.replace(/[^0-9.]/g, ''))} />
            <Field id="today" label="P&L so far today" suffix="USD" placeholder="0" hint="Negative if you’re down today."
              value={todayPnl} onChange={e => setTodayPnl(e.target.value.replace(/[^0-9.-]/g, ''))} />
            {trailing && (
              <Field id="peak" label={programme.maxLossType === 'trailing-eod' ? 'Highest end-of-day balance' : 'Highest balance reached'}
                suffix="USD" placeholder={String(current)} hint="Sets where your trailing max loss sits."
                value={peak} onChange={e => setPeak(e.target.value.replace(/[^0-9.]/g, ''))} />
            )}
          </div>
        </section>
      </div>

      <aside className="setup__summary" aria-label="Rules for this account">
        <div className="setup__summary-inner">
          <div>
            <div className="setup__summary-kicker">{firm.name} · {programme.name} · {phase.label}</div>
            <div className="setup__summary-size">{money(accountSize, 0)}</div>
          </div>
          <dl className="fd-kv">
            <div><dt>Daily loss limit</dt><dd>{programme.dailyLossPercent}% · {money(dailyLimitAmount(draft), 0)}</dd></div>
            <div><dt>Measured</dt><dd>{dailyBasisLabel(draft)}</dd></div>
            {programme.dailyLossAction === 'pause' && <div><dt>If hit</dt><dd>Trading pauses for the day</dd></div>}
            <div><dt>Max loss</dt><dd>{programme.maxLossPercent}% · {money(rules.trailingDrawdownAmount, 0)}</dd></div>
            <div><dt>Type</dt><dd>{maxLossTypeLabel(draft)}</dd></div>
            <div><dt>Breach level now</dt><dd>{money(maxLossFloor(draft), 0)}</dd></div>
            <div><dt>Profit target</dt><dd>{phase.target != null ? `${phase.target}% · ${money(rules.profitTarget ?? 0, 0)}` : 'None'}</dd></div>
            <div><dt>Minimum trading days</dt><dd>{phase.minTradingDays ?? 'None'}</dd></div>
            {programme.newsBlackoutMinutes ? <div><dt>News</dt><dd>Restricted {programme.newsBlackoutMinutes} min either side</dd></div> : null}
          </dl>
          <div className={cx('setup__source', programme.source.status === 'partial' && 'is-partial')}>
            <b>{programme.source.status === 'verified' ? 'Checked against the firm’s published rules' : 'Some figures need confirming'}</b>
            <span>
              {programme.source.note ? programme.source.note + ' ' : ''}
              Checked {new Date(programme.source.checked).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.{' '}
              <a href={programme.source.url} target="_blank" rel="noreferrer">Firm’s rules</a>
            </span>
          </div>
          <TradeButton type="submit" variant="primary" block>Add account</TradeButton>
        </div>
      </aside>
    </form>
  );
}
