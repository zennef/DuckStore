import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  /** Called when the user dismisses the dialog (Esc). Parents unmount the Modal to close it. */
  onClose: () => void;
  /** False while saving, so Esc can't drop a request whose result we still need to show. */
  canClose?: boolean;
  children: ReactNode;
}

/**
 * A modal built on the native <dialog> with showModal(), which gives focus trapping, Esc
 * and the backdrop for free. Mount it to open, unmount it to close; focus then returns
 * to whatever was focused when it opened (the trigger), if that is still on the page.
 */
export function Modal({ title, onClose, canClose = true, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (!canClose) event.preventDefault();
      }}
      onClose={() => {
        // A close event can arrive after we reopened (StrictMode remounts); only a dialog
        // that is actually closed means the user dismissed it.
        if (!ref.current?.open) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-white p-6 text-gray-900 shadow-xl backdrop:bg-gray-900/40"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
