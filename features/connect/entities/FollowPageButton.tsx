'use client';

/**
 * FollowPageButton - the Follow / Following toggle on a public company page,
 * with an optimistic follower count. A logged-out click (the follow action 401s)
 * routes to the Connect join surface. The owner cannot follow their own page
 * (the backend blocks it); that error surfaces as a toast.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { App as AntApp } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { useAnnouncer } from '@/components/connect';
import { followCompanyPage, unfollowCompanyPage } from './company-page.actions';

interface Props {
  pageId: string;
  initialFollowing: boolean;
  initialCount: number;
}

export default function FollowPageButton({ pageId, initialFollowing, initialCount }: Props) {
  const t = useTranslations('connect.companyPage');
  const router = useRouter();
  const { message } = AntApp.useApp();
  const { announce, announcer } = useAnnouncer();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    // Optimistic flip + count nudge; revert on failure.
    const next = !following;
    setFollowing(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    startTransition(async () => {
      const res = next ? await followCompanyPage(pageId) : await unfollowCompanyPage(pageId);
      if (!res.ok) {
        setFollowing(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
        // No session -> send them to join; any other error is a toast.
        if (/log ?in|auth|401|unauthor/i.test(res.error)) {
          router.push('/connect');
          return;
        }
        message.error(res.error);
        announce(res.error, { assertive: true });
        return;
      }
      // Announce the new state + count so a screen reader hears the result of
      // the toggle (the visual button/count change alone is silent to AT).
      announce(next ? t('followedAnnounce') : t('unfollowedAnnounce'));
    });
  };

  return (
    <div className="flex items-center gap-3">
      {announcer}
      <DsButton
        dsVariant={following ? 'ghost' : 'primary'}
        onClick={toggle}
        loading={pending}
        aria-pressed={following}
      >
        {following ? t('following') : t('follow')}
      </DsButton>
      <span className="text-[13px]" aria-live="polite" style={{ color: 'var(--cr-text-4)' }}>
        {t('followerCount', { count })}
      </span>
    </div>
  );
}
