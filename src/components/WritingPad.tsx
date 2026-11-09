import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PAD, toPath } from '../lib/strokes';
import type { Pt, Stroke } from '../types';

interface Props {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  ink: string;
  /** "letter" shows the lines letters sit on; "free" is a blank square for drawings. */
  guides: 'letter' | 'free';
  label: string;
  className?: string;
}

const S = PAD.size;
const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.min(S, Math.max(0, n));

/** Draw with a finger, stylus or mouse. Works inside the scaled machine screen too. */
export function WritingPad({ strokes, onChange, ink, guides, label, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const liveRef = useRef<Stroke | null>(null);
  const [live, setLive] = useState<Stroke | null>(null);

  const toPt = (e: { clientX: number; clientY: number }): Pt => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [round(clamp(p.x)), round(clamp(p.y))];
  };

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* not every pointer can be captured (e.g. synthetic events); drawing still works */
    }
    liveRef.current = [toPt(e)];
    setLive(liveRef.current);
  };

  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    const s = liveRef.current;
    if (!s) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const pt = toPt(ev);
      const last = s[s.length - 1];
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 1.6) s.push(pt);
    }
    setLive([...s]);
  };

  const up = () => {
    const s = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (!s) return;
    // A tap is a dot (for i, j, full stops).
    if (s.length === 1) s.push([s[0][0] + 0.8, s[0][1] + 0.8]);
    onChange([...strokes, s]);
  };

  return (
    <svg
      ref={svgRef}
      className={`pad pad-${guides} ${className ?? ''}`}
      viewBox={`0 0 ${S} ${S}`}
      role="img"
      aria-label={label}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <rect width={S} height={S} className="pad-bg" />
      {guides === 'letter' && (
        <g className="pad-guides">
          <line x1={0} x2={S} y1={PAD.asc} y2={PAD.asc} className="g-asc" />
          <line x1={0} x2={S} y1={PAD.xh} y2={PAD.xh} className="g-xh" />
          <line x1={0} x2={S} y1={PAD.base} y2={PAD.base} className="g-base" />
          <line x1={0} x2={S} y1={PAD.desc} y2={PAD.desc} className="g-desc" />
          <text x={6} y={PAD.asc - 5}>tall letters</text>
          <text x={6} y={PAD.xh - 5}>small letters</text>
          <text x={6} y={PAD.base - 5}>line</text>
        </g>
      )}
      <g fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
        {strokes.map((s, i) => (
          <path key={i} d={toPath(s)} />
        ))}
        {live && <path d={toPath(live)} />}
      </g>
    </svg>
  );
}

/** Small preview of a drawn letter, on the same lines as the pad. */
export function GlyphThumb({ strokes, ink }: { strokes: Stroke[]; ink: string }) {
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="glyph-thumb" aria-hidden="true">
      <line x1={0} x2={S} y1={PAD.base} y2={PAD.base} stroke="#c9d3ee" strokeWidth={4} />
      <g fill="none" stroke={ink} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round">
        {strokes.map((s, i) => (
          <path key={i} d={toPath(s)} />
        ))}
      </g>
    </svg>
  );
}
