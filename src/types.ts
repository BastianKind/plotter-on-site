export type Page = 'projects' | 'design' | 'data' | 'write' | 'machine' | 'settings';

export type HandKey = 'jamie' | 'noah' | 'lea' | 'own';
export type InkKey = 'charcoal' | 'blue' | 'sepia';
export type Align = 'left' | 'center' | 'right';
export type PaperKey = 'place' | 'badge' | 'a6' | 'a6l' | 'c6' | 'dl' | 'a5';
export type TemplateKey = 'place' | 'badge' | 'thanks' | 'envelope' | 'menu' | 'blank';

export type IconKey =
  | 'sun'
  | 'flower'
  | 'leaf'
  | 'star'
  | 'mountain'
  | 'sparkle'
  | 'heart'
  | 'smile'
  | 'gift'
  | 'cake'
  | 'cup'
  | 'music';

/** A point on a writing pad or on paper. */
export type Pt = [number, number];
/** One pen-down movement. */
export type Stroke = Pt[];
/** Someone's own letters, drawn on the writing pad: character → strokes in pad units. */
export type Glyphs = Record<string, Stroke[]>;

/** Position and size on the paper, in millimetres. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Item =
  | (Box & { id: string; kind: 'text'; text: string; size: number; align: Align })
  | (Box & { id: string; kind: 'icon'; icon: IconKey })
  | (Box & { id: string; kind: 'doodle'; strokes: Stroke[] });

/** One line of the guest list. `cells` holds a value per field used in the design, e.g. { name: 'Anna' }. */
export interface Row {
  id: string;
  cells: Record<string, string>;
  status: 'todo' | 'done' | 'skipped';
}

export interface Project {
  id: string;
  name: string;
  template: TemplateKey;
  paper: PaperKey;
  items: Item[];
  hand: HandKey;
  ink: InkKey;
  rows: Row[];
  /** Only used when the design has no fields: every card is the same. */
  copies: number;
  copiesDone: number;
  updated: number;
}

export interface Device {
  id: string;
  name: string;
  via: 'USB' | 'Wi-Fi';
  address: string;
}
