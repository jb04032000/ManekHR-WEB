import type { GrantedPath, PermissionScope } from '@/types/rbac-registry';

/**
 * Web twin of the backend `pathGrantSatisfies`
 * (`crewroster-backend/src/modules/rbac/permission-matcher.ts`). Fail-closed:
 * a missing grant returns false.
 *
 *  - `required.scope` omitted → any granted scope satisfies.
 *  - `required.scope === 'self'` → granted `'self'` OR `'all'` satisfies.
 *  - `required.scope === 'all'`  → granted scope must be `'all'`.
 */
export function pathGrantSatisfies(
  grants: GrantedPath[],
  required: { path: string; scope?: PermissionScope },
): boolean {
  const grant = grants.find((g) => g.path === required.path);
  if (!grant) return false;
  if (!required.scope) return true;
  const granted = grant.scope ?? 'self';
  if (required.scope === 'self') return granted === 'self' || granted === 'all';
  return granted === 'all';
}
