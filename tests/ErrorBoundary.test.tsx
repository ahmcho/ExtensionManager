import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';

afterEach(() => {
  cleanup();
});

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('kaboom');
  return <div>ok</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeTruthy();
  });

  it('shows a fallback when a child throws, and recovers on retry', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;

    function Wrapper() {
      return (
        <ErrorBoundary>
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }

    const { rerender } = render(<Wrapper />);
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    expect(screen.getByText('kaboom')).toBeTruthy();

    // The boundary re-renders with whatever children are current at click
    // time, so the underlying condition must be fixed before retrying —
    // matches real usage, where retry re-tries against fresh props/state,
    // not the exact input that crashed.
    shouldThrow = false;
    rerender(<Wrapper />);
    fireEvent.click(screen.getByText('Try again'));

    expect(screen.getByText('ok')).toBeTruthy();
    errorSpy.mockRestore();
  });
});
