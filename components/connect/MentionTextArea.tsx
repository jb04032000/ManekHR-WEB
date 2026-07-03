'use client';

/**
 * MentionTextArea - a controlled AntD `Input.TextArea` wrapper that adds an
 * "@"-typeahead so the composer + comment box can TAG people, company pages, and
 * storefronts. What it does: as the member types, it detects an active "@query"
 * token at the caret, debounces a `suggestMentions` fetch, and shows a keyboard-
 * navigable dropdown; selecting a row inserts "@<display> " into the text and
 * records a picked mention `{ type, refId, display }`. Mentions are reconciled
 * atomically on every keystroke - any tag whose "@display" token was edited away
 * is dropped (no rich editor / no orphan chips).
 *
 * Cross-module links:
 *  - fetch -> `features/connect/mention.actions` `suggestMentions(q, scope)` ->
 *    backend GET /connect/mention/suggest. Returns link-ready suggestions.
 *  - the picked-mention shape `{ type, refId, display }` is what `createPost`
 *    (Composer) and `addComment` (PostComments) accept as `mentions`, and what
 *    the display-side `MentionText` renderer matches back by "@display".
 *  - avatar rows reuse `ConnectAvatar` (same primitive the search dropdown uses).
 *  - dropdown UI + debounce + request-race guard are MODELLED on
 *    `ConnectSearchBar` (keep the spacing/border/shadow + the monotonic reqId
 *    guard in sync if that bar changes).
 *
 * Gotchas:
 *  - server actions are RPC, so a slow reply cannot be cancelled like a fetch;
 *    the `reqIdRef` monotonic guard discards every stale response so a late reply
 *    never overwrites a newer query (correctness contract).
 *  - the active-token regex `/(^|\s)@([^\s@]{1,40})$/` runs against
 *    value.slice(0, caret) so it only ever matches the token the caret sits in.
 *  - keep keyboard a11y (listbox/option + aria-activedescendant) intact for WCAG.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Input } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { useTranslations } from 'next-intl';
import ConnectAvatar from '@/components/connect/ConnectAvatar';
import { suggestMentions, type MentionSuggestion } from '@/features/connect/mention.actions';

/** A tag the composer stores for submit. Mirrors the `createPost` /
 *  `addComment` `mentions[]` item shape (display drives the display-time match). */
export type PickedMention = {
  type: 'profile' | 'company' | 'storefront';
  refId: string;
  display: string;
};

interface MentionTextAreaProps {
  value: string;
  mentions: PickedMention[];
  /** Fired on every text edit AND on select - returns the new value plus the
   *  reconciled mention list (tags whose token is gone are already dropped). */
  onChange: (value: string, mentions: PickedMention[]) => void;
  placeholder?: string;
  maxLength?: number;
  autoSize?: { minRows?: number; maxRows?: number };
  /** Narrows the picker (people / pages / shops). Defaults to all. */
  scope?: 'all' | 'people' | 'companies' | 'storefronts';
  ['aria-label']?: string;
  /** Fires once when the dropdown first opens (analytics hook, later). */
  onPickerOpen?: () => void;
  /** Fires on every accepted suggestion (analytics hook, later). */
  onMentionAdd?: (m: PickedMention) => void;
}

/** Active-token matcher: an "@query" of 1-40 non-space/non-@ chars at the end of
 *  the text-before-caret, preceded by start-of-text or whitespace. The captured
 *  group 2 is the live query we feed to `suggestMentions`. */
const TOKEN_RE = /(^|\s)@([^\s@]{1,40})$/;
/** Debounce window keystroke -> fetch (a touch tighter than the search bar). */
const DEBOUNCE_MS = 180;
/** Map a suggestion type to its short i18n type-label key (person/page/shop). */
const TYPE_LABEL_KEY: Record<MentionSuggestion['type'], string> = {
  profile: 'typeProfile',
  company: 'typeCompany',
  storefront: 'typeStorefront',
};

/** Shared dropdown row text styles (modelled on ConnectSearchBar). */
const ROW_TITLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--cr-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const ROW_TYPE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--cr-text-4)',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  flexShrink: 0,
};

