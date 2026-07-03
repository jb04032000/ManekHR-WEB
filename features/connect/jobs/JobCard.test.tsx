import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { within } from '@testing-library/react';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { Job, JobApplication } from './jobs.types';

// JobCard's Save/Apply controls call the jobs server actions; stub them so the
// interaction tests assert calls without a network round-trip. applyToJob is what
// the confirm sheet fires on Confirm.
const saveJob = vi.fn();
const unsaveJob = vi.fn();
const applyToJob = vi.fn();
vi.mock('./jobs.actions', () => ({
  saveJob: (...a: unknown[]) => saveJob(...a),
  unsaveJob: (...a: unknown[]) => unsaveJob(...a),
  applyToJob: (...a: unknown[]) => applyToJob(...a),
}));

import JobCard from './JobCard';
import ApplicationCard from './ApplicationCard';

const JOB: Job = {
  _id: 'job-1',
  companyUserId: 'u-co',
  companyPageId: null,
  title: 'Multi-needle machine operator',
  description: 'Festive season, daily wage.',
  responsibilities: [],
  category: 'embroidery-zari',
  wageType: 'daily',
  wageMin: 500,
  wageMax: 700,
  openings: 4,
  location: { district: 'Surat', city: '', state: 'Gujarat' },
  skills: ['Computerized / machine'],
  machineType: 'Multi-head computerized',
  employmentType: null,
  experienceMin: null,
  shift: null,
  workingDays: '',
  languages: [],
  benefits: [],
  closesAt: null,
  status: 'open',
  applicationsCount: 2,
  views: 0,
  role: 'operator',
  boostCampaignId: null,
};

const APPLICATION: JobApplication = {
  _id: 'app-1',
  jobId: 'job-1',
  applicantUserId: 'u-karigar',
  message: 'I have 5 years of zari experience.',
  voiceNoteUrl: null,
  resumeUrl: null,
  resumeName: '',
  status: 'applied',
};

/** Wrap in AntApp so App.useApp() (message API) + Modal portal work in tests. */
function renderCard(ui: React.ReactElement) {
  return renderWithIntl(<AntApp>{ui}</AntApp>);
}

