import { useEffect, useMemo, useRef, useState } from 'react';
import { ConnectModal } from '../components/Connect';
import { Modal } from '../components/Modal';
import { PenChangeModal } from '../components/PenChange';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { UiIcon } from '../components/UiIcon';
import { HANDS, INKS, PAPERS } from '../data/catalog';
import { useFonts, useOnce } from '../lib/hooks';
import { cardSeconds, fieldLabel, fieldsOf, formatDuration, layoutDesign, outlineLayout } from '../lib/layout';
import { cellsFor, labelFor, useRun } from '../state/run';
import { useStore } from '../state/store';
import type { Project } from '../types';

type Filter = 'todo' | 'done' | 'all';

export function WritePage({ project }: { project: Project }) {
  const { state, dispatch } = useStore();
  const api = useRun();
  const { run } = api;
  const toast = useToast();
  const fonts = useFonts();
  const fields = fieldsOf(project.items);
  const paper = PAPERS[project.paper];
  const connected = !!state.machine.device;
  const busyStates = ['writing', 'paused', 'paper'];
  const mine = run.projectId === project.id;
  const active = mine && busyStates.includes(run.status);
  const otherBusy = !mine && busyStates.includes(run.status);
  const otherName = state.projects.find((p) => p.id === run.projectId)?.name;

  const [filter, setFilter] = useState<Filter>('todo');
  const [picked, setPicked] = useState<string | null>(null);
  const [preflight, setPreflight] = useState(false);
  const [stopAsk, setStopAsk] = useState(false);
  const [connect, setConnect] = useState(false);
  const [live, setLive] = useState('');

  // What there is to write: one entry per guest, or numbered copies when the design has no fields.
  const entries = useMemo(() => {
    if (fields.length) return project.rows.map((r) => ({ id: r.id, status: r.status }));
    return Array.from({ length: project.copies }, (_, i) => ({ id: `copy-${i + 1}`, status: (i < project.copiesDone ? 'done' : 'todo') as 'done' | 'todo' }));
  }, [fields.length, project.rows, project.copies, project.copiesDone]);
  const todo = entries.filter((e) => e.status !== 'done');
  const filtered = entries.filter((e) => filter === 'all' || (filter === 'done' ? e.status === 'done' : e.status !== 'done'));
  // While writing, list the cards in the order the machine will write them (a guest added live comes next).
  const pos = (id: string) => (active && run.queue.includes(id) ? run.queue.indexOf(id) : Infinity);
  const shown = active && filter !== 'done' ? [...filtered].sort((a, b) => pos(a.id) - pos(b.id)) : filtered;

  const previewId = active ? null : picked ?? todo[0]?.id ?? entries[0]?.id ?? null;
  const preview = useMemo(
    () => layoutDesign(project, state.glyphs, previewId ? cellsFor(project, previewId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.items, project.paper, project.hand, project.rows, previewId, state.glyphs, fonts],
  );
  const sheet = active && api.current ? api.current : preview;
  const perCard = cardSeconds(preview, state.machine.speed);
  const total = todo.length * perCard;

  // Space bar: pause, carry on, or go on with the next card.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement).closest('input, textarea, button, select') || document.querySelector('.modal-backdrop')) return;
      e.preventDefault();
      if (run.status === 'writing') api.pause();
      else if (run.status === 'paused') api.resume();
      else if (run.status === 'paper') api.nextSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, run.status, api]);

  // A guest added on the spot gets an id only once the store has the new row, so remember what to look for.
  const pendingLive = useRef<{ before: Set<string>; value: string } | null>(null);
  const addLive = () => {
    const value = live.trim();
    if (!value) return;
    if (!connected) {
      toast('Connect the machine first.', 'warn');
      setConnect(true);
      return;
    }
    if (otherBusy) {
      toast(`The machine is busy with “${otherName}”.`, 'warn');
      return;
    }
    const before = new Set(project.rows.map((r) => r.id));
    pendingLive.current = { before, value };
    dispatch({ type: 'ADD_ROW', cells: { [fields[0]]: value } });
    setLive('');
  };
  useEffect(() => {
    const p = pendingLive.current;
    if (!p) return;
    const row = project.rows.find((r) => !p.before.has(r.id));
    if (!row) return;
    pendingLive.current = null;
    api.enqueue(project.id, row.id);
    toast(`“${p.value}” is next in line.`, 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.rows]);

  const progressAll = run.queue.length ? (run.index + run.progress) / run.queue.length : 0;
  const statusText = !active
    ? ''
    : run.status === 'paper'
      ? 'Waiting for the next card'
      : `${run.status === 'paused' ? 'Paused at' : 'Writing'} ${api.currentLabel}`;

  return (
    <div className="write">
      <aside className="panel panel-left queue">
        <h2 className="panel-title">
          <UiIcon name="list" size={16} />
          Queue
        </h2>
        {fields.length > 0 && (
          <div className="live">
            <label className="field">
              <span className="field-label">
                <UiIcon name="bolt" size={14} /> Write one now
              </span>
              <span className="live-row">
                <input value={live} placeholder={`${fieldLabel(fields[0])}, then Enter`} onChange={(e) => setLive(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLive()} />
                <button type="button" className="btn btn-primary btn-sm" onClick={addLive} disabled={!live.trim()} aria-label="Add and write">
                  <UiIcon name="plus" />
                </button>
              </span>
            </label>
            <p className="tiny">For guests who turn up on the day: added to the list and written next.</p>
          </div>
        )}
        <div className="seg seg-block seg-sm" role="radiogroup" aria-label="Show">
          {(
            [
              ['todo', `To write (${todo.length})`],
              ['done', `Written (${entries.length - todo.length})`],
              ['all', 'All'],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
        <ul className="queue-list">
          {shown.map((e) => {
            const now = active && run.queue[run.index] === e.id;
            const queued = active && run.queue.indexOf(e.id) > run.index;
            const cells = cellsFor(project, e.id);
            const second = cells && fields[1] ? cells[fields[1]] : '';
            return (
              <li key={e.id}>
                <button type="button" className={`q-item q-${e.status}${now ? ' is-now' : ''}${previewId === e.id ? ' is-picked' : ''}`} onClick={() => setPicked(e.id)} disabled={active}>
                  <span className="q-icon">{now ? <UiIcon name="pen" size={14} /> : e.status === 'done' ? <UiIcon name="check" size={14} /> : e.status === 'skipped' ? <UiIcon name="skip" size={13} /> : queued ? <UiIcon name="clock" size={13} /> : null}</span>
                  <span className="q-text">
                    <span className="q-name">{labelFor(project, e.id)}</span>
                    {second && <span className="q-sub">{fields[1] === 'table' ? `Table ${second}` : second}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!shown.length && <p className="muted small">{filter === 'todo' ? 'Nothing left to write.' : 'Nothing here yet.'}</p>}
      </aside>

      <section className="machine-view">
        <div className="bed-area">
          <div className={`bed-paper${paper.w >= paper.h ? ' is-wide' : ''}`} style={{ aspectRatio: `${paper.w} / ${paper.h}` }}>
            <span className="corner-guide" aria-hidden="true" />
            <Sheet sheet={sheet} ink={INKS[project.ink].color} progress={active ? run.progress : undefined} pen={active && run.status !== 'paper'} label={active ? statusText : 'Preview of the card'} />
          </div>
          {active && run.status === 'paper' && (
            <div className="bed-overlay">
              <UiIcon name="paper" size={30} />
              <p>
                <strong>Take the card out and put in the next one.</strong>
              </p>
              <button type="button" className="btn btn-primary" onClick={api.nextSheet}>
                <UiIcon name="play" />
                Next card
              </button>
              <span className="tiny">or press Space</span>
            </div>
          )}
          {mine && run.status === 'done' && (
            <div className="bed-overlay is-done">
              <span className="done-check">
                <UiIcon name="check" size={28} />
              </span>
              <p>
                <strong>All done!</strong> {run.written} {run.written === 1 ? 'card' : 'cards'} written.
              </p>
              <button type="button" className="btn btn-secondary" onClick={api.reset}>
                Close
              </button>
            </div>
          )}
          {!active && !(mine && run.status === 'done') && <span className="bed-label">Preview · {previewId ? labelFor(project, previewId) : '–'}</span>}
        </div>

        <div className="transport">
          <div className="transport-buttons">
            {!active && (
              <>
                {!connected ? (
                  <button type="button" className="btn btn-primary" onClick={() => setConnect(true)}>
                    <UiIcon name="link" />
                    Connect machine
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" disabled={!todo.length || otherBusy} onClick={() => setPreflight(true)}>
                    <UiIcon name="play" />
                    {todo.length ? `Write ${todo.length} ${todo.length === 1 ? 'card' : 'cards'}` : 'All written'}
                  </button>
                )}
                {!todo.length && entries.length > 0 && (
                  <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'RESET_STATUS', projectId: project.id })}>
                    <UiIcon name="refresh" />
                    Mark all as not written
                  </button>
                )}
              </>
            )}
            {active && run.status === 'writing' && (
              <button type="button" className="btn btn-secondary" onClick={api.pause}>
                <UiIcon name="pause" />
                Pause
              </button>
            )}
            {active && run.status === 'paused' && (
              <button type="button" className="btn btn-primary" onClick={api.resume}>
                <UiIcon name="play" />
                Carry on
              </button>
            )}
            {active && (
              <>
                <button type="button" className="btn btn-secondary" onClick={api.skip} title="Skip this card">
                  <UiIcon name="skip" />
                  Skip
                </button>
                <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setStopAsk(true)}>
                  <UiIcon name="stop" />
                  Stop
                </button>
              </>
            )}
          </div>
          <div className="transport-info">
            {active ? (
              <>
                <p>
                  <strong>
                    Card {Math.min(run.index + 1, run.queue.length)} of {run.queue.length}
                  </strong>{' '}
                  · {statusText}
                </p>
                <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressAll * 100)}>
                  <span style={{ width: `${progressAll * 100}%` }} />
                </div>
                <p className="muted small">
                  <UiIcon name="clock" size={14} /> about {formatDuration(api.secondsLeft)} left at real speed
                </p>
              </>
            ) : otherBusy ? (
              <p className="muted">
                The machine is busy with “{otherName}”.{' '}
                <button type="button" className="btn-link" onClick={() => run.projectId && dispatch({ type: 'OPEN', id: run.projectId, page: 'write' })}>
                  Go there
                </button>
              </p>
            ) : (
              <p className="muted">
                {todo.length} {todo.length === 1 ? 'card' : 'cards'} to write · about {formatDuration(total)} at {state.machine.speed} mm/s
              </p>
            )}
          </div>
        </div>
      </section>

      <aside className="panel panel-right">
        <h2 className="panel-title">Before you start</h2>
        <div className="job-facts">
          <div className="job-fact">
            <UiIcon name="paper" />
            <div>
              <strong>{paper.label}</strong>
              <span className="muted small">
                {paper.w} × {paper.h} mm, against the corner guide at the top left
              </span>
            </div>
          </div>
          <div className={`job-fact${state.machine.pen !== project.ink ? ' is-warn' : ''}`}>
            <span className="ink-dot" style={{ background: INKS[project.ink].color }} />
            <div>
              <strong>{INKS[project.ink].pen}</strong>
              <span className="muted small">{state.machine.pen === project.ink ? 'Loaded in the machine' : `${INKS[state.machine.pen].label} is loaded now`}</span>
            </div>
          </div>
          <div className="job-fact">
            <UiIcon name="pen" />
            <div>
              <strong>{project.hand === 'own' ? 'Your own handwriting' : `${HANDS[project.hand].label}’s handwriting`}</strong>
              <span className="muted small">at {state.machine.speed} mm/s</span>
            </div>
          </div>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={api.pauseEach} onChange={(e) => api.setPauseEach(e.target.checked)} />
          <span className="toggle-ui" aria-hidden="true" />
          <span>
            <strong>Pause after each card</strong>
            <span className="muted small">Turn on when you put the cards in one by one.</span>
          </span>
        </label>
        <div className="proto-speed">
          <span className="muted small">Prototype speed</span>
          <div className="seg seg-sm seg-block" role="radiogroup" aria-label="Speed in the prototype">
            <button type="button" role="radio" aria-checked={api.demo} className={api.demo ? 'is-on' : ''} onClick={() => api.setDemo(true)} title="Plays 10 times faster than the real machine">
              Demo ×10
            </button>
            <button type="button" role="radio" aria-checked={!api.demo} className={!api.demo ? 'is-on' : ''} onClick={() => api.setDemo(false)}>
              Real speed
            </button>
          </div>
        </div>
        <div className="panel-note">
          <UiIcon name="info" size={16} />
          <p>Space pauses and carries on. You can leave this page while it writes, the status bar keeps you posted.</p>
        </div>
      </aside>

      <Preflight
        open={preflight}
        project={project}
        count={todo.length}
        onClose={() => setPreflight(false)}
        onStart={() => {
          setPreflight(false);
          setFilter('todo');
          setPicked(null);
          api.start(
            project.id,
            todo.map((e) => e.id),
          );
        }}
      />
      <Modal
        open={stopAsk}
        onClose={() => setStopAsk(false)}
        title="Stop writing?"
        size="sm"
        footer={
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStopAsk(false)}>
              Keep writing
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                api.stop();
                setStopAsk(false);
                toast('Stopped. The cards written so far are ticked off in the list.');
              }}
            >
              Stop
            </button>
          </div>
        }
      >
        <p>The pen lifts right away. The card that’s being written now stays unfinished, so take it out before you start again.</p>
      </Modal>
      <ConnectModal open={connect} onClose={() => setConnect(false)} />
    </div>
  );
}

