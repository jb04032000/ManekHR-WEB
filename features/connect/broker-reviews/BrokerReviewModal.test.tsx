import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';
import type { MyBrokerReview } from './broker-reviews.types';

/**
 * BrokerReviewModal - the reviewer's write/edit form for a verified-but-anonymous
 * broker review on a confirmed introduction (Slice 3wB). The actions are mocked so
 * the test drives only the modal's own logic (the star picker, the visibility
 * default, the submit payload, and the prefill -> edit-mode path). Mirrors the
 * AntD-in-jsdom handling in JobComposer.template.test.tsx (renderWithIntl) +
 * IntroduceComposer.test.tsx (wrapped in <AntApp> for the AntApp.useApp() toast).
 */

const upsertBrokerReview = vi.fn(async () => ({ ok: true, data: {} as MyBrokerReview }));
const getMyBrokerReview = vi.fn(async () => ({ ok: true, data: null as MyBrokerReview | null }));
const withdrawBrokerReview = vi.fn(async () => ({ ok: true, data: { withdrawn: true } }));

vi.mock('./broker-reviews.actions', () => ({
  upsertBrokerReview: (...args: unknown[]) => upsertBrokerReview(...(args as [])),
  getMyBrokerReview: (...args: unknown[]) => getMyBrokerReview(...(args as [])),
  withdrawBrokerReview: (...args: unknown[]) => withdrawBrokerReview(...(args as [])),
}));

import BrokerReviewModal from './BrokerReviewModal';

const INTRO_ID = 'intro-123';

beforeEach(() => {
  vi.clearAllMocks();
  getMyBrokerReview.mockResolvedValue({ ok: true, data: null });
  upsertBrokerReview.mockResolvedValue({ ok: true, data: {} as MyBrokerReview });
  withdrawBrokerReview.mockResolvedValue({ ok: true, data: { withdrawn: true } });
});

function renderModal(onSaved = vi.fn()) {
  renderWithIntl(
    <AntApp>
      <BrokerReviewModal
        open
        introductionId={INTRO_ID}
        brokerName="Ramesh Patel"
        onClose={() => {}}
        onSaved={onSaved}
      />
    </AntApp>,
  );
  return { onSaved };
}

describe('BrokerReviewModal', () => {
  it('requires a star rating before it submits', async () => {
    renderModal();
    // Wait for the prefill fetch to settle (a no-review caller -> blank create form).
    await waitFor(() => expect(getMyBrokerReview).toHaveBeenCalledWith(INTRO_ID));

    // Submit with no star picked: the upsert action must NOT fire.
    fireEvent.click(screen.getByRole('button', { name: 'Post review' }));
    await waitFor(() => expect(screen.getByText('Please pick a star rating.')).toBeTruthy());
    expect(upsertBrokerReview).not.toHaveBeenCalled();
  });

  it('submits {introductionId, rating, text, visibility} and defaults visibility to anonymous', async () => {
    const { onSaved } = renderModal();
    await waitFor(() => expect(getMyBrokerReview).toHaveBeenCalledWith(INTRO_ID));

    // Pick 4 stars (the picker is a radiogroup of five radios labelled 1..5).
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    // Type a comment.
    fireEvent.change(screen.getByPlaceholderText(/Share how the introduction went/), {
      target: { value: 'Great intro' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Post review' }));
    await waitFor(() =>
      expect(upsertBrokerReview).toHaveBeenCalledWith({
        introductionId: INTRO_ID,
        rating: 4,
        text: 'Great intro',
        visibility: 'anonymous',
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('prefills an existing review into edit mode', async () => {
    getMyBrokerReview.mockResolvedValue({
      ok: true,
      data: {
        _id: 'rev-1',
        introductionId: INTRO_ID,
        brokerUserId: 'broker-1',
        rating: 5,
        text: 'Already reviewed',
        visibility: 'named',
      },
    });
    renderModal();

    // Edit mode: the CTA reads "Save changes" (create CTA is "Post review"), the
    // existing comment is filled, and the existing rating is selected.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy());
    expect((screen.getByDisplayValue('Already reviewed') as HTMLTextAreaElement).value).toBe(
      'Already reviewed',
    );
    expect(screen.getByRole('radio', { name: '5' }).getAttribute('aria-checked')).toBe('true');

    // Saving an edit posts the existing visibility back unchanged.
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(upsertBrokerReview).toHaveBeenCalledWith({
        introductionId: INTRO_ID,
        rating: 5,
        text: 'Already reviewed',
        visibility: 'named',
      }),
    );
  });

  it('in edit mode the Withdraw button appears and (after Popconfirm) calls withdrawBrokerReview', async () => {
    getMyBrokerReview.mockResolvedValue({
      ok: true,
      data: {
        _id: 'rev-1',
        introductionId: INTRO_ID,
        brokerUserId: 'broker-1',
        rating: 4,
        text: 'To be withdrawn',
        visibility: 'anonymous',
      },
    });
    const { onSaved } = renderModal();

    // Withdraw trigger renders in edit mode (it shares the label with the
    // Popconfirm OK button, so the trigger is the first match).
    const withdrawTriggers = await screen.findAllByRole('button', { name: 'Withdraw review' });
    fireEvent.click(withdrawTriggers[0]);

    // The Popconfirm OK confirms the withdraw - re-query so the portal button is
    // included, then click the last "Withdraw review" (the confirmation OK).
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Withdraw review' }).length).toBeGreaterThan(1),
    );
    const all = screen.getAllByRole('button', { name: 'Withdraw review' });
    fireEvent.click(all[all.length - 1]);

    await waitFor(() => expect(withdrawBrokerReview).toHaveBeenCalledWith('rev-1'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('does NOT show the Withdraw button in create mode', async () => {
    renderModal();
    // Wait for the prefill to settle (no review -> create form).
    await waitFor(() => expect(getMyBrokerReview).toHaveBeenCalledWith(INTRO_ID));
    expect(screen.queryByRole('button', { name: 'Withdraw review' })).not.toBeInTheDocument();
  });
});
