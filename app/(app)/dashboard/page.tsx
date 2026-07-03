'use client';
/**
 * ManekHR dashboard ROOT (post-login landing router).
 *
 * Routes the right home per caller:
 *   - no workspace selected      -> "select a workspace" prompt
 *   - no active plan             -> <NoPlanActivation />
 *   - restricted (self-scope)    -> <MySelfDashboard />  (own attendance/salary)
 *   - Owner / HR (directory@all) -> <HrOverview />       (admin people metrics)
 *
 * The legacy manufacturing / org-aggregate dashboard now lives dormant in
 * `components/dashboard/ManufacturingDashboard.tsx` and is NO LONGER the
 * default landing — its framing belongs to the excluded manufacturing surface.
 * HR Overview is the ManekHR admin home. Restricted-member gating mirrors
 * nav-permissions: the PATH grant `team.directory.view@all` is the
 * admin-vs-worker signal (Phase 1d path-migrated; flat `team.view` is never
 * written by the override matrix and stays `self`).
 */
import { Skeleton } from 'antd';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useTranslations } from 'next-intl';
import MySelfDashboard from '@/components/dashboard/MySelfDashboard';
import HrOverview from '@/components/dashboard/HrOverview';
import NoPlanActivation from '@/components/dashboard/NoPlanActivation';

export default function DashboardPage() {
  const t = useTranslations();
  const { currentWorkspaceId } = useWorkspaceStore();
  const { entitlements, isHydrated: subHydrated } = useSubscriptionStore();
  const hasNoPlan = subHydrated && !entitlements;

  const { canPath: canPathPermission, data: permissionsData, loading: permissionsLoading } =
    useMyPermissions();

  if (!currentWorkspaceId) {
    return (
      <div
        className="flex min-h-[400px] flex-col items-center justify-center gap-4"
        style={{ background: 'var(--cr-bg)', padding: 24, margin: -24, minHeight: '100%' }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-blue-50 text-[28px]">
          🏢
        </div>
        <h2 className="m-0 font-display text-xl font-bold text-gray-900">
          {t('dashboard.noWorkspace')}
        </h2>
        <p className="m-0 text-sm text-gray-700">{t('dashboard.selectWorkspaceToContinue')}</p>
      </div>
    );
  }

  // While permissions resolve, hold a skeleton (the co-located loading.tsx covers
  // the initial route transition; this guards the in-component resolve window so
  // a restricted worker never flashes the admin overview).
  if (permissionsLoading || permissionsData == null) {
    return (
      <div
        className="flex flex-col gap-5"
        style={{ background: 'var(--cr-bg)', padding: 24, margin: -24, minHeight: '100%' }}
      >
        <Skeleton active paragraph={{ rows: 2 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  // Restricted (self-scope) members land on their personal dashboard.
  const isRestrictedMember =
    !permissionsData.isOwner && !canPathPermission('team.directory.view', 'all');
  if (isRestrictedMember) {
    return <MySelfDashboard />;
  }

  if (hasNoPlan) {
    return <NoPlanActivation />;
  }

  // Owner / HR / admin -> ManekHR HR overview (the new landing).
  return <HrOverview />;
}
