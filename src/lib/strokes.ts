import type { Pt, Stroke } from '../types';

/**
 * The writing pad is a 240 × 240 square. Guide lines tell people where to write:
 * capitals and tall letters reach `asc`, small letters `xh`, everything sits on `base`, tails go down to `desc`.
 */
export const PAD = { size: 240, asc: 52, xh: 108, base: 168, desc: 218 };

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(strokes: Stroke[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes)
    for (const [x, y] of s) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

export function length(pts: Pt[]) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}

/** The first `fraction` of a line, so the pen can be shown mid-stroke. */
export function partial(pts: Pt[], fraction: number): Pt[] {
  if (fraction >= 1 || pts.length < 2) return pts;
  const target = length(pts) * Math.max(0, fraction);
  const out: Pt[] = [pts[0]];
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (walked + seg >= target) {
      const t = seg ? (target - walked) / seg : 0;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      return out;
    }
    walked += seg;
    out.push(pts[i]);
  }
  return out;
}

const f = (n: number) => Math.round(n * 100) / 100;

/** A smooth SVG path through the points (quadratic curves between midpoints), like a pen would draw. */
export function toPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${f(pts[0][0])} ${f(pts[0][1])}l0.01 0`;
  if (pts.length === 2) return `M${f(pts[0][0])} ${f(pts[0][1])}L${f(pts[1][0])} ${f(pts[1][1])}`;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const mx = (x + pts[i + 1][0]) / 2;
    const my = (y + pts[i + 1][1]) / 2;
    d += `Q${f(x)} ${f(y)} ${f(mx)} ${f(my)}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${f(last[0])} ${f(last[1])}`;
}

/** Adds points along straight lines, so the smoothing in `toPath` keeps corners sharp. */
export function densify(pts: Pt[], step = 1.5): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}

/** Fit strokes into a box (keeps the proportions, centres them). */
export function fitStrokes(strokes: Stroke[], x: number, y: number, w: number, h: number): Stroke[] {
  const b = bounds(strokes);
  const bw = Math.max(b.maxX - b.minX, 1);
  const bh = Math.max(b.maxY - b.minY, 1);
  const k = Math.min(w / bw, h / bh);
  const ox = x + (w - bw * k) / 2;
  const oy = y + (h - bh * k) / 2;
  return strokes.map((s) => s.map(([px, py]) => [ox + (px - b.minX) * k, oy + (py - b.minY) * k] as Pt));
}
