'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Result, Spin, Button } from 'antd';
import { useAuthStore } from '@/lib/store';
import { acceptAccountantInvite } from '@/lib/actions/finance.actions';

function Working({ label }: { label?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <Spin size="large" />
      {label ? <p style={{ marginTop: 16, color: 'var(--cr-text-2, #6b7280)' }}>{label}</p> : null}
    </div>
  );
}

function AcceptInviteInner() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  // Only the async accept result is stateful. The missing-token / not-hydrated /
  // signed-out cases are derived during render, so the effect never calls
  // setState synchronously (react-hooks/set-state-in-effect).
  const ready = Boolean(token) && isHydrated && Boolean(user);
  const [accept, setAccept] = useState<{ phase: 'working' | 'success' | 'error'; error?: string }>({
    phase: 'working',
  });

  useEffect(() => {
    if (!ready) return;
    let active = true;
    acceptAccountantInvite(token)
      .then((res) => {
        if (!active) return;
        setAccept(res.ok ? { phase: 'success' } : { phase: 'error', error: res.error });
      })
      .catch(() => {
        if (active) {
          setAccept({
            phase: 'error',
            error: 'Could not accept this invite. It may have expired or already been used.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [ready, token]);

  if (!token) {
    return (
      <Result
        status="warning"
        title="Invalid invite link"
        subTitle="This invite link is missing its token. Please use the link from your invite email."
        extra={
          <Button type="primary" onClick={() => router.push('/dashboard')}>
            Go to dashboard
          </Button>
        }
      />
    );
  }

  if (!isHydrated) return <Working />;

  if (!user) {
    return (
      <Result
        status="info"
        title="Sign in to accept this invite"
        subTitle="You have been invited as an accountant. Sign in with the account that matches the invited email address, then open this invite link again to finish."
        extra={
          <Button type="primary" onClick={() => router.push('/auth')}>
            Go to sign in
          </Button>
        }
      />
    );
  }

  if (accept.phase === 'working') return <Working label="Accepting your invite..." />;

  if (accept.phase === 'success') {
    return (
      <Result
        status="success"
        title="Accountant access granted"
        subTitle="You now have accountant access to this workspace. Open it from your dashboard to get started."
        extra={
          <Button type="primary" onClick={() => router.push('/dashboard')}>
            Go to dashboard
          </Button>
        }
      />
    );
  }

  return (
    <Result
      status="warning"
      title="Could not accept this invite"
      subTitle={accept.error}
      extra={[
        <Button key="signin" onClick={() => router.push('/auth')}>
          Sign in with a different account
        </Button>,
        <Button key="dash" type="primary" onClick={() => router.push('/dashboard')}>
          Go to dashboard
        </Button>,
      ]}
    />
  );
}

export default function AcceptInvitePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--cr-bg, #f5f5f5)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 540 }}>
        <Suspense fallback={<Working />}>
          <AcceptInviteInner />
        </Suspense>
      </div>
    </div>
  );
}
