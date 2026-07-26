import {
  Activity,
  ArrowLeft,
  Check,
  Cpu,
  Download,
  Gauge,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  ScrollText,
  Settings2,
  Terminal,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AdminAPI } from '../../api/endpoints';
import type { AdminConfigKey, AdminLogLine, AdminMetrics } from '../../api/endpoints';
import { extractErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Spinner } from '../../components/ui/states';

type Tab = 'env' | 'logs' | 'metrics';

export function AdminConsole() {
  const { user, initializing, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (initializing) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <Spinner large />
      </div>
    );
  }

  if (!user) return <DevLogin onLogin={login} theme={theme} />;

  if (user.role !== 'admin') {
    return (
      <div className="admin-shell" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="card" style={{ padding: 28, textAlign: 'center', maxWidth: 380 }}>
          <Lock size={26} style={{ color: 'var(--status-critical)' }} />
          <h2 style={{ marginTop: 10 }}>Admin access required</h2>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 6 }}>
            You are signed in as <b>{user.username}</b> ({user.role}). The developer console
            requires the <b>admin</b> role.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn--secondary btn--sm" onClick={logout}>
              <LogOut size={13} /> Sign out
            </button>
            <Link to="/" className="btn btn--primary btn--sm">
              Back to app
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <Console username={user.username} onLogout={logout} theme={theme} toggleTheme={toggleTheme} />;
}

/* ------------------------------- Dev login -------------------------------- */
function DevLogin({
  onLogin,
  theme,
}: {
  onLogin: (u: string, p: string) => Promise<void>;
  theme: string;
}) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-shell" data-theme={theme} style={{ display: 'grid', placeItems: 'center' }}>
      <form className="card" style={{ width: 'min(380px, 92%)', padding: 30 }} onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 40,
              height: 40,
              borderRadius: 11,
              background: '#0b0b0b',
              color: '#fff',
            }}
          >
            <Terminal size={20} />
          </span>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Developer Console</h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Vyuha Network · admin only</p>
          </div>
        </div>

        {error && (
          <div className="alert-banner alert-banner--error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        <div className="field" style={{ marginTop: 16 }}>
          <label className="field__label">Username</label>
          <div className="input-wrap">
            <UserIcon size={14} />
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label className="field__label">Password</label>
          <div className="input-wrap">
            <Lock size={14} />
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
        <button className="btn btn--primary" style={{ width: '100%', marginTop: 18 }} disabled={busy}>
          {busy ? <Spinner /> : 'Enter console'}
        </button>
        <Link
          to="/"
          className="btn btn--ghost btn--sm"
          style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
        >
          <ArrowLeft size={13} /> Back to application
        </Link>
      </form>
    </div>
  );
}

