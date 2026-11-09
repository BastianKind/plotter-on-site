import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import { BED, PAPERS } from '../data/catalog';
import { newId, projectFrom, rowsFrom, sampleProjects } from '../data/templates';
import { fitOnPaper } from '../lib/geometry';
import type { Device, Glyphs, InkKey, Item, Page, Project, Row, Stroke, TemplateKey } from '../types';

export interface MachineState {
  device: Device | null;
  /** Pen position on the bed, mm from the top-left corner guide. */
  x: number;
  y: number;
  penDown: boolean;
  /** Where the paper's top-left corner is on the bed. */
  origin: { x: number; y: number };
  /** Writing speed in mm/s. */
  speed: number;
  /** How high the pen lifts between strokes, mm. */
  lift: number;
  pen: InkKey;
  /** Metres written with the pen that's in the machine. */
  used: number;
  cards: number;
  calibrated: string;
}

export interface State {
  page: Page;
  projects: Project[];
  activeId: string | null;
  selectedId: string | null;
  /** Which guest the design preview shows (-1: show the fields themselves). */
  previewIndex: number;
  past: Item[][];
  future: Item[][];
  /** A drag or text edit is going on; the state before it is already in `past`. */
  pending: boolean;
  glyphs: Glyphs;
  machine: MachineState;
}

const INITIAL: State = {
  page: 'projects',
  projects: sampleProjects(),
  activeId: null,
  selectedId: null,
  previewIndex: 0,
  past: [],
  future: [],
  pending: false,
  glyphs: {},
  machine: {
    device: null,
    x: 0,
    y: 0,
    penDown: false,
    origin: { x: 12, y: 12 },
    speed: 40,
    lift: 4,
    pen: 'charcoal',
    used: 312,
    cards: 1284,
    calibrated: 'Today, 08:52',
  },
};

