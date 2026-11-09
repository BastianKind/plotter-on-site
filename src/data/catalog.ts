import type { Device, HandKey, IconKey, InkKey, PaperKey } from '../types';

export interface Paper {
  label: string;
  w: number;
  h: number;
  note: string;
}

export const PAPERS: Record<PaperKey, Paper> = {
  place: { label: 'Place card', w: 100, h: 50, note: 'Front of a folded tent card' },
  badge: { label: 'Name badge', w: 86, h: 54, note: 'Credit card size' },
  a6: { label: 'Card A6', w: 105, h: 148, note: 'Portrait' },
  a6l: { label: 'Postcard A6', w: 148, h: 105, note: 'Landscape' },
  c6: { label: 'Envelope C6', w: 162, h: 114, note: 'Fits an A6 card' },
  dl: { label: 'Menu card DL', w: 99, h: 210, note: 'Tall and narrow' },
  a5: { label: 'Letter A5', w: 148, h: 210, note: 'Portrait' },
};

/** The area the pen can reach, in mm. Paper is placed against the corner guide at the top left. */
export const BED = { w: 230, h: 320 };

export interface Hand {
  label: string;
  note: string;
  family: string;
  /** Some fonts run larger than others; this evens them out. */
  factor: number;
}

export const HANDS: Record<Exclude<HandKey, 'own'>, Hand> = {
  jamie: { label: 'Jamie', note: 'Easy & natural', family: '"Caveat", "Segoe Print", cursive', factor: 1 },
  noah: { label: 'Noah', note: 'Neat & upright', family: '"Kalam", "Segoe Print", cursive', factor: 0.8 },
  lea: { label: 'Lea', note: 'Light & airy', family: '"Shadows Into Light Two", "Segoe Print", cursive', factor: 0.85 },
};

/** Letters someone skipped when teaching their handwriting are written in this style instead. */
export const FALLBACK_HAND = HANDS.jamie;

export const INKS: Record<InkKey, { label: string; color: string; pen: string }> = {
  charcoal: { label: 'Charcoal', color: '#2b2d33', pen: 'Charcoal fineliner 0.4' },
  blue: { label: 'Royal blue', color: '#1d3a9a', pen: 'Royal blue fineliner 0.4' },
  sepia: { label: 'Sepia', color: '#5b3a22', pen: 'Sepia fineliner 0.4' },
};

export const ICON_LABELS: Record<IconKey, string> = {
  leaf: 'Leaf',
  flower: 'Flower',
  heart: 'Heart',
  star: 'Star',
  sparkle: 'Sparkle',
  sun: 'Sun',
  cake: 'Cake',
  gift: 'Gift',
  smile: 'Smile',
  mountain: 'Mountains',
  cup: 'Coffee',
  music: 'Music',
};

/** What the "search for machines" step finds in the prototype. */
export const FOUND_DEVICES: Device[] = [
  { id: 'p1', name: 'plotter P-1', via: 'USB', address: 'COM3' },
  { id: 'p2', name: 'plotter P-2 (Event kit)', via: 'Wi-Fi', address: '192.168.1.42' },
];

/** About how many metres a fineliner writes before it runs dry. */
export const PEN_LIFE_M = 600;

export const APP_VERSION = '1.0.0-prototype';
