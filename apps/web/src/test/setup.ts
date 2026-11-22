import '@testing-library/jest-dom/vitest';

/*
 * jsdom (27) has HTMLDialogElement but not showModal() or close(). This stand-in covers
 * what the app relies on: the open attribute, the close event, and Esc firing a cancelable
 * cancel event that closes the dialog unless prevented. It does not make the rest of the
 * page inert, so tests should not count on that.
 */
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    if (this.open) return;
    this.setAttribute('open', '');
    const target = this.querySelector<HTMLElement>('[autofocus]') ??
      this.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])');
    target?.focus();
  };

  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const dialog = (event.target as Element | null)?.closest?.('dialog[open]');
    if (!(dialog instanceof HTMLDialogElement)) return;
    const cancel = new Event('cancel', { cancelable: true });
    if (dialog.dispatchEvent(cancel)) dialog.close();
  });
}
