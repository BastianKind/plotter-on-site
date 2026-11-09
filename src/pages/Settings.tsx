import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { UiIcon } from '../components/UiIcon';
import { GlyphThumb, WritingPad } from '../components/WritingPad';
import { APP_VERSION, HANDS, INKS } from '../data/catalog';
import { useFonts } from '../lib/hooks';
import { ALPHABET, makeWriter, type SheetLayout } from '../lib/layout';
import { useProject, useStore } from '../state/store';
import type { Glyphs, HandKey, Project, Stroke } from '../types';

const SAMPLE = 'Dear Anna, see you soon!';

function sampleLine(hand: HandKey, glyphs: Glyphs, text = SAMPLE): SheetLayout {
  const marks: SheetLayout['marks'] = [];
  makeWriter(hand, glyphs, 8).write(text, 4, 11, marks);
  return { w: 120, h: 16, paper: '#fdfbf4', marks, printed: { lines: [], stampBox: null, fold: false }, stamp: false, overflow: false };
}

/** Every character the open project will write: its texts plus everything in the guest list. */
function charsOf(p: Project | null) {
  if (!p) return [];
  const text = [...p.items.map((i) => (i.kind === 'text' ? i.text.replace(/\{[a-z0-9_]+\}/gi, '') : '')), ...p.rows.flatMap((r) => Object.values(r.cells))].join('');
  return [...new Set([...text].filter((ch) => ch.trim()))];
}

