'use client';

// Worker-facing "apply for a 0% loan" drawer. Lives in components/dashboard/salary
// (next to MySalary) so the worker bundle does not pull the admin payroll tree.
// What it does: lets a self-scoped worker apply for an interest-free installment
// loan on their own salary (amount + desired months + optional purpose).
// Links: salary.api.ts createLoanRequest -> POST /salary/loan-requests (self);
//   getLoanRequestEligibility -> GET /salary/loan-requests/eligibility (self);
//   owner side approves via the loan-requests queue (materializes an EmployerLoan).
// Watch: Submit is disabled (but not hidden) when eligibility.eligible=false; the
//   server-side codes (LOAN_*_DISABLED / LOAN_TENURE_NOT_MET / LOAN_AMOUNT_EXCEEDS_CAP /
//   LOAN_LIMIT_EXCEEDED / LOAN_REQUEST_DUPLICATE) are still surfaced via parseApiError.
//   Mirrors AdvanceRequestDrawer. AntD v6 only: InputNumber prefix=/suffix= (no addonAfter),
//   Drawer open=/size=, forceRender + explicit form resets (destroyOnHidden left the
//   useForm instance disconnected while closed -> AntD dev warning).

import { useEffect, useState } from 'react';
import { Alert, Button, Drawer, Form, Input, InputNumber, App } from 'antd';
import { useTranslations } from 'next-intl';
import { createLoanRequest, getLoanRequestEligibility } from '@/lib/api/modules/salary.api';
import { parseApiError } from '@/lib/utils';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import type { LoanRequestEligibility } from '@/types';

interface LoanRequestDrawerProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  onSuccess?: () => void;
}

interface LoanFormValues {
  amountRupees: number;
  desiredTenorMonths: number;
  purpose?: string;
}

// Maps the stable backend ineligibility codes to a friendly i18n line. Unknown
// codes fall back to a generic reason so a new BE code never renders raw.
const REASON_KEY: Record<string, string> = {
  LOAN_FEATURE_DISABLED: 'reasonFeatureDisabled',
  LOAN_SELF_APPLY_DISABLED: 'reasonSelfApplyDisabled',
  LOAN_TENURE_NOT_MET: 'reasonTenureNotMet',
  LOAN_AMOUNT_EXCEEDS_CAP: 'reasonAmountExceedsCap',
  LOAN_LIMIT_EXCEEDED: 'reasonLimitExceeded',
};

