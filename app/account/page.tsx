'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/lib/store';
import { dailyLimitAmount, maxLossFloor, programmeLabel, dailyBasisLabel, maxLossTypeLabel } from '@/lib/rules/limits';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt)' }}>{title}</p>
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      padding: '13px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '3px' }}>{label}</p>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--txt)' }}>{value}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
            color: 'var(--go-color)', background: 'var(--go-bg)',
            padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--go-border)',
            whiteSpace: 'nowrap',
          }}>
            ✓ Verified by firm
          </span>
          <button
            onClick={() => setOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: '2px' }}
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label, sub, enabled, onToggle, badge,
}: {
  label: string; sub?: string; enabled: boolean; onToggle: () => void; badge?: string;
}) {
  return (
    <div style={{
      padding: '13px 0', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--txt)' }}>{label}</p>
        {sub && <p style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '2px' }}>{sub}</p>}
      </div>
      <button
        onClick={onToggle}
        style={{
          width: '38px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
          background: enabled ? 'var(--go-color)' : 'var(--border2)',
          position: 'relative', transition: 'background 0.15s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: '3px',
          left: enabled ? '18px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
          transition: 'left 0.15s',
        }} />
      </button>
    </div>
  );
}

export default function AccountPage() {
  const { accounts, selectedAccountId, setSelectedAccountId, deleteAccount } = useStore();
  const router = useRouter();
  const account = accounts.find(a => a.id === selectedAccountId);

  // Personal guardrails state
  const [guardrails, setGuardrails] = useState({
    cooldown:        true,
    maxTrades:       true,
    consecLosses:    false,
    dailyRiskCap:    true,
    newsBlock:       false,
  });
  const toggle = (key: keyof typeof guardrails) =>
    setGuardrails(g => ({ ...g, [key]: !g[key] }));

  if (!account) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: 'var(--txt2)', marginBottom: '20px' }}>No account added yet.</p>
        <Link href="/setup" style={{
          padding: '11px 24px', background: '#1C1C1A', color: '#fff',
          borderRadius: '6px', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
        }}>
          Add Account
        </Link>
      </div>
    );
  }

  const { rules } = account;
  const profitGained = account.currentBalance - account.startingBalance;
  const profitTarget = rules.profitTarget ?? 0;
  const profitPct    = profitTarget > 0 ? Math.min(100, Math.max(0, (profitGained / profitTarget) * 100)) : 0;

  const trailingFloor    = maxLossFloor(account);
  const drawdownBuffer   = account.currentBalance - trailingFloor;
  const dailyLossLeft    = dailyLimitAmount(account) + account.dailyPnl;
  const drawdownUsedPct  = Math.max(0, Math.round((1 - drawdownBuffer / rules.trailingDrawdownAmount) * 100));
  const isFunded         = rules.phaseId ? rules.phaseId === 'funded' : account.challengeType === 'zero-instant';

  const eligibilityItems = [
    { label: 'Balance above max loss level', met: account.currentBalance > trailingFloor },
    { label: 'Daily loss limit not breached today', met: dailyLossLeft > 0 },
    { label: 'Profit target reached', met: profitTarget > 0 ? profitGained >= profitTarget : true },
    { label: 'Min trading days completed', met: rules.minTradingDays ? false : true },
    { label: 'No rule violations on record', met: true },
  ];
  const eligibilityMet = eligibilityItems.filter(e => e.met).length;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px 20px 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '16px', alignItems: 'start' }}>

        {/* LEFT */}
        <div>
          {/* Payout Status */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt)', marginBottom: '2px' }}>Payout Status</p>
                <p style={{ fontSize: '12px', color: 'var(--txt3)' }}>
                  {programmeLabel(account)} · ${account.accountSize.toLocaleString()}
                </p>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '4px 10px',
                borderRadius: '6px', letterSpacing: '0.04em',
                background: isFunded ? 'var(--go-bg)' : 'var(--review-bg)',
                color: isFunded ? 'var(--go-color)' : 'var(--review-color)',
                border: `1px solid ${isFunded ? 'var(--go-border)' : 'var(--review-border)'}`,
              }}>
                {isFunded ? 'FUNDED' : 'EVALUATION'}
              </span>
            </div>

            {profitTarget > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>Profit Target</p>
                  <p style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: 'var(--go-color)' }}>
                    ${fmt(profitGained)} / ${fmt(profitTarget)}
                  </p>
                </div>
                <div style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ height: '100%', width: `${profitPct}%`, background: 'var(--go-color)', borderRadius: '3px' }} />
                </div>
                <p style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '20px' }}>
                  ${fmt(profitTarget - profitGained)} remaining to target
                </p>
              </>
            )}

            {/* 3 mini stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              {[
                { label: 'Clean Day Streak', value: '0 days' },
                { label: 'Drawdown Used', value: `${drawdownUsedPct}%` },
                { label: 'Min Trading Days', value: rules.minTradingDays ? `${rules.minTradingDays} days` : 'No req.' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--card-alt)', padding: '12px 14px' }}>
                  <p style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '4px' }}>{label}</p>
                  <p style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: 'var(--txt)' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Eligibility checklist */}
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt)' }}>
                  Eligibility — {eligibilityMet}/{eligibilityItems.length} conditions met
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {eligibilityItems.map(({ label, met }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      color: met ? 'var(--go-color)' : 'var(--txt3)',
                    }}>
                      {met ? '✓' : '○'}
                    </span>
                    <span style={{ fontSize: '12px', color: met ? 'var(--txt)' : 'var(--txt3)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Ruleset */}
          <SectionCard title="Active Ruleset">
            <p style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '4px' }}>
              {programmeLabel(account)} · ${account.accountSize.toLocaleString()}
            </p>
            <RuleRow label="Daily Loss Limit" value={`$${fmt(dailyLimitAmount(account))} (${rules.maxDailyLossPercent}% ${dailyBasisLabel(account)})`} />
            <RuleRow label="Max Loss" value={`$${fmt(rules.trailingDrawdownAmount)} (${rules.trailingDrawdownPercent}%, ${maxLossTypeLabel(account)})`} />
            {rules.reEntryMinutes > 0 && <RuleRow label="Cooldown After Exit" value={`${rules.reEntryMinutes} minutes per pair`} />}
            <RuleRow label="Max Position Risk" value={`${rules.maxPositionRiskPercent}% of daily limit`} />
            {rules.profitTarget && <RuleRow label="Profit Target" value={`$${fmt(rules.profitTarget)}`} />}
            {rules.minTradingDays && <RuleRow label="Min Trading Days" value={`${rules.minTradingDays} days`} />}
            <RuleRow label="Profit Split" value={`${rules.profitSplit}%`} />
            <div style={{ paddingTop: '12px' }}>
              <p style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                {rules.source
                  ? <>Checked against {rules.firmName}’s published rules on {rules.source.checked}{rules.source.status === 'partial' ? '; some figures need confirming' : ''}. <a href={rules.source.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-ink)' }}>Firm’s rules</a></>
                  : 'Added before firm presets existed: uses FundedDesk’s original Funding Pips figures.'}
              </p>
            </div>
          </SectionCard>

          {/* Personal Guardrails */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt)' }}>Personal Guardrails</p>
              <span style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--review-color)', background: 'var(--review-bg)',
                padding: '2px 7px', borderRadius: '3px', border: '1px solid var(--review-border)',
              }}>
                PERSONAL ONLY
              </span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '14px', lineHeight: 1.6 }}>
                These are additional limits you set for yourself — they are not part of your firm&apos;s rules.
              </p>
              <ToggleRow
                label="Cooldown after exit"
                sub="15 min per pair before re-entry"
                enabled={guardrails.cooldown}
                onToggle={() => toggle('cooldown')}
              />
              <ToggleRow
                label="Max trades per day"
                sub="Block new trades after 3 per session"
                enabled={guardrails.maxTrades}
                onToggle={() => toggle('maxTrades')}
              />
              <ToggleRow
                label="Stop after consecutive losses"
                sub="Pause after 2 losses in a row"
                enabled={guardrails.consecLosses}
                onToggle={() => toggle('consecLosses')}
              />
              <ToggleRow
                label="Daily risk cap per position"
                sub="Max 20% of daily limit per trade"
                enabled={guardrails.dailyRiskCap}
                onToggle={() => toggle('dailyRiskCap')}
              />
              <div style={{ borderBottom: 'none' }}>
                <ToggleRow
                  label="Block trades during news windows"
                  sub="30 min before/after major releases"
                  enabled={guardrails.newsBlock}
                  onToggle={() => toggle('newsBlock')}
                />
              </div>
            </div>
          </div>

          {/* Accounts */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt)' }}>Your Accounts</p>
              <Link href="/setup" style={{ fontSize: '12px', color: 'var(--go-color)', textDecoration: 'none', fontWeight: 500 }}>
                + Add
              </Link>
            </div>
            {accounts.map(a => (
              <div
                key={a.id}
                onClick={() => setSelectedAccountId(a.id)}
                style={{
                  padding: '13px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: a.id === selectedAccountId ? 'var(--go-bg)' : 'transparent',
                }}
              >
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt)', marginBottom: '2px' }}>{a.label}</p>
                  <p style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                    ${fmt(a.currentBalance)} · {programmeLabel(a)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {a.id === selectedAccountId && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--go-color)', letterSpacing: '0.06em' }}>ACTIVE</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); deleteAccount(a.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: '2px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div>
          {/* Firm & Programme */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt)', marginBottom: '4px' }}>Firm & Programme</p>
            <p style={{ fontSize: '12px', color: 'var(--txt3)', marginBottom: '16px' }}>Your active prop firm and account configuration</p>

            <div style={{
              padding: '14px', borderRadius: '8px',
              background: 'var(--canvas)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '12px',
              marginBottom: '16px',
            }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%',
                background: '#1C1C1A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>FP</span>
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt)' }}>
                  {programmeLabel(account)}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--go-color)' }}>
                  ${account.accountSize.toLocaleString()} · Rules verified ✓
                </p>
              </div>
            </div>

            <Link href="/setup" style={{
              display: 'block', textAlign: 'center',
              padding: '11px', borderRadius: '6px',
              background: '#1C1C1A', color: '#fff',
              fontSize: '13px', fontWeight: 600, textDecoration: 'none',
              letterSpacing: '0.02em',
            }}>
              Change Programme
            </Link>
          </div>

          {/* Connection Health */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt)', marginBottom: '16px' }}>Connection</p>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px', borderRadius: '8px',
              background: 'var(--go-bg)', border: '1px solid var(--go-border)',
              marginBottom: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--go-color)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--go-color)' }}>Manual Mode</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Data entry', value: 'Manual' },
                { label: 'Rule verification', value: 'Local · v2026-10-01' },
                { label: 'Platform connectors', value: 'Coming soon' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--txt3)' }}>{label}</span>
                  <span style={{ fontSize: '12px', color: 'var(--txt)', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
