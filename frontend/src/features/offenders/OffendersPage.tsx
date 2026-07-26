import { ScanFace, TrendingUp, UserCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnalyticsAPI } from '../../api/endpoints';
import { mugshotDataUri } from '../../lib/mugshot';
import { PhotoSearch } from './PhotoSearch';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { StatTile } from '../../components/ui/StatTile';
import { SearchField } from '../../components/ui/fields';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { useApi } from '../../hooks/useApi';
import { useI18n } from '../../context/LanguageContext';
import { useDebounce } from '../../hooks/useDebounce';
import { RISK_LABEL, riskColorVar, riskLevel } from '../../lib/risk';
import { formatNumber, titleCase } from '../../lib/format';
import type { BadgeTone } from '../../components/ui/Badge';
import type { Criminal } from '../../types';
import type { RiskLevel } from '../../lib/risk';

const PAGE_SIZE = 25;

const RISK_TONE: Record<RiskLevel, BadgeTone> = {
  low: 'good',
  moderate: 'warning',
  elevated: 'serious',
  critical: 'critical',
};

export function OffendersPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [photoSearchOpen, setPhotoSearchOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 350);

  // Reset to page 1 whenever the search term changes.
  useEffect(() => setPage(1), [debouncedSearch]);

  const statsState = useApi(() => AnalyticsAPI.offenderStats(), []);
  const listState = useApi(
    () => AnalyticsAPI.criminals(debouncedSearch || undefined, page, PAGE_SIZE),
    [debouncedSearch, page],
  );

  const stats = statsState.data;
  const list = listState.data;
  const rows: Criminal[] = list?.items ?? [];

  // Photo search enrolls the current page's offenders (bounded fetch).
  const [photoPool, setPhotoPool] = useState<Criminal[]>([]);
  useEffect(() => {
    if (rows.length) setPhotoPool(rows);
  }, [rows]);

  return (
    <main className="page fade-in">
      <div className="page__grid">
        <div className="kpi-grid">
          <StatTile
            label={t("off.tracked")}
            icon={<Users size={14} />}
            value={stats ? formatNumber(stats.total) : '—'}
            hint={t("off.tracked.hint")}
            provenance={{ label: 'Live · FIR DB', tone: 'live' }}
            loading={statsState.loading}
          />
          <StatTile
            label={t("off.repeat")}
            icon={<UserCheck size={14} />}
            value={stats ? formatNumber(stats.repeat) : '—'}
            hint={t("off.repeat.hint")}
            accentColor="var(--status-serious)"
            provenance={{ label: 'Computed', tone: 'computed' }}
            loading={statsState.loading}
          />
          <StatTile
            label={t("off.prolific")}
            icon={<TrendingUp size={14} />}
            value={stats ? formatNumber(stats.prolific) : '—'}
            hint={t("off.prolific.hint")}
            accentColor="var(--status-critical)"
            provenance={{ label: 'Computed', tone: 'computed' }}
            loading={statsState.loading}
          />
          <StatTile
            label={t("off.mostActive")}
            value={stats ? `${stats.max_cases} cases` : '—'}
            hint={stats ? `Avg ${stats.avg_cases} cases / offender` : undefined}
            provenance={{ label: 'Computed', tone: 'computed' }}
            loading={statsState.loading}
          />
        </div>

        {photoSearchOpen && (
          <PhotoSearch criminals={photoPool} onClose={() => setPhotoSearchOpen(false)} />
        )}

        <Card
          title={t("off.registry.title")}
          subtitle={t("off.registry.subtitle")}
          flush
          actions={
            <>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => setPhotoSearchOpen((open) => !open)}
                aria-pressed={photoSearchOpen}
              >
                <ScanFace size={14} />{t("off.searchPhoto")}</button>
              <div style={{ minWidth: 240 }}>
                <SearchField value={search} onChange={setSearch} placeholder={t("off.searchPlaceholder")} />
              </div>
            </>
          }
        >
          {listState.error ? (
            <ErrorState message={listState.error} onRetry={listState.refetch} />
          ) : listState.loading ? (
            <div style={{ padding: 18, display: 'grid', gap: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No offenders found"
              message={search ? `No records match “${search}”.` : 'The registry is empty.'}
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("off.col.offender")}</th>
                      <th>{t("off.col.status")}</th>
                      <th className="num">{t("off.col.cases")}</th>
                      <th>{t("off.col.risk")}</th>
                      <th>{t("off.col.band")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((criminal) => {
                      const level = riskLevel(criminal.risk_score);
                      return (
                        <tr
                          key={criminal.id}
                          className="is-clickable"
                          onClick={() => navigate(`/offenders/${criminal.id}`)}
                          title={`Open dossier for ${criminal.name}`}
                        >
                          <td>
                            <div className="offender-cell">
                              <img className="offender-photo" src={mugshotDataUri(criminal.id)} alt="" />
                              <div>
                                <div style={{ fontWeight: 550 }}>{criminal.name}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                                  {criminal.alias ? `“${criminal.alias}”` : 'No alias'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge tone="neutral">{titleCase(criminal.status)}</Badge>
                          </td>
                          <td className="num">
                            {criminal.crimes_count}
                            {criminal.crimes_count >= 2 && (
                              <span style={{ color: 'var(--status-serious)', marginLeft: 6, fontSize: 11 }}>
                                repeat
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="risk-cell">
                              <div className="meter">
                                <div
                                  className="meter__fill"
                                  style={{
                                    width: `${Math.min(100, Math.max(2, criminal.risk_score))}%`,
                                    background: riskColorVar(level),
                                  }}
                                />
                              </div>
                              <span className="risk-cell__score">{Math.round(criminal.risk_score)}</span>
                            </div>
                          </td>
                          <td>
                            <Badge tone={RISK_TONE[level]}>{RISK_LABEL[level]}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {list && (
                <Pagination
                  page={list.page}
                  pages={list.pages}
                  total={list.total}
                  pageSize={list.page_size}
                  onPage={setPage}
                  label="offenders"
                />
              )}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
