import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TriangleAlert } from 'lucide-react';
import { getSaved } from '@/features/connect/feed.actions';
import SavedList from '@/features/connect/feed/SavedList';
import { ConnectPage } from '@/components/connect';
import { getMe } from '@/lib/actions/auth.actions';

/**
 * `/connect/saved` - the caller's saved (bookmarked) posts.
 *
 * A Server Component (ENGINEERING-STANDARDS #7). It loads the first page of the
 * viewer's saved posts and hands it to the client `SavedList`, which owns paging
 * + the un-save prune. Single-column (a utility list, no feed rails). The
 * Connect shell lives in the route-group layout.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.saved');
  return { title: t('metaTitle') };
}

export default async function ConnectSavedPage() {
  const t = await getTranslations('connect.saved');
  const [savedRes, me] = await Promise.all([getSaved(), getMe()]);

  // Onboarding is treated as complete across Connect (mirrors the feed page).
  const onboarded = true;

  return (
    <ConnectPage>
      <main
        className="w-full"
        style={{ maxWidth: 'var(--cn-feed-max-w, 600px)', margin: '0 auto' }}
      >
        <header style={{ marginBottom: 'var(--cr-space-lg)' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--cr-text)' }}>
            {t('title')}
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13.5,
              lineHeight: 1.5,
              color: 'var(--cr-text-4)',
            }}
          >
            {t('subtitle')}
          </p>
        </header>

        {savedRes.ok ? (
          <SavedList initialPage={savedRes.data} viewerId={me._id} onboarded={onboarded} />
        ) : (
          <div
            role="alert"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 'var(--cr-space-sm)',
              padding: 'var(--cr-space-xl) var(--cr-space-md)',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--cr-error-bg)',
                color: 'var(--cr-error)',
              }}
            >
              <TriangleAlert size={22} />
            </span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text)' }}>
              {t('loadErrorTitle')}
            </h2>
            <p
              style={{
                margin: 0,
                maxWidth: 360,
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--cr-text-4)',
              }}
            >
              {t('loadError')}
            </p>
          </div>
        )}
      </main>
    </ConnectPage>
  );
}
