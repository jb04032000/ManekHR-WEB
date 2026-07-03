import { useMemo } from 'react';
import { useAuthStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';

/** Canonical module-action set probed by `useModuleActions`. */
const ALL_ACTIONS = [
  'view',
  'create',
  'add',
  'edit',
  'delete',
  'mark',
  'export',
  'add_payment',
  'remove',
] as const;

/**
 * Check if the current user has a specific permission.
 *
 * Delegates to the real RBAC source (`useMyPermissions().can`), which
 * short-circuits workspace owners to `true` and otherwise matches the
 * fetched `GET /workspaces/:wsId/me/permissions` snapshot. Platform
 * admins also short-circuit. While the permission snapshot is still
 * loading `can()` returns `false` (fail-closed).
 */
export function usePermission(module: string, action: string): boolean {
  const { user } = useAuthStore();
  const { can } = useMyPermissions();

  return useMemo(() => {
    if (!user) return false;
    // Platform admin has full access (not modelled by the workspace
    // permission snapshot, which only flags the workspace owner).
    if (user.isAdmin) return true;
    return can(module, action);
  }, [user, can, module, action]);
}

/**
 * Returns all actions the user has for a given module.
 */
export function useModuleActions(module: string): string[] {
  const { user } = useAuthStore();
  const { can } = useMyPermissions();

  return useMemo(() => {
    if (!user) return [];
    if (user.isAdmin) return [...ALL_ACTIONS];
    return ALL_ACTIONS.filter((action) => can(module, action));
  }, [user, can, module]);
}
