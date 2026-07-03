'use client';

import { useCallback, useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { Alert, DatePicker, message, Popconfirm, Spin } from 'antd';
import { FormOutlined, WarningOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs, { type Dayjs } from 'dayjs';

import DsCard from '@/components/ui/DsCard';
import DsButton from '@/components/ui/DsButton';
import { DsSelect, DsOption } from '@/components/ui/DsInput';
import { DsPageHeader } from '@/components/ui/DsBadge';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useWorkspaceStore } from '@/lib/store';
import { shiftsApi } from '@/lib/api/modules/shifts.api';
import { bulkCreateProductionLogs } from '@/lib/actions/production-logs.actions';
import {
  BulkProductionLogTable,
  type BulkAssignmentRow,
  type BulkRowState,
} from '@/components/machines/BulkProductionLogTable';
import type { MachineShiftAssignment, Shift, BulkProductionLogItem } from '@/types';

// ---------------------------------------------------------------------------
// Gate banner (same as ProductionLogsTab)
// ---------------------------------------------------------------------------

function ProductionGateBanner({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div
      role="alert"
      style={{
        background: 'var(--cr-warning-bg, var(--cr-warning-50))',
        border: '1px solid var(--cr-warning, var(--cr-warning-700))',
        borderRadius: 8,
        padding: '32px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 600,
        margin: '64px auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <WarningOutlined
          style={{ color: 'var(--cr-warning, var(--cr-warning-700))', fontSize: 22 }}
        />
        <h1 style={{ fontWeight: 700, fontSize: 17, margin: 0 }}>{t('gate.heading')}</h1>
      </div>
      <p style={{ margin: 0, color: 'var(--cr-text-2, var(--cr-text-4))', fontSize: 14 }}>
        {t('gate.body')}
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/account/subscription">
          <DsButton dsVariant="primary">{t('gate.upgradeCta')}</DsButton>
        </Link>
        <DsButton dsVariant="ghost">{t('gate.learnMore')}</DsButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error code → UI code mapping
// ---------------------------------------------------------------------------

type RowErrorCode = BulkRowState['errorCode'];

function mapErrorCode(serverCode?: string): RowErrorCode {
  switch (serverCode) {
    case 'PRODUCTION_LOG_EDIT_WINDOW_EXPIRED':
      return 'WINDOW';
    case 'PRODUCTION_LOG_OUT_OF_SCOPE':
      return 'SCOPE';
    case 'PRODUCTION_LOG_PAYROLL_LOCKED':
      return 'LOCKED';
    case 'ASSIGNMENT_AMBIGUOUS':
      return 'AMBIGUOUS';
    default:
      return 'VALIDATION';
  }
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function BulkProductionEntryPage() {
  const t = useTranslations('machines-production');
  const { currentWorkspaceId } = useWorkspaceStore();
  const [msgApi, msgCtx] = message.useMessage();
  const wsId = currentWorkspaceId ?? '';

  // Sub-feature gate
  const { hasAccess, isLoading: gateLoading } = useFeatureAccess('machines', 'machines_production');

  // ---- Step state ---------------------------------------------------------
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [shiftId, setShiftId] = useState<string>('none');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [assignments, setAssignments] = useState<BulkAssignmentRow[]>([]);
  const [values, setValues] = useState<Record<string, BulkRowState>>({});
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  // Load shifts for workspace
  useEffect(() => {
    if (!wsId || !hasAccess) return;
    startTransition(() => {
      setShiftsLoading(true);
    });
    shiftsApi
      .list(wsId)
      .then((list) => setShifts(list))
      .catch(() => setShifts([]))
      .finally(() => setShiftsLoading(false));
  }, [wsId, hasAccess]);

  // ---- Edit-window pre-check: date < today−1 ------------------------------
  const isOutsideEditWindow = date.isBefore(dayjs().subtract(1, 'day').startOf('day'));

  // ---- Navigation guard ---------------------------------------------------
  const hasUnsavedInput = Object.values(values).some(
    (v) =>
      (v.stitchCount !== undefined && v.stitchCount !== null) ||
      (v.pieceCount !== undefined && v.pieceCount !== null) ||
      (v.hoursLogged !== undefined && v.hoursLogged !== null),
  );

  useEffect(() => {
    if (!hasUnsavedInput) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have unsaved production logs. Leave anyway?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedInput]);

  // ---- updateRow handler --------------------------------------------------
  const updateRow = useCallback((assignmentId: string, patch: Partial<BulkRowState>) => {
    setValues((prev) => ({
      ...prev,
      [assignmentId]: { ...(prev[assignmentId] ?? { status: 'pending' }), ...patch },
    }));
  }, []);

  // ---- Load Machines (assignments) ----------------------------------------
  const handleLoad = useCallback(async () => {
    if (!wsId || !date) return;
    setLoadingAssignments(true);

    try {
      // Use the assignments endpoint - for a workspace-wide bulk load we
      // call the machines list endpoint filtered by activeOnly, then derive
      // assignments per machine. Since there is no single
      // "list-all-active-assignments-for-date" endpoint exposed on the
      // client API yet, we fall back to the existing
      // ApiEndpoints.machines.assignments pattern via a direct HTTP call.
      // The backend ResourceScope guard already filters server-side.
      const http = await import('@/lib/api/client').then((m) => m.default);
      const unwrap = await import('@/lib/api/client').then((m) => m.unwrap);

      const params: Record<string, string> = {
        date: date.format('YYYY-MM-DD'),
        activeOnly: 'true',
      };
      if (shiftId && shiftId !== 'none') {
        params.shiftId = shiftId;
      }

      // Endpoint: GET /workspaces/:wsId/machine-shift-assignments?date=&shiftId=
      const raw = await http
        .get(`workspaces/${wsId}/machine-shift-assignments`, { params })
        .then((res) => unwrap<MachineShiftAssignment[]>(res));

      const rows: BulkAssignmentRow[] = raw.map((a) => {
        const machineId =
          typeof a.machineId === 'string'
            ? a.machineId
            : (a.machineId as { _id: string; name: string; machineCode?: string })._id;
        const machineName =
          typeof a.machineId === 'string'
            ? machineId
            : (a.machineId as { _id: string; name: string; machineCode?: string }).name;
        const machineCode =
          typeof a.machineId === 'string'
            ? ''
            : ((a.machineId as { _id: string; name: string; machineCode?: string }).machineCode ??
              '');

        return {
          assignmentId: a.id ?? (a._id as string),
          machineId,
          machineName,
          machineCode,
          teamMemberId:
            typeof a.teamMemberId === 'string'
              ? a.teamMemberId
              : ((a.teamMemberId as { _id: string })?._id ?? ''),
          // teamMemberId is populated to { _id, name, employeeCode } by the
          // assignments endpoint when available - show name; fall back to ID (WR-03).
          operatorName:
            typeof a.teamMemberId === 'object' && a.teamMemberId
              ? ((a.teamMemberId as { name?: string; _id?: string }).name ??
                (a.teamMemberId as { _id?: string })._id ??
                '')
              : (a.teamMemberId as string),
          shiftId:
            typeof a.shiftId === 'string'
              ? a.shiftId
              : a.shiftId
                ? (a.shiftId as { _id: string; name: string })._id
                : undefined,
          primaryMetric: 'pieces', // will be overridden if machine exposes it; default safe
          isOutOfScope: false,
        };
      });

      setAssignments(rows);
      const initValues: Record<string, BulkRowState> = {};
      rows.forEach((r) => {
        initValues[r.assignmentId] = { status: r.isOutOfScope ? 'out-of-scope-warn' : 'pending' };
      });
      setValues(initValues);
      setStep(2);
    } catch {
      msgApi.error(t('errors.serverGeneric'));
    } finally {
      setLoadingAssignments(false);
    }
  }, [wsId, date, shiftId, t, msgApi]);

  // ---- Count ready rows ---------------------------------------------------
  const readyRows = assignments.filter((r) => {
    const v = values[r.assignmentId];
    if (!v || v.status === 'out-of-scope-warn') return false;
    const primary = r.primaryMetric;
    if (primary === 'stitches') return v.stitchCount !== undefined && v.stitchCount !== null;
    if (primary === 'pieces') return v.pieceCount !== undefined && v.pieceCount !== null;
    return v.hoursLogged !== undefined && v.hoursLogged !== null;
  });

  const failedRows = assignments.filter((r) => values[r.assignmentId]?.status === 'failed');
  const showRetry = failedRows.length > 0 && !submitting;

  // ---- Submit handler -----------------------------------------------------
  const handleSubmit = useCallback(async () => {
    const toSubmit = retryFailed ? failedRows : readyRows;
    if (!toSubmit.length) return;

    // Set all submitting
    setValues((prev) => {
      const next = { ...prev };
      toSubmit.forEach((r) => {
        next[r.assignmentId] = { ...next[r.assignmentId], status: 'submitting' };
      });
      return next;
    });
    setSubmitting(true);

    // Build payload with index tracking
    const indexMap: string[] = []; // index → assignmentId
    const entries: BulkProductionLogItem[] = toSubmit.map((r) => {
      const v = values[r.assignmentId];
      indexMap.push(r.assignmentId);
      const item: BulkProductionLogItem = {
        machineId: r.machineId,
        teamMemberId: r.teamMemberId,
        date: date.format('YYYY-MM-DD'),
      };
      if (r.shiftId && r.shiftId !== 'none') item.shiftId = r.shiftId;
      if (r.assignmentId) item.assignmentId = r.assignmentId;
      if (v.stitchCount !== null && v.stitchCount !== undefined) item.stitchCount = v.stitchCount;
      if (v.pieceCount !== null && v.pieceCount !== undefined) item.pieceCount = v.pieceCount;
      if (v.hoursLogged !== null && v.hoursLogged !== undefined) item.hoursLogged = v.hoursLogged;
      if (v.notes) item.notes = v.notes;
      return item;
    });

    try {
      const result = await bulkCreateProductionLogs(wsId, { entries });

      setValues((prev) => {
        const next = { ...prev };

        // Backend returns `failed[].index` as the position in the submitted batch,
        // and `created[]` as successes only (no sentinel for failures). Align by
        // computing the complement: any submission index NOT in `failed` succeeded.
        // (CR-01 fix - prior code mapped created[idx] to indexMap[idx], which
        // mis-attributed successes to failed rows after the first failure.)
        const failedByIndex = new Map<number, { code?: string; error: string }>();
        result.failed.forEach((f) => {
          failedByIndex.set(f.index, { code: f.code, error: f.error });
        });

        toSubmit.forEach((_row, submissionIdx) => {
          const aId = indexMap[submissionIdx];
          if (!aId) return;
          const f = failedByIndex.get(submissionIdx);
          if (f) {
            next[aId] = {
              ...next[aId],
              status: 'failed',
              errorCode: mapErrorCode(f.code),
              errorDetail: f.error,
            };
          } else {
            next[aId] = { ...next[aId], status: 'success' };
            // Revert to pending + clear inputs after 3s
            setTimeout(() => {
              setValues((p) => ({
                ...p,
                [aId]: {
                  status: 'pending',
                  stitchCount: null,
                  pieceCount: null,
                  hoursLogged: null,
                  notes: '',
                },
              }));
            }, 3000);
          }
        });

        return next;
      });

      const ok = result.created.length;
      const failed = result.failed.length;

      if (failed === 0) {
        msgApi.success(t('bulk.toast.allSuccess', { n: ok }));
      } else if (ok === 0) {
        msgApi.error(t('bulk.toast.allFailed'));
      } else {
        msgApi.warning(t('bulk.toast.partial', { ok, failed }));
      }

      setRetryFailed(failed > 0);
    } catch {
      // Revert submitting rows to failed
      setValues((prev) => {
        const next = { ...prev };
        toSubmit.forEach((r) => {
          if (next[r.assignmentId]?.status === 'submitting') {
            next[r.assignmentId] = {
              ...next[r.assignmentId],
              status: 'failed',
              errorCode: 'VALIDATION',
              errorDetail: t('errors.serverGeneric'),
            };
          }
        });
        return next;
      });
      msgApi.error(t('errors.serverGeneric'));
    } finally {
      setSubmitting(false);
    }
  }, [values, date, wsId, retryFailed, failedRows, readyRows, t, msgApi]);

  // ---- Discard all --------------------------------------------------------
  const handleDiscard = useCallback(() => {
    setAssignments([]);
    setValues({});
    setStep(1);
    setRetryFailed(false);
  }, []);

  // ---- Shift label --------------------------------------------------------
  const shiftLabel =
    shiftId === 'none'
      ? t('bulk.fields.shiftNone')
      : (shifts.find((s) => s._id === shiftId || s.id === shiftId)?.name ?? shiftId);

  // ---- Render -------------------------------------------------------------

  if (gateLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <ProductionGateBanner t={t} />
      </div>
    );
  }

  const submittingCount = readyRows.length;
  const nReady = retryFailed ? failedRows.length : submittingCount;

  return (
    <div className="flex min-h-screen flex-col pb-20">
      {msgCtx}

      {/* Page header */}
      <div className="p-6 pb-0">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/dashboard/machines"
            className="text-sm text-[var(--cr-text-3)] no-underline hover:text-[var(--cr-primary)]"
          >
            &larr; Machines
          </Link>
        </div>
        <DsPageHeader title={t('bulk.title')} sub={t('bulk.subhead')} icon={<FormOutlined />} />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-6 pt-4">
        {/* Step 1 */}
        {step === 1 ? (
          <DsCard title={t('bulk.step1Title')} className="w-full">
            <p className="mb-4 text-sm text-[var(--cr-text-3)]">{t('bulk.step1Hint')}</p>

            {/* Edit-window warning */}
            {isOutsideEditWindow && (
              <Alert type="warning" showIcon title={t('bulk.warn.editWindow')} className="mb-4" />
            )}

            <div className="flex flex-wrap items-end gap-4">
              {/* Date picker */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold tracking-wide text-[var(--cr-text-3)] uppercase">
                  {t('bulk.fields.date')}
                </label>
                <DatePicker
                  value={date}
                  onChange={(d) => d && setDate(d)}
                  allowClear={false}
                  style={{ width: 180 }}
                  disabledDate={(d) => d.isAfter(dayjs(), 'day')}
                />
              </div>

              {/* Shift picker */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold tracking-wide text-[var(--cr-text-3)] uppercase">
                  {t('bulk.fields.shift')}
                </label>
                <DsSelect
                  value={shiftId}
                  onChange={(v: string) => setShiftId(v)}
                  style={{ width: 200 }}
                  loading={shiftsLoading}
                >
                  <DsOption value="none">{t('bulk.fields.shiftNone')}</DsOption>
                  {shifts.map((s) => (
                    <DsOption key={s._id ?? s.id} value={s._id ?? s.id ?? ''}>
                      {s.name}
                    </DsOption>
                  ))}
                </DsSelect>
              </div>

              {/* Load CTA */}
              <DsButton
                dsVariant="primary"
                onClick={handleLoad}
                loading={loadingAssignments}
                disabled={!date}
              >
                {t('bulk.loadCta')}
              </DsButton>
            </div>
          </DsCard>
        ) : (
          /* Step 1 collapsed summary */
          <div
            className="flex items-center gap-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface-2)] px-4 py-3"
            style={{ fontSize: 14 }}
          >
            <span className="text-[var(--cr-text-2)]">
              {t('bulk.fields.date')}: <strong>{date.format('DD MMM YYYY')}</strong>
              {' · '}
              {t('bulk.fields.shift')}: <strong>{shiftLabel}</strong>
            </span>
            {hasUnsavedInput ? (
              <Popconfirm
                title={t('bulk.discard.title')}
                description={t('bulk.discard.body')}
                okText={t('bulk.discard.cta')}
                okButtonProps={{ danger: true }}
                cancelText={t('bulk.footer.cancel')}
                onConfirm={() => {
                  setStep(1);
                  setAssignments([]);
                  setValues({});
                  setRetryFailed(false);
                }}
              >
                <DsButton dsVariant="ghost" dsSize="sm" style={{ marginLeft: 8 }}>
                  Change
                </DsButton>
              </Popconfirm>
            ) : (
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                style={{ marginLeft: 8 }}
                onClick={() => {
                  setStep(1);
                  setAssignments([]);
                  setValues({});
                  setRetryFailed(false);
                }}
              >
                Change
              </DsButton>
            )}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <DsCard
            title={t('bulk.step2Title')}
            extra={
              <span className="text-sm text-[var(--cr-text-3)]">
                {t('bulk.step2Hint', { n: assignments.length })}
              </span>
            }
          >
            {assignments.length === 0 ? (
              <EmptyStateLayout
                icon={<LockOutlined style={{ fontSize: 32, color: 'var(--cr-text-3)' }} />}
                title={t('bulk.empty.heading')}
                description={t('bulk.empty.body')}
                actions={[
                  {
                    label: t('bulk.empty.cta'),
                    onClick: () => {
                      setStep(1);
                      setAssignments([]);
                      setValues({});
                    },
                    type: 'default',
                  },
                ]}
              />
            ) : (
              <BulkProductionLogTable
                rows={assignments}
                values={values}
                onChange={updateRow}
                readOnly={submitting}
              />
            )}
          </DsCard>
        )}
      </div>

      {/* Sticky footer - only visible in step 2 with rows */}
      {step === 2 && assignments.length > 0 && (
        <footer
          role="region"
          aria-label={t('bulk.footer.submit', { n: nReady })}
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--cr-surface)',
            boxShadow: '0 -1px 8px rgba(0,0,0,0.08)',
            zIndex: 10,
          }}
          className="flex items-center justify-between px-6"
          // 64px desktop, 56px mobile handled via min-h
        >
          <div
            style={{
              minHeight: 64,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {/* Left: Discard */}
            <Popconfirm
              title={t('bulk.discard.title')}
              description={t('bulk.discard.body')}
              okText={t('bulk.discard.cta')}
              okButtonProps={{ danger: true }}
              cancelText={t('bulk.footer.cancel')}
              onConfirm={handleDiscard}
            >
              <DsButton dsVariant="ghost" disabled={submitting}>
                {t('bulk.footer.cancel')}
              </DsButton>
            </Popconfirm>

            {/* Center: summary */}
            <span className="text-sm text-[var(--cr-text-3)]">
              {readyRows.length === 0
                ? t('bulk.footer.noneFilled')
                : t('bulk.footer.nFilled', { n: readyRows.length })}
              {failedRows.length > 0 && (
                <span className="ml-2 text-[var(--cr-error)]">
                  · {failedRows.length}{' '}
                  {t('bulk.footer.retryFailed', { n: failedRows.length })
                    .replace(String(failedRows.length), '')
                    .trim()}
                </span>
              )}
            </span>

            {/* Right: Submit / Retry */}
            {showRetry ? (
              <DsButton
                dsVariant="primary"
                onClick={() => {
                  setRetryFailed(true);
                  handleSubmit();
                }}
                loading={submitting}
              >
                {t('bulk.footer.retryFailed', { n: failedRows.length })}
              </DsButton>
            ) : (
              <DsButton
                dsVariant="primary"
                onClick={handleSubmit}
                loading={submitting}
                disabled={readyRows.length === 0}
              >
                {readyRows.length === 0
                  ? t('bulk.footer.noneFilled')
                  : t('bulk.footer.submit', { n: readyRows.length })}
              </DsButton>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
