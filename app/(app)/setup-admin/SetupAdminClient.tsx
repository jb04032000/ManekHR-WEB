'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Form, Input, Button, Alert } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { setupAdmin } from '@/lib/actions';
import { useAuthStore } from '@/lib/store';
import { clearAuthCookie } from '@/lib/actions/cookies';

export default function SetupAdminClient() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const { user, logout } = useAuthStore();

  const handleSignInAsAdmin = async () => {
    // Always clear the session - a fresh login is required to get isAdmin: true in the token
    if (user) {
      logout();
      await clearAuthCookie();
    }
    // Use window.location to force a full page reload and clear any cached state
    window.location.href = '/auth';
  };

  const handleSubmit = async (vals: { identifier: string; secret: string }) => {
    setError('');
    setLoading(true);
    const res = await setupAdmin(vals.identifier, vals.secret);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccessMsg(res.data.message);
    setDone(true);
  };

  return (
    <main className="flex min-h-screen font-body">
      {/* Left hero panel - decorative-only on desktop. The big "One-time admin
         setup" copy is intentionally NOT a heading element so the form panel's
         H1 ("Admin Bootstrap") remains the page's primary heading and is not
         preceded by a sibling heading in DOM source order. */}
      <div
        className="auth-hero relative hidden w-[480px] flex-shrink-0 flex-col justify-between overflow-hidden p-10"
        style={{
          background:
            'linear-gradient(160deg,var(--cr-charcoal) 0%,var(--cr-indigo-800) 50%,var(--cr-indigo-700) 100%)',
        }}
      >
        {/* Decorative rings */}
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full border border-white/[0.12]" />
        <div className="absolute top-10 right-10 h-45 w-45 rounded-full border border-white/[0.08]" />
        <div className="absolute -bottom-15 -left-15 h-65 w-65 rounded-full border border-white/[0.1]" />

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white/20 backdrop-blur-sm">
            <svg width="18" height="18" fill="none" stroke="var(--cr-surface)" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <span className="font-display text-xl font-extrabold text-surface">ManekHR</span>
        </Link>

        {/* Center */}
        <div>
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <SafetyCertificateOutlined style={{ fontSize: 32, color: 'rgba(255,255,255,0.85)' }} />
          </div>
          <div className="mb-4 font-display text-4xl leading-tight font-extrabold text-surface">
            One-time admin setup
          </div>
          <p className="mb-6 text-[15px] leading-relaxed text-white/70">
            This page grants admin privileges to an existing user account. It can only be used once
            - after the first admin is set, this endpoint is locked.
          </p>
          {[
            'Requires the ADMIN_SETUP_SECRET from your .env',
            'The user account must already exist',
            'After setup, log in again to access /admin',
            'Cannot be used a second time',
          ].map((note, i) => (
            <div key={i} className="mb-3 flex items-start gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
                <svg
                  width="10"
                  height="10"
                  fill="none"
                  stroke="var(--cr-surface)"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <span className="text-sm text-white/80">{note}</span>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-white/40">
          This page is safe to leave public - the secret key is the only protection needed.
        </p>
      </div>

      {/* Right: form panel (carries the page H1 "Admin Bootstrap"). */}
      <div className="flex flex-1 items-center justify-center bg-page px-6 py-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <Link
            href="/"
            className="mobile-logo-link mb-8 flex items-center justify-center gap-2.5 no-underline"
          >
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[var(--cr-grad-primary)]">
              <svg
                width="17"
                height="17"
                fill="none"
                stroke="var(--cr-surface)"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <span className="font-display text-xl font-extrabold text-heading">ManekHR</span>
          </Link>

          <div className="rounded-[20px] border border-border bg-surface p-10 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            {done ? (
              <div className="py-2 text-center">
                <CheckCircleFilled
                  style={{ fontSize: 52, color: 'var(--cr-success, var(--cr-success-500))' }}
                  className="mb-4 block"
                />
                <h1 className="m-0 mb-2 font-display text-2xl font-extrabold text-heading">
                  Admin access granted!
                </h1>
                <p className="m-0 mb-4 text-sm leading-relaxed text-muted">{successMsg}</p>
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-left">
                  <p className="m-0 mb-1 text-xs font-semibold text-amber-800">
                    {user ? 'You must sign in fresh' : 'Sign in to activate admin'}
                  </p>
                  <p className="m-0 text-xs leading-relaxed text-amber-700">
                    {user
                      ? 'Your current session was created before admin was granted. Click below to sign out - then sign back in and you will land directly in the Admin Panel.'
                      : "Sign in with the admin account's email or mobile. You will land directly in the Admin Panel - no workspace required."}
                  </p>
                </div>
                <Button
                  type="primary"
                  size="large"
                  block
                  onClick={handleSignInAsAdmin}
                  className="h-[52px] font-semibold"
                >
                  {user ? 'Sign out & Sign in as Admin →' : 'Sign in as Admin →'}
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--cr-grad-primary)]">
                    <SafetyCertificateOutlined style={{ fontSize: 20, color: '#fff' }} />
                  </div>
                  <div>
                    <h1 className="m-0 font-display text-xl leading-tight font-extrabold text-heading">
                      Admin Bootstrap
                    </h1>
                    <p className="m-0 text-xs text-muted">One-time setup only</p>
                  </div>
                </div>

                {/* Step instructions */}
                <div className="mb-5 rounded-xl border border-[var(--cr-primary-border,var(--cr-primary-border))] bg-[var(--cr-primary-light,var(--cr-info-50))] p-3.5">
                  <p className="m-0 mb-1.5 text-xs font-semibold text-body">How this works:</p>
                  <ol className="m-0 space-y-1 pl-4 text-xs leading-relaxed text-body">
                    <li>
                      <Link
                        href="/auth?mode=register"
                        className="font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        Register an account
                      </Link>{' '}
                      at /auth if you haven&apos;t already
                    </li>
                    <li>Enter that account&apos;s email or mobile below</li>
                    <li>
                      Enter the{' '}
                      <code className="rounded bg-white/70 px-1 font-mono">ADMIN_SETUP_SECRET</code>{' '}
                      from your backend{' '}
                      <code className="rounded bg-white/70 px-1 font-mono">.env</code>
                    </li>
                    <li>Then sign in normally - admin panel will be unlocked</li>
                  </ol>
                </div>

                {error && (
                  <Alert
                    type="error"
                    title={error}
                    showIcon
                    className="mb-5 rounded-[10px]"
                    closable={{ onClose: () => setError('') }}
                  />
                )}

                <div suppressHydrationWarning>
                  <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
                    <Form.Item
                      name="identifier"
                      label="Email or Mobile"
                      rules={[
                        { required: true, message: 'Please enter your email or mobile number' },
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined className="text-subtle" />}
                        placeholder="you@example.com or 9999..."
                        size="large"
                        autoFocus
                        autoComplete="username"
                        data-lpignore="true"
                        data-form-type="other"
                      />
                    </Form.Item>

                    <Form.Item
                      name="secret"
                      label="Setup Secret"
                      rules={[{ required: true, message: 'Please enter the setup secret' }]}
                      extra={
                        <span className="text-xs text-subtle">
                          The value of{' '}
                          <code className="rounded bg-border px-1">ADMIN_SETUP_SECRET</code> in your
                          backend .env
                        </span>
                      }
                    >
                      <Input.Password
                        prefix={<LockOutlined className="text-subtle" />}
                        placeholder="Your ADMIN_SETUP_SECRET value"
                        size="large"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-form-type="other"
                      />
                    </Form.Item>

                    <Form.Item className="mt-2 mb-0">
                      <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        loading={loading}
                        block
                        className="h-[52px] font-semibold"
                      >
                        Grant Admin Access
                      </Button>
                    </Form.Item>
                  </Form>
                </div>

                <p className="mt-6 mb-0 text-center text-sm text-subtle">
                  <Link
                    href="/auth?mode=register"
                    className="font-semibold text-primary hover:underline"
                  >
                    Register an account
                  </Link>
                  <span className="mx-2 text-border">|</span>
                  <Link href="/auth" className="text-subtle hover:text-muted">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .auth-hero { display: flex !important; }
          .mobile-logo-link { display: none !important; }
        }
      `}</style>
    </main>
  );
}
