import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getPublicPost } from '@/features/connect/feed.actions';
import { PublicPostView } from '@/components/connect';
import { env } from '@/lib/env';
import { entitySeo, notFoundSeo } from '@/lib/connect/seo-meta';
import ShareButton from '@/components/connect/ShareButton';

/**
 * `/p/[id]` - the PUBLIC, SEO-indexable single-post permalink + share landing.
 *
 * Mirrors the `/u/[slug]` public-profile pattern: SSR, works logged-out, OG
 * tags so a shared link unfurls a rich card on WhatsApp / social, and a
 * Join-Connect conversion CTA. Only `public`-visibility, non-deleted posts
 * resolve (the backend 404s the rest). Renders the provider-free
 * `PublicPostView` (NOT the interactive `PostCard`, which needs the app-shell
 * providers). The in-app `/connect/posts/[id]` mirror owns the authed,
 * comment-thread experience + is `noindex`; this route owns SEO.
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Request-deduped post load - shared by `generateMetadata` + the page. */
const loadPost = cache((id: string) => getPublicPost(id));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('connect.feed.postDetail');
  const res = await loadPost(id);

  if (!res.ok) return notFoundSeo(t('notFoundTitle'));

  const post = res.data;
  const name = post.author?.name;
  const title = name ? t('metaTitleBy', { name }) : t('metaTitle');
  const description = post.body.trim().slice(0, 160) || t('ogDescription', { name: name ?? '' });
  // A photo post unfurls with its first image; other kinds fall back to the brand card.
  const image = post.kind === 'photo' && post.media[0]?.url ? post.media[0].url : undefined;

  return entitySeo({ path: `/p/${id}`, title, description, image, ogType: 'article' });
}

export default async function PublicPostPage({ params }: PageProps) {
  const { id } = await params;
  const res = await loadPost(id);
  if (!res.ok) notFound();

  const t = await getTranslations('connect');
  const post = res.data;
  const postUrl = `${env.appUrl}/p/${id}`;
  // A post has no title; the share text uses the author name as the entity name.
  const shareName = post.author?.name || 'ManekHR';

  return (
    <div className="mx-auto w-full max-w-[600px] px-4 py-6 sm:py-8">
      <div className="mb-3 flex justify-end">
        <ShareButton surface="post" url={postUrl} name={shareName} size="small" />
      </div>
      <PublicPostView post={post} />

      {/* Logged-out conversion CTA - mirrors the public-profile join card. */}
      <div className="mt-4">
        <div
          className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: 'var(--cr-wash-indigo)',
            border: '1px solid var(--cr-primary-border)',
            borderRadius: 'var(--cr-radius-lg)',
          }}
        >
          <div>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
              {t('profile.joinCtaTitle')}
            </div>
            <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('profile.joinCtaBody')}
            </p>
          </div>
          <Link
            href="/connect"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold no-underline"
            style={{ background: 'var(--cr-primary)', color: '#ffffff', flexShrink: 0 }}
          >
            {t('profile.joinCtaButton')}
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
