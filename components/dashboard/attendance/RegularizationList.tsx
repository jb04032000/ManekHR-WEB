'use client';
import { Badge, Tooltip, Button, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslations } from 'next-intl';
import { DsTable } from '@/components/ui';
import type {
  RegularizationRequest,
  RegularizationStatus,
  RequestedAttendanceStatus,
} from '@/types';

dayjs.extend(relativeTime);

// ── Status chip config ────────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  RegularizationStatus,
  { status: 'processing' | 'success' | 'error' | 'default'; label: string }
> = {
  pending: { status: 'processing', label: 'Pending' },
  approved: { status: 'success', label: 'Approved' },
  rejected: { status: 'error', label: 'Rejected' },
  cancelled: { status: 'default', label: 'Cancelled' },
};

const REQUESTED_STATUS_LABEL: Record<RequestedAttendanceStatus, string> = {
  PRESENT: 'Present',
  HALF_DAY: 'Half Day',
  LEAVE: 'Leave',
  ABSENT: 'Absent',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RegularizationListProps {
  rows: RegularizationRequest[];
  loading: boolean;
  mode: 'pendingForMe' | 'myRequests' | 'all';
  onRowClick: (req: RegularizationRequest) => void;
  emptyText: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RegularizationList({
  rows,
  loading,
  mode,
  onRowClick,
  emptyText,
}: RegularizationListProps) {
  const t = useTranslations('attendance.regularizationList');
  const showMember = mode === 'pendingForMe' || mode === 'all';
  const showRaisedBy = mode === 'pendingForMe' || mode === 'all';

  const columns: ColumnsType<RegularizationRequest> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date: string) => dayjs(date).format('DD MMM YYYY'),
    },
    ...(showMember
      ? [
          {
            title: 'Member',
            dataIndex: 'memberName',
            key: 'memberName',
            width: 160,
            render: (name: string | undefined) => name ?? '-',
          },
        ]
      : []),
    {
      title: 'Requested Status',
      dataIndex: 'requestedStatus',
      key: 'requestedStatus',
      width: 140,
      render: (s: RequestedAttendanceStatus) => (
        <Badge
          color={
            s === 'PRESENT' ? 'green' : s === 'HALF_DAY' ? 'gold' : s === 'LEAVE' ? 'blue' : 'red'
          }
          text={REQUESTED_STATUS_LABEL[s] ?? s}
        />
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      render: (reason: string | undefined | null) => {
        if (!reason) return <span className="text-faint">-</span>;
        return reason.length > 40 ? (
          <Tooltip title={reason}>
            <span>{reason.slice(0, 40)}…</span>
          </Tooltip>
        ) : (
          reason
        );
      },
    },
    ...(showRaisedBy
      ? [
          {
            title: 'Raised By',
            dataIndex: 'raisedByName',
            key: 'raisedByName',
            width: 140,
            render: (name: string | undefined) => name ?? '-',
          },
        ]
      : []),
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (_: unknown, record: RegularizationRequest) => {
        const cfg = STATUS_BADGE[record.status] ?? {
          status: 'default' as const,
          label: record.status,
        };
        const total = record.approvalChain?.length ?? 0;
        const label =
          record.status === 'pending' && total > 1
            ? `Pending (L${record.currentLevel}/${total})`
            : cfg.label;
        return <Badge status={cfg.status} text={label} />;
      },
    },
    {
      title: 'Raised',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (ts: string) => dayjs(ts).fromNow(),
    },
    ...(mode === 'all' || mode === 'myRequests'
      ? [
          {
            title: 'Salary Impact',
            dataIndex: 'salaryInvalidated',
            key: 'salaryInvalidated',
            width: 140,
            render: (_: unknown, record: RegularizationRequest) =>
              record.salaryInvalidated === true ? (
                <Tag color="warning">{t('salaryStale')}</Tag>
              ) : null,
          },
        ]
      : []),
    ...(mode === 'pendingForMe'
      ? [
          {
            title: <span className="sr-only">{t('actionsAria')}</span>,
            key: 'actions',
            width: 90,
            render: (_: unknown, row: RegularizationRequest) => (
              <Button size="small" type="primary" onClick={() => onRowClick(row)}>
                Review
              </Button>
            ),
          },
        ]
      : []),
  ];

  if (rows.length === 0 && !loading) {
    return <div className="flex items-center justify-center py-16 text-faint">{emptyText}</div>;
  }

  return (
    <DsTable<RegularizationRequest>
      dataSource={rows}
      columns={columns}
      rowKey="_id"
      loading={loading}
      size="small"
      scrollX="max-content"
      onRow={(row) => ({
        onClick: () => onRowClick(row),
        style: { cursor: 'pointer' },
      })}
    />
  );
}
