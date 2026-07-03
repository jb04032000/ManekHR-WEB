'use client';

import { Card, Typography, Tag, Divider } from 'antd';
import { useSubscriptionStore } from '@/lib/store';

const { Title, Text, Paragraph } = Typography;

export default function FinanceSettingsPage() {
  const { entitlements } = useSubscriptionStore();

  const financeModule = entitlements?.moduleAccess?.find(
    (m: { module: string }) => m.module === 'finance',
  );
  const hasFinance = (financeModule as { enabled?: boolean } | undefined)?.enabled ?? false;
  const hasByok = (
    financeModule as { subFeatures?: { key: string; enabled?: boolean }[] } | undefined
  )?.subFeatures?.some((s) => s.key === 'finance_gstin_byok' && s.enabled);

  return (
    <div style={{ maxWidth: 720, padding: 24 }}>
      <Title level={1} style={{ fontSize: 22, margin: 0 }}>
        Finance Settings
      </Title>
      <Paragraph type="secondary">Workspace-level configuration for the Finance module.</Paragraph>

      <Card style={{ marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 8, fontSize: 16 }}>
          Module Status
        </Title>
        <Text>Finance module: </Text>
        {hasFinance ? (
          <Tag color="green">Enabled</Tag>
        ) : (
          <Tag color="default">Disabled - upgrade your plan to access Finance</Tag>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 8, fontSize: 16 }}>
          GSTIN Auto-Fetch
        </Title>
        <Text>Provider: </Text>
        <Tag>Platform (Surepass) - shared key</Tag>
        <Divider />
        {hasByok ? (
          <Paragraph>
            Your plan supports BYOK (Bring Your Own Key). Configure per-firm GSTIN provider in the
            firm settings page.
          </Paragraph>
        ) : (
          <Paragraph type="secondary">
            BYOK GSTIN provider is available on Enterprise plan.
          </Paragraph>
        )}
      </Card>
    </div>
  );
}
