'use client';
import { useState, useSyncExternalStore } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { Field, Segmented, TradeButton } from '@/components/fd';

/** Only same-site paths are allowed as a post-login destination. */
function nextPath(): string {
  if (typeof window === 'undefined') return '/trade';
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/trade';
}

const noSubscribe = () => () => {};

export default function LoginPage() {
  const supabase = getSupabase();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // Read the query string after hydration so server and browser render the same markup.
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => '');
  const linkExpired = new URLSearchParams(search).get('error') === 'link';
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!supabase) {
    return (
      <div className="auth">
        <div className="auth__card">
          <h1>Sign-in isn’t set up</h1>
          <p>FundedDesk is running in local mode, so your data stays in this browser. Add your Supabase keys to <code>.env.local</code> to turn on accounts.</p>
          <a href="/trade" className="fd-btn fd-btn--primary fd-btn--md" style={{ textDecoration: 'none' }}>Continue in local mode</a>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(false);
        setError(error.message === 'Invalid login credentials' ? 'That email and password don’t match an account.' : error.message);
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const next = nextPath();
      window.location.assign(aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2'
        ? `/login/verify?next=${encodeURIComponent(next)}`
        : next);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/security` },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      // A full reload so the data store and the proxy start fresh with the new session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/security');
      return;
    }
    setNotice(`Check ${email} for a confirmation link. It signs you in and takes you to set up two-factor authentication.`);
  }

  async function resetPassword() {
    if (!supabase) return;
    if (!email) {
      setError('Enter your email first, then choose Forgot password.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/security`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setNotice(`If ${email} has an account, a reset link is on its way.`);
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <div className="auth__brand">FundedDesk</div>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
        <p>{mode === 'signin'
          ? 'Your prop accounts, positions and limits, on any device.'
          : 'One account for all your prop firm accounts. You’ll set up two-factor authentication next.'}</p>

        <Segmented variant="track" label="Sign in or create account" value={mode}
          onChange={v => { setMode(v as 'signin' | 'signup'); setError(null); setNotice(null); }}
          options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]} />

        <Field id="email" label="Email" type="email" inputMode="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)} />
        <Field id="password" label="Password" type="password" required minLength={mode === 'signup' ? 10 : undefined}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          hint={mode === 'signup' ? 'At least 10 characters.' : undefined}
          value={password} onChange={e => setPassword(e.target.value)} />

        {(error || linkExpired) && (
          <p className="auth__error" role="alert">{error ?? 'That link has expired or was already used. Sign in, or request a new one.'}</p>
        )}
        {notice && <p className="auth__notice" role="status">{notice}</p>}

        <TradeButton type="submit" variant="primary" block disabled={busy}>
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </TradeButton>
        {mode === 'signin' && (
          <button type="button" className="auth__link" onClick={resetPassword} disabled={busy}>Forgot password</button>
        )}
      </form>
    </div>
  );
}
