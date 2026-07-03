'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Alert, message } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { AxiosError } from 'axios';
import { DsModal } from '@/components/ui';
import { pinApi } from '@/lib/api/modules';
import { PinInput } from './PinInput';

interface ChangePinModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Settings → Security → Change PIN flow. Three 6-digit boxes (current, new,
 * confirm). On success surfaces an Ant message and dismisses.
 */
export function ChangePinModal({ open, onClose }: ChangePinModalProps) {
  const t = useTranslations('auth.appLock.changeSettings');
  const tCommon = useTranslations('auth.appLock.common');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [msgApi, contextHolder] = message.useMessage();

  // Reset transient form state when modal transitions from closed to open.
  // Tracking the previous `open` value via a ref avoids the React 19
  // set-state-in-effect lint by only firing when `open` actually flips,
  // not on every effect run.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (!wasOpen && open) {
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (currentPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6) {
      setError(t('error.sixDigits'));
      return;
    }
    if (newPin !== confirmPin) {
      setError(t('error.mismatch'));
      return;
    }
    if (currentPin === newPin) {
      setError(t('error.sameAsCurrent'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await pinApi.change(currentPin, newPin);
      msgApi.success(t('success'));
      onClose();
    } catch (err) {
      const ax = err as AxiosError<{ message?: string; code?: string }>;
      const data = ax.response?.data;
      if (data?.code === 'PIN_INCORRECT') {
        setError(t('error.currentIncorrect'));
      } else {
        setError(data?.message ?? t('error.failed'));
      }
    } finally {
      setSubmitting(false);
    }
  }, [currentPin, newPin, confirmPin, msgApi, onClose, t]);

  return (
    <>
      {contextHolder}
      <DsModal
        title={t('modalTitle')}
        open={open}
        onCancel={onClose}
        footer={[
          <Button key="cancel" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
            {t('submit')}
          </Button>,
        ]}
        width={420}
      >
        <p className="mb-3 text-sm text-muted">{t('subtitle')}</p>

        <div className="mb-2 flex items-center justify-between">
          <label className="block text-xs font-medium tracking-wide text-muted uppercase">
            {t('currentLabel')}
          </label>
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-heading"
            aria-label={reveal ? tCommon('hidePinAria') : tCommon('showPinAria')}
            aria-pressed={reveal}
          >
            {reveal ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            <span>{reveal ? tCommon('hidePin') : tCommon('showPin')}</span>
          </button>
        </div>
        <PinInput
          value={currentPin}
          onChange={setCurrentPin}
          autoFocus
          disabled={submitting}
          reveal={reveal}
          ariaLabel={t('currentLabel')}
        />

        <label className="mt-4 mb-2 block text-xs font-medium tracking-wide text-muted uppercase">
          {t('newLabel')}
        </label>
        <PinInput
          value={newPin}
          onChange={setNewPin}
          disabled={submitting}
          reveal={reveal}
          ariaLabel={t('newLabel')}
        />

        <label className="mt-4 mb-2 block text-xs font-medium tracking-wide text-muted uppercase">
          {t('confirmLabel')}
        </label>
        <PinInput
          value={confirmPin}
          onChange={setConfirmPin}
          disabled={submitting}
          reveal={reveal}
          ariaLabel={t('confirmLabel')}
        />

        {error && <Alert type="error" showIcon className="mt-4" title={error} />}
      </DsModal>
    </>
  );
}
