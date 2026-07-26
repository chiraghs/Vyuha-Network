import { AlertTriangle, Lock, Shield, User as UserIcon } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/states';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="card login-card fade-in" onSubmit={handleSubmit}>
        <div>
          <div className="login-card__mark">
            <Shield size={22} />
          </div>
          <h1 className="login-card__title" style={{ marginTop: 14 }}>
            Vyuha Network
          </h1>
          <p className="login-card__subtitle">
            State Crime Records Bureau — AI crime analytics &amp; decision suite
          </p>
        </div>

        {error && (
          <div className="alert-banner alert-banner--error" role="alert">
            <AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="login-username">
            Investigator username
          </label>
          <div className="input-wrap">
            <UserIcon size={14} />
            <input
              id="login-username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. officer"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-password">
            Secure password
          </label>
          <div className="input-wrap">
            <Lock size={14} />
            <input
              id="login-password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <button className="btn btn--primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? <Spinner /> : 'Sign in'}
        </button>

        <p className="login-card__footnote">
          Authorized personnel only. All access, queries and exports are audited and
          cryptographically registered under SCRB policy.
        </p>
      </form>
    </div>
  );
}
