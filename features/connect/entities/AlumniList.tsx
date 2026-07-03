'use client';

/**
 * AlumniList - the institute company page's Alumni / Open-to-work tab
 * (Institutes Phase 2, Feature 2). A responsive grid of `PersonCard`
 * (variant='card'), where each card's `openStatus='work'` drives the avatar's
 * floating ring + the inline Message control, so an employer can reach an
 * available alumnus straight from the wall.
 *
 * Cross-module links:
 *  - Data: `getInstituteAlumni` (company-page.actions) -> BE @Public()
 *    `connect/company-pages/public/:pageId/alumni`. The BE already DPDP-trims
 *    (only opted-in, public, open-to-work students), so this just renders.
 *  - PersonCard (`components/connect/PersonCard`) is the shared people-card
 *    primitive; we map `InstituteAlumnus` -> its `ConnectPerson` shape. Message
 *    -> inbox `startInboxDm` (lives inside PersonCard's StartConversationButton).
 *  - Tab visibility + the owner-only empty-state CTA live in CompanyPageView;
 *    this list is rendered only when there is at least one alumnus, so it never
 *    shows its own empty state (the owner sees the invite CTA instead).
 *
 * Paging mirrors `CompanyPagePostsList`: SSR-seeded first page (`initialPage`)
 * + `useInfiniteQuery` (`staleTime: Infinity`) + a "Show more" button driven by
 * the keyset `nextCursor`. Keep the queryKey + initialData seeding in sync with
 * that sibling.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import PersonCard, { type ConnectPerson } from '@/components/connect/PersonCard';
import { getInstituteAlumni } from './company-page.actions';
import type { InstituteAlumniResult, InstituteAlumnus } from './entities.types';

interface Props {
  pageId: string;
  /** SSR-seeded first page of alumni. */
  initialPage: InstituteAlumniResult;
}

/** Map a BE `InstituteAlumnus` onto the shared PersonCard `ConnectPerson` shape.
 *  `headline`/`avatarUrl` are nullable on the wire -> normalise to undefined so
 *  PersonCard's optional props read cleanly. `degree` is absent on the logged-out
 *  read; only narrow + forward the three values PersonCard understands (1|2|3). */
function toPerson(a: InstituteAlumnus): ConnectPerson {
  const degree = a.degree === 1 || a.degree === 2 || a.degree === 3 ? a.degree : undefined;
  return {
    userId: a.userId,
    name: a.name,
    headline: a.headline ?? undefined,
    avatarUrl: a.avatarUrl ?? undefined,
    openStatus: a.openStatus,
    degree,
  };
}

export default function AlumniList({ pageId, initialPage }: Props) {
  const t = useTranslations('connect.companyPage');

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['connect-institute-alumni', pageId],
    queryFn: async ({ pageParam }) => {
      const res = await getInstituteAlumni(pageId, { cursor: pageParam });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: InstituteAlumniResult) => last.nextCursor ?? undefined,
    initialData: { pages: [initialPage], pageParams: [undefined as string | undefined] },
    staleTime: Infinity,
  });

  const alumni = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <ul
        className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3"
        aria-label={t('alumniListAria')}
      >
        {alumni.map((a) => (
          <li key={a.userId}>
            <PersonCard person={toPerson(a)} variant="card" />
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          aria-label={t('alumniLoadMoreAria')}
          className="self-center rounded-full px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60"
          style={{ border: '1px solid var(--cr-border)', color: 'var(--cr-text-2)' }}
        >
          {isFetchingNextPage ? t('postsLoadingMore') : t('postsLoadMore')}
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="m-0 text-center text-[12px]"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {t('alumniLoadError')}
        </p>
      )}
    </div>
  );
}
