/**
 * Crime categories carry a FIXED series-color assignment (never cycled or
 * re-ranked by filters) so a category keeps its hue across every chart, map
 * marker, and legend in the app. Colors come from the validated categorical
 * palette defined in tokens.css (--series-1 … --series-8, light + dark steps).
 */
export const CRIME_CATEGORIES = [
  'Theft',
  'Assault',
  'Cybercrime',
  'Narcotics',
  'Land Dispute',
  'Homicide',
  'Extortion',
  'Burglary',
] as const;

export type CrimeCategory = (typeof CRIME_CATEGORIES)[number];

/** FIR crime sub-heads used by the case filter (matches the backend taxonomy). */
export const CRIME_SUBHEADS = [
  'Murder',
  'Attempt to Murder',
  'Grievous Hurt',
  'Kidnapping',
  'Theft',
  'House Burglary',
  'Robbery',
  'Dacoity',
  'Assault on Woman',
  'Dowry Harassment',
  'Sexual Offence',
  'Cheating',
  'Forgery',
  'Online Financial Fraud',
  'Identity Theft',
  'Drug Possession',
  'Drug Trafficking',
  'Illicit Arms',
  'Excise Violation',
] as const;

const CATEGORY_SLOT: Record<string, number> = Object.fromEntries(
  CRIME_CATEGORIES.map((category, index) => [category, index + 1]),
);

/** CSS variable reference for a category's series color (theme-aware). */
export function categoryColorVar(category: string): string {
  const slot = CATEGORY_SLOT[category];
  return slot ? `var(--series-${slot})` : 'var(--text-3)';
}

/** Resolved hex for contexts that cannot use CSS variables (canvas, chart.js). */
export function resolveCategoryColor(category: string): string {
  const slot = CATEGORY_SLOT[category];
  const varName = slot ? `--series-${slot}` : '--text-3';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/**
 * Stable series color for an arbitrary label (FIR crime sub-heads / heads span
 * more than the fixed 8 categories). Known categories keep their fixed slot;
 * everything else hashes deterministically into a series slot so the same label
 * always renders the same color across the app.
 */
function slotFor(key: string): number {
  const known = CATEGORY_SLOT[key];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 8) + 1;
}

export function stableColorVar(key: string): string {
  return `var(--series-${slotFor(key)})`;
}

export function resolveStableColor(key: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--series-${slotFor(key)}`).trim();
}
