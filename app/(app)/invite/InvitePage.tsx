'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { Spin, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { joinWorkspace, acceptTeamInvite, declineWorkspaceInvite } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

type InviteState = 'loading' | 'success' | 'error' | 'auth_required' | 'declined';

/* ── Shared SVG icon for the logo mark ─────────────────────── */
const LogoIcon = () => (
  <svg width="22" height="22" fill="none" stroke="var(--cr-surface)" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

export default function InvitePage() {
  const t = useTranslations('invite');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isHydrated } = useAuthStore();

  const token = searchParams.get('token');
  const type = searchParams.get('type') ?? 'workspace';

  const [state, setState] = useState<InviteState>('loading');
  const [message, setMessage] = useState('');
  const [wsName, setWsName] = useState('');

  useEffect(() => {
    if (!isHydrated) return;

    // Validation checks - set state in next tick to avoid sync setState in effect
    if (!token) {
      setTimeout(() => {
        setState('error');
        setMessage(t('invalidToken'));
      }, 0);
      return;
    }

    if (!user) {
      setTimeout(() => setState('auth_required'), 0);
      return;
    }

    // Accept invite
    const acceptInvite = async () => {
      setState('loading');
      try {
        if (type === 'team') {
          await acceptTeamInvite(token);
          setWsName('');
        } else {
          const res = await joinWorkspace(token);
          if (res && 'name' in res) setWsName((res as { name: string }).name ?? '');
        }
        setState('success');
      } catch (e: unknown) {
        setMessage(parseApiError(e));
        setState('error');
      }
    };

    acceptInvite();
  }, [isHydrated, user, token, type]);

  /* ── Loading ─────────────────────────────────────────────── */
  if (state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-lg">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-[var(--cr-grad-primary)]">
            <LogoIcon />
          </div>
          <Spin size="large" style={{ marginBottom: 16 }} />
          <p className="mt-md text-sm text-muted">{t('accepting')}</p>
        </div>
      </main>
    );
  }

  /* ── Auth required ───────────────────────────────────────── */
  if (state === 'auth_required') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-lg">
        <div className="w-full max-w-[440px] rounded-2xl bg-surface px-2xl py-[40px] text-center shadow-lg">
          <div className="mx-auto mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-[var(--cr-grad-primary)]">
            <LogoIcon />
          </div>
          <h2 className="mb-2.5 font-display text-2xl font-extrabold text-heading">
            {t('invitedTitle')}
          </h2>
          <p className="text-sm leading-relaxed text-muted">{t('invitedDesc')}</p>
          <div className="mt-lg flex flex-wrap justify-center gap-2.5">
            <Button
              type="primary"
              size="large"
              style={{ minWidth: 140 }}
              onClick={() => router.push(`/auth?redirect=/invite?token=${token}&type=${type}`)}
            >
              {t('signIn')}
            </Button>
            <Button
              size="large"
              style={{ minWidth: 140 }}
              onClick={() =>
                router.push(`/auth?mode=register&redirect=/invite?token=${token}&type=${type}`)
              }
            >
              {t('createAccount')}
            </Button>
          </div>
          {type === 'workspace' && (
            <Button
              size="large"
              style={{ marginTop: 16 }}
              onClick={async () => {
                if (!token) return;
                try {
                  await declineWorkspaceInvite(token);
                  setState('declined');
                } catch (e) {
                  setMessage(parseApiError(e));
                  setState('error');
                }
              }}
            >
              {t('decline')}
            </Button>
          )}
        </div>
      </main>
    );
  }

  /* ── Success ─────────────────────────────────────────────── */
  if (state === 'success') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-lg">
        <div className="w-full max-w-[440px] rounded-2xl bg-surface px-2xl py-[40px] text-center shadow-lg">
          <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-bg">
            <CheckCircleOutlined className="text-[36px] text-success" />
          </div>
          <h2 className="mb-2.5 font-display text-2xl font-extrabold text-heading">
            {t('successTitle')}
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            {wsName ? <>{t('joinedWorkspace', { name: wsName })}</> : <>{t('inviteAccepted')}</>}
          </p>
          <Button
            type="primary"
            size="large"
            style={{ marginTop: 24, minWidth: 160 }}
            onClick={() => router.replace('/dashboard')}
          >
            {t('goToDashboard')}
          </Button>
        </div>
      </main>
    );
  }

  /* ── Declined ─────────────────────────────────────────────── */
  if (state === 'declined') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-lg">
        <div className="w-full max-w-[440px] rounded-2xl bg-surface px-2xl py-[40px] text-center shadow-lg">
          <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-error-bg">
            <CloseCircleOutlined className="text-[36px] text-error" />
          </div>
          <h2 className="mb-2.5 font-display text-2xl font-extrabold text-heading">
            Invitation Declined
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            You have declined this workspace invitation.
          </p>
          <Button
            type="primary"
            size="large"
            style={{ marginTop: 24, minWidth: 160 }}
            onClick={() => router.replace('/dashboard')}
          >
            Go to Dashboard
          </Button>
        </div>
      </main>
    );
  }

  /* ── Error ───────────────────────────────────────────────── */
  return (
    <main className="flex min-h-screen items-center justify-center bg-page p-lg">
      <div className="w-full max-w-[440px] rounded-2xl bg-surface px-2xl py-[40px] text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-error-bg">
          <CloseCircleOutlined className="text-[36px] text-error" />
        </div>
        <h2 className="mb-2.5 font-display text-2xl font-extrabold text-error">
          {t('failedTitle')}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{message || t('expiredOrUsed')}</p>
        <div className="mt-lg flex justify-center gap-2.5">
          <Button type="primary" size="large" onClick={() => router.replace('/dashboard')}>
            {t('goToDashboard')}
          </Button>
          <Button size="large" onClick={() => router.replace('/')}>
            {t('backToHome')}
          </Button>
        </div>
      </div>
    </main>
  );
}
