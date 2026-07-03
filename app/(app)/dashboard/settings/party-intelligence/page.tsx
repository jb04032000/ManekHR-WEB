'use client';
/**
 * Party Intelligence Settings page - D-09 RFM tuning, D-29 greetings,
 * D-32 upcoming preview, D-36 settings hub.
 *
 * Layout: 2-col grid on lg.
 *  - Left:  RfmTuningCard, GreetingsCard
 *  - Right: GstinCadenceCard, RerunRfmButton, UpcomingGreetingsTable
 *
 * RBAC: server endpoints are gated by `manage_party_intelligence`. Page
 * itself is auth-gated by middleware. Subscription gate: requires
 * `party_intelligence_rfm` (umbrella). Locked → upgrade banner instead of cards.
 */

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { Row, Col, Alert, Spin } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { partyIntelligenceSettingsApi } from '@/lib/api/modules/party-intelligence-settings.api';
import type { WorkspaceSettingsPartyIntelligence } from '@/types';
import RfmTuningCard from '@/components/settings/party-intelligence/RfmTuningCard';
import GreetingsCard from '@/components/settings/party-intelligence/GreetingsCard';
import GstinCadenceCard from '@/components/settings/party-intelligence/GstinCadenceCard';
import RerunRfmButton from '@/components/settings/party-intelligence/RerunRfmButton';
import UpcomingGreetingsTable from '@/components/settings/party-intelligence/UpcomingGreetingsTable';

export default function PartyIntelligenceSettingsPage() {
  const t = useTranslations('party-intelligence.settings');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const rfmAccess = useFeatureAccess('finance', 'party_intelligence_rfm');

  const [settings, setSettings] = useState<WorkspaceSettingsPartyIntelligence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId) return;
    startTransition(() => {
      setLoading(true);
    });
    partyIntelligenceSettingsApi
      .getSettings(wsId)
      .then((s) => setSettings(s))
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, [wsId]);

  if (!wsId) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="warning" title="Select a workspace to manage party intelligence settings." />
      </div>
    );
  }

  if (rfmAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (rfmAccess.isLocked) {
    return (
      <div style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('title')}</h1>
        <Alert
          type="warning"
          showIcon
          title="Party Intelligence is not included in your current plan."
          description="Upgrade to access RFM segmentation, GSTIN risk monitoring, P&L per party, and greetings dispatch."
          action={<Link href="/upgrade">Upgrade →</Link>}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280 }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            margin: 0,
            color: 'var(--cr-text)',
          }}
        >
          {t('title')}
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--cr-text-3)', fontSize: 13 }}>
          Tune RFM segmentation thresholds, manage greetings dispatch, and configure GSTIN poll
          cadence for this workspace.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <RfmTuningCard wsId={wsId} initial={settings?.rfmTuning} onSaved={setSettings} />
              <GreetingsCard wsId={wsId} initial={settings?.greetings} onSaved={setSettings} />
            </div>
          </Col>
          <Col xs={24} lg={12}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <GstinCadenceCard
                wsId={wsId}
                initial={settings?.gstinPollCadenceDays ?? 7}
                onSaved={setSettings}
              />
              <RerunRfmButton wsId={wsId} />
              <UpcomingGreetingsTable wsId={wsId} />
            </div>
          </Col>
        </Row>
      )}
    </div>
  );
}
