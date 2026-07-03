import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';

// Router + announcer deps used by the editor.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/connect/pages',
}));

// Mock the server actions so we can capture exactly what the editor submits.
const updateCompanyPage = vi.fn(async () => ({ ok: true, data: { _id: 'cp-1' } }));
const createCompanyPage = vi.fn(async () => ({ ok: true, data: { _id: 'cp-1' } }));
vi.mock('./company-page.actions', () => ({
  updateCompanyPage: (...args: unknown[]) => updateCompanyPage(...args),
  createCompanyPage: (...args: unknown[]) => createCompanyPage(...args),
  browseCompanyLocations: vi.fn(async () => ({ ok: true, data: [] })),
  linkPageErp: vi.fn(async () => ({ ok: true, data: {} })),
  unlinkPageErp: vi.fn(async () => ({ ok: true, data: {} })),
}));

import CompanyPageEditor from './CompanyPageEditor';
import type { CompanyPage } from './entities.types';

const initial = {
  _id: 'cp-1',
  ownerUserId: 'u1',
  slug: 'rajesh-textiles',
  name: 'Rajesh Textiles',
  kind: 'business',
  visibility: 'public',
} as unknown as CompanyPage;

describe('CompanyPageEditor submit', () => {
  beforeEach(() => {
    updateCompanyPage.mockClear();
    createCompanyPage.mockClear();
  });

  it('sends the capability/industryPanel fields (Specializes-in section) on Save', async () => {
    renderWithIntl(<CompanyPageEditor initial={initial} />);

    // Fill a Capabilities field (plain Input) - this lives under industryPanel.
    const machineInput = screen.getByPlaceholderText('e.g. 12 power looms');
    fireEvent.change(machineInput, { target: { value: '24 power looms' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateCompanyPage).toHaveBeenCalledTimes(1));
    const [, payload] = updateCompanyPage.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.industryPanel).toEqual(
      expect.objectContaining({ machineCapacity: '24 power looms' }),
    );
  });
});
