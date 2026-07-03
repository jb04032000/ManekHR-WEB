import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { Suggestion } from '../network.types';

const sendConnectionRequest = vi.fn();
vi.mock('../network.actions', () => ({
  sendConnectionRequest: (...a: unknown[]) => sendConnectionRequest(...a),
}));

import SuggestionsTab from './SuggestionsTab';
import type { PeopleIndex } from './hydrate';

const SUGGESTIONS: Suggestion[] = [
  // Surfaced by a shared workshop, no skill overlap.
  {
    userId: 'u1',
    score: 5,
    mutualConnections: 0,
    sharedSkills: [],
    sharedWorkspace: true,
    sharedErpParty: false,
  },
  // Surfaced by mutual connections + a shared skill.
  {
    userId: 'u2',
    score: 6,
    mutualConnections: 3,
    sharedSkills: ['Zari'],
    sharedWorkspace: false,
    sharedErpParty: false,
  },
];

const PEOPLE: PeopleIndex = {
  u1: { userId: 'u1', name: 'Meera Sharma', avatar: null, headline: 'Master karigar' },
  u2: { userId: 'u2', name: 'Vikas Soni', avatar: null, headline: 'Computerized embroidery' },
};

function renderTab(suggestions = SUGGESTIONS, people = PEOPLE) {
  return renderWithIntl(
    <AntApp>
      <SuggestionsTab suggestions={suggestions} people={people} />
    </AntApp>,
  );
}

describe('SuggestionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists every suggestion with its resolved name', () => {
    renderTab();
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    expect(screen.getByText('Vikas Soni')).toBeInTheDocument();
  });

  it('renders the empty state when there are no suggestions', () => {
    renderTab([]);
    expect(screen.getByText('No suggestions yet')).toBeInTheDocument();
  });

  it('shows the reason each person was suggested', () => {
    renderTab();
    expect(screen.getByText('Works at the same workshop as you')).toBeInTheDocument();
    expect(screen.getByText('3 shared connections')).toBeInTheDocument();
  });

  it('filters to suggestions with a shared skill', async () => {
    renderTab();
    screen.getByRole('button', { name: 'Same skills' }).click();
    await waitFor(() => {
      expect(screen.queryByText('Meera Sharma')).not.toBeInTheDocument();
    });
    // u2 has a shared skill, so it survives the filter.
    expect(screen.getByText('Vikas Soni')).toBeInTheDocument();
  });

  it('sends a connection request and flips the row to "Request sent"', async () => {
    sendConnectionRequest.mockResolvedValue({ ok: true, data: { _id: 'r1' } });
    renderTab();

    screen.getAllByRole('button', { name: 'Connect' })[0].click();

    await waitFor(() => {
      expect(sendConnectionRequest).toHaveBeenCalledWith('u1');
    });
    await waitFor(() => {
      expect(screen.getByText('Request sent')).toBeInTheDocument();
    });
  });
});
