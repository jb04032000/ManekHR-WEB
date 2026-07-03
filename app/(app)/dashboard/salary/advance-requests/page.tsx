'use client';

// Owner/manager advance-request approval queue (dedicated route).
// What it does: lists pending worker advance requests; approve = approve + disburse +
// start the interest-free recovery plan; reject with an optional note.
// Links: AdvanceApprovalQueue (queue + approve modal + recovery configurator);
//   nav-permissions (/dashboard/salary/advance-requests -> salary edit:all);
//   backend approve/reject (@RequirePermissions(SALARY, EDIT, 'all')).
// Watch: workers reach their OWN requests via MySalary, never this route.

import { Empty, Skeleton } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { DsCard, DsPageHeader } from '@/components/ui';
import { AdvanceApprovalQueue } from '../components/salary/AdvanceApprovalQueue';

export default function AdvanceRequestsPage() {
  const t = useTranslations('advanceSalary');
  const { currentWorkspaceId } = useWorkspaceStore();
  const { loading, can, data } = useMyPermissions();

  if (loading || !data) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  // Defense-in-depth (ADR-001 Tier 2): in-page gate on top of the central
  // route guard, mirroring the BE approve/reject @RequirePermissions(SALARY,
  // EDIT, 'all'). Owners short-circuit inside `can`.
  const canApprove = data.isOwner || can('salary', 'edit', 'all');
  if (!canApprove) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <DsCard className="max-w-[480px] rounded-[24px]" styles={{ body: { padding: 32 } }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                <span className="block text-[15px] font-semibold text-heading">
                  <LockOutlined /> Access Denied
                </span>
                <span className="mt-1 block text-[13px] text-muted">
                  You do not have permission to review advance requests. Contact your workspace
                  owner.
                </span>
              </span>
            }
          />
        </DsCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DsPageHeader title={t('pageTitle')} sub={t('pageSubtitle')} />
      {currentWorkspaceId && <AdvanceApprovalQueue workspaceId={currentWorkspaceId} />}
    </div>
  );
}
