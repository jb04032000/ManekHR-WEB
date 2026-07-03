'use client';

/**
 * ERPConsentSetting - the PERSISTENT grant/revoke control for ERP verification
 * (ADR-0004 / 2026-06-18 spec). Unlike the one-time ERPConsentBanner, this never
 * self-hides: it lives in the owner-only privacy section of ProfileView so the
 * owner can turn the ERP-linked badge on or off at any time.
 *
 *   granted     -> shows "Turn off" (revokeErpConsent; badge drops immediately)
 *   not granted -> shows "Verify"   (opens ERPConsentModal in profile mode -> grant)
 *
 * It fetches its own state (best-effort) and renders a quiet, honest summary even
 * before the state resolves so the section never flickers empty.
 *
 * Cross-module: shares the `connect/profile/erp-verification` endpoint with
 * ERPConsentBanner (profile.actions getMyErpVerification/grantErpConsent/
 * revokeErpConsent). Owner-only: ProfileView only mounts it inside the
 * owner-gated `visibilitySection`.
 *
 * Watch: a state-fetch failure leaves it in the "not granted" affordance (Verify),
 * which is safe - granting is idempotent and the backend is the source of truth.
 */

import { useEffect, useState } from 'react';
import { App as AntApp } from 'antd';
import { useTranslations } from 'next-intl';
import DsButton from '@/components/ui/DsButton';
import ERPConsentModal from './ERPConsentModal';
import {
  getMyErpVerification,
  grantErpConsent,
  revokeErpConsent,
} from '@/features/connect/profile.actions';
import type { ErpVerificationState } from '@/features/connect/profile.types';

export default function ERPConsentSetting() {
  const t = useTranslations('connect.erpConsent.setting');
  const { message } = AntApp.useApp();
  const [state, setState] = useState<ErpVerificationState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getMyErpVerification().then((res) => {
      if (!cancelled && res.ok) setState(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const granted = state?.consentStatus === 'granted';

  const handleGrant = async () => {
    setGranting(true);
    try {
      const res = await grantErpConsent();
      if (res.ok) {
        setState(res.data);
        setModalOpen(false);
        void message.success(t('saved'));
      } else {
        message.error(t('error'));
      }
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await revokeErpConsent();
      if (res.ok) {
        setState(res.data);
        void message.success(t('revoked'));
      } else {
        message.error(t('error'));
      }
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--cr-border-light)' }}>
      <div className="text-[12.5px] font-semibold" style={{ color: 'var(--cr-text-2)' }}>
        {t('title')}
      </div>
      <p className="m-0 mt-0.5 text-[12px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
        {granted ? t('onBody') : t('offBody')}
      </p>
      <div className="mt-2">
        {granted ? (
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            loading={revoking}
            onClick={() => void handleRevoke()}
          >
            {t('turnOff')}
          </DsButton>
        ) : (
          <DsButton dsVariant="primary" dsSize="sm" onClick={() => setModalOpen(true)}>
            {t('turnOn')}
          </DsButton>
        )}
      </div>

      <ERPConsentModal
        open={modalOpen}
        mode="profile"
        loading={granting}
        onConfirm={() => void handleGrant()}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  );
}
