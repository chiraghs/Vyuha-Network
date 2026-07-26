import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'good' | 'warning' | 'serious' | 'critical';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  /** Optional leading dot color (e.g. a series color for category identity). */
  dotColor?: string;
}

export function Badge({ tone = 'neutral', children, dotColor }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`}>
      {dotColor && <span className="badge__dot" style={{ background: dotColor }} />}
      {children}
    </span>
  );
}

/** Colored swatch + label — the standard identity chip for chart/map legends. */
export function SeriesChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="series-chip">
      <span className="series-chip__swatch" style={{ background: color }} />
      {label}
    </span>
  );
}
