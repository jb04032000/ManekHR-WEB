import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';

interface MockState {
  user: { _id: string; hasPassword: boolean } | null;
  isHydrated: boolean;
  updateUser: (patch: Record<string, unknown>) => void;
}

// Mirror the real store: a patch merges into the current user so a re-render
// reflects the reconciled `hasPassword`.
const updateUser = vi.fn((patch: Record<string, unknown>) => {
  if (mockState.user) mockState.user = { ...mockState.user, ...patch } as MockState['user'];
});
let mockState: MockState;

// The component only ever reads the store via selectors.
vi.mock('@/lib/store', () => ({
  useAuthStore: (selector: (s: MockState) => unknown) => selector(mockState),
}));

const getProfile = vi.fn();
vi.mock('@/lib/actions', () => ({ getProfile: () => getProfile() }));

import { PasswordSetupPrompt } from './PasswordSetupPrompt';

const TITLE = 'Add a password to your account';

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockState = { user: null, isHydrated: true, updateUser };
});

describe('PasswordSetupPrompt', () => {
  it('hides and reconciles the store when the server already has a password', async () => {
    mockState.user = { _id: 'u1', hasPassword: false }; // stale store
    getProfile.mockResolvedValue({ hasPassword: true }); // server truth
    renderWithIntl(<PasswordSetupPrompt />);

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ hasPassword: true }));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it('shows the nudge when neither the store nor the server has a password', async () => {
    mockState.user = { _id: 'u1', hasPassword: false };
    getProfile.mockResolvedValue({ hasPassword: false });
    renderWithIntl(<PasswordSetupPrompt />);

    await waitFor(() => expect(screen.getByText(TITLE)).toBeInTheDocument());
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('never nags or fetches when the store already shows a password', () => {
    mockState.user = { _id: 'u1', hasPassword: true };
    renderWithIntl(<PasswordSetupPrompt />);

    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    expect(getProfile).not.toHaveBeenCalled();
  });
});