export type Action =
  | { type: 'GO'; page: Page }
  | { type: 'OPEN'; id: string; page?: Page }
  | { type: 'CREATE'; template: TemplateKey; name: string; examples: boolean }
  | { type: 'RENAME'; id: string; name: string }
  | { type: 'DUPLICATE'; id: string }
  | { type: 'DELETE'; id: string }
  | { type: 'PROJECT'; patch: Partial<Pick<Project, 'paper' | 'hand' | 'ink' | 'copies' | 'name'>> }
  | { type: 'SELECT'; id: string | null }
  | { type: 'ADD_ITEM'; item: Item }
  | { type: 'UPDATE_ITEM'; id: string; patch: Partial<Item>; commit?: boolean }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'BEGIN_CHANGE' }
  | { type: 'END_CHANGE' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_PREVIEW'; index: number }
  | { type: 'ADD_ROW'; cells?: Record<string, string> }
  | { type: 'UPDATE_CELL'; rowId: string; key: string; value: string }
  | { type: 'REMOVE_ROW'; rowId: string }
  | { type: 'INSERT_ROWS'; rows: Record<string, string>[]; replace: boolean }
  | { type: 'ROW_STATUS'; projectId: string; rowId: string; status: Row['status'] }
  | { type: 'RESET_STATUS'; projectId: string }
  | { type: 'COPY_DONE'; projectId: string }
  | { type: 'SET_GLYPH'; ch: string; strokes: Stroke[] }
  | { type: 'CONNECT'; device: Device }
  | { type: 'DISCONNECT' }
  | { type: 'JOG'; dx: number; dy: number }
  | { type: 'MOVE_TO'; x: number; y: number }
  | { type: 'PEN'; down: boolean }
  | { type: 'SET_ORIGIN' }
  | { type: 'MACHINE'; patch: Partial<MachineState> }
  | { type: 'WROTE'; metres: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function active(s: State) {
  return s.projects.find((p) => p.id === s.activeId) ?? null;
}

function patchProject(s: State, id: string | null, fn: (p: Project) => Project): State {
  if (!id) return s;
  return { ...s, projects: s.projects.map((p) => (p.id === id ? { ...fn(p), updated: Date.now() } : p)) };
}

/** Change the open project's items, remembering the old ones for undo. */
function changeItems(s: State, fn: (items: Item[]) => Item[], remember = true): State {
  const p = active(s);
  if (!p) return s;
  const next = patchProject(s, p.id, (x) => ({ ...x, items: fn(x.items) }));
  return remember ? { ...next, past: [...s.past.slice(-60), p.items], future: [] } : next;
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'GO':
      return { ...s, page: a.page };
    case 'OPEN':
      if (a.id === s.activeId) return { ...s, page: a.page ?? 'design' };
      return { ...s, activeId: a.id, page: a.page ?? 'design', selectedId: null, previewIndex: 0, past: [], future: [], pending: false };
    case 'CREATE': {
      const p = projectFrom(a.template, a.name, a.examples);
      return { ...s, projects: [p, ...s.projects], activeId: p.id, page: 'design', selectedId: null, previewIndex: 0, past: [], future: [] };
    }
    case 'RENAME':
      return patchProject(s, a.id, (p) => ({ ...p, name: a.name }));
    case 'DUPLICATE': {
      const src = s.projects.find((p) => p.id === a.id);
      if (!src) return s;
      const copy: Project = {
        ...src,
        id: newId('p'),
        name: `${src.name} (copy)`,
        items: src.items.map((it) => ({ ...it, id: newId('item') })),
        rows: src.rows.map((r) => ({ ...r, id: newId('row'), status: 'todo' })),
        copiesDone: 0,
        updated: Date.now(),
      };
      return { ...s, projects: [copy, ...s.projects] };
    }
    case 'DELETE':
      return { ...s, projects: s.projects.filter((p) => p.id !== a.id), activeId: s.activeId === a.id ? null : s.activeId, page: s.activeId === a.id ? 'projects' : s.page };
    case 'PROJECT': {
      const paper = a.patch.paper ? PAPERS[a.patch.paper] : null;
      // A smaller paper pulls everything back onto the card.
      return patchProject(s, s.activeId, (p) => ({
        ...p,
        ...a.patch,
        items: paper ? p.items.map((it) => ({ ...it, ...fitOnPaper(it, paper.w, paper.h) })) : p.items,
      }));
    }
    case 'SELECT':
      return { ...s, selectedId: a.id };
    case 'ADD_ITEM':
      return { ...changeItems(s, (items) => [...items, a.item]), selectedId: a.item.id };
    case 'UPDATE_ITEM':
      return changeItems(s, (items) => items.map((it) => (it.id === a.id ? ({ ...it, ...a.patch } as Item) : it)), !!a.commit && !s.pending);
    case 'REMOVE_ITEM':
      return { ...changeItems(s, (items) => items.filter((it) => it.id !== a.id)), selectedId: s.selectedId === a.id ? null : s.selectedId };
    case 'BEGIN_CHANGE': {
      const p = active(s);
      if (!p || s.pending) return s;
      return { ...s, pending: true, past: [...s.past.slice(-60), p.items], future: [] };
    }
    case 'END_CHANGE': {
      if (!s.pending) return s;
      // Nothing changed after all: forget the undo step.
      const p = active(s);
      const last = s.past[s.past.length - 1];
      if (p && last && JSON.stringify(last) === JSON.stringify(p.items)) return { ...s, pending: false, past: s.past.slice(0, -1) };
      return { ...s, pending: false };
    }
    case 'UNDO': {
      const p = active(s);
      if (!p || !s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { ...patchProject(s, p.id, (x) => ({ ...x, items: prev })), past: s.past.slice(0, -1), future: [p.items, ...s.future], pending: false };
    }
    case 'REDO': {
      const p = active(s);
      if (!p || !s.future.length) return s;
      const [next, ...rest] = s.future;
      return { ...patchProject(s, p.id, (x) => ({ ...x, items: next })), past: [...s.past, p.items], future: rest, pending: false };
    }
    case 'SET_PREVIEW':
      return { ...s, previewIndex: a.index };
    case 'ADD_ROW':
      return patchProject(s, s.activeId, (p) => ({ ...p, rows: [...p.rows, ...rowsFrom([a.cells ?? {}])] }));
    case 'UPDATE_CELL':
      return patchProject(s, s.activeId, (p) => ({
        ...p,
        rows: p.rows.map((r) => (r.id === a.rowId ? { ...r, cells: { ...r.cells, [a.key]: a.value } } : r)),
      }));
    case 'REMOVE_ROW':
      return patchProject(s, s.activeId, (p) => ({ ...p, rows: p.rows.filter((r) => r.id !== a.rowId) }));
    case 'INSERT_ROWS':
      return patchProject(s, s.activeId, (p) => ({ ...p, rows: [...(a.replace ? [] : p.rows), ...rowsFrom(a.rows)] }));
    case 'ROW_STATUS':
      return patchProject(s, a.projectId, (p) => ({ ...p, rows: p.rows.map((r) => (r.id === a.rowId ? { ...r, status: a.status } : r)) }));
    case 'RESET_STATUS':
      return patchProject(s, a.projectId, (p) => ({ ...p, rows: p.rows.map((r) => ({ ...r, status: 'todo' })), copiesDone: 0 }));
    case 'COPY_DONE':
      return patchProject(s, a.projectId, (p) => ({ ...p, copiesDone: p.copiesDone + 1 }));
    case 'SET_GLYPH': {
      const glyphs = { ...s.glyphs };
      if (a.strokes.length) glyphs[a.ch] = a.strokes;
      else delete glyphs[a.ch];
      return { ...s, glyphs };
    }
    case 'CONNECT':
      return { ...s, machine: { ...s.machine, device: a.device, x: 0, y: 0, penDown: false } };
    case 'DISCONNECT':
      return { ...s, machine: { ...s.machine, device: null } };
    case 'JOG':
      return { ...s, machine: { ...s.machine, x: round1(clamp(s.machine.x + a.dx, 0, BED.w)), y: round1(clamp(s.machine.y + a.dy, 0, BED.h)) } };
    case 'MOVE_TO':
      return { ...s, machine: { ...s.machine, x: round1(clamp(a.x, 0, BED.w)), y: round1(clamp(a.y, 0, BED.h)), penDown: false } };
    case 'PEN':
      return { ...s, machine: { ...s.machine, penDown: a.down } };
    case 'SET_ORIGIN':
      return { ...s, machine: { ...s.machine, origin: { x: s.machine.x, y: s.machine.y }, calibrated: 'Just now' } };
    case 'MACHINE':
      return { ...s, machine: { ...s.machine, ...a.patch } };
    case 'WROTE':
      return { ...s, machine: { ...s.machine, used: s.machine.used + a.metres, cards: s.machine.cards + 1 } };
  }
}

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

export function useProject() {
  const { state } = useStore();
  return state.projects.find((p) => p.id === state.activeId) ?? null;
}
