'use client';

/**
 * StorefrontResultCard - one public Storefront in the search results
 * (SRCH-VERT-1). A name-search jump-to row: it deep-links the in-app public
 * store at `/connect/store/[slug]` (the same route the marketplace + Following
 * tab link to - keep in sync if it moves). NOT a directory entry: this only
 * appears when the member searched and a store name matched.
 *
 * Mirrors `PostResultCard` / `ListingCard` aesthetics (inline `--cr-*` tokens):
 * logo (or a name-initial placeholder when none), name, then a sub-line of
 * district + categories. Static link, no interactive store internals mounted.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MapPin, Store } from 'lucide-react';
import type { StorefrontResult } from '../search.types';

/** Title-case a raw district so a lowercase entry ("surat") reads as a place. */
function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StorefrontResultCard({ store }: { store: StorefrontResult }) {
  const t = useTranslations('connect.search');
  // Deep-link the public storefront. Same route family as the marketplace
  // store links + the Following tab (`/connect/store/[slug]`).
  const href = `/connect/store/${store.slug}`;

  // Sub-line: district first (place anchor), then up to two category labels.
  // Categories are seller-coined free text, humanized inline (no enum here).
  const subParts: string[] = [];
  if (store.district) subParts.push(titleCase(store.district));
  if (store.categories.length > 0) {
    subParts.push(store.categories.slice(0, 2).join(', '));
  }
  const sub = subParts.join(' · ');

  return (
    <Link
      href={href}
      aria-label={t('storefront.cardAria', { name: store.name })}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '14px 4px',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      {store.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded store logo of unknown dimensions; the established Connect pattern is <img> + object-fit
        <img
          src={store.logo}
          alt=""
          aria-hidden
          style={{
            width: 48,
            height: 48,
            objectFit: 'cover',
            borderRadius: 'var(--cr-radius-sm)',
            border: '1px solid var(--cr-border-light)',
            background: 'var(--cr-surface-2)',
            flexShrink: 0,
          }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 48,
            height: 48,
            borderRadius: 'var(--cr-radius-sm)',
            border: '1px solid var(--cr-border-light)',
            background: 'var(--cr-surface-2)',
            color: 'var(--cr-primary)',
            flexShrink: 0,
          }}
        >
          <Store size={22} />
        </span>
      )}

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--cr-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {store.name}
        </div>
        {sub ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 1,
              fontSize: 12.5,
              color: 'var(--cr-text-4)',
              overflow: 'hidden',
            }}
          >
            {store.district && <MapPin size={12} aria-hidden style={{ flexShrink: 0 }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sub}
            </span>
          </div>
        ) : store.description ? (
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 12.5,
              lineHeight: 1.4,
              color: 'var(--cr-text-4)',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {store.description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
