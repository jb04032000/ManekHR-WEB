'use client';

/**
 * FollowingTab - the Network screen's "Following" panel.
 *
 * A follow is asymmetric: the viewer sees the followee's updates with no
 * approval, and the followee is not notified. Follows target a PERSON (`user`)
 * or a WORKSHOP / company page (`companyPage`); this tab renders BOTH, resolved
 * from the people index and the hydrated company-page refs. Unfollow reverses
 * the edge and refreshes the route.
 *
 * (Earlier this rendered `user` follows only, so a followed company page was
 * counted by the nav / tab badge but never shown - an empty list under a "1".)
 */

import { useCallback, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { App as AntApp } from 'antd';
import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DsAvatar, InfoTooltip } from '@/components/ui';
import DsButton from '@/components/ui/DsButton';
import { ConnectEmptyState, PersonCard } from '@/components/connect';
import { unfollowUser } from '../network.actions';
import { unfollowCompanyPage } from '../entities/company-page.actions';
import type { Follow } from '../network.types';
import type { CompanyPageRef } from '../feed.types';
import { toConnectPerson, type PeopleIndex } from './hydrate';

interface FollowingTabProps {
  /** The viewer's follows (people + company pages), pre-loaded by the page. */
  follows: Follow[];
  /** Hydrated people for the `user` follows, keyed by `userId`. */
  people: PeopleIndex;
  /** Hydrated identities for the `companyPage` follows (`getCompanyPageRefs`). */
  companyPages?: CompanyPageRef[];
}

export default function FollowingTab({ follows, people, companyPages = [] }: FollowingTabProps) {
  const t = useTranslations('connect.network.following');
  const tPerson = useTranslations('connect.network.person');
  const router = useRouter();
  const { message } = AntApp.useApp();

  /** Locally hidden ids - an unfollowed row leaves immediately, pre-refresh. */
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [, startRefresh] = useTransition();

  const companyById = useMemo(() => new Map(companyPages.map((c) => [c.id, c])), [companyPages]);

  // People + workshop follows both render. A `companyPage` follow whose identity
  // failed to hydrate is skipped rather than shown as a broken row (the server
  // count could then read one higher - a rare hydration-failure edge).
  const visible = useMemo(
    () =>
      follows.filter(
        (f) =>
          !removedIds.has(f.followeeId) &&
          (f.followeeType === 'user' || companyById.has(f.followeeId)),
      ),
    [follows, removedIds, companyById],
  );

  const unfollow = useCallback(
    async (f: Follow) => {
      setBusyIds((prev) => new Set(prev).add(f.followeeId));
      const res =
        f.followeeType === 'companyPage'
          ? await unfollowCompanyPage(f.followeeId)
          : await unfollowUser(f.followeeId);
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(f.followeeId);
        return next;
      });
      if (!res.ok) {
        message.error(res.error || t('unfollowError'));
        return;
      }
      message.success(t('unfollowed'));
      setRemovedIds((prev) => new Set(prev).add(f.followeeId));
      startRefresh(() => router.refresh());
    },
    [message, router, t],
  );

  if (visible.length === 0) {
    return (
      <ConnectEmptyState
        variant="inline"
        icon={<UserPlus size={24} aria-hidden />}
        title={t('empty.title')}
        description={t('empty.body')}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, color: 'var(--cr-text-4)' }}>
          {t('count', { count: visible.length })}
        </span>
        <InfoTooltip text={t('helpTitle')} body={<p style={{ margin: 0 }}>{t('help')}</p>} />
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {visible.map((follow) => {
          const busy = busyIds.has(follow.followeeId);
          const action = (
            <DsButton dsVariant="ghost" dsSize="sm" loading={busy} onClick={() => unfollow(follow)}>
              {t('unfollow')}
            </DsButton>
          );
          const company =
            follow.followeeType === 'companyPage' ? companyById.get(follow.followeeId) : null;
          return (
            <li
              key={follow._id}
              style={{ padding: '14px 4px', borderBottom: '1px solid var(--cr-border-light)' }}
            >
              {company ? (
                <CompanyFollowRow company={company} label={t('companyLabel')} action={action} />
              ) : (
                <PersonCard
                  person={toConnectPerson(follow.followeeId, people, tPerson('fallbackName'))}
                  action={action}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A followed workshop / company page - logo + name (linked to its public page)
 *  + a "Workshop" label, mirroring `PersonCard`'s row layout. */
function CompanyFollowRow({
  company,
  label,
  action,
}: {
  company: CompanyPageRef;
  label: string;
  action: ReactNode;
}) {
  // In-app company view (the bare `/company/<slug>` is the logged-out surface).
  const href = `/connect/company/${company.slug}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cr-space-sm)' }}>
      <Link href={href} aria-label={company.name} className="no-underline">
        <DsAvatar name={company.name} src={company.logo || undefined} size={40} />
      </Link>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Link
          href={href}
          className="no-underline"
          style={{
            display: 'block',
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--cr-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {company.name}
        </Link>
        <div style={{ fontSize: 12, color: 'var(--cr-text-4)', marginTop: 1 }}>{label}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{action}</div>
    </div>
  );
}
