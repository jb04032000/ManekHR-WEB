'use client';

import { Timeline, Empty, Skeleton, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import { DsAvatar } from '@/components/ui';
import type { ActivityEvent } from '@/types';
import { activityActionDef, activityMetaGroups } from './activity-labels';

interface Props {
  events: ActivityEvent[];
  loading?: boolean;
  error?: string | null;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Compact chronological feed for the member-detail "Activity" tab. Pure
 * presentational - the parent fetches the (already-redacted) events. Shows
 * who did what to this member + when, plus coarse field-group tags for edits.
 */
export function ActivityTimeline({ events, loading, error }: Props) {
  const t = useTranslations();

  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (error) return <p className="text-danger text-sm">{error}</p>;
  if (events.length === 0) {
    return <Empty description={t('activity.emptyMember')} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const items = events.map((e) => {
    const def = activityActionDef(e.action);
    const groups = activityMetaGroups(e);
    return {
      key: e.id,
      icon: <DsAvatar name={e.actor.name} size={28} />,
      content: (
        <div className="pb-2">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-charcoal font-semibold">{e.actor.name}</span>
            <Tag color={def.tone} className="m-0">
              {t(def.labelKey as Parameters<typeof t>[0])}
            </Tag>
          </div>
          {groups.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {groups.map((g) => (
                <Tag key={g} className="m-0 text-[11px]">
                  {t(`activity.group.${g}` as Parameters<typeof t>[0])}
                </Tag>
              ))}
            </div>
          )}
          <div className="mt-0.5 text-xs text-neutral-400">{formatWhen(e.at)}</div>
        </div>
      ),
    };
  });

  return <Timeline items={items} />;
}
