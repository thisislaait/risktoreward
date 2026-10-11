'use client';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { Field, TradeButton } from '@/components/fd';

function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/trade';
}

export default function VerifyPage() {
  const supabase = getSupabase();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const factors = await supabase.auth.mfa.listFactors();
    const factor = factors.data?.totp.find(f => f.status === 'verified');
    if (!factor) {
      setBusy(false);
      setError('No authenticator is set up on this account.');
      return;
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      setBusy(false);
      setError('That code didn’t work. Codes change every 30 seconds; try the current one.');
      return;
    }
    window.location.assign(nextPath());
  }

  async function signOut() {
    await supabase?.auth.signOut();
    // A full reload so the data store and the proxy start fresh with the new session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/login');
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <div className="auth__brand">FundedDesk</div>
        <h1>Enter your code</h1>
        <p>Open your authenticator app and enter the 6-digit code for FundedDesk.</p>
        <Field id="code" label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
        {error && <p className="auth__error" role="alert">{error}</p>}
        <TradeButton type="submit" variant="primary" block disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : 'Continue'}
        </TradeButton>
        <button type="button" className="auth__link" onClick={signOut}>Sign out</button>
      </form>
    </div>
  );
}
