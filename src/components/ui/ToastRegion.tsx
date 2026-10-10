import { useToast } from '../../context/ToastContext';

/** Visually rendered toast list. Mounted once inside the app layout. */
export function ToastRegion() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="toast-region" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
          <span>{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
