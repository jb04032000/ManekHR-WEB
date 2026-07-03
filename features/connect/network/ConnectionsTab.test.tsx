import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { ConnectionSummary } from '../network.types';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const removeConnection = vi.fn();
vi.mock('../network.actions', () => ({
  removeConnection: (...a: unknown[]) => removeConnection(...a),
}));

import ConnectionsTab from './ConnectionsTab';
import type { PeopleIndex } from './hydrate';

const CONNECTIONS: ConnectionSummary[] = [
  { userId: 'u1', since: '2025-01-01T00:00:00.000Z' },
  { userId: 'u2', since: '2025-02-01T00:00:00.000Z' },
];

const PEOPLE: PeopleIndex = {
  u1: { userId: 'u1', name: 'Meera Sharma', avatar: null, headline: 'Master karigar' },
  u2: { userId: 'u2', name: 'Vikas Soni', avatar: null, headline: 'Computerized embroidery' },
};

function renderTab(connections = CONNECTIONS, people = PEOPLE) {
  return renderWithIntl(
    <AntApp>
      <ConnectionsTab connections={connections} people={people} />
    </AntApp>,
  );
}

describe('ConnectionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists every connection with its resolved name', () => {
    renderTab();
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    expect(screen.getByText('Vikas Soni')).toBeInTheDocument();
  });

  it('renders the empty state when there are no connections', () => {
    renderTab([]);
    expect(screen.getByText('No connections yet')).toBeInTheDocument();
  });

  it('filters the list by name as the viewer types', async () => {
    renderTab();
    const filter = screen.getByLabelText('Search connections');
    filter.focus();
    // fire a real input event so React state updates
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(filter, 'meera');
    filter.dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => {
      expect(screen.queryByText('Vikas Soni')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
  });

  it('shows a no-match empty state when the filter matches nobody', async () => {
    renderTab();
    const filter = screen.getByLabelText('Search connections');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(filter, 'zzzzz');
    filter.dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => {
      expect(screen.getByText('No connections match')).toBeInTheDocument();
    });
  });

  it('removes a connection after the Popconfirm is confirmed', async () => {
    removeConnection.mockResolvedValue({ ok: true, data: { removed: true } });
    renderTab();

    // Each row has a Remove trigger - open the first row's confirm.
    screen.getAllByRole('button', { name: 'Remove' })[0].click();

    // The Popconfirm renders its own "Remove" confirm button.
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBeGreaterThan(2);
    });
    const buttons = screen.getAllByRole('button', { name: 'Remove' });
    buttons[buttons.length - 1].click();

    await waitFor(() => {
      expect(removeConnection).toHaveBeenCalledWith('u1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Meera Sharma')).not.toBeInTheDocument();
    });
    expect(refresh).toHaveBeenCalled();
  });
});
