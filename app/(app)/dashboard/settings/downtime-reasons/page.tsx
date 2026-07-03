'use client';

/**
 * /dashboard/settings/downtime-reasons - owner-only catalogue editor route
 * (Plan 22-11 / D-02 / D-14 / MACH-P2-02a).
 *
 * Gating layers (defence-in-depth):
 *   1. Sub-feature `machines.machines_downtime` must not be locked
 *      (subscription gate via useFeatureAccess).
 *   2. Permission `machines.downtime.reasons.manage` must hold for the
 *      current user (RBAC via useMyPermissions; owners short-circuit).
 *      Backend re-checks via @RequirePermissions.
 *
 * Both checks happen client-side here for navigation UX. Backend remains
 * the source of truth (Plan 22-02).
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import DowntimeReasonsSettings from '@/components/machines/DowntimeReasonsSettings';

export default function DowntimeReasonsSettingsPage() {
  const router = useRouter();
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const access = useFeatureAccess('machines', 'machines_downtime');
  const { can, loading: permsLoading } = useMyPermissions();
  const canManage = can('machines', 'machines.downtime.reasons.manage');

  const enabled = !access.isLoading && !access.isLocked;

  useEffect(() => {
    if (access.isLoading || permsLoading) return;
    if (!enabled) {
      router.replace('/dashboard');
      return;
    }
    if (!canManage) {
      router.replace('/dashboard');
    }
  }, [access.isLoading, permsLoading, enabled, canManage, router]);

  if (!wsId || access.isLoading || permsLoading) return null;
  if (!enabled || !canManage) return null;

  return <DowntimeReasonsSettings wsId={wsId} />;
}
