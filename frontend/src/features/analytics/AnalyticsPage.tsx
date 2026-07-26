import { Lightbulb, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnalyticsAPI } from '../../api/endpoints';
import { SeriesChip } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { StackedBarChart } from '../../components/charts/StackedBarChart';
import { useChartTokens } from '../../components/charts/chartTheme';
import { useApi } from '../../hooks/useApi';
import { resolveStableColor } from '../../lib/categories';

type Matrix = Record<string, Record<string, number>>;

function totalOf(matrix: Matrix, bucket: string): number {
  return Object.values(matrix[bucket] ?? {}).reduce((a, b) => a + b, 0);
}

function topCategoryOf(matrix: Matrix, bucket: string): string | null {
  const entries = Object.entries(matrix[bucket] ?? {});
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function toStacked(matrix: Matrix, tokensVersion: unknown) {
  void tokensVersion; // colors re-resolve when the theme flips
  // Buckets (occupations / religions) ordered by total volume.
  const buckets = Object.keys(matrix).sort((a, b) => totalOf(matrix, b) - totalOf(matrix, a));
  const catSet = new Set<string>();
  for (const b of buckets) Object.keys(matrix[b]).forEach((c) => catSet.add(c));
  const categories = [...catSet].sort();
  return {
    labels: buckets,
    series: categories.map((category) => ({
      label: category,
      color: resolveStableColor(category),
      values: buckets.map((b) => matrix[b][category] ?? 0),
    })),
  };
}

function CorrelationCard({
  title,
  subtitle,
  matrix,
}: {
  title: string;
  subtitle: string;
  matrix: Matrix;
}) {
  const tokens = useChartTokens();
  const [showTable, setShowTable] = useState(false);
  const stacked = useMemo(() => toStacked(matrix, tokens), [matrix, tokens]);

  if (stacked.labels.length === 0) {
    return (
      <Card title={title} subtitle={subtitle}>
        <EmptyState title="No statistics compiled" message="Not enough records to correlate yet." />
      </Card>
    );
  }

  return (
    <Card
      title={title}
      subtitle={subtitle}
      flush
      actions={
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
        >
          <Table2 size={13} />
          {showTable ? 'Chart view' : 'Data table'}
        </button>
      }
    >
      <div className="legend-row" style={{ paddingTop: 12 }}>
        {stacked.series.map((s) => (
          <SeriesChip key={s.label} color={s.color} label={s.label} />
        ))}
      </div>
      {showTable ? (
        <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Group</th>
                {stacked.series.map((s) => (
                  <th key={s.label} className="num">
                    {s.label}
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {stacked.labels.map((bucket, i) => (
                <tr key={bucket}>
                  <td>{bucket}</td>
                  {stacked.series.map((s) => (
                    <td key={s.label} className="num">
                      {s.values[i] || '–'}
                    </td>
                  ))}
                  <td className="num" style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                    {totalOf(matrix, bucket)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-box chart-box--tall" style={{ padding: '4px 18px 16px' }}>
          <StackedBarChart labels={stacked.labels} series={stacked.series} />
        </div>
      )}
    </Card>
  );
}

export function AnalyticsPage() {
  const statsState = useApi(() => AnalyticsAPI.socioEconomic(), []);

  const insights = useMemo(() => {
    const stats = statsState.data;
    if (!stats) return [];
    const notes: string[] = [];

    const occBuckets = Object.keys(stats.occupation_correlation).sort(
      (a, b) => totalOf(stats.occupation_correlation, b) - totalOf(stats.occupation_correlation, a),
    );
    if (occBuckets.length > 0) {
      const top = occBuckets[0];
      const cat = topCategoryOf(stats.occupation_correlation, top);
      if (cat) {
        notes.push(
          `Complainants recorded as “${top}” report the most cases, led by ${cat.toLowerCase()} ` +
            `(${stats.occupation_correlation[top][cat]} of ${totalOf(stats.occupation_correlation, top)}). ` +
            `Consider targeted outreach and victim-support in this group.`,
        );
      }
    }

    const relBuckets = Object.keys(stats.religion_correlation).sort(
      (a, b) => totalOf(stats.religion_correlation, b) - totalOf(stats.religion_correlation, a),
    );
    if (relBuckets.length > 0) {
      const top = relBuckets[0];
      const cat = topCategoryOf(stats.religion_correlation, top);
      if (cat) {
        notes.push(
          `Across community groups the dominant crime head is ${cat.toLowerCase()}; ` +
            `distribution is broadly proportional, so allocate resources by case volume rather than group.`,
        );
      }
    }
    return notes;
  }, [statsState.data]);

  if (statsState.error) {
    return (
      <main className="page">
        <div className="card">
          <ErrorState message={statsState.error} onRetry={statsState.refetch} />
        </div>
      </main>
    );
  }

  return (
    <main className="page fade-in">
      <div className="page__grid">
        {statsState.loading ? (
          <div className="analytics-grid">
            <div className="card" style={{ padding: 18 }}>
              <Skeleton height={300} />
            </div>
            <div className="card" style={{ padding: 18 }}>
              <Skeleton height={300} />
            </div>
          </div>
        ) : (
          statsState.data && (
            <>
              <div className="analytics-grid">
                <CorrelationCard
                  title="Occupation correlation"
                  subtitle="Registered cases by complainant occupation × crime head"
                  matrix={statsState.data.occupation_correlation}
                />
                <CorrelationCard
                  title="Community correlation"
                  subtitle="Registered cases by complainant religion × crime head"
                  matrix={statsState.data.religion_correlation}
                />
              </div>

              <Card title="SCRB analyst notes" subtitle="Auto-generated findings from the correlation matrices">
                {insights.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    Not enough correlated data to generate findings yet.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
                    {insights.map((note, i) => (
                      <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>
                        <Lightbulb size={15} style={{ flex: 'none', marginTop: 3, color: 'var(--accent)' }} />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )
        )}
      </div>
    </main>
  );
}
