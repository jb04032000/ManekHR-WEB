import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';
import type { Job } from './jobs.types';

/**
 * "Start from a past job" template picker on the Post-a-job composer. Picking a
 * past job from the dropdown copies its fields into the form so the NEW post is
 * pre-filled (same prefill as the company-page row "Use as template"). Mirrors the
 * stubbing in JobComposer.video.test.tsx (MediaUploadGrid + the tag typeahead) so
 * the test never drives the flaky AntD tags comboboxes - the picker fills those
 * fields programmatically via the form store.
 */

vi.mock('@/components/connect/MediaUploadGrid', () => ({
  default: ({ onChange }: { onChange: (urls: string[]) => void }) => (
    <button type="button" onClick={() => onChange([])}>
      mock-grid
    </button>
  ),
}));

vi.mock('../marketplace/tag.actions', () => ({
  searchTags: vi.fn(async () => ({ ok: true, data: [] })),
}));

import JobComposer from './JobComposer';

const PAST_JOB: Job = {
  _id: 'job-past-1',
  companyUserId: 'u-co',
  companyPageId: null,
  title: 'Multi-needle machine operator',
  description: 'Run the multi-needle line',
  responsibilities: ['Thread the machine', 'Check stitch density'],
  category: 'embroidery-zari',
  role: 'operator',
  wageType: 'daily',
  wageMin: 100,
  wageMax: 500,
  openings: 2,
  location: { district: 'Bhavnagar', city: '', state: 'Gujarat' },
  skills: ['multi-needle', 'zari'],
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
  createdAt: '2026-06-12T00:00:00.000Z',
};

describe('JobComposer template picker', () => {
  it('copies a chosen past job into the built payload as a NEW post', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(
      <JobComposer
        open
        submitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
        templates={[PAST_JOB]}
      />,
    );

    // Open the picker and choose the past job (label = title + posted date).
    const picker = screen.getByLabelText('Start from a past job');
    fireEvent.mouseDown(picker);
    const option = (await screen.findAllByText(/Multi-needle machine operator/))[0];
    fireEvent.click(option);

    // Post: the copied fields ride into the payload; closesAt is dropped (re-post).
    fireEvent.click(screen.getByRole('button', { name: 'Post job' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Multi-needle machine operator',
          category: 'embroidery-zari',
          role: 'operator',
          skills: ['multi-needle', 'zari'],
          wageType: 'daily',
          wageMin: 100,
          wageMax: 500,
          openings: 2,
        }),
      ),
    );
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('closesAt');
  });

  it('does not show the picker when no templates are passed', () => {
    renderWithIntl(<JobComposer open submitting={false} onClose={() => {}} onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText('Start from a past job')).toBeNull();
  });
});
