/**
 * Store-level coverage for the "delete your only/last workspace" change.
 *
 * What it does: asserts the exact useWorkspaceStore transitions the workspace
 * settings page's handleDeleteWorkspace relies on after a delete —
 *   - list still has workspaces → setWorkspaces + setCurrentWorkspaceId(first)
 *   - list is now EMPTY (last workspace deleted) → clearWorkspace() zeroes the
 *     pointer (currentWorkspaceId/currentWorkspace) AND the array, so a stale
 *     pointer can't flash before DashboardLayout redirects to
 *     /auth/setup-workspace.
 * Cross-module links: app/dashboard/workspace/page.tsx (handleDeleteWorkspace),
 * components/layout/DashboardLayout.tsx (zero-workspace onboarding gate).
 * Watch-outs: setCurrentWorkspaceId is typed string-only, which is WHY the
 * empty case uses clearWorkspace() — keep this test in sync if that affordance
 * changes. We reset Zustand + localStorage between tests so persist() state
 * never leaks across cases.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// store.ts statically imports the '@/lib/actions/cookies' server action (which
// pulls in next/headers). The workspace store never calls it, but the static
// import must resolve under jsdom — stub it to an inert no-op.
vi.mock('@/lib/actions/cookies', () => ({
  syncAuthCookie: vi.fn().mockResolvedValue(undefined),
  isViewerSignedIn: vi.fn().mockResolvedValue(false),
  clearAuthCookie: vi.fn().mockResolvedValue(undefined),
  getRefreshCookieValue: vi.fn().mockResolvedValue(undefined),
  getAccessCookieValue: vi.fn().mockResolvedValue(undefined),
}));

import { useWorkspaceStore } from '@/lib/store';
import type { Workspace } from '@/types';

// Minimal Workspace fixtures — only the fields the store reads (_id, isDefault).
const wsA = { _id: 'ws-a', name: 'Alpha' } as unknown as Workspace;
const wsB = { _id: 'ws-b', name: 'Beta' } as unknown as Workspace;

describe('useWorkspaceStore — delete only/last workspace', () => {
  beforeEach(() => {
    localStorage.clear();
    // Seed a single-workspace owner: one workspace, it is the current one.
    useWorkspaceStore.setState({
      workspaces: [wsA],
      currentWorkspace: wsA,
      currentWorkspaceId: 'ws-a',
      isHydrated: true,
    });
  });

  it('deleting the LAST workspace via clearWorkspace() empties the array and clears currentWorkspaceId', () => {
    // Precondition: a single-workspace owner with a live pointer.
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('ws-a');

    // The handler's empty-list branch.
    useWorkspaceStore.getState().clearWorkspace();

    const s = useWorkspaceStore.getState();
    expect(s.workspaces).toEqual([]);
    expect(s.currentWorkspaceId).toBeNull();
    expect(s.currentWorkspace).toBeNull();
  });

  it('deleting one of several keeps the store populated and selects the first remaining workspace', () => {
    // Two workspaces, delete ws-a, list returns [ws-b]: the handler calls
    // setWorkspaces(list) then setCurrentWorkspaceId(list[0]._id).
    useWorkspaceStore.setState({
      workspaces: [wsA, wsB],
      currentWorkspace: wsA,
      currentWorkspaceId: 'ws-a',
    });

    useWorkspaceStore.getState().setWorkspaces([wsB]);
    useWorkspaceStore.getState().setCurrentWorkspaceId('ws-b');

    const s = useWorkspaceStore.getState();
    expect(s.workspaces).toEqual([wsB]);
    expect(s.currentWorkspaceId).toBe('ws-b');
    expect(s.currentWorkspace).toEqual(wsB);
  });

  it('setWorkspaces([]) on its own also nulls the pointer (defence: array empties + current resets)', () => {
    // setWorkspaces is what the handler always calls with the refreshed list;
    // when that list is empty it must not leave a dangling current pointer.
    useWorkspaceStore.getState().setWorkspaces([]);

    const s = useWorkspaceStore.getState();
    expect(s.workspaces).toEqual([]);
    expect(s.currentWorkspaceId).toBeNull();
    expect(s.currentWorkspace).toBeNull();
  });
});
