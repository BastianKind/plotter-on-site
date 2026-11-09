import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { ConnectModal } from '../components/Connect';
import { PenChangeModal } from '../components/PenChange';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { UiIcon, type UiIconName } from '../components/UiIcon';
import { BED, INKS, PAPERS, PEN_LIFE_M } from '../data/catalog';
import { useFonts, useOnce } from '../lib/hooks';
import { makeWriter, type SheetLayout } from '../lib/layout';
import { densify, length } from '../lib/strokes';
import { useRun } from '../state/run';
import { useProject, useStore } from '../state/store';
import type { Pt } from '../types';

const STEPS = [0.1, 1, 10];

function testPattern(): SheetLayout {
  const marks: SheetLayout['marks'] = [];
  const square = densify([
    [8, 8],
    [38, 8],
    [38, 38],
    [8, 38],
    [8, 8],
  ]);
  const circle: Pt[] = Array.from({ length: 49 }, (_, i) => [62 + 15 * Math.cos((i / 48) * Math.PI * 2), 23 + 15 * Math.sin((i / 48) * Math.PI * 2)] as Pt);
  const lines: Pt[][] = Array.from({ length: 5 }, (_, i) => [
    [8, 46 + i * 2.5],
    [78, 46 + i * 2.5],
  ]);
  for (const pts of [square, circle, ...lines]) marks.push({ kind: 'stroke', pts, len: length(pts) });
  makeWriter('jamie', {}, 7).write('Hello from plotter', 8, 72, marks);
  return { w: 86, h: 80, paper: '#fdfbf4', marks, printed: { lines: [], stampBox: null, fold: false }, stamp: false, overflow: false };
}

