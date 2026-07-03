/**
 * Broker reviews - VISITOR display tests (Slice 3wA).
 *
 * Covers BrokerReviews (components/connect/BrokerReviews.tsx): the proof-led
 * header renders the confirmed-introduction + review counts; an anonymous card
 * shows initials + role and NEVER a name/id; a named card shows the name; a
 * coarsened card omits the city; and the honest empty state renders.
 *
 * Cross-module: the component self-fetches getBrokerPublicProfile (the @Public
 * broker-reviews route, anchored to the introductions module). The action is
 * mocked here so the unit renders without a network call; the auth store is
 * stubbed to a signed-in viewer so the login-gate does not hide the cards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';
import type { PublicBrokerProfile } from '@/features/connect/broker-reviews/broker-reviews.types';

// Mock the server actions - getBrokerPublicProfile fires on mount (each test
// seeds the resolved payload); replyBrokerReview is exercised by the owner reply
// affordance test.
const getBrokerPublicProfile = vi.fn();
const replyBrokerReview = vi.fn(async () => ({ ok: true, data: {} }));
vi.mock('@/features/connect/broker-reviews/broker-reviews.actions', () => ({
  getBrokerPublicProfile: (id: string) => getBrokerPublicProfile(id),
  replyBrokerReview: (...args: unknown[]) => replyBrokerReview(...(args as [])),
}));

// Signed-in, hydrated viewer so the guest login-gate does not suppress the list.
// useAuthStore is a zustand selector hook AND carries statics (getState /
// subscribe) that lib/api/client.ts touches at import time; stub both so the
// whole import graph stays happy (same pattern as EditSectionModal.video.test).
vi.mock('@/lib/store', () => {
  const state = { user: { _id: 'viewer-1' }, isHydrated: true, isAppLocked: false };
  const useAuthStore = ((selector: (s: unknown) => unknown) => selector(state)) as unknown as {
    (selector: (s: unknown) => unknown): unknown;
    getState: () => typeof state;
    subscribe: () => () => void;
  };
  useAuthStore.getState = () => state;
  useAuthStore.subscribe = () => () => {};
  return { useAuthStore };
});

function aggregate(overrides: Partial<PublicBrokerProfile['aggregate']> = {}) {
  return {
    introductionsConfirmed: 12,
    distinctPeople: 9,
    ratingCount: 5,
    ratingAvg: 4.6,
    verifiedReviewRatio: 100,
    ...overrides,
  };
}

function ok(profile: PublicBrokerProfile) {
  getBrokerPublicProfile.mockResolvedValue({ ok: true, data: profile });
}

beforeEach(() => {
  getBrokerPublicProfile.mockReset();
  replyBrokerReview.mockReset();
  replyBrokerReview.mockResolvedValue({ ok: true, data: {} });
});

describe('BrokerReviews - proof-led header', () => {
  it('renders the confirmed-introduction + review counts and the distinct-people line', async () => {
    ok({ aggregate: aggregate(), reviews: [] });
    const { default: BrokerReviews } = await import('./BrokerReviews');
    renderWithIntl(<BrokerReviews brokerUserId="broker-1" />);

    // Proof line leads with confirmed introductions + review count.
    await waitFor(() =>
      expect(screen.getByText(/12 introductions confirmed by both sides/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/5 reviews/i)).toBeInTheDocument();
    // Verified line surfaces the distinct-people proof.
    expect(screen.getByText(/9 different people/i)).toBeInTheDocument();
    expect(screen.getByText(/100% from verified introductions/i)).toBeInTheDocument();
  });
});

describe('BrokerReviews - card anonymity', () => {
  it('shows an anonymous card with initials + role and NEVER a name or id', async () => {
    ok({
      aggregate: aggregate({ ratingCount: 1, introductionsConfirmed: 1, distinctPeople: 2 }),
      reviews: [
        {
          _id: 'rev-anon',
          rating: 5,
          text: 'Reliable and quick to close.',
          verifiedIntroduction: true,
          role: 'buyer',
          initials: 'R.P.',
          city: 'Surat',
        },
      ],
    });
    const { default: BrokerReviews } = await import('./BrokerReviews');
    renderWithIntl(<BrokerReviews brokerUserId="broker-1" />);

    await waitFor(() => expect(screen.getByText('R.P.')).toBeInTheDocument());
    // Role label + city (city kept = non-unique tuple).
    expect(screen.getByText(/Buyer from Surat/i)).toBeInTheDocument();
    // The verified-introduction pill is on the card.
    expect(screen.getByText('Verified introduction')).toBeInTheDocument();
    // No reviewer id and no real name ever leaks into an anonymous card.
    expect(screen.queryByText(/rev-anon/)).not.toBeInTheDocument();
    expect(screen.queryByText('viewer-1')).not.toBeInTheDocument();
  });

  it('shows the name on a named (opt-in) card', async () => {
    ok({
      aggregate: aggregate({ ratingCount: 1, introductionsConfirmed: 1, distinctPeople: 2 }),
      reviews: [
        {
          _id: 'rev-named',
          rating: 4,
          text: 'Happy to recommend.',
          verifiedIntroduction: true,
          role: 'seller',
          name: 'Anita Shah',
        },
      ],
    });
    const { default: BrokerReviews } = await import('./BrokerReviews');
    renderWithIntl(<BrokerReviews brokerUserId="broker-1" />);

    await waitFor(() => expect(screen.getByText('Anita Shah')).toBeInTheDocument());
    expect(screen.getByText('Seller')).toBeInTheDocument();
  });

  it('omits the city on a coarsened card (BE dropped a unique tuple city)', async () => {
    ok({
      aggregate: aggregate({ ratingCount: 1, introductionsConfirmed: 1, distinctPeople: 2 }),
      reviews: [
        {
          _id: 'rev-coarse',
          rating: 5,
          verifiedIntroduction: true,
          role: 'buyer',
          initials: 'S.M.',
          // city intentionally absent (thin-market coarsening).
        },
      ],
    });
    const { default: BrokerReviews } = await import('./BrokerReviews');
    renderWithIntl(<BrokerReviews brokerUserId="broker-1" />);

    await waitFor(() => expect(screen.getByText('S.M.')).toBeInTheDocument());
    // The bare role label (no "from <city>") renders when the city is coarsened.
    expect(screen.getByText('Buyer')).toBeInTheDocument();
    expect(screen.queryByText(/Buyer from/i)).not.toBeInTheDocument();
  });
});

describe('BrokerReviews - owner reply affordance', () => {
  const cardNoReply = {
    aggregate: aggregate({ ratingCount: 1, introductionsConfirmed: 1, distinctPeople: 2 }),
    reviews: [
      {
        _id: 'rev-noreply',
        rating: 5,
        text: 'Smooth introduction.',
        verifiedIntroduction: true as const,
        role: 'buyer' as const,
        initials: 'R.P.',
      },
    ],
  };

  it('shows the Reply control on a no-reply card for the owner and submitting calls replyBrokerReview', async () => {
    ok(cardNoReply);
    const { default: BrokerReviews } = await import('./BrokerReviews');
    // Wrap in <AntApp> so AntApp.useApp() yields a real message instance (the
    // reply success path toasts). Mirrors BrokerReviewModal.test.tsx.
    renderWithIntl(
      <AntApp>
        <BrokerReviews brokerUserId="broker-1" isOwner />
      </AntApp>,
    );

    // The owner sees the reply textarea on a card that has no broker reply yet.
    const box = await screen.findByPlaceholderText('Write a short reply to this review.');
    fireEvent.change(box, { target: { value: 'Thanks for the kind words!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));

    await waitFor(() =>
      expect(replyBrokerReview).toHaveBeenCalledWith('rev-noreply', 'Thanks for the kind words!'),
    );
  });

  it('does NOT show the Reply control for a non-owner visitor', async () => {
    ok(cardNoReply);
    const { default: BrokerReviews } = await import('./BrokerReviews');
    renderWithIntl(<BrokerReviews brokerUserId="broker-1" />);

    // The card renders for the visitor, but no reply box / Send control appears.
    await waitFor(() => expect(screen.getByText('R.P.')).toBeInTheDocument());
    expect(
      screen.queryByPlaceholderText('Write a short reply to this review.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send reply' })).not.toBeInTheDocument();
  });
});

describe('BrokerReviews - empty state', () => {
  it('renders the honest empty state when there are no reviews', async () => {
    ok({
      aggregate: aggregate({ introductionsConfirmed: 3, ratingCount: 0, distinctPeople: 4 }),
      reviews: [],
    });
    const { default: BrokerReviews } = await import('./BrokerReviews');
    renderWithIntl(<BrokerReviews brokerUserId="broker-1" />);

    await waitFor(() =>
      expect(
        screen.getByText(
          'No reviews yet. Every review here comes from an introduction both sides confirmed.',
        ),
      ).toBeInTheDocument(),
    );
  });
});
