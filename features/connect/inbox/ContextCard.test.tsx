import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import en from '@/app/messages/en.json';
import ContextCard from './ContextCard';
import type { InboxThread } from './inbox.types';

// Forward aria-label / className so the card's accessible name (the deep-link
// aria-label) survives into the rendered <a> for role-name queries.
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Server actions are mocked so the test never imports server-only code and can
// assert the inline actions call the right mutation.
const setApplicationStatus = vi.fn(async () => ({ ok: true, data: {} }));
const acceptApplication = vi.fn(async () => ({ ok: true, data: {} }));
vi.mock('../jobs/jobs.actions', () => ({
  setApplicationStatus: (...a: unknown[]) => setApplicationStatus(...(a as [])),
  acceptApplication: (...a: unknown[]) => acceptApplication(...(a as [])),
}));
const acceptQuote = vi.fn(async () => ({ ok: true, data: {} }));
const declineQuote = vi.fn(async () => ({ ok: true, data: {} }));
const shortlistQuote = vi.fn(async () => ({ ok: true, data: {} }));
const withdrawQuote = vi.fn(async () => ({ ok: true, data: {} }));
vi.mock('../rfq/rfq.actions', () => ({
  acceptQuote: (...a: unknown[]) => acceptQuote(...(a as [])),
  declineQuote: (...a: unknown[]) => declineQuote(...(a as [])),
  shortlistQuote: (...a: unknown[]) => shortlistQuote(...(a as [])),
  withdrawQuote: (...a: unknown[]) => withdrawQuote(...(a as [])),
}));

beforeEach(() => vi.clearAllMocks());

function renderCard(thread: InboxThread) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={en}>
        <ContextCard thread={thread} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const base: InboxThread = {
  _id: 't1',
  channelType: 'inquiry',
  contextEntityType: 'Inquiry',
  contextEntityId: 'q1',
  context: null,
  party: { userId: 'u2', name: 'Meera Sharma', avatar: null, handle: null },
  lastMessage: null,
  lastActivityAt: '2026-06-01T00:00:00.000Z',
  unreadCount: 0,
  archived: false,
  muted: false,
  closed: false,
};

