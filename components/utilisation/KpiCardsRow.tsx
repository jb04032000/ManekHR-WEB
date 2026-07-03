'use client';

/**
 * Phase 25 / Plan 25-12 - KPI cards row.
 *
 * Six fixed cards per D-08, responsive 3/2/1 column grid (xl/md/sm). Cards
 * 1-3 render the multi-metric output sums (split when scope spans multiple
 * primary metrics, single number otherwise - D-08 + A3 split-by-metric).
 * Card 4 shows uptime % with target band colour. Cards 5-6 are mini bar
 * lists of top machines and top downtime reasons.
 *
 * All copy via i18n namespace `dashboard-production-utilisation`. No
 * hard-coded English strings.
 */
import { Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import {
  BarChartOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  WarningOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import DsCard from '@/components/ui/DsCard';
import type { ByMetricSums, KpiResponse, KpiTopMachine, KpiTopReason, UptimeBand } from '@/types';

interface KpiCardsRowProps {
  data: KpiResponse | null;
  loading: boolean;
}

const BAND_COLOR: Record<UptimeBand, string> = {
  green: 'var(--cr-success, var(--cr-success-700))',
  amber: 'var(--cr-warning, var(--cr-warning-700))',
  red: 'var(--cr-error, var(--cr-danger-700))',
};

const BAND_BG: Record<UptimeBand, string> = {
  green: 'rgba(22, 163, 74, 0.08)',
  amber: 'rgba(217, 119, 6, 0.10)',
  red: 'rgba(220, 38, 38, 0.08)',
};

function formatNumber(n: number): string {
  return Number(n).toLocaleString('en-IN');
}

/** Render the KPI sums - single number when only one metric has output,
 *  pipe-joined "120,000 stitches | 480 pieces" otherwise (D-08 / A3). */
function renderSums(sums: ByMetricSums, t: ReturnType<typeof useTranslations>): string {
  const entries = (Object.entries(sums) as Array<[keyof ByMetricSums, number]>).filter(
    ([, v]) => v > 0,
  );

  if (entries.length === 0) return t('kpi.noDataInline');
  if (entries.length === 1) {
    const [metric, value] = entries[0];
    return `${formatNumber(value)} ${t(`metric.${metric}`)}`;
  }
  return entries
    .map(([metric, value]) => `${formatNumber(value)} ${t(`metric.${metric}`)}`)
    .join(' | ');
}

function MiniBarList<T extends { label: string; value: number; sub?: string }>({
  items,
}: {
  items: T[];
}) {
  if (items.length === 0) {
    return <p style={{ color: 'var(--cr-text-3)', fontSize: 12, margin: 0 }}>-</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {items.map((item, idx) => {
        const pct = Math.max(4, Math.round((item.value / max) * 100));
        return (
          <li key={`${item.label}-${idx}`}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
                marginBottom: 4,
                gap: 8,
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color: 'var(--cr-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </span>
              <span style={{ color: 'var(--cr-text-3)', whiteSpace: 'nowrap' }}>
                {item.sub ?? formatNumber(item.value)}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 6,
                background: 'var(--cr-surface-2, var(--cr-border-light))',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: 'var(--cr-primary, var(--cr-info-500))',
                  borderRadius: 4,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CardShell({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <DsCard hover>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--cr-text-3)',
          }}
        >
          {title}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--cr-primary-light, var(--cr-info-50))',
            color: 'var(--cr-primary, var(--cr-info-500))',
          }}
        >
          {icon}
        </span>
      </div>
      {children}
    </DsCard>
  );
}

export function KpiCardsRow({ data, loading }: KpiCardsRowProps) {
  const t = useTranslations('dashboard-production-utilisation');

  const isFiltered = !!(
    data?.filtersEcho.machineIds?.length ||
    data?.filtersEcho.locationIds?.length ||
    data?.filtersEcho.shiftIds?.length
  );
  // WR-04 fix: when the server honours a custom from/to (echoed back via
  // filtersEcho), the three "today/week/month" cards actually all reflect the
  // primary range. Show the range in the suffix so labels stay truthful.
  const echoedRange =
    data?.filtersEcho.from && data?.filtersEcho.to
      ? `${data.filtersEcho.from} → ${data.filtersEcho.to}`
      : '';
  const rangeSuffix = isFiltered
    ? echoedRange
      ? ` (${echoedRange})`
      : t('kpi.selectedRangeSuffix')
    : '';

  const cardWrap = (children: React.ReactNode) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
  );

  if (loading || !data) {
    return cardWrap(
      Array.from({ length: 6 }).map((_, i) => (
        <DsCard key={i}>
          <Skeleton active paragraph={{ rows: 2 }} />
        </DsCard>
      )),
    );
  }

  const uptime = data.uptime;
  const deltaArrow =
    uptime.deltaVsPriorMonthPct > 0 ? (
      <ArrowUpOutlined style={{ fontSize: 10 }} />
    ) : uptime.deltaVsPriorMonthPct < 0 ? (
      <ArrowDownOutlined style={{ fontSize: 10 }} />
    ) : null;
  const deltaText = `${uptime.deltaVsPriorMonthPct >= 0 ? '+' : ''}${uptime.deltaVsPriorMonthPct.toFixed(1)}%`;

  const topMachineItems = data.topMachines.map((m: KpiTopMachine) => ({
    label: m.machineName,
    value: m.output,
    sub: `${formatNumber(m.output)} ${t(`metric.${m.metric}`)}`,
  }));

  const topReasonItems = data.topReasons.map((r: KpiTopReason) => ({
    label: r.reasonLabel,
    value: r.downMinutes,
    sub: `${formatNumber(r.downMinutes)} min`,
  }));

  return cardWrap(
    <>
      <CardShell title={t('kpi.todayOutput') + rangeSuffix} icon={<BarChartOutlined />}>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 22,
            margin: 0,
            color: 'var(--cr-text)',
          }}
        >
          {renderSums(data.todayOutput, t)}
        </p>
      </CardShell>

      <CardShell title={t('kpi.weekOutput') + rangeSuffix} icon={<BarChartOutlined />}>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 22,
            margin: 0,
            color: 'var(--cr-text)',
          }}
        >
          {renderSums(data.weekOutput, t)}
        </p>
      </CardShell>

      <CardShell title={t('kpi.monthOutput') + rangeSuffix} icon={<BarChartOutlined />}>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 22,
            margin: 0,
            color: 'var(--cr-text)',
          }}
        >
          {renderSums(data.monthOutput, t)}
        </p>
      </CardShell>

      <CardShell title={t('kpi.uptimeTitle')} icon={<ThunderboltOutlined />}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 28,
              color: BAND_COLOR[uptime.band],
            }}
          >
            {uptime.actualPct.toFixed(1)}%
          </span>
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 999,
              background: BAND_BG[uptime.band],
              color: BAND_COLOR[uptime.band],
              fontWeight: 700,
            }}
          >
            {t(`band.${uptime.band}`)}
          </span>
        </div>
        <p style={{ fontSize: 11, margin: 0, color: 'var(--cr-text-3)' }}>
          {t('kpi.uptimeTargetLabel', { pct: uptime.targetPct })}
        </p>
        <p
          style={{
            fontSize: 11,
            margin: '4px 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color:
              uptime.deltaVsPriorMonthPct > 0
                ? 'var(--cr-success, var(--cr-success-700))'
                : uptime.deltaVsPriorMonthPct < 0
                  ? 'var(--cr-error, var(--cr-danger-700))'
                  : 'var(--cr-text-3)',
          }}
        >
          {deltaArrow}
          {t('kpi.uptimeDeltaLabel', { delta: deltaText })}
        </p>
      </CardShell>

      <CardShell title={t('kpi.topMachinesTitle')} icon={<TrophyOutlined />}>
        <MiniBarList items={topMachineItems} />
      </CardShell>

      <CardShell title={t('kpi.topReasonsTitle')} icon={<WarningOutlined />}>
        <MiniBarList items={topReasonItems} />
      </CardShell>
    </>,
  );
}

export default KpiCardsRow;
