'use client';

/**
 * Small owner-facing usage meter: a label + a used/limit bar for one Connect
 * count cap (or storage). Presentational only - the data comes from the parent
 * (ConnectUsageMeter / ConnectLimitsCard fetch it via the shared usage hook).
 *
 * States:
 *  - unlimited (limit === -1): shows just the used count + an "Unlimited" tag,
 *    no bar (there is nothing to fill toward).
 *  - normal: primary-tone bar.
 *  - near (>= 80% of the cap, below it): amber bar + a one-line "Almost at your
 *    limit" nudge. Calm, inline, no modal.
 *  - at/over cap: red, full bar + a small red info icon next to the count that
 *    opens a tiny popover ("you've reached your limit" + a link to plans). This
 *    replaced the bulky AtLimitNotice banner the hubs used to mount, so the
 *    at-cap explanation now lives ON the meter and the hubs stay clean. The
 *    strictly-over OverLimitBanner is unaffected.
 *
 * Accessibility: role=progressbar with min/max/now + a human aria-valuetext, and
 * the same numbers are shown as visible text so the bar is never the only signal
 * (WCAG AA - colour is reinforced by text). The info trigger is a real <button>
 * with an aria-label and a comfortable tap area. Label nouns are shared with
 * LimitReachedDialog via connect.usage.label.*.
 *
 * Links: features/connect/usage.types.ts, components/connect/ConnectUsageMeter.tsx,
 * components/connect/LimitReachedDialog.tsx. The popover "view plans" link points
 * at /account/subscription - keep that target in sync with LimitReachedDialog /
 * ConnectLimitsCard (the product-neutral plan page Connect-only users can reach).
 */

import Link from 'next/link';
import { Popover } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { ConnectUsageKind } from '@/features/connect/usage.types';

export interface UsageMeterProps {
  kind: ConnectUsageKind;
  used: number;
  limit: number;
  className?: string;
  /** Show the "Almost at your limit" nudge in the near band. Default true. */
  showHint?: boolean;
}

/**
 * Turn the bar amber + show the nudge once the person has used this share of
 * their cap. Kept in sync with lib/analytics-events.ts bucketUsageRatio (both
 * describe the same "approaching" threshold that also fires near_limit).
 */
const NEAR_RATIO = 0.8;

export function UsageMeter({ kind, used, limit, className, showHint = true }: UsageMeterProps) {
  const t = useTranslations('connect.usage');
  const label = t(`label.${kind}`);
  const unlimited = limit === -1;

  const atCap = !unlimited && used >= limit;
  const near = !unlimited && !atCap && limit > 0 && used / limit >= NEAR_RATIO;
  const pct = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  // primary normally; amber as the cap nears; red at/over the cap.
  const fill = atCap ? 'var(--cr-error)' : near ? 'var(--cr-warning)' : 'var(--cr-primary)';

  // Human-readable value text reused for both the visible readout and the
  // progressbar's aria-valuetext (screen readers announce it on focus).
  const valueText = unlimited ? t('unlimited') : t('usedOfLimit', { used, limit });

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : limit}
        aria-valuenow={unlimited ? undefined : used}
        aria-valuetext={`${label}: ${valueText}`}
      >
        <div className="mb-1 flex items-center justify-between gap-3 text-[12.5px]">
          <span className="font-semibold text-heading">{label}</span>
          <span className="flex items-center gap-1.5 text-muted">
            {unlimited ? (
              <>
                <span className="tabular-nums">{used}</span>
                {/* "Unlimited" tag: success-toned pill, no bar follows. */}
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold"
                  style={{
                    background: 'var(--cr-pill-success-bg)',
                    color: 'var(--cr-pill-success-fg)',
                  }}
                >
                  {t('unlimited')}
                </span>
              </>
            ) : (
              <>
                <span className="tabular-nums">{valueText}</span>
                {/* At/over the cap: a small red info icon opens a tiny popover that
                    explains the limit + links to plans. Replaces the old AtLimitNotice
                    banner so the at-cap message rides on the meter, not the page. */}
                {atCap && (
                  <Popover
                    trigger="click"
                    placement="bottomRight"
                    content={
                      <div style={{ maxWidth: 240 }}>
                        <p className="m-0 mb-1 font-semibold text-heading">
                          {t('atLimit.title', { kind: label })}
                        </p>
                        <p className="m-0 mb-2 text-[12px] text-muted">
                          {t('atLimit.body', { kind: label })}
                        </p>
                        {/* Honest path to the product-neutral plan page (not a fake
                            instant-buy). Keep in sync with LimitReachedDialog. */}
                        <Link href="/account/subscription" className="text-[12px] underline">
                          {t('atLimit.viewPlans')}
                        </Link>
                      </div>
                    }
                  >
                    <button
                      type="button"
                      aria-label={t('atLimit.title', { kind: label })}
                      className="inline-flex cursor-pointer items-center border-0 bg-transparent p-0.5 leading-none"
                      style={{ color: 'var(--cr-error)' }}
                    >
                      <InfoCircleOutlined aria-hidden />
                    </button>
                  </Popover>
                )}
              </>
            )}
          </span>
        </div>
        {!unlimited && (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--cr-border-light)' }}
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${pct}%`, background: fill }}
              data-testid="usage-meter-fill"
            />
          </div>
        )}
      </div>
      {/* Calm near-limit nudge: one line, amber, only in the 80-99% band. At/over
          the cap we stay silent and let the OverLimitBanner do the talking. */}
      {near && showHint && (
        <p className="m-0 mt-1 text-[11.5px]" style={{ color: 'var(--cr-warning)' }}>
          {t('nearHint')}
        </p>
      )}
    </div>
  );
}
