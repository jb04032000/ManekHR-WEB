'use client';

/**
 * ConnectMobileSearch - the full-screen mobile search sheet (design-decisions
 * doc §6.4). The global typeahead bar (`ConnectSearchBar`) is desktop-only
 * (`hidden md:flex` in `TopHeader`); on mobile, tapping the header search icon
 * opens THIS full-screen surface instead.
 *
 * Contents, per §6.4 + §13.3:
 *  - A pinned input (autofocus) with a back affordance and an in-input voice
 *    button.
 *  - Empty state: Recent searches (localStorage) + Suggested categories
 *    (curated embroidery seeds from the §13.2 synonym vocabulary, localized).
 *  - As the member types (debounced): live people results, plus a
 *    "See all results" row that opens the full `/connect/search` page.
 *  - Voice search via the Web Speech API (free, on-device in Chromium): the
 *    transcript fills the input so the member confirms before submitting
 *    (§13.3 "shows the text before submitting"). The button hides where the
 *    API is unsupported (Firefox / some iOS), degrading to text search.
 *
 * Saved searches (the §13.4 "save a search -> alert" feature) are intentionally
 * NOT here yet - they need their own persistence + alerting backend (Phase 5 /
 * 7). This surface is built to host them later without a stub today.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Clock, ImageOff, Loader2, Mic, Search, X } from 'lucide-react';
import { DsAvatar } from '@/components/ui';
import { searchConnectAll } from '@/features/connect/search.actions';
import {
  categoryLabel,
  type ConnectListingRef,
  type PersonResult,
  type PostResult,
} from '@/features/connect/search.types';

interface ConnectMobileSearchProps {
  open: boolean;
  onClose: () => void;
}

/** localStorage key for the member's recent query strings. */
const RECENT_KEY = 'z360.connect.recentSearches';
const MAX_RECENT = 6;
/** Min chars before the typeahead fires (mirrors `ConnectSearchBar`). */
const MIN_CHARS = 2;
/** Per-vertical preview caps. Keep the overlay light and scannable; the full
 *  set is one tap away on the "See all results" page. */
const PEOPLE_CAP = 3;
const POST_CAP = 2;
const LISTING_CAP = 3;
const DEBOUNCE_MS = 250;

/** The blended typeahead preview: a short slice of each live vertical. */
interface SearchPreview {
  people: PersonResult[];
  posts: PostResult[];
  listings: ConnectListingRef[];
}

const EMPTY_PREVIEW: SearchPreview = { people: [], posts: [], listings: [] };

/**
 * Suggested category seeds - curated embroidery search terms (design-decisions
 * doc §13.2 synonym vocabulary). `query` is the canonical term sent to search;
 * the label is localized via `categories.<key>`. These are real searches, not
 * placeholders.
 */
const SUGGESTED: readonly { key: string; query: string }[] = [
  { key: 'saree', query: 'saree' },
  { key: 'lehenga', query: 'lehenga' },
  { key: 'blouse', query: 'blouse' },
  { key: 'kurta', query: 'kurta' },
  { key: 'dupatta', query: 'dupatta' },
  { key: 'zardozi', query: 'zardozi' },
  { key: 'multihead', query: 'multi-head' },
  { key: 'bridal', query: 'bridal' },
];

// ── Web Speech API (minimal typed shim) ──────────────────────────────
// The DOM lib does not ship `SpeechRecognition` types; declare just the
// surface we use so production code stays free of `any`.
interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  0: SpeechAlternative;
  isFinal: boolean;
}
interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: SpeechResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Map the active z360 locale cookie to a BCP-47 speech locale. */
function speechLang(): string {
  if (typeof document === 'undefined') return 'en-IN';
  const match = document.cookie.match(/z360_locale=([^;]+)/);
  const loc = match ? match[1] : 'en';
  if (loc.startsWith('gu')) return 'gu-IN';
  if (loc.startsWith('hi')) return 'hi-IN';
  return 'en-IN';
}

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // Private mode / quota - recents are a nicety, never load-blocking.
  }
}

