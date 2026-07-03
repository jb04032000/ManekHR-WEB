'use client';

/**
 * FeedPeopleToFollow - an in-feed "People to follow" card (Phase 7c cold-start).
 *
 * The right rail already carries PYMK on desktop, but the rails are hidden
 * below `xl` - so on mobile / tablet a member (especially a brand-new one who
 * follows nobody) has no follow prompt at all. This card fills that gap: it is
 * rendered `xl:hidden` directly in the feed column, reusing the exact PYMK
 * primitives (`PersonCard` + `PersonCardActions`) so behaviour matches the rail.
 *
 * Renders nothing when there are no suggestions.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PersonCard, type ConnectPerson } from '@/components/connect';
import PersonCardActions from '../network/PersonCardActions';

/** People shown inline before the "See all" link takes over. */
const INLINE_LIMIT = 3;

export default function FeedPeopleToFollow({ people }: { people: ConnectPerson[] }) {
  const t = useTranslations('connect.feed');
  if (people.length === 0) return null;
  const shown = people.slice(0, INLINE_LIMIT);

  return (
    <section
      aria-label={t('rightRail.title')}
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--cr-border-light)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--cr-text)' }}>
          {t('rightRail.title')}
        </h2>
        <Link
          href="/connect/network?tab=suggestions"
          className="no-underline"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-primary)' }}
        >
          {t('rightRail.seeAll')}
        </Link>
      </div>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-sm)', padding: 16 }}
      >
        {shown.map((person) => (
          <PersonCard
            key={person.userId}
            person={person}
            action={<PersonCardActions userId={person.userId} mode="followOnly" />}
          />
        ))}
      </div>
    </section>
  );
}
