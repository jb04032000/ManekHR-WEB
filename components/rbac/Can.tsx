'use client';
import type { ReactNode } from 'react';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { PermissionScope } from '@/types/rbac-registry';

/**
 * Module+action variant - legacy Wave 1+2 flat permission gate.
 * `<Can module="team" action="view" scope="all">`.
 */
type CanModuleProps = {
  /** Backend `AppModule` enum value, e.g. `'team'`, `'attendance'`, `'finance'`. */
  module: string;
  /** Backend `ModuleAction` value, e.g. `'view'`, `'edit'`, `'mark'`. */
  action: string;
  /**
   * Optional scope requirement. Until per-module endpoint enforcement ships
   * (per-module sweep), pass undefined for legacy gates. When set, requires
   * the actor's role to grant the action with at least the requested scope
   * (`'all'` always satisfies `'self'`).
   */
  scope?: PermissionScope;
  path?: never;
  /** Rendered when permission is granted. */
  children: ReactNode;
  /** Optional fallback rendered when denied. Defaults to null. */
  fallback?: ReactNode;
  /**
   * Render fallback while permissions are still loading. Default: false
   * (renders nothing during the initial fetch - avoids flash-of-content).
   */
  showFallbackOnLoading?: boolean;
};

/**
 * Path variant - Phase 1c registry-path gate.
 * `<Can path="team.profile.bank.edit" scope="all">`.
 */
type CanPathProps = {
  /**
   * Registry permission path, e.g. `'team.profile.bank.edit'`. Checked
   * against the `paths` array returned by `GET /me/permissions` (Phase 1c).
   */
  path: string;
  scope?: PermissionScope;
  module?: never;
  action?: never;
  /** Rendered when permission is granted. */
  children: ReactNode;
  /** Optional fallback rendered when denied. Defaults to null. */
  fallback?: ReactNode;
  /**
   * Render fallback while permissions are still loading. Default: false
   * (renders nothing during the initial fetch - avoids flash-of-content).
   */
  showFallbackOnLoading?: boolean;
};

export type CanProps = CanModuleProps | CanPathProps;

/**
 * Wave 1+2+1c RBAC - declarative permission gate.
 *
 * Two modes:
 *  - `<Can module="…" action="…" scope?="…">` - flat module/action gate
 *    (legacy Wave 1+2, backward-compatible).
 *  - `<Can path="…" scope?="…">` - registry path gate (Phase 1c, checks
 *    `paths` tuples from the BE `/me/permissions` response).
 *
 * Reads the calling user's permissions for the current workspace via
 * `useMyPermissions`. Owners short-circuit to allow every `<Can>`.
 * Mirrors the BE `RolesGuard` / `pathGrantSatisfies` match logic.
 */
function isPathVariant(props: CanProps): props is CanPathProps {
  return 'path' in props;
}

export function Can(props: CanProps) {
  const { loading, can, canPath } = useMyPermissions();

  const { children, fallback = null, showFallbackOnLoading = false } = props;

  if (loading) {
    return showFallbackOnLoading ? <>{fallback}</> : null;
  }

  const granted = isPathVariant(props)
    ? canPath(props.path, props.scope)
    : can(props.module, props.action, props.scope);

  return granted ? <>{children}</> : <>{fallback}</>;
}
