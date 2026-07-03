'use client';

import { useState } from 'react';
import { Form, Button, Alert } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { login as loginAction } from '@/lib/actions';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import { DsButton } from '@/components/ui';
import { PasswordInput } from '@/components/auth/PasswordInput';
// Suspended-account-scheduled-for-deletion login notice (DPDP §A.2). The backend
// 403 carries a complete recover-by message; show it calmly with a contact link
// instead of the generic red error. Recovery is admin-mediated (no self-undo).
import { ScheduledDeletionLoginNotice } from '@/components/account-deletion/ScheduledDeletionLoginNotice';
import type { AuthSuccessHandler, BaseModeProps } from './types';

/** BE 403 error code for a login attempt against an account scheduled for deletion. */
const ACCOUNT_SCHEDULED_FOR_DELETION = 'ACCOUNT_SCHEDULED_FOR_DELETION';

interface LoginModeProps extends BaseModeProps, AuthSuccessHandler {
  onCredentialsCaptured: (creds: { identifier: string; password: string }) => void;
}

export function LoginMode({
  setMode,
  identifier,
  setIdentifier,
  onAuthSuccess,
  onSessionLimit,
  onCredentialsCaptured,
}: LoginModeProps) {
  const t = useTranslations('auth');
  // Localize a backend error code (e.g. NETWORK_UNREACHABLE when the API is
  // down) into the active locale, falling back to the server-provided message
  // for codes without a translation. Same pattern as OtpVerifyMode so a raw
  // axios "timeout of 15000ms exceeded" never reaches the user.
  const authErrMsg = useAuthErrorMessage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Distinct from `error`: the account is scheduled for deletion (suspended). We
  // show the backend's recover-by message as a calm notice, not a hard error.
  const [deletionNotice, setDeletionNotice] = useState('');

  const handleLogin = async (vals: { password: string }) => {
    setError('');
    setDeletionNotice('');
    setLoading(true);
    const res = await loginAction(identifier, vals.password);
    if (!res.ok) {
      if (res.error === 'SESSION_LIMIT_REACHED' && res.sessionData) {
        onCredentialsCaptured({ identifier, password: vals.password });
        onSessionLimit(res.sessionData as { activeSessions?: never[] });
        setLoading(false);
        return;
      }
      if (res.errorCode === ACCOUNT_SCHEDULED_FOR_DELETION) {
        setDeletionNotice(res.error);
        setLoading(false);
        return;
      }
      setError(authErrMsg(res.errorCode, res.error));
      setLoading(false);
      return;
    }
    await onAuthSuccess(res.data);
  };

  return (
    <>
      <button
        onClick={() => {
          setMode('check');
          setError('');
          setDeletionNotice('');
          setIdentifier('');
          form.resetFields();
        }}
        className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-body"
      >
        <ArrowLeftOutlined /> {t('login.back')}
      </button>
      <h1 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
        {t('login.title')}
      </h1>
      <p className="m-0 mb-2 pt-2 text-[13px] text-muted">{t('login.subtitle')}</p>
      <p className="m-0 mb-6 text-[12px] text-subtle">
        {t('login.subtitleAs')} <strong className="text-primary">{identifier}</strong>
      </p>
      {deletionNotice && <ScheduledDeletionLoginNotice message={deletionNotice} />}
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          className="mb-4 rounded-[10px]"
          closable={{ onClose: () => setError('') }}
        />
      )}
      <Form form={form} layout="vertical" onFinish={handleLogin} requiredMark={false}>
        <Form.Item
          name="password"
          label={t('login.password.label')}
          rules={[{ required: true, message: t('login.password.required') }]}
        >
          <PasswordInput
            placeholder={t('login.password.placeholder')}
            autoFocus
            autoComplete="current-password"
          />
        </Form.Item>
        <div className="-mt-3 mb-3 flex justify-end">
          <DsButton
            htmlType="button"
            dsVariant="ghost"
            dsSize="sm"
            onClick={() => {
              setMode('forgot');
              setError('');
            }}
            style={{
              padding: 0,
              height: 'auto',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--cr-primary)',
            }}
          >
            {t('login.forgotPassword')}
          </DsButton>
        </div>
        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            block
            className="h-[46px] font-semibold"
          >
            {t('login.submit')}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
