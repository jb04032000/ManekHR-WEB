'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Space, Typography } from 'antd';
import { AlertOutlined } from '@ant-design/icons';
import { getLowWaterAlerts } from '@/lib/actions/finance-cash-registers.actions';
import type { CashRegisterExtended } from '@/types';
import { ReplenishPettyCashModal } from './ReplenishPettyCashModal';

const { Text } = Typography;

interface LowWaterAlertBannerProps {
  wsId: string;
  firmId: string;
}

export function LowWaterAlertBanner({ wsId, firmId }: LowWaterAlertBannerProps) {
  const [alerts, setAlerts] = useState<CashRegisterExtended[]>([]);
  const [replenishTarget, setReplenishTarget] = useState<CashRegisterExtended | null>(null);

  useEffect(() => {
    if (!wsId || !firmId) return;
    getLowWaterAlerts(wsId, firmId)
      .then((res) => setAlerts(res ?? []))
      .catch(() => setAlerts([]));
  }, [wsId, firmId]);

  if (alerts.length === 0) return null;

  const formatRs = (rupees: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(rupees);

  return (
    <>
      <Alert
        type="warning"
        icon={<AlertOutlined />}
        style={{ marginBottom: 16 }}
        message={
          <span>
            <Text strong>Low Cash Alert</Text> - {alerts.length} register
            {alerts.length > 1 ? 's' : ''} below threshold
          </span>
        }
        description={
          <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
            {alerts.map((r) => (
              <Space key={r._id}>
                <Text>
                  <Text strong>{r.name}</Text>: {formatRs(r.currentBalance)} (threshold:{' '}
                  {formatRs((r.lowWaterThresholdPaise ?? 0) / 100)})
                </Text>
                <Button size="small" type="link" onClick={() => setReplenishTarget(r)}>
                  Replenish
                </Button>
              </Space>
            ))}
          </Space>
        }
        showIcon
      />
      {replenishTarget && (
        <ReplenishPettyCashModal
          wsId={wsId}
          firmId={firmId}
          register={replenishTarget}
          open
          onClose={() => setReplenishTarget(null)}
          onSuccess={() => {
            setReplenishTarget(null);
            // Refresh alerts
            getLowWaterAlerts(wsId, firmId)
              .then(setAlerts)
              .catch(() => {});
          }}
        />
      )}
    </>
  );
}
