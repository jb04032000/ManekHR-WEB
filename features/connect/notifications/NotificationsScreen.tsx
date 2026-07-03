'use client';

/**
 * NotificationsScreen - the dedicated /connect/notifications surface.
 *
 *  - Live list via the `/notifications` Socket.IO push (no polling).
 *  - Per-row click marks read + routes by category.
 *  - "Load older" keyset pagination (provider holds only the recent window).
 *  - Actor identity (avatar + name) resolved in one batch -> "Meera and N others".
 *  - Filter chips (All / Unread / Connect / Workspace) + per-row type tag. The
 *    Connect-vs-Workspace split is the front-end view of the future per-product
 *    "stamp"; once the backend stamps notifications, the same chips read it.
 *  - Day grouping (Today / This week / Earlier) so a long list stays scannable.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { App, Empty, Popconfirm } from 'antd';
import { Bell, CheckCheck, Settings, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ConnectPage, RailPanel } from '@/components/connect';
import ConnectRightRail from '@/components/connect/ConnectRightRail';
import DsButton from '@/components/ui/DsButton';
import { listMyNotifications, type NotificationItem } from './notifications.actions';
import { getPeople } from '@/features/connect/network.actions';
import type { PersonRef } from '@/features/connect/network.types';
import { effectiveProduct, useShellNotifications } from '@/lib/connect/NotificationProvider';
import {
  TOPIC_GROUPS,
  dayBucket,
  groupOf,
  rowHref,
  type TopicGroup,
} from './notification-presentation';
import NotificationRow from './NotificationRow';
import PreferencesDrawer from './PreferencesDrawer';

dayjs.extend(relativeTime);

const PAGE_SIZE = 30;

/** Tab model: two status tabs, a disabled "mentions" placeholder, then topic
 *  groups. Mentions has no data source yet (owner: keep, mark coming soon). */
type StatusFilter = 'all' | 'unread';
type FilterKey = StatusFilter | 'mentions' | TopicGroup;
const STATUS_FILTERS: StatusFilter[] = ['all', 'unread'];

interface NotificationsScreenProps {
  /** Server-loaded first page so the UI is non-empty on initial render. */
  initial: NotificationItem[];
}

