'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';

import { acceptErpPolicy } from '@/features/policy/policy.actions';
import { logout } from '@/lib/actions/auth.actions';
import { useAuthStore } from '@/lib/store';
import { AuthCompactRail } from '@/components/auth/AuthCompactRail';

type PolicyProduct = 'erp';

/**
 * Per-product config - the i18n namespace, the (public, un-gated) terms-page
 * route, and the accept server action. ManekHR ships a single product (ERP),
 * so this only has one entry; kept as a lookup (not inlined) so a second
 * product can be added the same way in future.
 */
const PRODUCT = {
  erp: { ns: 'erp.policy', terms: '/terms/erp', accept: acceptErpPolicy },
} as const;

/**
 * Full-screen policy-consent gate. Rendered by `app/dashboard/layout.tsx`
 * INSTEAD of the product shell when the caller has not accepted that
 * product's policy - so it covers every authenticated route of the product,
 * with no nav chrome to click around it. Accepting stamps the backend then
 * refreshes the server tree so the layout re-runs and the real shell renders.
 * The gate carries NO policy text - only the consent action and a link to
 * the (separate) terms page.
 */
export default function PolicyGate({ product }: { product: PolicyProduct }) {
  const cfg = PRODUCT[product];
  const t = useTranslations(cfg.ns);
  const router = useRouter();
  // OQ-1 (auth-hardening): no longer reads a localStorage refresh token. The
  // logout server action denylists via the httpOnly refresh cookie + clears it.
  const storeLogout = useAuthStore((s) => s.logout);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAgree() {
    setLoading(true);
    setError(null);
    const res = await cfg.accept();
    if (res.ok) {
      // Reset `loading` before the refresh: the layout re-runs and normally
      // replaces this gate with the real shell, but if a stale read briefly
      // re-renders the gate the button must stay retry-able, not stuck.
      setLoading(false);
      router.refresh();
      return;
    }
    setLoading(false);
    setError(res.error);
  }

  async function handleSignOut() {
    setSigningOut(true);
    // Always call the server logout: it reads the httpOnly refresh cookie to
    // denylist the session and clears the auth cookies (OQ-1). storeLogout()
    // then clears the in-memory + access-token client state.
    await logout().catch(() => undefined);
    storeLogout();
    router.replace('/auth');
  }

  return (
    <div className="flex min-h-screen font-body">
      <AuthCompactRail />
      <div className="relative flex flex-1 items-center justify-center bg-page px-6 py-10">
        <div className="mx-auto w-full max-w-[560px] text-center">
          <div className="mx-auto mb-6 flex flex-col items-center gap-2">
            <span
              className="flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{ background: 'var(--cr-wash-cream)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand mark */}
              <img src="/manekhr-symbol.svg" alt="" aria-hidden className="h-11 w-11" />
            </span>
            <span className="font-display text-[12px] font-semibold tracking-[0.18em] text-muted uppercase">
              {t('productLabel')}
            </span>
          </div>

          <h1 className="mt-5 font-display text-[clamp(1.55rem,1rem+1.9vw,2.25rem)] font-semibold text-heading">
            {t('gateTitle')}
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted">{t('gateBody')}</p>

          <p className="mt-4 text-[14px]">
            <a
              href={cfg.terms}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium no-underline"
              style={{ color: 'var(--cr-primary)' }}
            >
              {t('termsLink')}
            </a>
          </p>

          {error && (
            <p
              className="mt-3 text-[13px]"
              style={{ color: 'var(--cr-error, #d32f2f)' }}
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button type="primary" size="large" loading={loading} onClick={handleAgree}>
              {t('agree')}
            </Button>
          </div>
        </div>

        {/* Utility link demoted out of the primary stack so it no longer competes
            with the agree CTA. Anchored to the form column (not the rail) so it
            stays at the bottom-right of the form area on desktop. */}
        <div className="absolute right-6 bottom-6 text-[12px]">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="cursor-pointer border-0 bg-transparent p-0 text-muted hover:text-heading"
          >
            {signingOut ? `${t('signOut')}…` : t('signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