/* --------------------------------- Console -------------------------------- */
function Console({
  username,
  onLogout,
  theme,
  toggleTheme,
}: {
  username: string;
  onLogout: () => void;
  theme: string;
  toggleTheme: () => void;
}) {
  const [tab, setTab] = useState<Tab>('metrics');

  return (
    <div className="admin-shell" data-theme={theme}>
      <header className="admin-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Terminal size={18} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Developer Console</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>signed in as {username}</div>
          </div>
        </div>
        <div className="segmented" role="tablist">
          {(
            [
              ['metrics', 'Metrics', <Gauge size={13} key="g" />],
              ['env', 'Environment', <Settings2 size={13} key="s" />],
              ['logs', 'Logs', <ScrollText size={13} key="l" />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              className="segmented__option"
              aria-pressed={tab === id}
              onClick={() => setTab(id as Tab)}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/" className="btn btn--ghost btn--sm">
            <ArrowLeft size={13} /> App
          </Link>
          <button className="btn btn--ghost btn--icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button className="btn btn--secondary btn--sm" onClick={onLogout}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      <div className="admin-body">
        {tab === 'metrics' && <MetricsPanel />}
        {tab === 'env' && <EnvPanel />}
        {tab === 'logs' && <LogsPanel />}
      </div>
    </div>
  );
}

/* ------------------------------ Metrics panel ----------------------------- */
function fmtUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function MetricsPanel() {
  const [data, setData] = useState<AdminMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);

  const load = useCallback(() => {
    AdminAPI.metrics()
      .then((d) => {
        setData(d);
        setErr(null);
      })
      .catch((e) => setErr(extractErrorMessage(e, 'Failed to load metrics.')));
  }, []);

  useEffect(() => {
    load();
    if (!auto) return;
    const id = window.setInterval(load, 3000);
    return () => window.clearInterval(id);
  }, [load, auto]);

  if (err) return <div className="alert-banner alert-banner--error">{err}</div>;
  if (!data) return <Spinner large />;

  const aiTotal = data.ai.calls || 1;
  const statusEntries = Object.entries(data.by_status).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn--ghost btn--sm" onClick={() => setAuto((a) => !a)}>
          <RefreshCw size={13} className={auto ? 'spin-slow' : ''} />
          {auto ? 'Auto-refresh on' : 'Auto-refresh off'}
        </button>
      </div>

      <div className="admin-kpis">
        <AdminStat icon={<Activity size={14} />} label="API requests" value={data.request_count} hint={`uptime ${fmtUptime(data.uptime_s)}`} />
        <AdminStat
          icon={<Cpu size={14} />}
          label="AI calls (real)"
          value={data.ai.real}
          hint={data.ai_configured ? `${data.ai.provider ?? ''} · ${data.ai.model ?? ''}` : 'not configured — using mock'}
          tone={data.ai_configured ? 'good' : 'warn'}
        />
        <AdminStat
          icon={<Cpu size={14} />}
          label="AI fallbacks"
          value={data.ai.fallback}
          hint={data.ai.last_latency_ms ? `last ${data.ai.last_latency_ms} ms` : undefined}
          tone={data.ai.fallback > 0 ? 'warn' : undefined}
        />
        <AdminStat
          icon={<KeyRound size={14} />}
          label="OCR calls"
          value={data.ocr.calls}
          hint={data.ocr_configured ? `${data.ocr.success} ok · ${data.ocr.fallback} fail` : 'not configured'}
          tone={data.ocr_configured ? undefined : 'warn'}
        />
      </div>

      {data.ai.last_error && (
        <div className="alert-banner alert-banner--error" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          Last AI error: {data.ai.last_error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="admin-h">Response status</div>
          {statusEntries.map(([code, n]) => (
            <div key={code} className="admin-row">
              <span className={`badge badge--${code.startsWith('2') ? 'good' : code.startsWith('4') ? 'warning' : 'critical'}`}>
                {code}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
            </div>
          ))}
          <div className="admin-h" style={{ marginTop: 14 }}>AI real vs fallback</div>
          <div className="meter" style={{ height: 8 }}>
            <div
              className="meter__fill"
              style={{ width: `${(data.ai.real / aiTotal) * 100}%`, background: 'var(--status-good)' }}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            {data.ai.real} real · {data.ai.fallback} fallback
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="admin-h">Top routes</div>
          {data.top_routes.map(([route, n]) => (
            <div key={route} className="admin-row">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {route}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="admin-h" style={{ padding: '14px 16px 0' }}>Recent calls</div>
        <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Route</th>
                <th className="num">Status</th>
                <th className="num">ms</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.method}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{r.route}</td>
                  <td className="num">
                    <span className={`badge badge--${r.status < 300 ? 'good' : r.status < 500 ? 'warning' : 'critical'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="num">{r.ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminStat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'good' | 'warn';
}) {
  const color = tone === 'good' ? 'var(--status-good)' : tone === 'warn' ? 'var(--status-warning)' : undefined;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-2)' }}>
        {icon}
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, marginTop: 6, color }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/* -------------------------------- Env panel ------------------------------- */
function EnvPanel() {
  const [known, setKnown] = useState<AdminConfigKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [custKey, setCustKey] = useState('');
  const [custVal, setCustVal] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    AdminAPI.config()
      .then((d) => setKnown(d.known))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  const exportEnv = async () => {
    const text = await AdminAPI.exportConfig();
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vyuha.env';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importEnv = async (file: File) => {
    const content = await file.text();
    const res = await AdminAPI.importConfig(content);
    setImportMsg(
      `Imported ${res.count} variable${res.count === 1 ? '' : 's'}` +
        (res.needs_restart.length ? ` · restart needed for ${res.needs_restart.join(', ')}` : ''),
    );
    setTimeout(() => setImportMsg(null), 6000);
    load();
  };

  const save = async (key: string, value: string) => {
    const res = await AdminAPI.setConfig(key, value);
    setSaved((s) => ({ ...s, [key]: res.message ?? 'Saved' }));
    setEdits((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });
    setTimeout(() => setSaved((s) => { const n = { ...s }; delete n[key]; return n; }), 4000);
    load();
  };

  const addCustom = async (e: FormEvent) => {
    e.preventDefault();
    if (!custKey.trim()) return;
    await AdminAPI.setConfig(custKey.trim(), custVal);
    setCustKey('');
    setCustVal('');
    load();
  };

  if (loading) return <Spinner large />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn--secondary btn--sm" onClick={() => void exportEnv()}>
          <Download size={13} /> Export .env
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".env,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importEnv(f);
            e.target.value = '';
          }}
        />
        <button className="btn btn--secondary btn--sm" onClick={() => importRef.current?.click()}>
          <Upload size={13} /> Import .env
        </button>
        {importMsg && (
          <span style={{ fontSize: 12, color: 'var(--status-good)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <Check size={12} /> {importMsg}
          </span>
        )}
      </div>

      <div className="alert-banner alert-banner--info">
        Runtime configuration for <b>this instance</b>. Most keys (AI, OCR, mock toggle) take effect on
        the next request; <code>DATABASE_URL</code> needs a restart. Values reset on redeploy — for
        permanent config use the Catalyst console. <b>Export</b> saves the current values to a file;
        <b> Import</b> applies a saved <code>.env</code>.
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {known.map((k) => (
                <tr key={k.key}>
                  <td>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600 }}>{k.key}</div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                      {k.secret && <span className="badge badge--neutral">secret</span>}
                      {k.needs_restart && <span className="badge badge--warning">restart</span>}
                      {!k.set && <span className="badge badge--neutral">unset</span>}
                    </div>
                  </td>
                  <td style={{ minWidth: 260 }}>
                    <input
                      className="input"
                      value={edits[k.key] ?? ''}
                      placeholder={k.set ? (k.value ?? '') : 'not set'}
                      onChange={(e) => setEdits((s) => ({ ...s, [k.key]: e.target.value }))}
                    />
                    {saved[k.key] && (
                      <div style={{ fontSize: 11, color: 'var(--status-good)', marginTop: 3, display: 'flex', gap: 4 }}>
                        <Check size={12} /> {saved[k.key]}
                      </div>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn--primary btn--sm"
                      disabled={edits[k.key] === undefined || edits[k.key] === ''}
                      onClick={() => save(k.key, edits[k.key])}
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form className="card" style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }} onSubmit={addCustom}>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label className="field__label">Custom key</label>
          <input className="input" value={custKey} onChange={(e) => setCustKey(e.target.value)} placeholder="MY_ENV_VAR" />
        </div>
        <div className="field" style={{ flex: 2, minWidth: 220 }}>
          <label className="field__label">Value</label>
          <input className="input" value={custVal} onChange={(e) => setCustVal(e.target.value)} />
        </div>
        <button className="btn btn--secondary">Set variable</button>
      </form>
    </div>
  );
}

/* -------------------------------- Logs panel ------------------------------ */
function LogsPanel() {
  const [logs, setLogs] = useState<AdminLogLine[]>([]);
  const [auto, setAuto] = useState(true);
  const [filter, setFilter] = useState('');
  const preRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    AdminAPI.logs(300).then((d) => setLogs(d.logs)).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    if (!auto) return;
    const id = window.setInterval(load, 2500);
    return () => window.clearInterval(id);
  }, [load, auto]);

  useEffect(() => {
    if (auto && preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [logs, auto]);

  const shown = filter ? logs.filter((l) => l.line.toLowerCase().includes(filter.toLowerCase())) : logs;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Filter logs…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div style={{ flex: 1 }} />
        <button className="btn btn--ghost btn--sm" onClick={() => setAuto((a) => !a)}>
          <RefreshCw size={13} className={auto ? 'spin-slow' : ''} />
          {auto ? 'Tailing' : 'Paused'}
        </button>
      </div>
      <div ref={preRef} className="admin-logs">
        {shown.map((l, i) => (
          <div key={i} className={`admin-log-line admin-log-line--${l.level}`}>
            {l.line}
          </div>
        ))}
        {shown.length === 0 && <div style={{ color: 'var(--text-3)' }}>No log lines.</div>}
      </div>
    </div>
  );
}
