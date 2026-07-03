'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Spin, Button } from 'antd';
import { useTranslations } from 'next-intl';
import { verifyEmail } from '@/lib/actions';

type State = 'loading' | 'success' | 'error';

function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('auth');
  const token = searchParams.get('token');
  const fallback = t('verifyEmail.error.fallback');
  // Initialise state at mount based on token presence - avoids the
  // setState-inside-effect cascade for the no-token branch.
  const [state, setState] = useState<State>(token ? 'loading' : 'error');
  const [errMsg, setErrMsg] = useState(token ? '' : fallback);

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then((res) => {
        if (res.ok) {
          setState('success');
        } else {
          setState('error');
          // Always show friendly message for failed verification - backend
          // validation strings ("email should not be empty", raw axios codes)
          // are not meaningful to end users.
          setErrMsg(fallback);
        }
      })
      .catch(() => {
        setState('error');
        setErrMsg(fallback);
      });
  }, [token, fallback]);

  if (state === 'loading')
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-secondary">{t('verifyEmail.loading')}</p>
        </div>
      </div>
    );

  if (state === 'success')
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="w-full max-w-[400px] rounded-2xl bg-surface px-10 py-12 text-center shadow-lg">
          <div className="mb-4 text-[56px]">✅</div>
          <h2 className="mb-2.5 font-display text-2xl font-extrabold text-primary">
            {t('verifyEmail.success.title')}
          </h2>
          <p className="mb-6 text-sm text-secondary">{t('verifyEmail.success.subtitle')}</p>
          <Button type="primary" size="large" block onClick={() => router.replace('/auth')}>
            {t('verifyEmail.success.submit')}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-[400px] rounded-2xl bg-surface px-10 py-12 text-center shadow-lg">
        <div className="mb-4 text-[56px]">❌</div>
        <h2 className="mb-2.5 font-display text-2xl font-extrabold text-error">
          {t('verifyEmail.error.title')}
        </h2>
        <p className="mb-6 text-sm text-secondary">{errMsg}</p>
        <Button type="primary" size="large" block onClick={() => router.replace('/auth')}>
          {t('verifyEmail.error.submit')}
        </Button>
      </div>
    </div>
  );
}

import { Suspense } from 'react';
export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spin size="large" />
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
