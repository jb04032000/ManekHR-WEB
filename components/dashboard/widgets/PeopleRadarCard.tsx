'use client';
/**
 * PeopleRadarCard — new joiners this month + upcoming birthdays & work
 * anniversaries (next 30 days) on the workforce dashboard (app/dashboard/page.tsx).
 * Presentational: reads the `peopleRadar` block from the dashboard stats the page
 * already fetched. A Segmented control switches between the three lists.
 *
 * Cross-module: data from statistics.service.getDashboardStats `peopleRadar`.
 * Gated by canSee('team') in page.tsx. Watch: `date` fields are ISO strings — the
 * upcoming occurrence for birthdays/anniversaries, the join date for joiners.
 */
import { useState } from 'react';
import { Skeleton, Empty, Segmented } from 'antd';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { DsAvatar } from '@/components/ui';
import type { PeopleRadar } from '@/types';
import { WidgetCard } from './WidgetCard';

interface Props {
  radar?: PeopleRadar;
  loading: boolean;
}

type Tab = 'joiners' | 'birthdays' | 'anniversaries';

export function PeopleRadarCard({ radar, loading }: Props) {
  const t = useTranslations('dashboard');
  const joiners = radar?.newJoiners ?? [];
  const birthdays = radar?.birthdays ?? [];
  const anniversaries = radar?.anniversaries ?? [];
  const totalCount = joiners.length + birthdays.length + anniversaries.length;

  // Default to the first non-empty list so the card opens on something useful.
  const firstNonEmpty: Tab =
    joiners.length > 0 ? 'joiners' : birthdays.length > 0 ? 'birthdays' : 'anniversaries';
  const [tab, setTab] = useState<Tab>(firstNonEmpty);

  const fmt = (iso: string) => dayjs(iso).format('D MMM');

  const rows: Array<{ key: string; name: string; sub: string }> =
    tab === 'joiners'
      ? joiners.map((j, i) => ({
          key: `j-${i}`,
          name: j.name,
          sub: [j.designation, t('radar.joinedOn', { date: fmt(j.date) })]
            .filter(Boolean)
            .join(' · '),
        }))
      : tab === 'birthdays'
        ? birthdays.map((b, i) => ({
            key: `b-${i}`,
            name: b.name,
            sub: t('radar.birthdayOn', { date: fmt(b.date) }),
          }))
        : anniversaries.map((a, i) => ({
            key: `a-${i}`,
            name: a.name,
            sub: t('radar.anniversaryYears', { years: a.years, date: fmt(a.date) }),
          }));

  return (
    <WidgetCard
      title={t('radar.title')}
      iconColor="var(--cr-gold-500)"
      viewAllHref="/dashboard/team"
      viewAllLabel={t('viewAll')}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : totalCount === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('radar.empty')} />
      ) : (
        <>
          <Segmented<Tab>
            size="small"
            value={tab}
            onChange={setTab}
            options={[
              { label: `${t('radar.joiners')} (${joiners.length})`, value: 'joiners' },
              { label: `${t('radar.birthdays')} (${birthdays.length})`, value: 'birthdays' },
              {
                label: `${t('radar.anniversaries')} (${anniversaries.length})`,
                value: 'anniversaries',
              },
            ]}
            className="mb-4"
          />
          {rows.length === 0 ? (
            <p className="m-0 text-xs text-faint">{t('radar.noneInList')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((r) => (
                <div key={r.key} className="flex items-center gap-2.5 py-1">
                  <DsAvatar name={r.name} size={32} />
                  <div className="flex-1 overflow-hidden">
                    <p className="m-0 overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap text-heading">
                      {r.name}
                    </p>
                    <p className="m-0 text-[11px] text-subtle">{r.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}

export default PeopleRadarCard;
