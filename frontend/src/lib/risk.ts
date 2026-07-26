/**
 * Risk banding for predictive risk scores (0–100). Bands map onto the
 * reserved status palette and always ship with a text label, never color
 * alone.
 */
export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'critical';

export function riskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'elevated';
  if (score >= 40) return 'moderate';
  return 'low';
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  elevated: 'Elevated',
  critical: 'Critical',
};

/** Status-palette CSS variable for a risk level. */
export function riskColorVar(level: RiskLevel): string {
  switch (level) {
    case 'critical':
      return 'var(--status-critical)';
    case 'elevated':
      return 'var(--status-serious)';
    case 'moderate':
      return 'var(--status-warning)';
    default:
      return 'var(--status-good)';
  }
}
