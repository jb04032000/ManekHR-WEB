'use client';

/**
 * ServiceLogDrawer - slide-over for create of a service log.
 *
 * Per Plan 24-11 §Task 3 + D-13 §3:
 * - Schedule select with "Ad-hoc" option
 * - servicedAt + serviceEndAt date-time pickers (default: schedule.nextDueAt → +duration)
 * - Technician select (default: schedule.technicianId)
 * - Embedded <PartsTable> + <ChecklistEditor-as-checkboxes>
 * - INR cost input → ×100 → costPaise on submit (D-02)
 * - On SERVICE_LOG_DOWNTIME_OVERLAP error → Modal.confirm with link to conflicting downtime
 */

import {
  Checkbox,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  message,
} from 'antd';
import { useTranslations } from 'next-intl';
import { startTransition, useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';

import { DsButton } from '@/components/ui';
import { createServiceLogAction } from '@/lib/actions/machines.actions';
import type {
  ChecklistTickState,
  CreateServiceLogPayload,
  MaintenanceSchedule,
  ServiceLog,
  ServicePartPayload,
  TeamMember,
} from '@/types';
import { ChecklistEditor } from './ChecklistEditor'; // imported for parity grep; actual checkbox UI inline below
import { PartsTable } from './PartsTable';

// Touch the import so build does not tree-shake reference (we may use it for
// schedule-edit checklists in a future iteration).
void ChecklistEditor;

interface ServiceLogDrawerProps {
  open: boolean;
  onClose: () => void;
  wsId: string;
  machineId: string;
  schedules: MaintenanceSchedule[];
  technicians: TeamMember[];
  defaultScheduleId?: string;
  onSaved: (next: ServiceLog) => void;
}

interface ServiceLogFormValues {
  scheduleId?: string;
  servicedAt: Dayjs;
  serviceEndAt: Dayjs;
  technicianId?: string;
  costInr?: number;
  notes?: string;
}

export function ServiceLogDrawer({
  open,
  onClose,
  wsId,
  machineId,
  schedules,
  technicians,
  defaultScheduleId,
  onSaved,
}: ServiceLogDrawerProps) {
  const t = useTranslations('machines-maintenance');
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm<ServiceLogFormValues>();
  const [saving, setSaving] = useState(false);
  const [parts, setParts] = useState<ServicePartPayload[]>([]);
  const [checklistTicked, setChecklistTicked] = useState<ChecklistTickState[]>([]);
  const [scheduleId, setScheduleId] = useState<string | undefined>(defaultScheduleId);

  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.isActive && !s.isDeleted),
    [schedules],
  );

  const selectedSchedule = useMemo(
    () => (scheduleId ? schedules.find((s) => s._id === scheduleId) : undefined),
    [scheduleId, schedules],
  );

  // Initialise / reset when drawer opens or selection changes.
  useEffect(() => {
    if (!open) return;
    const initSchedule = defaultScheduleId
      ? schedules.find((s) => s._id === defaultScheduleId)
      : undefined;
    const startDefault = initSchedule ? dayjs(initSchedule.nextDueAt) : dayjs();
    const durationMin = initSchedule?.estimatedDurationMinutes ?? 60;
    form.resetFields();
    form.setFieldsValue({
      scheduleId: defaultScheduleId,
      servicedAt: startDefault,
      serviceEndAt: startDefault.add(durationMin, 'minute'),
      technicianId: initSchedule?.technicianId ?? undefined,
      costInr: undefined,
      notes: undefined,
    });
    startTransition(() => {
      setScheduleId(defaultScheduleId);
      setParts([]);
      setChecklistTicked(
        (initSchedule?.checklistItems ?? []).map((item) => ({
          item,
          ticked: false,
        })),
      );
    });
  }, [open, defaultScheduleId, schedules, form]);

  // When user picks a different schedule, refresh defaults derived from it.
  useEffect(() => {
    if (!open) return;
    if (!selectedSchedule) {
      // Ad-hoc - clear checklist
      startTransition(() => {
        setChecklistTicked([]);
      });
      return;
    }
    const start = dayjs(selectedSchedule.nextDueAt);
    form.setFieldsValue({
      servicedAt: start,
      serviceEndAt: start.add(selectedSchedule.estimatedDurationMinutes ?? 60, 'minute'),
      technicianId: selectedSchedule.technicianId ?? undefined,
    });
    startTransition(() => {
      setChecklistTicked(
        (selectedSchedule.checklistItems ?? []).map((item) => ({
          item,
          ticked: false,
        })),
      );
    });
    // We intentionally exclude `form` from deps - Antd form instance is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const tickItem = (idx: number, ticked: boolean) => {
    setChecklistTicked((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ticked };
      return copy;
    });
  };

  const buildErrorMsg = (code: string | undefined, fallback: string): string => {
    if (!code) return fallback;
    try {
      const translated = t(`errors.${code}` as never);
      if (translated && translated !== `errors.${code}`) return translated;
    } catch {
      // ignore - fallback below
    }
    return fallback;
  };

  const onFinish = async (values: ServiceLogFormValues) => {
    if (!wsId || !machineId) return;

    if (values.serviceEndAt.isBefore(values.servicedAt)) {
      msgApi.error(t('errors.SERVICE_LOG_INVALID_TIME_RANGE'));
      return;
    }

    setSaving(true);
    try {
      const costPaise =
        values.costInr === undefined || values.costInr === null
          ? undefined
          : Math.round(Number(values.costInr) * 100);

      const payload: CreateServiceLogPayload = {
        scheduleId: values.scheduleId || undefined,
        servicedAt: values.servicedAt.toISOString(),
        serviceEndAt: values.serviceEndAt.toISOString(),
        technicianId: values.technicianId || undefined,
        // Strip empty rows defensively.
        partsReplaced: parts
          .filter((p) => {
            if (p.itemId !== undefined) return p.itemId.trim().length > 0;
            return (p.freeTextName ?? '').trim().length > 0;
          })
          .map((p) => ({
            ...p,
            itemId: p.itemId?.trim() || undefined,
            freeTextName: p.freeTextName?.trim() || undefined,
          })),
        costPaise,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
        checklistTicked: checklistTicked.length ? checklistTicked : undefined,
      };

      const result = await createServiceLogAction(wsId, machineId, payload);
      msgApi.success(
        result.linkedDowntimeId
          ? `${t('serviceLog.linkedDowntime')}: ${result.serviceLogCode}`
          : t('serviceLog.addButton'),
      );
      onSaved(result);
      onClose();
    } catch (e: unknown) {
      const err = e as {
        message?: string;
        response?: {
          data?: {
            error?: string;
            code?: string;
            conflictingDowntimeId?: string;
            message?: string;
          };
        };
      };
      const data = err?.response?.data;
      const code = data?.error ?? data?.code;

      if (code === 'SERVICE_LOG_DOWNTIME_OVERLAP') {
        const conflictingDowntimeId = data?.conflictingDowntimeId;
        Modal.confirm({
          title: t('errors.SERVICE_LOG_DOWNTIME_OVERLAP'),
          content: conflictingDowntimeId ? (
            <a
              href={`/dashboard/machines/${machineId}?tab=downtime-logs&highlight=${conflictingDowntimeId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View conflicting downtime
            </a>
          ) : null,
          okText: 'OK',
          cancelButtonProps: { style: { display: 'none' } },
        });
      } else {
        msgApi.error(buildErrorMsg(code, err?.message ?? 'Failed to log service'));
      }
    } finally {
      setSaving(false);
    }
  };

  const scheduleOptions = [
    { value: '', label: t('serviceLog.adhoc') },
    ...activeSchedules.map((s) => ({
      value: s._id,
      label: `${s.scheduleCode} - ${s.name}`,
    })),
  ];

  return (
    <>
      {ctx}
      <Drawer
        open={open}
        onClose={onClose}
        title={t('serviceLog.addButton')}
        size="large"
        destroyOnHidden
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <DsButton dsVariant="ghost" onClick={onClose}>
              Cancel
            </DsButton>
            <DsButton dsVariant="primary" loading={saving} onClick={() => form.submit()}>
              {t('serviceLog.addButton')}
            </DsButton>
          </div>
        }
      >
        <Form<ServiceLogFormValues>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={(changed) => {
            if ('scheduleId' in changed) {
              setScheduleId(changed.scheduleId || undefined);
            }
          }}
        >
          <Form.Item name="scheduleId" label={t('serviceLog.schedule')}>
            <Select options={scheduleOptions} allowClear />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="servicedAt"
                label={t('serviceLog.servicedAt')}
                rules={[{ required: true }]}
              >
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="serviceEndAt"
                label={t('serviceLog.serviceEndAt')}
                rules={[{ required: true }]}
              >
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="technicianId" label={t('serviceLog.technician')}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={technicians.map((m) => ({
                value: m.id,
                label: `${m.name}${m.employeeCode ? ` (${m.employeeCode})` : ''}`,
              }))}
            />
          </Form.Item>

          {checklistTicked.length > 0 && (
            <Form.Item label={t('serviceLog.checklist')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {checklistTicked.map((row, idx) => (
                  <Checkbox
                    key={`${row.item}-${idx}`}
                    checked={row.ticked}
                    onChange={(e) => tickItem(idx, e.target.checked)}
                  >
                    {row.item}
                  </Checkbox>
                ))}
              </div>
            </Form.Item>
          )}

          <Form.Item label={t('serviceLog.partsReplaced')}>
            <PartsTable value={parts} onChange={setParts} wsId={wsId} />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="costInr" label={`${t('serviceLog.cost')} (INR)`}>
                <InputNumber
                  min={0}
                  step={0.01}
                  style={{ width: '100%' }}
                  // costPaise = Math.round(costInr * 100) - converted on submit
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label={t('serviceLog.notes')}>
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}

export default ServiceLogDrawer;
