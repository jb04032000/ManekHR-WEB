import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import IntentCards from './IntentCards';
import type { ConnectOpenTo, ConnectOpenToDetails, ProfileOpenJobs } from '../profile.types';

// StartConversationButton self-hides unless the inbox module flag is on, and
// startInboxDm hits the network on click. Force the flag on and stub the action
// so the visitor `work` Message control renders without a real request.
vi.mock('@/lib/connect/flags', () => ({ isConnectModuleEnabled: () => true }));
vi.mock('@/features/connect/inbox/inbox.actions', () => ({
  startInboxDm: vi.fn(async () => ({ ok: true, data: { _id: 'thread1' } })),
  startInboxContextThread: vi.fn(async () => ({ ok: true, data: { _id: 'thread1' } })),
}));
// next/navigation router (StartConversationButton calls useRouter().push).
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

/**
 * IntentCards tests - verify render-order gating, CTA auth routing
 * (deep-link vs `/connect` join), owner audience hint + manage affordance,
 * and the live hiring numbers. next/link renders a plain <a> in jsdom, so no
 * router mock is needed; we assert hrefs via getAttribute.
 *
 * Inline messages mirror the connect.profile.intents.* keys the component
 * references (the next task wires these into the real message files).
 */
const messages = {
  connect: {
    profile: {
      intents: {
        emptyOwner: 'Let people know what you are open to.',
        manage: 'Manage',
        hiring: {
          title: 'Hiring',
          fallback: 'Open roles available.',
          cta: '{applicants} applicants',
          roles: '{count} roles',
        },
        customOrders: {
          title: 'Providing services',
          fallback: 'Available for job-work and services.',
          cta: 'Request a quote',
        },
        deals: {
          title: 'Open to deals',
          fallback: 'Open to wholesale deals.',
          cta: 'Send inquiry',
        },
        work: {
          title: 'Open to work',
          fallback: 'Looking for work.',
          cta: 'Message',
        },
        audience: {
          labelAll: 'Visible to everyone',
          labelNetwork: 'Visible to your network',
        },
      },
    },
  },
};

const allOff: ConnectOpenTo = { work: false, hiring: false, deals: false, customOrders: false };

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('IntentCards', () => {
  it('shows the owner add-prompt when no intents are active', () => {
    const onEdit = vi.fn();
    wrap(<IntentCards openTo={allOff} openToDetails={{}} isOwner userId="meera" onEdit={onEdit} />);
    expect(screen.getByText('Let people know what you are open to.')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Manage' });
    btn.click();
    expect(onEdit).toHaveBeenCalled();
  });

  it('renders a visitor hiring card with live applicant count and an employer deep link', () => {
    const openJobs: ProfileOpenJobs = { count: 2, applicants: 14, jobs: [] };
    wrap(
      <IntentCards
        openTo={{ ...allOff, hiring: true }}
        openToDetails={{}}
        isOwner={false}
        isSignedIn
        userId="meera"
        openJobs={openJobs}
      />,
    );
    expect(screen.getByText('14 applicants')).toBeInTheDocument();
    expect(screen.getByText('2 roles')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /applicants/ });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('/connect/jobs');
    expect(href).toContain('employer=meera');
  });

  it('renders the detail blurb when openToDetails has one', () => {
    wrap(
      <IntentCards
        openTo={{ ...allOff, hiring: true }}
        openToDetails={{
          hiring: { detail: 'Two zari karigar roles, day shift.', audience: 'all' },
        }}
        isOwner={false}
        isSignedIn
        userId="meera"
      />,
    );
    expect(screen.getByText('Two zari karigar roles, day shift.')).toBeInTheDocument();
  });

  it('routes a logged-out work CTA to /connect (join), not the deep link', () => {
    // deals + customOrders are PAUSED 2026-06-09; `work` is a visible intent.
    wrap(
      <IntentCards
        openTo={{ ...allOff, work: true }}
        openToDetails={{}}
        isOwner={false}
        userId="meera"
        subjectUserId="user123"
      />,
    );
    const link = screen.getByRole('link', { name: 'Message' });
    expect(link.getAttribute('href')).toBe('/connect');
    expect(link.getAttribute('href')).not.toContain('/connect/inbox');
  });

  it('renders a real Message control for a signed-in non-owner work card', () => {
    wrap(
      <IntentCards
        openTo={{ ...allOff, work: true }}
        openToDetails={{}}
        isOwner={false}
        isSignedIn
        userId="meera"
        subjectUserId="user123"
      />,
    );
    // The Message control is a button (StartConversationButton), not the dead
    // `?to=` link. Accessible name = the work.cta label ("Message").
    const btn = screen.getByRole('button', { name: 'Message' });
    expect(btn).toBeInTheDocument();
    // The old visitor deep link must be gone for the work card.
    expect(screen.queryByRole('link', { name: 'Message' })).toBeNull();
  });

  it('shows the owner audience hint and hides the visitor deep link', () => {
    wrap(
      <IntentCards
        openTo={{ ...allOff, work: true }}
        openToDetails={{ work: { audience: 'network' } }}
        isOwner
        userId="meera"
        subjectUserId="user123"
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText('Visible to your network')).toBeInTheDocument();
    // No visitor deep link for the owner.
    expect(screen.queryByRole('link', { name: 'Message' })).toBeNull();
  });

  it('renders the Providing services card (customOrders) but not the paused deals card', () => {
    // `customOrders` is reframed as "Providing services" and is live again;
    // `deals` stays PAUSED, so even with its boolean set no card renders.
    wrap(
      <IntentCards
        openTo={{ ...allOff, deals: true, customOrders: true }}
        openToDetails={{}}
        isOwner={false}
        isSignedIn
        userId="meera"
        subjectUserId="user123"
      />,
    );
    // Providing services (customOrders) renders with its Request-a-quote CTA.
    expect(screen.getByText('Providing services')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a quote' })).toBeInTheDocument();
    // deals stays paused - no card, no inquiry CTA.
    expect(screen.queryByText('Open to deals')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Send inquiry' })).toBeNull();
  });
});
