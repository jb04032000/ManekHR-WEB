'use client';

// Owner-facing advance salary request queue (two-step flow, Plan 2026-06-22).
// APPROVE: sets approvedAmount + optional reviewNote only (no recovery plan, no disbursement).
// DISBURSE: opens AdvanceDisburseDrawer on approved-status rows -> payAdvanceRequest -> paid.
// Status filter tabs: pending / approved / paid so the owner can find each cohort.
// Links: salary.api.ts listAdvanceRequests / approveAdvanceRequest / payAdvanceRequest,
//   AdvanceDisburseDrawer (disburse step), RunPayrollPage (mount point).
// Watch: amounts flow as paise to/from the API; display is in rupees (/ 100).

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button,
  Empty,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Table,
  App,
  Input,
  Tag,
  Space,
  Radio,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import {
  listAdvanceRequests,
  approveAdvanceRequest,
  rejectAdvanceRequest,
} from '@/lib/api/modules/salary.api';
// Resolve teamMemberId -> display name so the approver sees who they are approving
// for (the list endpoint returns ids only). Links: lib/actions listTeam.
import { listTeam } from '@/lib/actions';
import type { AdvanceSalaryRequest, ApproveAdvanceRequestPayload } from '@/types';
import { parseApiError } from '@/lib/utils';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
// Disburse drawer: second step of the two-step advance flow.
// Links: AdvanceDisburseDrawer.tsx, payAdvanceRequest (salary.api.ts).
import { AdvanceDisburseDrawer } from './AdvanceDisburseDrawer';
// Budget-pool allocation panel: shown on the pending tab so the owner can fund a pool
// and bulk-approve multiple requests pro-rata. Links: AdvanceAllocationPanel.tsx.
import { AdvanceAllocationPanel } from './AdvanceAllocationPanel';
// Branded horizontal scrollbar for the requests table on mobile (native bar
// hidden via `.salary-table-wrap` in globals.css). Same component the main
// payroll + payments tables use.
import { TableCustomScrollbar } from '@/components/ui/TableCustomScrollbar';

interface AdvanceApprovalQueueProps {
  workspaceId: string;
  onChanged?: () => void;
}

interface ApproveFormValues {
  approvedAmountRupees: number;
  reviewNote?: string;
}

type StatusFilter = 'pending' | 'approved' | 'paid';

/**
 * Table of advance requests with approve/reject/disburse actions.
 * Two-step flow (Plan 2026-06-22):
 *   1. "Approve" on pending rows: modal captures amount + note -> approveAdvanceRequest
 *   2. "Disburse" on approved rows: AdvanceDisburseDrawer captures payment + recovery -> payAdvanceRequest
 * Status tabs (pending / approved / paid) let the owner see each cohort.
 * Links: approveAdvanceRequest / rejectAdvanceRequest / payAdvanceRequest server actions.
 */
