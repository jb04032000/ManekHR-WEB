'use client';
import React from 'react';
import { useTranslations } from 'next-intl';
import { Tag, Typography } from 'antd';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import type { DepreciationPreviewLine } from '@/types';
import { formatCurrencyFull } from '@/lib/utils';

interface DepreciationPreviewTableProps {
  lines: DepreciationPreviewLine[];
  onConfirmRun: () => void;
  confirmLoading?: boolean;
}

const formatPaise = (v: number) => formatCurrencyFull(v / 100);

export default function DepreciationPreviewTable({
  lines,
  onConfirmRun,
  confirmLoading,
}: DepreciationPreviewTableProps) {
  const t = useTranslations('finance.fixedAssets.depreciation.preview');
  const totalDepreciation = lines.reduce((s, l) => s + l.amountPaise, 0);

  const columns = [
    {
      title: t('columns.assetCode'),
      dataIndex: 'assetCode',
      key: 'assetCode',
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: t('columns.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('columns.category'),
      dataIndex: 'categoryName',
      key: 'categoryName',
    },
    {
      title: t('columns.method'),
      dataIndex: 'method',
      key: 'method',
      render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
    },
    {
      title: t('columns.period'),
      key: 'period',
      render: (_: unknown, r: DepreciationPreviewLine) => `${r.periodStart} → ${r.periodEnd}`,
    },
    {
      title: t('columns.depreciation'),
      dataIndex: 'amountPaise',
      key: 'amountPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('columns.capped'),
      dataIndex: 'capped',
      key: 'capped',
      render: (v: boolean) =>
        v ? <Tag color="gold">{t('cappedTag')}</Tag> : <span style={{ color: '#ccc' }}>-</span>,
    },
    {
      title: t('columns.newNbv'),
      dataIndex: 'newNbvPaise',
      key: 'newNbvPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <DsTable
        dataSource={lines}
        columns={columns}
        rowKey="assetId"
        size="small"
        pagination={false}
        scrollX={900}
        summary={() => (
          <tr>
            <td colSpan={5} style={{ paddingLeft: 8, fontWeight: 600 }}>
              {t('total', { count: lines.length })}
            </td>
            <td style={{ textAlign: 'right', fontWeight: 600, paddingRight: 8 }}>
              {formatPaise(totalDepreciation)}
            </td>
            <td colSpan={2} />
          </tr>
        )}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <DsButton
          dsVariant="primary"
          onClick={onConfirmRun}
          loading={confirmLoading}
          disabled={lines.length === 0}
        >
          {t('confirmRun', { count: lines.length })}
        </DsButton>
      </div>
    </div>
  );
}
