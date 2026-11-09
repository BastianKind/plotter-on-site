import { Sidebar, StatusBar, TitleBar, useDisconnectGuard } from './components/Shell';
import { ToastProvider } from './components/Toast';
import { FontsContext, useFontsLoaded } from './lib/hooks';
import { DataPage } from './pages/Data';
import { DesignPage } from './pages/Design';
import { MachinePage } from './pages/Machine';
import { ProjectsPage } from './pages/Projects';
import { SettingsPage } from './pages/Settings';
import { WritePage } from './pages/Write';
import { RunProvider } from './state/run';
import { StoreProvider, useProject, useStore } from './state/store';

function CurrentPage() {
  const { state } = useStore();
  const project = useProject();
  switch (state.page) {
    case 'projects':
      return <ProjectsPage />;
    case 'design':
      return project ? <DesignPage project={project} /> : <ProjectsPage />;
    case 'data':
      return project ? <DataPage project={project} /> : <ProjectsPage />;
    case 'write':
      return project ? <WritePage project={project} /> : <ProjectsPage />;
    case 'machine':
      return <MachinePage />;
    case 'settings':
      return <SettingsPage />;
  }
}

function Window() {
  useDisconnectGuard();
  return (
    <div className="app">
      <TitleBar />
      <Sidebar />
      <main className="page">
        <CurrentPage />
      </main>
      <StatusBar />
    </div>
  );
}

export default function App() {
  const fonts = useFontsLoaded();
  return (
    <FontsContext.Provider value={fonts}>
      <StoreProvider>
        <RunProvider>
          <ToastProvider>
            <Window />
          </ToastProvider>
        </RunProvider>
      </StoreProvider>
    </FontsContext.Provider>
  );
}
