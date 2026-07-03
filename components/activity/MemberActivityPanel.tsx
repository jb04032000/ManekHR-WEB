'use client';

import { useEffect, useState } from 'react';
import { getMemberActivity } from '@/lib/actions/team.actions';
import { ActivityTimeline } from './ActivityTimeline';
import type { ActivityEvent } from '@/types';

/**
 * Member-detail "Activity" tab body. Lazy: mounts (and fetches) only when the
 * tab is opened. Gated to `team.appAccess.manage` by the parent rail filter +
 * the BE endpoint; events arrive already redacted.
 */
export function MemberActivityPanel({
  workspaceId,
  memberId,
}: {
  workspaceId: string;
  memberId: string;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !memberId) return;
    let cancelled = false;
    // All setState happens in the async resolution (never synchronously inside
    // the effect body) to satisfy the no-cascading-render rule; initial state
    // is already loading=true.
    getMemberActivity(workspaceId, memberId)
      .then((res) => {
        if (!cancelled) {
          setEvents(res.items);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load activity.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, memberId]);

  return <ActivityTimeline events={events} loading={loading} error={error} />;
}
