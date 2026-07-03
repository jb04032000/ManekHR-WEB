'use client';

import { useEffect, useState } from 'react';
import { rbacApi } from '@/lib/api/modules/rbac.api';
import { useWorkspaceStore } from '@/lib/store';
import type { RolePresetResponse } from '@/lib/api/modules/rbac.api';

type Preset = RolePresetResponse['team'][number];

/**
 * Fetches and caches the RBAC Team-module role presets for the current
 * workspace. Presets are static server data (never mutated between deploys),
 * so a single fetch-on-mount with no stale-invalidation is sufficient -
 * mirrors the `useRbacRegistry` fetch pattern.
 *
 * Returns an empty array until the first successful response so that consumers
 * can safely pass it to `<RolePresetSelector>` without a loading guard.
 */
export function useRolePresets(): {
  presets: Preset[];
  loading: boolean;
  error: string | null;
} {
  const { currentWorkspaceId } = useWorkspaceStore();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(!!currentWorkspaceId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    rbacApi
      .getRolePresets(currentWorkspaceId)
      .then((res) => {
        if (!cancelled) {
          setPresets(res.team ?? []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load presets');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId]);

  return { presets, loading, error };
}
