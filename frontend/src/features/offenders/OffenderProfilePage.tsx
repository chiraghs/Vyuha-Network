import {
  ArrowLeft,
  Crosshair,
  FileText,
  Gavel,
  MapPin,
  Printer,
  Scale,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnalyticsAPI } from '../../api/endpoints';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { CenteredLoader, ErrorState } from '../../components/ui/states';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { stableColorVar } from '../../lib/categories';
import { formatDate, formatDateTime } from '../../lib/format';
import { mugshotDataUri } from '../../lib/mugshot';
import { RISK_LABEL, riskColorVar, riskLevel } from '../../lib/risk';
import { titleCase } from '../../lib/format';
import type { BadgeTone } from '../../components/ui/Badge';
import type { RiskLevel } from '../../lib/risk';

const RISK_TONE: Record<RiskLevel, BadgeTone> = {
  low: 'good',
  moderate: 'warning',
  elevated: 'serious',
  critical: 'critical',
};

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <div className="dossier__fact-label">{label}</div>
      <div className="dossier__fact-value">{value}</div>
    </div>
  );
}

export function OffenderProfilePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const profileState = useApi(() => AnalyticsAPI.criminalProfile(id), [id]);

  const dossier = profileState.data;
  const stats = dossier?.stats;
  const level = dossier ? riskLevel(dossier.risk_score) : null;
  const photo = useMemo(
    () => (dossier ? mugshotDataUri(dossier.id, dossier.fingerprint_hash ?? undefined) : ''),
    [dossier],
  );

  if (profileState.loading) {
    return (
      <main className="page">
        <CenteredLoader label="Retrieving classified dossier…" />
      </main>
    );
  }
  if (profileState.error || !dossier || !stats) {
    return (
      <main className="page">
        <div className="card">
          <ErrorState message={profileState.error ?? 'Dossier not found.'} onRetry={profileState.refetch} />
        </div>
      </main>
    );
  }

  const maxHead = Math.max(1, ...stats.top_crime_heads.map((h) => h.count));

  return (
    <main className="page fade-in">
      <div className="dossier">
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <button className="btn btn--ghost" onClick={() => navigate('/offenders')}>
            <ArrowLeft size={15} />
            Registry
          </button>
          <button className="btn btn--primary" onClick={() => window.print()}>
            <Printer size={15} />
            Print dossier
          </button>
        </div>

        <div className="dossier__classification">
          <span>Confidential // KSP–SCRB // Authorized personnel only</span>
          <span>Dossier {dossier.fingerprint_hash}</span>
        </div>

        <section className="card dossier__header">
          <img className="dossier__photo" src={photo} alt={`Booking photograph of ${dossier.name}`} />
          <div>
            <h1 className="dossier__name">{dossier.name}</h1>
            <div className="dossier__alias">
              {dossier.alias ? `Alias “${dossier.alias}”` : 'No known alias'} · Fingerprint ref{' '}
              {dossier.fingerprint_hash}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <Badge tone={dossier.status === 'In Custody' ? 'neutral' : dossier.status === 'Absconding' ? 'critical' : 'accent'}>
                {titleCase(dossier.status)}
              </Badge>
              {level && <Badge tone={RISK_TONE[level]}>{RISK_LABEL[level]} risk · {Math.round(dossier.risk_score)}</Badge>}
              {dossier.crimes_count >= 8 && <Badge tone="serious">Prolific offender</Badge>}
              {stats.heinous_cases > 0 && <Badge tone="critical">{stats.heinous_cases} heinous</Badge>}
            </div>

            <div className="dossier__facts">
              <Fact label="Age" value={stats.age ? `${stats.age} yrs` : null} />
              <Fact label="Gender" value={stats.gender === 'F' ? 'Female' : stats.gender === 'T' ? 'Transgender' : 'Male'} />
              <Fact label="Registered cases" value={dossier.crimes_count} />
              <Fact label="Active districts" value={stats.districts.length} />
              <Fact label="First on record" value={stats.first_seen ? formatDate(stats.first_seen) : null} />
              <Fact label="Latest case" value={stats.last_seen ? formatDate(stats.last_seen) : null} />
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <Card
            title={
              <span className="dossier__section-title">
                <ShieldAlert size={16} />
                Threat assessment
              </span>
            }
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-3)' }}>Recidivism risk score</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(dossier.risk_score)} / 100</b>
            </div>
            <div className="meter">
              <div
                className="meter__fill"
                style={{
                  width: `${Math.min(100, Math.max(2, dossier.risk_score))}%`,
                  background: level ? riskColorVar(level) : 'var(--accent)',
                }}
              />
            </div>
            <div className="dossier__facts" style={{ marginTop: 14 }}>
              <Fact label="Arrests" value={stats.arrests} />
              <Fact label="Chargesheeted" value={stats.chargesheeted} />
              <Fact label="Heinous cases" value={stats.heinous_cases} />
              <Fact label="Linked cases" value={dossier.crimes_count} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.5 }}>
              Score derived from case volume, offence gravity and arrest history —
              not a stored value.
            </div>
          </Card>

          <Card
            title={
              <span className="dossier__section-title">
                <Crosshair size={16} />
                Crime pattern
              </span>
            }
          >
            <div className="dossier__fact-label" style={{ marginBottom: 8 }}>
              Crime heads
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {stats.top_crime_heads.map((h) => (
                <div key={h.head} className="rank-item">
                  <span className="rank-item__name">{h.head}</span>
                  <span className="rank-item__value">{h.count}</span>
                  <span className="rank-item__bar">
                    <span
                      className="rank-item__bar-fill"
                      style={{ width: `${(h.count / maxHead) * 100}%`, background: stableColorVar(h.head) }}
                    />
                  </span>
                </div>
              ))}
            </div>

            {stats.acts_faced.length > 0 && (
              <>
                <div className="dossier__fact-label" style={{ marginTop: 14, marginBottom: 8 }}>
                  Acts booked under
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {stats.acts_faced.map((act) => (
                    <span key={act} className="dossier__mark-chip">
                      <Scale size={12} />
                      {act}
                    </span>
                  ))}
                </div>
              </>
            )}

            {stats.districts.length > 0 && (
              <>
                <div className="dossier__fact-label" style={{ marginTop: 14, marginBottom: 4 }}>
                  Operating districts
                </div>
                <div style={{ display: 'flex', gap: 6, fontSize: 13, color: 'var(--text-1)', flexWrap: 'wrap' }}>
                  <MapPin size={14} style={{ flex: 'none', marginTop: 2, color: 'var(--text-3)' }} />
                  {stats.districts.join(', ')}
                </div>
              </>
            )}
          </Card>
        </div>

        <Card
          title={
            <span className="dossier__section-title">
              <FileText size={16} />
              Case history ({dossier.crimes.length})
            </span>
          }
          flush
        >
          {dossier.crimes.length === 0 ? (
            <p style={{ padding: '4px 18px 16px', fontSize: 13, color: 'var(--text-3)' }}>No cases on file.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Crime No.</th>
                    <th>Sub-head</th>
                    <th>Gravity</th>
                    <th>Date</th>
                    <th>Station</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.crimes.map((crime) => (
                    <tr key={crime.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{crime.FIR_number}</td>
                      <td>
                        <Badge tone="neutral" dotColor={stableColorVar(crime.crime_category)}>
                          {crime.crime_category}
                        </Badge>
                      </td>
                      <td>
                        {crime.gravity === 'Heinous' ? (
                          <Badge tone="critical">Heinous</Badge>
                        ) : (
                          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Non-heinous</span>
                        )}
                      </td>
                      <td>{formatDate(crime.occurrence_time)}</td>
                      <td>
                        {crime.station_name}
                        <span style={{ color: 'var(--text-3)' }}> · {crime.district_name}</span>
                      </td>
                      <td>{crime.role ?? '—'}</td>
                      <td>
                        <Badge tone={crime.status === 'Disposed' ? 'good' : crime.status === 'Under Investigation' ? 'warning' : 'neutral'}>
                          {crime.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title={
            <span className="dossier__section-title">
              <Share2 size={16} />
              Known associates ({dossier.associates.length})
            </span>
          }
        >
          {dossier.associates.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No co-accused links on file.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {dossier.associates.map((associate) => {
                const assocLevel = riskLevel(associate.risk_score);
                return (
                  <Link
                    key={associate.id}
                    to={`/offenders/${associate.id}`}
                    className="photo-match"
                    style={{ textDecoration: 'none' }}
                  >
                    <img
                      src={mugshotDataUri(associate.id)}
                      alt=""
                      style={{ width: 40, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-strong)' }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{associate.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                        {titleCase(associate.relationship_type)} · tie {(associate.strength * 100).toFixed(0)}%
                      </div>
                    </div>
                    <Badge tone={RISK_TONE[assocLevel]}>{Math.round(associate.risk_score)}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <div className="dossier__footer">
          <span>
            <Gavel size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            Generated {formatDateTime(new Date().toISOString())} · accessed by {user?.username ?? 'unknown'} ·
            identity-resolved from accused records · synthetic photograph
          </span>
          <span>KSP–SCRB / VYUHA</span>
        </div>
      </div>
    </main>
  );
}
