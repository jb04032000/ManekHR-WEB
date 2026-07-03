'use client';

/**
 * MaintenanceScheduleDrawer - slide-over for create + edit of a maintenance schedule.
 *
 * - Antd Drawer (size large) per plan 24-11 §Task 2.
 * - Cadence interval label switches based on cadenceMode (D-13 §2).
 * - Embeds <ChecklistEditor> (max 50 items per D-01).
 * - Wires to createMaintenanceScheduleAction / updateMaintenanceScheduleAction.
 * - All copy via useTranslations('machines-maintenance').schedule.
 */

import { Col, DatePicker, Drawer, Form, Input, InputNumber, Row, Select, message } from 'antd';
import { useTranslations } from 'next-intl';
import { startTransition, useEffect, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';

import { DsButton } from '@/components/ui';
import {
  createMaintenanceScheduleAction,
  updateMaintenanceScheduleAction,
} from '@/lib/actions/machines.actions';
import type {
  CreateMaintenanceSchedulePayload,
  MaintenanceCadenceMode,
  MaintenanceSchedule,
  TeamMember,
  UpdateMaintenanceSchedulePayload,
} from '@/types';
import { ChecklistEditor } from './ChecklistEditor';

interface MaintenanceScheduleDrawerProps {
  open: boolean;
  onClose: () => void;
  wsId: string;
  machineId: string;
  schedule?: MaintenanceSchedule;
  technicians: TeamMember[];
  onSaved: (next: MaintenanceSchedule) => void;
}

interface ScheduleFormValues {
  name: string;
  cadenceMode: MaintenanceCadenceMode;
  cadenceInterval: number;
  technicianId?: string;
  leadTimeDays?: number;
  estimatedDurationMinutes: number;
  anchorDate: Dayjs;
}

function cadenceUnitKey(mode: MaintenanceCadenceMode): string {
  switch (mode) {
    case 'daily':
      return 'schedule.cadenceUnitDays';
    case 'weekly':
      return 'schedule.cadenceUnitWeeks';
    case 'monthly':
      return 'schedule.cadenceUnitMonths';
    case 'hours_based':
      return 'schedule.cadenceUnitHours';
    case 'output_based':
      return 'schedule.cadenceUnitUnits';
    default:
      return 'schedule.cadenceUnitDays';
  }
}

export function MaintenanceScheduleDrawer({
  open,
  onClose,
  wsId,
  machineId,
  schedule,
  technicians,
  onSaved,
}: MaintenanceScheduleDrawerProps) {
  const t = useTranslations('machines-maintenance');
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm<ScheduleFormValues>();
  const [saving, setSaving] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [cadenceMode, setCadenceMode] = useState<MaintenanceCadenceMode>('daily');

  const isEdit = !!schedule;

  useEffect(() => {
    if (!open) return;
    if (schedule) {
      form.setFieldsValue({
        name: schedule.name,
        cadenceMode: schedule.cadenceMode,
        cadenceInterval: schedule.cadenceInterval,
        technicianId: schedule.technicianId ?? undefined,
        leadTimeDays: schedule.leadTimeDays ?? undefined,
        estimatedDurationMinutes: schedule.estimatedDurationMinutes,
        anchorDate: dayjs(schedule.anchorDate),
      });
      startTransition(() => {
        setChecklistItems(schedule.checklistItems ?? []);
        setCadenceMode(schedule.cadenceMode);
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        cadenceMode: 'daily',
        cadenceInterval: 1,
        estimatedDurationMinutes: 60,
        anchorDate: dayjs(),
      });
      startTransition(() => {
        setChecklistItems([]);
        setCadenceMode('daily');
      });
    }
  }, [open, schedule, form]);

  const cadenceModeOptions: { value: MaintenanceCadenceMode; label: string }[] = [
    { value: 'daily', label: t('schedule.cadenceModeOptions.daily') },
    { value: 'weekly', label: t('schedule.cadenceModeOptions.weekly') },
    { value: 'monthly', label: t('schedule.cadenceModeOptions.monthly') },
    { value: 'hours_based', label: t('schedule.cadenceModeOptions.hours_based') },
    { value: 'output_based', label: t('schedule.cadenceModeOptions.output_based') },
  ];

  const cadenceUnitLabel = t(cadenceUnitKey(cadenceMode));

  const onFinish = async (values: ScheduleFormValues) => {
    if (!wsId || !machineId) return;
    setSaving(true);
    try {
      const payload: CreateMaintenanceSchedulePayload = {
        name: values.name.trim(),
        cadenceMode: values.cadenceMode,
        cadenceInterval: values.cadenceInterval,
        technicianId: values.technicianId || undefined,
        checklistItems: checklistItems.map((s) => s.trim()).filter((s) => s.length > 0),
        leadTimeDays:
          values.leadTimeDays === undefined || values.leadTimeDays === null
            ? undefined
            : values.leadTimeDays,
        estimatedDurationMinutes: values.estimatedDurationMinutes,
        anchorDate: values.anchorDate.toISOString(),
      };

      let result: MaintenanceSchedule;
      if (isEdit && schedule) {
        const updatePayload: UpdateMaintenanceSchedulePayload = payload;
        result = await updateMaintenanceScheduleAction(
          wsId,
          machineId,
          schedule._id,
          updatePayload,
        );
      } else {
        result = await createMaintenanceScheduleAction(wsId, machineId, payload);
      }
      msgApi.success(isEdit ? t('schedule.statusActive') : t('schedule.addButton'));
      onSaved(result);
      onClose();
    } catch (e: unknown) {
      const err = e as {
        message?: string;
        response?: { data?: { error?: string; code?: string } };
      };
      const code = err?.response?.data?.error ?? err?.response?.data?.code;
      let msg = err?.message ?? 'Failed to save schedule';
      if (code) {
        try {
          const translated = t(`errors.${code}` as never);
          if (translated && translated !== `errors.${code}`) msg = translated;
        } catch {
          // fall through to default message
        }
      }
      msgApi.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const title = isEdit
    ? `${t('schedule.sectionTitle')} - ${schedule?.scheduleCode ?? ''}`
    : t('schedule.addButton');

  return (
    <>
      {ctx}
      <Drawer
        open={open}
        onClose={onClose}
        title={title}
        size="large"
        destroyOnHidden
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <DsButton dsVariant="ghost" onClick={onClose}>
              Cancel
            </DsButton>
            <DsButton dsVariant="primary" loading={saving} onClick={() => form.submit()}>
              {isEdit ? t('schedule.statusActive') : t('schedule.addButton')}
            </DsButton>
          </div>
        }
      >
        <Form<ScheduleFormValues>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={(changed) => {
            if ('cadenceMode' in changed) {
              setCadenceMode(changed.cadenceMode as MaintenanceCadenceMode);
            }
          }}
        >
          <Form.Item name="name" label={t('schedule.name')} rules={[{ required: true, max: 80 }]}>
            <Input maxLength={80} />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="cadenceMode"
                label={t('schedule.cadenceMode')}
                rules={[{ required: true }]}
              >
                <Select options={cadenceModeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="cadenceInterval"
                label={`${t('schedule.cadenceInterval')} (${cadenceUnitLabel})`}
                rules={[{ required: true, type: 'number', min: 1 }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="technicianId" label={t('schedule.technician')}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={technicians.map((m) => ({
                value: m.id,
                label: `${m.name}${m.employeeCode ? ` (${m.employeeCode})` : ''}`,
              }))}
              placeholder={t('schedule.technician')}
            />
          </Form.Item>

          <Form.Item label={t('schedule.checklist')}>
            <ChecklistEditor value={checklistItems} onChange={setChecklistItems} />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="leadTimeDays"
                label={t('schedule.leadTime')}
                tooltip={t('schedule.leadTimeOverride')}
              >
                <InputNumber min={1} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="estimatedDurationMinutes"
                label={t('schedule.estimatedDuration')}
                rules={[{ required: true, type: 'number', min: 1, max: 1440 }]}
              >
                <InputNumber min={1} max={1440} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="anchorDate"
                label={t('schedule.anchorDate')}
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </>
  );
}

export default MaintenanceScheduleDrawer;
