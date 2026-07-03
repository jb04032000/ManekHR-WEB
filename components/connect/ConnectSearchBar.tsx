'use client';

/**
 * ConnectSearchBar - the global Connect typeahead search (desktop header).
 *
 * Federated (SRCH-A11Y-1): as the member types (debounced 250 ms) two parallel
 * actions fire - `searchConnectAll` for the blended verticals (people +
 * listings + posts + jobs, the SAME federated endpoint the mobile sheet
 * `ConnectMobileSearch` and the `/connect/search` results page use) and
 * `searchTags` for tag autocomplete. The dropdown shows: a default-active
 * "See all results" row (opens `/connect/search?q=` on Enter), then tags, then
 * people, listings, posts, and jobs. Previously this bar called the legacy
 * people-only `searchConnect`; switching to `searchConnectAll` makes the desktop
 * typeahead match the mobile + results-page coverage (expansion-plan Phase 1).
 *
 * Selecting a row jumps straight to the entity: person -> `/connect/u/<id>`,
 * listing -> `/connect/marketplace/listing/<id>`, post -> `/connect/posts/<id>`,
 * job -> `/connect/jobs/<id>` (the same routes the jobs board + mobile sheet
 * use - keep in sync if those move), tag -> the results page with
 * `?q=#<slug>&type=people`.
 *
 * The "See all" row carries the CONTEXTUAL default vertical from
 * `searchScopeForPath` (search-context.ts): inside Marketplace it opens the
 * results page scoped to Products, inside Jobs scoped to Jobs, elsewhere the
 * blended `all` view. Keep the path prefixes in that helper in sync with the
 * Connect route tree.
 *
 * Accessibility (SRCH-A11Y-1): the AntD `AutoComplete` renders the WCAG combobox
 * pattern (role=combobox/listbox/option, aria-expanded, and aria-activedescendant
 * on arrow-key navigation - all managed by AntD v6 / rc-select; the explicit
 * `id` keeps the generated descendant ids stable). A visually-hidden polite live
 * region announces the result count to screen readers when results load.
 *
 * Mounted in the shared `TopHeader` for Connect mode (`hidden md:flex`) +
 * rendered inline on the results page (seeded via `initialQuery`).
 *
 * NOTE on superseded requests: `searchConnectAll`/`searchTags` are Next server
 * actions (RPC), so a client `AbortController` cannot cancel the server-side
 * work the way it would a plain `fetch`. The monotonic `reqIdRef` guard below
 * already discards every stale response so a slow reply can never overwrite a
 * newer query (the correctness contract); the server-side spend is bounded by
 * the per-user rate limit + Redis prefix cache shipped in SRCH-PERF-1.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AutoComplete, Input, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ArrowRight, GraduationCap, Store } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DsAvatar } from '@/components/ui';
import { searchConnectAll, searchTags } from '@/features/connect/search.actions';
import {
  categoryLabel,
  type ConnectListingRef,
  type ConnectTagView,
  type PageResult,
  type PersonResult,
  type PostResult,
  type StorefrontResult,
} from '@/features/connect/search.types';
// Type-only: the federated jobs vertical hit shape (mirror of the board card).
import type { Job } from '@/features/connect/jobs/jobs.types';
// Contextual default vertical for the "See all" jump (Marketplace -> Products,
// Jobs -> Jobs). Shared with SearchResultsScreen so both adapt to the route.
import { searchScopeForPath } from '@/features/connect/search/search-context';

interface ConnectSearchBarProps {
  className?: string;
  /**
   * Seed value - passed by `/connect/search` so the inline bar shows the
   * active query for refinement. Omitted in the global header (empty bar).
   */
  initialQuery?: string;
}

/** Sentinel option value for the "See all results" row. */
const SEE_ALL = '__connect_search_see_all__';
/** Sentinel for the non-selectable loading row. */
const LOADING_ROW = '__connect_search_loading__';
/** Prefixes on option values so `handleSelect` routes each vertical differently. */
const TAG_PREFIX = 'tag:';
const LISTING_PREFIX = 'listing:';
const POST_PREFIX = 'post:';
const JOB_PREFIX = 'job:';
// SRCH-VERT-1: storefront + page rows carry a slug (not an id) since their
// deep-links are slug-based (`/connect/store/<slug>`, `/connect/company/<slug>`).
const STORE_PREFIX = 'store:';
const PAGE_PREFIX = 'page:';
/** Min chars before the typeahead fires (a 1-char query fans out too wide). */
const MIN_CHARS = 2;
/** Per-vertical caps - the full set lives on the results page. Mirrors the mobile sheet. */
const MAX_PEOPLE_RESULTS = 5;
const MAX_LISTING_RESULTS = 3;
const MAX_POST_RESULTS = 2;
const MAX_JOB_RESULTS = 3;
/** SRCH-VERT-1: cap the new verticals at 3 each in the typeahead preview. */
const MAX_STORE_RESULTS = 3;
const MAX_PAGE_RESULTS = 3;
/** Cap the inline tag list - top suggestions only, full list is trending. */
const MAX_TAG_RESULTS = 3;
/** Debounce window for keystroke -> fetch. */
const DEBOUNCE_MS = 250;

