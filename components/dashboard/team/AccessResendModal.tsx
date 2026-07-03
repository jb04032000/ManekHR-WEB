'use client';

import { useMemo, useState } from 'react';
import { Alert, Modal } from 'antd';
import { useTranslations } from 'next-intl';
import type { ResendInviteResponse } from '@/types';
import AccessChannelPicker, {
  defaultAccessChannelSelection,
  type AccessChannelSelection,
} from './AccessChannelPicker';

interface Props {
  open: boolean;
  /** Stored email on the member directory record. Determines whether the
   *  Email channel is enabled. */
  memberEmail?: string;
  /** Stored mobile on the member directory record. Determines whether
   *  the SMS + WhatsApp channels are enabled. */
  memberMobile?: string;
  /** When true, invitee already has a manekhr account - in-app
   *  notification is meaningful. When false, the in-app channel is
   *  disabled (no app to receive a notification yet). */
  isWarm: boolean;
  onCancel: () => void;
  onConfirm: (opts: {
    /** Auto-fire channels the BE should dispatch. WhatsApp is a FE-only
     *  share (no BE auto-send), so it's NOT in this array. */
    channels: ('email' | 'sms' | 'in_app')[];
    /** True if owner wants the FE to open wa.me with the new link after
     *  the rotation completes. */
    whatsapp: boolean;
    /** True if owner picked "Just rotate the link" - all channels off. */
    justRotate: boolean;
  }) => Promise<ResendInviteResponse>;
}

/**
 * Resend an existing invite token to a pending member.
 *
 * P1.8-revert.13 (2026-05-14) - channel picker rewrite. The previous
 * 3-radio (Auto / Link / Both) didn't reflect the real decision space.
 * Real choice is per-channel: in-app, email, SMS, WhatsApp, or none
 * (just rotate the link).
 *
 * Smart defaults:
 *   - Warm invitee: in-app + email + SMS pre-checked (channels available
 *     to known users). WhatsApp + Just-rotate off.
 *   - Cold invitee: email + SMS pre-checked. In-app DISABLED (no manekhr
 *     account = no app to notify).
 *   - Missing identifier: that channel disabled with a "no email/mobile
 *     on file" hint.
 *
 * "Just rotate the link" is the escape hatch when owner wants to share
 * the URL manually (WhatsApp, paste-anywhere) without firing any auto-
 * dispatch. Mutually exclusive - checking it unchecks + disables the
 * other rows.
 *
 * Token always rotates on submit (matches the meaning of "Resend"). No
 * forceRegenerate checkbox.
 */
export default function AccessResendModal({
  open,
  memberEmail,
  memberMobile,
  isWarm,
  onCancel,
  onConfirm,
}: Props) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [resultToken, setResultToken] = useState<string | null>(null);

  // Availability flags driven by directory record + warm/cold detection.
  const canInApp = isWarm;
  const canEmail = !!memberEmail;
  const canSms = !!memberMobile;
  const canWhatsapp = !!memberMobile;

  const [selection, setSelection] = useState<AccessChannelSelection>(() =>
    defaultAccessChannelSelection({ isWarm, memberEmail, memberMobile }),
  );

  // Reset the channel selection + result token whenever the modal
  // transitions to open. Done as a render-time state adjustment (React's
  // documented "reset on prop change" pattern) rather than an effect, so it
  // does not trip react-hooks/set-state-in-effect and resets without a flash.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelection(defaultAccessChannelSelection({ isWarm, memberEmail, memberMobile }));
      setResultToken(null);
    }
  }

  const inviteUrl = resultToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite?token=${resultToken}&type=team`
    : null;

  const submitDisabled = useMemo(() => {
    // OK is always enabled - even "everything unchecked" is a valid
    // state (rotate token silently). Modal's primary action never grays
    // out unless we are mid-submit.
    return submitting;
  }, [submitting]);

  async function handleOk() {
    setSubmitting(true);
    try {
      const channels: ('email' | 'sms' | 'in_app')[] = [];
      if (!selection.justRotate) {
        if (selection.inApp && canInApp) channels.push('in_app');
        if (selection.email && canEmail) channels.push('email');
        if (selection.sms && canSms) channels.push('sms');
      }
      const res = await onConfirm({
        channels,
        whatsapp: !selection.justRotate && selection.whatsapp && canWhatsapp,
        justRotate: selection.justRotate,
      });
      if (res?.inviteToken) {
        setResultToken(res.inviteToken);
      } else {
        onCancel();
      }
    } catch {
      // Parent surfaces the error toast.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t('team.accessResendModalTitle')}
      // Block dismiss paths while an inflight network call is running.
      // Antd's onCancel fires for both the Cancel button + ESC key + mask
      // click - gating it here covers all three. Submitting state also
      // disables the Cancel button visually so the user has no clickable
      // affordance to bail mid-request.
      onCancel={submitting ? undefined : onCancel}
      onOk={() => void handleOk()}
      okText={resultToken ? t('common.done') : t('team.accessResendOk')}
      cancelText={t('common.cancel')}
      okButtonProps={{ loading: submitting, disabled: submitDisabled }}
      cancelButtonProps={{ disabled: submitting }}
      closable={!submitting}
      mask={{ closable: !submitting }}
      keyboard={!submitting}
    >
      {inviteUrl ? (
        <Alert
          type="success"
          showIcon
          title={t('team.accessResendSuccessTitle')}
          description={
            <div className="flex flex-col gap-2 break-all">
              <code className="rounded bg-gray-50 px-2 py-1 text-xs">{inviteUrl}</code>
              <small className="text-gray-600">{t('team.accessResendShareHint')}</small>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-[13px] font-semibold text-gray-900">
            {t('team.accessResendChannelLabel')}
          </div>

          <AccessChannelPicker
            value={selection}
            onChange={setSelection}
            isWarm={isWarm}
            memberEmail={memberEmail}
            memberMobile={memberMobile}
            showJustRotate
          />
        </div>
      )}
    </Modal>
  );
}
