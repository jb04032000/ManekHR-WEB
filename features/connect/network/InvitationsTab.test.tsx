import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { ConnectionRequest } from '../network.types';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

// Server actions are mocked - the tab is exercised against deterministic data.
const respondToConnectionRequest = vi.fn();
const withdrawConnectionRequest = vi.fn();
const listInvitations = vi.fn();
const getPeople = vi.fn();
vi.mock('../network.actions', () => ({
  respondToConnectionRequest: (...a: unknown[]) => respondToConnectionRequest(...a),
  withdrawConnectionRequest: (...a: unknown[]) => withdrawConnectionRequest(...a),
  listInvitations: (...a: unknown[]) => listInvitations(...a),
  getPeople: (...a: unknown[]) => getPeople(...a),
}));

import InvitationsTab from './InvitationsTab';
import type { PeopleIndex } from './hydrate';

function request(over: Partial<ConnectionRequest> = {}): ConnectionRequest {
  return {
    _id: 'r1',
    fromUserId: 'u-sender',
    toUserId: 'u-me',
    status: 'pending',
    note: null,
    respondedAt: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

const PEOPLE: PeopleIndex = {
  'u-sender': { userId: 'u-sender', name: 'Imran Sheikh', avatar: null, headline: 'Aari karigar' },
};

function renderTab(requests: ConnectionRequest[], people: PeopleIndex = PEOPLE) {
  return renderWithIntl(
    <AntApp>
      <InvitationsTab initialRequests={requests} initialPeople={people} />
    </AntApp>,
  );
}

describe('InvitationsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders received requests with the sender resolved from the people index', () => {
    renderTab([request()]);
    expect(screen.getByText('Imran Sheikh')).toBeInTheDocument();
    expect(screen.getByText('Aari karigar')).toBeInTheDocument();
  });

  it('shows the Accept and Ignore actions on a received request', () => {
    renderTab([request()]);
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ignore' })).toBeInTheDocument();
  });

  it('renders the optional request note when present', () => {
    renderTab([request({ note: 'Salaam, lets work together' })]);
    expect(screen.getByText('Salaam, lets work together')).toBeInTheDocument();
  });

  it('accepts a request, drops the row, and refreshes the route', async () => {
    respondToConnectionRequest.mockResolvedValue({
      ok: true,
      data: request({ status: 'accepted' }),
    });
    renderTab([request()]);

    screen.getByRole('button', { name: 'Accept' }).click();

    await waitFor(() => {
      expect(respondToConnectionRequest).toHaveBeenCalledWith('r1', 'accept');
    });
    await waitFor(() => {
      expect(screen.queryByText('Imran Sheikh')).not.toBeInTheDocument();
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('keeps the row when an accept fails', async () => {
    respondToConnectionRequest.mockResolvedValue({ ok: false, error: 'Network down' });
    renderTab([request()]);

    screen.getByRole('button', { name: 'Accept' }).click();

    await waitFor(() => {
      expect(respondToConnectionRequest).toHaveBeenCalled();
    });
    expect(screen.getByText('Imran Sheikh')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('renders the empty state when the received box has no requests', () => {
    renderTab([]);
    expect(screen.getByText('No invitations right now')).toBeInTheDocument();
  });

  it('re-fetches and hydrates the Sent box when that sub-filter is chosen', async () => {
    listInvitations.mockResolvedValue({
      ok: true,
      data: [request({ _id: 'r2', fromUserId: 'u-me', toUserId: 'u-target', status: 'pending' })],
    });
    getPeople.mockResolvedValue({
      ok: true,
      data: [{ userId: 'u-target', name: 'Nidhi Kapoor', avatar: null, headline: 'Designer' }],
    });
    renderTab([request()]);

    screen.getByRole('button', { name: 'Sent' }).click();

    await waitFor(() => {
      expect(listInvitations).toHaveBeenCalledWith('sent');
    });
    await waitFor(() => {
      expect(screen.getByText('Nidhi Kapoor')).toBeInTheDocument();
    });
    // The Sent box exposes Withdraw, not Accept.
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
  });
});
