'use client';

import { Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { formatCurrencyFull } from '@/lib/utils';
import type { CommissionYtdMemberRow, CommissionYtdResult, TeamMember } from '@/types';

const CURRENT_YEAR = dayjs().year();
// Show last 5 financial year start years
const FY_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const fy = CURRENT_YEAR - i;
  return {
    value: fy,
    label: `FY ${fy}-${String(fy + 1).slice(2)}`,
  };
});

interface Props {
  ytd: CommissionYtdResult | null;
  loading: boolean;
  memberMap: Map<string, TeamMember>;
  fyStartYear: number;
  onFyChange: (fy: number) => void;
}

export function CommissionYtdTab({ ytd, loading, memberMap, fyStartYear, onFyChange }: Props) {
  const t = useTranslations('salary.commission');

  if (loading) {
    return (
      <div className="py-4">
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    );
  }

  const columns: ColumnsType<CommissionYtdMemberRow> = [
    {
      title: t('colEmployee'),
      key: 'employee',
      fixed: 'left',
      width: 200,
      render: (_: unknown, row: CommissionYtdMemberRow) => {
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
      title: t('ytdColCommission'),
      dataIndex: 'totalCommission',
      key: 'totalCommission',
      align: 'right',
      render: (v: number) => <span className="tabular-nums">{formatCurrencyFull(v)}</span>,
    },
    {
      title: t('ytdColIncentive'),
      dataIndex: 'totalIncentive',
      key: 'totalIncentive',
      align: 'right',
      render: (v: number) => <span className="tabular-nums">{formatCurrencyFull(v)}</span>,
    },
    {
      title: t('ytdColTotal'),
      dataIndex: 'grandTotal',
      key: 'grandTotal',
      align: 'right',
      render: (v: number) => (
        <span className="font-semibold text-heading tabular-nums">{formatCurrencyFull(v)}</span>
      ),
    },
    {
      title: t('ytdColMonths'),
      key: 'months',
      render: (_: unknown, row: CommissionYtdMemberRow) => (
        <div className="flex flex-wrap gap-1">
          {row.months.map((m) => (
            <span
              key={`${m.year}-${m.month}`}
              className="rounded px-1.5 py-0.5 text-[11px] tabular-nums"
              style={{
                background: 'var(--cr-info-50, #e6f4ff)',
                color: 'var(--cr-info-500, #1677ff)',
              }}
            >
              {dayjs()
                .month(m.month - 1)
                .format('MMM')}
              : {formatCurrencyFull(m.total)}
            </span>
          ))}
        </div>
      ),
    },
  ];

  const summary = ytd
    ? [
        {
          key: '__total',
          teamMemberId: '__total',
          months: [],
          totalCommission: ytd.rows.reduce((s, r) => s + r.totalCommission, 0),
          totalIncentive: ytd.rows.reduce((s, r) => s + r.totalIncentive, 0),
          grandTotal: ytd.workspaceTotal,
        },
      ]
    : [];

  return (
    <div className="py-4">
      {/* FY picker */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[13px] text-subtle">{t('ytdFyLabel')}</span>
        <Select
          style={{ width: 160 }}
          value={fyStartYear}
          onChange={onFyChange}
          options={FY_OPTIONS}
        />
        {ytd && (
          <span className="text-[13px] text-subtle">
            {t('ytdWorkspaceTotal', { total: formatCurrencyFull(ytd.workspaceTotal) })}
          </span>
        )}
      </div>

      {ytd && ytd.rows.length > 0 ? (
        <Table<CommissionYtdMemberRow>
          rowKey="teamMemberId"
          size="middle"
          dataSource={ytd.rows}
          columns={columns}
          pagination={false}
          scroll={{ x: 'max-content' }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row className="font-semibold">
                <Table.Summary.Cell index={0}>{t('ytdSummaryRow')}</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  {formatCurrencyFull(summary[0]?.totalCommission ?? 0)}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  {formatCurrencyFull(summary[0]?.totalIncentive ?? 0)}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <span className="font-bold">{formatCurrencyFull(ytd.workspaceTotal)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      ) : (
        <div className="py-8 text-center text-subtle">{t('ytdEmpty')}</div>
      )}
    </div>
  );
}
