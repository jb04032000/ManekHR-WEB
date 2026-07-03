import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { RelationshipState } from '../network.types';

const sendConnectionRequest = vi.fn();
const followUser = vi.fn();
const unfollowUser = vi.fn();
const removeConnection = vi.fn();
const respondToConnectionRequest = vi.fn();
const withdrawConnectionRequest = vi.fn();
vi.mock('../network.actions', () => ({
  sendConnectionRequest: (...a: unknown[]) => sendConnectionRequest(...a),
  followUser: (...a: unknown[]) => followUser(...a),
  unfollowUser: (...a: unknown[]) => unfollowUser(...a),
  removeConnection: (...a: unknown[]) => removeConnection(...a),
  respondToConnectionRequest: (...a: unknown[]) => respondToConnectionRequest(...a),
  withdrawConnectionRequest: (...a: unknown[]) => withdrawConnectionRequest(...a),
}));

// ProfileConnectActions passes `router.refresh` to the shared hook as its
// `onChanged`, so the app-router context must be stubbed.
const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

import ProfileConnectActions from './ProfileConnectActions';

/** A relationship with every edge off - the plain "stranger" viewer. */
function makeRel(over: Partial<RelationshipState> = {}): RelationshipState {
  return {
    connected: false,
    incomingRequest: false,
    outgoingRequest: false,
    following: false,
    self: false,
    incomingRequestId: null,
    outgoingRequestId: null,
    ...over,
  };
}

function renderActions(relationship: RelationshipState) {
  return renderWithIntl(
    <AntApp>
      <ProfileConnectActions userId="u1" relationship={relationship} />
    </AntApp>,
  );
}

// AntD's loading spinner keeps an `aria-label="loading"` node through a
// leave animation that jsdom never finishes - so a button's accessible name
// is unreliable after a click. Assert on the visible label text instead.
describe('ProfileConnectActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendConnectionRequest.mockResolvedValue({ ok: true, data: { _id: 'r1' } });
    followUser.mockResolvedValue({ ok: true, data: { _id: 'f1' } });
    unfollowUser.mockResolvedValue({ ok: true, data: { unfollowed: true } });
    removeConnection.mockResolvedValue({ ok: true, data: { removed: true } });
    respondToConnectionRequest.mockResolvedValue({ ok: true, data: { _id: 'r1' } });
    withdrawConnectionRequest.mockResolvedValue({ ok: true, data: { _id: 'r1' } });
  });

  it('renders no actions when the viewer is on their own profile', () => {
    renderActions(makeRel({ self: true }));
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('offers Connect + Follow to a stranger', () => {
    renderActions(makeRel());
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
  });

  it('shows a muted "Connected" status when already connected', () => {
    renderActions(makeRel({ connected: true }));
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('shows "Request sent" when the viewer already sent a request', () => {
    renderActions(makeRel({ outgoingRequest: true }));
    expect(screen.getByText('Request sent')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('shows inline Accept and Ignore for an incoming request', () => {
    renderActions(makeRel({ incomingRequest: true, incomingRequestId: 'req1' }));
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ignore' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('sends a connection request and flips to "Request sent"', async () => {
    renderActions(makeRel());
    screen.getByRole('button', { name: 'Connect' }).click();

    await waitFor(() => {
      expect(sendConnectionRequest).toHaveBeenCalledWith('u1');
    });
    await waitFor(() => {
      expect(screen.getByText('Request sent')).toBeInTheDocument();
    });
  });

  it('keeps the Connect button when the request fails', async () => {
    sendConnectionRequest.mockResolvedValue({ ok: false, error: 'nope' });
    renderActions(makeRel());
    screen.getByRole('button', { name: 'Connect' }).click();

    await waitFor(() => {
      expect(sendConnectionRequest).toHaveBeenCalled();
    });
    expect(screen.getByText('Connect')).toBeInTheDocument();
    expect(screen.queryByText('Request sent')).not.toBeInTheDocument();
  });

  it('follows a person and flips the label to "Following"', async () => {
    renderActions(makeRel());
    screen.getByRole('button', { name: 'Follow' }).click();

    await waitFor(() => {
      expect(followUser).toHaveBeenCalledWith('u1');
    });
    await waitFor(() => {
      expect(screen.getByText('Following')).toBeInTheDocument();
    });
  });

  it('unfollows a person and flips the label back to "Follow"', async () => {
    renderActions(makeRel({ following: true }));
    screen.getByRole('button', { name: 'Following' }).click();

    await waitFor(() => {
      expect(unfollowUser).toHaveBeenCalledWith('u1');
    });
    await waitFor(() => {
      expect(screen.getByText('Follow')).toBeInTheDocument();
    });
  });
});
