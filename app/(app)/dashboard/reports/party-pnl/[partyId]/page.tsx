'use client';
/**
 * Per-party P&L report page (Phase 17 / Plan 08 / FIN-16-04).
 *
 * Route: /dashboard/reports/party-pnl/[partyId]
 *
 * Subscription gate: `party_intelligence_pnl` sub-feature under FINANCE.
 * Auth gate: middleware (route is NOT in PUBLIC_PATHS).
 */

import { useEffect, useState, startTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Spin } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { partyIntelligenceApi } from '@/lib/api/modules/parties.api';
import PartyPnlReportView from '@/components/reports/PartyPnlReport';

export default function PartyPnlPage() {
  const t = useTranslations('party-intelligence.pnl');
  const params = useParams<{ partyId: string }>();
  const partyId = params?.partyId ?? '';
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const pnlAccess = useFeatureAccess('finance', 'party_intelligence_pnl');
  // RBAC gate (in addition to the subscription tier gate above) - both
  // must pass. Mirrors BE PartyPnlController @RequirePermissions(FINANCE, VIEW).
  const { can, loading: permsLoading } = useMyPermissions();

  // Best-effort party-name lookup via intelligence sub-doc - page works
  // without it; PartyPnlReportView falls back to report.partyName.
  const [partyName, setPartyName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!wsId || !partyId) return;
    // The intelligence endpoint returns the sub-doc only; party name is on
    // the Party document. Skip a second fetch - PartyPnlReport reads the
    // partyName off the report response itself.
    void partyIntelligenceApi.getIntelligence(wsId, partyId).catch(() => null);
    startTransition(() => {
      setPartyName(undefined);
    });
  }, [wsId, partyId]);

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

  return <PartyPnlReportView wsId={wsId} partyId={partyId} partyName={partyName} />;
}
