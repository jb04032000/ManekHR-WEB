'use client';
/**
 * WorkforceBreakdownCard — team make-up by designation / employment type / shift
 * on the workforce dashboard (app/dashboard/page.tsx). Presentational: reads the
 * `workforce` block from the dashboard stats the page already fetched (no extra
 * request). A Segmented control switches dimension; horizontal bars show the
 * top buckets (backend pre-sorts desc by count).
 *
 * Cross-module: data from statistics.service.getDashboardStats `workforce`. Gated
 * by canSee('team') in page.tsx. Watch: bucket.label === null means "Unassigned".
 */
import { useState } from 'react';
import { Skeleton, Empty, Segmented } from 'antd';
import { useTranslations } from 'next-intl';
import type { WorkforceBreakdown, WorkforceBucket } from '@/types';
import { WidgetCard } from './WidgetCard';

interface Props {
  workforce?: WorkforceBreakdown;
  loading: boolean;
}

type Dimension = 'designation' | 'empType' | 'shift';

const EMP_TYPE_KEYS = ['full_time', 'part_time', 'contract', 'intern', 'consultant'];

export function WorkforceBreakdownCard({ workforce, loading }: Props) {
  const t = useTranslations('dashboard');
  const [dim, setDim] = useState<Dimension>('designation');

  const buckets: WorkforceBucket[] =
    dim === 'designation'
      ? (workforce?.byDesignation ?? [])
      : dim === 'empType'
        ? (workforce?.byEmploymentType ?? [])
        : (workforce?.byShift ?? []);

  const top = buckets.slice(0, 6);
  const max = Math.max(...top.map((b) => b.count), 1);
  const hasData = (workforce?.total ?? 0) > 0;

  const labelOf = (b: WorkforceBucket): string => {
    if (b.label === null) return t('workforce.unassigned');
    if (dim === 'empType' && EMP_TYPE_KEYS.includes(b.label)) {
      return t(`workforce.empType.${b.label}` as 'workforce.empType.full_time');
    }
    return b.label;
  };

  return (
    <WidgetCard
      title={t('workforce.title')}
      iconColor="var(--cr-primary)"
      viewAllHref="/dashboard/team"
      viewAllLabel={t('viewAll')}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : !hasData ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workforce.empty')} />
      ) : (
        <>
          <Segmented<Dimension>
            size="small"
            value={dim}
            onChange={setDim}
            options={[
              { label: t('workforce.byDesignation'), value: 'designation' },
              { label: t('workforce.byType'), value: 'empType' },
              { label: t('workforce.byShift'), value: 'shift' },
            ]}
            className="mb-4"
          />
          {top.length === 0 ? (
            <p className="m-0 text-xs text-faint">{t('workforce.noBreakdown')}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {top.map((b, i) => (
                <div key={`${b.label ?? 'none'}-${i}`} className="flex items-center gap-2.5">
                  <span
                    className="w-24 shrink-0 truncate text-[12px] font-medium text-gray-700"
                    title={labelOf(b)}
                  >
                    {labelOf(b)}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round((b.count / max) * 100)}%`,
                        background: 'var(--cr-primary)',
                      }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-[12px] font-bold text-heading tabular-nums">
                    {b.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}

export default WorkforceBreakdownCard;
