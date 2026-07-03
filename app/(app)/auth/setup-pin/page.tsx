'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Alert } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AxiosError } from 'axios';
import { pinApi } from '@/lib/api/modules';
import { listWorkspaces } from '@/lib/actions';
import { normalizeWorkspaceList } from '@/lib/utils/workspace.utils';
import { resolvePostAuthTarget } from '@/lib/auth/post-auth-target';
import { useAuthStore } from '@/lib/store';
import { AuthCompactRail } from '@/components/auth/AuthCompactRail';
import { PinInput } from '@/components/auth/PinInput';

export default function SetupPinPage() {
  const t = useTranslations('auth.appLock.setupPin');
  const tCommon = useTranslations('auth.appLock.common');
  const router = useRouter();
  const params = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setPinSetupRequired = useAuthStore((s) => s.setPinSetupRequired);
  const setAppLocked = useAuthStore((s) => s.setAppLocked);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reveal, setReveal] = useState(false);
  // Gate: only render the set-PIN form once we've confirmed this session is an
  // ERP/workspace user who should actually have a PIN (see the entry effect).
  // A Connect-only / workspace-less session is redirected to Connect instead.
  const [accessChecked, setAccessChecked] = useState(false);

  /**
   * Where to land the user after PIN setup succeeds (or when they arrive here
   * with a PIN already set). Delegates to the shared `resolvePostAuthTarget`
   * (lib/auth/post-auth-target.ts) - the same logic `AuthClient.doRedirect`
   * uses: a user WITH a workspace lands on the ERP dashboard; a workspace-less
   * ERP-intent user (accepted ERP terms, not Connect) finishes onboarding at
   * /auth/setup-workspace; other workspace-less users go to /connect/feed. A
   * `?redirect=` query param wins when safe (never `/admin`).
   *
   * Memoised on `user` + `params` so it is a stable dependency for the
   * useEffect + useCallback below - no `react-hooks/exhaustive-deps` waiver
   * needed.
   */
  const computePostPinTarget = useCallback(
    (): string => resolvePostAuthTarget({ user, requestedRedirect: params.get('redirect') }),
    [user, params],
  );

  // Gate this screen. Bounce a session that should not see it:
  //  - no session -> /auth.
  //  - already has a PIN -> the post-PIN destination.
  //  - NO real ERP workspace -> away (NEVER force a PIN). App Lock (Quick PIN)
  //    is an ERP-only protection; a workspace-less account has no PIN feature,
  //    so it must never be parked on this screen. We check the real workspace
  //    LIST, not `user.hasWorkspace`: that flag is unreliable (the backend sets
  //    it on workspace-create and never clears it on delete), and an off/stale
  //    flag is exactly what wrongly routes a workspace-less account into the ERP
  //    shell and onto this page. The destination is intent-aware
  //    (resolvePostAuthTarget): a workspace-less ERP-intent signup goes to
  //    /auth/setup-workspace to finish onboarding; a Connect-only account goes
  //    to /connect/feed. Either way it is NEVER forced to set a PIN here.
  //    Mirrors DashboardLayout's list-based gate. Keep the two in sync.
  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (user.hasPin) {
      // Already has a PIN - nothing to do here. Route to the post-PIN
      // destination (Connect for workspace-less users, /dashboard otherwise).
      router.replace(computePostPinTarget());
      return;
    }
    // Platform admins MUST set a PIN to enter the admin shell (AdminLayout's
    // App Lock gate requires it), regardless of ERP workspace. Without this
    // exemption the workspace-less guard below bounces them via
    // resolvePostAuthTarget, which short-circuits admins back to /admin ->
    // AdminLayout -> setup-pin: an infinite loop (a fresh admin has no PIN +
    // no workspace). Show the PIN form so they can set it and reach /admin.
    if (user.isAdmin) {
      setAccessChecked(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await listWorkspaces();
      if (cancelled) return;
      if (res.ok) {
        if (normalizeWorkspaceList(res.data).length > 0) {
          // Confirmed ERP user (owns or is a member of a workspace): a PIN is
          // theirs to set. Show the form.
          setAccessChecked(true);
          return;
        }
        // Confirmed zero workspaces => workspace-less. Never PIN-walled. The
        // stale hasWorkspace flag that misrouted them here is logged so the data
        // inconsistency is traceable; the redirect is the user-facing fix. Route
        // is intent-aware: force `hasWorkspace:false` (the LIST is authoritative
        // over any stale flag) so a workspace-less ERP-intent signup is sent to
        // /auth/setup-workspace to finish onboarding, and a Connect-only account
        // to /connect/feed - never blindly to Connect.
        console.warn(
          '[setup-pin] no ERP workspace for this session - routing away from PIN setup (user.hasWorkspace =',
          user.hasWorkspace,
          ')',
        );
        router.replace(
          resolvePostAuthTarget({
            user: { ...user, hasWorkspace: false },
            requestedRedirect: params.get('redirect'),
          }),
        );
        return;
      }
      // Couldn't confirm (backend unreachable / transient). Do NOT bounce a real
      // ERP user away on a blip - fall back to the flag: an explicit "no
      // workspace" still routes away (intent-aware); otherwise show the form
      // (prior behaviour).
      if (user.hasWorkspace === false) {
        router.replace(resolvePostAuthTarget({ user, requestedRedirect: params.get('redirect') }));
        return;
      }
      setAccessChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, user, router, computePostPinTarget, params]);

  const handleSubmit = useCallback(async () => {
    if (pin.length !== 6 || confirmPin.length !== 6) {
      setError(t('error.sixDigits'));
      return;
    }
    if (pin !== confirmPin) {
      setError(t('error.mismatch'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await pinApi.set(pin);
      updateUser({ hasPin: true, pinSetAt: new Date().toISOString() });
      setPinSetupRequired(false);
      setAppLocked(false, res.unlockExpiresAt);
      router.replace(computePostPinTarget());
    } catch (err) {
      const ax = err as AxiosError<{ message?: string; code?: string }>;
      setError(ax.response?.data?.message ?? t('error.failed'));
    } finally {
      setSubmitting(false);
    }
  }, [
    pin,
    confirmPin,
    t,
    updateUser,
    setPinSetupRequired,
    setAppLocked,
    router,
    computePostPinTarget,
  ]);

  const pinsMatch = pin.length === 6 && confirmPin.length === 6 && pin === confirmPin;
  const canSubmit = pinsMatch && !submitting;
  // Live feedback for the confirm field. Three states under the cells:
  //  - `matchingSoFar` - confirm is non-empty + still a prefix of pin (so the
  //    user is on the right track but not done). Green check.
  //  - `mismatch` - at least one typed digit diverges from the pin. Red X.
  //  - `pinsMatch` (full 6-digit match) - strongest affirmative, green check.
  // None of the above (e.g. both empty) renders no feedback row.
  const confirmStarted = confirmPin.length > 0 && pin.length > 0;
  const matchingSoFar = confirmStarted && !pinsMatch && pin.startsWith(confirmPin);
  const mismatch = confirmStarted && !pinsMatch && !pin.startsWith(confirmPin);

  // Render nothing until the entry effect confirms this is a workspace user who
  // should set a PIN (otherwise it is mid-redirect to /auth, Connect, or the
  // post-PIN target).
  if (!isHydrated || !user || !accessChecked) return null;

  return (
    <div className="flex min-h-screen font-body">
      <AuthCompactRail />
      {/* Card wrapper removed - content sits directly on the page background
          for a minimal feel matching the reference design. Title + subtitle
          + cells + button stack vertically with clean rhythm. */}
      <div className="flex flex-1 items-center justify-center bg-page px-4 py-10">
        <div className="w-[min(440px,100%)]">
          <h1 className="m-0 mb-2 font-display text-2xl leading-tight font-extrabold text-heading">
            {t('title')}
          </h1>
          <p className="m-0 mb-7 text-[14px] leading-relaxed text-muted">{t('subtitle')}</p>

          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">{t('fieldsetLegend')}</legend>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-medium tracking-wide text-muted uppercase">
                {t('pinLabel')}
              </label>
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs text-muted transition-colors hover:text-heading"
                aria-label={reveal ? tCommon('hidePinAria') : tCommon('showPinAria')}
                aria-pressed={reveal}
              >
                {reveal ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                <span>{reveal ? tCommon('hidePin') : tCommon('showPin')}</span>
              </button>
            </div>
            <PinInput
              value={pin}
              onChange={setPin}
              autoFocus
              disabled={submitting}
              reveal={reveal}
              ariaLabel={t('pinLabel')}
            />

            <label className="mt-5 mb-2 block text-xs font-medium tracking-wide text-muted uppercase">
              {t('confirmLabel')}
            </label>
            <PinInput
              value={confirmPin}
              onChange={setConfirmPin}
              disabled={submitting}
              reveal={reveal}
              ariaLabel={t('confirmLabel')}
            />

            {/* Live feedback under the confirm cells. Mirrors the reference's
                "Matching so far / Matches / Doesn't match" affordance so the
                user gets per-keystroke confirmation that their typing is on
                track without waiting for a full submit. */}
            {(pinsMatch || matchingSoFar || mismatch) && (
              <p
                className="mt-2 mb-0 flex items-center gap-1.5 text-[12px]"
                style={{ color: mismatch ? 'var(--cr-error)' : 'var(--cr-success)' }}
                aria-live="polite"
              >
                {mismatch ? (
                  <>
                    <X size={13} aria-hidden /> {t('doesntMatch')}
                  </>
                ) : pinsMatch ? (
                  <>
                    <Check size={13} aria-hidden /> {t('matches')}
                  </>
                ) : (
                  <>
                    <Check size={13} aria-hidden /> {t('matchingSoFar')}
                  </>
                )}
              </p>
            )}
          </fieldset>

          {error && <Alert type="error" showIcon className="mt-4" title={error} />}

          <Button
            type="primary"
            size="large"
            block
            loading={submitting}
            disabled={!canSubmit}
            className="mt-6 h-[48px] font-semibold"
            onClick={handleSubmit}
          >
            {t('submitButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