export function MachinePage() {
  const { state, dispatch } = useStore();
  const { run } = useRun();
  const toast = useToast();
  const project = useProject();
  const fonts = useFonts();
  const m = state.machine;
  const connected = !!m.device;
  const busy = ['writing', 'paused', 'paper'].includes(run.status);
  const locked = !connected || busy;
  const [step, setStep] = useState(1);
  const [connect, setConnect] = useState(false);
  const [pen, setPen] = useState(false);
  const [testKey, setTestKey] = useState<number | null>(null);
  const test = useOnce(5000, testKey);
  const pattern = useMemo(testPattern, [fonts]); // eslint-disable-line react-hooks/exhaustive-deps
  const paper = PAPERS[project?.paper ?? 'a6'];
  const scale = 1.15; // px per mm in the bed view

  useEffect(() => {
    if (testKey && test >= 1) toast('Test pattern done. Lines should be straight and the circle round.', 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test >= 1]);

  const jog = (dx: number, dy: number) => !locked && dispatch({ type: 'JOG', dx: dx * step, dy: dy * step });
  const onBedKey = (e: KeyboardEvent) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const mv = moves[e.key];
    if (!mv) return;
    e.preventDefault();
    jog(mv[0], mv[1]);
  };

  return (
    <div className="page-scroll">
      <div className="page-head">
        <div>
          <h1>Machine</h1>
          <p className="muted">
            {connected ? (
              <>
                <span className="dot dot-ok" /> {m.device!.name} · {m.device!.via} {m.device!.address} · {busy ? 'busy writing' : 'ready'}
              </>
            ) : (
              <>
                <span className="dot dot-off" /> Not connected
              </>
            )}
          </p>
        </div>
        {connected ? (
          <button type="button" className="btn btn-secondary" onClick={() => (dispatch({ type: 'DISCONNECT' }), toast('Disconnected.'))}>
            <UiIcon name="unlink" />
            Disconnect
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setConnect(true)}>
            <UiIcon name="link" />
            Connect a machine
          </button>
        )}
      </div>

      {busy && (
        <div className="callout">
          <UiIcon name="pen" size={20} />
          <div>The machine is writing right now. Moving the pen by hand is locked until it’s done or stopped.</div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => run.projectId && dispatch({ type: 'OPEN', id: run.projectId, page: 'write' })}>
            Go to writing
          </button>
        </div>
      )}

      <div className="machine-grid">
        <section className="card-box">
          <h2 className="card-title">Move the pen</h2>
          <div className="jog-layout">
            <div className="bed-view" tabIndex={0} onKeyDown={onBedKey} aria-label={`Machine bed. Pen at X ${m.x} mm, Y ${m.y} mm. Arrow keys move the pen.`} style={{ width: BED.w * scale, height: BED.h * scale }}>
              <svg viewBox={`0 0 ${BED.w} ${BED.h}`} width="100%" height="100%" aria-hidden="true">
                <defs>
                  <pattern id="bedgrid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M10 0H0V10" fill="none" stroke="#d3dae8" strokeWidth="0.4" />
                  </pattern>
                </defs>
                <rect width={BED.w} height={BED.h} fill="url(#bedgrid)" />
                <path d="M0 0H30M0 0V30" stroke="#22305c" strokeWidth="2" />
                <rect x={m.origin.x} y={m.origin.y} width={paper.w} height={paper.h} fill="#fdfbf4" stroke="#c9c1a5" strokeWidth="0.6" />
                <text x={m.origin.x + 3} y={m.origin.y + paper.h - 3} fontSize="6" fill="#9a947e">
                  {paper.label}
                </text>
                <g className="bed-pen" style={{ transform: `translate(${m.x}px, ${m.y}px)` }}>
                  <circle r={m.penDown ? 2.4 : 4} fill={m.penDown ? INKS[m.pen].color : 'none'} stroke={INKS[m.pen].color} strokeWidth="1" />
                  <path d="M-8 0H-5M5 0H8M0 -8V-5M0 5V8" stroke="#1b47d0" strokeWidth="1" />
                </g>
              </svg>
            </div>
            <div className="jog-controls">
              <p className="pos">
                X <strong>{m.x.toFixed(1)}</strong> · Y <strong>{m.y.toFixed(1)}</strong> mm
              </p>
              <div className="jog-pad" role="group" aria-label="Move the pen">
                {(
                  [
                    ['arrowUp', 0, -1, 'up'],
                    ['arrowLeft', -1, 0, 'left'],
                    ['home', 0, 0, 'home'],
                    ['arrowRight', 1, 0, 'right'],
                    ['arrowDown', 0, 1, 'down'],
                  ] as [UiIconName, number, number, string][]
                ).map(([icon, dx, dy, label]) => (
                  <button
                    key={label}
                    type="button"
                    className={`jog jog-${label}`}
                    disabled={locked}
                    aria-label={label === 'home' ? 'Home: back to the corner' : `Move ${label}`}
                    title={label === 'home' ? 'Home' : undefined}
                    onClick={() => (label === 'home' ? dispatch({ type: 'MOVE_TO', x: 0, y: 0 }) : jog(dx, dy))}
                  >
                    <UiIcon name={icon} />
                  </button>
                ))}
              </div>
              <div className="seg seg-sm seg-block" role="radiogroup" aria-label="Step">
                {STEPS.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={step === s} className={step === s ? 'is-on' : ''} onClick={() => setStep(s)}>
                    {s} mm
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-secondary btn-block" disabled={locked} onClick={() => dispatch({ type: 'PEN', down: !m.penDown })}>
                <UiIcon name={m.penDown ? 'penUp' : 'penDown'} />
                {m.penDown ? 'Lift the pen' : 'Lower the pen'}
              </button>
              <button type="button" className="btn btn-secondary btn-block" disabled={locked} onClick={() => dispatch({ type: 'MOVE_TO', x: m.origin.x, y: m.origin.y })}>
                <UiIcon name="target" />
                Go to the paper corner
              </button>
              <div className="calib">
                <p className="small">
                  <strong>Paper corner</strong> at X {m.origin.x.toFixed(1)} · Y {m.origin.y.toFixed(1)}
                  <br />
                  <span className="muted">Set: {m.calibrated}</span>
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={locked}
                  onClick={() => {
                    dispatch({ type: 'SET_ORIGIN' });
                    toast('Paper corner saved. Cards are now written from here.', 'success');
                  }}
                >
                  <UiIcon name="corner" />
                  Set paper corner here
                </button>
                <p className="tiny">Move the pen tip exactly onto the top-left corner of a card, then save it.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="machine-side">
          <section className="card-box">
            <h2 className="card-title">Writing</h2>
            <label className="slider">
              <span>
                Speed <strong>{m.speed} mm/s</strong>
              </span>
              <input type="range" min={20} max={80} step={5} value={m.speed} onChange={(e) => dispatch({ type: 'MACHINE', patch: { speed: Number(e.target.value) } })} />
              <span className="slider-ends">
                <span>Neater</span>
                <span>Faster</span>
              </span>
            </label>
            <label className="slider">
              <span>
                Pen lift <strong>{m.lift} mm</strong>
              </span>
              <input type="range" min={2} max={8} step={0.5} value={m.lift} onChange={(e) => dispatch({ type: 'MACHINE', patch: { lift: Number(e.target.value) } })} />
              <span className="slider-ends">
                <span>Quieter</span>
                <span>Clears thick cards</span>
              </span>
            </label>
            <div className="test">
              <div className="test-sheet">
                <Sheet sheet={pattern} ink={INKS[m.pen].color} progress={testKey ? test : 0} pen={testKey !== null && test < 1} label="Test pattern" />
              </div>
              <div>
                <p className="small muted">Draws a square, a circle and a line of text on a spare card, to check the pen and the belts.</p>
                <button type="button" className="btn btn-secondary btn-sm" disabled={locked} onClick={() => setTestKey(Date.now())}>
                  <UiIcon name="play" />
                  Draw test pattern
                </button>
              </div>
            </div>
          </section>

          <section className="card-box">
            <h2 className="card-title">Pen</h2>
            <div className="pen-row">
              <span className="ink-dot lg" style={{ background: INKS[m.pen].color }} />
              <div>
                <strong>{INKS[m.pen].pen}</strong>
                <span className="muted small">
                  {Math.round(m.used)} m of about {PEN_LIFE_M} m written
                </span>
              </div>
            </div>
            <div className="meter" aria-label={`Pen used ${Math.round((m.used / PEN_LIFE_M) * 100)} %`}>
              <span style={{ width: `${Math.min(100, (m.used / PEN_LIFE_M) * 100)}%` }} className={m.used / PEN_LIFE_M > 0.8 ? 'is-low' : ''} />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setPen(true)}>
              <UiIcon name="refresh" />
              Change the pen
            </button>
          </section>

          <section className="card-box">
            <h2 className="card-title">About this machine</h2>
            <dl className="facts">
              <dt>Name</dt>
              <dd>{m.device?.name ?? '–'}</dd>
              <dt>Firmware</dt>
              <dd>{connected ? '1.2.0 (up to date)' : '–'}</dd>
              <dt>Writing area</dt>
              <dd>
                {BED.w} × {BED.h} mm
              </dd>
              <dt>Cards written</dt>
              <dd>{m.cards.toLocaleString('de-CH')}</dd>
            </dl>
          </section>
        </div>
      </div>

      <ConnectModal open={connect} onClose={() => setConnect(false)} />
      <PenChangeModal open={pen} onClose={() => setPen(false)} />
    </div>
  );
}