/** Visually-hidden style for the screen-reader-only live region (no Tailwind in this file). */
const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

type Option = { value: string; label: React.ReactNode; disabled?: boolean };
type OptionGroup = { label: React.ReactNode; options: Option[] };

/** Pick the right label for the active locale, falling back through en + slug. */
function labelFor(tag: ConnectTagView, locale: string): string {
  return tag.labels[locale] ?? tag.labels.en ?? tag.slug;
}

/** Uppercase section header used for each vertical group in the dropdown. */
function sectionHeader(text: string): React.ReactNode {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--cr-text-4)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {text}
    </span>
  );
}

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--cr-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const SUB_STYLE: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--cr-text-4)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export default function ConnectSearchBar({ className, initialQuery = '' }: ConnectSearchBarProps) {
  const t = useTranslations('connect.shell');
  // Federated section headers + listing category labels are owned by the
  // `connect.search` namespace (shared with the mobile sheet + results page).
  const tSearch = useTranslations('connect.search');
  const locale = useLocale();
  const router = useRouter();
  // Drives the contextual "See all" scope (Marketplace -> Products, Jobs -> Jobs).
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [listings, setListings] = useState<ConnectListingRef[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  // SRCH-VERT-1: the two new public verticals in the typeahead preview.
  const [storefronts, setStorefronts] = useState<StorefrontResult[]>([]);
  const [pages, setPages] = useState<PageResult[]>([]);
  const [tags, setTags] = useState<ConnectTagView[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounce timer + a monotonic request id so a slow response can never
  // overwrite the results of a newer keystroke (out-of-order race guard).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const runSearch = useCallback((raw: string) => {
    const q = raw.trim();
    if (q.length < MIN_CHARS) {
      setPeople([]);
      setListings([]);
      setPosts([]);
      setJobs([]);
      setStorefronts([]);
      setPages([]);
      setTags([]);
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    // Federated verticals + tag autocomplete in one parallel fan-out. Force
    // `type: 'all'` so the typeahead always blends every vertical regardless of
    // the route the bar is mounted on (the contextual scope only steers the
    // "See all" jump below, not the inline preview).
    void Promise.all([searchConnectAll({ q, type: 'all' }), searchTags(q)]).then(
      ([fed, tagsRes]) => {
        if (reqId !== reqIdRef.current) return; // stale - a newer query superseded it.
        if (fed.ok) {
          setPeople(fed.data.results.slice(0, MAX_PEOPLE_RESULTS));
          setListings(fed.data.listings.slice(0, MAX_LISTING_RESULTS));
          setPosts(fed.data.posts.slice(0, MAX_POST_RESULTS));
          setJobs(fed.data.jobs.slice(0, MAX_JOB_RESULTS));
          // SRCH-VERT-1: storefronts + pages preview (capped 3 each).
          setStorefronts(fed.data.storefronts.slice(0, MAX_STORE_RESULTS));
          setPages(fed.data.pages.slice(0, MAX_PAGE_RESULTS));
        } else {
          setPeople([]);
          setListings([]);
          setPosts([]);
          setJobs([]);
          setStorefronts([]);
          setPages([]);
        }
        setTags(tagsRes.ok ? tagsRes.data.slice(0, MAX_TAG_RESULTS) : []);
        setLoading(false);
      },
    );
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => runSearch(text), DEBOUNCE_MS);
    },
    [runSearch],
  );

  const reset = useCallback(() => {
    setPeople([]);
    setListings([]);
    setPosts([]);
    setJobs([]);
    setStorefronts([]);
    setPages([]);
    setTags([]);
    setQuery('');
    setLoading(false);
  }, []);

  const handleSelect = useCallback(
    (value: string) => {
      if (value === LOADING_ROW) return;
      if (value === SEE_ALL) {
        const trimmed = query.trim();
        if (trimmed) {
          // Carry the contextual default vertical so "See all" lands on the
          // right tab (Products in Marketplace, Jobs in Jobs, else blended).
          const scope = searchScopeForPath(pathname);
          const typeParam = scope === 'all' ? '' : `&type=${scope}`;
          router.push(`/connect/search?q=${encodeURIComponent(trimmed)}${typeParam}`);
        }
      } else if (value.startsWith(TAG_PREFIX)) {
        const slug = value.slice(TAG_PREFIX.length);
        router.push(`/connect/search?q=${encodeURIComponent('#' + slug)}&type=people`);
      } else if (value.startsWith(LISTING_PREFIX)) {
        // listings -> marketplace listing detail (keep in sync with ConnectMobileSearch).
        router.push(`/connect/marketplace/listing/${value.slice(LISTING_PREFIX.length)}`);
      } else if (value.startsWith(POST_PREFIX)) {
        router.push(`/connect/posts/${value.slice(POST_PREFIX.length)}`);
      } else if (value.startsWith(JOB_PREFIX)) {
        // jobs -> the in-app job detail / apply page (keep in sync with the board).
        router.push(`/connect/jobs/${value.slice(JOB_PREFIX.length)}`);
      } else if (value.startsWith(STORE_PREFIX)) {
        // SRCH-VERT-1: storefront -> the public store (slug-based deep-link).
        router.push(`/connect/store/${value.slice(STORE_PREFIX.length)}`);
      } else if (value.startsWith(PAGE_PREFIX)) {
        // SRCH-VERT-1: company/institute page -> the in-app CompanyPageView.
        router.push(`/connect/company/${value.slice(PAGE_PREFIX.length)}`);
      } else {
        // A person row - jump straight to their in-app profile.
        router.push(`/connect/u/${value}`);
      }
      reset();
    },
    [pathname, query, reset, router],
  );

  const options = useMemo<(Option | OptionGroup)[]>(() => {
    if (query.trim().length < MIN_CHARS) return [];

    // "See all" is first so it is the default-active option - pressing Enter
    // (with nothing arrow-selected) opens the full results page.
    const seeAll: Option = {
      value: SEE_ALL,
      // Primary CTA row: styled as a distinct tinted banner (icon-in-circle +
      // label + forward arrow) so it reads as the "open the full results page"
      // action, not just another result/section row in the dropdown.
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 'var(--cr-radius-md)',
            background: 'var(--cr-primary-light)',
            border: '1px solid var(--cr-primary-border)',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: 'var(--cr-radius-full)',
              background: 'var(--cr-primary)',
              color: 'var(--cr-primary-on)',
            }}
          >
            <SearchOutlined />
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--cr-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t('searchSeeAll', { query: query.trim() })}
          </span>
          <ArrowRight size={16} aria-hidden style={{ flexShrink: 0, color: 'var(--cr-primary)' }} />
        </div>
      ),
    };

    if (
      loading &&
      people.length === 0 &&
      listings.length === 0 &&
      posts.length === 0 &&
      jobs.length === 0 &&
      storefronts.length === 0 &&
      pages.length === 0 &&
      tags.length === 0
    ) {
      return [
        seeAll,
        {
          value: LOADING_ROW,
          disabled: true,
          label: (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cr-text-4)' }}
            >
              <Spin size="small" /> {t('searchSearching')}
            </div>
          ),
        },
      ];
    }

    const opts: (Option | OptionGroup)[] = [seeAll];

    if (tags.length > 0) {
      opts.push({
        label: sectionHeader(t('searchTagsHeader')),
        options: tags.map((tag) => ({
          value: `${TAG_PREFIX}${tag.slug}`,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--cr-radius-full)',
                  background: 'var(--cr-surface-2)',
                  color: 'var(--cr-primary)',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                #
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <div style={TITLE_STYLE}>{labelFor(tag, locale)}</div>
                <div style={SUB_STYLE}>{t('searchTagUsage', { count: tag.usageCount })}</div>
              </span>
            </div>
          ),
        })),
      });
    }

    if (people.length > 0) {
      opts.push({
        label: sectionHeader(tSearch('allSectionPeople')),
        options: people.map((p) => ({
          value: p.userId,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <DsAvatar name={p.name} src={p.avatar ?? undefined} size={32} />
              <div style={{ minWidth: 0 }}>
                <div style={TITLE_STYLE}>{p.name}</div>
                {p.headline && <div style={SUB_STYLE}>{p.headline}</div>}
              </div>
            </div>
          ),
        })),
      });
    }

    if (listings.length > 0) {
      opts.push({
        label: sectionHeader(tSearch('allSectionListings')),
        options: listings.map((l) => ({
          value: `${LISTING_PREFIX}${l.listingId}`,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: 'var(--cr-radius-sm)',
                  background: l.coverImage
                    ? `center / cover no-repeat url(${JSON.stringify(l.coverImage)})`
                    : 'var(--cr-surface-2)',
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={TITLE_STYLE}>{l.title}</div>
                <div style={SUB_STYLE}>
                  {categoryLabel(l.category, (slug) =>
                    tSearch(`listing.category.${slug}` as Parameters<typeof tSearch>[0]),
                  )}
                </div>
              </div>
            </div>
          ),
        })),
      });
    }

    if (posts.length > 0) {
      opts.push({
        label: sectionHeader(tSearch('allSectionPosts')),
        options: posts.map((p) => ({
          value: `${POST_PREFIX}${p.postId}`,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <DsAvatar name={p.author?.name ?? ''} src={p.author?.avatar ?? undefined} size={32} />
              <div style={{ minWidth: 0 }}>
                {p.author?.name && <div style={TITLE_STYLE}>{p.author.name}</div>}
                <div style={SUB_STYLE}>{p.snippet}</div>
              </div>
            </div>
          ),
        })),
      });
    }

    if (jobs.length > 0) {
      opts.push({
        label: sectionHeader(tSearch('allSectionJobs')),
        // Job rows -> /connect/jobs/<id>. Subline = location district (and the
        // wage/role context lives on the full results page).
        options: jobs.map((j) => ({
          value: `${JOB_PREFIX}${j._id}`,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: 'var(--cr-radius-sm)',
                  background: 'var(--cr-surface-2)',
                  color: 'var(--cr-primary)',
                }}
              >
                <SearchOutlined />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={TITLE_STYLE}>{j.title}</div>
                {j.location?.district && <div style={SUB_STYLE}>{j.location.district}</div>}
              </div>
            </div>
          ),
        })),
      });
    }

    // SRCH-VERT-1: storefront rows -> /connect/store/<slug>. Logo (or a store
    // icon placeholder); sub-line = district when set.
    if (storefronts.length > 0) {
      opts.push({
        label: sectionHeader(tSearch('allSectionStorefronts')),
        options: storefronts.map((s) => ({
          value: `${STORE_PREFIX}${s.slug}`,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {s.logo ? (
                <span
                  aria-hidden
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 'var(--cr-radius-sm)',
                    background: `center / cover no-repeat url(${JSON.stringify(s.logo)})`,
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 'var(--cr-radius-sm)',
                    background: 'var(--cr-surface-2)',
                    color: 'var(--cr-primary)',
                  }}
                >
                  <Store size={16} />
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={TITLE_STYLE}>{s.name}</div>
                {s.district && <div style={SUB_STYLE}>{s.district}</div>}
              </div>
            </div>
          ),
        })),
      });
    }

    // SRCH-VERT-1: page rows -> /connect/company/<slug>. Institute pages carry
    // an inline badge (page.kind === 'institute').
    if (pages.length > 0) {
      opts.push({
        label: sectionHeader(tSearch('allSectionPages')),
        options: pages.map((p) => ({
          value: `${PAGE_PREFIX}${p.slug}`,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {p.logo ? (
                <span
                  aria-hidden
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 'var(--cr-radius-sm)',
                    background: `center / cover no-repeat url(${JSON.stringify(p.logo)})`,
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 'var(--cr-radius-sm)',
                    background: 'var(--cr-surface-2)',
                    color: 'var(--cr-primary)',
                  }}
                >
                  <GraduationCap size={16} />
                </span>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span style={{ ...TITLE_STYLE, minWidth: 0 }}>{p.name}</span>
                  {p.kind === 'institute' && (
                    <span
                      style={{
                        flexShrink: 0,
                        padding: '0 6px',
                        borderRadius: 'var(--cr-radius-full)',
                        background: 'var(--cr-surface-2)',
                        color: 'var(--cr-primary)',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {tSearch('page.instituteBadge')}
                    </span>
                  )}
                </div>
                {p.district && <div style={SUB_STYLE}>{p.district}</div>}
              </div>
            </div>
          ),
        })),
      });
    }

    return opts;
  }, [loading, query, people, listings, posts, jobs, storefronts, pages, tags, t, tSearch, locale]);

  // SRCH-A11Y-1: announce the blended result count to screen readers once a
  // search settles (people + listings + posts + jobs). Empty while typing /
  // loading so the count is only spoken when it is final.
  const resultCount =
    people.length +
    listings.length +
    posts.length +
    jobs.length +
    storefronts.length +
    pages.length;
  const announce =
    query.trim().length >= MIN_CHARS && !loading
      ? t('searchResultCount', { count: resultCount })
      : '';

  return (
    <>
      <AutoComplete
        id="connect-search"
        className={className}
        value={query}
        options={options}
        onSearch={handleSearch}
        onSelect={handleSelect}
        filterOption={false}
        notFoundContent={null}
        style={{ width: '100%' }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--cr-text-4)' }} />}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchAriaLabel')}
          data-shortcut="connect-search"
          allowClear
          style={{ borderRadius: 'var(--cr-radius-full)' }}
        />
      </AutoComplete>
      <span role="status" aria-live="polite" style={SR_ONLY}>
        {announce}
      </span>
    </>
  );
}
