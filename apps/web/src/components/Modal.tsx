import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';

interface ModalProps {
  title: string;
  /** Called when the user dismisses the dialog (Esc). Parents unmount the Modal to close it. */
  onClose: () => void;
  /** False while saving, so Esc can't drop a request whose result we still need to show. */
  canClose?: boolean;
  /**
   * Where focus goes on close if the trigger is no longer on the page, e.g. the Delete
   * button of a row that was just deleted. Without it focus would fall back to <body>.
   */
  focusFallback?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * A modal built on the native <dialog> with showModal(), which gives focus trapping, Esc
 * and the backdrop for free. Mount it to open, unmount it to close; focus then returns
 * to whatever was focused when it opened (the trigger), if that is still on the page.
 */
export function Modal({ title, onClose, canClose = true, focusFallback, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Read during the first render: by the time effects run, React has already applied any
  // autoFocus inside the dialog, so document.activeElement would no longer be the trigger.
  const [trigger] = useState(() => document.activeElement);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
      else focusFallback?.current?.focus();
    };
    // focusFallback is a ref, read at close time, so it never needs to re-run this effect.
  }, [trigger]);

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