export default function NotificationsScreen({ initial }: NotificationsScreenProps) {
  const t = useTranslations('connect.notifications');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { message } = App.useApp();
  // Connect-scoped view of the shared provider ("one engine, two inboxes") -
  // this surface never shows ERP rows, and clear-all wipes only Connect.
  const { notifications, markAllSeen, markRead, markAllRead, refresh, deleteOne, clearAll } =
    useShellNotifications('connect');
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [older, setOlder] = useState<NotificationItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [actorMap, setActorMap] = useState<Record<string, PersonRef>>({});
  const [filter, setFilter] = useState<FilterKey>('all');
  const [prefsOpen, setPrefsOpen] = useState(false);
  // Locally-removed ids. The centre renders rows from THREE buckets (provider
  // list, server `initial`, load-older), but the provider's optimistic delete
  // only prunes its own list. Tracking removed ids here hides the row from
  // every bucket at once; cleared/rolled back as the delete resolves.
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());

  // Visiting the center marks Connect notifications SEEN (clears the bell's red
  // badge). Mount-only - re-running on every provider tick would re-stamp
  // needlessly; the server clear is scoped to the user's Connect rows anyway.
  useEffect(() => {
    void markAllSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on entry
  }, []);

  // The server-fed first page carries BOTH products; keep only Connect so the
  // pre-hydration paint matches the shell-scoped live list.
  const initialConnect = useMemo(
    () => initial.filter((n) => effectiveProduct(n) === 'connect'),
    [initial],
  );
  const live: NotificationItem[] = notifications.length > 0 ? notifications : initialConnect;

  // Live window + any older pages, deduped by id, newest-first.
  const items = useMemo(() => {
    const seen = new Set<string>();
    const merged: NotificationItem[] = [];
    for (const n of [...live, ...older]) {
      if (seen.has(n._id) || removedIds.has(n._id)) continue;
      seen.add(n._id);
      merged.push(n);
    }
    return merged;
  }, [live, older, removedIds]);

  // Resolve actor identity (avatar + name) for rows that have an actor, one batch.
  useEffect(() => {
    const ids = Array.from(
      new Set(
        items
          .flatMap((n) => [n.actorId, ...(n.actorIds ?? [])])
          .filter((id): id is string => Boolean(id) && !actorMap[id!]),
      ),
    );
    if (ids.length === 0) return;
    void getPeople(ids).then((res) => {
      if (!res.ok) return;
      setActorMap((prev) => {
        const next = { ...prev };
        for (const p of res.data) next[p.userId] = p;
        return next;
      });
    });
  }, [items, actorMap]);

  // Tab counts off the full Connect list (status + per-group tallies).
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: items.length,
      unread: 0,
      mentions: 0,
      network: 0,
      feed: 0,
      jobs: 0,
      marketplace: 0,
      messages: 0,
      system: 0,
    };
    for (const n of items) {
      if (!n.isRead) c.unread += 1;
      const g = groupOf(n);
      if (g) c[g] += 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((n) => {
        if (filter === 'all') return true;
        if (filter === 'unread') return !n.isRead;
        if (filter === 'mentions') return false; // placeholder tab, no data
        return groupOf(n) === filter;
      }),
    [items, filter],
  );

  // Topic tabs to show: any present in the list, plus the active one.
  const visibleTopics = useMemo(() => {
    const present = new Set<TopicGroup>();
    for (const n of items) {
      const g = groupOf(n);
      if (g) present.add(g);
    }
    return TOPIC_GROUPS.filter((g) => present.has(g) || filter === g);
  }, [items, filter]);

  const now = Date.now();
  const groups = useMemo(() => {
    const order: Array<'today' | 'week' | 'earlier'> = ['today', 'week', 'earlier'];
    const map = new Map<string, NotificationItem[]>();
    for (const n of filtered) {
      const b = dayBucket(n.createdAt, now);
      const arr = map.get(b) ?? [];
      arr.push(n);
      map.set(b, arr);
    }
    return order.filter((b) => map.has(b)).map((b) => ({ key: b, items: map.get(b) ?? [] }));
  }, [filtered, now]);

  const handleRowClick = useCallback(
    async (item: NotificationItem) => {
      await markRead(item._id);
      const href = rowHref(item);
      if (href) router.push(href);
    },
    [router, markRead],
  );

  const handleMarkAllRead = useCallback(async () => {
    setBusy(true);
    await markAllRead();
    setBusy(false);
  }, [markAllRead]);

  const handleClearAll = useCallback(async () => {
    setClearing(true);
    const ok = await clearAll();
    if (ok) {
      setOlder([]);
      setExhausted(true);
      setRemovedIds(new Set());
    } else {
      message.error(t('actionError'));
    }
    setClearing(false);
  }, [clearAll, message, t]);

  // Delete one row. Hide it from EVERY bucket immediately (removedIds), then
  // persist via the provider. On failure, un-hide + surface the error so a
  // dropped request is visible instead of a silently-returning row.
  const handleDelete = useCallback(
    async (id: string) => {
      setRemovedIds((prev) => new Set(prev).add(id));
      const ok = await deleteOne(id);
      if (!ok) {
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        message.error(t('actionError'));
      }
    },
    [deleteOne, message, t],
  );

  const handleLoadMore = useCallback(async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    // `product: 'connect'` so older pages never surface ERP rows.
    const res = await listMyNotifications({
      before: last.createdAt,
      limit: PAGE_SIZE,
      product: 'connect',
    });
    setLoadingMore(false);
    if (!res.ok) return;
    if (res.data.length < PAGE_SIZE) setExhausted(true);
    setOlder((prev) => [...prev, ...res.data]);
  }, [items]);

  // Soft reload on focus so a backgrounded tab catches up.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  // Tab chip renderer (shared by status + mentions + topic tabs).
  const renderTab = (key: FilterKey, opts?: { disabled?: boolean }) => {
    const active = filter === key;
    const disabled = opts?.disabled;
    return (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={active}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => !disabled && setFilter(key)}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={
          active
            ? { background: 'var(--cr-primary)', borderColor: 'var(--cr-primary)', color: '#fff' }
            : {
                background: 'var(--cr-surface)',
                borderColor: 'var(--cr-border)',
                color: 'var(--cr-text-3)',
              }
        }
      >
        {t(`filters.${key}` as Parameters<typeof t>[0])}
        {!disabled && counts[key] > 0 && (
          <span
            className="rounded-full px-1.5 text-[10.5px] font-bold"
            style={
              active
                ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                : { background: 'var(--cr-surface-2)', color: 'var(--cr-text-4)' }
            }
          >
            {counts[key]}
          </span>
        )}
        {disabled && (
          <span className="text-[9.5px] font-bold tracking-wide uppercase opacity-70">
            {t('soon')}
          </span>
        )}
      </button>
    );
  };

  // `min-h` fills the viewport so the shell footer sits at the bottom on a short
  // list, and gives the right Rail's sticky travel room (see Rail.tsx). `flex-1`
  // main + fixed rail = a balanced two-column shell (no centred-narrow column
  // leaving a dead right gutter). Mirrors JobBoard.
  return (
    <ConnectPage className="flex gap-5 md:min-h-[calc(100dvh-12rem)]">
      <main className="min-w-0 flex-1">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* On-page H1 + subtitle, mirroring the sibling Connect pages
              (JobBoard / RfqBoard / CompanyDirectory) so every surface has a
              proper page-level title (also the page's single <h1> for a11y). */}
          <div>
            <h1 className="m-0 text-[22px] font-bold" style={{ color: 'var(--cr-text)' }}>
              {t('title')}
            </h1>
            <p className="m-0 mt-1 max-w-prose text-[13px] text-muted">{t('subtitle')}</p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              icon={<CheckCheck size={14} aria-hidden />}
              onClick={handleMarkAllRead}
              loading={busy}
              disabled={items.length === 0 || items.every((n) => n.isRead)}
            >
              {t('markAllRead')}
            </DsButton>
            <Popconfirm
              title={t('clearAllConfirm')}
              okText={tCommon('clear')}
              cancelText={tCommon('cancel')}
              okButtonProps={{ danger: true }}
              onConfirm={handleClearAll}
              disabled={items.length === 0}
            >
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                icon={<Trash2 size={14} aria-hidden />}
                loading={clearing}
                disabled={items.length === 0}
              >
                {t('clearAll')}
              </DsButton>
            </Popconfirm>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              icon={<Settings size={14} aria-hidden />}
              onClick={() => setPrefsOpen(true)}
              aria-haspopup="dialog"
              aria-label={t('preferencesAria')}
            >
              {t('preferences')}
            </DsButton>
          </div>
        </header>

        {/* Tabs: status + mentions (disabled) + present topic groups. */}
        <div
          role="tablist"
          aria-label={t('title')}
          className="mb-4 flex items-center gap-2 overflow-x-auto pb-1"
        >
          {STATUS_FILTERS.map((f) => renderTab(f))}
          {renderTab('mentions', { disabled: true })}
          <span
            aria-hidden
            className="mx-0.5 h-4 w-px shrink-0"
            style={{ background: 'var(--cr-border)' }}
          />
          {visibleTopics.map((f) => renderTab(f))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[var(--cr-radius-lg)] border border-border bg-surface p-8">
            <Empty
              image={<Bell size={32} aria-hidden style={{ color: 'var(--cr-text-4)' }} />}
              styles={{ image: { display: 'flex', justifyContent: 'center', height: 'auto' } }}
              description={
                <span className="text-[13px] text-muted">
                  {filter === 'mentions'
                    ? t('mentionsSoon')
                    : filter === 'all'
                      ? t('empty')
                      : t('filterEmpty')}
                </span>
              }
            />
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.key} className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="m-0 text-[11px] font-bold tracking-[0.04em] text-subtle uppercase">
                    {t(`groups.${group.key}` as Parameters<typeof t>[0])}
                  </h2>
                  <span className="text-[11px] font-semibold text-subtle">
                    {group.items.length}
                  </span>
                </div>
                <ul className="m-0 flex flex-col gap-2 p-0" style={{ listStyle: 'none' }}>
                  {group.items.map((n) => (
                    <NotificationRow
                      key={n._id}
                      item={n}
                      actor={n.actorId ? actorMap[n.actorId] : undefined}
                      faces={
                        n.actorIds
                          ? n.actorIds
                              .map((id) => actorMap[id])
                              .filter((p): p is PersonRef => Boolean(p))
                          : undefined
                      }
                      onOpen={handleRowClick}
                      onDelete={handleDelete}
                    />
                  ))}
                </ul>
              </section>
            ))}
            {!exhausted && (
              <div className="mt-1 flex justify-center">
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  onClick={handleLoadMore}
                  loading={loadingMore}
                >
                  {t('loadOlder')}
                </DsButton>
              </div>
            )}
          </>
        )}
      </main>

      {/* Right rail = ads. ConnectRightRail owns the `connect.right.*` AdSlots
          (Google AdSense + house ad engine, see AdSlot.tsx); they fill once a
          publisher id / house creative is configured. The floor RailPanel keeps
          the rail from ever collapsing to a blank column when no ad is live
          (canonical EntityAdRail pattern). */}
      <ConnectRightRail>
        <RailPanel title={t('railTitle')}>
          <p className="m-0 text-[12.5px] leading-relaxed text-muted">{t('railBody')}</p>
        </RailPanel>
      </ConnectRightRail>

      {/* Settings drawer (modules / channels / smart delivery). */}
      <PreferencesDrawer open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </ConnectPage>
  );
}
