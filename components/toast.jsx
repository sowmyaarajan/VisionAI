// Toast notification system — provider + hook
const { createContext, useContext, useState, useCallback, useRef, useEffect } = React;

const ToastCtx = createContext(null);
const useToast = () => useContext(ToastCtx);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((opts) => {
    const id = ++idRef.current;
    const toast = { id, kind: 'info', ttl: 3200, ...opts };
    setToasts((ts) => [...ts, toast]);
    if (toast.ttl > 0) {
      setTimeout(() => {
        setToasts((ts) => ts.map((t) => t.id === id ? { ...t, leaving: true } : t));
        setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 200);
      }, toast.ttl);
    }
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((ts) => ts.map((t) => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 200);
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  const value = { push, dismiss, clear };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}${t.leaving ? ' leaving' : ''}`}>
            <div className="t-icon">
              <Icon name={t.kind === 'ok' ? 'check-circle' : t.kind === 'bad' ? 'alert' : 'info'} size={15} />
            </div>
            <div className="t-text">
              <div className="t-title">{t.title}</div>
              {t.sub && <div className="t-sub">{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

window.ToastProvider = ToastProvider;
window.useToast = useToast;
