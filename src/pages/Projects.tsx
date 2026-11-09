import { useEffect, useMemo, useRef, useState } from 'react';
import { ConnectModal } from '../components/Connect';
import { Modal } from '../components/Modal';
import { PaperIcon } from '../components/PaperIcon';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { UiIcon } from '../components/UiIcon';
import { INKS, PAPERS } from '../data/catalog';
import { TEMPLATES, TEMPLATE_ORDER } from '../data/templates';
import { timeAgo, useFonts } from '../lib/hooks';
import { fieldsOf, layoutDesign } from '../lib/layout';
import { useStore } from '../state/store';
import type { Project, TemplateKey } from '../types';

export function ProjectsPage() {
  const { state } = useStore();
  const [newFrom, setNewFrom] = useState<TemplateKey | null>(null);
  const [connect, setConnect] = useState(false);

  return (
    <div className="page-scroll">
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="muted">Design a card, add your guest list and let the machine write them all.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setNewFrom('place')}>
          <UiIcon name="plus" />
          New project
        </button>
      </div>

      {!state.machine.device && (
        <div className="callout">
          <UiIcon name="plotter" size={22} />
          <div>
            <strong>No machine connected.</strong> You can design and prepare lists without one. Connect the plotter when you’re ready to write.
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConnect(true)}>
            <UiIcon name="link" />
            Connect
          </button>
        </div>
      )}

      <section className="section">
        <h2 className="section-title">Start from a template</h2>
        <div className="templates">
          {TEMPLATE_ORDER.map((key) => {
            const t = TEMPLATES[key];
            const paper = PAPERS[t.paper];
            return (
              <button key={key} type="button" className="template" onClick={() => setNewFrom(key)}>
                <span className="template-icon">
                  <PaperIcon icon={t.icon} />
                </span>
                <strong>{t.label}</strong>
                <span className="muted small">{t.blurb}</span>
                <span className="template-paper">
                  {paper.label} · {paper.w} × {paper.h} mm
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Your projects</h2>
        {state.projects.length === 0 ? (
          <p className="empty">No projects yet. Pick a template above to start.</p>
        ) : (
          <div className="project-grid">
            {state.projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>

      <NewProjectModal template={newFrom} onClose={() => setNewFrom(null)} />
      <ConnectModal open={connect} onClose={() => setConnect(false)} />
    </div>
  );
}

function progressText(p: Project) {
  if (!fieldsOf(p.items).length) return `${p.copiesDone} of ${p.copies} copies written`;
  const done = p.rows.filter((r) => r.status === 'done').length;
  if (!p.rows.length) return 'No guests yet';
  return done === p.rows.length ? `All ${done} written` : `${done} of ${p.rows.length} written`;
}

function ProjectCard({ project }: { project: Project }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const fonts = useFonts();
  const [menu, setMenu] = useState(false);
  const [rename, setRename] = useState(false);
  const [remove, setRemove] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sheet = useMemo(
    () => layoutDesign(project, state.glyphs, project.rows[0]?.cells ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.items, project.paper, project.hand, project.rows, state.glyphs, fonts],
  );
  const total = fieldsOf(project.items).length ? project.rows.length : project.copies;
  const done = fieldsOf(project.items).length ? project.rows.filter((r) => r.status === 'done').length : project.copiesDone;
  const paper = PAPERS[project.paper];

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  return (
    <article className="project">
      <button type="button" className="project-open" onClick={() => dispatch({ type: 'OPEN', id: project.id })} aria-label={`Open ${project.name}`}>
        <span className={`project-thumb${paper.w > paper.h ? ' is-wide' : ''}`}>
          <Sheet sheet={sheet} ink={INKS[project.ink].color} label={`Preview of ${project.name}`} />
        </span>
      </button>
      <div className="project-info">
        <div className="project-title">
          <h3>{project.name}</h3>
          <div className="menu-wrap" ref={menuRef}>
            <button type="button" className="icon-btn" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <UiIcon name="more" />
            </button>
            {menu && (
              <div className="menu" role="menu">
                <button type="button" role="menuitem" onClick={() => (setMenu(false), setRename(true))}>
                  <UiIcon name="pen" size={16} />
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    dispatch({ type: 'DUPLICATE', id: project.id });
                    toast('Project duplicated. The copy starts with nothing written.', 'success');
                  }}
                >
                  <UiIcon name="copy" size={16} />
                  Duplicate
                </button>
                <button type="button" role="menuitem" className="danger" onClick={() => (setMenu(false), setRemove(true))}>
                  <UiIcon name="trash" size={16} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="muted small">
          {paper.label} · {timeAgo(project.updated)}
        </p>
        <div className="mini-progress" aria-label={progressText(project)}>
          <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <p className="small">{progressText(project)}</p>
      </div>

      <NameModal
        open={rename}
        title="Rename project"
        initial={project.name}
        action="Rename"
        onClose={() => setRename(false)}
        onSave={(name) => {
          dispatch({ type: 'RENAME', id: project.id, name });
          setRename(false);
        }}
      />
      <Modal
        open={remove}
        onClose={() => setRemove(false)}
        title="Delete this project?"
        size="sm"
        footer={
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setRemove(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'DELETE', id: project.id });
                setRemove(false);
                toast(`“${project.name}” was deleted.`);
              }}
            >
              Delete
            </button>
          </div>
        }
      >
        <p>
          “{project.name}” and its guest list will be removed from this laptop. Cards that are already written stay written, of course.
        </p>
      </Modal>
    </article>
  );
}

function NameModal({ open, title, initial, action, onClose, onSave }: { open: boolean; title: string; initial: string; action: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
            {action}
          </button>
        </div>
      }
    >
      <label className="field">
        <span className="field-label">Name</span>
        <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSave(name.trim())} />
      </label>
    </Modal>
  );
}

function NewProjectModal({ template, onClose }: { template: TemplateKey | null; onClose: () => void }) {
  const { dispatch } = useStore();
  const [pick, setPick] = useState<TemplateKey>('place');
  const [name, setName] = useState('');
  const [examples, setExamples] = useState(true);
  const open = template !== null;

  useEffect(() => {
    if (!template) return;
    setPick(template);
    setName('');
    setExamples(true);
  }, [template]);

  const t = TEMPLATES[pick];
  const hasList = t.rows.length > 0;
  const create = () => {
    dispatch({ type: 'CREATE', template: pick, name: name.trim() || t.label, examples });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      size="lg"
      footer={
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={create}>
            Create project
          </button>
        </div>
      }
    >
      <label className="field">
        <span className="field-label">Project name</span>
        <input autoFocus value={name} maxLength={60} placeholder={`e.g. ${t.label} for the Meier wedding`} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
      </label>
      <div className="template-pick" role="radiogroup" aria-label="Template">
        {TEMPLATE_ORDER.map((key) => {
          const tt = TEMPLATES[key];
          return (
            <button key={key} type="button" role="radio" aria-checked={pick === key} className={`template-opt${pick === key ? ' is-on' : ''}`} onClick={() => setPick(key)}>
              <span className="template-icon sm">
                <PaperIcon icon={tt.icon} />
              </span>
              <span>
                <strong>{tt.label}</strong>
                <span className="muted small"> · {PAPERS[tt.paper].label}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="muted">{t.blurb}</p>
      {hasList && (
        <label className="check">
          <input type="checkbox" checked={examples} onChange={(e) => setExamples(e.target.checked)} />
          <span>Start with the example list ({t.rows.length} entries), so you can try it right away</span>
        </label>
      )}
    </Modal>
  );
}
