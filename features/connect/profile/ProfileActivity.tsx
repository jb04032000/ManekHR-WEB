'use client';

/**
 * ProfileActivity - the LinkedIn-style "Activity" section on the owner's own
 * profile. A `ModuleTabs` bar (Posts / Comments / Reactions, synced to the
 * `?activityTab=` URL param so the page shell never remounts on a tab change)
 * over the active panel. Rendered only for the profile owner - `ProfileView`
 * gates it behind `isOwner`.
 *
 * Posts + Reactions reuse `ActivityPostList` (the static `ActivityCard`);
 * Comments uses `ActivityCommentList`. The post list is keyed by the active tab so a
 * posts→reactions switch remounts with a fresh virtualizer rather than reusing
 * the previous tab's measured row heights.
 */

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ModuleTabs, { type ModuleTab } from '@/components/connect/ModuleTabs';
import ActivityPostList from './ActivityPostList';
import ActivityCommentList from './ActivityCommentList';

/** The URL search param the tab bar syncs against. */
const ACTIVITY_PARAM = 'activityTab';

export default function ProfileActivity() {
  const t = useTranslations('connect.profile.activity');
  const params = useSearchParams();
  const requested = params.get(ACTIVITY_PARAM);
  const active = requested === 'comments' || requested === 'reactions' ? requested : 'posts';

  const tabs: ModuleTab[] = [
    { key: 'posts', label: t('tabs.posts') },
    { key: 'comments', label: t('tabs.comments') },
    { key: 'reactions', label: t('tabs.reactions') },
  ];

  return (
    <section aria-label={t('title')} className="flex flex-col gap-3">
      <h2 className="m-0 text-[16px] font-semibold" style={{ color: 'var(--cr-text)' }}>
        {t('title')}
      </h2>
      <ModuleTabs
        tabs={tabs}
        paramName={ACTIVITY_PARAM}
        defaultTab="posts"
        ariaLabel={t('title')}
      />
      <div>
        {active === 'comments' ? (
          <ActivityCommentList />
        ) : (
          <ActivityPostList key={active} type={active} />
        )}
      </div>
    </section>
  );
}
