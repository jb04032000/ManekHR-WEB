'use client';

/**
 * ReferralLogTable - admin table for the platform-wide referral log.
 *
 * What: paginated list of all ConnectReferral rows with status chips, credit
 *   amounts, and a per-row clawback action (confirm modal + reason input).
 *   All data flows through referrals.actions.ts server actions; table state
 *   is local React so the page does not need a full refresh on clawback.
 *
 * Cross-module links:
 *   - listReferrals  -> GET /admin/connect/referrals (referral-admin.controller.ts)
 *   - clawbackReferral -> POST /admin/connect/referrals/:id/clawback
 *   - ReferralLogRow / ReferralLogPage from features/connect/referrals/referrals.types
 *   - Rendered by app/admin/connect/referrals/page.tsx alongside AdminReferralEditor
 *
 * Watch: only rows with status 'rewarded' can be clawed back (credits are live).
 *   The backend enforces this too; the FE guard is a UX shortcut only.
 *   Modal uses destroyOnHidden so reason resets on every open (AntD v6 rule).
 */

import { useCallback, useState } from 'react';
import { App, Button, Modal, Select, Table, Tag, Input } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { listReferrals, clawbackReferral } from './referrals.actions';
import type { ReferralLogPage, ReferralLogRow, ReferralStatus } from './referrals.types';

const PAGE_SIZE = 20;

/** Map each status to an AntD Tag color + display label. */
const STATUS_META: Record<ReferralStatus, { color: string; label: string }> = {
  pending: { color: 'default', label: 'Pending' },
  qualified: { color: 'processing', label: 'Qualified' },
  rewarded: { color: 'success', label: 'Rewarded' },
  rejected: { color: 'error', label: 'Rejected' },
};

interface Props {
  /** SSR-hydrated first page; pagination refreshes via server action. */
  initialPage: ReferralLogPage;
}

export default function ReferralLogTable({ initialPage }: Props) {
  const { message: msgApi } = App.useApp();

  const [data, setData] = useState<ReferralLogRow[]>(initialPage.items);
  const [total, setTotal] = useState(initialPage.total);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | ''>('');
  const [loading, setLoading] = useState(false);

  // Clawback modal state
  const [clawbackTarget, setClawbackTarget] = useState<ReferralLogRow | null>(null);
  const [clawbackReason, setClawbackReason] = useState('');
  const [clawbacking, setClawbacking] = useState(false);

  /** Fetch a page (optionally with a status filter) and replace local state. */
  const fetchPage = useCallback(
    async (page: number, status: ReferralStatus | '') => {
      setLoading(true);
      const res = await listReferrals({
        page,
        pageSize: PAGE_SIZE,
        ...(status ? { status } : {}),
      });
      setLoading(false);
      if (res.ok) {
        setData(res.data.items);
        setTotal(res.data.total);
      } else {
        msgApi.error(res.error);
      }
    },
    [msgApi],
  );

  const handleTableChange = useCallback(
    (pagination: TablePaginationConfig) => {
      const page = pagination.current ?? 1;
      setCurrentPage(page);
      void fetchPage(page, statusFilter);
    },
    [fetchPage, statusFilter],
  );

  const handleStatusFilter = useCallback(
    (value: ReferralStatus | '') => {
      setStatusFilter(value);
      setCurrentPage(1);
      void fetchPage(1, value);
    },
    [fetchPage],
  );

  const openClawback = useCallback((row: ReferralLogRow) => {
    setClawbackTarget(row);
    setClawbackReason('');
  }, []);

  const closeClawback = useCallback(() => {
    setClawbackTarget(null);
    setClawbackReason('');
  }, []);

  const doClawback = useCallback(async () => {
    if (!clawbackTarget) return;
    setClawbacking(true);
    const res = await clawbackReferral(clawbackTarget.id, clawbackReason);
    setClawbacking(false);
    if (res.ok) {
      msgApi.success('Clawback applied. Credits reversed.');
      closeClawback();
      // Refresh the current page so status reflects the change.
      void fetchPage(currentPage, statusFilter);
    } else {
      msgApi.error(res.error);
    }
  }, [clawbackTarget, clawbackReason, msgApi, closeClawback, fetchPage, currentPage, statusFilter]);

  const columns: ColumnsType<ReferralLogRow> = [
    {
      title: 'Referrer',
      dataIndex: 'referrerName',
      key: 'referrerName',
      width: 160,
    },
    {
      title: 'Referee',
      dataIndex: 'refereeName',
      key: 'refereeName',
      width: 160,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ReferralStatus) => {
        const meta = STATUS_META[status] ?? { color: 'default', label: status };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Referrer credits',
      dataIndex: 'referrerCreditAmount',
      key: 'referrerCreditAmount',
      width: 130,
      align: 'right',
      render: (v: number) => `${v} cr`,
    },
    {
      title: 'Referee credits',
      dataIndex: 'refereeCreditAmount',
      key: 'refereeCreditAmount',
      width: 130,
      align: 'right',
      render: (v: number) => `${v} cr`,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      render: (v: string) => new Date(v).toLocaleDateString('en-IN'),
    },
    {
      title: 'Rewarded at',
      dataIndex: 'rewardedAt',
      key: 'rewardedAt',
      width: 140,
      render: (v?: string) => (v ? new Date(v).toLocaleDateString('en-IN') : '-'),
    },
    {
      title: 'Action',
      key: 'action',
      width: 110,
      render: (_: unknown, row: ReferralLogRow) =>
        row.status === 'rewarded' ? (
          <Button danger size="small" onClick={() => openClawback(row)}>
            Clawback
          </Button>
        ) : null,
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h3 className="m-0 text-lg font-semibold text-heading">Referral Log</h3>
        <Select<ReferralStatus | ''>
          value={statusFilter}
          onChange={handleStatusFilter}
          style={{ width: 160 }}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'qualified', label: 'Qualified' },
            { value: 'rewarded', label: 'Rewarded' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
        <span className="text-xs text-muted">{total} total</span>
      </div>

      <Table<ReferralLogRow>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{
          current: currentPage,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (t) => `${t} referrals`,
        }}
        onChange={handleTableChange}
        size="small"
        className="overflow-hidden rounded-2xl"
      />

      {/* Clawback confirm modal -- destroyOnHidden resets reason on every open */}
      <Modal
        open={!!clawbackTarget}
        onCancel={closeClawback}
        destroyOnHidden
        centered
        title="Clawback referral credits"
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
        footer={[
          <Button key="cancel" onClick={closeClawback}>
            Cancel
          </Button>,
          <Button
            key="confirm"
            danger
            type="primary"
            loading={clawbacking}
            onClick={() => void doClawback()}
          >
            Confirm clawback
          </Button>,
        ]}
      >
        {clawbackTarget && (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-body">
              This will reverse the credits awarded to{' '}
              <strong>{clawbackTarget.referrerName}</strong> (referrer,{' '}
              {clawbackTarget.referrerCreditAmount} cr) and{' '}
              <strong>{clawbackTarget.refereeName}</strong> (referee,{' '}
              {clawbackTarget.refereeCreditAmount} cr). The row will be marked{' '}
              <strong>rejected</strong>.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">
                Reason (optional — shown in the audit log)
              </label>
              <Input.TextArea
                rows={3}
                value={clawbackReason}
                onChange={(e) => setClawbackReason(e.target.value)}
                placeholder="e.g. Fraudulent signup, self-referral detected"
                maxLength={500}
              />
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
