'use client';

import { Select, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { InfoCircleOutlined } from '@ant-design/icons';
import { formatCurrencyFull } from '@/lib/utils';
import type { CommissionEntry, CommissionCategory, TeamMember } from '@/types';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: dayjs().month(i).format('MMMM'),
}));

const CURRENT_YEAR = dayjs().year();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  value: CURRENT_YEAR - i,
  label: String(CURRENT_YEAR - i),
}));

const CATEGORY_COLOR: Record<CommissionCategory, string> = {
  commission: 'blue',
  incentive: 'purple',
};

const SOURCE_COLOR: Record<string, string> = {
  manual: 'default',
  payment_recording: 'gold',
  system: 'cyan',
};

interface Props {
  entries: CommissionEntry[];
  loading: boolean;
  memberMap: Map<string, TeamMember>;
  filterMonth: number | undefined;
  filterYear: number | undefined;
  filterCategory: CommissionCategory | undefined;
  onFilterMonth: (v: number | undefined) => void;
  onFilterYear: (v: number | undefined) => void;
  onFilterCategory: (v: CommissionCategory | undefined) => void;
  onRefresh: () => void;
}

export function CommissionEntriesTab({
  entries,
  loading,
  memberMap,
  filterMonth,
  filterYear,
  filterCategory,
  onFilterMonth,
  onFilterYear,
  onFilterCategory,
}: Props) {
  const t = useTranslations('salary.commission');

  const columns: ColumnsType<CommissionEntry> = [
    {
      title: t('colEmployee'),
      key: 'employee',
      render: (_: unknown, row: CommissionEntry) => {
        const member = memberMap.get(row.teamMemberId);
        return (
          <div>
            <p className="m-0 text-[14px] font-medium text-heading">
              {row.teamMemberName ?? member?.name ?? row.teamMemberId}
            </p>
            {member?.designation && (
              <p className="m-0 text-[12px] text-subtle">{member.designation}</p>
            )}
          </div>
        );
      },
    },
    {
      title: t('colCategory'),
      dataIndex: 'category',
      key: 'category',
      render: (cat: CommissionCategory) => (
        <Tag color={CATEGORY_COLOR[cat] ?? 'default'}>{t(`category.${cat}`)}</Tag>
      ),
    },
    {
      title: t('colType'),
      dataIndex: 'commissionType',
      key: 'commissionType',
      render: (ct?: string) => (ct ? t(`commissionType.${ct}`) : '-'),
    },
    {
      title: t('colPeriod'),
      key: 'period',
      render: (_: unknown, row: CommissionEntry) =>
        `${dayjs()
          .month(row.month - 1)
          .format('MMM')} ${row.year}`,
    },
    {
      title: t('colAmount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => (
        <span className="font-medium tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('colReason'),
      dataIndex: 'reasonTitle',
      key: 'reasonTitle',
      render: (v: string, row: CommissionEntry) => (
        <div>
          <span className="text-[13px]">{v}</span>
          {row.note && <p className="m-0 text-[12px] text-subtle">{row.note}</p>}
        </div>
      ),
    },
    {
      title: t('colSource'),
      dataIndex: 'source',
      key: 'source',
      render: (s: string) => <Tag color={SOURCE_COLOR[s] ?? 'default'}>{t(`source.${s}`)}</Tag>,
    },
    {
      title: (
        <span className="flex items-center gap-1">
          {t('colPfEsi')}
          <Tooltip title={t('pfEsiTooltip')}>
            <InfoCircleOutlined className="text-[11px] text-subtle" />
          </Tooltip>
        </span>
      ),
      key: 'pfEsi',
      render: (_: unknown, row: CommissionEntry) => (
        <div className="flex flex-col gap-0.5">
          {row.pfExcluded && <span className="text-[11px] text-green-600">PF excluded</span>}
          {row.esiExcluded && <span className="text-[11px] text-green-600">ESI excluded</span>}
        </div>
      ),
    },
    {
      title: t('colDate'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '-'),
    },
  ];

  return (
    <div className="py-4">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          allowClear
          placeholder={t('filterByMonth')}
          style={{ width: 140 }}
          value={filterMonth}
          onChange={(v: number | undefined) => onFilterMonth(v)}
          options={MONTH_OPTIONS}
        />
        <Select
          allowClear
          placeholder={t('filterByYear')}
          style={{ width: 110 }}
          value={filterYear}
          onChange={(v: number | undefined) => onFilterYear(v)}
          options={YEAR_OPTIONS}
        />
        <Select
          allowClear
          placeholder={t('filterByCategory')}
          style={{ width: 150 }}
          value={filterCategory}
          onChange={(v: CommissionCategory | undefined) => onFilterCategory(v)}
          options={[
            { value: 'commission', label: t('category.commission') },
            { value: 'incentive', label: t('category.incentive') },
          ]}
        />
      </div>

      <Table<CommissionEntry>
        rowKey="_id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={entries}
        pagination={{
          pageSize: 20,
          showSizeChanger: false,
          showTotal: (total) => t('paginationTotal', { total }),
        }}
        locale={{ emptyText: t('emptyEntries') }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
