'use client';

/**
 * The calm "boost it" prompt. Presentational only: shows a high-traction
 * entity's name + this-week views and offers Boost (a deep link into the
 * existing boost composer for that entity) and Dismiss. Never a modal, never a
 * toast -- it renders inline at the top of an owner surface.
 *
 * Cross-module links: rendered by BoostNudgeSlot.tsx (which owns the data,
 * shown-marking, dismiss, and analytics). Boost deep-links to
 * /connect/boost/<kind>/<id> (the existing composer routes).
 *
 * Watch: styling mirrors ConnectLimitsCard (cr- tokens, radius-lg) so it sits
 * quietly among the other owner cards. Keep copy plain -- no urgency theatrics.
 */

import { useTranslations } from 'next-intl';
import { TrendingUp, X } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import type { BoostNudgeCandidate } from '@/features/connect/boost-nudges.types';

export function BoostNudgeCard({
  candidate,
  boostHref,
  onBoost,
  onDismiss,
  className,
}: {
  candidate: BoostNudgeCandidate;
  boostHref: string;
  /** Fired on Boost activation (before navigation) for the click analytics. */
  onBoost: () => void;
  onDismiss: () => void;
  className?: string;
}) {
  const t = useTranslations('connect.boostNudge');

  return (
    <section
      className={className}
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 14,
      }}
      aria-label={t('aria')}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{
            background: 'var(--cr-primary-light, var(--cr-border-light))',
            color: 'var(--cr-primary)',
          }}
          aria-hidden
        >
          <TrendingUp size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13.5px] leading-snug" style={{ color: 'var(--cr-text)' }}>
            {t.rich('message', {
              name: candidate.name,
              views: candidate.viewsWindow,
              strong: (chunks) => <strong style={{ color: 'var(--cr-text)' }}>{chunks}</strong>,
            })}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <DsButton dsVariant="primary" dsSize="sm" href={boostHref} onClick={onBoost}>
              {t('boost')}
            </DsButton>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium"
              style={{ color: 'var(--cr-text-4)', background: 'transparent' }}
            >
              <X size={13} aria-hidden />
              {t('dismiss')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
