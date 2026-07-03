'use client';

/**
 * FeedCompanyFollowButton - the compact Follow / Following toggle for the feed
 * right-rail "Companies to follow" panel. It is the company-page analogue of the
 * people rail's `PersonCardActions mode="followOnly"` button, so the two rails
 * offer the same one-click follow affordance.
 *
 * Behaviour mirrors the public-page `FollowPageButton` and the directory
 * `CompanyCardRow`: optimistic flip, revert on failure, a logged-out 401 routes
 * to the Connect join surface, any other error is a toast. Initial state is
 * seeded by the page from the caller's followed-page ids (one round trip, no
 * per-card follow-state check). Follow/unfollow hit
 * `company-page.actions` -> backend `connect/company-pages/:id/follow`.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { App as AntApp } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { useAnnouncer } from '@/components/connect';
import {
  followCompanyPage,
  unfollowCompanyPage,
} from '@/features/connect/entities/company-page.actions';

interface Props {
  pageId: string;
  /** Used for the screen-reader follow/unfollow label and the announce text. */
  companyName: string;
  initialFollowing: boolean;
}

export default function FeedCompanyFollowButton({ pageId, companyName, initialFollowing }: Props) {
  const t = useTranslations('connect.companies');
  const router = useRouter();
  const { message } = AntApp.useApp();
  const { announce, announcer } = useAnnouncer();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !following;
    setFollowing(next); // optimistic; reverted on failure below
    startTransition(async () => {
      const res = next ? await followCompanyPage(pageId) : await unfollowCompanyPage(pageId);
      if (!res.ok) {
        setFollowing(!next);
        // No session -> send them to join; any other error is a toast.
        if (/log ?in|auth|401|unauthor/i.test(res.error)) {
          router.push('/connect');
          return;
        }
        message.error(res.error);
        announce(res.error, { assertive: true });
        return;
      }
      announce(
        next
          ? t('followedAnnounce', { name: companyName })
          : t('unfollowedAnnounce', { name: companyName }),
      );
    });
  };

  return (
    <>
      {announcer}
      <DsButton
        dsVariant="ghost"
        dsSize="sm"
        loading={pending}
        onClick={toggle}
        aria-pressed={following}
        aria-label={
          following
            ? t('unfollowAria', { name: companyName })
            : t('followAria', { name: companyName })
        }
      >
        {following ? t('following') : t('follow')}
      </DsButton>
    </>
  );
}
