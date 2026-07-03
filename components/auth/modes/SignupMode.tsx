'use client';

/**
 * SignupMode - person-only signup (name + password + optional ref code).
 *
 * Task 22 addition (2026-06-19, referral program): when REFERRAL_ENABLED=true,
 * renders an optional "Referral code" input prefilled from `initialRefCode`
 * (sourced from ?ref= or localStorage `cr_ref` by AuthClient). The field is
 * editable; light validation pattern `^[A-Za-z2-9]{6,10}$` prevents an
 * obviously invalid value from being forwarded but NEVER hard-blocks submit.
 * The code is forwarded in `SignupFormData.referralCode` to the OTP/email
 * verify step and on to the backend. No-op when REFERRAL_ENABLED=false.
 *
 * Cross-module: referral-gate.ts (kill switch) / AuthClient.tsx (initialRefCode
 * prop / capturedRefCode state) / OtpVerifyMode.tsx + EmailOtpVerifyMode.tsx
 * (both read signupFormData.referralCode and forward to the BE).
 * Watch: i18n keys connect.referrals.signup.{label,placeholder,hint} are added
 * by Phase 9. The component falls through to auth.* keys below that.
 */

import { useState } from 'react';
import { Form, Input, Button, Checkbox } from 'antd';
import {
  ArrowLeftOutlined,
  CloseCircleFilled,
  CloseOutlined,
  EditOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { register as registerAction, sendEmailRegistrationOtp, sendOtp } from '@/lib/actions';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import { PasswordInput } from '@/components/auth/PasswordInput';
// Reused from the login screen: a calm "scheduled for deletion - contact us to
// recover" notice shown when re-signing up with an identifier whose account is
// still in its 30-day deletion grace (Option B, ACCOUNT-DELETION §9).
import { ScheduledDeletionLoginNotice } from '@/components/account-deletion/ScheduledDeletionLoginNotice';
import { InfoTooltip } from '@/components/ui';
import { env } from '@/lib/env';
import type { BaseModeProps, SignupFormData, SignupIntent } from './types';
import type { AuthResult } from '@/types';
// Connect product removed (2026-07-04): referral program permanently dark.
const REFERRAL_ENABLED = false;

interface SignupModeProps extends BaseModeProps {
  /**
   * One of `mobile` or `email` is supplied - confirmed not-existing by
   * CheckMode. Branches the submit:
   *   - mobile → /auth/send-otp + transition to OtpVerifyMode (OTP entry
   *     triggers /auth/verify-otp creating the User).
   *   - email → /auth/email-otp/send-register + transition to
   *     EmailOtpVerifyMode (OTP entry triggers /auth/register with
   *     emailOtp creating the User).
   * Both channels OTP-gate User creation - parity confirmed.
   */
  mobile?: string;
  email?: string;
  /** Mobile path (SMS OTP on). Required when channel='mobile' and OTP is enabled. */
  onProceedToOtp?: (
    data: SignupFormData,
    sendResult: { resendCooldownSec: number; mockMode: boolean },
  ) => void;
  /**
   * Mobile path, interim (SMS OTP off): the account is created immediately via
   * /auth/register (name+password, no OTP, phone unverified) and the AuthResult
   * is handed up for the same post-signup routing the OTP path uses. Wired by
   * the orchestrator only when `env.smsOtpEnabled` is false.
   */
  onMobileSignupNoOtp?: (result: AuthResult, product: 'connect' | 'erp') => void;
  /** Email path. Required when channel='email'. */
  onProceedToEmailOtp?: (data: SignupFormData, sendResult: { resendCooldownSec: number }) => void;
  /**
   * URL-driven signup intent (from `?for=` query) - `null` means the URL did
   * not pin a product, so the in-form `<IntentPicker>` sub-step runs first.
   * Stays stable across renders: the prop is the query-string value, not the
   * picker selection. The picker writes only to local `pickedIntent` state so
   * the Change pill (gated on `intent === null`) stays meaningful - picker
   * users see Change; URL-driven users do not.
   */
  intent: SignupIntent;
  /**
   * Task 22 - pre-captured referral code from `?ref=` query or localStorage
   * `cr_ref`, forwarded by `AuthClient`. Empty string when REFERRAL_ENABLED
   * is false or no code was found. Used to prefill the optional referral input.
   */
  initialRefCode?: string;
}

/** BE conflict code when the typed identifier belongs to an account still in its
 *  deletion-recovery window (Option B). Shown as a calm notice, not a red error. */
const ACCOUNT_SCHEDULED_FOR_DELETION = 'ACCOUNT_SCHEDULED_FOR_DELETION';

function maskMobile(mobileFull: string): string {
  const digits = mobileFull.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return digits.length === 12 ? `+91 XXXXX X${last4}` : `XXXXX X${last4}`;
}

/**
 * Person-only signup screen - captures name + password upfront. The verify
 * step (OTP confirmation on mobile or email) creates the User only;
 * a workspace, if needed, is created afterward in the guided workspace step.
 *
 * Note: form data lives in component state only - never persisted to
 * localStorage. If the user navigates away, the password is dropped (correct
 * behaviour: don't keep plaintext credentials around).
 */
export function SignupMode({
  setMode,
  mobile,
  email,
  onProceedToOtp,
  onMobileSignupNoOtp,
  onProceedToEmailOtp,
  intent,
  initialRefCode = '',
}: SignupModeProps) {
  const t = useTranslations('auth');
  const tRef = useTranslations('connect.referrals');
  // Shared UI strings (e.g. the error-banner dismiss aria-label) live under the
  // top-level `common` namespace, not `auth`.
  const tCommon = useTranslations('common');
  // Localize backend error codes (e.g. NETWORK_UNREACHABLE on a backend-down)
  // so the send-OTP failures never show a raw axios string.
  const authErrMsg = useAuthErrorMessage();
  const [pickedIntent, setPickedIntent] = useState<'connect' | 'erp' | null>(null);
  // Connect product removed (2026-07-04): ManekHR is single-product, so signup
  // always pins ERP and the IntentPicker sub-step is gone.
  const effectiveIntent: 'connect' | 'erp' | null = intent ?? pickedIntent ?? 'erp';
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Distinct from `error`: the typed identifier belongs to an account scheduled
  // for deletion (still recoverable). Shown as a calm notice, like LoginMode.
  const [deletionNotice, setDeletionNotice] = useState('');
  // Task 22 - local referral code state, prefilled from the captured ref code.
  // Only active when REFERRAL_ENABLED=true; not rendered or forwarded otherwise.
  const [refCode, setRefCode] = useState(initialRefCode);

  const channel: 'mobile' | 'email' = mobile ? 'mobile' : 'email';
  // Interim mobile signup (SMS OTP off) creates the account directly with no
  // code sent, so the "we'll send a code" copy + "Send code" button would lie.
  // Swap to neutral "create account" wording for that one case only; email and
  // SMS-on mobile keep the verification-code copy.
  const isMobileInterim = channel === 'mobile' && !env.smsOtpEnabled;

  /** Validate + normalise the referral code: trim, uppercase, apply pattern.
   *  Returns the clean value to forward, or '' to skip (never blocks submit). */
  const normaliseRefCode = (raw: string): string => {
    const CODE_RE = /^[A-Za-z2-9]{6,10}$/;
    const cleaned = raw.trim().toUpperCase();
    return CODE_RE.test(cleaned) ? cleaned : '';
  };

  /** Surface an auth-action failure. A deletion-grace conflict (Option B) shows
   *  the calm "scheduled for deletion - contact us to recover" notice; anything
   *  else is the normal inline error. Both messages are localized via authErrMsg. */
  const surfaceAuthError = (res: { error: string; errorCode?: string }) => {
    if (res.errorCode === ACCOUNT_SCHEDULED_FOR_DELETION) {
      setDeletionNotice(authErrMsg(res.errorCode, res.error));
    } else {
      setError(authErrMsg(res.errorCode, res.error));
    }
    setLoading(false);
  };

  const handleSubmit = async (vals: {
    name: string;
    password: string;
    confirm: string;
    policyAccepted: boolean;
  }) => {
    // `effectiveIntent` is non-null inside the form branch because the early
    // return below blocks rendering when it's null (picker shows instead). The
    // explicit runtime guard re-narrows the type for TS AND defends against a
    // pathological stray submit ever shipping a malformed payload.
    if (effectiveIntent === null) return;
    setError('');
    setDeletionNotice('');
    setLoading(true);

    // Task 22 - sanitise the referral code (never hard-block submit on invalid).
    // Robustness: prefer the visible field value (`refCode`), but fall back to the
    // captured code (`initialRefCode`, sourced from ?ref= / cr_ref cookie /
    // localStorage by AuthClient) if the user cleared or never touched the field.
    // This guarantees that merely clicking a /auth?ref=CODE link attributes the
    // referral even with an untouched field - the input is a convenience/override,
    // never required. Empty string when REFERRAL_ENABLED=false (feature is dark).
    const validRefCode = REFERRAL_ENABLED ? normaliseRefCode(refCode || initialRefCode) : '';

    if (channel === 'mobile' && mobile) {
      // Interim (SMS OTP off): create the account immediately with name+password,
      // no OTP. The phone is left unverified (BE `isMobileVerified` default false)
      // and force-verified later by MobileVerificationGate once SMS is live. The
      // BE `/auth/register` mobile path does the same setup as the OTP path (free
      // plan, handle, session, tokens), so the post-signup routing is identical.
      if (!env.smsOtpEnabled && onMobileSignupNoOtp) {
        const res = await registerAction({
          name: vals.name.trim(),
          mobile,
          password: vals.password,
          acceptedPolicy: effectiveIntent,
          ...(validRefCode ? { referralCode: validRefCode } : {}),
        });
        if (!res.ok) {
          surfaceAuthError(res);
          return;
        }
        onMobileSignupNoOtp(res.data, effectiveIntent);
        setLoading(false);
        return;
      }
      // SMS OTP on: send the code, then OtpVerifyMode calls /auth/verify-otp to
      // create the verified account.
      if (onProceedToOtp) {
        const res = await sendOtp(mobile, 'register');
        if (!res.ok) {
          surfaceAuthError(res);
          return;
        }
        const formData: SignupFormData = {
          mobile,
          name: vals.name.trim(),
          password: vals.password,
          product: effectiveIntent,
          ...(validRefCode ? { referralCode: validRefCode } : {}),
        };
        onProceedToOtp(formData, {
          resendCooldownSec: res.data.resendCooldownSec,
          mockMode: res.data.mockMode,
        });
        setLoading(false);
        return;
      }
    }

    if (channel === 'email' && email && onProceedToEmailOtp) {
      const res = await sendEmailRegistrationOtp(email);
      if (!res.ok) {
        surfaceAuthError(res);
        return;
      }
      const formData: SignupFormData = {
        email,
        name: vals.name.trim(),
        password: vals.password,
        product: effectiveIntent,
        ...(validRefCode ? { referralCode: validRefCode } : {}),
      };
      onProceedToEmailOtp(formData, {
        resendCooldownSec: res.data.resendCooldownSec,
      });
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  // (IntentPicker removed with the Connect product — effectiveIntent is never null.)

  return (
    /* AuthClient widens the outer wrapper to 880px while mode='signup' so the
       IntentPicker has room for its two side-by-side product cards. The form
       itself is still a single column of compact inputs and reads best at
       ~420px, so we re-constrain here with `mx-auto max-w-[420px]`. */
    <div className="mx-auto w-full max-w-[420px]">
      <button
        onClick={() => setMode('check')}
        className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-body"
      >
        <ArrowLeftOutlined /> {t('signup.back')}
      </button>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-[12px] text-muted">
        <span>
          {/* Brand name comes from `productName`, NOT `.title`: the 2026-07-02
              IntentPicker redesign made `.title` a verb phrase ("Find work,
              buyers and people"), which would read broken inside this pill. */}
          {t.rich('signup.intent.changePill', {
            product: () => (
              <strong className="text-heading">
                {t(
                  effectiveIntent === 'erp'
                    ? 'signup.intent.erp.productName'
                    : 'signup.intent.connect.productName',
                )}
              </strong>
            ),
          })}
        </span>
        {/* Connect product removed (2026-07-04): single product, so there is no
            intent picker and no "Change" affordance. */}
      </div>
      <h1 className="m-0 mb-2 font-display text-2xl font-extrabold text-heading">
        {t('signup.title')}
      </h1>
      <p className="m-0 mb-2 text-[13px] leading-relaxed text-muted">{t('signup.subtitle')}</p>
      <p className="m-0 mb-5 text-[12px] text-subtle">
        {t(isMobileInterim ? 'signup.creatingFor' : 'signup.sentTo')}{' '}
        <strong className="text-primary">
          {channel === 'mobile' ? maskMobile(mobile ?? '') : email}
        </strong>{' '}
        <button
          type="button"
          onClick={() => setMode('check')}
          className="ml-1 inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[12px] font-medium text-primary hover:underline"
          aria-label={channel === 'mobile' ? t('signup.editAriaMobile') : t('signup.editAriaEmail')}
        >
          <EditOutlined /> {t('signup.edit')}
        </button>
      </p>
      {deletionNotice && <ScheduledDeletionLoginNotice message={deletionNotice} />}
      {error && (
        // Shared signup error banner (disposable-email block, account-exists,
        // network down, ...). Hand-rolled instead of AntD <Alert>: v6 styles
        // Alert's inner nodes via :where() selectors that fought our spacing
        // overrides, so we own the markup here for full control of padding,
        // icon alignment, and multi-line leading. Dismissable via setError('').
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-[10px] border border-[#ffccc7] bg-[#fff2f0] px-4 py-3.5"
        >
          <CloseCircleFilled className="mt-0.5 shrink-0 text-[18px] text-[#d4380d]" />
          <p className="m-0 flex-1 text-[15px] leading-[1.7] text-body">{error}</p>
          <button
            type="button"
            aria-label={tCommon('close')}
            onClick={() => setError('')}
            className="mt-0.5 shrink-0 text-[13px] text-subtle transition-colors hover:text-body"
          >
            <CloseOutlined />
          </button>
        </div>
      )}
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <h2 className="mb-3 font-display text-[13px] font-semibold tracking-wide text-subtle uppercase">
          {t('signup.sectionAccount')}
        </h2>
        <Form.Item
          name="name"
          label={t('signup.name.label')}
          rules={[
            { required: true, message: t('signup.name.required') },
            { min: 2, message: t('signup.name.minLength') },
          ]}
        >
          <Input
            prefix={<UserOutlined className="text-subtle" />}
            placeholder={t('signup.name.placeholder')}
            size="large"
            autoFocus
            autoComplete="name"
            maxLength={120}
          />
        </Form.Item>
        <Form.Item
          name="password"
          label={
            <span className="flex items-center gap-1.5">
              {t('signup.password.label')}
              <InfoTooltip text={t('signup.password.tooltipText')} iconClassName="text-[12px]" />
            </span>
          }
          rules={[
            { required: true, message: t('signup.password.required') },
            { min: 8, message: t('signup.password.minLength') },
          ]}
        >
          <PasswordInput
            placeholder={t('signup.password.placeholder')}
            autoComplete="new-password"
          />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={t('signup.confirm.label')}
          dependencies={['password']}
          rules={[
            { required: true, message: t('signup.confirm.required') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t('signup.confirm.mismatch')));
              },
            }),
          ]}
        >
          <PasswordInput
            placeholder={t('signup.confirm.placeholder')}
            autoComplete="new-password"
          />
        </Form.Item>

        {/* Task 22 - optional referral code field. Only renders when
            REFERRAL_ENABLED=true. Prefilled from AuthClient's capturedRefCode
            (sourced from ?ref= or localStorage cr_ref) via `initialRefCode`.
            User can edit or clear it. Invalid value (fails pattern) is silently
            dropped at submit - never hard-blocks. i18n keys added by Phase 9.

            IMPORTANT: this Form.Item deliberately has NO `name`. The field is a
            fully-controlled input bound to local `refCode` state (initialised
            from `initialRefCode`). Giving it a `name` hands ownership to the AntD
            Form store, which has no initialValues.referralCode, so it would
            render EMPTY and ignore the controlled `value` - the original bug that
            made ?ref= prefill silently fail. Keep it nameless so `value`/
            `onChange` stay authoritative. The value is read from `refCode` at
            submit, not from the form store. */}
        {REFERRAL_ENABLED && (
          <Form.Item
            label={tRef('signup.label')}
            extra={<span className="text-[11px] text-subtle">{tRef('signup.hint')}</span>}
          >
            <Input
              placeholder={tRef('signup.placeholder')}
              value={refCode}
              onChange={(e) => setRefCode(e.target.value)}
              maxLength={10}
              autoComplete="off"
            />
          </Form.Item>
        )}

        {/* Owner-info note. Matches the modernised treatment on
            RegisterWorkspaceMode: lucide-react Info icon (no emoji),
            `rounded-lg` to align with input + disclosure radius, tighter
            padding, primary-tinted wash + border via tokens. */}
        <div
          className="mb-5 flex items-start gap-3 rounded-lg px-3.5 py-3"
          style={{
            background: 'var(--cr-primary-light)',
            border: '1px solid var(--cr-primary-border)',
          }}
        >
          <Info
            size={16}
            strokeWidth={2.25}
            aria-hidden
            className="mt-0.5 flex-shrink-0"
            style={{ color: 'var(--cr-primary)' }}
          />
          <p className="m-0 text-[12px] leading-relaxed text-body">{t('signup.ownerNote')}</p>
        </div>
        <Form.Item
          name="policyAccepted"
          valuePropName="checked"
          rules={[
            {
              validator: (_, v: boolean) =>
                v
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(
                        t(
                          effectiveIntent === 'erp'
                            ? 'signup.policyErp.required'
                            : 'signup.policy.required',
                        ),
                      ),
                    ),
            },
          ]}
        >
          <Checkbox>
            {t.rich(effectiveIntent === 'erp' ? 'signup.policyErp.label' : 'signup.policy.label', {
              // T&C link points to the single canonical /terms page (not the
              // intent-split /terms/erp | /terms/connect). Opens in a new tab so
              // the half-filled signup form is preserved.
              terms: (chunks) => (
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  {chunks}
                </a>
              ),
            })}
          </Checkbox>
        </Form.Item>
        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            block
            className="h-[52px] font-semibold"
          >
            {t(isMobileInterim ? 'signup.submitInterim' : 'signup.submit')}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
