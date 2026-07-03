'use client';

/**
 * PostFacetPanel - the posts facet strip for the `/connect/search` Posts tab
 * (search redesign Phase C.1). A single content-kind single-select (text /
 * photo / video / document / voice) reducing to `?kind=`, mirroring the
 * LinkedIn posts "content type" filter. Tapping the active pill clears it.
 *
 * URL-synced like `ListingFacetPanel`: reads the live URL via `useSearchParams`,
 * mutates only `kind`, and pushes with `router.push`. The header
 * `ConnectSearchBar` owns `q`, so this panel has no keyword field.
 */

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import DsButton from '@/components/ui/DsButton';
import { POST_KINDS, type PostKind } from '../search.types';

export default function PostFacetPanel() {
  const t = useTranslations('connect.search.postFacets');
  const tKind = useTranslations('connect.search.post.kind');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKind = searchParams.get('kind');

  const pushKind = useCallback(
    (next: PostKind | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set('kind', next);
      else params.delete('kind');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  return (
    <section aria-label={t('title')} className="cn-facet-bar">
      <div
        role="group"
        aria-label={t('kindGroupAria')}
        style={{
          flexBasis: '100%',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
        }}
      >
        {POST_KINDS.map((kind) => {
          const active = urlKind === kind;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={active}
              onClick={() => pushKind(active ? null : kind)}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--cr-radius-full)',
                border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
                background: active ? 'var(--cr-primary)' : 'var(--cr-surface-2)',
                color: active ? 'var(--cr-surface)' : 'var(--cr-text-2)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tKind(kind)}
            </button>
          );
        })}
        {urlKind && (
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            aria-label={t('clearAria')}
            onClick={() => pushKind(null)}
          >
            {t('clear')}
          </DsButton>
        )}
      </div>
    </section>
  );
}
