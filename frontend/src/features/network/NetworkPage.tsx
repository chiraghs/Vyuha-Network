import { Share2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ChatAPI, NetworkAPI } from '../../api/endpoints';
import { Badge } from '../../components/ui/Badge';
import { AiAnswer } from '../../components/ui/AiAnswer';
import { CenteredLoader, EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { useApi } from '../../hooks/useApi';
import { RISK_LABEL, riskColorVar, riskLevel } from '../../lib/risk';
import { formatNumber, titleCase } from '../../lib/format';
import type { AiAnswerData, NetworkNode } from '../../types';
import { ForceGraph } from './ForceGraph';

const RISK_LEGEND = [
  { label: 'Low (<40)', color: 'var(--status-good)' },
  { label: 'Moderate (40–59)', color: 'var(--status-warning)' },
  { label: 'Elevated (60–79)', color: 'var(--status-serious)' },
  { label: 'Critical (80+)', color: 'var(--status-critical)' },
];

export function NetworkPage() {
  const graphState = useApi(() => NetworkAPI.graph(), []);
  const [selected, setSelected] = useState<NetworkNode | null>(null);
  const [assessment, setAssessment] = useState<AiAnswerData | null>(null);
  const [assessing, setAssessing] = useState(false);

  // Explainable-AI risk narrative for the selected suspect (structured).
  useEffect(() => {
    if (!selected) {
      setAssessment(null);
      return;
    }
    let cancelled = false;
    setAssessing(true);
    setAssessment(null);
    ChatAPI.send(
      `Generate a concise risk assessment for suspect ${selected.name} ` +
        `(alias: ${selected.alias ?? 'none'}) with recidivism risk score ` +
        `${Math.round(selected.risk_score)}, status "${selected.status}" and ` +
        `${selected.connections} known network links.`,
    )
      .then((reply) => {
        if (!cancelled)
          setAssessment({
            summary: reply.summary ?? reply.reply_text.replace(/<\/?b>/g, ''),
            detected_patterns: reply.detected_patterns,
            recommended_actions: reply.recommended_actions,
            confidence: reply.confidence,
          });
      })
      .catch(() => {
        if (!cancelled) {
          setAssessment({
            summary:
              'AI assessment unavailable. Standard recidivism protocol applies — keep the suspect on the active watch list.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setAssessing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const relations = useMemo(() => {
    if (!selected || !graphState.data) return [];
    const nameById = new Map(graphState.data.nodes.map((n) => [n.id, n.name]));
    return graphState.data.edges
      .filter((e) => e.source === selected.id || e.target === selected.id)
      .map((e) => ({
        id: e.id,
        other: nameById.get(e.source === selected.id ? e.target : e.source) ?? 'Unknown',
        relation: titleCase(e.relation),
        strength: e.strength,
      }));
  }, [selected, graphState.data]);

  if (graphState.loading) {
    return (
      <main className="page page--flush network-page">
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <CenteredLoader label="Building criminal link graph…" />
        </div>
      </main>
    );
  }

  if (graphState.error) {
    return (
      <main className="page page--flush network-page">
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <ErrorState message={graphState.error} onRetry={graphState.refetch} />
        </div>
      </main>
    );
  }

  const graph = graphState.data;
  if (!graph || graph.nodes.length === 0) {
    return (
      <main className="page page--flush network-page">
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <EmptyState
            title="No network data"
            message="No criminal relationship records are available yet."
            icon={<Share2 size={28} />}
          />
        </div>
      </main>
    );
  }

  const level = selected ? riskLevel(selected.risk_score) : null;

  return (
    <main className="page page--flush network-page">
      <div className="network-stage">
        <ForceGraph
          nodes={graph.nodes}
          edges={graph.edges}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />

        <div className="card network-hud">
          <div className="map-legend__title">Network metrics</div>
          <div className="network-hud__metric">
            <span>Tracked criminals</span>
            <b>{formatNumber(graph.metrics.total_criminals)}</b>
          </div>
          <div className="network-hud__metric">
            <span>Relationships</span>
            <b>{formatNumber(graph.metrics.total_relationships)}</b>
          </div>
          <div className="network-hud__metric">
            <span>Active hubs</span>
            <b>{formatNumber(graph.metrics.active_hubs)}</b>
          </div>
          <div className="network-hud__metric">
            <span>Max connections</span>
            <b>{formatNumber(graph.metrics.max_connections)}</b>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 6 }}>
            <div className="map-legend__title">Risk score</div>
            {RISK_LEGEND.map((item) => (
              <span key={item.label} className="series-chip">
                <span className="series-chip__swatch" style={{ background: item.color, borderRadius: '50%' }} />
                {item.label}
              </span>
            ))}
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              Dashed ring marks a network hub · node size = link count
            </span>
          </div>
        </div>

        {selected && (
          <aside className="slide-panel" aria-label="Suspect profile">
            <div className="slide-panel__header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 650 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {selected.alias ? `Alias “${selected.alias}”` : 'No known alias'}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Badge tone="neutral">{titleCase(selected.status)}</Badge>
                  {selected.is_hub && <Badge tone="accent">Network hub</Badge>}
                  {level && (
                    <Badge tone={level === 'critical' ? 'critical' : level === 'elevated' ? 'serious' : level === 'moderate' ? 'warning' : 'good'}>
                      {RISK_LABEL[level]} risk
                    </Badge>
                  )}
                </div>
              </div>
              <button
                className="btn btn--ghost btn--icon"
                onClick={() => setSelected(null)}
                aria-label="Close suspect profile"
              >
                <X size={16} />
              </button>
            </div>

            <div className="slide-panel__body">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-3)' }}>Predictive recidivism score</span>
                  <b style={{ color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(selected.risk_score)} / 100
                  </b>
                </div>
                <div className="meter">
                  <div
                    className="meter__fill"
                    style={{
                      width: `${Math.min(100, Math.max(2, selected.risk_score))}%`,
                      background: level ? riskColorVar(level) : 'var(--accent)',
                    }}
                  />
                </div>
              </div>

              <dl className="def-list">
                <dt>Known links</dt>
                <dd>{selected.connections}</dd>
                <dt>Hub status</dt>
                <dd>{selected.is_hub ? 'Yes — central actor' : 'No'}</dd>
              </dl>

              <div>
                {assessing ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <Skeleton height={12} />
                    <Skeleton height={12} />
                    <Skeleton height={12} width="70%" />
                  </div>
                ) : (
                  assessment && <AiAnswer data={assessment} compact />
                )}
              </div>

              {relations.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-3)',
                      marginBottom: 8,
                    }}
                  >
                    Known associates ({relations.length})
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {relations.map((rel) => (
                      <div
                        key={rel.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          fontSize: 13,
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'var(--bg-inset)',
                        }}
                      >
                        <span style={{ fontWeight: 550, color: 'var(--text-1)' }}>{rel.other}</span>
                        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{rel.relation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
