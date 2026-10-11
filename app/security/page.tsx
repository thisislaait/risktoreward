'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { Field, TradeButton } from '@/components/fd';

interface Enrolment { factorId: string; qr: string; secret: string }

export default function SecurityPage() {
  const supabase = getSupabase();
  const { userEmail } = useStore();
  const [verified, setVerified] = useState<{ id: string; createdAt: string } | null | undefined>(undefined);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordNote, setPasswordNote] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const f = data?.totp.find(x => x.status === 'verified');
      setVerified(f ? { id: f.id, createdAt: f.created_at } : null);
    });
  }, [supabase]);

  if (!supabase) {
    return (
      <div className="security">
        <h1>Security</h1>
        <p className="security__lead">Sign-in isn’t set up, so FundedDesk is in local mode and there’s nothing to secure yet.</p>
      </div>
    );
  }

  async function startEnrolment() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    // Clear any half-finished setup first so a fresh QR code can be issued.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `FundedDesk ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? 'Couldn’t start setup.');
      return;
    }
    setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnrolment(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !enrolment) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code });
    setBusy(false);
    if (error) {
      setError('That code didn’t work. Check the time on your phone is set automatically, then try the current code.');
      return;
    }
    setEnrolment(null);
    setCode('');
    setVerified({ id: enrolment.factorId, createdAt: new Date().toISOString() });
  }

  async function removeFactor() {
    if (!supabase || !verified) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    if (error) setError(error.message);
    else setVerified(null);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    setPasswordNote(error ? error.message : 'Password updated.');
    if (!error) setNewPassword('');
  }

  async function signOut() {
    await supabase?.auth.signOut();
    // A full reload so the data store and the proxy start fresh with the new session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/login');
  }

  return (
    <div className="security">
      <header>
        <h1>Security</h1>
        <p className="security__lead">Signed in as <b>{userEmail ?? '…'}</b></p>
      </header>

      <section className="security__section">
        <div className="section-head">
          <h2>Two-factor authentication</h2>
          <span className={verified ? 'fd-up' : 'fd-caution'}>{verified === undefined ? '' : verified ? 'On' : 'Off'}</span>
        </div>
        {verified ? (
          <>
            <p>Each sign-in asks for a code from your authenticator app. It will be required before FundedDesk can place orders on a real account.</p>
            <TradeButton variant="secondary" size="md" onClick={removeFactor} disabled={busy}>Turn off</TradeButton>
          </>
        ) : enrolment ? (
          <form className="security__enrol" onSubmit={confirmEnrolment}>
            {/* Supabase returns the QR code as an SVG data URI. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrolment.qr} alt="QR code to add FundedDesk to your authenticator app" width={176} height={176} />
            <div className="security__enrol-steps">
              <p>Scan this with an authenticator app such as Google Authenticator, 1Password or Authy, then enter the 6-digit code it shows.</p>
              <p className="fd-muted">Can’t scan? Enter this key instead: <code>{enrolment.secret}</code></p>
              <Field id="totp" label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
              <TradeButton type="submit" variant="primary" size="md" disabled={busy || code.length !== 6}>Turn on</TradeButton>
            </div>
          </form>
        ) : (
          <>
            <p>Protects your account if your password leaks. You’ll need it before FundedDesk places orders on a real account.</p>
            <TradeButton variant="primary" size="md" onClick={startEnrolment} disabled={busy || verified === undefined}>Set up</TradeButton>
          </>
        )}
        {error && <p className="auth__error" role="alert">{error}</p>}
      </section>

      <section className="security__section">
        <div className="section-head"><h2>Password</h2></div>
        <form className="security__row" onSubmit={changePassword}>
          <Field id="new-password" label="New password" type="password" autoComplete="new-password" minLength={10} required
            hint="At least 10 characters." value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <TradeButton type="submit" variant="secondary" size="md" disabled={busy}>Change password</TradeButton>
        </form>
        {passwordNote && <p className="fd-muted">{passwordNote}</p>}
      </section>

      <section className="security__section">
        <div className="section-head"><h2>Session</h2></div>
        <div className="security__row">
          <TradeButton variant="danger" size="md" onClick={signOut}>Sign out</TradeButton>
          <Link href="/trade" className="auth__link">Back to trading</Link>
        </div>
      </section>
    </div>
  );
}
