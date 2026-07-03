'use client';

// Budget-pool allocation panel for the advance approval queue (pending tab).
// Owner enters a fundable pool -> Distribute splits it pro-rata across pending requests ->
// per-row editable allocations -> "Approve allocated" bulk-approves each funded row.
// Plan: docs/superpowers/plans/2026-06-22-advance-budget-pool.md Task 2.
// Links: allocateAdvancePool.ts (util), approveAdvanceRequest (salary.api.ts),
//   AdvanceApprovalQueue.tsx (mounts this panel on the pending tab).
// Watch: ALL wire amounts are PAISE; display is rupees (/100). Convert at boundary.

import { useState } from 'react';
import { Alert, Button, InputNumber, Space, Tag, Typography } from 'antd';
import { App } from 'antd';
import { useTranslations } from 'next-intl';
import { approveAdvanceRequest } from '@/lib/api/modules/salary.api';
import type { AdvanceSalaryRequest } from '@/types';
import { allocateAdvancePool, type AllocResult } from '@/features/salary/utils/allocateAdvancePool';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import { parseApiError } from '@/lib/utils';

export interface AdvanceAllocationPanelProps {
  workspaceId: string;
  /** All pending requests for the current view (month/year filtered by parent). */
  pendingRequests: AdvanceSalaryRequest[];
  /** Member id -> display name map (best-effort; falls back to id). */
  memberNames: Record<string, string>;
  /** Called when Approve-allocated completes (to refresh parent list). */
  onApproveSuccess?: () => void;
}

interface RowState {
  requestId: string;
  /** Allocation in rupees as displayed; stored as a number for the InputNumber. */
  allocRupees: number;
}

/**
 * Allocation panel shown on the pending-requests tab of AdvanceApprovalQueue.
 * Two actions: Distribute (fills allocations pro-rata) and Approve allocated
 * (loops approveAdvanceRequest for each funded row).
 */
