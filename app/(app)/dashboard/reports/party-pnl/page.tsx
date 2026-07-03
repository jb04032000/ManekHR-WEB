'use client';
/**
 * Per-party P&L report - index landing.
 *
 * Route: /dashboard/reports/party-pnl
 *
 * The report is partyId-scoped (`./[partyId]`). This index acts as an
 * empty-state landing when a user navigates to the bare `/party-pnl` URL,
 * pointing them at the Finance → Parties picker where the "Open report →"
 * action lives on each party's IntelligencePanel.
 */

import Link from 'next/link';
import { Alert, Spin } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';

export default function PartyPnlIndexPage() {
  const t = useTranslations('party-intelligence.pnl');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const pnlAccess = useFeatureAccess('finance', 'party_intelligence_pnl');
  // RBAC gate (in addition to the subscription tier gate above) - both
  // must pass. Mirrors BE PartyPnlController @RequirePermissions(FINANCE, VIEW).
  const { can, loading: permsLoading } = useMyPermissions();

  if (!wsId) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="warning" title="Select a workspace to view this report." />
      </div>
    );
  }

  if (pnlAccess.isLoading || permsLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (!can('finance', 'view')) {
    return (
      <div style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('title')}</h1>
        <Alert
          type="error"
          showIcon
          title="You don't have permission to view this report."
          description="Contact your workspace owner to request access to Finance reports."
        />
      </div>
    );
  }

  if (pnlAccess.isLocked) {
    return (
      <div style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('title')}</h1>
        <Alert
          type="warning"
          showIcon
          title="Per-party P&L is not included in your current plan."
          description="Upgrade to access direct-margin P&L reports per party."
          action={<Link href="/upgrade">Upgrade →</Link>}
        />
      </div>
    );
  }

  return (
    <EmptyStateLayout
      icon={<TeamOutlined />}
      title={t('title')}
      description="Open Finance → Parties, pick a customer or vendor, then choose “Open report →” from its intelligence panel to view direct-margin P&L."
      actions={[
        {
          label: 'Go to Finance',
          href: '/dashboard/finance',
          type: 'primary',
        },
      ]}
    />
  );
}
