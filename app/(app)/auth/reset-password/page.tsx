'use client';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Form, Input, Button, Alert, Spin } from 'antd';
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { resetPassword } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Suspense } from 'react';

function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';
  const [form] = Form.useForm();
  const t = useTranslations('auth');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (vals: { password: string; confirm: string }) => {
    if (vals.password !== vals.confirm) {
      setError(t('resetPassword.confirm.mismatch'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword(token, vals.password);
      setSuccess(true);
    } catch (e: unknown) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  if (!token)
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-[420px] rounded-2xl bg-surface p-10 text-center shadow-lg">
          <p className="text-[15px] text-error">{t('resetPassword.invalidLink')}</p>
          <Button type="primary" onClick={() => router.replace('/auth')} className="mt-4">
            {t('resetPassword.invalidLinkBack')}
          </Button>
        </div>
      </div>
    );

  if (success)
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-[420px] rounded-2xl bg-surface p-10 text-center shadow-lg">
          <div className="mb-4 text-[52px]">🔐</div>
          <h2 className="mb-2.5 font-display text-[22px] font-extrabold text-primary">
            {t('resetPassword.success.title')}
          </h2>
          <p className="mb-6 text-sm text-secondary">{t('resetPassword.success.subtitle')}</p>
          <Button type="primary" size="large" block onClick={() => router.replace('/auth')}>
            {t('resetPassword.success.submit')}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[420px] rounded-2xl bg-surface px-9 py-10 shadow-lg">
        {/* Logo */}
        <div className="mb-7 flex items-center gap-2.5">
          <div className="bg-gradient-primary flex h-9 w-9 items-center justify-center rounded-md">
            <svg width="18" height="18" fill="none" stroke="var(--cr-surface)" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <span className="font-display text-lg font-extrabold text-primary">
            {t('hero.brand')}
          </span>
        </div>

        <h2 className="mb-1.5 font-display text-[22px] font-extrabold text-primary">
          {t('resetPassword.title')}
        </h2>
        <p className="mb-6 text-[13px] text-secondary">{t('resetPassword.subtitle')}</p>

        {error && <Alert type="error" title={error} showIcon className="mb-4 rounded-md" />}

        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="password"
            label={t('resetPassword.password.label')}
            rules={[
              { required: true, message: t('resetPassword.password.required') },
              { min: 8, message: t('resetPassword.password.minLength') },
            ]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder={t('resetPassword.password.placeholder')}
              autoComplete="new-password"
              iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>
          <Form.Item
            name="confirm"
            label={t('resetPassword.confirm.label')}
            rules={[{ required: true, message: t('resetPassword.confirm.required') }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder={t('resetPassword.confirm.placeholder')}
              autoComplete="new-password"
              iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loading}
            className="mt-1"
          >
            {t('resetPassword.submit')}
          </Button>
          <Button type="link" block className="mt-2" onClick={() => router.replace('/auth')}>
            {t('resetPassword.backLink')}
          </Button>
        </Form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin size="large" />
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