describe('JobCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveJob.mockResolvedValue({ ok: true, data: { saved: true } });
    unsaveJob.mockResolvedValue({ ok: true, data: { saved: false } });
    applyToJob.mockResolvedValue({ ok: true, data: { ...APPLICATION } });
  });

  it('renders the job title and wage on the seeker card', () => {
    renderCard(<JobCard job={JOB} />);
    expect(screen.getByText('Multi-needle machine operator')).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it('shows an "Open" status pill on a plain open seeker card (owner/seeker parity)', () => {
    // Both cards must read as the same component: seeker open jobs show "Open"
    // (owner open jobs show "Active") in the same top-right slot.
    renderCard(<JobCard job={JOB} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('does NOT show the applicant count on the seeker card (owner-only metric)', () => {
    renderCard(<JobCard job={JOB} />);
    expect(screen.queryByText('2 applicants')).not.toBeInTheDocument();
  });

  it('shows the applicant count and "Active" status on the owner My-jobs card', () => {
    renderCard(<JobCard job={JOB} showOwnerStats />);
    expect(screen.getByText('2 applicants')).toBeInTheDocument();
    // Owner cards read an open job as "Active" (with a status dot), not "Open".
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders skill and machine-type tags from real fields', () => {
    renderCard(<JobCard job={JOB} />);
    expect(screen.getByText('Computerized / machine')).toBeInTheDocument();
    expect(screen.getByText('Multi-head computerized')).toBeInTheDocument();
  });

  it("flags a job that matches the viewer's skills", () => {
    renderCard(<JobCard job={JOB} matchedSkills={['Computerized / machine']} />);
    expect(screen.getByText('Matches your skills')).toBeInTheDocument();
  });

  it('does not flag a match when skills do not overlap', () => {
    renderCard(<JobCard job={JOB} matchedSkills={['Aari']} />);
    expect(screen.queryByText('Matches your skills')).not.toBeInTheDocument();
  });

  it('shows a closing-soon flag when the deadline is near', () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    renderCard(<JobCard job={{ ...JOB, closesAt: soon }} />);
    expect(screen.getByText('Closing soon')).toBeInTheDocument();
  });

  it('drops the redundant pay-type pill (the wage "/ day" unit already says it)', () => {
    renderCard(<JobCard job={JOB} />);
    expect(screen.queryByText('Daily wage')).not.toBeInTheDocument();
    expect(screen.getByText('/ day')).toBeInTheDocument();
  });

  it('exposes a single full-card link to the job detail (employer name is not a link)', () => {
    // With no viewerId the card is NOT owner -> Save/Apply render as buttons, but
    // the ONLY link is still the stretched title link to the detail.
    renderCard(<JobCard job={JOB} employer={{ name: 'Rajesh Mehta Textiles', erpLinked: true }} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/connect/jobs/job-1');
    // The employer name renders as text, never a link.
    expect(screen.queryByRole('link', { name: /Rajesh Mehta Textiles/ })).not.toBeInTheDocument();
    expect(screen.getByText('Rajesh Mehta Textiles')).toBeInTheDocument();
  });

  it('stacks the header in the grid variant so a narrow card never crushes the title', () => {
    // Regression: grid cards are ~260px wide; the inline (list) layout puts the
    // title beside a nowrap status+wage block that refused to shrink, collapsing the
    // title to 0px width (one word per line) and overlapping it. The grid header
    // must STACK (title, then status/wage below) instead. The title must not be a
    // flex-1 item, and its container must be a flex column.
    renderCard(<JobCard job={JOB} variant="grid" />);
    const title = screen.getByRole('link');
    expect(title.className).not.toMatch(/\bflex-1\b/);
    expect(title.parentElement?.className).toMatch(/\bflex-col\b/);
  });

  it('keeps the header inline (title beside status/wage) in the default list variant', () => {
    renderCard(<JobCard job={JOB} />);
    const title = screen.getByRole('link');
    expect(title.className).toMatch(/\bflex-1\b/);
    expect(title.parentElement?.className).toMatch(/justify-between/);
  });

  it('makes a grid card full-height with the footer pinned to the bottom so action rows align across a row', () => {
    // Equal-height + bottom-aligned buttons: the card fills its (stretched) grid
    // cell (h-full + flex column) and the footer is pushed down with mt-auto, so
    // every card's Apply/Save row lines up regardless of title/tag length.
    renderCard(<JobCard job={JOB} variant="grid" />);
    const card = screen.getByRole('link').closest('.relative');
    expect(card?.className).toMatch(/\bh-full\b/);
    expect(card?.className).toMatch(/\bflex-col\b/);
    expect(card?.querySelector('.border-t')?.className).toMatch(/\bmt-auto\b/);
  });

  it('does NOT pin the footer in the list variant (full-width rows need no equal-height alignment)', () => {
    renderCard(<JobCard job={JOB} />);
    const card = screen.getByRole('link').closest('.relative');
    expect(card?.className).not.toMatch(/\bh-full\b/);
    expect(card?.querySelector('.border-t')?.className).not.toMatch(/\bmt-auto\b/);
  });

  it('saves optimistically without navigating, toggling aria-pressed', async () => {
    renderCard(<JobCard job={JOB} initialSaved={false} />);
    const save = screen.getByRole('button', { name: 'Save this job' });
    expect(save).toHaveAttribute('aria-pressed', 'false');
    save.click();
    // Optimistic flip is immediate; the action fires; no navigation (still 1 link).
    await waitFor(() => expect(saveJob).toHaveBeenCalledWith('job-1'));
    expect(screen.getByRole('button', { name: 'Saved. Tap to remove' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('opens the quick-apply modal (shared composer) and only applies after submit', async () => {
    renderCard(<JobCard job={JOB} />);
    screen.getByRole('button', { name: /apply/i }).click();
    // The modal opens (hosting the shared ApplicationComposer); nothing sent yet.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Apply for this job')).toBeInTheDocument();
    expect(applyToJob).not.toHaveBeenCalled();
    // The composer's submit sends the (empty = profile-only) application. Scoped to
    // the dialog so it does not match the card's own "Apply" button behind it.
    within(dialog).getByRole('button', { name: 'Apply' }).click();
    await waitFor(() => expect(applyToJob).toHaveBeenCalledWith('job-1', {}));
  });

  it('hides Save/Apply on the owner-on-own-job card; shows Manage (primary) + View applicants', () => {
    renderCard(<JobCard job={JOB} viewerId="u-co" />);
    expect(screen.queryByRole('button', { name: 'Save this job' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply/i })).not.toBeInTheDocument();
    // "Your job" tag dropped (status now lives top-right); Manage is the real
    // primary action + a View applicants shortcut to the detail's applicant list.
    expect(screen.queryByText('Your job')).not.toBeInTheDocument();
    const manage = screen.getByRole('link', { name: 'Manage' });
    expect(manage).toHaveAttribute('href', '/connect/jobs/job-1');
    const viewApplicants = screen.getByRole('link', { name: /view applicants/i });
    expect(viewApplicants).toHaveAttribute('href', '/connect/jobs/job-1#job-applicants');
  });

  it('renders a disabled "Applied" control when the viewer already applied', () => {
    renderCard(<JobCard job={JOB} alreadyApplied />);
    const applied = screen.getByText('Applied');
    expect(applied).toHaveAttribute('aria-disabled', 'true');
    // No actionable Apply button remains.
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });
});

describe('ApplicationCard', () => {
  it('renders the applicant name, message and status', () => {
    renderWithIntl(<ApplicationCard application={APPLICATION} applicantName="Anand Patel" />);
    expect(screen.getByText('Anand Patel')).toBeInTheDocument();
    expect(screen.getByText('I have 5 years of zari experience.')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('renders the application-tracking stepper when pipeline is set', () => {
    renderWithIntl(
      <ApplicationCard application={{ ...APPLICATION, status: 'shortlisted' }} pipeline />,
    );
    expect(screen.getByRole('list', { name: 'Application progress' })).toBeInTheDocument();
    // Accepted is a future step on the stepper; Shortlisted is the current one.
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getAllByText('Shortlisted').length).toBeGreaterThan(0);
  });

  it('shows a terminal pill (no stepper) for a declined application in pipeline mode', () => {
    renderWithIntl(
      <ApplicationCard application={{ ...APPLICATION, status: 'declined' }} pipeline />,
    );
    expect(screen.queryByRole('list', { name: 'Application progress' })).not.toBeInTheDocument();
    // "Not selected" is the declined label; appears as the tag + the terminal pill.
    expect(screen.getAllByText('Not selected').length).toBeGreaterThan(0);
  });
});
