'use client';

/**
 * DowntimeDrawer - slide-over for create + edit of a downtime entry.
 *
 * - Reason picker is grouped by category via ReasonPickerSelect (Task 1).
 * - End time is optional; omitting it stores an open downtime that the
 *   operator closes from the banner once the machine resumes.
 * - Backend errors (DOWNTIME_OVERLAP, DOWNTIME_EDIT_WINDOW_EXPIRED,
 *   DOWNTIME_PAYROLL_LOCKED) surface as toasts via the run() helper in
 *   server actions which extracts the translated message string.
 */

import { Col, DatePicker, Drawer, Form, Input, Row, message } from 'antd';
import { useTranslations } from 'next-intl';
import { startTransition, useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';

import { DsButton } from '@/components/ui';
import { createDowntime, updateDowntime } from '@/lib/actions/machines.actions';
import type { DowntimeEntry, WorkspaceDowntimeReasonConfig } from '@/types';
import ReasonPickerSelect from './ReasonPickerSelect';

type DrawerMode = 'create' | 'edit';

interface DowntimeDrawerProps {
  open: boolean;
  mode: DrawerMode;
  wsId: string;
  machineId: string;
  entry?: DowntimeEntry;
  catalogue: WorkspaceDowntimeReasonConfig;
  nextCodePeek?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface DowntimeFormValues {
  reasonCodeId: string;
  startAt: Dayjs;
  endAt?: Dayjs | null;
  notes?: string;
}

export function DowntimeDrawer({
  open,
  mode,
  wsId,
  machineId,
  entry,
  catalogue,
  nextCodePeek,
  onClose,
  onSaved,
}: DowntimeDrawerProps) {
  const t = useTranslations('machines-downtime');
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm<DowntimeFormValues>();
  const [saving, setSaving] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState<string | undefined>(entry?.reasonCodeId);

  // Reset / pre-populate the form when the drawer is (re)opened.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && entry) {
      form.setFieldsValue({
        reasonCodeId: entry.reasonCodeId,
        startAt: dayjs(entry.startAt),
        endAt: entry.endAt ? dayjs(entry.endAt) : null,
        notes: entry.notes ?? '',
      });
      startTransition(() => {
        setSelectedReasonId(entry.reasonCodeId);
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        startAt: dayjs(),
      });
      startTransition(() => {
        setSelectedReasonId(undefined);
      });
    }
  }, [open, mode, entry, form]);

  const selectedCategory = useMemo(() => {
    if (!selectedReasonId) return null;
    const code = catalogue?.codes?.find((c) => c._id === selectedReasonId);
    return code?.category ?? null;
  }, [selectedReasonId, catalogue]);

  const onFinish = async (values: DowntimeFormValues) => {
    if (!wsId || !machineId) return;
    setSaving(true);
    try {
      const payload = {
        reasonCodeId: values.reasonCodeId,
        startAt: values.startAt.toISOString(),
        endAt: values.endAt ? values.endAt.toISOString() : undefined,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
      };

      if (mode === 'edit' && entry) {
        await updateDowntime(wsId, machineId, entry._id, {
          reasonCodeId: payload.reasonCodeId,
          startAt: payload.startAt,
          endAt: values.endAt ? values.endAt.toISOString() : null,
          notes: payload.notes,
        });
      } else {
        await createDowntime(wsId, machineId, payload);
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const err = e as { message?: string };
      msgApi.error(err?.message ?? 'Failed to save downtime');
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'edit' ? t('drawer.editTitle') : t('drawer.createTitle');
  const submitLabel = mode === 'edit' ? t('drawer.actions.update') : t('drawer.actions.create');

  return (
    <>
      {ctx}
      <Drawer
        open={open}
        onClose={onClose}
        title={title}
        styles={{ wrapper: { width: 520 } }}
        destroyOnHidden
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <DsButton dsVariant="ghost" onClick={onClose}>
              {t('drawer.actions.cancel')}
            </DsButton>
            <DsButton dsVariant="primary" loading={saving} onClick={() => form.submit()}>
              {submitLabel}
            </DsButton>
          </div>
        }
      >
        <Form<DowntimeFormValues>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={(changed) => {
            if ('reasonCodeId' in changed) {
              setSelectedReasonId(changed.reasonCodeId);
            }
          }}
        >
          <Form.Item
            name="reasonCodeId"
            label={t('drawer.fields.reason')}
            rules={[{ required: true }]}
          >
            <ReasonPickerSelect catalogue={catalogue} />
          </Form.Item>

          {selectedCategory && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--cr-text-2, var(--cr-text-4))',
                marginTop: -8,
                marginBottom: 16,
              }}
            >
              {selectedCategory === 'mechanical'
                ? t('drawer.categoryHint.mechanical')
                : t('drawer.categoryHint.operational')}
            </div>
          )}

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="startAt"
                label={t('drawer.fields.startAt')}
                rules={[{ required: true }]}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="endAt"
                label={t('drawer.fields.endAt')}
                extra={t('drawer.fields.endHint')}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  allowClear
                  style={{ width: '100%' }}
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label={t('drawer.fields.notes')}>
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>

          {mode === 'create' && nextCodePeek && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--cr-text-3, var(--cr-text-5))',
                marginTop: 4,
              }}
            >
              {t('drawer.codePeek', { nextCode: nextCodePeek })}
            </div>
          )}
        </Form>
      </Drawer>
    </>
  );
}

export default DowntimeDrawer;
