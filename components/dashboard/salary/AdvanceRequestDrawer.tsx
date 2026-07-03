'use client';

// Worker-facing "request an advance" drawer. Lives in components/dashboard/salary
// (next to MySalary) so the worker bundle does not pull the admin payroll tree.
// What it does: lets a self-scoped worker ask for an advance on the current month's pay.
// Links: salary.api.ts createAdvanceRequest -> POST /salary/advance-requests (self);
//   owner side is AdvanceApprovalQueue (approve = approve + disburse + recovery plan).
// Task 6 (2026-06-22): fetches the advance window on open and shows an Alert banner
//   so workers see whether requests are allowed today before submitting.
//   Links: getAdvanceWindow -> GET /salary/advance-requests/window (self scope),
//   AdvanceWindowControl.tsx (owner setting), advance-request-window.util.ts (BE logic).
// Watch: Submit is disabled (but not hidden) when isOpenToday=false; the backstop
//   server-side error (ADVANCE_REQUEST_DAY_CLOSED) is still surfaced via parseApiError.

import { useEffect, useState } from 'react';
import { Alert, Button, Drawer, Form, InputNumber, App } from 'antd';
import { useTranslations } from 'next-intl';
import { createAdvanceRequest, getAdvanceWindow } from '@/lib/api/modules/salary.api';
import { parseApiError } from '@/lib/utils';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import type { AdvanceWindowResponse } from '@/types';

interface AdvanceRequestDrawerProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  /** Current IST month/year the advance is requested against (backend enforces current month). */
  currentMonth: number;
  currentYear: number;
  onSuccess?: () => void;
}

export function AdvanceRequestDrawer({
  open,
  onClose,
  workspaceId,
  currentMonth,
  currentYear,
  onSuccess,
}: AdvanceRequestDrawerProps) {
  // 'advanceSalary' namespace (shared with the owner approval queue).
  const t = useTranslations('advanceSalary');
  const { message } = App.useApp();
  const currencyFmt = useCurrencyFormatter();
  const [form] = Form.useForm<{ amountRupees: number }>();
  const [saving, setSaving] = useState(false);

  // Fetch the advance window when the drawer opens. Shows a banner so workers know
  // whether today is within the allowed request window before filling out the form.
  // `null` while loading (no banner yet); error is silently ignored (backstop = BE).
  const [windowInfo, setWindowInfo] = useState<AdvanceWindowResponse | null>(null);

  useEffect(() => {
    if (!open || !workspaceId) return;
    let live = true;
    getAdvanceWindow(workspaceId)
      .then((w) => {
        if (live) setWindowInfo(w);
      })
      .catch(() => {
        // Network/auth errors: fail silently; the submit will hit the same error.
      });
    return () => {
      live = false;
    };
  }, [open, workspaceId]);

  const handleSubmit = async (values: { amountRupees: number }) => {
    if (!values.amountRupees || values.amountRupees <= 0) return;
    setSaving(true);
    try {
      // Convert ₹ -> paise (integer) per backend contract (D-02).
      const requestedAmount = Math.round(values.amountRupees * 100);
      // No teamMemberId in the body: the backend resolves the caller's own
      // member id from the JWT (IDOR-safe) and its DTO whitelist
      // (forbidNonWhitelisted) 400s on any extra field. Send only the slim
      // {requestedAmount, month, year} contract.
      await createAdvanceRequest(workspaceId, {
        requestedAmount,
        month: currentMonth,
        year: currentYear,
      });
      message.success(t('requestSubmitted'));
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (err) {
      // Surfaces backend codes as-is: ADVANCE_DUPLICATE, ADVANCE_NOT_CURRENT_MONTH,
      // ADVANCE_REQUEST_DAY_CLOSED (with the precise allowed window).
      message.error(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setWindowInfo(null);
    onClose();
  };

  // Disable Submit when the window has been fetched and it is closed today.
  const submitDisabled = windowInfo !== null && !windowInfo.isOpenToday;

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={t('requestDrawerTitle')}
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
            {t('submitRequest')}
          </Button>
        </div>
      }
    >
      {/* Advance-window banner: info when a window/fixed-day policy is active,
          warning when closed. Hidden entirely for an open any_day policy - there
          is no restriction worth announcing, and the BE's generic message used
          to render here as a false "not open right now" alarm. */}
      {windowInfo && !(windowInfo.isOpenToday && windowInfo.policy?.mode === 'any_day') && (
        <Alert
          type={windowInfo.isOpenToday ? 'info' : 'warning'}
          showIcon
          className="mb-3"
          title={windowInfo.message}
        />
      )}
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <p className="mb-4 text-sm text-muted">
          {t('requestDrawerDescription', { month: currentMonth, year: currentYear })}
        </p>

        <Form.Item
          name="amountRupees"
          label={t('requestedAmountLabel')}
          rules={[
            { required: true, message: t('amountRequired') },
            { type: 'number', min: 1, message: t('amountMustBePositive') },
          ]}
        >
          {/* prefix= per AntD v6 (addonBefore/addonAfter banned on InputNumber) */}
          <InputNumber
            prefix={currencyFmt.symbol}
            min={1}
            precision={0}
            style={{ width: '100%' }}
            size="large"
            placeholder={t('amountPlaceholder')}
          />
        </Form.Item>

        {/* Recovery note for the EMPLOYEE (moved here from the owner's disburse
            drawer 2026-07-03): an advance is THIS month's salary paid early,
            deducted from the same month's pay; installments = the 0% loan. */}
        <p className="m-0 text-[12px] text-muted">{t('recoveryNote')}</p>
      </Form>
    </Drawer>
  );
}
