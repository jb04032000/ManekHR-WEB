import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ConnectPage } from '@/components/connect';

/**
 * Shown by /connect/boost/open-to-work and /connect/boost/hiring when the caller
 * has NOT turned on the matching "open to" intent yet. A profile boost promotes
 * that status, so it is meaningless until the toggle is on. Sends the user to
 * their profile to enable it. Server component (no hooks).
 *
 * Cross-module: the intent toggles live on the ConnectProfile (`openTo.work` /
 * `openTo.hiring`), edited from the profile intent cards.
 */
export default async function ProfileBoostNudge({ intent }: { intent: 'work' | 'hiring' }) {
  const t = await getTranslations('connect.boosts.intentBoost');
  return (
    <ConnectPage>
      <div
        className="mx-auto mt-6 max-w-[520px] rounded-[var(--cr-radius-lg)] p-6 text-center"
        style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
      >
        <h1 className="m-0 text-[18px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {t(`${intent}.nudgeTitle`)}
        </h1>
        <p className="m-0 mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--cr-text-3)' }}>
          {t(`${intent}.nudgeBody`)}
        </p>
        <Link
          href="/connect/profile"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-[var(--cr-radius-md)] px-5 text-[13.5px] font-bold no-underline"
          style={{ background: 'var(--cr-primary)', color: 'var(--cr-primary-on)' }}
        >
          {t('nudgeCta')}
        </Link>
      </div>
    </ConnectPage>
  );
}
