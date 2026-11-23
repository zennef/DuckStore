import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'success' | 'error';
type ShowToast = (message: string, tone?: ToastTone) => void;

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<ShowToast | null>(null);

/** Errors stay up longer: they usually explain why something the user did didn't happen. */
const DURATION_MS: Record<ToastTone, number> = { success: 5000, error: 8000 };
const MAX_VISIBLE = 3;

/**
 * Holds the toasts and renders them in one polite live region, which is always in the DOM
 * so screen readers pick up each new message without stealing focus.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ShowToast>((message, tone = 'success') => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current, { id, message, tone }].slice(-MAX_VISIBLE));
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DURATION_MS[toast.tone]);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const toneClass =
    toast.tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-gray-200 bg-white text-gray-900';

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border p-3 text-sm shadow-lg ${toneClass}`}
    >
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="rounded px-1 text-gray-500 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside a ToastProvider');
  return show;
}
