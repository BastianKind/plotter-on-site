import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { UiIcon } from '../components/UiIcon';
import { parseCSV, toGuests } from '../lib/csv';
import { fieldLabel, fieldsOf } from '../lib/layout';
import { useStore } from '../state/store';
import type { Project, Row } from '../types';

const STATUS: Record<Row['status'], { label: string; icon: 'check' | 'skip' | 'pen' }> = {
  done: { label: 'Written', icon: 'check' },
  skipped: { label: 'Skipped', icon: 'skip' },
  todo: { label: 'To write', icon: 'pen' },
};

export function DataPage({ project }: { project: Project }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const fields = fieldsOf(project.items);
  const [query, setQuery] = useState('');
  const [clear, setClear] = useState(false);
  const [pending, setPending] = useState<Record<string, string>[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const rows = project.rows;
  const done = rows.filter((r) => r.status === 'done').length;
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => Object.values(r.cells).some((v) => v.toLowerCase().includes(q))) : rows;

  if (!fields.length) return <CopiesOnly project={project} />;

  const addGuests = (guests: Record<string, string>[], replace: boolean) => {
    dispatch({ type: 'INSERT_ROWS', rows: guests, replace });
    toast(`${replace ? 'Replaced the list with' : 'Added'} ${guests.length} ${guests.length === 1 ? 'guest' : 'guests'}.`, 'success');
  };

  const importFile = async (file: File) => {
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
      toast('Please save the Excel sheet as CSV first (File → Save as → CSV).', 'warn');
      return;
    }
    const { guests, ignored } = toGuests(parseCSV(await file.text()), fields);
    if (!guests.length) {
      toast('That file looks empty.', 'warn');
      return;
    }
    if (ignored) toast(`${ignored} extra ${ignored === 1 ? 'column was' : 'columns were'} left out, the design doesn’t use ${ignored === 1 ? 'it' : 'them'}.`);
    if (rows.length) setPending(guests);
    else addGuests(guests, true);
  };

  // Pasting several lines from Excel adds them as new guests.
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const { guests } = toGuests(parseCSV(text), fields);
    if (guests.length) addGuests(guests, false);
  };

  const focusCell = (rowIndex: number, col: number) =>
    window.setTimeout(() => tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${rowIndex}-${col}"]`)?.focus(), 30);

  const onCellKey = (e: KeyboardEvent<HTMLInputElement>, rowIndex: number, col: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (rowIndex < shown.length - 1) focusCell(rowIndex + 1, col);
    else if (!q) {
      dispatch({ type: 'ADD_ROW' });
      focusCell(rowIndex + 1, 0);
    }
  };

  return (
    <div className="page-scroll">
      <div className="page-head">
        <div>
          <h1>Guest list</h1>
          <p className="muted">
            {rows.length} {rows.length === 1 ? 'guest' : 'guests'} · {done} written
          </p>
        </div>
        <div className="head-actions">
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0]).finally(() => (e.target.value = ''))} />
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            <UiIcon name="upload" />
            Import CSV
          </button>
          {rows.length > 0 && (
            <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setClear(true)}>
              <UiIcon name="trash" />
              Clear list
            </button>
          )}
          <button type="button" className="btn btn-primary" disabled={!rows.length} onClick={() => dispatch({ type: 'GO', page: 'write' })}>
            Write
            <UiIcon name="arrowRight" />
          </button>
        </div>
      </div>

      <div className="callout callout-soft">
        <UiIcon name="braces" size={20} />
        <div>
          The columns come from the fields in your design: {fields.map((f) => <code key={f}>{`{${f}}`}</code>)}. Type, paste lines straight from Excel, or import a CSV file.
        </div>
      </div>

      <div className="table-tools">
        <label className="search">
          <UiIcon name="search" size={16} />
          <input type="search" placeholder="Search the list" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the list" />
        </label>
        {q && (
          <span className="muted small">
            {shown.length} of {rows.length} shown
          </span>
        )}
      </div>

      <div className="table-wrap">
        <table className="grid-table" ref={tableRef}>
          <thead>
            <tr>
              <th className="col-num">#</th>
              {fields.map((f) => (
                <th key={f}>{fieldLabel(f)}</th>
              ))}
              <th className="col-status">Status</th>
              <th className="col-actions">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const index = rows.indexOf(r);
              const st = STATUS[r.status];
              return (
                <tr key={r.id} className={`row-${r.status}`}>
                  <td className="col-num">{index + 1}</td>
                  {fields.map((f, col) => (
                    <td key={f}>
                      <input
                        className="cell"
                        data-cell={`${i}-${col}`}
                        value={r.cells[f] ?? ''}
                        placeholder={fieldLabel(f)}
                        aria-label={`${fieldLabel(f)}, row ${index + 1}`}
                        onChange={(e) => dispatch({ type: 'UPDATE_CELL', rowId: r.id, key: f, value: e.target.value })}
                        onKeyDown={(e) => onCellKey(e, i, col)}
                        onPaste={onPaste}
                      />
                    </td>
                  ))}
                  <td className="col-status">
                    <button
                      type="button"
                      className={`status status-${r.status}`}
                      title={r.status === 'todo' ? 'Mark as written' : 'Write this one again'}
                      onClick={() => dispatch({ type: 'ROW_STATUS', projectId: project.id, rowId: r.id, status: r.status === 'todo' ? 'done' : 'todo' })}
                    >
                      <UiIcon name={st.icon} size={14} />
                      {st.label}
                    </button>
                  </td>
                  <td className="col-actions">
                    <button
                      type="button"
                      className="icon-btn sm"
                      aria-label={`Preview row ${index + 1} in the design`}
                      title="Preview in the design"
                      onClick={() => {
                        dispatch({ type: 'SET_PREVIEW', index });
                        dispatch({ type: 'GO', page: 'design' });
                      }}
                    >
                      <UiIcon name="eye" size={16} />
                    </button>
                    <button type="button" className="icon-btn sm" aria-label={`Remove row ${index + 1}`} onClick={() => dispatch({ type: 'REMOVE_ROW', rowId: r.id })}>
                      <UiIcon name="trash" size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="empty">The list is empty. Add a guest below, paste from Excel or import a CSV file.</p>}
        <button
          type="button"
          className="add-row"
          onClick={() => {
            setQuery('');
            dispatch({ type: 'ADD_ROW' });
            focusCell(rows.length, 0);
          }}
        >
          <UiIcon name="plus" size={16} />
          Add guest
        </button>
      </div>

      <Modal
        open={clear}
        onClose={() => setClear(false)}
        title="Clear the whole list?"
        size="sm"
        footer={
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setClear(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'INSERT_ROWS', rows: [], replace: true });
                setClear(false);
              }}
            >
              Clear list
            </button>
          </div>
        }
      >
        <p>All {rows.length} guests will be removed from this project.</p>
      </Modal>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={`Import ${pending?.length ?? 0} guests`}
        size="sm"
        footer={
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => (pending && addGuests(pending, false), setPending(null))}>
              Add to the list
            </button>
            <button type="button" className="btn btn-primary" onClick={() => (pending && addGuests(pending, true), setPending(null))}>
              Replace the list
            </button>
          </div>
        }
      >
        <p>The list already has {rows.length} guests. Add the new ones at the end, or replace the whole list?</p>
      </Modal>
    </div>
  );
}

function CopiesOnly({ project }: { project: Project }) {
  const { dispatch } = useStore();
  const set = (n: number) => dispatch({ type: 'PROJECT', patch: { copies: Math.max(1, Math.min(999, n)) } });
  return (
    <div className="page-scroll">
      <div className="page-head">
        <div>
          <h1>How many cards?</h1>
          <p className="muted">This design has no fields, so every card is the same.</p>
        </div>
      </div>
      <div className="copies-card">
        <div className="stepper lg" aria-label="Number of cards">
          <button type="button" aria-label="One less" onClick={() => set(project.copies - 1)}>
            <UiIcon name="minus" />
          </button>
          <input value={project.copies} inputMode="numeric" aria-label="Number of cards" onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || 1)} />
          <button type="button" aria-label="One more" onClick={() => set(project.copies + 1)}>
            <UiIcon name="plus" />
          </button>
        </div>
        <p className="muted">{project.copiesDone} written so far.</p>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'GO', page: 'write' })}>
          Write
          <UiIcon name="arrowRight" />
        </button>
      </div>
      <p className="muted small hint">
        Want a name on every card? In the design, select a text and insert a field like <code>{'{name}'}</code>. You then get a guest list here.
      </p>
    </div>
  );
}
