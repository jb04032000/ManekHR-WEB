import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';
import type { Job } from './jobs.types';

/**
 * Job-video flow for the Post-a-job / Edit composer. Mirrors the marketplace
 * ListingForm.test.tsx + profile EditSectionModal.video.test.tsx video tests:
 * the MediaUploadGrid is STUBBED with a video-mode button that fires BOTH the
 * upload (onChange) and the captured poster (onPosters), so the composer's
 * video-build path is exercised end to end and we assert the built payload
 * carries `videos: [{ url, posterUrl }]`.
 */

// The grid stub distinguishes the video grid by `mediaKind`; the video click
// simulates a clip upload + a captured poster frame (the shape the real grid
// emits in video mode).
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
          onChange(['https://cdn/clip.mp4']);
          onPosters?.({ 'https://cdn/clip.mp4': 'https://cdn/poster.jpg' });
        }}
      >
        mock-video-upload
      </button>
    ) : (
      <button type="button" onClick={() => onChange(['https://cdn/img.jpg'])}>
        mock-image-upload
      </button>
    ),
}));

// The role/category combobox typeahead hits the shared tag pool; stub it.
vi.mock('../marketplace/tag.actions', () => ({
  searchTags: vi.fn(async () => ({ ok: true, data: [] })),
}));

import JobComposer from './JobComposer';

const BASE_JOB: Job = {
  _id: 'job-1',
  companyUserId: 'u-co',
  companyPageId: null,
  title: 'Multi-needle machine operator',
  description: '',
  responsibilities: [],
  category: 'embroidery-zari',
  role: 'operator',
  wageType: null,
  wageMin: null,
  wageMax: null,
  openings: 1,
  location: { district: '', city: '', state: '' },
  skills: [],
  machineType: '',
  employmentType: null,
  experienceMin: null,
  shift: null,
  workingDays: '',
  languages: [],
  benefits: [],
  closesAt: null,
  status: 'open',
  applicationsCount: 0,
  views: 0,
  boostCampaignId: null,
};

describe('JobComposer video', () => {
  it('accepts one job video (with its captured poster) into the built payload', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <JobComposer
        open
        submitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
        // Prefill the required title + category + role via a template so the
        // submit succeeds without driving the AntD tags comboboxes (flaky in jsdom).
        mode="create"
        initial={BASE_JOB}
      />,
    );
    // The video grid stub uploads a clip + captures a poster.
    fireEvent.click(screen.getByRole('button', { name: 'mock-video-upload' }));
    fireEvent.click(screen.getByRole('button', { name: 'Post job' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          videos: [{ url: 'https://cdn/clip.mp4', posterUrl: 'https://cdn/poster.jpg' }],
        }),
      ),
    );
  });

  it('preserves an existing job video poster on edit without a fresh capture', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <JobComposer
        open
        submitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
        mode="edit"
        initial={{
          ...BASE_JOB,
          videos: [
            { url: 'https://cdn/old.mp4', posterUrl: 'https://cdn/oldposter.jpg', durationSec: 30 },
          ],
        }}
      />,
    );
    // Submit WITHOUT touching the video grid: the existing clip + its stored
    // poster must survive into the payload (an unrelated edit never drops it).
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          videos: [{ url: 'https://cdn/old.mp4', posterUrl: 'https://cdn/oldposter.jpg' }],
        }),
      ),
    );
  });
});
