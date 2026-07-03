'use client';

import { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { ArrowLeftOutlined, MailOutlined, MobileOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { forgotPassword, sendOtp } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import { env } from '@/lib/env';
import type { BaseModeProps, OtpContext } from './types';

interface ForgotModeProps extends BaseModeProps {
  /**
   * Bridge to the OTP-forgot path when the typed identifier is a mobile.
   * ForgotMode fires `sendOtp` inline before invoking this callback so the
   * orchestrator can route directly to `otp_verify` and skip the redundant
   * OtpSendMode confirmation step (mirrors CheckMode → onStartOtpLoginDirect).
   */
  onSwitchToOtp?: (ctx: OtpContext) => void;
}

const MOBILE_RE = /^[+]?[0-9]{10,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InputType = 'email' | 'mobile' | 'unknown';

function detectInputType(raw: string): InputType {
  const trimmed = raw.trim();
  if (!trimmed) return 'unknown';
  const cleaned = trimmed.replace(/[\s-]/g, '');
  if (MOBILE_RE.test(cleaned)) return 'mobile';
  if (EMAIL_RE.test(trimmed)) return 'email';
  return 'unknown';
}

/**
 * Single-input forgot-password form that auto-routes by input type:
 *   - email-shaped identifier → POST /auth/forgot-password (real email
 *     link dispatch, persisted bcrypt-hashed token, 15-min expiry)
 *   - mobile-shaped identifier → SMS-OTP forgot flow (parent transitions
 *     to OtpSendMode → OtpVerifyMode)
 *
 * Icon, placeholder, subtitle and submit label all adapt live to the
 * typed value so the user always sees a UI consistent with the action
 * they're about to trigger. The redundant "Reset via SMS OTP instead"
 * footer link was removed - the auto-detect inside `handleForgot()`
 * already routes mobile to OTP, so the link only confused users.
 */
export function ForgotMode({ setMode, identifier, setIdentifier, onSwitchToOtp }: ForgotModeProps) {
  const t = useTranslations('auth');
  // Localize backend error codes (e.g. NETWORK_UNREACHABLE on a backend-down)
  // so the send-OTP / forgot-password failures never show a raw axios string.
  const authErrMsg = useAuthErrorMessage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const watched = (Form.useWatch('identifier', form) as string | undefined) ?? '';
  // Carry-over identifier from CheckMode (or LoginMode → "Forgot password" link)
  // is already known to belong to a registered account because CheckMode
  // verified existence before routing here. Lock the input so a typo in this
  // step can't fire a request against a different (non-existent) account.
  // Deep-link entry to /auth?mode=forgot has no carry-over → editable input.
  const isLocked = identifier.trim().length > 0;
  const inputType = detectInputType(isLocked ? identifier : watched);

  const handleForgot = async (vals: { identifier: string }) => {
    setError('');
    setLoading(true);
    try {
      const trimmed = vals.identifier.trim();
      const isMobile = MOBILE_RE.test(trimmed.replace(/[\s-]/g, ''));
      // Mobile path → SMS-OTP-forgot. Fire send-otp here and hop directly to
      // OtpVerifyMode. The user already typed + saw their mobile in this same
      // form - interposing OtpSendMode just to ask "Send Code?" again was
      // wasted friction (reported as duplicate-step UX bug).
      if (isMobile && onSwitchToOtp) {
        // Interim (SMS OTP off): a reset code cannot be sent by SMS. Surface a
        // friendly pointer to email reset / support instead of firing a send that
        // the backend can't fulfil. Flips back to the OTP-forgot path when the
        // switch is on. See env.smsOtpEnabled.
        if (!env.smsOtpEnabled) {
          setError(t('forgot.smsUnavailable'));
          return;
        }
        const sendRes = await sendOtp(trimmed, 'forgot');
        if (!sendRes.ok) {
          setError(authErrMsg(sendRes.errorCode, sendRes.error));
          return;
        }
        onSwitchToOtp({
          mobile: trimmed,
          flowType: 'forgot',
          resendCooldownSec: sendRes.data.resendCooldownSec,
          mockMode: sendRes.data.mockMode,
          resetKey: Date.now(),
        });
        return;
      }
      const res = await forgotPassword(trimmed);
      if (!res.ok) {
        setError(authErrMsg(res.errorCode, res.error));
        return;
      }
      setMode('reset_sent');
    } catch (e) {
      // parseApiError already returns the friendly NETWORK_UNREACHABLE_MESSAGE
      // floor for a backend-down; no errorCode is available on a raw throw.
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const subtitleKey = inputType === 'mobile' ? 'forgot.subtitleMobile' : 'forgot.subtitleEmail';
  const submitKey = inputType === 'mobile' ? 'forgot.submitMobile' : 'forgot.submitEmail';
  const placeholderKey =
    inputType === 'mobile'
      ? 'forgot.identifier.placeholderMobile'
      : 'forgot.identifier.placeholderEmail';

  return (
    <>
      <button
        onClick={() => {
          setMode('login');
          setError('');
        }}
        className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-body"
      >
        <ArrowLeftOutlined /> {t('forgot.back')}
      </button>
      <h1 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
        {t('forgot.title')}
      </h1>
      <p className="m-0 mb-6 text-[13px] text-muted">{t(subtitleKey)}</p>
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          className="mb-4 rounded-[10px]"
          closable={{ onClose: () => setError('') }}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleForgot}
        requiredMark={false}
        initialValues={{ identifier }}
      >
        <Form.Item
          name="identifier"
          label={t('forgot.identifier.label')}
          rules={[{ required: true, message: t('forgot.identifier.required') }]}
        >
          <Input
            prefix={
              inputType === 'mobile' ? (
                <MobileOutlined className="text-subtle" />
              ) : (
                <MailOutlined className="text-subtle" />
              )
            }
            suffix={
              isLocked ? (
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('');
                    setMode('check');
                  }}
                  className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-primary hover:underline"
                >
                  {t('forgot.changeIdentifier')}
                </button>
              ) : null
            }
            placeholder={t(placeholderKey)}
            size="large"
            readOnly={isLocked}
            autoFocus={!isLocked}
          />
        </Form.Item>
        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            block
            className="h-[46px] font-semibold"
          >
            {t(submitKey)}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
