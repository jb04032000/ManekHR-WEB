'use client';

import { useState } from 'react';
import { Modal, Alert, Input, Checkbox, Typography, Space } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import type { AdvanceComplianceBreach } from '@/types';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;

interface ComplianceOverrideModalProps {
  open: boolean;
  breaches: AdvanceComplianceBreach[];
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

export function ComplianceOverrideModal({
  open,
  breaches,
  onConfirm,
  onCancel,
  confirmLoading,
}: ComplianceOverrideModalProps) {
  const t = useTranslations();
  const currencyFmt = useCurrencyFormatter();

  const [reason, setReason] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [touched, setTouched] = useState(false);

  const reasonTrimmed = reason.trim();
  const reasonValid = reasonTrimmed.length >= 10;
  const canConfirm = reasonValid && authorized;

  const formatMonthYear = (month: number, year: number) =>
    dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMM YYYY');

  const breachLabel = (breach: AdvanceComplianceBreach): string => {
    if (breach.code === 'DEDUCTION_CAP') {
      return t('salary.payDrawer.compliance.overrideBreachDeductionCap', {
        month: formatMonthYear(breach.month, breach.year),
        proposed: currencyFmt.full(breach.proposed),
        max: currencyFmt.full(breach.maxCompliant),
      });
    }
    return t('salary.payDrawer.compliance.overrideBreachMinWage', {
      month: formatMonthYear(breach.month, breach.year),
      proposed: currencyFmt.full(breach.proposed),
      max: currencyFmt.full(breach.maxCompliant),
    });
  };

  const handleConfirm = () => {
    setTouched(true);
    if (!canConfirm) return;
    onConfirm(reasonTrimmed);
  };

  const handleCancel = () => {
    setReason('');
    setAuthorized(false);
    setTouched(false);
    onCancel();
  };

  const showReasonError = touched && !reasonValid;

  return (
    <Modal
      open={open}
      title={
        <span className="flex items-center gap-2">
          <WarningOutlined style={{ color: 'var(--cr-danger-700)' }} />
          {t('salary.payDrawer.compliance.overrideModalTitle')}
        </span>
      }
      okText={t('salary.payDrawer.compliance.overrideConfirmButton')}
      cancelText={t('salary.payDrawer.compliance.overrideCancelButton')}
      onOk={handleConfirm}
      onCancel={handleCancel}
      confirmLoading={confirmLoading}
      okButtonProps={{ disabled: !canConfirm, danger: true }}
      width={520}
      destroyOnHidden
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert type="error" showIcon title={t('salary.payDrawer.compliance.overrideIntro')} />

        <div>
          <Text className="mb-2 block text-[12px] font-semibold tracking-wide text-muted uppercase">
            {t('salary.payDrawer.compliance.overrideBreachListLabel')}
          </Text>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {breaches.map((breach, i) => (
              <div
                key={`modal-breach-${breach.code}-${breach.month}-${breach.year}-${i}`}
                className="rounded-lg px-3 py-2.5 text-[13px]"
                style={{
                  background: 'var(--cr-danger-50)',
                  border: '1px solid var(--cr-danger-200, #fca5a5)',
                }}
              >
                <Text>{breachLabel(breach)}</Text>
              </div>
            ))}
          </Space>
        </div>

        <Alert type="warning" showIcon title={t('salary.payDrawer.compliance.overrideClampNote')} />

        <div>
          <label
            htmlFor="compliance-override-reason"
            className="mb-1.5 block text-[13px] font-medium text-heading"
          >
            {t('salary.payDrawer.compliance.overrideReasonLabel')}
            <span style={{ color: 'var(--cr-danger-700)' }}>&nbsp;*</span>
          </label>
          <TextArea
            id="compliance-override-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={t('salary.payDrawer.compliance.overrideReasonPlaceholder')}
            maxLength={500}
            showCount
            status={showReasonError ? 'error' : undefined}
            aria-required="true"
            aria-describedby={showReasonError ? 'compliance-reason-error' : undefined}
          />
          {showReasonError && (
            <p
              id="compliance-reason-error"
              className="mt-1 text-[12px]"
              style={{ color: 'var(--cr-danger-700)' }}
            >
              {t('salary.payDrawer.compliance.overrideReasonMinLength')}
            </p>
          )}
        </div>

        <Checkbox
          checked={authorized}
          onChange={(e) => setAuthorized(e.target.checked)}
          aria-required="true"
        >
          <span className="text-[13px]">
            {t('salary.payDrawer.compliance.overrideAuthCheckbox')}
          </span>
        </Checkbox>
      </Space>
    </Modal>
  );
}
