import { act, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ToastProvider, useToast, type ToastTone } from './Toast';

function Trigger({ message, tone }: { message: string; tone?: ToastTone }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast(message, tone)}>
      Notify
    </button>
  );
}

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces toasts in a polite live region and hides them after a while', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger message="Duck #8 added." />
      </ToastProvider>,
    );

    act(() => screen.getByRole('button', { name: 'Notify' }).click());
    const toast = screen.getByText('Duck #8 added.');
    expect(toast.closest('[aria-live="polite"]')).not.toBeNull();

    act(() => vi.advanceTimersByTime(4999));
    expect(screen.getByText('Duck #8 added.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Duck #8 added.')).not.toBeInTheDocument();
  });

  it('keeps error toasts up longer', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger message="Duck 4 not found" tone="error" />
      </ToastProvider>,
    );

    act(() => screen.getByRole('button', { name: 'Notify' }).click());
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('Duck 4 not found')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText('Duck 4 not found')).not.toBeInTheDocument();
  });

  it('shows at most three at once, dropping the oldest', () => {
    function Burst() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => [1, 2, 3, 4].forEach((n) => toast(`Toast ${n}`))}>
          Burst
        </button>
      );
    }
    render(
      <ToastProvider>
        <Burst />
      </ToastProvider>,
    );

    act(() => screen.getByRole('button', { name: 'Burst' }).click());
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    expect(screen.getByText('Toast 4')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(3);
  });
});