describe('ContextCard - inquiry', () => {
  it('renders the product card (title, MOQ, status, deep-link) for an inquiry', () => {
    renderCard({
      ...base,
      context: {
        kind: 'inquiry',
        listingId: 'L9',
        title: 'Golden zari border',
        coverImage: 'https://img/x.jpg',
        priceType: 'fixed',
        priceMin: 4500,
        priceMax: null,
        unit: 'metre',
        moq: 50,
        status: 'viewed',
      },
    });
    expect(screen.getByText('Golden zari border')).toBeInTheDocument();
    expect(screen.getByText(/MOQ 50/)).toBeInTheDocument();
    expect(screen.getByText('Seen')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'View product: Golden zari border' });
    expect(link.getAttribute('href')).toBe('/connect/marketplace/listing/L9');
  });

  it('falls back to a lean label with NO party name when the listing is gone', () => {
    renderCard({ ...base, context: null });
    expect(screen.getByText('Product inquiry')).toBeInTheDocument();
    expect(screen.queryByText('Meera Sharma')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('ContextCard - application (employer view)', () => {
  const employerThread: InboxThread = {
    ...base,
    channelType: 'application',
    contextEntityType: 'JobApplication',
    contextEntityId: 'a1',
  };
  const employerCtx = {
    kind: 'application' as const,
    jobId: 'J7',
    title: 'Aari embroidery karigar',
    companyName: 'Surat Textiles',
    companyLogo: null,
    wageType: 'monthly' as const,
    wageMin: 18000,
    wageMax: 24000,
    district: 'Surat',
    status: 'applied' as const,
    viewed: false,
    jobStatus: 'open' as const,
    viewerRole: 'employer' as const,
    applicant: {
      headline: 'Zari karigar, 8 yrs',
      matchedSkills: ['Zari', 'Sequins'],
      jobSkillCount: 3,
      district: 'Jetpur',
      pastApplicant: true,
    },
  };

  it('shows the applicant snapshot (headline, matched skill, past applicant)', () => {
    renderCard({ ...employerThread, context: employerCtx });
    expect(screen.getByText('Zari karigar, 8 yrs')).toBeInTheDocument();
    expect(screen.getByText('Zari')).toBeInTheDocument();
    expect(screen.getByText('2/3 skills')).toBeInTheDocument();
    expect(screen.getByText('Applied before')).toBeInTheDocument();
  });

  it('offers the employer actions and runs a light one (shortlist)', async () => {
    renderCard({ ...employerThread, context: employerCtx });
    expect(screen.getByRole('button', { name: 'Shortlist' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Shortlist' }));
    await waitFor(() => expect(setApplicationStatus).toHaveBeenCalledWith('a1', 'shortlisted'));
  });

  it('asks for confirmation before a consequential action (accept)', () => {
    renderCard({ ...employerThread, context: employerCtx });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(screen.getByText('Accept this applicant? This fills the job.')).toBeInTheDocument();
    expect(acceptApplication).not.toHaveBeenCalled();
  });
});

describe('ContextCard - application (applicant view)', () => {
  it('shows no snapshot and no employer actions for the applicant', () => {
    renderCard({
      ...base,
      channelType: 'application',
      contextEntityType: 'JobApplication',
      contextEntityId: 'a1',
      context: {
        kind: 'application',
        jobId: 'J7',
        title: 'Helper',
        companyName: null,
        companyLogo: null,
        wageType: null,
        wageMin: null,
        wageMax: null,
        district: null,
        status: 'shortlisted',
        viewed: true,
        jobStatus: 'open',
        viewerRole: 'applicant',
        applicant: null,
      },
    });
    expect(screen.getByText('Shortlisted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Shortlist' })).not.toBeInTheDocument();
    expect(screen.queryByText('Applied before')).not.toBeInTheDocument();
  });
});

describe('ContextCard - quote', () => {
  const quoteThread: InboxThread = {
    ...base,
    channelType: 'quote',
    contextEntityType: 'Quote',
    contextEntityId: 'qt1',
  };
  const quoteCtxBase = {
    kind: 'quote' as const,
    rfqId: 'R3',
    title: 'Cotton poplin 2000m',
    sampleImage: null,
    price: 92000,
    quantity: 2000,
    unit: 'metre',
    budgetMin: 80000,
    budgetMax: 100000,
    district: 'Ahmedabad',
    status: 'sent' as const,
    rfqStatus: 'open' as const,
  };

  it('renders the RFQ card and buyer actions, deep-linking to the RFQ', () => {
    renderCard({ ...quoteThread, context: { ...quoteCtxBase, viewerRole: 'buyer' } });
    expect(screen.getByText('Cotton poplin 2000m')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'View request: Cotton poplin 2000m' });
    expect(link.getAttribute('href')).toBe('/connect/rfq/R3');
    expect(screen.getByRole('button', { name: 'Accept quote' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('offers the supplier an Update-quote link to the RFQ composer + withdraw', () => {
    renderCard({ ...quoteThread, context: { ...quoteCtxBase, viewerRole: 'supplier' } });
    const update = screen.getByRole('link', { name: 'Update quote' });
    expect(update.getAttribute('href')).toBe('/connect/rfq/R3');
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
    // The buyer-only accept action must not appear for the supplier.
    expect(screen.queryByRole('button', { name: 'Accept quote' })).not.toBeInTheDocument();
  });
});

describe('ContextCard - candidate_request (Institutes Phase 2, Feature 4)', () => {
  const hireThread: InboxThread = {
    ...base,
    channelType: 'candidate_request',
    contextEntityType: 'CandidateRequest',
    contextEntityId: 'cr1',
  };
  const hireCtx = {
    kind: 'candidate_request' as const,
    candidateRequestId: 'cr1',
    pageId: 'P5',
    pageName: 'Surat Textile Institute',
    pageSlug: 'surat-textile-institute',
    pageLogo: null,
    fromUserName: 'Ramesh Patel',
    status: 'sent' as const,
    messageSnippet: 'We need 3 power-loom operators',
  };

  it('renders the institute card: name, sender, status chip, snippet, deep-link', () => {
    renderCard({ ...hireThread, context: hireCtx });
    // The institute name is the subject title.
    expect(screen.getByText('Surat Textile Institute')).toBeInTheDocument();
    // The sender + snippet share the meta line.
    expect(screen.getByText(/From Ramesh Patel/)).toBeInTheDocument();
    expect(screen.getByText(/We need 3 power-loom operators/)).toBeInTheDocument();
    // The status chip maps the lifecycle (sent -> "Sent").
    expect(screen.getByText('Sent')).toBeInTheDocument();
    // The whole row deep-links to the public institute page.
    const link = screen.getByRole('link', { name: 'View institute: Surat Textile Institute' });
    expect(link.getAttribute('href')).toBe('/connect/company/surat-textile-institute');
  });

  it('renders WITHOUT a link (deleted-entity safety) when pageSlug is null', () => {
    renderCard({ ...hireThread, context: { ...hireCtx, pageSlug: null } });
    // The card still shows the institute name + title, just no navigation.
    expect(screen.getByText('Surat Textile Institute')).toBeInTheDocument();
    expect(screen.getByText('Hire our trained candidates')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // A static, non-clickable row exposes role=note (no Cue chevron).
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('falls back to a lean label with NO party name when the institute is gone', () => {
    renderCard({ ...hireThread, context: null });
    expect(screen.getByText('Hire our trained candidates')).toBeInTheDocument();
    expect(screen.queryByText('Meera Sharma')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('ContextCard - other channels', () => {
  it('renders nothing for a plain DM', () => {
    const { container } = renderCard({
      ...base,
      channelType: 'dm',
      contextEntityType: null,
      contextEntityId: null,
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the system label and no party name', () => {
    renderCard({
      ...base,
      channelType: 'system',
      contextEntityType: null,
      contextEntityId: null,
    });
    expect(screen.getByText('System notices from ManekHR')).toBeInTheDocument();
    expect(screen.queryByText('Meera Sharma')).not.toBeInTheDocument();
  });
});