export function SettingsPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const fonts = useFonts();
  const [teach, setTeach] = useState(false);
  const count = Object.keys(state.glyphs).length;
  const mine = useMemo(() => sampleLine('own', state.glyphs), [state.glyphs, fonts]); // eslint-disable-line react-hooks/exhaustive-deps
  const samples = useMemo(
    () => (Object.keys(HANDS) as Exclude<HandKey, 'own'>[]).map((k) => [k, sampleLine(k, {})] as const),
    [fonts], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="page-scroll">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Handwriting styles and app settings, saved on this laptop.</p>
        </div>
      </div>

      <section className="card-box">
        <h2 className="card-title">Your own handwriting</h2>
        <p className="muted">Write each letter once with the mouse, a pen tablet or a touch screen. Projects can then be written in your handwriting. Letters you skip are written in Jamie’s style.</p>
        <div className="own-hand">
          <div className="own-sample">
            <Sheet sheet={mine} ink={INKS.blue.color} label="Sample in your handwriting" />
          </div>
          <div className="own-actions">
            <p>
              <strong>{count ? `${count} letters saved` : 'Not set up yet'}</strong>
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setTeach(true)}>
              <UiIcon name="pen" />
              {count ? 'Add or change letters' : 'Teach my handwriting'}
            </button>
            {count > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-danger-text"
                onClick={() => {
                  Object.keys(state.glyphs).forEach((ch) => dispatch({ type: 'SET_GLYPH', ch, strokes: [] }));
                  toast('Your letters were deleted.');
                }}
              >
                <UiIcon name="trash" />
                Delete my letters
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card-box">
        <h2 className="card-title">Built-in handwriting</h2>
        <div className="hand-samples">
          {samples.map(([k, sheet]) => (
            <div key={k} className="hand-sample-row">
              <span className="hand-name">
                <strong>{HANDS[k].label}</strong>
                <span className="muted small">{HANDS[k].note}</span>
              </span>
              <span className="hand-line">
                <Sheet sheet={sheet} ink={INKS.charcoal.color} label={`Sample of ${HANDS[k].label}`} />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card-box">
        <h2 className="card-title">App</h2>
        <div className="settings-rows">
          <label className="setting">
            <span>
              <strong>Language</strong>
              <span className="muted small">German, French and Italian are coming later.</span>
            </span>
            <select defaultValue="en" onChange={(e) => e.target.value !== 'en' && (toast('Prototype: only English for now.'), (e.target.value = 'en'))}>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
              <option value="it">Italiano</option>
            </select>
          </label>
          <div className="setting">
            <span>
              <strong>Updates</strong>
              <span className="muted small">plotter Studio {APP_VERSION}</span>
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => toast('plotter Studio is up to date.', 'success')}>
              <UiIcon name="refresh" />
              Check for updates
            </button>
          </div>
        </div>
      </section>

      <p className="muted small hint">
        Prototype for the M241/M245 user tests. Nothing is saved: reloading the page starts again with the example projects. Handwriting fonts: Caveat, Kalam and Shadows Into Light Two (SIL Open Font License).
      </p>

      <TeachModal open={teach} onClose={() => setTeach(false)} />
    </div>
  );
}

type Mode = 'project' | 'all';

function TeachModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const project = useProject();
  const toast = useToast();
  const needed = useMemo(() => charsOf(project), [project]);
  const [mode, setMode] = useState<Mode>('all');
  const list = mode === 'project' && needed.length ? needed : ALPHABET;
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Stroke[]>([]);
  const ch = list[Math.min(index, list.length - 1)];
  const ink = INKS.blue.color;

  const glyphs = { ...state.glyphs, [ch]: draft };
  if (!draft.length) delete glyphs[ch];
  const done = list.filter((c) => glyphs[c]?.length).length;
  const preview = useMemo(() => sampleLine('own', glyphs, project && needed.length ? needed.slice(0, 18).join('') : SAMPLE), [glyphs, project, needed]);

  useEffect(() => {
    if (!open) return;
    const m: Mode = needed.length ? 'project' : 'all';
    const l = m === 'project' ? needed : ALPHABET;
    const first = Math.max(0, l.findIndex((c) => !state.glyphs[c]));
    setMode(m);
    setIndex(first);
    setDraft(state.glyphs[l[first]] ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () => dispatch({ type: 'SET_GLYPH', ch, strokes: draft });
  const go = (i: number, l = list) => {
    save();
    setIndex(i);
    setDraft(glyphs[l[i]] ?? []);
  };
  const finish = () => {
    save();
    onClose();
    toast(`Saved. ${done} ${done === 1 ? 'letter' : 'letters'} in your handwriting.`, 'success');
  };

  return (
    <Modal
      open={open}
      onClose={finish}
      title="Teach your handwriting"
      size="lg"
      footer={
        <div className="modal-actions">
          <span className="muted small foot-note">
            {done} of {list.length} done
          </span>
          <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => go(index - 1)}>
            <UiIcon name="arrowLeft" />
            Back
          </button>
          {index < list.length - 1 ? (
            <button type="button" className="btn btn-secondary" onClick={() => go(index + 1)}>
              {draft.length ? 'Next letter' : 'Skip'}
              <UiIcon name="arrowRight" />
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={finish}>
            <UiIcon name="check" />
            Done
          </button>
        </div>
      }
    >
      <div className="teach">
        <div className="teach-left">
          {needed.length > 0 && (
            <div className="seg seg-sm seg-block" role="radiogroup" aria-label="Which letters">
              <button type="button" role="radio" aria-checked={mode === 'project'} className={mode === 'project' ? 'is-on' : ''} onClick={() => (save(), setMode('project'), setIndex(0), setDraft(glyphs[needed[0]] ?? []))}>
                In “{project?.name}” ({needed.length})
              </button>
              <button type="button" role="radio" aria-checked={mode === 'all'} className={mode === 'all' ? 'is-on' : ''} onClick={() => (save(), setMode('all'), setIndex(0), setDraft(glyphs[ALPHABET[0]] ?? []))}>
                Whole alphabet
              </button>
            </div>
          )}
          <div className="teach-target">
            <span className="teach-char">{ch}</span>
            <span className="muted small">Write it the way you always do, sitting on the blue line.</span>
          </div>
          <div className="teach-pad">
            <WritingPad key={`${mode}-${ch}`} strokes={draft} onChange={setDraft} ink={ink} guides="letter" label={`Writing pad for ${ch}`} />
          </div>
          <div className="teach-tools">
            <button type="button" className="btn btn-secondary btn-sm" disabled={!draft.length} onClick={() => setDraft((d) => d.slice(0, -1))}>
              <UiIcon name="undo" />
              Undo
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!draft.length} onClick={() => setDraft([])}>
              <UiIcon name="trash" />
              Clear
            </button>
          </div>
        </div>
        <div className="teach-right">
          <div className="teach-grid">
            {list.map((c, i) => (
              <button key={c} type="button" className={`teach-cell${i === index ? ' is-current' : ''}${glyphs[c]?.length ? ' is-done' : ''}`} onClick={() => i !== index && go(i)} aria-label={`${c}${glyphs[c]?.length ? ', done' : ''}`}>
                {glyphs[c]?.length ? <GlyphThumb strokes={glyphs[c]} ink={ink} /> : <span>{c}</span>}
              </button>
            ))}
          </div>
          <div className="teach-preview">
            <span className="muted small">Preview</span>
            <Sheet sheet={preview} ink={ink} label="Preview in your handwriting" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
