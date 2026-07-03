import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';

// DsButton uses next/navigation in link mode; mock it so the cancel link renders.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/connect/pages',
}));

import CompanyPageForm from './CompanyPageForm';

describe('CompanyPageForm', () => {
  it('renders the required name field and the labelled sections', () => {
    renderWithIntl(
      <CompanyPageForm submitLabel="Create page" submitting={false} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText('Business name')).toBeInTheDocument();
    // Section titles render as <h2> headings; query by role so they don't
    // collide with same-named field labels (e.g. the "About" textarea label).
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Visibility' })).toBeInTheDocument();
  });

  it('submits the trimmed name through onSubmit', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <CompanyPageForm submitLabel="Create page" submitting={false} onSubmit={onSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. Rajesh Textiles'), {
      target: { value: '  Rajesh Textiles  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rajesh Textiles' }));
  });

  it('blocks submit and shows an error when the name is empty', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <CompanyPageForm submitLabel="Create page" submitting={false} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    await waitFor(() =>
      expect(screen.getByText('Please enter a business name')).toBeInTheDocument(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
