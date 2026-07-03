'use client';

import { Select, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { formatCurrencyFull } from '@/lib/utils';
import type { BonusRun, BonusSummaryMemberRow, TeamMember } from '@/types';

const CURRENT_YEAR = dayjs().year();
const FY_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const y = CURRENT_YEAR - i;
  return { value: y, label: `FY ${y}-${String(y + 1).slice(2)}` };
});

const RUN_TYPE_COLOR: Record<string, string> = {
  statutory: 'blue',
  discretionary: 'purple',
};

interface Props {
  loading: boolean;
  summaryRows: BonusSummaryMemberRow[];
  summaryStatutory: number;
  summaryDiscretionary: number;
  summaryTotal: number;
  runs: BonusRun[];
  memberMap: Map<string, TeamMember>;
  fy: number;
  onFyChange: (fy: number) => void;
}

export function BonusSummaryTab({
  loading,
  summaryRows,
  summaryStatutory,
  summaryDiscretionary,
  summaryTotal,
  runs,
  memberMap,
  fy,
  onFyChange,
}: Props) {
  const t = useTranslations('salary.bonus');

  const summaryColumns: ColumnsType<BonusSummaryMemberRow> = [
    {
      title: t('colEmployee'),
      key: 'employee',
      render: (_: unknown, row: BonusSummaryMemberRow) => {
        const member = memberMap.get(row.teamMemberId);
        return (
          <p className="m-0 text-[14px] font-medium text-heading">
            {member?.name ?? row.teamMemberId}
          </p>
        );
      },
    },
    {
      title: (
        <span className="flex items-center gap-1">
          {t('colStatutory')}
          <Tooltip title={t('statutoryColTooltip')}>
            <InfoCircleOutlined className="text-[11px] text-subtle" />
          </Tooltip>
        </span>
      ),
      dataIndex: 'statutory',
      key: 'statutory',
      align: 'right',
      render: (v: number) => <span className="tabular-nums">{formatCurrencyFull(v)}</span>,
    },
    {
      title: (
        <span className="flex items-center gap-1">
          {t('colDiscretionary')}
          <Tooltip title={t('discretionaryColTooltip')}>
            <InfoCircleOutlined className="text-[11px] text-subtle" />
          </Tooltip>
        </span>
      ),
      dataIndex: 'discretionary',
      key: 'discretionary',
      align: 'right',
      render: (v: number) => <span className="tabular-nums">{formatCurrencyFull(v)}</span>,
    },
    {
      title: t('colTotal'),
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      render: (v: number) => (
        <span className="font-semibold text-heading tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
  ];

  const runColumns: ColumnsType<BonusRun> = [
    {
      title: t('colRunDate'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY, HH:mm') : '-'),
    },
    {
      title: t('colRunType'),
      dataIndex: 'bonusType',
      key: 'bonusType',
      render: (t2: string, row: BonusRun) => (
        <div className="flex flex-col gap-0.5">
          <Tag color={RUN_TYPE_COLOR[t2] ?? 'default'} className="w-fit">
            {t2 === 'statutory' ? t('runTypeStatutory') : t('runTypeDiscretionary')}
          </Tag>
          {row.subType && <span className="text-[11px] text-subtle">{row.subType}</span>}
        </div>
      ),
    },
    {
      title: t('colRunFy'),
      dataIndex: 'financialYear',
      key: 'financialYear',
      render: (y: number) => `FY ${y}-${String(y + 1).slice(2)}`,
    },
    {
      title: t('colRunMembers'),
      dataIndex: 'totalDisbursedMembers',
      key: 'totalDisbursedMembers',
      align: 'center',
    },
    {
      title: t('colRunAmount'),
      dataIndex: 'totalDisbursedAmount',
      key: 'totalDisbursedAmount',
      align: 'right',
      render: (v: number) => (
        <span className="font-semibold tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('colRunStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={s === 'completed' ? 'success' : 'processing'}>
          {s === 'completed' ? t('runStatusCompleted') : t('runStatusPending')}
        </Tag>
      ),
    },
  ];

  return (
    <div className="py-4">
      {/* FY picker */}
      <div className="mb-5 flex items-center gap-3">
        <span className="text-[14px] font-medium">{t('fieldFy')}</span>
        <Select
          value={fy}
          onChange={(v: number) => onFyChange(v)}
          options={FY_OPTIONS}
          style={{ width: 150 }}
        />
      </div>

      {/* Workspace totals bar */}
      <div
        className="mb-5 flex flex-wrap gap-4 rounded-xl border p-4"
        style={{ borderColor: 'var(--cr-border)', background: 'var(--cr-surface)' }}
      >
        <div>
          <p className="m-0 text-[12px] text-subtle">{t('summaryStatutory')}</p>
          <p className="m-0 text-[15px] font-semibold">{formatCurrencyFull(summaryStatutory)}</p>
        </div>
        <div>
          <p className="m-0 text-[12px] text-subtle">{t('summaryDiscretionary')}</p>
          <p className="m-0 text-[15px] font-semibold">
            {formatCurrencyFull(summaryDiscretionary)}
          </p>
        </div>
        <div>
          <p className="m-0 text-[12px] text-subtle">{t('summaryTotal')}</p>
          <p className="m-0 text-[16px] font-bold text-heading">
            {formatCurrencyFull(summaryTotal)}
          </p>
        </div>
      </div>

      {/* Per-member summary */}
      <h3 className="mb-3 text-[14px] font-semibold text-heading">{t('perMemberTitle')}</h3>
      <Table<BonusSummaryMemberRow>
        rowKey="teamMemberId"
        size="middle"
        loading={loading}
        columns={summaryColumns}
        dataSource={summaryRows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: t('emptySummary') }}
        scroll={{ x: 'max-content' }}
        className="mb-8"
      />

      {/* Run history */}
      <h3 className="mb-3 text-[14px] font-semibold text-heading">{t('runHistoryTitle')}</h3>
      <Table<BonusRun>
        rowKey="_id"
        size="middle"
        loading={loading}
        columns={runColumns}
        dataSource={runs}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: t('emptyRuns') }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
