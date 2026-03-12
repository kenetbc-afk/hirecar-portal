import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 6000),
    info: (msg) => addToast(msg, 'info'),
    warn: (msg) => addToast(msg, 'warn'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto cursor-pointer min-w-[280px] max-w-[380px] px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm
              transition-all duration-300 flex items-start gap-3
              ${t.leaving ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}
              ${t.type === 'success' ? 'bg-hc-success/95 text-white border-hc-success' : ''}
              ${t.type === 'error' ? 'bg-hc-red/95 text-white border-hc-red' : ''}
              ${t.type === 'info' ? 'bg-ink/95 text-cream border-gold/30' : ''}
              ${t.type === 'warn' ? 'bg-gold/95 text-ink border-gold' : ''}
            `}
          >
            <span className="text-lg flex-shrink-0">
              {t.type === 'success' && '✓'}
              {t.type === 'error' && '✕'}
              {t.type === 'info' && 'ℹ'}
              {t.type === 'warn' && '⚠'}
            </span>
            <p className="text-sm font-sans leading-snug">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
