'use client';
/**
 * Party Detail Page - Phase 17 / D-36.
 *
 * Renders IntelligencePanel + tab strip (Overview | Timeline | Portal Access).
 *
 * Note on SSR: server actions `getPartyWithIntelligence` and
 * `getInitialTimeline` are exported from `lib/actions/parties.actions.ts` for
 * any future SSR shell that needs to hydrate a TanStack QueryClient. This
 * client page fetches via the API wrappers directly to keep parity with the
 * existing dashboard pages.
 */

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Alert, Tabs, Skeleton, Typography, Button, Space } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { Can } from '@/components/rbac/Can';
import IntelligencePanel from '@/components/parties/IntelligencePanel';
import TimelineTab from '@/components/parties/TimelineTab';
import { partyIntelligenceApi, partyPnlApi, partyTimelineApi } from '@/lib/api/modules/parties.api';
import http, { unwrap } from '@/lib/api/client';
import type { Party, PartyIntelligence, PartyPnlReport, PartyTimelineEvent } from '@/types';

const { Title } = Typography;

/**
 * RBAC gate (ADR-001 finance gap #5): the party detail page (PII + RFM /
 * P&L / GSTIN-risk intelligence) had no permission gate. Show a skeleton
 * while permissions resolve, then wrap the body in
 * `<Can module="finance" action="view">` - owners short-circuit, a member
 * without finance.view gets the Access-Denied surface.
 */
export default function PartyDetailPage() {
  const { loading: permissionsLoading } = useMyPermissions();

  if (permissionsLoading) {
    return <Skeleton active style={{ padding: 24 }} />;
  }

  return (
    <Can
      module="finance"
      action="view"
      fallback={
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
          <Alert
            type="error"
            showIcon
            title="Access Denied"
            description="You do not have permission to view party details. Contact your workspace owner to request access."
            style={{ maxWidth: 480 }}
          />
        </div>
      }
    >
      <PartyDetailBody />
    </Can>
  );
}

function PartyDetailBody() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const partyId = params?.id ?? '';
  const firmId = searchParams?.get('firm') ?? '';
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [party, setParty] = useState<Party | null>(null);
  const [intel, setIntel] = useState<PartyIntelligence | null>(null);
  const [pnl, setPnl] = useState<PartyPnlReport | null>(null);
  const [initialTimeline, setInitialTimeline] = useState<{
    items: PartyTimelineEvent[];
    nextCursor: string | null;
  }>({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHydrated || !wsId || !partyId || !firmId) return;
    startTransition(() => {
      setLoading(true);
    });
    Promise.all([
      http
        .get(`workspaces/${wsId}/finance/firms/${firmId}/parties/${partyId}`)
        .then(unwrap<Party>)
        .catch(() => null),
      partyIntelligenceApi.getIntelligence(wsId, partyId).catch(() => null),
      partyPnlApi.getPnl(wsId, partyId).catch(() => null),
      partyTimelineApi.listTimeline(wsId, partyId, { limit: 50 }).catch(() => ({
        items: [] as PartyTimelineEvent[],
        nextCursor: null,
      })),
    ])
      .then(([p, i, pl, tl]) => {
        setParty(p);
        setIntel(i);
        setPnl(pl);
        setInitialTimeline(tl);
      })
      .finally(() => setLoading(false));
  }, [isHydrated, wsId, partyId, firmId]);

  if (loading || !party) {
    return <Skeleton active style={{ padding: 24 }} />;
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={1} style={{ margin: 0, fontSize: 22 }}>
          {party.name}
        </Title>
        <Space>
          <Link
            href={`/dashboard/parties/${partyId}/portal-access?firm=${firmId}`}
            className="no-underline"
          >
            <Button icon={<LinkOutlined />}>Portal access</Button>
          </Link>
        </Space>
      </div>

      <IntelligencePanel
        wsId={wsId}
        partyId={partyId}
        party={party}
        initialIntelligence={intel}
        initialPnl={pnl}
      />

      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <div>
                <p>
                  <strong>Type:</strong> {party.partyType}
                </p>
                <p>
                  <strong>GSTIN:</strong> {party.gstin ?? '-'}
                </p>
                <p>
                  <strong>Phone:</strong> {party.phone ?? '-'}
                </p>
                <p>
                  <strong>Email:</strong> {party.email ?? '-'}
                </p>
                <p>
                  <strong>Address:</strong> {party.address ?? '-'}
                </p>
                <p>
                  <strong>Credit terms:</strong> {party.creditTermsDays} days
                </p>
              </div>
            ),
          },
          {
            key: 'timeline',
            label: 'Timeline',
            children: (
              <TimelineTab
                wsId={wsId}
                partyId={partyId}
                initialItems={initialTimeline.items}
                initialCursor={initialTimeline.nextCursor}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
