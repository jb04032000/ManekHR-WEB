'use client';

/**
 * Over-limit (grandfathering) banner for owner management surfaces. Reads the
 * person's Connect usage roll-up via the SHARED usage hook (one fetch per page,
 * shared with the ConnectUsageMeter beside it), picks the row for `kind`, and
 * - when that kind is over limit - shows a
 * persistent, dismissable-per-session banner whose wording matches the plan's
 * policy:
 *   - freeze: existing items stay live; you can't add more.
 *   - hide_newest: within grace → countdown to the hide date; after grace →
 *     "{n} hidden from public view" (reversible, nothing deleted).
 *
 * Fires the `connect.limit.over_limit_entered` analytics event once per session
 * per episode (keyed by overLimitSince), approximating the server-authoritative
 * "entered" transition that drives the once-per-episode notification.
 *
 * Drop-in next to ConnectUsageMeter on the stores hub / company pages / jobs
 * "my posts" / a storefront's products. Renders nothing while loading, on fetch
 * failure, when within limit, or after the user dismisses it this session.
 *
 * Links: features/connect/usage.actions.ts (data), lib/analytics-events.ts
 * (ConnectEvents.overLimitEntered), backend ConnectOverLimitService.
 */

import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import { useConnectUsageRow } from '@/features/connect/useConnectUsage';
import type { ConnectUsageKind } from '@/features/connect/usage.types';
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import type { ConnectLimitKind } from '@/lib/analytics-events';

/** Session-storage keys: dismissal is per (kind); the analytics episode guard is
 *  per (kind, overLimitSince) so a fresh episode re-fires the event. */
const dismissKey = (kind: string) => `connect-overlimit-dismissed-${kind}`;
const eventKey = (kind: string, since: string | null) =>
  `connect-overlimit-evt-${kind}-${since ?? 'none'}`;

function sessionHas(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function sessionSet(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    /* private mode / quota - non-fatal, the banner just re-shows */
  }
}

export function OverLimitBanner({
  kind,
  className,
}: {
  kind: ConnectUsageKind;
  className?: string;
}) {
  const t = useTranslations('connect.overLimit');
  const tKind = useTranslations('connect.limits.kind');
  const locale = useLocale();
  // Shared roll-up: this banner and the meter beside it pull from one fetch.
  const { row } = useConnectUsageRow(kind);
  const [dismissed, setDismissed] = useState(false);

  // Re-evaluate the per-session dismissal whenever the kind changes.
  useEffect(() => {
    setDismissed(sessionHas(dismissKey(kind)));
  }, [kind]);

  // Fire the "entered over-limit" event once per session per episode.
  useEffect(() => {
    if (!row || !row.overLimit) return;
    const key = eventKey(row.kind, row.overLimitSince);
    if (sessionHas(key)) return;
    sessionSet(key);
    // storage is a count kind here; the catalog only types the four count kinds.
    trackEvent(ConnectEvents.overLimitEntered, {
      kind: row.kind as ConnectLimitKind,
      policy: row.policy,
    });
  }, [row]);

  const graceDateLabel = useMemo(() => {
    if (!row?.graceEndsAt) return '';
    try {
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(row.graceEndsAt));
    } catch {
      return '';
    }
  }, [row?.graceEndsAt, locale]);

  if (!row || !row.overLimit || dismissed) return null;

  const kindLabel = tKind(row.kind);
  const excess = Math.max(0, row.used - row.limit);

  // Choose the message by policy + grace state.
  let title: string;
  let description: string;
  if (row.policy === 'hide_newest') {
    title = t('hideTitle', { kind: kindLabel });
    description = row.suppressionActive
      ? t('hideBodyActive', { count: row.suppressedCount, kind: kindLabel })
      : t('hideBodyGrace', {
          used: row.used,
          limit: row.limit,
          kind: kindLabel,
          excess,
          date: graceDateLabel,
        });
  } else {
    title = t('freezeTitle', { kind: kindLabel });
    description = t('freezeBody', { used: row.used, limit: row.limit, kind: kindLabel });
  }

  return (
    <Alert
      className={className}
      type="warning"
      showIcon
      // AntD v6: the object form of `closable` only renders the close button when
      // it carries a `closeIcon`. We pass the default icon + an aria-label so the
      // dismiss control is present AND accessible.
      closable={{ closeIcon: true, 'aria-label': t('dismiss') }}
      onClose={() => {
        sessionSet(dismissKey(kind));
        setDismissed(true);
      }}
      title={title}
      description={description}
    />
  );
}
