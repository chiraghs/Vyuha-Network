/**
 * Deterministic procedural mugshot generator. Every offender gets a stable,
 * synthetic booking photograph rendered as SVG from their record ID — no real
 * photographs are stored or transmitted. The same seed always produces the
 * same face, which is what makes perceptual photo-matching possible.
 */

const WIDTH = 300;
const HEIGHT = 400;

/** xmur3 string hash -> mulberry32 PRNG, fully deterministic per seed. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = (h ^= h >>> 16) >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIN_TONES = ['#8d5a3b', '#a06a45', '#b07a52', '#6e4429', '#c08a5e', '#96613f'];
const HAIR_COLORS = ['#141210', '#241c14', '#33261a', '#4d453c', '#1c1814'];
const SHIRT_COLORS = ['#37474f', '#4e342e', '#33424a', '#3e4a3d', '#42395d', '#5d4037'];

function darken(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function mugshotSvg(seed: string, label = ''): string {
  const rand = seededRandom(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const skin = pick(SKIN_TONES);
  const skinShade = darken(skin, 0.82);
  const hair = pick(HAIR_COLORS);
  const shirt = pick(SHIRT_COLORS);

  const cx = WIDTH / 2;
  const headRx = 50 + rand() * 12;
  const headRy = 64 + rand() * 12;
  const headCy = 168 + rand() * 8;
  const jawWidth = 0.82 + rand() * 0.16;

  const eyeDx = 22 + rand() * 6;
  const eyeY = headCy - 6 + rand() * 6;
  const eyeRx = 8 + rand() * 2.5;
  const browY = eyeY - 14 - rand() * 5;
  const browTilt = (rand() - 0.5) * 10;
  const browThick = 4 + rand() * 3;

  const noseLen = 24 + rand() * 10;
  const mouthY = headCy + headRy * 0.52;
  const mouthWidth = 26 + rand() * 12;
  const mouthCurve = rand() < 0.6 ? 2 + rand() * 4 : -(1 + rand() * 3);

  const hairStyle = Math.floor(rand() * 5);
  const facialHair = Math.floor(rand() * 4); // 0 none, 1 mustache, 2 stubble, 3 beard
  const hasGlasses = rand() < 0.22;
  const hasScar = rand() < 0.3;
  const hasMole = rand() < 0.25;

  const parts: string[] = [];

  // Backdrop with height-chart lines
  parts.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="#c9cfd4"/>`);
  for (let i = 0; i < 9; i++) {
    const y = 24 + i * 38;
    parts.push(
      `<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="#aab2b8" stroke-width="2"/>`,
      `<text x="8" y="${y - 5}" font-family="monospace" font-size="11" fill="#8b959c">${190 - i * 10}</text>`,
    );
  }

  // Torso + neck
  parts.push(
    `<path d="M ${cx - 95} ${HEIGHT} Q ${cx - 92} ${HEIGHT - 78} ${cx - 52} ${HEIGHT - 92} L ${cx + 52} ${HEIGHT - 92} Q ${cx + 92} ${HEIGHT - 78} ${cx + 95} ${HEIGHT} Z" fill="${shirt}"/>`,
    `<path d="M ${cx - 30} ${HEIGHT - 92} L ${cx} ${HEIGHT - 58} L ${cx + 30} ${HEIGHT - 92} Z" fill="${darken(shirt, 0.8)}"/>`,
    `<rect x="${cx - 20}" y="${headCy + headRy - 22}" width="40" height="52" fill="${skinShade}"/>`,
  );

  // Ears + head
  parts.push(
    `<ellipse cx="${cx - headRx - 3}" cy="${headCy + 6}" rx="9" ry="15" fill="${skinShade}"/>`,
    `<ellipse cx="${cx + headRx + 3}" cy="${headCy + 6}" rx="9" ry="15" fill="${skinShade}"/>`,
    `<ellipse cx="${cx}" cy="${headCy}" rx="${headRx}" ry="${headRy}" fill="${skin}"/>`,
    `<path d="M ${cx - headRx * jawWidth} ${headCy + headRy * 0.35} Q ${cx} ${headCy + headRy * 1.06} ${cx + headRx * jawWidth} ${headCy + headRy * 0.35} L ${cx + headRx * 0.9} ${headCy} L ${cx - headRx * 0.9} ${headCy} Z" fill="${skin}"/>`,
  );

  // Hair
  const hairTop = headCy - headRy;
  switch (hairStyle) {
    case 0: // short crop
      parts.push(
        `<path d="M ${cx - headRx} ${headCy - 8} Q ${cx - headRx} ${hairTop - 6} ${cx} ${hairTop - 8} Q ${cx + headRx} ${hairTop - 6} ${cx + headRx} ${headCy - 8} Q ${cx + headRx * 0.7} ${headCy - headRy * 0.62} ${cx} ${headCy - headRy * 0.6} Q ${cx - headRx * 0.7} ${headCy - headRy * 0.62} ${cx - headRx} ${headCy - 8} Z" fill="${hair}"/>`,
      );
      break;
    case 1: // side part
      parts.push(
        `<path d="M ${cx - headRx} ${headCy - 4} Q ${cx - headRx - 4} ${hairTop - 10} ${cx - 12} ${hairTop - 12} Q ${cx + headRx + 2} ${hairTop - 8} ${cx + headRx} ${headCy - 20} Q ${cx + headRx * 0.55} ${headCy - headRy * 0.55} ${cx - headRx * 0.25} ${headCy - headRy * 0.68} Q ${cx - headRx} ${headCy - headRy * 0.5} ${cx - headRx} ${headCy - 4} Z" fill="${hair}"/>`,
      );
      break;
    case 2: // receding
      parts.push(
        `<path d="M ${cx - headRx} ${headCy - 2} Q ${cx - headRx * 0.96} ${headCy - headRy * 0.72} ${cx - headRx * 0.55} ${headCy - headRy * 0.8} L ${cx - headRx * 0.62} ${headCy - headRy * 0.5} Q ${cx - headRx * 0.8} ${headCy - headRy * 0.3} ${cx - headRx} ${headCy - 2} Z" fill="${hair}"/>`,
        `<path d="M ${cx + headRx} ${headCy - 2} Q ${cx + headRx * 0.96} ${headCy - headRy * 0.72} ${cx + headRx * 0.55} ${headCy - headRy * 0.8} L ${cx + headRx * 0.62} ${headCy - headRy * 0.5} Q ${cx + headRx * 0.8} ${headCy - headRy * 0.3} ${cx + headRx} ${headCy - 2} Z" fill="${hair}"/>`,
      );
      break;
    case 3: // curly
      for (let i = -3; i <= 3; i++) {
        parts.push(
          `<circle cx="${cx + i * (headRx / 3.2)}" cy="${hairTop + Math.abs(i) * 6 - 2}" r="${13 - Math.abs(i)}" fill="${hair}"/>`,
        );
      }
      break;
    default: // slicked back
      parts.push(
        `<path d="M ${cx - headRx - 2} ${headCy - 14} Q ${cx - headRx} ${hairTop - 14} ${cx} ${hairTop - 15} Q ${cx + headRx} ${hairTop - 14} ${cx + headRx + 2} ${headCy - 14} Q ${cx + headRx * 0.75} ${headCy - headRy * 0.7} ${cx} ${headCy - headRy * 0.66} Q ${cx - headRx * 0.75} ${headCy - headRy * 0.7} ${cx - headRx - 2} ${headCy - 14} Z" fill="${hair}"/>`,
      );
  }

  // Brows
  parts.push(
    `<rect x="${cx - eyeDx - eyeRx}" y="${browY}" width="${eyeRx * 2 + 4}" height="${browThick}" rx="2" fill="${hair}" transform="rotate(${browTilt} ${cx - eyeDx} ${browY})"/>`,
    `<rect x="${cx + eyeDx - eyeRx - 4}" y="${browY}" width="${eyeRx * 2 + 4}" height="${browThick}" rx="2" fill="${hair}" transform="rotate(${-browTilt} ${cx + eyeDx} ${browY})"/>`,
  );

  // Eyes
  for (const side of [-1, 1]) {
    const ex = cx + side * eyeDx;
    parts.push(
      `<ellipse cx="${ex}" cy="${eyeY}" rx="${eyeRx}" ry="${eyeRx * 0.62}" fill="#f2ede6"/>`,
      `<circle cx="${ex}" cy="${eyeY}" r="${eyeRx * 0.42}" fill="#2b1c10"/>`,
      `<circle cx="${ex + 1.5}" cy="${eyeY - 1.5}" r="1.3" fill="#ffffff" opacity="0.85"/>`,
    );
  }

  if (hasGlasses) {
    parts.push(
      `<circle cx="${cx - eyeDx}" cy="${eyeY}" r="${eyeRx + 5}" fill="none" stroke="#20242a" stroke-width="2.5"/>`,
      `<circle cx="${cx + eyeDx}" cy="${eyeY}" r="${eyeRx + 5}" fill="none" stroke="#20242a" stroke-width="2.5"/>`,
      `<line x1="${cx - eyeDx + eyeRx + 5}" y1="${eyeY}" x2="${cx + eyeDx - eyeRx - 5}" y2="${eyeY}" stroke="#20242a" stroke-width="2.5"/>`,
    );
  }

  // Nose + mouth
  parts.push(
    `<path d="M ${cx} ${eyeY + 8} L ${cx - 4} ${eyeY + noseLen} Q ${cx} ${eyeY + noseLen + 5} ${cx + 6} ${eyeY + noseLen}" fill="none" stroke="${skinShade}" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="M ${cx - mouthWidth / 2} ${mouthY} Q ${cx} ${mouthY + mouthCurve} ${cx + mouthWidth / 2} ${mouthY}" fill="none" stroke="${darken(skin, 0.55)}" stroke-width="3.5" stroke-linecap="round"/>`,
  );

  // Facial hair
  if (facialHair === 1) {
    parts.push(
      `<path d="M ${cx - mouthWidth / 2 - 4} ${mouthY - 7} Q ${cx} ${mouthY - 14} ${cx + mouthWidth / 2 + 4} ${mouthY - 7} Q ${cx} ${mouthY - 3} ${cx - mouthWidth / 2 - 4} ${mouthY - 7} Z" fill="${hair}"/>`,
    );
  } else if (facialHair === 2) {
    parts.push(
      `<path d="M ${cx - headRx * jawWidth} ${headCy + headRy * 0.3} Q ${cx} ${headCy + headRy * 1.02} ${cx + headRx * jawWidth} ${headCy + headRy * 0.3} L ${cx + headRx * 0.72} ${headCy + headRy * 0.28} Q ${cx} ${headCy + headRy * 0.72} ${cx - headRx * 0.72} ${headCy + headRy * 0.28} Z" fill="${hair}" opacity="0.28"/>`,
    );
  } else if (facialHair === 3) {
    parts.push(
      `<path d="M ${cx - headRx * jawWidth} ${headCy + headRy * 0.22} Q ${cx} ${headCy + headRy * 1.14} ${cx + headRx * jawWidth} ${headCy + headRy * 0.22} L ${cx + headRx * 0.66} ${headCy + headRy * 0.24} Q ${cx} ${headCy + headRy * 0.62} ${cx - headRx * 0.66} ${headCy + headRy * 0.24} Z" fill="${hair}" opacity="0.92"/>`,
    );
  }

  // Marks
  if (hasScar) {
    const sx = cx + (rand() < 0.5 ? -1 : 1) * (headRx * 0.55);
    const sy = headCy + rand() * 18 - 4;
    parts.push(
      `<line x1="${sx - 6}" y1="${sy - 8}" x2="${sx + 4}" y2="${sy + 8}" stroke="${darken(skin, 0.5)}" stroke-width="2.5" stroke-linecap="round"/>`,
    );
  }
  if (hasMole) {
    parts.push(
      `<circle cx="${cx + (rand() < 0.5 ? -1 : 1) * headRx * 0.45}" cy="${mouthY - rand() * 20}" r="2.4" fill="${darken(skin, 0.45)}"/>`,
    );
  }

  // Booking placard
  parts.push(
    `<rect x="40" y="${HEIGHT - 46}" width="${WIDTH - 80}" height="34" rx="3" fill="#f4f1ea" stroke="#6b665c" stroke-width="1.5"/>`,
    `<text x="${cx}" y="${HEIGHT - 32}" text-anchor="middle" font-family="monospace" font-size="10" fill="#3c3a34">KSP · STATE CRIME RECORDS BUREAU</text>`,
    `<text x="${cx}" y="${HEIGHT - 18}" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="#1d1c19">${label || seed.slice(0, 12).toUpperCase()}</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${parts.join('')}</svg>`;
}

const uriCache = new Map<string, string>();

export function mugshotDataUri(seed: string, label = ''): string {
  const key = `${seed}|${label}`;
  let uri = uriCache.get(key);
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mugshotSvg(seed, label))}`;
    uriCache.set(key, uri);
  }
  return uri;
}
