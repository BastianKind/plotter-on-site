import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { UiIcon } from './UiIcon';

type Tone = 'info' | 'success' | 'warn';
type Show = (message: string, tone?: Tone) => void;

const ToastContext = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: Tone }[]>([]);
  const show = useCallback<Show>((message, tone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-1), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <UiIcon name={t.tone === 'success' ? 'check' : t.tone === 'warn' ? 'alert' : 'info'} size={20} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
