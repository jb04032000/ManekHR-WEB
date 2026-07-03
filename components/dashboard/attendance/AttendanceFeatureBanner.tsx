'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { PlanEntitlements } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  entitlements: PlanEntitlements | null;
  workspaceId: string | null;
  /**
   * Optional right-slot content. Surfaces alongside the status row in the same
   * horizontal card - e.g. anomaly-count chip + "View feed" link. Renders the
   * card even when the auto-present status is not active, so right-slot work
   * stays visible.
   */
  rightSlot?: ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────

// `workspaceId` accepted for API parity w/ prior consumers; not used now that
// dismiss-localStorage is removed (auto-present is a paid feature - always
// surfaced when entitled).
export function AttendanceFeatureBanner({ entitlements, rightSlot }: Props) {
  const t = useTranslations('attendance.autoPresentBanner');

  const attendanceAccess = entitlements?.moduleAccess?.find((m) => m.module === 'attendance');
  const getAccess = (key: string) =>
    attendanceAccess?.subFeatures?.find((sf) => sf.key === key)?.access ?? 'locked';

  const showAutoPresent = getAccess('auto_present') !== 'locked';

  // Render nothing when there is no left status AND no right content.
  if (!showAutoPresent && !rightSlot) return null;

  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5"
      style={{
        background: 'var(--cr-surface, white)',
        borderColor: 'var(--cr-border-light)',
      }}
    >
      {/* LEFT - auto-present status (dot + label + rule sentence) */}
      {showAutoPresent ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--cr-success-500)',
              flexShrink: 0,
            }}
          />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--cr-text-1)' }}>
            {t('title')}
          </span>
          <span className="text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
            {t.rich('body', {
              // Rich-text callback receives the wrapped chunks as a child node.
              // The message uses `<present>Present</present>` so the literal
              // word stays translatable (gu/hi can swap it for हाजर/હાજર) while
              // the surrounding emphasis ships from the component.
              present: (chunks) => <strong>{chunks}</strong>,
            })}
          </span>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* RIGHT - caller-provided slot (anomaly chip + View feed link, etc.) */}
      {rightSlot && <div className="flex flex-wrap items-center gap-3">{rightSlot}</div>}
    </div>
  );
}