export default function MentionTextArea({
  value,
  mentions,
  onChange,
  placeholder,
  maxLength,
  autoSize,
  scope = 'all',
  onPickerOpen,
  onMentionAdd,
  ...rest
}: MentionTextAreaProps) {
  const t = useTranslations('connect.feed.mention');
  const ariaLabel = rest['aria-label'];

  // AntD TextArea ref. The raw DOM <textarea> (for caret read/restore) lives at
  // `ref.resizableTextArea.textArea`; `ref.focus()` is the public focus method.
  const taRef = useRef<TextAreaRef | null>(null);
  /** Resolve the raw DOM textarea from the AntD ref (null before mount). */
  const domNode = (): HTMLTextAreaElement | null =>
    taRef.current?.resizableTextArea?.textArea ?? null;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MentionSuggestion[]>([]);
  const [active, setActive] = useState(0);
  // The slice [tokenStart, caret) the next select replaces (the "@..." run).
  const tokenRef = useRef<{ start: number; end: number } | null>(null);

  // Debounce timer + monotonic request id so a slow reply can never overwrite a
  // newer query (see ConnectSearchBar - server actions can't be aborted).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);
  // Track open transitions so onPickerOpen fires exactly once per closed->open.
  const wasOpenRef = useRef(false);

  // Stable ids for the listbox + active option (WCAG combobox wiring).
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setItems([]);
    setActive(0);
    setLoading(false);
    tokenRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    // Invalidate any in-flight reply so a late resolve can't re-open the list.
    reqIdRef.current++;
  }, []);

  // Fire onPickerOpen once on each closed->open edge (analytics hook).
  useEffect(() => {
    if (open && !wasOpenRef.current) onPickerOpen?.();
    wasOpenRef.current = open;
  }, [open, onPickerOpen]);

  // Cleanup the debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /** Detect the active "@query" at the caret and (de)schedule a picker fetch. */
  const detectToken = useCallback(
    (text: string, caret: number) => {
      const before = text.slice(0, caret);
      const m = TOKEN_RE.exec(before);
      if (!m) {
        closeDropdown();
        return;
      }
      const query = m[2];
      // The "@" sits just before the captured query; record the replace range.
      const start = caret - query.length - 1;
      tokenRef.current = { start, end: caret };
      const reqId = ++reqIdRef.current;
      setOpen(true);
      setLoading(true);
      setActive(0);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void suggestMentions(query, scope).then((res) => {
          if (reqId !== reqIdRef.current) return; // stale - newer query superseded.
          // Ignore failures (just show no rows); never surface an error here.
          setItems(res.ok ? res.data : []);
          setLoading(false);
        });
      }, DEBOUNCE_MS);
    },
    [scope, closeDropdown],
  );

  /** Reconcile mentions atomically: drop any tag whose "@display" token is gone,
   *  then emit. Runs on EVERY change so edited-away chips never linger. */
  const emit = useCallback(
    (nextValue: string, nextMentions: PickedMention[]) => {
      const reconciled = nextMentions.filter((mtn) => nextValue.includes('@' + mtn.display));
      onChange(nextValue, reconciled);
    },
    [onChange],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      const caret = e.target.selectionStart ?? next.length;
      emit(next, mentions);
      detectToken(next, caret);
    },
    [emit, mentions, detectToken],
  );

  const select = useCallback(
    (s: MentionSuggestion) => {
      const tok = tokenRef.current;
      // Without a tracked token range fall back to the latest "@..." run so a
      // keyboard select still works; otherwise append at the end.
      const range =
        tok ??
        (() => {
          const m = TOKEN_RE.exec(value);
          return m ? { start: value.length - m[2].length - 1, end: value.length } : null;
        })();
      const insert = `@${s.display} `; // trailing space ends the token cleanly.
      const newValue = range
        ? value.slice(0, range.start) + insert + value.slice(range.end)
        : value + insert;
      const picked: PickedMention = { type: s.type, refId: s.id, display: s.display };
      // Dedupe an identical refId+display so the same person tagged twice via the
      // picker is recorded once (the renderer matches by "@display" anyway).
      const already = mentions.some(
        (mtn) => mtn.refId === picked.refId && mtn.display === picked.display,
      );
      const nextMentions = already ? mentions : [...mentions, picked];
      emit(newValue, nextMentions);
      onMentionAdd?.(picked);
      closeDropdown();
      // Restore focus + drop the caret right after the inserted token + space.
      requestAnimationFrame(() => {
        const node = domNode();
        taRef.current?.focus();
        // jsdom textareas may lack setSelectionRange - guard so tests don't throw.
        if (node && typeof node.setSelectionRange === 'function') {
          const caret = (range ? range.start : value.length) + insert.length;
          node.setSelectionRange(caret, caret);
        }
      });
    },
    [value, mentions, emit, onMentionAdd, closeDropdown],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!open || items.length === 0) {
        // Escape with the list open-but-empty still closes the picker.
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          closeDropdown();
        }
        return;
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActive((i) => (i + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActive((i) => (i - 1 + items.length) % items.length);
          break;
        case 'Enter':
        case 'Tab':
          // Enter/Tab accept the highlighted row; preventDefault so Enter does
          // not insert a newline and Tab does not leave the field mid-pick.
          e.preventDefault();
          select(items[active]);
          break;
        case 'Escape':
          e.preventDefault();
          closeDropdown();
          break;
        default:
          break;
      }
    },
    [open, items, active, select, closeDropdown],
  );

  const showList = open && (loading || items.length > 0);

  return (
    <div style={{ position: 'relative' }}>
      <Input.TextArea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        // Close on blur so clicking away dismisses the picker (mouseDown-select
        // above already runs before this blur fires).
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoSize={autoSize}
        aria-label={ariaLabel}
        // WCAG combobox wiring for the typeahead popup.
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList && items.length > 0 ? optionId(active) : undefined}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('listLabel')}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            margin: 0,
            padding: '4px 0',
            listStyle: 'none',
            maxHeight: 280,
            overflowY: 'auto',
            background: 'var(--cr-surface)',
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-md)',
            boxShadow: 'var(--cr-shadow-lg, 0 8px 24px rgba(0,0,0,0.12))',
          }}
        >
          {loading && items.length === 0 ? (
            <li
              role="option"
              aria-selected={false}
              aria-disabled
              style={{ padding: '8px 12px', fontSize: 12.5, color: 'var(--cr-text-4)' }}
            >
              {t('loading')}
            </li>
          ) : (
            // Rows rendered inline (React Compiler memoizes); each is a listbox
            // option with avatar + display + a short type label (person/page/shop).
            items.map((s, i) => {
              const selected = i === active;
              return (
                <li
                  key={`${s.type}:${s.id}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  // Mouse down (not click) so the textarea blur does not close the
                  // list before the select handler runs.
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    select(s);
                  }}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: selected ? 'var(--cr-surface-2)' : 'transparent',
                  }}
                >
                  <ConnectAvatar name={s.display} src={s.avatar ?? undefined} size={28} />
                  <span style={{ ...ROW_TITLE, flex: 1, minWidth: 0 }}>{s.display}</span>
                  <span style={ROW_TYPE}>{t(TYPE_LABEL_KEY[s.type])}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
