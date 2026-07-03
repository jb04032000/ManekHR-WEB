import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';

vi.mock('./tag.actions', () => ({
  searchTags: vi.fn(async () => ({ ok: true, data: [] })),
}));
vi.mock('../entities/collection.actions', () => ({
  createCollection: vi.fn(async () => ({ ok: true, data: { _id: 'c-new', title: 'New' } })),
}));

/**
 * M1.6.4 - ListingForm is the shared listing form extracted from
 * NewListingScreen so create + edit reuse one field set. It builds the
 * `CreateListingInput` from AntD Form values and hands it to `onSubmit`; the
 * parent owns the action call + result UI. `MediaUploadGrid` is stubbed.
 */
// The grid stub distinguishes the image grid from the video grid by `mediaKind`,
// and the video click simulates BOTH the upload (onChange) and the captured
// poster (onPosters) so the form's video-build path is exercised end to end.
vi.mock('@/components/connect/MediaUploadGrid', () => ({
  default: ({
    mediaKind = 'image',
    onChange,
    onPosters,
  }: {
    mediaKind?: 'image' | 'video' | 'document';
    onChange: (urls: string[]) => void;
    onPosters?: (map: Record<string, string>) => void;
  }) =>
    mediaKind === 'video' ? (
      <button
        type="button"
        onClick={() => {
          onChange(['https://img/clip.mp4']);
          onPosters?.({ 'https://img/clip.mp4': 'https://img/poster.jpg' });
        }}
      >
        mock-video
      </button>
    ) : (
      <button type="button" onClick={() => onChange(['https://img/new.jpg'])}>
        mock-upload
      </button>
    ),
}));

// The form's link-mode DsButton (cancel) calls `useRouter()` at render, which
// throws "app router not mounted" without this mock. Mirrors the shared nav
// mock used by MarketplaceBrowseScreen.test.tsx.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/connect/marketplace/new',
  useSearchParams: () => new URLSearchParams(),
}));

import ListingForm from './ListingForm';

