import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import ConnectErrorBoundary from './ConnectErrorBoundary';

// Sentry must not fire a real network call in tests.
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

function Boom(): never {
  throw new Error('design-system demo error');
}

describe('ConnectErrorBoundary', () => {
  it('renders children when there is no error', () => {
    renderWithIntl(
      <ConnectErrorBoundary>
        <div>safe child</div>
      </ConnectErrorBoundary>,
    );
    expect(screen.getByText('safe child')).toBeInTheDocument();
  });

  it('renders the recoverable fallback when a child throws', () => {
    // React logs the caught error to console.error - expected, silence it.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithIntl(
      <ConnectErrorBoundary>
        <Boom />
      </ConnectErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    spy.mockRestore();
  });
});
