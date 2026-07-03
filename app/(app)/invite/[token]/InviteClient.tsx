'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Alert, Tag } from 'antd';
import { BankOutlined, UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
  sendOtp,
  sendEmailRegistrationOtp,
  verifyOtp,
  register as registerAction,
} from '@/lib/actions';
import { syncAuthCookie } from '@/lib/actions/cookies';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { useAuthStore } from '@/lib/store';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import { parseApiError } from '@/lib/utils';

interface Props {
  token: string;
  workspaceName: string;
  role: string;
  invitedBy: string;
  identifier: string;
  identifierType: 'email' | 'mobile';
}

type Step = 'collect' | 'otp';

interface CollectedFormData {
  name: string;
  password: string;
}

/**
 * Wave 4.8 W4.8.5 (2026-05-10) - atomic signup-and-accept-invite client.
 *
 * Two-step:
 *   1. `collect` - name + password + (read-only) identifier. On submit,
 *      fires the existing OTP send action (mobile or email channel).
 *   2. `otp` - 6-digit OTP entry. On submit, calls verifyOtp / register
 *      with `inviteToken` set so the BE atomically creates User + joins
 *      the existing workspace via the bridge invite row.
 *
 * On success: setAuth → redirect to `/dashboard`. The dashboard layout
 * re-bootstraps workspaces + subscription + permissions on mount.
 */
export default function InviteClient({
  token,
  workspaceName,
  role,
  invitedBy,
  identifier,
  identifierType,
}: Props) {
  const t = useTranslations('auth.invite');
  // Localize backend error codes (e.g. NETWORK_UNREACHABLE on a backend-down)
  // so the invite send/verify failures never show a raw axios string. The
  // useAuthErrorMessage hook reads from the auth.errors.codes namespace.
  const authErrMsg = useAuthErrorMessage();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form] = Form.useForm<CollectedFormData>();
  const [otpForm] = Form.useForm<{ otp: string }>();
  const [step, setStep] = useState<Step>('collect');
  const [collected, setCollected] = useState<CollectedFormData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCollect = async (vals: CollectedFormData) => {
    setError(null);
    setSubmitting(true);
    try {
      if (identifierType === 'mobile') {
        const res = await sendOtp(identifier, 'register');
        if (!res.ok) {
          setError(authErrMsg(res.errorCode, res.error));
          setSubmitting(false);
          return;
        }
      } else {
        const res = await sendEmailRegistrationOtp(identifier);
        if (!res.ok) {
          setError(authErrMsg(res.errorCode, res.error));
          setSubmitting(false);
          return;
        }
      }
      setCollected(vals);
      setStep('otp');
    } catch (err) {
      // parseApiError returns the friendly NETWORK_UNREACHABLE_MESSAGE floor on a
      // backend-down instead of leaking the raw "timeout of 15000ms" message.
      setError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onVerifyOtp = async ({ otp }: { otp: string }) => {
    if (!collected) return;
    setError(null);
    setSubmitting(true);
    try {
      const res =
        identifierType === 'mobile'
          ? await verifyOtp({
              mobile: identifier,
              otp,
              flowType: 'register',
              name: collected.name,
              password: collected.password,
              inviteToken: token,
            })
          : await registerAction({
              name: collected.name,
              email: identifier,
              password: collected.password,
              emailOtp: otp,
              inviteToken: token,
            });

      if (!res.ok) {
        setError(authErrMsg(res.errorCode, res.error));
        setSubmitting(false);
        return;
      }

      const data = res.data;
      setAuth(data.user, data.accessToken, data.refreshToken);
      await syncAuthCookie(data.accessToken, data.refreshToken, data.platformAccess);
      router.replace('/dashboard');
    } catch (err) {
      // parseApiError returns the friendly NETWORK_UNREACHABLE_MESSAGE floor on a
      // backend-down instead of leaking the raw "timeout of 15000ms" message.
      setError(parseApiError(err));
      setSubmitting(false);
    }
  };

  const maskedIdentifier =
    identifierType === 'mobile' ? `+91 XXXXX ${identifier.slice(-4)}` : identifier;

  return (
    <div className="w-[28rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-surface p-6 shadow-md">
      <header className="mb-5 flex items-center gap-3">
        <div className="bg-primary-50 flex h-10 w-10 items-center justify-center rounded-full">
          <BankOutlined style={{ color: 'var(--cr-primary)', fontSize: 18 }} />
        </div>
        <div>
          <h1 className="m-0 font-display text-[18px] font-bold text-heading">
            {t('joiningWorkspace', { workspace: workspaceName })}
          </h1>
          <p className="m-0 text-[12px] text-muted">
            {t('invitedBy', { inviter: invitedBy })} ·{' '}
            <Tag color="gold" style={{ marginInlineStart: 0, fontSize: 10 }}>
              {role}
            </Tag>
          </p>
        </div>
      </header>

      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          className="mb-4"
          closable
          onClose={() => setError(null)}
        />
      )}

      {step === 'collect' && (
        <Form form={form} layout="vertical" requiredMark={false} onFinish={onCollect}>
          <Form.Item label={t('identifierLabel')}>
            <Input
              value={maskedIdentifier}
              disabled
              prefix={identifierType === 'mobile' ? <PhoneOutlined /> : <MailOutlined />}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label={t('nameLabel')}
            rules={[
              { required: true, message: t('nameRequired') },
              { min: 2, message: t('nameMinLength') },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder={t('namePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('passwordLabel')}
            rules={[
              { required: true, message: t('passwordRequired') },
              { min: 8, message: t('passwordMinLength') },
            ]}
          >
            <PasswordInput placeholder={t('passwordPlaceholder')} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>
            {t('sendCode')}
          </Button>
        </Form>
      )}

      {step === 'otp' && collected && (
        <Form form={otpForm} layout="vertical" requiredMark={false} onFinish={onVerifyOtp}>
          <p className="mb-4 text-[13px] text-muted">
            {t('codeSentTo', { identifier: maskedIdentifier })}
          </p>
          <Form.Item
            name="otp"
            label={t('otpLabel')}
            rules={[
              { required: true, message: t('otpRequired') },
              {
                pattern: /^\d{6}$/,
                message: t('otpFormat'),
              },
            ]}
          >
            <Input
              maxLength={6}
              inputMode="numeric"
              placeholder="• • • • • •"
              autoFocus
              autoComplete="one-time-code"
            />
          </Form.Item>
          <div className="flex flex-col gap-2">
            <Button type="primary" htmlType="submit" loading={submitting} block>
              {t('verifyAndAccept')}
            </Button>
            <Button
              type="link"
              onClick={() => {
                setStep('collect');
                setError(null);
              }}
            >
              {t('changeDetails')}
            </Button>
          </div>
        </Form>
      )}
    </div>
  );
}
