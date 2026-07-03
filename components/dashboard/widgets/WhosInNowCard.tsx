'use client';
/**
 * WhosInNowCard — live "who's in right now" snapshot on the workforce dashboard
 * (app/dashboard/page.tsx). Self-fetches the live-presence board and shows the
 * working / done / not-punched / on-leave counts plus a headline of who's active.
 *
 * Cross-module: attendanceApi.livePresence (BE attendance service live board).
 * Gated by canSee('attendance') in page.tsx. Watch: this is a point-in-time read
 * (no socket) — refreshed when the dashboard reloads.
 */
import { startTransition, useEffect, useState } from 'react';
import { Skeleton, Empty } from 'antd';
import { useTranslations } from 'next-intl';
import { attendanceApi } from '@/lib/api';
import type { LivePresence } from '@/types';
import { WidgetCard } from './WidgetCard';

interface Props {
  wsId: string;
}

export function WhosInNowCard({ wsId }: Props) {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<LivePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    attendanceApi
      .livePresence(wsId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  const c = data?.counts;
  const tiles = c
    ? [
        {
          label: t('whosIn.working'),
          value: c.working,
          color: 'var(--cr-success-700)',
          bg: 'var(--cr-success-50)',
        },
        {
          label: t('whosIn.done'),
          value: c.done,
          color: 'var(--cr-info-700)',
          bg: 'var(--cr-info-50)',
        },
        {
          label: t('whosIn.notPunched'),
          value: c.not_punched,
          color: 'var(--cr-warning-700)',
          bg: 'var(--cr-warning-50)',
        },
        {
          label: t('whosIn.onLeave'),
          value: c.on_leave,
          color: 'var(--cr-gold-700)',
          bg: 'var(--cr-gold-100)',
        },
      ]
    : [];

  return (
    <WidgetCard
      title={t('whosIn.title')}
      iconColor="var(--cr-success-500)"
      viewAllHref="/dashboard/attendance"
      viewAllLabel={t('viewAll')}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : error ? (
        <p className="m-0 text-xs" style={{ color: 'var(--cr-danger-700)' }}>
          {t('loadError')}
        </p>
      ) : !c || c.total === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('whosIn.empty')} />
      ) : (
        <>
          <div className="mb-4">
            <p className="m-0 text-3xl font-extrabold text-heading tabular-nums">{c.working}</p>
            <p className="m-0 text-[12px] text-subtle">
              {t('whosIn.workingNowOf', { total: c.total })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className="rounded-xl px-3 py-2.5"
                style={{ background: tile.bg }}
              >
                <p className="m-0 text-xl font-bold tabular-nums" style={{ color: tile.color }}>
                  {tile.value}
                </p>
                <p className="m-0 text-[11px] font-medium" style={{ color: tile.color }}>
                  {tile.label}
                </p>
              </div>
            ))}
          </div>
          {c.late > 0 && (
            <p className="m-0 mt-3 text-[11px]" style={{ color: 'var(--cr-warning-700)' }}>
              {t('whosIn.lateNote', { count: c.late })}
            </p>
          )}
        </>
      )}
    </WidgetCard>
  );
}

export default WhosInNowCard;
