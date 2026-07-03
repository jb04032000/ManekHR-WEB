import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';

/**
 * Company-page video edit flow (the video section of CompanyPageForm). Mirrors
 * the marketplace ListingForm + profile EditSectionModal video tests: the
 * MediaUploadGrid is STUBBED with a video-mode button that fires BOTH the upload
 * (onChange) and the captured poster (onPosters), so the form's video-build path
 * is exercised end to end and we assert the built payload carries
 * `videos: [{ url, posterUrl }]`.
 */

// DsButton uses next/navigation in link mode; mock it so the cancel link renders.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/connect/pages',
}));

// The grid stub: a single button that, on click, simulates a clip upload + a
// captured poster frame (the same shape MediaUploadGrid emits in video mode).
// The image-mode grids (logo/banner) render an inert button so the rest of the
// form is unaffected.
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
          onChange(['https://cdn/company-clip.mp4']);
          onPosters?.({ 'https://cdn/company-clip.mp4': 'https://cdn/company-poster.jpg' });
        }}
      >
        mock-video-upload
      </button>
    ) : (
      <button type="button" onClick={() => onChange([])}>
        mock-image-upload
      </button>
    ),
}));

import CompanyPageForm from './CompanyPageForm';

describe('CompanyPageForm - company video', () => {
  beforeEach(() => vi.clearAllMocks());

  it('captures an uploaded clip + poster and submits videos:[{url,posterUrl}]', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <CompanyPageForm submitLabel="Create page" submitting={false} onSubmit={onSubmit} />,
    );

    // Name is required for submit to fire.
    fireEvent.change(screen.getByPlaceholderText('e.g. Rajesh Textiles'), {
      target: { value: 'Rajesh Textiles' },
    });
    // Upload a clip (the stub fires onChange + onPosters together).
    fireEvent.click(screen.getByRole('button', { name: 'mock-video-upload' }));
    // Submit the form.
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          videos: [
            { url: 'https://cdn/company-clip.mp4', posterUrl: 'https://cdn/company-poster.jpg' },
          ],
        }),
      ),
    );
  });

  it('does not send a videos array when no clip is added', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <CompanyPageForm submitLabel="Create page" submitting={false} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Rajesh Textiles'), {
      target: { value: 'Rajesh Textiles' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].videos).toBeUndefined();
  });
});
