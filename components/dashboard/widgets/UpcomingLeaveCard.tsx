'use client';
/**
 * UpcomingLeaveCard — who is on leave over the next 7 days, on the workforce
 * dashboard (app/dashboard/page.tsx). Self-fetches listUpcomingLeaves for a
 * today..+7d window.
 *
 * Cross-module: attendance.actions.listUpcomingLeaves (BE attendance service).
 * Gated by canSee('attendance') in page.tsx. Watch: firstDate/lastDate are
 * 'YYYY-MM-DD' strings.
 */
import { startTransition, useEffect, useState } from 'react';
import { Skeleton, Empty } from 'antd';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { listUpcomingLeaves } from '@/lib/actions';
import type { UpcomingLeaveEntry } from '@/types';
import { DsAvatar } from '@/components/ui';
import { WidgetCard } from './WidgetCard';

interface Props {
  wsId: string;
}

export function UpcomingLeaveCard({ wsId }: Props) {
  const t = useTranslations('dashboard');
  const [items, setItems] = useState<UpcomingLeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    const from = dayjs().format('YYYY-MM-DD');
    const to = dayjs().add(7, 'day').format('YYYY-MM-DD');
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listUpcomingLeaves(wsId, from, to)
      .then((res) => {
        if (!cancelled) setItems(Array.isArray(res) ? res : []);
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

  const dateText = (e: UpcomingLeaveEntry) => {
    const f = dayjs(e.firstDate).format('D MMM');
    if (e.firstDate === e.lastDate) return f;
    return `${f} – ${dayjs(e.lastDate).format('D MMM')}`;
  };

  return (
    <WidgetCard
      title={t('upcomingLeave.title')}
      iconColor="var(--cr-info-500)"
      viewAllHref="/dashboard/attendance"
      viewAllLabel={t('viewAll')}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : error ? (
        <p className="m-0 text-xs" style={{ color: 'var(--cr-danger-700)' }}>
          {t('loadError')}
        </p>
      ) : items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('upcomingLeave.empty')} />
      ) : (
        <div className="flex flex-col gap-2">
          {items.slice(0, 6).map((e) => (
            <div key={e.memberId} className="flex items-center gap-2.5 py-1">
              <DsAvatar name={e.memberName} size={32} />
              <div className="flex-1 overflow-hidden">
                <p className="m-0 overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap text-heading">
                  {e.memberName}
                </p>
                <p className="m-0 text-[11px] text-subtle">{dateText(e)}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                style={{ background: 'var(--cr-info-50)', color: 'var(--cr-info-700)' }}
              >
                {t('upcomingLeave.days', { count: e.totalDays })}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export default UpcomingLeaveCard;