export function AdvanceAllocationPanel({
  workspaceId,
  pendingRequests,
  memberNames,
  onApproveSuccess,
}: AdvanceAllocationPanelProps) {
  const t = useTranslations('advanceAllocation');
  const { message } = App.useApp();
  const currencyFmt = useCurrencyFormatter();

  // Pool in RUPEES (what the user types); convert to paise for the util.
  const [poolRupees, setPoolRupees] = useState<number | null>(null);

  // Per-row allocation state (rupees). Empty until Distribute is clicked.
  const [rows, setRows] = useState<RowState[]>([]);

  // Bulk-approve progress
  const [approving, setApproving] = useState(false);
  const [approveProgress, setApproveProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const totalAllocRupees = rows.reduce((s, r) => s + (r.allocRupees ?? 0), 0);
  const isOverBudget = poolRupees != null && totalAllocRupees > poolRupees;

  /** Run the allocation util and populate per-row state. */
  const handleDistribute = () => {
    if (poolRupees == null || poolRupees <= 0) return;
    const poolPaise = Math.round(poolRupees * 100);
    const inputs = pendingRequests.map((r) => ({
      id: r._id,
      requestedPaise: r.requestedAmount,
    }));
    const { allocations } = allocateAdvancePool(poolPaise, inputs, 10000);

    // Build a map for quick lookup.
    const allocMap: Record<string, AllocResult> = {};
    for (const a of allocations) allocMap[a.id] = a;

    setRows(
      pendingRequests.map((r) => ({
        requestId: r._id,
        // Convert paise -> rupees for display; default 0 if not found.
        allocRupees: (allocMap[r._id]?.allocatedPaise ?? 0) / 100,
      })),
    );
  };

  /** Approve each funded row (allocated > 0) one by one. */
  const handleApproveAllocated = async () => {
    const funded = rows.filter((r) => r.allocRupees > 0);
    if (funded.length === 0) return;

    setApproving(true);
    setApproveProgress({ done: 0, total: funded.length });

    let successCount = 0;
    for (let i = 0; i < funded.length; i++) {
      const row = funded[i];
      try {
        const approvedAmount = Math.round(row.allocRupees * 100); // rupees -> paise
        await approveAdvanceRequest(workspaceId, row.requestId, { approvedAmount });
        successCount++;
      } catch (err) {
        message.error(parseApiError(err));
      }
      setApproveProgress({ done: i + 1, total: funded.length });
    }

    setApproving(false);
    setApproveProgress(null);

    if (successCount > 0) {
      message.success(
        t('approveAllSuccess', {
          count: successCount,
          defaultValue: `Approved ${successCount} requests`,
        }),
      );
      // Reset allocation state and notify parent.
      setRows([]);
      setPoolRupees(null);
      onApproveSuccess?.();
    }
  };

  const updateRowAlloc = (requestId: string, valueRupees: number | null) => {
    setRows((prev) =>
      prev.map((r) => (r.requestId === requestId ? { ...r, allocRupees: valueRupees ?? 0 } : r)),
    );
  };

  if (pendingRequests.length === 0) {
    return (
      <Typography.Text type="secondary">
        {t('noRequests', { defaultValue: 'No pending requests' })}
      </Typography.Text>
    );
  }

  const totalRequestedRupees = pendingRequests.reduce((s, r) => s + r.requestedAmount / 100, 0);

  return (
    <div className="rounded-md border border-solid border-gray-200 bg-gray-50 p-4">
      <Typography.Text strong className="mb-3 block">
        {t('panelTitle', { defaultValue: 'Budget Allocation' })}
      </Typography.Text>

      {/* Pool input + Distribute */}
      <Space wrap className="mb-4">
        <InputNumber
          aria-label={t('poolLabel', { defaultValue: 'Fundable amount' })}
          prefix={currencyFmt.symbol}
          placeholder="0"
          min={0}
          precision={0}
          value={poolRupees}
          onChange={(v) => setPoolRupees(v)}
          style={{ width: 200 }}
          size="middle"
        />
        <Button type="default" onClick={handleDistribute} disabled={!poolRupees || poolRupees <= 0}>
          {t('distributeButton', { defaultValue: 'Distribute' })}
        </Button>
        <Typography.Text type="secondary" className="text-xs">
          {t('totalLabel', { defaultValue: 'Total requested' })}:{' '}
          {currencyFmt.inline(totalRequestedRupees)}
        </Typography.Text>
      </Space>

      {/* Per-request allocation rows */}
      <div className="mb-4 flex flex-col gap-2">
        {pendingRequests.map((req) => {
          const row = rows.find((r) => r.requestId === req._id);
          const memberName = memberNames[req.teamMemberId] ?? req.teamMemberId;
          const hasAlloc = row != null;
          const allocRupees = row?.allocRupees ?? 0;
          const isZero = hasAlloc && allocRupees === 0;

          return (
            <div
              key={req._id}
              className="flex flex-wrap items-center gap-3 rounded border border-solid border-gray-200 bg-white px-3 py-2"
            >
              <span className="min-w-[120px] font-medium">{memberName}</span>
              <Typography.Text type="secondary" className="text-xs">
                {t('requested', { defaultValue: 'Requested' })}:{' '}
                {currencyFmt.inline(req.requestedAmount / 100)}
              </Typography.Text>

              {hasAlloc && (
                <>
                  <InputNumber
                    aria-label={t('allocateColLabel', { defaultValue: 'Allocate' })}
                    prefix={currencyFmt.symbol}
                    min={0}
                    max={req.requestedAmount / 100}
                    precision={0}
                    value={allocRupees}
                    onChange={(v) => updateRowAlloc(req._id, v)}
                    style={{ width: 160 }}
                    size="small"
                  />
                  {isZero && (
                    <Tag color="orange">
                      {t('rollsToNext', { defaultValue: 'Rolls to next window' })}
                    </Tag>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Running total + over-budget warning */}
      {rows.length > 0 && (
        <div className="mb-4">
          <Typography.Text>
            {t('totalLabel', { defaultValue: 'Total allocated' })}:{' '}
            {currencyFmt.inline(totalAllocRupees)}
            {poolRupees != null && (
              <Typography.Text type="secondary">
                {' '}
                / {currencyFmt.inline(poolRupees)}
              </Typography.Text>
            )}
          </Typography.Text>
          {isOverBudget && (
            <Alert
              title={t('overBudgetWarning', { defaultValue: 'Total exceeds pool' })}
              type="warning"
              showIcon
              className="mt-2"
            />
          )}
        </div>
      )}

      {/* Approve allocated button */}
      {rows.length > 0 && (
        <Button
          type="primary"
          loading={approving}
          disabled={isOverBudget}
          onClick={() => void handleApproveAllocated()}
        >
          {approveProgress
            ? t('progressApproving', {
                done: approveProgress.done,
                total: approveProgress.total,
                defaultValue: `Approving ${approveProgress.done} of ${approveProgress.total}...`,
              })
            : t('approveAllocatedButton', { defaultValue: 'Approve allocated' })}
        </Button>
      )}
    </div>
  );
}