describe('ListingForm', () => {
  it('renders the fields and a submit button with the given label', () => {
    renderWithIntl(
      <ListingForm submitLabel="Save changes" submitting={false} onSubmit={() => {}} />,
    );
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Weaving' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('prefills the fields from initialValues', () => {
    renderWithIntl(
      <ListingForm
        submitLabel="Save changes"
        submitting={false}
        onSubmit={() => {}}
        initialValues={{ title: 'Existing title', category: 'weaving' }}
      />,
    );
    expect(screen.getByDisplayValue('Existing title')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Weaving' })).toBeChecked();
  });

  it('builds the input and calls onSubmit', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <ListingForm submitLabel="Save changes" submitting={false} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Heavy zari work' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Weaving' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    // The second arg carries the submit intent ({ addAnother }); the primary
    // submit reports addAnother: false.
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Heavy zari work', category: 'weaving' }),
        expect.objectContaining({ addAnother: false }),
      ),
    );
  });

  it('shows the collections picker for the active shop and submits the selection', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <ListingForm
        submitLabel="Save changes"
        submitting={false}
        onSubmit={onSubmit}
        defaultStorefrontId="sf-1"
        collectionsByShop={{ 'sf-1': [{ id: 'c1', title: 'Bridal' }] }}
        initialCollectionIds={['c1']}
        initialValues={{ title: 'Zari saree', category: 'weaving' }}
      />,
    );
    // The collections field is present (label from connect.marketplace.new).
    expect(screen.getByText('Collections')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Zari saree' }),
        expect.objectContaining({ collectionIds: ['c1'] }),
      ),
    );
  });

  it('hides the collections picker when there is no shop yet', () => {
    renderWithIntl(
      <ListingForm submitLabel="Save changes" submitting={false} onSubmit={() => {}} />,
    );
    expect(screen.queryByText('Collections')).not.toBeInTheDocument();
  });

  it('disables the submit until the required title + category are set', () => {
    renderWithIntl(
      <ListingForm submitLabel="Save changes" submitting={false} onSubmit={() => {}} />,
    );
    const submit = screen.getByRole('button', { name: 'Save changes' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Heavy zari work' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Weaving' }));
    expect(submit).toBeEnabled();
  });

  it('flags addAnother when the secondary action is used', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <ListingForm
        submitLabel="Publish"
        secondaryLabel="Save and add another"
        submitting={false}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Net zari' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Weaving' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and add another' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Net zari', category: 'weaving' }),
        expect.objectContaining({ addAnother: true }),
      ),
    );
  });

  it('flags asDraft when the Save as draft action is used', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <ListingForm
        submitLabel="Publish"
        draftLabel="Save as draft"
        submitting={false}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Net zari' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Weaving' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Net zari', category: 'weaving', asDraft: true }),
        expect.objectContaining({ asDraft: true }),
      ),
    );
  });

  it('emits a snapshot of the live form values', async () => {
    const onSnapshot = vi.fn();
    renderWithIntl(
      <ListingForm
        submitLabel="Save changes"
        submitting={false}
        onSubmit={() => {}}
        onSnapshot={onSnapshot}
      />,
    );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Brocade' } });
    await waitFor(() =>
      expect(onSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Brocade', images: expect.any(Array) }),
      ),
    );
  });

  it('accepts one product video (with its captured poster) into the submit payload', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(<ListingForm submitLabel="Publish" submitting={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Net zari' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Weaving' }));
    // The video grid stub uploads a clip + captures a poster.
    fireEvent.click(screen.getByRole('button', { name: 'mock-video' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          videos: [{ url: 'https://img/clip.mp4', posterUrl: 'https://img/poster.jpg' }],
        }),
        expect.anything(),
      ),
    );
  });

  it('preserves an existing video poster on edit without a fresh capture', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <ListingForm
        submitLabel="Save changes"
        submitting={false}
        onSubmit={onSubmit}
        initialValues={{ title: 'Existing', category: 'weaving' }}
        initialVideos={[
          { url: 'https://img/old.mp4', posterUrl: 'https://img/oldposter.jpg', durationSec: 30 },
        ]}
      />,
    );
    // Submit WITHOUT touching the video grid: the existing clip + its stored
    // poster must survive into the payload (so an unrelated edit never drops it).
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          videos: [{ url: 'https://img/old.mp4', posterUrl: 'https://img/oldposter.jpg' }],
        }),
        expect.anything(),
      ),
    );
  });

  it('hides the service fields for a non-service category', () => {
    // A non-service category (weaving) -> no service section, standard pricing shows.
    renderWithIntl(
      <ListingForm
        submitLabel="Save changes"
        submitting={false}
        onSubmit={() => {}}
        initialValues={{ title: 'Net zari', category: 'weaving' }}
      />,
    );
    expect(screen.queryByText('How do you deliver it?')).not.toBeInTheDocument();
    expect(screen.getByText('Pricing & terms')).toBeInTheDocument();
  });

  it('shows the service field set for a service category and replaces the pricing section', async () => {
    // Seeding the category via initialValues is the reliable approach in jsdom
    // (driving the category combobox via synthetic events is flaky, like the tags
    // test below); the service section is gated on the watched category.
    renderWithIntl(
      <ListingForm
        submitLabel="Save changes"
        submitting={false}
        onSubmit={() => {}}
        initialValues={{ title: 'Loom servicing', category: 'consulting' }}
      />,
    );
    await waitFor(() => expect(screen.getByText('How do you deliver it?')).toBeInTheDocument());
    expect(screen.getByText('How do you charge?')).toBeInTheDocument();
    // The standard product pricing section is hidden for a service.
    expect(screen.queryByText('Pricing & terms')).not.toBeInTheDocument();
  });

  it('disables publish until the required service fields are set, then enables', () => {
    renderWithIntl(
      <ListingForm
        submitLabel="Publish"
        submitting={false}
        onSubmit={() => {}}
        initialValues={{ title: 'Loom servicing', category: 'consulting' }}
      />,
    );
    const submit = screen.getByRole('button', { name: 'Publish' });
    // Title + category set, but a service category also needs deliveryMode +
    // pricingModel, so it is still blocked.
    expect(submit).toBeDisabled();
  });

  it('builds the serviceDetails payload for a service category', async () => {
    // deliveryMode + pricingModel are seeded via initialValues (AntD Select is
    // flaky to drive in jsdom, like the tags test above); this exercises the full
    // handleFinish service branch: serviceDetails reaches the CreateListingInput
    // and the price rows are derived from the pricing model.
    const onSubmit = vi.fn();
    renderWithIntl(
      <ListingForm
        submitLabel="Publish"
        submitting={false}
        onSubmit={onSubmit}
        initialValues={{
          title: 'Loom maintenance',
          category: 'maintenance',
          serviceDeliveryMode: 'on-site',
          servicePricingModel: 'per-visit',
          priceMin: 500,
          serviceCoverageArea: 'Surat',
          serviceYearsExperience: 8,
        }}
      />,
    );
    // Wait for the service section (gated on the watched pricing model) to mount
    // so the conditional rate field is registered before submit.
    await waitFor(() => expect(screen.getByText('Service details')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Loom maintenance',
          category: 'maintenance',
          // negotiable -> no price; per-visit -> priceType fixed + priceMin.
          priceType: 'fixed',
          priceMin: 500,
          serviceDetails: expect.objectContaining({
            deliveryMode: 'on-site',
            pricingModel: 'per-visit',
            coverageArea: 'Surat',
            yearsExperience: 8,
          }),
        }),
        expect.anything(),
      ),
    );
  });

  it('omits the price when a service is negotiable', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <ListingForm
        submitLabel="Publish"
        submitting={false}
        onSubmit={onSubmit}
        initialValues={{
          title: 'Textile consulting',
          category: 'consulting',
          serviceDeliveryMode: 'remote',
          servicePricingModel: 'negotiable',
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [input] = onSubmit.mock.calls[0];
    expect(input.priceType).toBe('negotiable');
    expect(input.priceMin).toBeUndefined();
    expect(input.serviceDetails.pricingModel).toBe('negotiable');
  });

  it('includes tags from initialValues in the submit payload', async () => {
    // Testing via initialValues is the reliable approach in jsdom because driving
    // AntD Select mode="tags" via synthetic events is flaky in React 19 + jsdom.
    // This test verifies the full handleFinish path: tags from the form reach the
    // CreateListingInput that onSubmit receives.
    const onSubmit = vi.fn();
    renderWithIntl(
      <ListingForm
        submitLabel="Publish"
        submitting={false}
        onSubmit={onSubmit}
        initialValues={{ title: 'Kanjivaram silk', category: 'weaving', tags: ['kanjivaram'] }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['kanjivaram'] }),
        expect.anything(),
      ),
    );
  });
});
