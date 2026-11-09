import { FALLBACK_HAND, HANDS, PAPERS } from '../data/catalog';
import type { Glyphs, HandKey, IconKey, Item, Project, Pt } from '../types';
import { PAD, bounds, densify, fitStrokes, length } from './strokes';

/** Something the pen draws. All positions are in millimetres on the paper. */
export type Mark =
  | { kind: 'text'; x: number; y: number; text: string; family: string; size: number; w: number }
  | { kind: 'stroke'; pts: Pt[]; len: number }
  | { kind: 'icon'; icon: IconKey; x: number; y: number; size: number };

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One sheet of paper with everything the pen will draw on it. */
export interface SheetLayout {
  w: number;
  h: number;
  paper: string;
  marks: Mark[];
  /** Pre-printed bits that are not written by the pen. */
  printed: { lines: [number, number, number, number][]; stampBox: Box | null; fold: boolean };
  stamp: boolean;
  overflow: boolean;
}

// ---------- measuring ----------

const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
const cache = new Map<string, number>();

/** Width of a text in em (multiply by the font size in mm). */
export function emWidth(text: string, family: string) {
  const key = `${family}|${text}`;
  let w = cache.get(key);
  if (w === undefined) {
    if (ctx) {
      ctx.font = `100px ${family}`;
      w = ctx.measureText(text).width / 100;
    } else w = text.length * 0.45;
    cache.set(key, w);
  }
  return w;
}

/** Call when web fonts finish loading; widths measured before that are wrong. */
export function resetMeasurements() {
  cache.clear();
}

export interface Writer {
  size: number;
  lineH: number;
  width: (s: string) => number;
  write: (s: string, x: number, y: number, out: Mark[]) => void;
}

/** Writes with a font, or with someone's own letters (letters they skipped fall back to Jamie). */
export function makeWriter(hand: HandKey, glyphs: Glyphs, baseSize: number): Writer {
  if (hand !== 'own') {
    const h = HANDS[hand];
    const size = baseSize * h.factor;
    return {
      size,
      lineH: size * 1.3,
      width: (s) => emWidth(s, h.family) * size,
      write: (s, x, y, out) => {
        if (s.trim()) out.push({ kind: 'text', x, y, text: s, family: h.family, size, w: emWidth(s, h.family) * size });
      },
    };
  }

  const size = baseSize;
  const fb = FALLBACK_HAND.family;
  // Tall letters on the pad (top line → baseline) become about 0.62 of the type size.
  const k = (0.62 * size) / (PAD.base - PAD.asc);
  const gap = 0.06 * size;
  const space = 0.3 * size;
  const has = (ch: string) => (glyphs[ch]?.length ?? 0) > 0;
  const glyphW = (ch: string) => {
    const b = bounds(glyphs[ch]);
    return (b.maxX - b.minX) * k;
  };
  const adv = (ch: string) => (ch === ' ' ? space : has(ch) ? glyphW(ch) + gap : emWidth(ch, fb) * size);

  return {
    size,
    lineH: size * 1.32,
    width: (s) => [...s].reduce((sum, ch) => sum + adv(ch), 0),
    write: (s, x, y, out) => {
      let cx = x;
      let run = '';
      let runX = x;
      const flush = () => {
        if (run) out.push({ kind: 'text', x: runX, y, text: run, family: fb, size, w: emWidth(run, fb) * size });
        run = '';
      };
      for (const ch of s) {
        if (ch === ' ') {
          flush();
          cx += space;
        } else if (has(ch)) {
          flush();
          const b = bounds(glyphs[ch]);
          for (const st of glyphs[ch]) {
            const pts = st.map(([px, py]) => [cx + (px - b.minX) * k, y + (py - PAD.base) * k] as Pt);
            out.push({ kind: 'stroke', pts, len: length(pts) });
          }
          cx += glyphW(ch) + gap;
        } else {
          if (!run) runX = cx;
          run += ch;
          cx += emWidth(ch, fb) * size;
        }
      }
      flush();
    },
  };
}

/** Greedy word wrap. Keeps empty lines, breaks words that are longer than a whole line. */
export function wrap(text: string, maxW: number, width: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ').filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (width(candidate) <= maxW) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      line = word;
      while (width(line) > maxW && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && width(line.slice(0, cut)) > maxW) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
  }
  return out;
}

// ---------- fields like {name} ----------

