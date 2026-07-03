import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/connect/stores',
}));

import StorefrontForm from './StorefrontForm';

describe('StorefrontForm', () => {
  it('renders the required name field + sections', () => {
    renderWithIntl(
      <StorefrontForm submitLabel="Create shop" submitting={false} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText('Storefront name')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('Who can see this storefront')).toBeInTheDocument();
  });

  it('submits the trimmed name', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <StorefrontForm submitLabel="Create shop" submitting={false} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Rajesh Zari Mart'), {
      target: { value: '  Rajesh Zari Mart  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create shop' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rajesh Zari Mart' }));
  });

  it('blocks submit when the name is empty', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <StorefrontForm submitLabel="Create shop" submitting={false} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create shop' }));
    await waitFor(() =>
      expect(screen.getByText('Please enter a storefront name')).toBeInTheDocument(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