export function AdvanceApprovalQueue({ workspaceId, onChanged }: AdvanceApprovalQueueProps) {
  const t = useTranslations('advanceSalary');
  const { message } = App.useApp();
  const currencyFmt = useCurrencyFormatter();
  // Wrapper for the requests table so <TableCustomScrollbar> can drive a branded
  // horizontal bar; the table has ~7 columns that overflow a phone width.
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [approveForm] = Form.useForm<ApproveFormValues>();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [requests, setRequests] = useState<AdvanceSalaryRequest[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Approve modal state (amount + note ONLY - no recovery plan here in two-step flow).
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<AdvanceSalaryRequest | null>(null);
  const [approveSaving, setApproveSaving] = useState(false);

  // Per-row reject note stored by request _id.
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  // Disburse drawer state: opened on approved-status rows. Holds one request
  // (row button) or several (bulk selection) - the drawer applies the same
  // payment details to each.
  const [disburseDrawerOpen, setDisburseDrawerOpen] = useState(false);
  const [disburseTargets, setDisburseTargets] = useState<AdvanceSalaryRequest[]>([]);
  // Bulk selection (pending + approved tabs): row keys for bulk approve /
  // bulk disburse. Cleared on tab switch / refresh (fetchRequests).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  /** Fetch advance requests for the currently selected status filter. */
  const fetchRequests = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await listAdvanceRequests(workspaceId, { status: statusFilter });
      setRequests(data);
      // Rows changed (tab switch / refresh) - drop any stale bulk selection.
      setSelectedIds([]);
    } catch (err) {
      message.error(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, statusFilter, message]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Best-effort member-name map for the Member column (the list endpoint returns
  // ids only). Fetched once per workspace; column falls back to the id on failure.
  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    void (async () => {
      try {
        const res = await listTeam(workspaceId, { status: 'active', limit: 1000 });
        if (!active) return;
        const map: Record<string, string> = {};
        for (const m of res.members) map[m.id] = m.name;
        setMemberNames(map);
      } catch {
        /* non-critical: the column falls back to the raw id */
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const resetApproveState = () => {
    setApproveModalOpen(false);
    setApproveTarget(null);
    approveForm.resetFields();
  };

  const openApproveModal = (record: AdvanceSalaryRequest) => {
    setApproveTarget(record);
    // Pre-fill with requested amount converted from paise to rupees.
    approveForm.setFieldsValue({
      approvedAmountRupees: record.requestedAmount / 100,
      reviewNote: '',
    });
    setApproveModalOpen(true);
  };

  // Two-step approve: ONLY sets amount + note; recovery plan / disbursement happen in step 2.
  const handleApprove = async (values: ApproveFormValues) => {
    if (!approveTarget) return;
    setApproveSaving(true);
    try {
      const approvedAmount = Math.round(values.approvedAmountRupees * 100);
      const payload: ApproveAdvanceRequestPayload = {
        approvedAmount,
        reviewNote: values.reviewNote?.trim() || undefined,
      };
      await approveAdvanceRequest(workspaceId, approveTarget._id, payload);
      message.success(t('approveSuccess'));
      resetApproveState();
      await fetchRequests();
      onChanged?.();
    } catch (err) {
      message.error(parseApiError(err));
    } finally {
      setApproveSaving(false);
    }
  };

  const handleReject = async (record: AdvanceSalaryRequest) => {
    try {
      const note = rejectNotes[record._id]?.trim() || undefined;
      await rejectAdvanceRequest(workspaceId, record._id, { reviewNote: note });
      message.success(t('rejectSuccess'));
      setRejectNotes((prev) => {
        const next = { ...prev };
        delete next[record._id];
        return next;
      });
      await fetchRequests();
      onChanged?.();
    } catch (err) {
      message.error(parseApiError(err));
    }
  };

  // Bulk approve (pending tab): approve each selected request AT ITS REQUESTED
  // amount, no per-row modal. Sequential so a failure identifies the remaining
  // rows; partial failures are surfaced and the rest still go through. For
  // pro-rata partial funding use the budget-pool panel below instead.
  const handleBulkApprove = async () => {
    const targets = requests.filter((r) => selectedIds.includes(r._id));
    if (targets.length === 0) return;
    setBulkApproving(true);
    let failed = 0;
    for (const req of targets) {
      try {
        await approveAdvanceRequest(workspaceId, req._id, {
          approvedAmount: req.requestedAmount,
        });
      } catch (err) {
        failed++;
        message.error(parseApiError(err));
      }
    }
    if (failed === 0) {
      message.success(t('bulkApproveSuccess', { count: targets.length }));
    } else {
      message.warning(t('bulkApprovePartial', { failed, total: targets.length }));
    }
    setBulkApproving(false);
    await fetchRequests();
    onChanged?.();
  };

  const openDisburseDrawer = (records: AdvanceSalaryRequest[]) => {
    if (records.length === 0) return;
    setDisburseTargets(records);
    setDisburseDrawerOpen(true);
  };

  const handleDisburseSuccess = async () => {
    await fetchRequests();
    onChanged?.();
  };

  const STATUS_TAG_COLOR: Record<string, string> = {
    pending: 'orange',
    approved: 'blue',
    paid: 'green',
    rejected: 'red',
    cancelled: 'default',
  };

  const columns: ColumnsType<AdvanceSalaryRequest> = [
    {
      title: t('colMember'),
      dataIndex: 'teamMemberId',
      key: 'teamMemberId',
      render: (id: string) => <span className="font-medium">{memberNames[id] ?? id}</span>,
    },
    {
      title: t('colPeriod'),
      key: 'period',
      render: (_: unknown, record: AdvanceSalaryRequest) =>
        `${String(record.month).padStart(2, '0')}/${record.year}`,
    },
    {
      title: t('colRequestedAmount'),
      dataIndex: 'requestedAmount',
      key: 'requestedAmount',
      render: (paise: number) => currencyFmt.inline(paise / 100),
    },
    {
      title: t('colApprovedAmount', { defaultValue: 'Approved' }),
      dataIndex: 'approvedAmount',
      key: 'approvedAmount',
      render: (paise?: number) =>
        paise != null ? currencyFmt.inline(paise / 100) : <span className="text-muted">-</span>,
    },
    {
      title: t('colRequestedOn'),
      dataIndex: 'requestedOn',
      key: 'requestedOn',
      render: (date: string) => dayjs(date).format('DD MMM YYYY'),
    },
    {
      title: t('colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={STATUS_TAG_COLOR[status] ?? 'default'}>{status}</Tag>,
    },
    {
      title: t('colActions'),
      key: 'actions',
      render: (_: unknown, record: AdvanceSalaryRequest) => (
        <Space size="small" wrap>
          {/* Approve action: only on pending rows */}
          {record.status === 'pending' && (
            <Button type="primary" size="small" onClick={() => openApproveModal(record)}>
              {t('approve')}
            </Button>
          )}
          {/* Disburse action: only on approved rows (step 2 of two-step flow) */}
          {record.status === 'approved' && (
            <Button
              type="primary"
              size="small"
              style={{ background: '#059669' }}
              onClick={() => openDisburseDrawer([record])}
            >
              {t('disburse', { defaultValue: 'Disburse' })}
            </Button>
          )}
          {/* Reject action: only on pending rows */}
          {record.status === 'pending' && (
            <Popconfirm
              title={t('rejectConfirmTitle')}
              description={
                <Input
                  size="small"
                  placeholder={t('rejectNotePlaceholder')}
                  value={rejectNotes[record._id] ?? ''}
                  onChange={(e) =>
                    setRejectNotes((prev) => ({ ...prev, [record._id]: e.target.value }))
                  }
                  style={{ marginTop: 4 }}
                />
              }
              onConfirm={() => handleReject(record)}
              okText={t('confirmReject')}
              cancelText={t('cancel')}
              okButtonProps={{ danger: true }}
            >
              <Button danger size="small">
                {t('reject')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Status filter: pending / approved / paid */}
      <div className="mb-3">
        <Radio.Group
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          optionType="button"
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value="pending">
            {t('filterPending', { defaultValue: 'Pending' })}
          </Radio.Button>
          <Radio.Button value="approved">
            {t('filterApproved', { defaultValue: 'Approved' })}
          </Radio.Button>
          <Radio.Button value="paid">{t('filterPaid', { defaultValue: 'Paid' })}</Radio.Button>
        </Radio.Group>
      </div>

      {/* Bulk actions: approve selected (pending tab, each at its requested
          amount) / disburse selected (approved tab, same payment details). */}
      {selectedIds.length > 0 && (statusFilter === 'pending' || statusFilter === 'approved') && (
        <div className="mb-2 flex justify-end">
          {statusFilter === 'pending' ? (
            <Popconfirm
              title={t('bulkApproveConfirm', { count: selectedIds.length })}
              onConfirm={() => void handleBulkApprove()}
              okText={t('approve')}
              cancelText={t('cancel')}
            >
              <Button type="primary" size="small" loading={bulkApproving}>
                {t('bulkApproveSelected', { count: selectedIds.length })}
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="primary"
              size="small"
              style={{ background: '#059669' }}
              onClick={() =>
                openDisburseDrawer(requests.filter((r) => selectedIds.includes(r._id)))
              }
            >
              {t('bulkDisburseSelected', { count: selectedIds.length })}
            </Button>
          )}
        </div>
      )}

      {/* scroll.x makes the ~7-column table scroll horizontally INSIDE its own
          container on narrow screens instead of overflowing the page (which cut
          off the Status/Actions columns on mobile). The branded scrollbar below
          replaces the hidden native bar. No visual change on desktop, where the
          table already fits. */}
      <div ref={tableWrapRef} className="salary-table-wrap">
        <Table<AdvanceSalaryRequest>
          dataSource={requests}
          columns={columns}
          loading={loading}
          rowKey="_id"
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description={t('noRequests')} /> }}
          pagination={false}
          rowSelection={
            statusFilter === 'pending' || statusFilter === 'approved'
              ? {
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedIds(keys as string[]),
                }
              : undefined
          }
        />
        <TableCustomScrollbar containerRef={tableWrapRef} />
      </div>

      {/* Budget-pool allocation panel: only shown on the pending tab.
          Lets the owner enter a fundable pool, distribute pro-rata, then bulk-approve.
          Links: AdvanceAllocationPanel.tsx, allocateAdvancePool util. */}
      {statusFilter === 'pending' && (
        <div className="mt-4">
          <AdvanceAllocationPanel
            workspaceId={workspaceId}
            pendingRequests={requests}
            memberNames={memberNames}
            onApproveSuccess={() => {
              void fetchRequests();
              onChanged?.();
            }}
          />
        </div>
      )}

      {/* Approve modal: two-step flow - only captures amount + note.
          Recovery plan / disbursement happen in AdvanceDisburseDrawer. */}
      <Modal
        open={approveModalOpen}
        title={t('approveModalTitle')}
        centered
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
        onCancel={resetApproveState}
        onOk={() => approveForm.submit()}
        confirmLoading={approveSaving}
        destroyOnHidden
        okText={t('approveConfirm')}
      >
        {approveTarget && (
          <p className="mb-4 text-sm text-muted">
            {t('approveModalDescription', {
              requested: currencyFmt.inline(approveTarget.requestedAmount / 100),
            })}
          </p>
        )}
        <Form form={approveForm} layout="vertical" onFinish={handleApprove}>
          <Form.Item
            name="approvedAmountRupees"
            label={t('approvedAmountLabel')}
            rules={[
              { required: true, message: t('amountRequired') },
              { type: 'number', min: 1, message: t('amountMustBePositive') },
            ]}
          >
            {/* prefix= per AntD v6 (addonBefore/addonAfter banned on InputNumber) */}
            <InputNumber
              prefix={currencyFmt.symbol}
              min={1}
              precision={0}
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>
          <Form.Item name="reviewNote" label={t('reviewNoteLabel')}>
            <Input.TextArea rows={2} placeholder={t('reviewNotePlaceholder')} />
          </Form.Item>
        </Form>
        {/* Recovery plan now happens at disburse time - show a hint. */}
        <p className="mt-2 text-xs text-muted">
          {t('approveStepHint', {
            defaultValue:
              'Recovery plan and payment details are set when you disburse the advance.',
          })}
        </p>
      </Modal>

      {/* Disburse drawer: step 2 - payment details (single row or bulk selection) */}
      {disburseTargets.length > 0 && (
        <AdvanceDisburseDrawer
          open={disburseDrawerOpen}
          workspaceId={workspaceId}
          requests={disburseTargets}
          onClose={() => {
            setDisburseDrawerOpen(false);
            setDisburseTargets([]);
          }}
          onSuccess={handleDisburseSuccess}
        />
      )}
    </div>
  );
}
