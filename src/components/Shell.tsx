import { useEffect, useState } from 'react';
import { INKS, PAPERS } from '../data/catalog';
import { formatDuration } from '../lib/layout';
import { useRun } from '../state/run';
import { useProject, useStore } from '../state/store';
import type { Page } from '../types';
import { ConnectModal } from './Connect';
import { useToast } from './Toast';
import { UiIcon, type UiIconName } from './UiIcon';

/** Looks like the window of a desktop app. The window buttons are only for show. */
export function TitleBar() {
  const project = useProject();
  const toast = useToast();
  const fake = () => toast('Prototype: this is a web page that looks like the desktop app.');
  return (
    <header className="titlebar">
      <span className="app-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <rect width="24" height="24" rx="6" fill="#0b1b45" />
          <path d="M10.5 4.5h3v8h-3z" fill="#fff" />
          <path d="M10.5 13h3L12 16.5z" fill="#fff" />
          <path d="M12 16.5c1.5 2.5 5 3 8 1.5" stroke="#4d74ff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </span>
      <span className="titlebar-name">plotter Studio</span>
      {project && <span className="titlebar-project">— {project.name}</span>}
      <span className="proto-pill" title="Clickable prototype for user tests. Nothing is really written or sent.">
        Prototype
      </span>
      <div className="win-buttons">
        <button type="button" aria-label="Minimise (does nothing in the prototype)" onClick={fake}>
          <UiIcon name="winMin" size={14} />
        </button>
        <button type="button" aria-label="Maximise (does nothing in the prototype)" onClick={fake}>
          <UiIcon name="winMax" size={12} />
        </button>
        <button type="button" className="win-close" aria-label="Close (does nothing in the prototype)" onClick={fake}>
          <UiIcon name="x" size={15} />
        </button>
      </div>
    </header>
  );
}

function NavButton({ page, icon, label, badge, disabled }: { page: Page; icon: UiIconName; label: string; badge?: string; disabled?: boolean }) {
  const { state, dispatch } = useStore();
  const on = state.page === page;
  return (
    <button type="button" className={`nav-btn${on ? ' is-on' : ''}`} aria-current={on ? 'page' : undefined} disabled={disabled} onClick={() => dispatch({ type: 'GO', page })}>
      <UiIcon name={icon} size={19} />
      <span>{label}</span>
      {badge && <span className="nav-badge">{badge}</span>}
    </button>
  );
}

export function Sidebar() {
  const { state } = useStore();
  const project = useProject();
  const { run } = useRun();
  const connected = !!state.machine.device;
  const writing = run.status === 'writing' || run.status === 'paused' || run.status === 'paper';
  const writingHere = writing && run.projectId === project?.id;

  return (
    <nav className="sidebar" aria-label="Main">
      <NavButton page="projects" icon="grid" label="Projects" />
      <div className="nav-project">
        <p className="nav-project-name" title={project?.name}>
          {project ? project.name : 'No project open'}
        </p>
        <NavButton page="design" icon="pen" label="Design" disabled={!project} />
        <NavButton page="data" icon="users" label="Guest list" disabled={!project} badge={project && project.rows.length ? String(project.rows.length) : undefined} />
        <NavButton page="write" icon="play" label="Write" disabled={!project} badge={writingHere ? '●' : undefined} />
      </div>
      <div className="nav-bottom">
        <NavButton page="machine" icon="plotter" label="Machine" badge={connected ? undefined : '!'} />
        <NavButton page="settings" icon="settings" label="Settings" />
      </div>
    </nav>
  );
}

export function StatusBar() {
  const { state } = useStore();
  const { run, secondsLeft, currentLabel } = useRun();
  const [connect, setConnect] = useState(false);
  const m = state.machine;
  const project = state.projects.find((p) => p.id === run.projectId);
  const busy = run.status === 'writing' || run.status === 'paused' || run.status === 'paper';

  let job = 'Idle';
  if (busy && project) {
    const what = run.status === 'paused' ? 'Paused' : run.status === 'paper' ? 'Waiting for the next card' : `Writing ${currentLabel}`;
    job = `${what} · ${Math.min(run.index + 1, run.queue.length)} of ${run.queue.length} · ${formatDuration(secondsLeft)} left`;
  } else if (run.status === 'done' && project) job = `Done: ${run.written} ${run.written === 1 ? 'card' : 'cards'} for ${project.name}`;

  return (
    <footer className="statusbar">
      {m.device ? (
        <span className="sb-item">
          <span className={`dot ${busy ? 'dot-busy' : 'dot-ok'}`} />
          {m.device.name} · {m.device.via} {m.device.address} · {busy ? 'Busy' : 'Ready'}
        </span>
      ) : (
        <button type="button" className="sb-item sb-connect" onClick={() => setConnect(true)}>
          <span className="dot dot-off" />
          No machine connected · <u>Connect</u>
        </button>
      )}
      <span className="sb-item sb-job">
        {busy && <UiIcon name={run.status === 'writing' ? 'pen' : 'pause'} size={14} />}
        {job}
      </span>
      <span className="sb-item">
        <span className="ink-dot sm" style={{ background: INKS[m.pen].color }} />
        {INKS[m.pen].pen}
      </span>
      {project && busy && <span className="sb-item">{PAPERS[project.paper].label}</span>}
      <ConnectModal open={connect} onClose={() => setConnect(false)} />
    </footer>
  );
}

/** Pauses the writing when the machine goes away (cable pulled). */
export function useDisconnectGuard() {
  const { state } = useStore();
  const { run, pause } = useRun();
  const toast = useToast();
  const connected = !!state.machine.device;
  useEffect(() => {
    if (!connected && run.status === 'writing') {
      pause();
      toast('The machine was disconnected, so writing is paused.', 'warn');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);
}
