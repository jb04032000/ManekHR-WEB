'use client';

/**
 * AppLockPinSection - the App Lock card on `/account/security`.
 *
 * One card, two settings (PIN management + idle timeout), one summary in the
 * header. Imperative "Lock app now" lives in the account-menu / `Ctrl+Shift+L`
 * chord - NOT here - so settings and imperative actions don't share visual
 * weight inside the same card.
 *
 * Layout
 * ┌───────────────────────────────────────────────────────────┐
 * │ App Lock                 [Active · auto-locks after 1 min] │
 * │ A 6-digit PIN keeps your dashboard private.               │
 * ├───────────────────────────────────────────────────────────┤
 * │ [Change PIN]   Set on 20 May 2026                         │
 * │                                                            │
 * │ ─────────────────────────────────────────────────────      │
 * │                                                            │
 * │ Lock after inactivity                          Default     │
 * │ [1 min] [2 min] [5 min] [10 min] [15 min] [30 min]         │
 * │ Locks after 1 min. Re-enter your PIN to unlock.            │
 * └───────────────────────────────────────────────────────────┘
 *
 * Empty state (`!user.hasPin` - defensive; DashboardLayout normally force-
 * redirects an unprovisioned user to /auth/setup-pin first):
 * - No idle-timeout chips (nothing to enforce without a PIN).
 * - Single primary "Set up App Lock" CTA → /auth/setup-pin.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Button, Tag, message } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useAuthStore, useWorkspaceStore } from '@/lib/store';
import { pinApi } from '@/lib/api/modules';
import { env } from '@/lib/env';
import { fmt } from '@/lib/utils';
import { SectionCard } from '@/components/settings/SectionCard';
import { ChangePinModal } from './ChangePinModal';

/**
 * Allowed App Lock idle presets, in ms. Mirrors the backend
 * `APP_LOCK_IDLE_PRESETS_MS` constant - a value the user picks here always
 * validates server-side on `PATCH /me/security/app-lock-idle`.
 */
const IDLE_PRESETS_MS = [60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000] as const;

/** Render the i18n label for a preset ms value (`opt5min` for 300_000 etc.). */
function presetLabel(ms: number, t: ReturnType<typeof useTranslations>): string {
  const mins = Math.round(ms / 60_000);
  return t(`appLockPin.idle.opt${mins}min` as Parameters<typeof t>[0]);
}

export default function AppLockPinSection() {
  const t = useTranslations('profile');
  const { user, updateUser } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const [msgApi, ctx] = message.useMessage();
  const [changeOpen, setChangeOpen] = useState(false);
  const [savingIdle, setSavingIdle] = useState(false);

  const hasPin = !!user?.hasPin;
  // Resolution chain matches DashboardLayout.useIdle: user override → workspace
  // baseline → deployment env default. `fallbackMs` is what kicks in if the
  // user clears their override.
  const fallbackMs = currentWorkspace?.appLockIdleMs ?? env.appLockIdleMs;
  const userOverride = user?.appLockIdleMs ?? null;
  const effectiveMs = userOverride ?? fallbackMs;
  const isOverridden = userOverride !== null;

  const handleIdleChange = useCallback(
    async (nextMs: number | null) => {
      setSavingIdle(true);
      try {
        const res = await pinApi.setIdleMs(nextMs);
        updateUser({ appLockIdleMs: res.appLockIdleMs });
        msgApi.success(t('appLockPin.idle.saved'));
      } catch {
        msgApi.error(t('appLockPin.idle.saveFailed'));
      } finally {
        setSavingIdle(false);
      }
    },
    [updateUser, msgApi, t],
  );

  // Empty state - single CTA, no idle chips. The setup-pin route is the
  // canonical PIN-creation flow used by the DashboardLayout force-redirect too.
  if (!hasPin) {
    return (
      <>
        {ctx}
        <SectionCard
          title={t('appLockPin.title')}
          description={t('appLockPin.setupBody')}
          trailing={<Tag color="warning">{t('appLockPin.summaryInactive')}</Tag>}
        >
          <Link href="/auth/setup-pin">
            <Button type="primary" size="large" icon={<KeyOutlined />}>
              {t('appLockPin.setupCta')}
            </Button>
          </Link>
        </SectionCard>
      </>
    );
  }

  // Configured state - change-PIN + segmented idle picker.
  const summary = t('appLockPin.summaryActive', { idle: presetLabel(effectiveMs, t) });

  return (
    <>
      {ctx}
      <SectionCard
        title={t('appLockPin.title')}
        description={t('appLockPin.desc')}
        trailing={<Tag color="success">{summary}</Tag>}
      >
        {/* Change PIN row - secondary button + inline meta. The button is
            DEFAULT (not primary): rotating a PIN is rare; we shouldn't shout
            for the action. */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="default"
            size="large"
            icon={<KeyOutlined />}
            onClick={() => setChangeOpen(true)}
          >
            {t('appLockPin.changeButton')}
          </Button>
          {user?.pinSetAt && (
            <span className="text-[12px] text-muted">
              {t('appLockPin.lastSet', { date: fmt(user.pinSetAt) })}
            </span>
          )}
        </div>

        {/* Idle-timeout chip group - radiogroup for a11y. The active chip
            reflects `effectiveMs` (override OR resolved fallback). Picking
            any chip persists as a user override; the "Use default" reset
            below clears the override and falls back to workspace / env. */}
        <div className="mt-6 border-t border-border-light pt-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label id="user-app-lock-idle-label" className="text-[13px] font-semibold text-heading">
              {t('appLockPin.idle.label')}
            </label>
            {!isOverridden && (
              <span className="text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">
                {t('appLockPin.idle.defaultBadge')}
              </span>
            )}
          </div>

          <div
            role="radiogroup"
            aria-labelledby="user-app-lock-idle-label"
            className="flex flex-wrap gap-2"
          >
            {IDLE_PRESETS_MS.map((ms) => {
              const active = effectiveMs === ms;
              return (
                <button
                  key={ms}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={savingIdle}
                  onClick={() => handleIdleChange(ms)}
                  style={
                    active
                      ? {
                          borderColor: 'var(--cr-primary)',
                          background: 'var(--cr-primary-light)',
                          color: 'var(--cr-primary)',
                        }
                      : undefined
                  }
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? 'font-semibold'
                      : 'border-border-light bg-surface text-muted hover:border-border hover:text-heading'
                  }`}
                >
                  {presetLabel(ms, t)}
                </button>
              );
            })}
          </div>

          <p className="m-0 mt-3 text-[12px] leading-relaxed text-muted">
            {isOverridden ? (
              <>
                {t('appLockPin.idle.overriddenHint', {
                  defaultLabel: presetLabel(fallbackMs, t),
                })}{' '}
                <button
                  type="button"
                  onClick={() => handleIdleChange(null)}
                  disabled={savingIdle}
                  className="cursor-pointer border-0 bg-transparent p-0 font-medium text-primary underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('appLockPin.idle.resetToDefault')}
                </button>
              </>
            ) : (
              t('appLockPin.idle.defaultHint')
            )}
          </p>
        </div>
      </SectionCard>

      <ChangePinModal open={changeOpen} onClose={() => setChangeOpen(false)} />
    </>
  );
}
