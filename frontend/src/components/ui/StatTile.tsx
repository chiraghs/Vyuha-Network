import type { ReactNode } from 'react';

export type ProvenanceTone = 'live' | 'computed' | 'synthetic';

export interface Provenance {
  label: string;
  tone: ProvenanceTone;
}

interface StatTileProps {
  label: string;
  icon?: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  accentColor?: string;
  loading?: boolean;
  /** Data-lineage chip declaring where the number comes from. */
  provenance?: Provenance;
}

export function StatTile({ label, icon, value, hint, accentColor, loading, provenance }: StatTileProps) {
  return (
    <div className="card stat-tile">
      {accentColor && <span className="stat-tile__accent" style={{ background: accentColor }} />}
      <div className="stat-tile__head">
        <div className="stat-tile__label">
          {icon}
          <span>{label}</span>
        </div>
        {provenance && (
          <span className={`provenance provenance--${provenance.tone}`} title="Data provenance">
            {provenance.label}
          </span>
        )}
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 32, width: 84, marginTop: 8 }} />
      ) : (
        <div className="stat-tile__value">{value}</div>
      )}
      {hint && <div className="stat-tile__hint">{hint}</div>}
    </div>
  );
}
