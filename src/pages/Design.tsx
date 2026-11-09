import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { Modal } from '../components/Modal';
import { PaperIcon } from '../components/PaperIcon';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { UiIcon, type UiIconName } from '../components/UiIcon';
import { WritingPad } from '../components/WritingPad';
import { HANDS, ICON_LABELS, INKS, PAPERS } from '../data/catalog';
import { newId } from '../data/templates';
import { useFonts, useSize } from '../lib/hooks';
import { dragBox, type DragMode } from '../lib/geometry';
import { fieldLabel, fieldsOf, layoutDesign } from '../lib/layout';
import { useStore } from '../state/store';
import type { Align, HandKey, IconKey, InkKey, Item, PaperKey, Project, Stroke } from '../types';

const MM = 3.78; // px per mm at 100 % zoom (96 dpi)
const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3];
const HANDLES: Exclude<DragMode, 'move'>[] = ['nw', 'ne', 'sw', 'se'];
const SUGGESTED_FIELDS = ['name', 'first_name', 'table', 'company'];
const ICON_KEYS = Object.keys(ICON_LABELS) as IconKey[];

function itemName(item: Item) {
  if (item.kind === 'text') return item.text.split('\n')[0].trim() || 'Empty text';
  if (item.kind === 'icon') return ICON_LABELS[item.icon];
  return 'Your drawing';
}

const itemIcon = (item: Item): UiIconName => (item.kind === 'text' ? 'text' : item.kind === 'icon' ? 'shapes' : 'pen');

