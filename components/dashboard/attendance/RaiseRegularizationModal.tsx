'use client';
import { useState } from 'react';
import { App, Form, Select, TimePicker, Input, Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui/DsModal';
import { useWorkspaceStore } from '@/lib/store';
import {
  regularizationApi,
  getRegularizationErrorMessage,
} from '@/lib/api/modules/regularization.api';
import type { RegularizationReasonCategory, RequestedAttendanceStatus } from '@/types';

/** Worked-minutes -> compact "8h 15m" / "8h" / "45m". */
const fmtHm = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/** Correction reason categories (value + i18n key under the `attendance` namespace). */
const REASON_CATEGORIES: { value: RegularizationReasonCategory; labelKey: string }[] = [
  { value: 'MISSING_CHECK_IN', labelKey: 'raiseRegularization.reasonCatMissingCheckIn' },
  { value: 'MISSING_CHECK_OUT', labelKey: 'raiseRegularization.reasonCatMissingCheckOut' },
  { value: 'WRONG_TIME', labelKey: 'raiseRegularization.reasonCatWrongTime' },
  { value: 'FORGOT_PUNCH', labelKey: 'raiseRegularization.reasonCatForgotPunch' },
  { value: 'OFF_SITE', labelKey: 'raiseRegularization.reasonCatOffSite' },
  { value: 'OTHER', labelKey: 'raiseRegularization.reasonCatOther' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RaiseRegularizationModalProps {
  open: boolean;
  memberId: string;
  memberName: string;
  date: string; // ISO YYYY-MM-DD - pre-filled
  currentStatus: string;
  /** Recorded check-in / check-out for the day - shown read-only and prefilled
   *  into the requested-time pickers so the member corrects from real values. */
  originalCheckIn?: string | null;
  originalCheckOut?: string | null;
  originalWorkedMinutes?: number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── Form values ───────────────────────────────────────────────────────────────

interface FormValues {
  requestedStatus: RequestedAttendanceStatus;
  reasonCategory: RegularizationReasonCategory;
  requestedCheckIn?: dayjs.Dayjs;
  requestedCheckOut?: dayjs.Dayjs;
  reason: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RaiseRegularizationModal({
  open,
  memberId,
  memberName,
  date,
  currentStatus,
  originalCheckIn,
  originalCheckOut,
  originalWorkedMinutes,
  onClose,
  onSuccess,
}: RaiseRegularizationModalProps) {
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const t = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const { message: msgApi } = App.useApp();
  const requestedStatus = Form.useWatch('requestedStatus', form);
  const showTimes = requestedStatus === 'PRESENT' || requestedStatus === 'HALF_DAY';
  const originalIn = originalCheckIn ? dayjs(originalCheckIn) : undefined;
  const originalOut = originalCheckOut ? dayjs(originalCheckOut) : undefined;
  const hasOriginal = !!(originalCheckIn || originalCheckOut || (originalWorkedMinutes ?? 0) > 0);

  const handleSubmit = async () => {
    if (!wsId) return;
    setSubmitting(true);
    try {
      const values = await form.validateFields();

      // Build ISO datetimes from date + time picker values
      const requestedCheckIn = values.requestedCheckIn
        ? dayjs(date)
            .hour(values.requestedCheckIn.hour())
            .minute(values.requestedCheckIn.minute())
            .second(0)
            .toISOString()
        : undefined;
      const requestedCheckOut = values.requestedCheckOut
        ? dayjs(date)
            .hour(values.requestedCheckOut.hour())
            .minute(values.requestedCheckOut.minute())
            .second(0)
            .toISOString()
        : undefined;

      await regularizationApi.create(wsId, {
        memberId,
        date,
        requestedStatus: values.requestedStatus,
        reasonCategory: values.reasonCategory,
        requestedCheckIn,
        requestedCheckOut,
        reason: values.reason,
      });

      void msgApi.success(t('raiseRegularization.toast.success'));
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      // Ant Design form validation errors have no response property
      const anyErr = err as { response?: unknown };
      if (anyErr?.response !== undefined) {
        void msgApi.error(getRegularizationErrorMessage(err));
      }
      // Otherwise it's a form validation error - Ant Design handles display
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DsModal
      open={open}
      title={t('raiseRegularization.title')}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      width={520}
      footer={[
        <Button
          key="cancel"
          onClick={() => {
            form.resetFields();
            onClose();
          }}
        >
          {tCommon('cancel')}
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          {t('raiseRegularization.submit')}
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-2"
        initialValues={{ requestedCheckIn: originalIn, requestedCheckOut: originalOut }}
      >
        {/* Read-only fields */}
        <Form.Item label={t('raiseRegularization.memberLabel')}>
          <Input value={memberName} readOnly disabled />
        </Form.Item>
        <Form.Item label={t('raiseRegularization.dateLabel')}>
          <Input value={dayjs(date).format('DD MMM YYYY')} readOnly disabled />
        </Form.Item>
        <Form.Item label={t('raiseRegularization.currentStatusLabel')}>
          <Input value={currentStatus} readOnly disabled />
        </Form.Item>
        {hasOriginal && (
          <Form.Item label={t('raiseRegularization.originalLabel')}>
            <Input
              value={`${originalCheckIn ? dayjs(originalCheckIn).format('h:mm A') : '--'} – ${
                originalCheckOut ? dayjs(originalCheckOut).format('h:mm A') : '--'
              }${(originalWorkedMinutes ?? 0) > 0 ? ` · ${fmtHm(originalWorkedMinutes ?? 0)}` : ''}`}
              readOnly
              disabled
            />
          </Form.Item>
        )}

        {/* Editable fields */}
        <Form.Item
          name="requestedStatus"
          label={t('raiseRegularization.requestedStatusLabel')}
          rules={[{ required: true, message: t('raiseRegularization.validation.statusRequired') }]}
        >
          <Select placeholder={t('raiseRegularization.statusPlaceholder')}>
            <Select.Option value="PRESENT">{t('present')}</Select.Option>
            <Select.Option value="HALF_DAY">{t('halfDay')}</Select.Option>
            <Select.Option value="LEAVE">{t('leave')}</Select.Option>
            <Select.Option value="ABSENT">{t('absent')}</Select.Option>
          </Select>
        </Form.Item>

        {showTimes && (
          <>
            <Form.Item
              name="requestedCheckIn"
              label={t('raiseRegularization.requestedCheckInLabel')}
            >
              <TimePicker format="HH:mm" className="w-full" />
            </Form.Item>
            <Form.Item
              name="requestedCheckOut"
              label={t('raiseRegularization.requestedCheckOutLabel')}
            >
              <TimePicker format="HH:mm" className="w-full" />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="reasonCategory"
          label={t('raiseRegularization.reasonCategoryLabel')}
          rules={[
            {
              required: true,
              message: t('raiseRegularization.reasonCategoryRequired'),
            },
          ]}
        >
          <Select placeholder={t('raiseRegularization.reasonCategoryPlaceholder')}>
            {REASON_CATEGORIES.map((c) => (
              <Select.Option key={c.value} value={c.value}>
                {t(c.labelKey)}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="reason"
          label={t('raiseRegularization.reasonLabel')}
          rules={[
            { required: true, message: t('raiseRegularization.validation.reasonRequired') },
            { min: 10, message: t('raiseRegularization.validation.reasonMin') },
            { max: 500, message: t('raiseRegularization.validation.reasonMax') },
          ]}
        >
          <Input.TextArea
            rows={4}
            maxLength={500}
            showCount
            placeholder={t('raiseRegularization.reasonPlaceholder')}
          />
        </Form.Item>

        <Form.Item label={t('raiseRegularization.attachmentsLabel')}>
          <Upload beforeUpload={() => false} maxCount={3} listType="text">
            <Button icon={<UploadOutlined />}>{t('raiseRegularization.uploadFile')}</Button>
          </Upload>
        </Form.Item>
      </Form>
    </DsModal>
  );
}
