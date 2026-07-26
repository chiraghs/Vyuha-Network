import { Activity, FileText, MapPin, Share2, ShieldAlert, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { AnalyticsAPI, NetworkAPI } from '../../api/endpoints';
import { SeriesChip } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { CategoryBarChart } from '../../components/charts/CategoryBarChart';
import { DonutChart } from '../../components/charts/DonutChart';
import { TrendChart } from '../../components/charts/TrendChart';
import { useChartTokens } from '../../components/charts/chartTheme';
import { useApi } from '../../hooks/useApi';
import { resolveStableColor, stableColorVar } from '../../lib/categories';
import { formatNumber } from '../../lib/format';

/** Case-status colors: reserved status palette + neutral, never series hues. */
const STATUS_COLOR: Record<string, string> = {
  'Under Investigation': 'var(--status-serious)',
  'Pending Trial': 'var(--status-warning)',
  'Charge Sheeted': 'var(--accent)',
  Disposed: 'var(--status-good)',
  Closed: 'var(--text-3)',
};

const MAX_TREND_SERIES = 4;

function resolveVar(v: string): string {
  if (!v.startsWith('var(')) return v;
  return getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim();
}

export function DashboardPage() {
  const tokens = useChartTokens();
  const summaryState = useApi(() => AnalyticsAPI.summary(), []);
  const networkState = useApi(() => NetworkAPI.graph(), []);
  const summary = summaryState.data;

  // Category distribution (crime sub-heads), colored by fixed category slots
  // where they match, else by a sequential fallback.
  const categoryDist = useMemo(() => {
    if (!summary) return { labels: [] as string[], values: [] as number[], colors: [] as string[] };
    const entries = Object.entries(summary.by_category).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return {
      labels: entries.map(([k]) => k),
      values: entries.map(([, v]) => v),
      colors: entries.map(([k]) => resolveStableColor(k)),
    };
  }, [summary, tokens]);

  const statusDist = useMemo(() => {
    if (!summary) return { labels: [] as string[], values: [] as number[], colors: [] as string[] };
    const order = ['Under Investigation', 'Pending Trial', 'Charge Sheeted', 'Disposed', 'Closed'];
    const labels = Object.keys(summary.by_status).sort(
      (a, b) => order.indexOf(a) - order.indexOf(b),
    );
    return {
      labels,
      values: labels.map((s) => summary.by_status[s]),
      colors: labels.map((s) => resolveVar(STATUS_COLOR[s] ?? 'var(--text-3)')),
    };
  }, [summary, tokens]);

  const districtRanking = useMemo(() => {
    if (!summary) return [] as Array<[string, number]>;
    return Object.entries(summary.by_district).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [summary]);

  // Weekly trend for the top categories, aligned on a shared sorted week axis.
  const trend = useMemo(() => {
    if (!summary) return { labels: [] as string[], series: [] as Array<{ label: string; color: string; points: number[] }> };
    const cats = Object.entries(summary.trend)
      .map(([cat, weeks]) => [cat, Object.values(weeks).reduce((a, b) => a + b, 0)] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TREND_SERIES)
      .map(([cat]) => cat);
    const weekSet = new Set<string>();
    for (const cat of cats) Object.keys(summary.trend[cat] ?? {}).forEach((w) => weekSet.add(w));
    const weeks = [...weekSet].sort();
    return {
      labels: weeks.map((w) => {
        const [, wk] = w.split('-');
        return `W${wk}`;
      }),
      series: cats.map((cat) => ({
        label: cat,
        color: resolveStableColor(cat),
        points: weeks.map((w) => summary.trend[cat]?.[w] ?? 0),
      })),
    };
  }, [summary, tokens]);

  const gravity = summary?.by_gravity ?? {};
  const heinous = gravity['Heinous'] ?? 0;

  if (summaryState.error) {
    return (
      <main className="page">
        <div className="card">
          <ErrorState message={summaryState.error} onRetry={summaryState.refetch} />
        </div>
      </main>
    );
  }

  const loading = summaryState.loading;
  const metrics = networkState.data?.metrics;
  const maxDistrict = districtRanking[0]?.[1] ?? 1;

  return (
    <main className="page fade-in">
      <div className="page__grid">
        <div className="kpi-grid">
          <StatTile
            label="Registered cases"
            icon={<FileText size={14} />}
            value={loading ? '—' : formatNumber(summary!.total)}
            hint="FIRs in the analytics window"
            provenance={{ label: 'Live · FIR DB', tone: 'live' }}
            loading={loading}
          />
          <StatTile
            label="Active investigations"
            icon={<Activity size={14} />}
            value={loading ? '—' : formatNumber(summary!.active)}
            hint="Under investigation or pending trial"
            accentColor="var(--status-warning)"
            provenance={{ label: 'Live · FIR DB', tone: 'live' }}
            loading={loading}
          />
          <StatTile
            label="Heinous offences"
            icon={<ShieldAlert size={14} />}
            value={loading ? '—' : formatNumber(heinous)}
            hint="Gravity classified Heinous"
            accentColor="var(--status-critical)"
            provenance={{ label: 'Computed', tone: 'computed' }}
            loading={loading}
          />
          <StatTile
            label="Districts reporting"
            icon={<MapPin size={14} />}
            value={loading ? '—' : formatNumber(summary!.districts_reporting)}
            hint="With registered incidents"
            provenance={{ label: 'Computed', tone: 'computed' }}
            loading={loading}
          />
          <StatTile
            label="Network hubs"
            icon={<Share2 size={14} />}
            value={metrics ? formatNumber(metrics.active_hubs) : '—'}
            hint={metrics ? `${formatNumber(metrics.total_criminals)} tracked offenders` : 'Loading network…'}
            accentColor="var(--status-serious)"
            provenance={{ label: 'Inferred', tone: 'synthetic' }}
            loading={networkState.loading}
          />
        </div>

        <div className="dash-grid">
          <div className="dash-grid__col">
            <Card
              title="Incident trend"
              subtitle={`Weekly registered cases, top ${trend.series.length || '—'} sub-heads · last 12 weeks`}
              flush
            >
              {loading ? (
                <div style={{ padding: 18 }}>
                  <Skeleton height={240} />
                </div>
              ) : trend.series.length === 0 ? (
                <EmptyState title="No recent incidents" icon={<TrendingUp size={28} />} />
              ) : (
                <>
                  <div className="legend-row" style={{ paddingTop: 12 }}>
                    {trend.series.map((s) => (
                      <SeriesChip key={s.label} color={s.color} label={s.label} />
                    ))}
                  </div>
                  <div className="chart-box" style={{ padding: '0 18px 16px' }}>
                    <TrendChart labels={trend.labels} series={trend.series} />
                  </div>
                </>
              )}
            </Card>

            <Card title="Crime sub-head distribution" subtitle="Registered cases by classification" flush>
              {loading ? (
                <div style={{ padding: 18 }}>
                  <Skeleton height={260} />
                </div>
              ) : (
                <div className="chart-box chart-box--tall" style={{ padding: '10px 18px 16px' }}>
                  <CategoryBarChart
                    labels={categoryDist.labels}
                    values={categoryDist.values}
                    colors={categoryDist.colors}
                  />
                </div>
              )}
            </Card>
          </div>

          <div className="dash-grid__col">
            <Card title="Gravity split" subtitle="Heinous vs non-heinous offences" flush>
              {loading ? (
                <div style={{ padding: 18 }}>
                  <Skeleton height={70} />
                </div>
              ) : (
                <div style={{ padding: '14px 18px' }}>
                  {(() => {
                    const total = Object.values(gravity).reduce((a, b) => a + b, 0) || 1;
                    return (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            height: 26,
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div
                            style={{
                              width: `${(heinous / total) * 100}%`,
                              background: 'var(--status-critical)',
                            }}
                            title={`Heinous: ${heinous}`}
                          />
                          <div style={{ flex: 1, background: 'var(--bg-inset)' }} title="Non-Heinous" />
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                          <SeriesChip color="var(--status-critical)" label={`Heinous (${heinous})`} />
                          <SeriesChip
                            color="var(--bg-inset)"
                            label={`Non-Heinous (${gravity['Non-Heinous'] ?? 0})`}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </Card>

            <Card title="Case status" subtitle="Resolution pipeline across all cases" flush>
              {loading ? (
                <div style={{ padding: 18 }}>
                  <Skeleton height={180} />
                </div>
              ) : (
                <>
                  <div style={{ height: 190, padding: '12px 18px 0' }}>
                    <DonutChart
                      labels={statusDist.labels}
                      values={statusDist.values}
                      colors={statusDist.colors}
                      centerValue={formatNumber(summary!.total)}
                      centerLabel="cases"
                    />
                  </div>
                  <div className="legend-row" style={{ padding: '12px 18px 14px' }}>
                    {statusDist.labels.map((label, i) => (
                      <SeriesChip key={label} color={statusDist.colors[i]} label={`${label} (${statusDist.values[i]})`} />
                    ))}
                  </div>
                </>
              )}
            </Card>

            <Card title="District pressure" subtitle="Highest incident volumes" flush>
              {loading ? (
                <div style={{ padding: 18 }}>
                  <Skeleton height={160} />
                </div>
              ) : (
                <div className="rank-list" style={{ paddingTop: 12 }}>
                  {districtRanking.map(([district, count]) => (
                    <div className="rank-item" key={district}>
                      <span className="rank-item__name">{district}</span>
                      <span className="rank-item__value">{formatNumber(count)}</span>
                      <span className="rank-item__bar">
                        <span
                          className="rank-item__bar-fill"
                          style={{ width: `${Math.max(6, (count / maxDistrict) * 100)}%` }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Crime heads" subtitle="Major-head case volumes" flush>
              {loading ? (
                <div style={{ padding: 18 }}>
                  <Skeleton height={120} />
                </div>
              ) : (
                <div className="feed">
                  {Object.entries(summary!.by_head)
                    .sort((a, b) => b[1] - a[1])
                    .map(([head, count]) => (
                      <div className="feed-item" key={head}>
                        <span
                          className="feed-item__marker"
                          style={{ background: stableColorVar(head) }}
                        />
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                          <span className="feed-item__title">{head}</span>
                          <span style={{ color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatNumber(count)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
