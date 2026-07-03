import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import PersonCard from './PersonCard';
import type { ConnectPerson } from './PersonCard';

// The "open to work" Message control is StartConversationButton, which self-hides
// unless the inbox module flag is on and hits the network on click. Force the
// flag on and stub the action + router so the button renders in tests.
vi.mock('@/lib/connect/flags', () => ({ isConnectModuleEnabled: () => true }));
vi.mock('@/features/connect/inbox/inbox.actions', () => ({
  startInboxDm: vi.fn(async () => ({ ok: true, data: { _id: 'thread1' } })),
  startInboxContextThread: vi.fn(async () => ({ ok: true, data: { _id: 'thread1' } })),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const person: ConnectPerson = {
  userId: 'u1',
  name: 'Meera Sharma',
  headline: 'Master karigar · Hand zardozi',
  badges: ['erp', 'gst'],
};

describe('PersonCard', () => {
  it('renders the name and headline', () => {
    renderWithIntl(<PersonCard person={person} />);
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    expect(screen.getByText('Master karigar · Hand zardozi')).toBeInTheDocument();
  });

  it('links the name to the in-app profile URL', () => {
    renderWithIntl(<PersonCard person={person} />);
    const links = screen.getAllByRole('link');
    // In-app surfaces link to the authenticated profile mirror (`/connect/u`),
    // not the logged-out public `/u` route.
    expect(links.some((l) => l.getAttribute('href') === '/connect/u/u1')).toBe(true);
  });

  it('renders the trust badges', () => {
    renderWithIntl(<PersonCard person={person} />);
    expect(screen.getByText('ERP-linked')).toBeInTheDocument();
  });

  it('renders a caller-supplied action', () => {
    renderWithIntl(<PersonCard person={person} action={<button>Connect</button>} />);
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('shows a Message control when the person is open to work', () => {
    renderWithIntl(<PersonCard person={{ ...person, openStatus: 'work' }} />);
    // partyName builds the accessible name via connect.inbox.start.messageAria.
    expect(screen.getByRole('button', { name: /Meera Sharma/ })).toBeInTheDocument();
  });

  it('does not show a Message control when openStatus is null', () => {
    renderWithIntl(<PersonCard person={{ ...person, openStatus: null }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not show a Message control when openStatus is hiring', () => {
    renderWithIntl(<PersonCard person={{ ...person, openStatus: 'hiring' }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