const FIELD = /\{([a-z0-9_]+)\}/gi;

/** Fields used in the design, in the order they first appear. */
export function fieldsOf(items: Item[]): string[] {
  const seen: string[] = [];
  for (const item of items) {
    if (item.kind !== 'text') continue;
    for (const m of item.text.matchAll(FIELD)) {
      const key = m[1].toLowerCase();
      if (!seen.includes(key)) seen.push(key);
    }
  }
  return seen;
}

/** Puts a guest's values into the text. Without a guest, the fields stay visible as {name}. */
export function fill(text: string, cells: Record<string, string> | null) {
  if (!cells) return text;
  return text.replace(FIELD, (_, key: string) => cells[key.toLowerCase()] ?? '');
}

export const fieldLabel = (key: string) => {
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// ---------- a whole card ----------

export interface DesignLayout extends SheetLayout {
  /** Text boxes whose words don't fit. */
  overflowIds: string[];
}

export function layoutDesign(p: Pick<Project, 'paper' | 'items' | 'hand'>, glyphs: Glyphs, cells: Record<string, string> | null): DesignLayout {
  const paper = PAPERS[p.paper];
  const marks: Mark[] = [];
  const overflowIds: string[] = [];

  for (const item of p.items) {
    if (item.kind === 'icon') {
      const size = Math.min(item.w, item.h);
      marks.push({ kind: 'icon', icon: item.icon, x: item.x + (item.w - size) / 2, y: item.y + (item.h - size) / 2, size });
    } else if (item.kind === 'doodle') {
      for (const s of fitStrokes(item.strokes, item.x, item.y, item.w, item.h)) marks.push({ kind: 'stroke', pts: s, len: length(s) });
    } else {
      const writer = makeWriter(p.hand, glyphs, item.size);
      const lines = wrap(fill(item.text, cells), item.w, writer.width);
      let y = item.y + writer.size * 0.95;
      for (const line of lines) {
        const lw = writer.width(line);
        const x = item.align === 'center' ? item.x + (item.w - lw) / 2 : item.align === 'right' ? item.x + item.w - lw : item.x;
        writer.write(line, x, y, marks);
        y += writer.lineH;
      }
      const bottom = y - writer.lineH + writer.size * 0.35;
      if (lines.length && bottom > item.y + item.h + 0.5) overflowIds.push(item.id);
    }
  }

  return {
    w: paper.w,
    h: paper.h,
    paper: '#fdfbf4',
    marks,
    printed: { lines: [], stampBox: null, fold: false },
    stamp: false,
    overflow: overflowIds.length > 0,
    overflowIds,
  };
}

/** A dashed check outline: the pen traces the card's edge with the pen lifted, so you can see it fits. */
export function outlineLayout(w: number, h: number): SheetLayout {
  const pts = densify([
    [1, 1],
    [w - 1, 1],
    [w - 1, h - 1],
    [1, h - 1],
    [1, 1],
  ]);
  return { w, h, paper: '#fdfbf4', marks: [{ kind: 'stroke', pts, len: length(pts) }], printed: { lines: [], stampBox: null, fold: false }, stamp: false, overflow: false };
}

// ---------- timing ----------

/** How much pen work a mark is, roughly in millimetres of pen travel. */
function weight(m: Mark) {
  if (m.kind === 'text') return m.w * 1.15 + 2;
  if (m.kind === 'stroke') return m.len * 0.6 + 1;
  return m.size * 2 + 2;
}

/** Start and end of each mark on a 0–1 timeline. */
export function timeline(marks: Mark[]): [number, number][] {
  const weights = marks.map(weight);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return weights.map((w) => {
    const span: [number, number] = [acc / total, (acc + w) / total];
    acc += w;
    return span;
  });
}

/** Real writing time for one card at a pen speed in mm/s, including moving to the start and lifting the pen. */
export function cardSeconds(sheet: SheetLayout, speed: number) {
  const work = sheet.marks.reduce((a, m) => a + weight(m), 0);
  return 4 + (work * 4) / speed;
}

export function formatDuration(seconds: number) {
  if (seconds < 50) return `${Math.max(1, Math.round(seconds / 5) * 5)} s`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export const ALPHABET = [
  ...'abcdefghijklmnopqrstuvwxyzäöü',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ',
  ...'0123456789',
  ...'.,!?’-:&',
];
