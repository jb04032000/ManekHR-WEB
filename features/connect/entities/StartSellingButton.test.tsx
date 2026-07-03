import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';
import StartSellingButton from './StartSellingButton';
import type { CompanyPage } from './entities.types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('./storefront.actions', () => ({
  createStorefront: vi.fn(async () => ({ ok: true, data: { _id: 'sf-new' } })),
}));

const PAGE: CompanyPage = {
  _id: 'cp-1',
  ownerUserId: 'u-1',
  slug: 'rajesh-textiles',
  name: 'Rajesh Textiles',
  logo: '',
  banner: '',
  about: 'Family-run zari embroidery unit since 1998.',
  kind: 'business',
  industryPanel: {
    specialization: ['embroidery-zari', 'job-work'],
    machineCapacity: '12 power looms',
    production: '5000 metres / week',
    languages: ['gu', 'hi'],
  },
  location: { district: 'Surat', city: '', state: 'Gujarat' },
  erpWorkspaceId: null,
  visibility: 'public',
};

describe('StartSellingButton', () => {
  it('opens the quick-setup prefilled from the company page', async () => {
    renderWithIntl(<StartSellingButton page={PAGE} />);

    const cta = screen.getByRole('button', { name: /Start selling/i });
    fireEvent.click(cta);

    // The shop name is prefilled from the company name.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Rajesh Textiles')).toBeInTheDocument();
    });
    expect(screen.getByText(/prefilled the shop/i)).toBeInTheDocument();
  });
});