export function DesignPage({ project }: { project: Project }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const fonts = useFonts();
  const paper = PAPERS[project.paper];
  const fields = fieldsOf(project.items);
  const rows = project.rows;
  const showFields = state.previewIndex < 0 || !rows.length || !fields.length;
  const previewRow = showFields ? null : rows[Math.min(state.previewIndex, rows.length - 1)];
  const layout = useMemo(
    () => layoutDesign(project, state.glyphs, previewRow?.cells ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.items, project.paper, project.hand, previewRow, state.glyphs, fonts],
  );
  const selected = project.items.find((i) => i.id === state.selectedId) ?? null;
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [stageRef, size] = useSize<HTMLDivElement>();
  const fit = Math.max(0.5, Math.min((size.w - 96) / paper.w, (size.h - 96) / paper.h));
  const scale = zoom === 'fit' ? fit : zoom * MM;
  const [iconPicker, setIconPicker] = useState<'add' | 'swap' | null>(null);
  const [doodle, setDoodle] = useState<{ id: string | null; strokes: Stroke[] } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Keyboard shortcuts, like in any design app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      } else if (typing || !selected || document.querySelector('.modal-backdrop')) return;
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        dispatch({ type: 'REMOVE_ITEM', id: selected.id });
      } else if (e.key === 'Escape') dispatch({ type: 'SELECT', id: null });
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 0.5;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        dispatch({ type: 'UPDATE_ITEM', id: selected.id, patch: dragBox(selected.kind, 'move', selected, dx, dy, paper.w, paper.h), commit: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, paper.w, paper.h, dispatch]);

  const startDrag = (e: ReactPointerEvent, item: Item, mode: DragMode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dispatch({ type: 'SELECT', id: item.id });
    dispatch({ type: 'BEGIN_CHANGE' });
    const sx = e.clientX;
    const sy = e.clientY;
    const origin = { x: item.x, y: item.y, w: item.w, h: item.h };
    const move = (ev: PointerEvent) => {
      const box = dragBox(item.kind, mode, origin, (ev.clientX - sx) / scale, (ev.clientY - sy) / scale, paper.w, paper.h);
      dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: box });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      dispatch({ type: 'END_CHANGE' });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const addText = () => {
    const w = Math.min(70, paper.w - 10);
    dispatch({ type: 'ADD_ITEM', item: { id: newId('item'), kind: 'text', text: 'New text', size: 6, align: 'left', x: (paper.w - w) / 2, y: Math.min(paper.h - 14, paper.h / 2 - 5), w, h: 12 } });
    window.setTimeout(() => textRef.current?.select(), 50);
  };
  const addIcon = (icon: IconKey) => {
    const s = Math.min(16, paper.w / 4, paper.h / 3);
    const count = project.items.filter((i) => i.kind !== 'text').length;
    dispatch({ type: 'ADD_ITEM', item: { id: newId('item'), kind: 'icon', icon, x: 6 + (count % 4) * (s + 3), y: 5, w: s, h: s } });
  };

  const previewNav = (d: number) => dispatch({ type: 'SET_PREVIEW', index: (Math.max(0, state.previewIndex) + d + rows.length) % rows.length });

  return (
    <div className="design">
      <div className="toolbar">
        <div className="tb-group">
          <button type="button" className="tb-btn" onClick={addText}>
            <UiIcon name="text" />
            Text
          </button>
          <button type="button" className="tb-btn" onClick={() => setIconPicker('add')}>
            <UiIcon name="shapes" />
            Drawing
          </button>
          <button type="button" className="tb-btn" title="Draw your own drawing" onClick={() => setDoodle({ id: null, strokes: [] })}>
            <UiIcon name="pen" />
            Draw
          </button>
        </div>
        <div className="tb-group">
          <button type="button" className="tb-icon" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: 'UNDO' })}>
            <UiIcon name="undo" />
          </button>
          <button type="button" className="tb-icon" aria-label="Redo (Ctrl+Y)" title="Redo (Ctrl+Y)" disabled={!state.future.length} onClick={() => dispatch({ type: 'REDO' })}>
            <UiIcon name="redo" />
          </button>
        </div>
        <div className="tb-group">
          <button type="button" className="tb-icon" aria-label="Zoom out" onClick={() => setZoom(ZOOMS.filter((z) => z * MM < scale - 0.01).pop() ?? ZOOMS[0])}>
            <UiIcon name="zoomOut" />
          </button>
          <button type="button" className="tb-btn tb-zoom" onClick={() => setZoom('fit')} title="Fit to window">
            {zoom === 'fit' ? 'Fit' : `${Math.round(zoom * 100)} %`}
          </button>
          <button type="button" className="tb-icon" aria-label="Zoom in" onClick={() => setZoom(ZOOMS.find((z) => z * MM > scale + 0.01) ?? ZOOMS[ZOOMS.length - 1])}>
            <UiIcon name="zoomIn" />
          </button>
        </div>
        {fields.length > 0 && rows.length > 0 && (
          <div className="tb-group tb-preview">
            <span className="muted small">Preview</span>
            <button type="button" className="tb-icon" aria-label="Previous guest" disabled={showFields} onClick={() => previewNav(-1)}>
              <UiIcon name="chevronLeft" />
            </button>
            <span className="tb-preview-name">{showFields ? 'Fields' : `${Object.values(previewRow!.cells)[0] || '(empty)'} · ${Math.min(state.previewIndex, rows.length - 1) + 1}/${rows.length}`}</span>
            <button type="button" className="tb-icon" aria-label="Next guest" disabled={showFields} onClick={() => previewNav(1)}>
              <UiIcon name="chevronRight" />
            </button>
            <label className="switch">
              <input type="checkbox" checked={showFields} onChange={(e) => dispatch({ type: 'SET_PREVIEW', index: e.target.checked ? -1 : 0 })} />
              <span>Fields</span>
            </label>
          </div>
        )}
        <div className="tb-spacer" />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'GO', page: fields.length ? 'data' : 'write' })}>
          {fields.length ? 'Guest list' : 'Write'}
          <UiIcon name="arrowRight" />
        </button>
      </div>

      <aside className="panel panel-left">
        <h2 className="panel-title">
          <UiIcon name="layers" size={16} />
          On the card
        </h2>
        <ul className="layers">
          {[...project.items].reverse().map((item) => (
            <li key={item.id}>
              <button type="button" className={`layer${item.id === state.selectedId ? ' is-on' : ''}${layout.overflowIds.includes(item.id) ? ' is-warn' : ''}`} onClick={() => dispatch({ type: 'SELECT', id: item.id })}>
                <UiIcon name={itemIcon(item)} size={16} />
                <span className="layer-name">{itemName(item)}</span>
                {layout.overflowIds.includes(item.id) && <UiIcon name="alert" size={14} />}
              </button>
              <button type="button" className="icon-btn sm" aria-label={`Remove ${itemName(item)}`} onClick={() => dispatch({ type: 'REMOVE_ITEM', id: item.id })}>
                <UiIcon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
        {!project.items.length && <p className="muted small">The card is empty. Add text or a drawing from the toolbar.</p>}
        <div className="panel-note">
          <UiIcon name="info" size={16} />
          <p>Drag things on the card to move them, drag a corner to resize. Arrow keys nudge, Delete removes.</p>
        </div>
      </aside>

      <div className="canvas" ref={stageRef} onPointerDown={(e) => e.target === e.currentTarget && dispatch({ type: 'SELECT', id: null })}>
        <div className="canvas-paper" style={{ width: paper.w * scale, height: paper.h * scale }}>
          <Sheet sheet={layout} ink={INKS[project.ink].color} label={`${paper.label} design`} />
          {project.items.map((item) => (
            <div
              key={item.id}
              className={`frame${item.id === state.selectedId ? ' is-selected' : ''}${layout.overflowIds.includes(item.id) ? ' is-warn' : ''}`}
              style={{ left: item.x * scale, top: item.y * scale, width: item.w * scale, height: item.h * scale }}
              onPointerDown={(e) => startDrag(e, item, 'move')}
              onDoubleClick={() => {
                if (item.kind === 'text') textRef.current?.focus();
                if (item.kind === 'doodle') setDoodle({ id: item.id, strokes: item.strokes });
                if (item.kind === 'icon') setIconPicker('swap');
              }}
              role="button"
              tabIndex={-1}
              aria-label={itemName(item)}
            >
              {item.id === state.selectedId && HANDLES.map((m) => <span key={m} className={`handle h-${m}`} onPointerDown={(e) => startDrag(e, item, m)} />)}
              {layout.overflowIds.includes(item.id) && item.id === state.selectedId && <span className="frame-warn">Doesn’t fit, make the box bigger or the text smaller</span>}
            </div>
          ))}
        </div>
        <p className="canvas-caption">
          {paper.label} · {paper.w} × {paper.h} mm
        </p>
      </div>

      <aside className="panel panel-right">
        {selected?.kind === 'text' && <TextInspector item={selected} fields={fields} textRef={textRef} />}
        {selected?.kind === 'icon' && (
          <ItemInspector item={selected} title="Drawing">
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setIconPicker('swap')}>
              <UiIcon name="shapes" />
              Change drawing
            </button>
          </ItemInspector>
        )}
        {selected?.kind === 'doodle' && (
          <ItemInspector item={selected} title="Your drawing">
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setDoodle({ id: selected.id, strokes: selected.strokes })}>
              <UiIcon name="pen" />
              Edit drawing
            </button>
          </ItemInspector>
        )}
        {!selected && <CardInspector project={project} fields={fields} />}
      </aside>

      <IconPickerModal
        open={iconPicker !== null}
        current={selected?.kind === 'icon' && iconPicker === 'swap' ? selected.icon : null}
        onClose={() => setIconPicker(null)}
        onPick={(icon) => {
          if (iconPicker === 'swap' && selected?.kind === 'icon') dispatch({ type: 'UPDATE_ITEM', id: selected.id, patch: { icon }, commit: true });
          else addIcon(icon);
          setIconPicker(null);
        }}
      />
      <DoodleModal
        open={doodle !== null}
        initial={doodle?.strokes ?? []}
        ink={INKS[project.ink].color}
        onClose={() => setDoodle(null)}
        onSave={(strokes) => {
          if (doodle?.id) dispatch({ type: 'UPDATE_ITEM', id: doodle.id, patch: { strokes }, commit: true });
          else if (strokes.length) {
            const s = Math.min(24, paper.w / 3, paper.h / 3);
            dispatch({ type: 'ADD_ITEM', item: { id: newId('item'), kind: 'doodle', strokes, x: (paper.w - s) / 2, y: 5, w: s, h: s } });
            toast('Your drawing is on the card. Drag it where you want it.', 'success');
          }
          setDoodle(null);
        }}
      />
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    if (Number.isFinite(v)) onChange(v);
    else setText(String(value));
  };
  return (
    <label className="num">
      <span>{label}</span>
      <input value={text} inputMode="decimal" onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
    </label>
  );
}

