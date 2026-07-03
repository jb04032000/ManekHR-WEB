'use client';

import { Alert } from 'antd';
import { TeamOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { ErpDeletionImpact } from '@/lib/actions/account-deletion.actions';

/**
 * Renders the Delete-ERP impact the backend returns from GET .../erp/preview
 * (ACCOUNT-DELETION-AND-DPDP-PLAN.md §3B/§7): owned workspaces + "team loses
 * access" + sole-owner note, member workspaces + "not auto-rejoinable", and the
 * open-loan / unpaid-advance warning. Passed to DangerDeleteModal as `consequences`.
 */
export function ErpDeletionImpactSummary({
  impact,
  loading,
}: {
  impact: ErpDeletionImpact | null;
  loading?: boolean;
}) {
  const t = useTranslations('accountDeletion.erpImpact');

  if (loading) {
    return (
      <p className="m-0 flex items-center gap-2 text-[13px] text-muted">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
        {t('loading')}
      </p>
    );
  }

  if (!impact) return null;

  const hasOwned = impact.ownedWorkspaces.length > 0;
  const hasMember = impact.memberWorkspaces.length > 0;

  if (!hasOwned && !hasMember) {
    return <p className="m-0 text-[13px] text-muted">{t('empty')}</p>;
  }

  return (
    <div className="space-y-3 text-[13px]">
      <p className="m-0 font-semibold text-heading">{t('heading')}</p>

      {hasOwned && (
        <div>
          <p className="mb-1 font-label text-[11px] font-bold tracking-wide text-subtle uppercase">
            {t('ownedTitle')}
          </p>
          <ul className="m-0 list-none space-y-1 p-0">
            {impact.ownedWorkspaces.map((ws) => (
              <li key={ws.workspaceId} className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-heading">{ws.name}</span>
                <span className="flex items-center gap-1 text-[12px] text-muted">
                  <TeamOutlined /> {t('members', { count: ws.memberCount })}
                </span>
              </li>
            ))}
          </ul>
          {impact.teamLosesAccess && (
            <p className="mt-1.5 mb-0 text-amber-700">{t('teamLosesAccess')}</p>
          )}
          {impact.teamLosesAccess && <p className="mt-0.5 mb-0 text-muted">{t('soleOwnerNote')}</p>}
        </div>
      )}

      {hasMember && (
        <div>
          <p className="mb-1 font-label text-[11px] font-bold tracking-wide text-subtle uppercase">
            {t('memberTitle')}
          </p>
          <ul className="m-0 list-none space-y-1 p-0">
            {impact.memberWorkspaces.map((ws) => (
              <li key={ws.workspaceId} className="truncate font-medium text-heading">
                {ws.name}
              </li>
            ))}
          </ul>
          {impact.memberWorkspacesNeedReinvite && (
            <p className="mt-1.5 mb-0 text-muted">{t('memberNotRejoinable')}</p>
          )}
        </div>
      )}

      {(impact.openEmployerLoans > 0 || impact.unpaidAdvances > 0) && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          className="rounded-[10px]"
          description={
            <div className="text-[12.5px]">
              {impact.openEmployerLoans > 0 && (
                <p className="m-0">{t('openLoans', { count: impact.openEmployerLoans })}</p>
              )}
              {impact.unpaidAdvances > 0 && (
                <p className="mt-0.5 mb-0">
                  {t('unpaidAdvances', { count: impact.unpaidAdvances })}
                </p>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