export default function ConnectMobileSearch({ open, onClose }: ConnectMobileSearchProps) {
  const t = useTranslations('connect.shell');
  const tSearch = useTranslations('connect.search');
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<SearchPreview>(EMPTY_PREVIEW);
  const [loading, setLoading] = useState(false);
  // Seeded lazily (client-only reads): both functions guard `typeof window`,
  // so SSR yields []/false, and the overlay renders null until opened, so the
  // post-hydration client value is what the member ever sees (no mismatch).
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const [listening, setListening] = useState(false);
  const [voiceSupported] = useState(() => getSpeechRecognitionCtor() !== null);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const runSearch = useCallback((raw: string) => {
    const q = raw.trim();
    if (q.length < MIN_CHARS) {
      setPreview(EMPTY_PREVIEW);
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    // Federated search (people + posts + listings), the same call the desktop
    // results page uses. The overlay shows a short blended preview of each.
    void searchConnectAll({ q }).then((res) => {
      if (reqId !== reqIdRef.current) return; // stale - superseded by a newer query.
      setPreview(
        res.ok
          ? {
              people: res.data.results.slice(0, PEOPLE_CAP),
              posts: res.data.posts.slice(0, POST_CAP),
              listings: res.data.listings.slice(0, LISTING_CAP),
            }
          : EMPTY_PREVIEW,
      );
      setLoading(false);
    });
  }, []);

  const onQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => runSearch(text), DEBOUNCE_MS);
    },
    [runSearch],
  );

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopVoice();
    setQuery('');
    setPreview(EMPTY_PREVIEW);
    setLoading(false);
  }, [stopVoice]);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // On open: autofocus the input + lock background scroll. (Recents and voice
  // support are seeded lazily in useState above; reading them here would be a
  // synchronous setState-in-effect, and is unnecessary - this component is the
  // only writer of both.)
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Tear down voice + timers on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      recognitionRef.current?.stop();
    },
    [],
  );

  const submit = useCallback(
    (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      const next = [q, ...recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(
        0,
        MAX_RECENT,
      );
      setRecent(next);
      writeRecent(next);
      router.push(`/connect/search?q=${encodeURIComponent(q)}`);
      close();
    },
    [recent, router, close],
  );

  const selectPerson = useCallback(
    (userId: string) => {
      router.push(`/connect/u/${userId}`);
      close();
    },
    [router, close],
  );

  const selectListing = useCallback(
    (listingId: string) => {
      router.push(`/connect/marketplace/listing/${listingId}`);
      close();
    },
    [router, close],
  );

  const selectPost = useCallback(
    (postId: string) => {
      router.push(`/connect/posts/${postId}`);
      close();
    },
    [router, close],
  );

  const clearRecent = useCallback(() => {
    setRecent([]);
    writeRecent([]);
  }, []);

  const removeRecent = useCallback((term: string) => {
    setRecent((prev) => {
      const next = prev.filter((r) => r !== term);
      writeRecent(next);
      return next;
    });
  }, []);

  const startVoice = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    if (listening) {
      stopVoice();
      return;
    }
    const recognition = new Ctor();
    recognition.lang = speechLang();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      onQueryChange(text);
    };
    recognition.onerror = () => stopVoice();
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [listening, onQueryChange, stopVoice]);

  const showResults = query.trim().length >= MIN_CHARS;
  const previewTotal = preview.people.length + preview.posts.length + preview.listings.length;

  const suggestedItems = useMemo(
    () =>
      SUGGESTED.map((s) => ({
        ...s,
        label: t(`mobileSearch.categories.${s.key}` as Parameters<typeof t>[0]),
      })),
    [t],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('mobileSearch.title')}
      className="fixed inset-0 flex flex-col bg-surface md:hidden"
      style={{ zIndex: 1100, paddingTop: 'env(safe-area-inset-top)' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
    >
      {/* Pinned input row. */}
      <div className="flex items-center gap-2 border-b border-border-light px-2 py-2">
        <button
          type="button"
          onClick={close}
          aria-label={t('mobileSearch.back')}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        >
          <ArrowLeft size={20} aria-hidden />
        </button>

        <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-surface-2 px-3">
          <Search size={16} aria-hidden className="flex-shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit(query);
            }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchAriaLabel')}
            inputMode="search"
            enterKeyHint="search"
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-heading outline-none placeholder:text-faint"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label={t('mobileSearch.clearInput')}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-faint hover:text-heading"
            >
              <X size={16} aria-hidden />
            </button>
          )}
          {voiceSupported && (
            <button
              type="button"
              onClick={startVoice}
              aria-label={listening ? t('mobileSearch.voiceStop') : t('mobileSearch.voiceStart')}
              aria-pressed={listening}
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                listening ? 'animate-pulse bg-primary-light text-primary' : 'text-muted'
              }`}
            >
              <Mic size={18} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Body - live results, or recent + suggested. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {listening && (
          <p className="px-2 pb-2 text-[13px] text-subtle" role="status">
            {t('mobileSearch.voiceListening')}
          </p>
        )}

        {showResults ? (
          <div>
            {/* See-all row - also the Enter target. */}
            <button
              type="button"
              onClick={() => submit(query)}
              className="flex w-full items-center gap-3 rounded-lg border border-primary-border bg-primary-light px-3 py-2.5 text-start transition hover:brightness-95"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <Search size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-primary">
                {t('searchSeeAll', { query: query.trim() })}
              </span>
              <ArrowRight size={18} aria-hidden className="flex-shrink-0 text-primary" />
            </button>

            {loading && previewTotal === 0 ? (
              <p className="flex items-center gap-2 px-2 py-3 text-[13px] text-subtle">
                <Loader2 size={15} aria-hidden className="animate-spin" />
                {t('searchSearching')}
              </p>
            ) : previewTotal === 0 ? (
              <p className="px-2 py-3 text-[13px] text-subtle">
                {t('mobileSearch.noResults', { query: query.trim() })}
              </p>
            ) : (
              <>
                {/* People - order matches the desktop All view. */}
                {preview.people.length > 0 && (
                  <section aria-labelledby="cn-msearch-people" className="mb-2">
                    <h2
                      id="cn-msearch-people"
                      className="m-0 px-2 pb-1 text-[12px] font-semibold tracking-wide text-subtle uppercase"
                    >
                      {tSearch('allSectionPeople')}
                    </h2>
                    {preview.people.map((p) => (
                      <button
                        key={p.userId}
                        type="button"
                        onClick={() => selectPerson(p.userId)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-start hover:bg-surface-2"
                      >
                        <DsAvatar name={p.name} src={p.avatar ?? undefined} size={40} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[14px] font-semibold text-heading">
                            {p.name}
                          </span>
                          {p.headline && (
                            <span className="truncate text-[12px] text-subtle">{p.headline}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </section>
                )}

                {/* Posts. */}
                {preview.posts.length > 0 && (
                  <section aria-labelledby="cn-msearch-posts" className="mb-2">
                    <h2
                      id="cn-msearch-posts"
                      className="m-0 px-2 pb-1 text-[12px] font-semibold tracking-wide text-subtle uppercase"
                    >
                      {tSearch('allSectionPosts')}
                    </h2>
                    {preview.posts.map((p) => (
                      <button
                        key={p.postId}
                        type="button"
                        onClick={() => selectPost(p.postId)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-start hover:bg-surface-2"
                      >
                        <DsAvatar
                          name={p.author?.name ?? ''}
                          src={p.author?.avatar ?? undefined}
                          size={40}
                        />
                        <span className="flex min-w-0 flex-col">
                          {p.author?.name && (
                            <span className="truncate text-[14px] font-semibold text-heading">
                              {p.author.name}
                            </span>
                          )}
                          <span className="truncate text-[12px] text-subtle">{p.snippet}</span>
                        </span>
                      </button>
                    ))}
                  </section>
                )}

                {/* Listings. */}
                {preview.listings.length > 0 && (
                  <section aria-labelledby="cn-msearch-listings" className="mb-2">
                    <h2
                      id="cn-msearch-listings"
                      className="m-0 px-2 pb-1 text-[12px] font-semibold tracking-wide text-subtle uppercase"
                    >
                      {tSearch('allSectionListings')}
                    </h2>
                    {preview.listings.map((l) => (
                      <button
                        key={l.listingId}
                        type="button"
                        onClick={() => selectListing(l.listingId)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-start hover:bg-surface-2"
                      >
                        <span
                          aria-hidden
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2 text-faint"
                          style={
                            l.coverImage
                              ? {
                                  backgroundImage: `url(${JSON.stringify(l.coverImage)})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }
                              : undefined
                          }
                        >
                          {!l.coverImage && <ImageOff size={18} aria-hidden />}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[14px] font-semibold text-heading">
                            {l.title}
                          </span>
                          <span className="truncate text-[12px] text-subtle">
                            {categoryLabel(l.category, (slug) =>
                              tSearch(`listing.category.${slug}` as Parameters<typeof tSearch>[0]),
                            )}
                          </span>
                        </span>
                      </button>
                    ))}
                  </section>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {recent.length > 0 && (
              <section aria-label={t('mobileSearch.recent')} className="mb-4">
                <div className="flex items-center justify-between px-2 pb-1">
                  <h2 className="m-0 text-[12px] font-semibold tracking-wide text-subtle uppercase">
                    {t('mobileSearch.recent')}
                  </h2>
                  <button
                    type="button"
                    onClick={clearRecent}
                    className="text-[12px] font-semibold text-primary"
                  >
                    {t('mobileSearch.clearRecent')}
                  </button>
                </div>
                {recent.map((term) => (
                  <div
                    key={term}
                    className="flex items-center gap-3 rounded-lg px-2 hover:bg-surface-2"
                  >
                    <button
                      type="button"
                      onClick={() => submit(term)}
                      className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-start"
                    >
                      <Clock size={16} aria-hidden className="flex-shrink-0 text-faint" />
                      <span className="truncate text-[14px] text-heading">{term}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecent(term)}
                      aria-label={t('mobileSearch.removeRecent', { term })}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-faint hover:text-heading"
                    >
                      <X size={15} aria-hidden />
                    </button>
                  </div>
                ))}
              </section>
            )}

            <section aria-label={t('mobileSearch.suggested')}>
              <h2 className="m-0 px-2 pb-2 text-[12px] font-semibold tracking-wide text-subtle uppercase">
                {t('mobileSearch.suggested')}
              </h2>
              <div className="flex flex-wrap gap-2 px-2">
                {suggestedItems.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => submit(s.query)}
                    className="rounded-full border border-border-light bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-body hover:border-border"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