function Preflight({ open, project, count, onClose, onStart }: { open: boolean; project: Project; count: number; onClose: () => void; onStart: () => void }) {
  const { state } = useStore();
  const paper = PAPERS[project.paper];
  const [penOpen, setPenOpen] = useState(false);
  const [traceKey, setTraceKey] = useState<number | null>(null);
  const [placed, setPlaced] = useState(false);
  const trace = useOnce(2400, traceKey);
  const outline = useMemo(() => outlineLayout(paper.w, paper.h), [paper.w, paper.h]);
  const penOk = state.machine.pen === project.ink;

  useEffect(() => {
    if (open) {
      setPlaced(false);
      setTraceKey(null);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ready to write ${count} ${count === 1 ? 'card' : 'cards'}?`}
      size="lg"
      footer={
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!penOk || !placed} onClick={onStart}>
            <UiIcon name="play" />
            Start writing
          </button>
        </div>
      }
    >
      <div className="preflight">
        <ol className="checks">
          <li className="is-ok">
            <span className="check-dot">
              <UiIcon name="check" size={14} />
            </span>
            <div>
              <strong>Machine connected</strong>
              <span className="muted small">
                {state.machine.device?.name} · {state.machine.device?.via} {state.machine.device?.address}
              </span>
            </div>
          </li>
          <li className={penOk ? 'is-ok' : 'is-todo'}>
            <span className="check-dot">{penOk ? <UiIcon name="check" size={14} /> : '2'}</span>
            <div>
              <strong>{penOk ? `${INKS[project.ink].pen} is in` : `Put in the ${INKS[project.ink].pen}`}</strong>
              {!penOk && (
                <>
                  <span className="muted small">The machine has {INKS[state.machine.pen].label.toLowerCase()} loaded right now.</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPenOpen(true)}>
                    Change the pen
                  </button>
                </>
              )}
            </div>
          </li>
          <li className={placed ? 'is-ok' : 'is-todo'}>
            <span className="check-dot">{placed ? <UiIcon name="check" size={14} /> : '3'}</span>
            <div>
              <strong>Put a {paper.label.toLowerCase()} in the corner guide</strong>
              <span className="muted small">
                {paper.w} × {paper.h} mm, pushed into the top-left corner. Let the pen trace the edge without ink to check it lines up.
              </span>
              <div className="check-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTraceKey(Date.now())}>
                  <UiIcon name="corner" />
                  {traceKey ? 'Trace again' : 'Trace the edge'}
                </button>
                <label className="check">
                  <input type="checkbox" checked={placed} onChange={(e) => setPlaced(e.target.checked)} />
                  <span>The card is in place</span>
                </label>
              </div>
            </div>
          </li>
        </ol>
        <div className={`trace${paper.w >= paper.h ? ' is-wide' : ''}`}>
          <div className="trace-paper" style={{ aspectRatio: `${paper.w} / ${paper.h}` }}>
            <Sheet sheet={outline} ink="#4d74ff" progress={traceKey ? trace : 0} pen={traceKey !== null && trace < 1} label="The pen traces the edge of the card" className="sheet-trace" />
          </div>
          <p className="tiny center">{traceKey ? (trace < 1 ? 'Tracing the edge, pen lifted…' : 'Does the pen follow the edge of your card? Then tick “in place”.') : 'The pen follows the edge, lifted, so nothing is drawn.'}</p>
        </div>
      </div>
      <PenChangeModal open={penOpen} target={project.ink} onClose={() => setPenOpen(false)} />
    </Modal>
  );
}