export function LoanRequestDrawer({
  open,
  onClose,
  workspaceId,
  onSuccess,
}: LoanRequestDrawerProps) {
  // Cohesive sub-namespace under the worker salary surface.
  const t = useTranslations('salary.mySalary.loanRequest');
  const { message } = App.useApp();
  const currencyFmt = useCurrencyFormatter();
  const [form] = Form.useForm<LoanFormValues>();
  const [saving, setSaving] = useState(false);

  // Fetch eligibility when the drawer opens. Drives whether Submit is enabled,
  // the max-amount cap line, and the ineligibility reasons banner. `null` while
  // loading; errors fail silently (the submit hits the same backstop).
  const [eligibility, setEligibility] = useState<LoanRequestEligibility | null>(null);

  useEffect(() => {
    if (!open || !workspaceId) return;
    let live = true;
    getLoanRequestEligibility(workspaceId)
      .then((e) => {
        if (live) setEligibility(e);
      })
      .catch(() => {
        // Network/auth errors: fail silently; the submit will hit the same error.
      });
    return () => {
      live = false;
    };
  }, [open, workspaceId]);

  const handleSubmit = async (values: LoanFormValues) => {
    if (!values.amountRupees || values.amountRupees <= 0) return;
    setSaving(true);
    try {
      // Convert ₹ -> paise (integer) per backend contract.
      const requestedAmount = Math.round(values.amountRupees * 100);
      // No teamMemberId in the body: the backend resolves the caller's own
      // member id from the JWT (IDOR-safe) and its DTO whitelist
      // (forbidNonWhitelisted) 400s on any extra field. Slim
      // {requestedAmount, desiredTenorMonths, purpose?} contract only.
      await createLoanRequest(workspaceId, {
        requestedAmount,
        desiredTenorMonths: values.desiredTenorMonths,
        ...(values.purpose ? { purpose: values.purpose } : {}),
      });
      message.success(t('submitted'));
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (err) {
      // Surfaces backend codes as-is: LOAN_REQUEST_DUPLICATE, LOAN_AMOUNT_EXCEEDS_CAP,
      // LOAN_TENURE_NOT_MET, LOAN_LIMIT_EXCEEDED, LOAN_*_DISABLED.
      message.error(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setEligibility(null);
    onClose();
  };

  // Disable Submit when eligibility has loaded and the member is not eligible.
  const submitDisabled = eligibility !== null && !eligibility.eligible;

  // Max-amount cap (paise -> rupees) shown as a hint + InputNumber max bound.
  const maxRupees =
    eligibility?.maxAmount != null && eligibility.maxAmount > 0
      ? Math.floor(eligibility.maxAmount / 100)
      : undefined;

  // Distinct, de-duplicated friendly reasons for the ineligibility banner.
  const reasonLines =
    eligibility && !eligibility.eligible
      ? Array.from(new Set(eligibility.reasons)).map((code) =>
          REASON_KEY[code] ? t(REASON_KEY[code]) : t('reasonGeneric'),
        )
      : [];

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={t('drawerTitle')}
      size="default"
      // forceRender (not destroyOnHidden): the form resets explicitly on
      // submit/close, and destroying the body left the useForm instance
      // disconnected while closed (AntD "not connected to any Form" warning).
      forceRender
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={handleClose}>{t('cancel')}</Button>
          <Button
            type="primary"
            loading={saving}
            disabled={submitDisabled}
            onClick={() => form.submit()}
          >
            {t('submit')}
          </Button>
        </div>
      }
    >
      {/* Ineligibility banner: lists the friendly reasons the member can't apply
          right now. AntD v6 title= (not message=). */}
      {reasonLines.length > 0 && (
        <Alert
          type="warning"
          showIcon
          className="mb-3"
          title={t('ineligibleTitle')}
          description={
            <ul className="m-0 list-disc pl-4">
              {reasonLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          }
        />
      )}
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <p className="mb-4 text-sm text-muted">{t('drawerDescription')}</p>

        <Form.Item
          name="amountRupees"
          label={t('amountLabel')}
          extra={
            maxRupees != null ? t('capHint', { max: currencyFmt.inline(maxRupees) }) : undefined
          }
          rules={[
            { required: true, message: t('amountRequired') },
            { type: 'number', min: 1, message: t('amountMustBePositive') },
          ]}
        >
          {/* prefix= per AntD v6 (addonBefore/addonAfter banned on InputNumber) */}
          <InputNumber
            prefix={currencyFmt.symbol}
            min={1}
            max={maxRupees}
            precision={0}
            style={{ width: '100%' }}
            size="large"
            placeholder={t('amountPlaceholder')}
          />
        </Form.Item>

        <Form.Item
          name="desiredTenorMonths"
          label={t('tenorLabel')}
          rules={[
            { required: true, message: t('tenorRequired') },
            { type: 'number', min: 1, max: 120, message: t('tenorRange') },
          ]}
        >
          {/* suffix= per AntD v6 (addonAfter banned on InputNumber) */}
          <InputNumber
            suffix={t('tenorSuffix')}
            min={1}
            max={120}
            precision={0}
            style={{ width: '100%' }}
            size="large"
            placeholder={t('tenorPlaceholder')}
          />
        </Form.Item>

        <Form.Item name="purpose" label={t('purposeLabel')}>
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            placeholder={t('purposePlaceholder')}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
