'use client';

/**
 * ERPConsentBanner - the one-time "verify with your ERP" suggestion card on the
 * owner's own Connect profile (ADR-0004 / 2026-06-18 spec). It is self-contained:
 * it fetches its own verification state (best-effort) and renders NOTHING unless
 * the owner is eligible, has not already granted, and has not dismissed it.
 *
 * Visibility rule (all four must hold):
 *   isOwner && state.eligible && state.consentStatus !== 'granted'
 *           && !state.suggestionDismissed
 *
 * Actions:
 *   - "Verify"  -> opens ERPConsentModal (profile mode) -> grantErpConsent()
 *   - "Not now" -> dismissErpSuggestion()
 * Either success refreshes the local state (so the banner self-hides).
 *
 * Cross-module: lives in ProfileView's owner rail right AFTER ERPLinkedPanel; the
 * grant/revoke is also reachable from the persistent ERPConsentSetting in the
 * privacy section. Both read the same `connect/profile/erp-verification` endpoint
 * (profile.actions getMyErpVerification/grantErpConsent/dismissErpSuggestion).
 *
 * Watch: a fetch failure simply hides the banner (the owner can still grant via
 * the settings toggle) - never block the profile render on it.
 */

import { useEffect, useState } from 'react';
import { App as AntApp } from 'antd';
import { useTranslations } from 'next-intl';
import { BadgeCheck } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import ERPConsentModal from './ERPConsentModal';
import {
  dismissErpSuggestion,
  getMyErpVerification,
  grantErpConsent,
} from '@/features/connect/profile.actions';
import type { ErpVerificationState } from '@/features/connect/profile.types';

export default function ERPConsentBanner({ isOwner }: { isOwner: boolean }) {
  const t = useTranslations('connect.erpConsent.banner');
  const { message } = AntApp.useApp();
  const [state, setState] = useState<ErpVerificationState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [granting, setGranting] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  // Best-effort state fetch - only the owner can have a verification state, so
  // skip the call entirely for a non-owner view of ProfileView.
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    void getMyErpVerification().then((res) => {
      if (!cancelled && res.ok) setState(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  const handleGrant = async () => {
    setGranting(true);
    try {
      const res = await grantErpConsent();
      if (res.ok) {
        setState(res.data);
        setModalOpen(false);
      } else {
        message.error(res.error);
      }
    } finally {
      setGranting(false);
    }
  };

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      const res = await dismissErpSuggestion();
      if (res.ok) setState(res.data);
      else message.error(res.error);
    } finally {
      setDismissing(false);
    }
  };

  // All four conditions must hold to show the one-time suggestion.
  const show =
    isOwner &&
    !!state &&
    state.eligible &&
    state.consentStatus !== 'granted' &&
    !state.suggestionDismissed;

  if (!show) return null;

  return (
    <>
      <div
        style={{
          padding: 'var(--cr-space-md)',
          background: 'var(--cr-primary-light)',
          border: '1px solid var(--cr-border-light)',
          borderRadius: 'var(--cr-radius-lg)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <BadgeCheck size={16} aria-hidden style={{ color: 'var(--cr-primary)' }} />
          <span className="text-[13px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {t('title')}
          </span>
        </div>
        <p
          className="m-0 mt-1.5 text-[12.5px] leading-relaxed"
          style={{ color: 'var(--cr-text-2)' }}
        >
          {t('body')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <DsButton dsVariant="primary" dsSize="sm" onClick={() => setModalOpen(true)}>
            {t('verify')}
          </DsButton>
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            loading={dismissing}
            onClick={() => void handleDismiss()}
          >
            {t('notNow')}
          </DsButton>
        </div>
      </div>

      <ERPConsentModal
        open={modalOpen}
        mode="profile"
        loading={granting}
        onConfirm={() => void handleGrant()}
        onCancel={() => setModalOpen(false)}
      />
    </>
  );
}
