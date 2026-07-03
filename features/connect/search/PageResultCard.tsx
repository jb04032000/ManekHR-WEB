'use client';

/**
 * PageResultCard - one public Company / Institute page in the search results
 * (SRCH-VERT-1). A name-search jump-to row deep-linking the in-app CompanyPageView
 * at `/connect/company/[slug]` (the same route PostCard's page-author link + the
 * jobs employer link use - keep in sync if it moves). NOT a directory entry:
 * appears only when a page name matched the member's search.
 *
 * The `kind` discriminant ('business' | 'institute') drives an "Institute" badge
 * next to the name so a training institute is recognisable at a glance (mirrors
 * the Institutes Phase 1 page-kind treatment elsewhere in Connect). Static link;
 * no page internals mounted.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, GraduationCap, MapPin } from 'lucide-react';
import type { PageResult } from '../search.types';

/** Title-case a raw district so a lowercase entry ("surat") reads as a place. */
function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PageResultCard({ page }: { page: PageResult }) {
  const t = useTranslations('connect.search');
  // Deep-link the in-app company page. Same route as the PostCard page-author
  // link + the jobs employer link (`/connect/company/[slug]`).
  const href = `/connect/company/${page.slug}`;
  const isInstitute = page.kind === 'institute';

  // Sub-line: district (place anchor) when present, else the about one-liner.
  const sub = page.district ? titleCase(page.district) : null;

  return (
    <Link
      href={href}
      aria-label={t('page.cardAria', { name: page.name })}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '14px 4px',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      {page.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded page logo of unknown dimensions; the established Connect pattern is <img> + object-fit
        <img
          src={page.logo}
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
          {isInstitute ? <GraduationCap size={22} /> : <Building2 size={22} />}
        </span>
      )}

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--cr-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {page.name}
          </span>
          {isInstitute && (
            // Institute badge: name-level recognition for a training page. Driven
            // by the backend `kind === 'institute'` discriminant.
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0,
                padding: '1px 7px',
                borderRadius: 'var(--cr-radius-full)',
                background: 'var(--cr-primary-bg, var(--cr-surface-2))',
                color: 'var(--cr-primary)',
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1.6,
              }}
            >
              <GraduationCap size={11} aria-hidden />
              {t('page.instituteBadge')}
            </span>
          )}
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
            <MapPin size={12} aria-hidden style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sub}
            </span>
          </div>
        ) : page.about ? (
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
            {page.about}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
