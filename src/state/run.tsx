import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFonts } from '../lib/hooks';
import { cardSeconds, layoutDesign, type DesignLayout } from '../lib/layout';
import type { Project } from '../types';
import { useStore } from './store';

export type RunStatus = 'idle' | 'writing' | 'paused' | 'paper' | 'done' | 'stopped';

export interface RunState {
  projectId: string | null;
  /** Row ids to write, or `copy-1`, `copy-2`… when the design has no fields. */
  queue: string[];
  index: number;
  status: RunStatus;
  /** How far the current card is, 0–1. */
  progress: number;
  written: number;
}

const IDLE: RunState = { projectId: null, queue: [], index: 0, status: 'idle', progress: 0, written: 0 };

interface RunApi {
  run: RunState;
  /** The card being written right now. */
  current: DesignLayout | null;
  currentLabel: string;
  /** Seconds the machine really needs for the cards still in the queue. */
  secondsLeft: number;
  demo: boolean;
  pauseEach: boolean;
  setDemo: (on: boolean) => void;
  setPauseEach: (on: boolean) => void;
  start: (projectId: string, queue: string[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skip: () => void;
  nextSheet: () => void;
  enqueue: (projectId: string, id: string) => void;
  reset: () => void;
}

const RunContext = createContext<RunApi | null>(null);

/** Cells of a queue entry (a guest), or none for plain copies. */
export function cellsFor(p: Project, id: string) {
  return p.rows.find((r) => r.id === id)?.cells ?? null;
}

export function labelFor(p: Project, id: string) {
  if (id.startsWith('copy-')) return `Copy ${id.slice(5)}`;
  const cells = cellsFor(p, id);
  if (!cells) return '';
  return Object.values(cells).find((v) => v.trim()) ?? '(empty)';
}

/** Writes the queue card after card, faster than real time in demo mode. Keeps going while you look at other pages. */
export function RunProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore();
  const fonts = useFonts();
  const [run, setRunState] = useState<RunState>(IDLE);
  const [demo, setDemo] = useState(true);
  const [pauseEach, setPauseEach] = useState(false);
  const runRef = useRef(run);
  const setRun = useCallback((next: RunState) => {
    runRef.current = next;
    setRunState(next);
  }, []);

  const project = state.projects.find((p) => p.id === run.projectId) ?? null;
  const currentId = run.queue[run.index] ?? null;

  const current = useMemo(
    () => (project && currentId ? layoutDesign(project, state.glyphs, cellsFor(project, currentId)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project?.items, project?.paper, project?.hand, project?.rows, currentId, state.glyphs, fonts],
  );
  const realSeconds = current ? cardSeconds(current, state.machine.speed) : 0;
  const durationMs = demo ? Math.max(2200, (realSeconds * 1000) / 10) : realSeconds * 1000;
  const durRef = useRef(durationMs);
  durRef.current = durationMs;

  const finishRef = useRef<(r: RunState) => void>(() => {});
  finishRef.current = (r: RunState) => {
    const id = r.queue[r.index];
    if (!r.projectId || !id) return;
    if (id.startsWith('copy-')) dispatch({ type: 'COPY_DONE', projectId: r.projectId });
    else dispatch({ type: 'ROW_STATUS', projectId: r.projectId, rowId: id, status: 'done' });
    dispatch({ type: 'WROTE', metres: Math.round(realSeconds * state.machine.speed) / 1000 });
  };

  useEffect(() => {
    if (run.status !== 'writing') return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const r = runRef.current;
      if (r.status !== 'writing') return;
      const progress = r.progress + (now - last) / durRef.current;
      last = now;
      if (progress >= 1) {
        finishRef.current(r);
        const index = r.index + 1;
        const done = index >= r.queue.length;
        setRun({ ...r, index, progress: 0, written: r.written + 1, status: done ? 'done' : pauseEach ? 'paper' : 'writing' });
        if (done || pauseEach) return;
      } else setRun({ ...r, progress });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run.status, pauseEach, setRun]);

  // Rough total for what's left: the current card's time for each remaining card.
  const remaining = Math.max(0, run.queue.length - run.index - run.progress);
  const secondsLeft = run.status === 'done' || run.status === 'idle' ? 0 : remaining * realSeconds;

  const api: RunApi = {
    run,
    current,
    currentLabel: project && currentId ? labelFor(project, currentId) : '',
    secondsLeft,
    demo,
    pauseEach,
    setDemo,
    setPauseEach,
    start: (projectId, queue) => setRun({ projectId, queue, index: 0, status: queue.length ? 'writing' : 'idle', progress: 0, written: 0 }),
    pause: () => run.status === 'writing' && setRun({ ...runRef.current, status: 'paused' }),
    resume: () => run.status === 'paused' && setRun({ ...runRef.current, status: 'writing' }),
    stop: () => setRun({ ...runRef.current, status: 'stopped', progress: 0 }),
    skip: () => {
      const r = runRef.current;
      const id = r.queue[r.index];
      if (r.projectId && id && !id.startsWith('copy-')) dispatch({ type: 'ROW_STATUS', projectId: r.projectId, rowId: id, status: 'skipped' });
      const index = r.index + 1;
      setRun({ ...r, index, progress: 0, status: index >= r.queue.length ? 'done' : r.status === 'paper' ? 'writing' : r.status });
    },
    nextSheet: () => run.status === 'paper' && setRun({ ...runRef.current, status: 'writing' }),
    enqueue: (projectId, id) => {
      const r = runRef.current;
      const busy = r.projectId === projectId && (r.status === 'writing' || r.status === 'paused' || r.status === 'paper');
      // Straight after the card that's being written (or first, when waiting for the next card).
      const at = r.status === 'paper' ? r.index : r.index + 1;
      if (busy) setRun({ ...r, queue: [...r.queue.slice(0, at), id, ...r.queue.slice(at)] });
      else setRun({ projectId, queue: [id], index: 0, status: 'writing', progress: 0, written: 0 });
    },
    reset: () => setRun(IDLE),
  };

  return <RunContext.Provider value={api}>{children}</RunContext.Provider>;
}

export function useRun() {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error('useRun outside RunProvider');
  return ctx;
}
