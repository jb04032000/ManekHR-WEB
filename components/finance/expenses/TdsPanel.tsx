'use client';

import { Collapse, Descriptions, Typography, Switch, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { ExpenseVoucherTdsApplied } from '@/types';

const { Text } = Typography;

interface TdsPanelProps {
  tdsApplied?: ExpenseVoucherTdsApplied;
  taxableValuePaise: number;
  allowOverride?: boolean;
  onOverrideChange?: (enabled: boolean) => void;
}

function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format((paise ?? 0) / 100);
}

const SECTION_LABELS: Record<string, string> = {
  sec_194c: '194C - Contractor',
  sec_194h: '194H - Commission/Brokerage',
  sec_194j: '194J - Professional Fee',
  sec_194m: '194M - Payment by Individual/HUF',
};

export function TdsPanel({
  tdsApplied,
  taxableValuePaise,
  allowOverride = false,
  onOverrideChange,
}: TdsPanelProps) {
  if (!tdsApplied) return null;

  const items = [
    {
      key: 'tds',
      label: (
        <span>
          TDS Preview{' '}
          <Tooltip title="TDS is computed by the server based on the party's TDS configuration. Override requires FINANCE:manage role.">
            <InfoCircleOutlined style={{ color: 'var(--cr-text-3)' }} />
          </Tooltip>
        </span>
      ),
      children: (
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="Section">
            {SECTION_LABELS[tdsApplied.section] ?? tdsApplied.section}
          </Descriptions.Item>
          <Descriptions.Item label="Rate">
            <Text>{tdsApplied.rate}%</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Applicable Amount">
            {formatPaise(tdsApplied.basePaise ?? taxableValuePaise)}
          </Descriptions.Item>
          <Descriptions.Item label="TDS Amount">
            <Text strong style={{ color: 'var(--cr-danger-700)' }}>
              {formatPaise(tdsApplied.tdsPaise)}
            </Text>
          </Descriptions.Item>
          {allowOverride && (
            <Descriptions.Item label="Override TDS" span={2}>
              <Switch size="small" onChange={onOverrideChange} />
              <Text type="warning" style={{ marginLeft: 8, fontSize: 12 }}>
                Requires FINANCE:manage permission
              </Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      ),
    },
  ];

  return <Collapse size="small" style={{ marginBottom: 16 }} items={items} />;
}
