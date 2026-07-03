import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import ConnectAvatar from '@/components/connect/ConnectAvatar';
import PeopleYouMayKnowConnectButton from './PeopleYouMayKnowConnectButton';
import type { PersonRef } from '@/features/connect/network.types';

/**
 * PeopleYouMayKnow - a compact "people you may know" rail widget (the right-rail
 * suggestions module LinkedIn shows beside content). Presentational + server:
 * the caller fetches + hydrates suggestions (`getSuggestions` -> `getPeople`)
 * and passes the resolved people in, so this adds no fetch. Always renders its
 * card (with an empty hint when there are no suggestions) so the page keeps its
 * three-column shape. Each row links to the in-app profile and carries an
 * inline Connect button that sends a connection request.
 */
export default async function PeopleYouMayKnow({ people }: { people: PersonRef[] }) {
  const t = await getTranslations('connect.network.suggestions');

  return (
    <section
      className="rounded-lg p-4"
      style={{ border: '1px solid var(--cr-border)', background: 'var(--cr-surface)' }}
    >
      <h2 className="m-0 mb-3 text-[14px] font-semibold" style={{ color: 'var(--cr-text)' }}>
        {t('railTitle')}
      </h2>

      {people.length === 0 ? (
        <p className="m-0 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('railEmpty')}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {people.map((person) => (
            <li key={person.userId} className="flex items-center gap-2">
              <Link
                href={`/connect/u/${person.userId}`}
                className="flex min-w-0 flex-1 items-center gap-2.5 no-underline"
              >
                {/* "open to" ring; PersonRef carries openStatus from /connect/people. */}
                <ConnectAvatar
                  name={person.name}
                  src={person.avatar ?? undefined}
                  size={40}
                  status={person.openStatus ?? null}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px] font-semibold"
                    style={{ color: 'var(--cr-text)' }}
                  >
                    {person.name}
                  </span>
                  {person.headline ? (
                    <span
                      className="block truncate text-[12px]"
                      style={{ color: 'var(--cr-text-4)' }}
                    >
                      {person.headline}
                    </span>
                  ) : null}
                </span>
              </Link>
              <PeopleYouMayKnowConnectButton userId={person.userId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
