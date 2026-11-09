import { useId, useMemo, type ReactElement } from 'react';
import { timeline, type SheetLayout } from '../lib/layout';
import { partial, toPath } from '../lib/strokes';
import type { Pt } from '../types';
import { DRAWINGS } from './PaperIcon';

interface Props {
  sheet: SheetLayout;
  ink: string;
  /** 0–1: how far the pen has got. Leave out to show the finished sheet. */
  progress?: number;
  /** Show the pen while writing. */
  pen?: boolean;
  label: string;
  className?: string;
}

const PEN_WIDTH = 0.42;

/** A sheet of paper drawn in millimetres, optionally half-written with the pen on it. */
export function Sheet({ sheet, ink, progress, pen, label, className }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const spans = useMemo(() => timeline(sheet.marks), [sheet.marks]);
  const p = progress ?? 1;
  const { w, h, printed } = sheet;

  const defs: ReactElement[] = [];
  const items: ReactElement[] = [];
  let penAt: Pt | null = null;

  sheet.marks.forEach((m, i) => {
    const [a, b] = spans[i];
    const lp = p >= b ? 1 : p <= a ? 0 : (p - a) / (b - a);
    if (lp <= 0) return;
    const writing = lp < 1;
    const clipId = `${uid}-${i}`;

    if (m.kind === 'stroke') {
      const pts = writing ? partial(m.pts, lp) : m.pts;
      items.push(<path key={i} d={toPath(pts)} />);
      if (writing) penAt = pts[pts.length - 1];
      return;
    }

    // Text and drawings appear left to right behind the pen.
    const box = m.kind === 'text' ? { x: m.x - 1, y: m.y - m.size * 1.3, w: m.w + 2, h: m.size * 2 } : { x: m.x - 1, y: m.y - 1, w: m.size + 2, h: m.size + 2 };
    if (writing)
      defs.push(
        <clipPath id={clipId} key={clipId}>
          <rect x={box.x} y={box.y} width={box.w * lp} height={box.h} />
        </clipPath>,
      );
    const clip = writing ? `url(#${clipId})` : undefined;

    if (m.kind === 'text') {
      items.push(
        <text key={i} x={m.x} y={m.y} fontFamily={m.family} fontSize={m.size} fill={ink} stroke="none" clipPath={clip}>
          {m.text}
        </text>,
      );
      if (writing) penAt = [m.x + m.w * lp, m.y - m.size * 0.28];
    } else {
      items.push(
        <g key={i} clipPath={clip}>
          <svg x={m.x} y={m.y} width={m.size} height={m.size} viewBox="0 0 24 24" strokeWidth={(PEN_WIDTH * 24) / m.size} overflow="visible">
            {DRAWINGS[m.icon]}
          </svg>
        </g>,
      );
      if (writing) penAt = [m.x + m.size * lp, m.y + m.size * (0.3 + 0.4 * Math.abs(Math.sin(lp * 9)))];
    }
  });

  const stamp = printed.stampBox;

  return (
    <svg className={`sheet ${className ?? ''}`} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${uid}-fold`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.09" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        {defs}
      </defs>
      <rect className="sheet-paper" width={w} height={h} fill={sheet.paper} />
      {printed.fold && <rect width={5} height={h} fill={`url(#${uid}-fold)`} />}
      {printed.lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d8d0b6" strokeWidth={0.3} />
      ))}
      {stamp && !sheet.stamp && (
        <rect x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h} fill="none" stroke="#cfc6aa" strokeWidth={0.3} strokeDasharray="1.2 1" />
      )}
      {stamp && sheet.stamp && (
        <g>
          <rect x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h} fill="#fff" stroke="#c9c2ab" strokeWidth={0.25} strokeDasharray="0.6 0.6" />
          <rect x={stamp.x + 1.6} y={stamp.y + 1.6} width={stamp.w - 3.2} height={stamp.h - 3.2} fill="#e9eefc" />
          <text x={stamp.x + stamp.w / 2} y={stamp.y + stamp.h * 0.58} textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={700} fontSize={stamp.h * 0.42} fill="#1b47d0">
            A
          </text>
          <text x={stamp.x + stamp.w / 2} y={stamp.y + stamp.h * 0.84} textAnchor="middle" fontFamily="Outfit, sans-serif" fontSize={stamp.h * 0.12} fill="#0b1b45">
            1.20
          </text>
        </g>
      )}
      <g fill="none" stroke={ink} strokeWidth={PEN_WIDTH} strokeLinecap="round" strokeLinejoin="round">
        {items}
      </g>
      {pen && penAt && <Pen at={penAt} scale={Math.max(w, h) / 148} />}
    </svg>
  );
}

function Pen({ at, scale }: { at: Pt; scale: number }) {
  return (
    <g className="sheet-pen" transform={`translate(${at[0]} ${at[1]}) scale(${scale}) rotate(24)`} aria-hidden="true">
      <ellipse cx={3.5} cy={1.2} rx={4} ry={1.3} fill="#000" opacity={0.08} />
      <path d="M0 0 L-1.15 -3.4 L1.15 -3.4 Z" fill="#22305c" />
      <rect x={-1.9} y={-19} width={3.8} height={15.8} rx={0.9} fill="#0b1b45" />
      <rect x={-1.9} y={-7} width={3.8} height={1.4} fill="#4d74ff" />
    </g>
  );
}
