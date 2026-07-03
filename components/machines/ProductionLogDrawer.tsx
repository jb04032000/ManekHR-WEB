'use client';

import { startTransition, useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  DatePicker,
  InputNumber,
  Input,
  Popconfirm,
  message,
  Skeleton,
  Alert,
  Tag,
  Collapse,
} from 'antd';
import { DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';

import { DsButton, DsSelect, DsOption } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import {
  createProductionLog,
  updateProductionLog,
  deleteProductionLog,
  peekNextProductionLogCode,
} from '@/lib/actions/production-logs.actions';
import type {
  Machine,
  ProductionLog,
  CreateProductionLogPayload,
  UpdateProductionLogPayload,
} from '@/types';

// ---------------------------------------------------------------------------
// Error code → i18n key map
// ---------------------------------------------------------------------------

const ERROR_CODE_MAP: Record<string, string> = {
  PRODUCTION_LOG_EDIT_WINDOW_EXPIRED: 'errors.editWindowExpired',
  PRODUCTION_LOG_PAYROLL_LOCKED: 'errors.payrollLocked',
  PRODUCTION_LOG_OUT_OF_SCOPE: 'errors.outOfScope',
  ASSIGNMENT_AMBIGUOUS: 'errors.assignmentAmbiguous',
  ASSIGNMENT_MISSING: 'errors.assignmentMissing',
  PRODUCTION_LOG_PRIMARY_METRIC_REQUIRED: 'errors.primaryMetricRequired',
  PRODUCTION_LOG_INVALID_DATE: 'errors.invalidDate',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolvePrimaryMetric(machine: Machine): 'stitches' | 'pieces' | 'hours' {
  const pm = machine.primaryMetric;
  if (pm === 'pieces' || pm === 'hours') return pm;
  return 'stitches';
}

function hoursUntilCutoff(dateStr: string): number {
  const cutoff = dayjs(dateStr).add(1, 'day').startOf('day');
  return cutoff.diff(dayjs(), 'hour');
}

function isEditWindowExpiringSoon(dateStr: string): boolean {
  const hrs = hoursUntilCutoff(dateStr);
  return hrs >= 0 && hrs < 6;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProductionLogDrawerProps {
  open: boolean;
  mode: 'create' | 'edit' | 'view';
  machine: Machine;
  log?: ProductionLog;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductionLogDrawer({
  open,
  mode,
  machine,
  log,
  onClose,
  onSaved,
}: ProductionLogDrawerProps) {
  const t = useTranslations('machines-production');
  const { currentWorkspaceId } = useWorkspaceStore();
  const [form] = Form.useForm();
  const [msgApi, ctx] = message.useMessage();

  const wsId = currentWorkspaceId ?? '';
  const machineId = machine._id ?? machine.id ?? '';

  const primaryMetric = resolvePrimaryMetric(machine);

  // State
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [nextCode, setNextCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [notesLength, setNotesLength] = useState(0);
  const [chosenDate, setChosenDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  // Fetch code peek on drawer open (create mode only)
  useEffect(() => {
    if (!open) return;

    if (mode === 'create' && wsId) {
      startTransition(() => {
        setCodeLoading(true);
      });
      peekNextProductionLogCode(wsId)
        .then((res) => setNextCode(res.nextCode))
        .catch(() => setNextCode(null))
        .finally(() => setCodeLoading(false));
    }

    if (mode === 'create') {
      form.resetFields();
      form.setFieldsValue({ date: dayjs() });
      startTransition(() => {
        setChosenDate(dayjs().format('YYYY-MM-DD'));
        setNotesLength(0);
      });
    }

    if ((mode === 'edit' || mode === 'view') && log) {
      const dateVal = dayjs(log.date);
      form.setFieldsValue({
        date: dateVal,
        teamMemberId: log.teamMemberId,
        shiftId: log.shiftId ?? undefined,
        stitchCount: log.stitchCount ?? undefined,
        pieceCount: log.pieceCount ?? undefined,
        hoursLogged: log.hoursLogged ?? undefined,
        notes: log.notes ?? '',
      });
      startTransition(() => {
        setChosenDate(log.date);
        setNotesLength(log.notes?.length ?? 0);
      });
    }
  }, [open, mode, log, form, wsId]);

  const isReadOnly = mode === 'view';

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------

  const onSubmit = async () => {
    try {
      const vals = await form.validateFields();
      const dateStr = vals.date ? dayjs(vals.date).format('YYYY-MM-DD') : chosenDate;
      setSubmitting(true);

      if (mode === 'create') {
        const payload: CreateProductionLogPayload = {
          teamMemberId: vals.teamMemberId,
          shiftId: vals.shiftId ?? undefined,
          date: dateStr,
          stitchCount: vals.stitchCount ?? undefined,
          pieceCount: vals.pieceCount ?? undefined,
          hoursLogged: vals.hoursLogged ?? undefined,
          notes: vals.notes ?? undefined,
        };

        try {
          const created = await createProductionLog(wsId, machineId, payload);
          msgApi.success(t('drawer.toast.created', { logCode: created.logCode }));
          onSaved();
        } catch (e: unknown) {
          handleBackendError(e);
        }
      } else if (mode === 'edit' && log) {
        const payload: UpdateProductionLogPayload = {
          stitchCount: vals.stitchCount ?? undefined,
          pieceCount: vals.pieceCount ?? undefined,
          hoursLogged: vals.hoursLogged ?? undefined,
          notes: vals.notes ?? undefined,
        };

        try {
          const updated = await updateProductionLog(wsId, machineId, log._id, payload);
          msgApi.success(t('drawer.toast.updated', { logCode: updated.logCode }));
          onSaved();
        } catch (e: unknown) {
          handleBackendError(e);
        }
      }
    } catch {
      // Validation error - form shows inline messages
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------

  const onDelete = async () => {
    if (!log) return;
    setDeleting(true);
    try {
      const result = await deleteProductionLog(wsId, machineId, log._id);
      msgApi.success(t('drawer.toast.deleted', { logCode: result.logCode }));
      onSaved();
    } catch (e: unknown) {
      handleBackendError(e);
    } finally {
      setDeleting(false);
    }
  };

  // ------------------------------------------------------------------
  // Error handling
  // ------------------------------------------------------------------

  const handleBackendError = (e: unknown) => {
    const err = e as {
      message?: string;
      code?: string;
      response?: { data?: { error?: { code?: string; message?: string } } };
    };
    const code = err?.code ?? err?.response?.data?.error?.code;
    if (code && ERROR_CODE_MAP[code]) {
      const i18nKey = ERROR_CODE_MAP[code];
      const metric = primaryMetric;
      const monthYear = dayjs(chosenDate).format('MMM YYYY');
      // Map key to translation call
      const msgText = (() => {
        if (i18nKey === 'errors.primaryMetricRequired')
          return t('errors.primaryMetricRequired', { metric });
        if (i18nKey === 'errors.payrollLocked') return t('errors.payrollLocked', { monthYear });
        return t(i18nKey as Parameters<typeof t>[0]);
      })();
      // Pin inline error to the field corresponding to this machine's primary
      // metric, otherwise the error appears under a hidden field (WR-04).
      const fieldName =
        primaryMetric === 'hours'
          ? 'hoursLogged'
          : primaryMetric === 'pieces'
            ? 'pieceCount'
            : 'stitchCount';
      form.setFields([{ name: fieldName, errors: [msgText] }]);
      msgApi.error(msgText);
    } else {
      msgApi.error(err?.message ?? t('drawer.error.generic'));
    }
  };

  // ------------------------------------------------------------------
  // Drawer title + subtitle
  // ------------------------------------------------------------------

  const title = mode === 'create' ? t('drawer.createTitle') : t('drawer.editTitle');

  const subtitle =
    mode === 'create' && nextCode
      ? t('drawer.codePeek', { nextCode })
      : mode === 'create' && codeLoading
        ? 'Loading code...'
        : undefined;

  // ------------------------------------------------------------------
  // Footer
  // ------------------------------------------------------------------

  const footer = (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
    >
      <div>
        {mode === 'edit' && log && (
          <Popconfirm
            title={t('drawer.delete.confirmTitle')}
            description={t('drawer.delete.confirmBody', {
              logCode: log.logCode,
              // teamMemberId may be populated to { name, employeeCode } by the
              // list endpoint; fall back to raw id when not populated (WR-03).
              operatorName: (() => {
                const v = log.teamMemberId as unknown;
                if (v && typeof v === 'object') {
                  const o = v as { name?: string; _id?: string };
                  return o.name ?? o._id ?? '';
                }
                return typeof v === 'string' ? v : '';
              })(),
              date: dayjs(log.date).format('DD MMM YYYY'),
            })}
            onConfirm={onDelete}
            okText={t('drawer.delete.confirmCta')}
            cancelText={t('drawer.delete.cancel')}
            okButtonProps={{ danger: true, loading: deleting }}
          >
            <DsButton
              dsVariant="ghost"
              icon={<DeleteOutlined />}
              style={{ color: 'var(--cr-error, var(--cr-danger-700))' }}
            >
              {t('drawer.actions.delete')}
            </DsButton>
          </Popconfirm>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <DsButton dsVariant="ghost" onClick={onClose}>
          {isReadOnly ? 'Close' : t('drawer.actions.cancel')}
        </DsButton>
        {!isReadOnly && (
          <DsButton dsVariant="primary" loading={submitting} onClick={onSubmit}>
            {mode === 'create' ? t('drawer.actions.create') : t('drawer.actions.update')}
          </DsButton>
        )}
      </div>
    </div>
  );

  // ------------------------------------------------------------------
  // Primary metric field
  // ------------------------------------------------------------------

  const primaryMetricField = () => {
    const metricLabel =
      primaryMetric === 'hours'
        ? t('tab.metric.hours')
        : primaryMetric === 'pieces'
          ? t('tab.metric.pieces')
          : t('tab.metric.stitches');

    const suffix =
      primaryMetric === 'hours'
        ? t('drawer.fields.hoursSuffix')
        : primaryMetric === 'pieces'
          ? t('drawer.fields.piecesSuffix')
          : t('drawer.fields.stitchesSuffix');

    const commonProps = {
      disabled: isReadOnly,
      style: { width: '100%' },
      addonAfter: suffix,
    };

    if (primaryMetric === 'hours') {
      return (
        <Form.Item
          name="hoursLogged"
          label={metricLabel}
          rules={[
            {
              required: true,
              message: t('drawer.fields.primaryMetricRequired', { metric: metricLabel }),
            },
          ]}
          extra={
            isReadOnly
              ? undefined
              : t('drawer.fields.primaryMetricRequired', { metric: metricLabel })
          }
        >
          <InputNumber step={0.25} min={0} max={24} precision={2} {...commonProps} />
        </Form.Item>
      );
    }

    if (primaryMetric === 'pieces') {
      return (
        <Form.Item
          name="pieceCount"
          label={metricLabel}
          rules={[
            {
              required: true,
              message: t('drawer.fields.primaryMetricRequired', { metric: metricLabel }),
            },
          ]}
        >
          <InputNumber step={1} min={0} max={1_000_000} precision={0} {...commonProps} />
        </Form.Item>
      );
    }

    // stitches (default)
    return (
      <Form.Item
        name="stitchCount"
        label={metricLabel}
        rules={[
          {
            required: true,
            message: t('drawer.fields.primaryMetricRequired', { metric: metricLabel }),
          },
        ]}
      >
        <InputNumber step={1} min={0} max={10_000_000} precision={0} {...commonProps} />
      </Form.Item>
    );
  };

  // ------------------------------------------------------------------
  // Secondary metrics
  // ------------------------------------------------------------------

  const secondaryMetricFields = () => {
    const fields: React.ReactNode[] = [];

    if (primaryMetric !== 'stitches') {
      fields.push(
        <Form.Item key="stitches" name="stitchCount" label={t('tab.metric.stitches')}>
          <InputNumber
            step={1}
            min={0}
            max={10_000_000}
            precision={0}
            disabled={isReadOnly}
            style={{ width: '100%' }}
            addonAfter={t('drawer.fields.stitchesSuffix')}
          />
        </Form.Item>,
      );
    }

    if (primaryMetric !== 'pieces') {
      fields.push(
        <Form.Item key="pieces" name="pieceCount" label={t('tab.metric.pieces')}>
          <InputNumber
            step={1}
            min={0}
            max={1_000_000}
            precision={0}
            disabled={isReadOnly}
            style={{ width: '100%' }}
            addonAfter={t('drawer.fields.piecesSuffix')}
          />
        </Form.Item>,
      );
    }

    if (primaryMetric !== 'hours') {
      fields.push(
        <Form.Item key="hours" name="hoursLogged" label={t('tab.metric.hours')}>
          <InputNumber
            step={0.25}
            min={0}
            max={24}
            precision={2}
            disabled={isReadOnly}
            style={{ width: '100%' }}
            addonAfter={t('drawer.fields.hoursSuffix')}
          />
        </Form.Item>,
      );
    }

    return fields;
  };

  // ------------------------------------------------------------------
  // Read-only banner
  // ------------------------------------------------------------------

  const readOnlyBanner = isReadOnly ? (
    <Alert
      type="info"
      showIcon
      title="This log is outside the edit window or payroll-locked. It is read-only."
      style={{ marginBottom: 16 }}
    />
  ) : null;

  // ------------------------------------------------------------------
  // Expiring soon banner (edit mode)
  // ------------------------------------------------------------------

  const expiringSoonBanner =
    !isReadOnly && mode !== 'create' && log && isEditWindowExpiringSoon(log.date) ? (
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        title={t('tab.editClosesSoon', { hours: hoursUntilCutoff(log.date) })}
        style={{ marginBottom: 16 }}
      />
    ) : null;

  return (
    <>
      {ctx}
      <Drawer
        open={open}
        onClose={onClose}
        placement="right"
        title={
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
            {subtitle && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--cr-text-2, var(--cr-text-4))',
                  fontWeight: 400,
                  marginTop: 2,
                }}
              >
                {codeLoading ? (
                  <Skeleton.Input size="small" style={{ width: 140 }} active />
                ) : (
                  subtitle
                )}
              </div>
            )}
          </div>
        }
        footer={footer}
        styles={{
          wrapper: { width: 480 },
          body: { padding: 24 },
          footer: { padding: '12px 24px' },
        }}
        destroyOnHidden
      >
        {readOnlyBanner}
        {expiringSoonBanner}

        <Form form={form} layout="vertical" disabled={isReadOnly}>
          {/* Date */}
          <Form.Item
            name="date"
            label={t('drawer.fields.date')}
            rules={[{ required: true, message: t('errors.invalidDate') }]}
            extra={!isReadOnly && !log ? t('drawer.fields.dateHint') : undefined}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabled={isReadOnly || mode === 'edit'}
              onChange={(d) => {
                if (d) setChosenDate(d.format('YYYY-MM-DD'));
              }}
            />
          </Form.Item>

          {/* Operator */}
          <Form.Item
            name="teamMemberId"
            label={t('drawer.fields.operator')}
            rules={[{ required: true, message: t('errors.assignmentMissing') }]}
          >
            <DsSelect
              placeholder={t('drawer.fields.operatorPlaceholder')}
              disabled={isReadOnly || mode === 'edit'}
            >
              {/* Operator options would be loaded from assignments for this machine+date */}
              {log?.teamMemberId && (
                <DsOption value={log.teamMemberId}>{log.teamMemberId}</DsOption>
              )}
            </DsSelect>
          </Form.Item>

          {/* Shift */}
          <Form.Item name="shiftId" label={t('drawer.fields.shift')}>
            <DsSelect
              placeholder={t('drawer.fields.shiftPlaceholder')}
              allowClear
              disabled={isReadOnly || mode === 'edit'}
            >
              <DsOption value="">{t('drawer.fields.shiftNone')}</DsOption>
              {log?.shiftId && <DsOption value={log.shiftId}>{log.shiftId}</DsOption>}
            </DsSelect>
          </Form.Item>

          {/* Primary metric */}
          {primaryMetricField()}

          {/* Secondary metrics (collapsible) */}
          <Collapse
            ghost
            style={{ marginBottom: 16 }}
            items={[
              {
                key: 'secondary',
                label: (
                  <span style={{ fontSize: 13, color: 'var(--cr-text-2, var(--cr-text-4))' }}>
                    {t('drawer.fields.secondaryGroupLabel')}
                  </span>
                ),
                children: (
                  <>
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--cr-text-3, var(--cr-text-5))',
                        marginBottom: 12,
                        marginTop: 0,
                      }}
                    >
                      {t('drawer.fields.secondaryGroupHint')}
                    </p>
                    {secondaryMetricFields()}
                  </>
                ),
              },
            ]}
          />

          {/* Notes */}
          <Form.Item
            name="notes"
            label={t('drawer.fields.notes')}
            extra={
              <span style={{ fontSize: 12, color: 'var(--cr-text-3, var(--cr-text-5))' }}>
                {t('drawer.fields.notesMaxLength', { used: notesLength })}
              </span>
            }
          >
            <Input.TextArea
              placeholder={t('drawer.fields.notesPlaceholder')}
              maxLength={500}
              rows={3}
              disabled={isReadOnly}
              onChange={(e) => setNotesLength(e.target.value.length)}
              showCount={false}
            />
          </Form.Item>

          {/* Log code (edit/view only - read-only display) */}
          {log?.logCode && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--cr-text-2, var(--cr-text-4))',
                  marginBottom: 4,
                }}
              >
                {t('tab.col.code')}
              </div>
              <Tag style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{log.logCode}</Tag>
            </div>
          )}
        </Form>
      </Drawer>
    </>
  );
}
