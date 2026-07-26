import type { CrimeRecord } from '../types';

export interface TrendAlert {
  category: string;
  district: string | null;
  /** Incidents in the most recent window. */
  current: number;
  /** Mean incidents across the preceding windows. */
  baseline: number;
  /** How many standard deviations the current window sits above baseline. */
  zScore: number;
  severity: 'watch' | 'alert';
}

const WINDOW_DAYS = 7;
const LOOKBACK_WINDOWS = 8;

function bucketIndex(occurrence: string, now: number): number {
  const t = new Date(occurrence).getTime();
  if (Number.isNaN(t)) return -1;
  const daysAgo = (now - t) / 86_400_000;
  if (daysAgo < 0) return 0;
  return Math.floor(daysAgo / WINDOW_DAYS);
}

/**
 * Lightweight anomaly detection over the incident stream: incidents are
 * bucketed into 7-day windows per (category, district); the newest window is
 * compared against the mean and standard deviation of the previous windows.
 * A z-score ≥ 1.5 is a "watch", ≥ 2.5 an "alert".
 */
export function detectTrendAnomalies(crimes: CrimeRecord[]): TrendAlert[] {
  if (crimes.length === 0) return [];
  const now = Date.now();

  const groups = new Map<string, number[]>();
  for (const crime of crimes) {
    const bucket = bucketIndex(crime.occurrence_time, now);
    if (bucket < 0 || bucket >= LOOKBACK_WINDOWS) continue;
    for (const key of [
      `${crime.crime_category}||`,
      `${crime.crime_category}||${crime.district_name}`,
    ]) {
      const series = groups.get(key) ?? new Array(LOOKBACK_WINDOWS).fill(0);
      series[bucket] += 1;
      groups.set(key, series);
    }
  }

  const alerts: TrendAlert[] = [];
  for (const [key, series] of groups) {
    const [category, district] = key.split('||');
    const current = series[0];
    const history = series.slice(1);
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance =
      history.reduce((acc, v) => acc + (v - mean) ** 2, 0) / history.length;
    const std = Math.sqrt(variance);
    if (current < 3) continue; // too few incidents to call a spike
    const zScore = std > 0 ? (current - mean) / std : current > mean ? 3 : 0;
    if (zScore >= 1.5) {
      alerts.push({
        category,
        district: district || null,
        current,
        baseline: Number(mean.toFixed(1)),
        zScore: Number(zScore.toFixed(1)),
        severity: zScore >= 2.5 ? 'alert' : 'watch',
      });
    }
  }

  // District-specific alerts first, strongest deviation on top.
  return alerts.sort(
    (a, b) => Number(Boolean(b.district)) - Number(Boolean(a.district)) || b.zScore - a.zScore,
  );
}
