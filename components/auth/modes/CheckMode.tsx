'use client';

import { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { UserOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { GoogleGIcon } from '@/components/auth/GoogleGIcon';
import { useTranslations } from 'next-intl';
import { checkUser } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import { INDIAN_MOBILE_RE } from '@/lib/common/indian-mobile';
import { env } from '@/lib/env';
import type { BaseModeProps } from './types';

interface CheckModeProps extends BaseModeProps {
  /** Called when the user picks Google OAuth. */
  onGoogleLogin: () => void;
  /**
   * Existing-mobile OTP-only fast-path: fires send-otp inline + skips
   * OtpSendMode. Used only for accounts without a password (LoginMode would
   * dead-end). Returns send result so CheckMode can surface errors without
   * losing the user's typed identifier.
   */
  onStartOtpLoginDirect: (
    mobile: string,
    hasPassword: boolean,
  ) => Promise<{ ok: true } | { ok: false; error: string; errorCode?: string }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose digit-shape detector - used only to decide which error message to
// surface when validation fails (mobile-specific vs generic).
const PHONE_SHAPE_RE = /^[+\d\s-]+$/;

/**
 * Identifier-entry screen - first thing the user sees on /auth. Auto-detects
 * email vs mobile and routes to the appropriate next mode based on the
 * check-user response. SMS-OTP is offered when the typed identifier is a
 * mobile (or maps to a user with a verified mobile).
 */
export function CheckMode({
  setMode,
  setIdentifier,
  onGoogleLogin,
  onStartOtpLoginDirect,
}: CheckModeProps) {
  const t = useTranslations('auth');
  // Localize a backend error code (e.g. NETWORK_UNREACHABLE on a backend-down)
  // for the inline OTP fast-path; the checkUser throw path has no code, so it
  // falls back to parseApiError's English friendly floor (already network-safe).
  const authErrMsg = useAuthErrorMessage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // antd's Form.Item reserves the explain-error text's height OUT OF the
  // marginBottom style below (fixed total block height, no layout jump), so
  // a static marginBottom:32 leaves only ~9px before the Continue button
  // once the error text renders - reads as "no space at all". Track
  // validity so marginBottom can grow only while the error is shown.
  const [identifierHasError, setIdentifierHasError] = useState(false);

  const handleCheck = async (vals: { identifier: string }) => {
    setError('');
    setLoading(true);
    try {
      const trimmed = vals.identifier.trim();
      const cleaned = trimmed.replace(/[\s-]/g, '');
      const isMobile = INDIAN_MOBILE_RE.test(cleaned);
      const res = (await checkUser(trimmed)) as
        | {
            exists?: boolean;
            hasPassword?: boolean;
            hasMobile?: boolean;
            otpAllowed?: boolean;
            data?: {
              exists?: boolean;
              hasPassword?: boolean;
              hasMobile?: boolean;
              otpAllowed?: boolean;
            };
          }
        | undefined;
      const inner = res && 'data' in res && res.data ? res.data : res;
      setIdentifier(trimmed);

      // Mobile branch - three sub-paths:
      //  1. Existing user with a password → LoginChoiceMode. The user
      //     picks between OTP-quick-login and password-login as first-class
      //     peers (replaces the older inline "Use OTP instead" link inside
      //     LoginMode). Forgot-password remains a footer link.
      //  2. Existing user without a password (legacy OTP-only register) →
      //     OtpVerifyMode direct. The choice screen would have only one
      //     real option for these users, so fast-path the OTP send inline.
      //  3. New mobile → SignupMode (combined name + password + workspace
      //     form, then OTP verify, then atomic User + Workspace creation
      //     on the BE).
      if (isMobile) {
        if (inner?.exists) {
          // Interim (SMS OTP off, NEXT_PUBLIC_SMS_OTP_ENABLED=false): no OTP can
          // be sent, so password is the only mobile sign-in. Route every existing
          // mobile user straight to password login (skip the OTP-vs-password
          // choice screen). Forgot-password there falls back to email reset. When
          // the switch is on, keep the normal OTP-capable routing.
          if (!env.smsOtpEnabled) {
            setMode('login');
            form.setFieldsValue({ identifier: trimmed });
          } else if (inner.hasPassword) {
            setMode('login_choice');
            form.setFieldsValue({ identifier: trimmed });
          } else {
            const sendRes = await onStartOtpLoginDirect(trimmed, false);
            if (!sendRes.ok) {
              setError(authErrMsg(sendRes.errorCode, sendRes.error));
              setLoading(false);
              return;
            }
          }
        } else {
          // New mobile -> SignupMode. When SMS OTP is off, SignupMode creates the
          // account with name+password and no OTP (phone unverified); otherwise it
          // runs the SMS-OTP signup. Branch lives in SignupMode.handleSubmit.
          setMode('signup');
          form.setFieldsValue({ identifier: trimmed });
        }
        return;
      }

      if (inner?.exists) {
        setMode('login');
        form.setFieldsValue({ identifier: trimmed });
      } else {
        // Email-not-exist → unified single-screen SignupMode (atomic
        // /auth/register with workspace block). Replaces the legacy 2-step
        // RegisterMode → RegisterWorkspaceMode flow for parity with the
        // mobile signup UX.
        setMode('signup');
        form.setFieldsValue({ identifier: trimmed });
      }
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1
        style={{ marginTop: 0, marginBottom: 12, lineHeight: 1.05 }}
        className="font-display text-[44px] font-extrabold tracking-tight text-heading"
      >
        {t('check.title')}
      </h1>
      <p
        style={{ marginTop: 0, marginBottom: 32, lineHeight: 1.5 }}
        className="text-[15px] text-muted"
      >
        {t('check.subtitle')}
      </p>
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          // antd's Alert css-in-js sets margin:0 on its own root class, which
          // wins over the Tailwind `mb-6` utility (0px computed despite the
          // class being present) - inline style is needed to actually apply
          // the gap before the Google button below.
          style={{ marginBottom: 24 }}
          className="rounded-[10px]"
          closable={{ onClose: () => setError('') }}
        />
      )}
      <Button
        size="large"
        block
        className="mb-6 flex h-[52px] items-center justify-center gap-3 border border-border bg-surface font-semibold text-heading"
        onClick={onGoogleLogin}
        aria-label={t('check.google')}
      >
        <GoogleGIcon />
        {t('check.google')}
      </Button>
      <div className="relative mb-6 flex items-center">
        <div className="flex-1 border-t border-border" />
        <span className="px-4 text-[11px] font-semibold tracking-[0.12em] text-subtle uppercase">
          {t('check.dividerEmail')}
        </span>
        <div className="flex-1 border-t border-border" />
      </div>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleCheck}
        requiredMark={false}
        onFieldsChange={() => setIdentifierHasError(form.getFieldError('identifier').length > 0)}
      >
        <Form.Item
          name="identifier"
          rules={[
            { required: true, message: t('check.identifier.required') },
            {
              validator: (_, v) => {
                if (!v) return Promise.resolve();
                const trimmed = String(v).trim();
                const cleaned = trimmed.replace(/[\s-]/g, '');
                if (EMAIL_RE.test(trimmed)) return Promise.resolve();
                if (INDIAN_MOBILE_RE.test(cleaned)) return Promise.resolve();
                // Differentiate phone-shaped-but-invalid (specific Indian
                // mobile rules) from gibberish (generic). Improves
                // recoverability - user knows exactly what's wrong.
                const phoneShape = PHONE_SHAPE_RE.test(trimmed);
                return Promise.reject(
                  new Error(
                    t(phoneShape ? 'check.identifier.invalidMobile' : 'check.identifier.invalid'),
                  ),
                );
              },
            },
          ]}
          style={{ marginBottom: identifierHasError ? 48 : 32 }}
        >
          <Input
            prefix={<UserOutlined className="text-subtle" />}
            placeholder={t('check.identifier.placeholder')}
            size="large"
            autoFocus
            autoComplete="username"
            maxLength={254}
          />
        </Form.Item>
        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            block
            icon={<ArrowRightOutlined />}
            iconPlacement="end"
            className="h-[52px] font-semibold"
          >
            {t('check.submit')}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