function ItemInspector({ item, title, children }: { item: Item; title: string; children?: ReactNode }) {
  const { dispatch } = useStore();
  const project = useProjectPaper();
  const set = (patch: Partial<Item>) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch, commit: true });
  return (
    <div className="inspector">
      <h2 className="panel-title">{title}</h2>
      {children}
      <div className="insp-section">
        <h3>Position (mm)</h3>
        <div className="num-grid">
          <Num label="X" value={item.x} onChange={(x) => set({ x: Math.max(0, Math.min(project.w - item.w, x)) })} />
          <Num label="Y" value={item.y} onChange={(y) => set({ y: Math.max(0, Math.min(project.h - item.h, y)) })} />
          <Num label="W" value={item.w} onChange={(w) => set(item.kind === 'text' ? { w: Math.max(10, Math.min(project.w - item.x, w)) } : { w, h: (item.h / item.w) * w })} />
          <Num label="H" value={item.h} onChange={(h) => set(item.kind === 'text' ? { h: Math.max(5, Math.min(project.h - item.y, h)) } : { h, w: (item.w / item.h) * h })} />
        </div>
        <div className="seg seg-block" role="group" aria-label="Place on the card">
          <button type="button" onClick={() => set({ x: (project.w - item.w) / 2 })}>
            Centre across
          </button>
          <button type="button" onClick={() => set({ y: (project.h - item.h) / 2 })}>
            Centre down
          </button>
        </div>
      </div>
      <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => dispatch({ type: 'REMOVE_ITEM', id: item.id })}>
        <UiIcon name="trash" />
        Remove
      </button>
    </div>
  );
}

