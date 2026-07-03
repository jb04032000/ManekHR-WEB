import { describe, it, expect, vi } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { Job } from './jobs.types';

/**
 * Job-detail poster-first video player. The player renders ONLY when the job
 * carries a video (job.videos[0]); a job with no video shows no player. Mirrors
 * the marketplace ListingDetailScreen + profile ProfileView video sections.
 */

// The screen's actions + child controls hit the network / app router; stub them
// so the render is pure. Only the video branch is under test here.
vi.mock('./jobs.actions', () => ({
  acceptApplication: vi.fn(),
  applyToJob: vi.fn(),
  closeJob: vi.fn(),
  saveJob: vi.fn(),
  setApplicationStatus: vi.fn(),
  unsaveJob: vi.fn(),
  updateJob: vi.fn(),
  withdrawApplication: vi.fn(),
}));
vi.mock('./JobComposer', () => ({ default: () => null }));
vi.mock('@/features/connect/inbox/StartConversationButton', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import JobDetailScreen from './JobDetailScreen';

const BASE_JOB: Job = {
  _id: 'job-1',
  companyUserId: 'u-co',
  companyPageId: null,
  title: 'Multi-needle machine operator',
  description: 'Festive season work.',
  responsibilities: [],
  category: 'embroidery-zari',
  role: 'operator',
  wageType: 'daily',
  wageMin: 500,
  wageMax: 700,
  openings: 2,
  location: { district: 'Surat', city: '', state: 'Gujarat' },
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

function renderScreen(job: Job) {
  return renderWithIntl(
    <AntApp>
      <JobDetailScreen job={job} isCompany={false} applications={[]} myApplication={null} />
    </AntApp>,
  );
}

describe('JobDetailScreen video', () => {
  it('renders the poster-first player when the job has a video', () => {
    renderScreen({
      ...BASE_JOB,
      videos: [{ url: 'https://cdn/clip.mp4', posterUrl: 'https://cdn/poster.jpg' }],
    });
    // The native <video> carries the localized aria-label (connect.jobs.video.play).
    const player = screen.getByLabelText('Play video');
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute('poster', 'https://cdn/poster.jpg');
    expect(player.querySelector('source')?.getAttribute('src') ?? player.getAttribute('src')).toBe(
      'https://cdn/clip.mp4',
    );
  });

  it('renders no player when the job has no video', () => {
    renderScreen(BASE_JOB);
    expect(screen.queryByLabelText('Play video')).not.toBeInTheDocument();
  });
});
