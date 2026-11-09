import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { resetMeasurements } from './layout';

const HAND_FONTS = ['Caveat', 'Kalam', 'Shadows Into Light Two'];

/** Bumps a number once the handwriting fonts are loaded, so text gets measured again. */
export function useFontsLoaded() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    const bump = () => {
      if (!alive) return;
      resetMeasurements();
      setVersion((v) => v + 1);
    };
    Promise.allSettled(HAND_FONTS.map((f) => document.fonts.load(`40px "${f}"`))).then(bump);
    document.fonts.addEventListener('loadingdone', bump);
    return () => {
      alive = false;
      document.fonts.removeEventListener('loadingdone', bump);
    };
  }, []);
  return version;
}

export const FontsContext = createContext(0);
export const useFonts = () => useContext(FontsContext);

/** Pop-ups render into document.body in this app. */
export const usePortal = (): HTMLElement | null => null;

/** Calls `fn` every `ms` while active; the latest `fn` is always used. */
export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

/** A value from 0 to 1 that runs once over `ms` whenever `key` changes (null: stopped at 0). */
export function useOnce(ms: number, key: unknown) {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (key === null || key === undefined) {
      setP(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const v = Math.min(1, (now - start) / ms);
      setP(v);
      if (v < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms, key]);
  return p;
}

/** Element size, updated when it changes. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function timeAgo(t: number) {
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}