function useProjectPaper() {
  const { state } = useStore();
  const p = state.projects.find((x) => x.id === state.activeId);
  return PAPERS[p?.paper ?? 'a6'];
}

const ALIGNS: [Align, UiIconName, string][] = [
  ['left', 'alignLeft', 'Left'],
  ['center', 'alignCenter', 'Centre'],
  ['right', 'alignRight', 'Right'],
];

function TextInspector({ item, fields, textRef }: { item: Extract<Item, { kind: 'text' }>; fields: string[]; textRef: RefObject<HTMLTextAreaElement> }) {
  const { dispatch } = useStore();
  const [newField, setNewField] = useState(false);
  const set = (patch: Partial<Item>, commit = true) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch, commit });
  const chips = [...fields, ...SUGGESTED_FIELDS.filter((f) => !fields.includes(f))];

  const insert = (token: string) => {
    const el = textRef.current;
    const at = el ? el.selectionStart : item.text.length;
    const end = el ? el.selectionEnd : item.text.length;
    const text = item.text.slice(0, at) + token + item.text.slice(end);
    set({ text });
    window.setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    }, 0);
  };

  return (
    <ItemInspector item={item} title="Text">
      <label className="field">
        <span className="field-label">Words</span>
        <textarea
          ref={textRef}
          rows={4}
          value={item.text}
          onFocus={() => dispatch({ type: 'BEGIN_CHANGE' })}
          onBlur={() => dispatch({ type: 'END_CHANGE' })}
          onChange={(e) => set({ text: e.target.value }, false)}
        />
      </label>
      <div className="insp-section">
        <h3>Insert a field</h3>
        <p className="muted small">Fields are filled in from the guest list, a different one on every card.</p>
        <div className="chips">
          {chips.map((f) => (
            <button key={f} type="button" className={`chip${fields.includes(f) ? ' is-used' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(`{${f}}`)}>
              {`{${f}}`}
            </button>
          ))}
          <button type="button" className="chip chip-add" onClick={() => setNewField(true)}>
            <UiIcon name="plus" size={14} />
            New field
          </button>
        </div>
      </div>
      <div className="insp-section">
        <h3>
          Size <span className="muted">{item.size.toFixed(1)} mm</span>
        </h3>
        <input type="range" min={3} max={16} step={0.2} value={item.size} onPointerDown={() => dispatch({ type: 'BEGIN_CHANGE' })} onPointerUp={() => dispatch({ type: 'END_CHANGE' })} onChange={(e) => set({ size: Number(e.target.value) }, false)} aria-label="Text size" />
      </div>
      <div className="insp-section">
        <h3>Alignment</h3>
        <div className="seg seg-block" role="radiogroup" aria-label="Text alignment">
          {ALIGNS.map(([a, icon, label]) => (
            <button key={a} type="button" role="radio" aria-checked={item.align === a} className={item.align === a ? 'is-on' : ''} onClick={() => set({ align: a })}>
              <UiIcon name={icon} size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <FieldModal open={newField} onClose={() => setNewField(false)} onAdd={(f) => (setNewField(false), insert(`{${f}}`))} />
    </ItemInspector>
  );
}

function FieldModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (f: string) => void }) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (open) setName('');
  }, [open]);
  const key = name
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New field"
      size="sm"
      footer={
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!key} onClick={() => onAdd(key)}>
            Insert {key ? `{${key}}` : 'field'}
          </button>
        </div>
      }
    >
      <label className="field">
        <span className="field-label">What changes from card to card?</span>
        <input autoFocus value={name} placeholder="e.g. Dish, Room, Start number" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && key && onAdd(key)} />
      </label>
      <p className="muted small">The guest list gets a column for it.</p>
    </Modal>
  );
}

function CardInspector({ project, fields }: { project: Project; fields: string[] }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const ownCount = Object.keys(state.glyphs).length;
  const setHand = (hand: HandKey) => {
    if (hand === 'own' && !ownCount) {
      toast('Teach the app your handwriting first, under Settings.', 'warn');
      return;
    }
    dispatch({ type: 'PROJECT', patch: { hand } });
  };
  return (
    <div className="inspector">
      <h2 className="panel-title">Card</h2>
      <label className="field">
        <span className="field-label">Paper</span>
        <select value={project.paper} onChange={(e) => dispatch({ type: 'PROJECT', patch: { paper: e.target.value as PaperKey } })}>
          {(Object.keys(PAPERS) as PaperKey[]).map((k) => (
            <option key={k} value={k}>
              {PAPERS[k].label} · {PAPERS[k].w} × {PAPERS[k].h} mm
            </option>
          ))}
        </select>
      </label>
      <div className="insp-section">
        <h3>Handwriting</h3>
        <div className="hand-list" role="radiogroup" aria-label="Handwriting">
          {(Object.keys(HANDS) as Exclude<HandKey, 'own'>[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={project.hand === k} className={`hand-opt${project.hand === k ? ' is-on' : ''}`} onClick={() => setHand(k)}>
              <span className="hand-sample" style={{ fontFamily: HANDS[k].family, fontSize: `${1.6 * HANDS[k].factor}em` }}>
                Hello
              </span>
              <span className="hand-name">{HANDS[k].label}</span>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={project.hand === 'own'} className={`hand-opt${project.hand === 'own' ? ' is-on' : ''}`} onClick={() => setHand('own')}>
            <span className="hand-sample hand-own">
              <UiIcon name="pen" size={20} />
            </span>
            <span className="hand-name">{ownCount ? 'Mine' : 'Mine (set up)'}</span>
          </button>
        </div>
      </div>
      <div className="insp-section">
        <h3>Ink</h3>
        <div className="ink-list" role="radiogroup" aria-label="Ink">
          {(Object.keys(INKS) as InkKey[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={project.ink === k} className={`ink-opt${project.ink === k ? ' is-on' : ''}`} onClick={() => dispatch({ type: 'PROJECT', patch: { ink: k } })}>
              <span className="ink-dot" style={{ background: INKS[k].color }} />
              {INKS[k].label}
            </button>
          ))}
        </div>
        {project.ink !== state.machine.pen && (
          <p className="tiny warn-text">
            <UiIcon name="info" size={14} /> The machine has {INKS[state.machine.pen].label.toLowerCase()} loaded. You’ll be asked to change the pen before writing.
          </p>
        )}
      </div>
      <div className="insp-section">
        <h3>Fields</h3>
        {fields.length ? (
          <>
            <div className="chips">
              {fields.map((f) => (
                <span key={f} className="chip is-used">{`{${f}}`}</span>
              ))}
            </div>
            <p className="muted small">
              Each becomes a column in the guest list ({fields.map(fieldLabel).join(', ')}).
            </p>
          </>
        ) : (
          <p className="muted small">No fields yet, so every card is the same. Select a text and insert a field like {'{name}'} to make each card personal.</p>
        )}
      </div>
    </div>
  );
}

function IconPickerModal({ open, current, onClose, onPick }: { open: boolean; current: IconKey | null; onClose: () => void; onPick: (icon: IconKey) => void }) {
  return (
    <Modal open={open} onClose={onClose} title={current ? 'Change drawing' : 'Add a drawing'} size="md">
      <p className="muted">Simple line drawings, written with the same pen as the text.</p>
      <div className="icon-grid">
        {ICON_KEYS.map((icon) => (
          <button key={icon} type="button" className={`icon-tile${current === icon ? ' is-on' : ''}`} onClick={() => onPick(icon)}>
            <span className="icon-art">
              <PaperIcon icon={icon} />
            </span>
            <span className="small">{ICON_LABELS[icon]}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function DoodleModal({ open, initial, ink, onClose, onSave }: { open: boolean; initial: Stroke[]; ink: string; onClose: () => void; onSave: (s: Stroke[]) => void }) {
  const [strokes, setStrokes] = useState<Stroke[]>(initial);
  useEffect(() => {
    if (open) setStrokes(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Draw your own"
      size="md"
      footer={
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!strokes.length && !initial.length} onClick={() => onSave(strokes)}>
            {strokes.length ? 'Use this drawing' : 'Remove drawing'}
          </button>
        </div>
      }
    >
      <div className="doodle">
        <WritingPad strokes={strokes} onChange={setStrokes} ink={ink} guides="free" label="Drawing pad" />
        <div className="doodle-side">
          <p className="muted">Draw with the mouse, a pen tablet or a touch screen. The machine draws exactly these lines with its pen.</p>
          <button type="button" className="btn btn-secondary" disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}>
            <UiIcon name="undo" />
            Undo
          </button>
          <button type="button" className="btn btn-secondary" disabled={!strokes.length} onClick={() => setStrokes([])}>
            <UiIcon name="trash" />
            Clear
          </button>
        </div>
      </div>
    </Modal>
  );
}
