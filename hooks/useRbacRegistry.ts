'use client';

import { useEffect, useState } from 'react';
import type { PermissionModuleDef } from '@/types/rbac-registry';
import { rbacApi } from '@/lib/api/modules/rbac.api';

/**
 * Fetches and caches the RBAC permission registry for a workspace. The
 * registry is static (no mutations between deploys), so a single fetch-on-
 * mount with no stale-invalidation is sufficient.
 *
 * Returns an empty array until the first successful response so that
 * consumers can pass it directly to `<PermissionGrid>` without a loading guard
 * (the grid will simply render no registry-driven sections).
 */
export function useRbacRegistry(wsId: string | null | undefined): PermissionModuleDef[] {
  const [registry, setRegistry] = useState<PermissionModuleDef[]>([]);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    rbacApi
      .getRegistry(wsId)
      .then((res) => {
        if (!cancelled) setRegistry(res.registry);
      })
      .catch(() => {
        if (cancelled) return;
        // Registry is decorative for override display; failing silently means
        // the matrix falls back to all-legacy rows - functionally safe.
      });
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  return registry;
}
