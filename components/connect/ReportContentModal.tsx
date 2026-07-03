'use client';

import { useState } from 'react';
import { App as AntApp, Button, Form, Modal, Select, Input } from 'antd';
import { FlagOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
  submitContentReport,
  type ContentReportReason,
  type ContentReportTargetType,
} from '@/lib/actions/content-reports.actions';

/**
 * ReportContentModal - the shared "Report" flow for public Connect UGC (post,
 * comment, profile, listing). Any signed-in member can flag content; the report
 * lands in the admin moderation queue (app/admin/connect/moderation). Captures a
 * `snapshot` + `targetUrl` so the queue keeps evidence + a deep link even after a
 * delete.
 *
 * Two ways to use it:
 *   - <ReportButton .../>          self-managed trigger (profile / listing pages).
 *   - <ReportContentModal open .../> controlled, for an existing overflow menu
 *     (e.g. PostCard's Dropdown adds a "Report" item that opens this).
 *
 * Links: submitContentReport -> content-reports.controller; copy under
 * connect.report.* (4 locales). Keep reasons in sync with the BE enum
 * (content-reports.constants).
 */

export interface ReportTarget {
  targetType: ContentReportTargetType;
  targetId: string;
  targetOwnerUserId?: string;
  /** Short text snapshot of the reported content (evidence in the queue). */
  snapshot?: string;
  /** Deep-link path to the live content, for one-click review in the queue. */
  targetUrl?: string;
}

const REASONS: ContentReportReason[] = [
  'spam',
  'harassment',
  'hate',
  'adult',
  'scam',
  'misinformation',
  'other',
];

interface FormValues {
  reason: ContentReportReason;
  detail?: string;
}

export function ReportContentModal({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: ReportTarget;
}) {
  const t = useTranslations('connect.report');
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (vals: FormValues) => {
    setSubmitting(true);
    try {
      const res = await submitContentReport({
        targetType: target.targetType,
        targetId: target.targetId,
        targetOwnerUserId: target.targetOwnerUserId,
        snapshot: target.snapshot,
        targetUrl: target.targetUrl,
        reason: vals.reason,
        detail: vals.detail,
      });
      if (res.ok) {
        message.success(t('success'));
        onClose();
      } else {
        message.error(res.error || t('error'));
      }
    } catch {
      message.error(t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('title')}
      okText={t('submit')}
      cancelText={t('cancel')}
      confirmLoading={submitting}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        className="mt-2"
      >
        <Form.Item
          name="reason"
          label={t('reasonLabel')}
          rules={[{ required: true, message: t('reasonRequired') }]}
        >
          <Select
            size="large"
            placeholder={t('reasonPlaceholder')}
            options={REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))}
          />
        </Form.Item>
        <Form.Item name="detail" label={t('detailLabel')}>
          <Input.TextArea
            rows={4}
            maxLength={1000}
            showCount
            placeholder={t('detailPlaceholder')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** Self-managed "Report" trigger + modal, for pages without an existing menu. */
export function ReportButton({
  target,
  size = 'small',
}: {
  target: ReportTarget;
  size?: 'small' | 'middle' | 'large';
}) {
  const t = useTranslations('connect.report');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="text" size={size} icon={<FlagOutlined />} onClick={() => setOpen(true)}>
        {t('action')}
      </Button>
      <ReportContentModal open={open} onClose={() => setOpen(false)} target={target} />
    </>
  );
}
