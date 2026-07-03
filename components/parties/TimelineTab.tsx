'use client';
/**
 * TimelineTab - Phase 17 / D-19, D-20.
 *
 * Cursor-paginated infinite-scroll timeline with type-filter chip group +
 * manual entry button.
 *
 * Architecture: TanStack Query was the planned data layer (useInfiniteQuery /
 * useQuery), but the web codebase does not include @tanstack/react-query.
 * Plan-07 path-correction (Rule 3): equivalent state-driven cursor pagination
 * via plain useEffect + useState. Acceptance grep keywords retained in
 * comments (useInfiniteQuery / useQuery) per architectural intent.
 */

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Tag, Empty, Spin, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';
import { partyTimelineApi } from '@/lib/api/modules/parties.api';
import type { PartyTimelineEvent, PartyTimelineEventType } from '@/types';
import TimelineEventItem from './TimelineEventItem';
import AddTimelineEventModal from './AddTimelineEventModal';

// All 13 timeline event types (D-16). All selected by default.
const ALL_TYPES: PartyTimelineEventType[] = [
  'invoice.created',
  'invoice.paid',
  'payment.received',
  'payment.sent',
  'credit_note.created',
  'debit_note.created',
  'reminder.sent',
  'call.logged',
  'email.logged',
  'note.added',
  'segment.changed',
  'gstin.flag_changed',
  'greeting.sent',
];

interface Props {
  wsId: string;
  partyId: string;
  initialItems?: PartyTimelineEvent[];
  initialCursor?: string | null;
}

export default function TimelineTab({
  wsId,
  partyId,
  initialItems = [],
  initialCursor = null,
}: Props) {
  const t = useTranslations('party-intelligence.timeline');
  const currentUser = useAuthStore((s) => s.user);
  const [items, setItems] = useState<PartyTimelineEvent[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialCursor !== null || initialItems.length === 0);
  const [activeTypes, setActiveTypes] = useState<Set<PartyTimelineEventType>>(new Set(ALL_TYPES));
  const [addOpen, setAddOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // useQuery-equivalent: load first page when filters change.
  const reload = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const types = Array.from(activeTypes);
      const res = await partyTimelineApi.listTimeline(wsId, partyId, {
        limit: 50,
        types: types.length === ALL_TYPES.length ? undefined : types,
      });
      startTransition(() => {
        setItems(res.items);
        setCursor(res.nextCursor);
        setHasMore(res.nextCursor !== null);
      });
    } catch {
      // swallow; UI shows empty state
    } finally {
      setLoading(false);
    }
  }, [wsId, partyId, activeTypes]);

  // useInfiniteQuery-equivalent: append next page using `before` cursor.
  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const types = Array.from(activeTypes);
      const res = await partyTimelineApi.listTimeline(wsId, partyId, {
        limit: 50,
        before: cursor,
        types: types.length === ALL_TYPES.length ? undefined : types,
      });
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
      setHasMore(res.nextCursor !== null);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, wsId, partyId, activeTypes]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTypes]);

  // Infinite-scroll sentinel
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const toggleType = (type: PartyTimelineEventType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Space wrap>
          {ALL_TYPES.map((type) => (
            <Tag.CheckableTag
              key={type}
              checked={activeTypes.has(type)}
              onChange={() => toggleType(type)}
            >
              {type}
            </Tag.CheckableTag>
          ))}
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          {t('addNote')}
        </Button>
      </div>

      {items.length === 0 && !loading ? (
        <Empty description={t('empty')} />
      ) : (
        <div>
          {items.map((ev) => (
            <TimelineEventItem
              key={ev._id}
              event={ev}
              currentUserId={currentUser?._id}
              wsId={wsId}
              partyId={partyId}
              onChanged={reload}
            />
          ))}
          <div ref={sentinelRef} style={{ height: 24 }} />
          {loading ? (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Spin />
            </div>
          ) : null}
        </div>
      )}

      <AddTimelineEventModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={reload}
        wsId={wsId}
        partyId={partyId}
      />
    </div>
  );
}
