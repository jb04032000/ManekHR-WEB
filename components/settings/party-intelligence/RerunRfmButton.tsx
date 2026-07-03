'use client';
/**
 * RerunRfmButton - manual RFM re-segmentation trigger.
 *
 * Calls partyIntelligenceApi.triggerRerunRfm. Backend rate-limits 1/10min/ws
 * (Plan 17-04). On 429 / status='rate_limited', shows retry-after toast.
 *
 * RBAC: requires `manage_party_intelligence`. Server-side @RequirePermissions
 * enforces independently.
 */

import { useState } from 'react';
import { Card, Button, Space, message, Tooltip, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { partyIntelligenceApi } from '@/lib/api/modules/parties.api';

const { Text } = Typography;

interface Props {
  wsId: string;
  permissions?: Set<string>;
}

export default function RerunRfmButton({ wsId, permissions }: Props) {
  const t = useTranslations('party-intelligence.settings');
  const [running, setRunning] = useState(false);

  const canRun = !permissions || permissions.has('manage_party_intelligence');

  const handleClick = async () => {
    if (!canRun) {
      message.warning('Permission required');
      return;
    }
    setRunning(true);
    try {
      const res = await partyIntelligenceApi.triggerRerunRfm(wsId);
      if (res.status === 'rate_limited') {
        message.warning(`Try again in ${res.retryAfterSeconds ?? 60}s`);
      } else {
        const updated = (res as { updated?: number }).updated ?? 0;
        const segChanges = (res as { segmentChanges?: number }).segmentChanges ?? 0;
        message.success(`Re-segmented ${updated} parties. ${segChanges} segment changes.`);
      }
    } catch (e: unknown) {
      const err = e as {
        message?: string;
        response?: { status?: number; data?: { retryAfterSeconds?: number } };
      };
      if (err?.response?.status === 429) {
        const sec = err.response.data?.retryAfterSeconds ?? 60;
        message.warning(`Try again in ${sec}s`);
      } else {
        message.error(err?.message ?? 'Re-run failed');
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card title={t('rerunNow')} size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Re-segment all active parties immediately. Rate-limited to once every 10 minutes per
          workspace.
        </Text>
        <Tooltip title={canRun ? '' : 'Permission required'}>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={running}
            disabled={!canRun}
            onClick={handleClick}
          >
            {t('rerunNow')}
          </Button>
        </Tooltip>
      </Space>
    </Card>
  );
}
