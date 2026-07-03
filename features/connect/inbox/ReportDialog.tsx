'use client';

/**
 * ReportDialog -- report a conversation for moderation (Phase 7, I3b). A small
 * presentational dialog (reason radio + optional detail) over the AntD modal;
 * the report action + result toast live in the parent so this stays reusable.
 * The report lands in the I5 admin moderation queue.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input, Modal, Radio } from 'antd';
import { INBOX_REPORT_REASONS, type InboxReportReason } from './inbox.types';

interface ReportDialogProps {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (reason: InboxReportReason, detail: string) => void;
}

export default function ReportDialog({ open, submitting, onClose, onSubmit }: ReportDialogProps) {
  const t = useTranslations('connect.inbox');
  const [reason, setReason] = useState<InboxReportReason>('spam');
  const [detail, setDetail] = useState('');

  return (
    <Modal
      open={open}
      title={t('report.title')}
      okText={t('report.submit')}
      cancelText={t('report.cancel')}
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => onSubmit(reason, detail.trim())}
      destroyOnHidden
    >
      <p style={{ marginTop: 0, fontSize: 13, color: 'var(--cr-text-3)' }}>{t('report.body')}</p>
      <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-text-2)', marginBottom: 8 }}
        >
          {t('report.reasonLabel')}
        </legend>
        <Radio.Group
          value={reason}
          onChange={(e) => setReason(e.target.value as InboxReportReason)}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {INBOX_REPORT_REASONS.map((r) => (
            <Radio key={r} value={r}>
              {t(`report.reasons.${r}` as 'report.reasons.spam')}
            </Radio>
          ))}
        </Radio.Group>
      </fieldset>
      <label
        htmlFor="cn-inbox-report-detail"
        style={{
          display: 'block',
          marginTop: 14,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--cr-text-2)',
        }}
      >
        {t('report.detailLabel')}
      </label>
      <Input.TextArea
        id="cn-inbox-report-detail"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t('report.detailPlaceholder')}
        style={{ marginTop: 6 }}
      />
    </Modal>
  );
}
