/**
 * Perceptual image signatures for photo search. The central (face) region of
 * the image is downscaled to a 16×16 grayscale grid and thresholded against
 * its mean brightness (average-hash); a mean-color component adds skin/hair
 * tone discrimination. Similarity blends both. This is image similarity, not
 * biometric face recognition — results are indicative leads, and exact
 * matches occur for photographs exported from this system.
 */

const GRID = 16;
const BITS = GRID * GRID;

/** Face crop, as fractions of the source image (mugshots are head-centered). */
const CROP = { x: 0.2, y: 0.08, w: 0.6, h: 0.6 };

export interface ImageSignature {
  bits: Uint8Array;
  color: [number, number, number];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = src;
  });
}

/** Compute the perceptual signature of an image source (URL or data URI). */
export async function hashImageSource(src: string): Promise<ImageSignature> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  ctx.drawImage(img, w * CROP.x, h * CROP.y, w * CROP.w, h * CROP.h, 0, 0, GRID, GRID);
  const { data } = ctx.getImageData(0, 0, GRID, GRID);

  const gray = new Float32Array(BITS);
  let mean = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < BITS; i++) {
    const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gray[i] = v;
    mean += v;
    r += data[i * 4];
    g += data[i * 4 + 1];
    b += data[i * 4 + 2];
  }
  mean /= BITS;

  const bits = new Uint8Array(BITS / 8);
  for (let i = 0; i < BITS; i++) {
    if (gray[i] > mean) bits[i >> 3] |= 1 << (i & 7);
  }
  return { bits, color: [r / BITS, g / BITS, b / BITS] };
}

const POPCOUNT = new Uint8Array(256).map((_, i) => {
  let n = i;
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
});

/** Similarity in [0, 1]: structural hash (70%) + mean color (30%). */
export function hashSimilarity(a: ImageSignature, b: ImageSignature): number {
  let distance = 0;
  for (let i = 0; i < a.bits.length; i++) distance += POPCOUNT[a.bits[i] ^ b.bits[i]];
  const structural = 1 - distance / BITS;

  const dr = a.color[0] - b.color[0];
  const dg = a.color[1] - b.color[1];
  const db = a.color[2] - b.color[2];
  const colorDist = Math.sqrt(dr * dr + dg * dg + db * db) / 441.673;
  const color = 1 - colorDist;

  return 0.7 * structural + 0.3 * color;
}

export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
