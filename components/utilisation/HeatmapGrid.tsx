'use client';

/**
 * Phase 25 / Plan 25-12 - Per-location utilisation heatmap.
 *
 * Pure Tailwind CSS grid (no chart library - D-32). Rows = machines, cols =
 * day numbers. Cell colour from `utilisationToClass` 5-band palette per D-12.
 * Click a cell → drill to per-machine trend page with the date pre-selected.
 *
 * IMPORTANT: the five palette classes are dynamic (computed at runtime) so
 * Tailwind's content scanner cannot see them. They are explicitly safelisted
 * in `tailwind.config.js` to survive purge - never remove that safelist.
 */
import Link from 'next/link';
import { Tooltip } from 'antd';
import { useTranslations } from 'next-intl';
import DsCard from '@/components/ui/DsCard';
import type { HeatmapResponse, HeatmapCell } from '@/types';

interface HeatmapGridProps {
  data: HeatmapResponse;
}

/**
 * D-12 5-step utilisation palette - ManekHR warm-gold gradient.
 * Utilisation reads as "intensity" (premium-editorial gold) rather than
 * semantic green/red so it doesn't clash with success/danger usage.
 * Keep in sync with tailwind safelist.
 */
function utilisationToClass(pct: number): string {
  if (pct === 0) return 'bg-neutral-100';
  if (pct <= 40) return 'bg-gold-100';
  if (pct <= 70) return 'bg-gold-400';
  if (pct <= 90) return 'bg-gold-500';
  return 'bg-gold-700';
}

export function HeatmapGrid({ data }: HeatmapGridProps) {
  const t = useTranslations('dashboard-production-utilisation');

  // Index cells by `${machineId}|${date}` for O(1) lookup
  const cellMap = new Map<string, HeatmapCell>();
  for (const c of data.cells) {
    cellMap.set(`${c.machineId}|${c.date}`, c);
  }

  const dayNumbers = data.days.map((d) => Number(d.split('-')[2]));
  // Tailwind needs a literal class to see; build template via grid-template-columns inline
  const gridTemplateColumns = `120px repeat(${data.days.length}, minmax(0, 1fr))`;

  return (
    <DsCard>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns, gap: 2, minWidth: 600 }}>
          {/* Header row */}
          <div />
          {dayNumbers.map((d, i) => (
            <div
              key={`hdr-${i}`}
              style={{
                fontSize: 10,
                color: 'var(--cr-text-3)',
                textAlign: 'center',
                padding: '4px 0',
                fontWeight: 600,
              }}
            >
              {d}
            </div>
          ))}

          {/* Body rows */}
          {data.machines.map((m) => (
            <div key={m.id} style={{ display: 'contents' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--cr-text)',
                  padding: '6px 8px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={m.name}
              >
                {m.name}
              </div>
              {data.days.map((day) => {
                const cell = cellMap.get(`${m.id}|${day}`);
                const pct = cell?.utilisationPct ?? 0;
                const klass = utilisationToClass(pct);
                // CR-02 fix: surface the metric on the tooltip - the cell
                // `output` is now a single-metric sum so users see e.g.
                // "12000 stitches" instead of an ambiguous bare number.
                const outputDisplay =
                  cell && cell.output > 0
                    ? `${cell.output} ${cell.outputMetric ?? ''}`.trim()
                    : '0';
                const tooltip = t('heatmap.cellTooltip', {
                  date: day,
                  pct: pct.toFixed(0),
                  output: outputDisplay,
                  downMin: cell?.downMinutes ?? 0,
                });
                return (
                  <Tooltip key={`${m.id}-${day}`} title={tooltip} placement="top">
                    <Link
                      href={`/dashboard/production-utilisation/${m.id}?date=${day}`}
                      className={`${klass} block cursor-pointer rounded-sm transition-shadow hover:ring-2 hover:ring-blue-400`}
                      style={{ minHeight: 28, height: '100%' }}
                      aria-label={tooltip}
                    />
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cr-text-3)' }}>
          {t('heatmap.legendTitle')}
        </span>
        {(
          [
            { cls: 'bg-neutral-100', key: 'zero' },
            { cls: 'bg-gold-100', key: 'low' },
            { cls: 'bg-gold-400', key: 'mid' },
            { cls: 'bg-gold-500', key: 'high' },
            { cls: 'bg-gold-700', key: 'peak' },
          ] as const
        ).map((b) => (
          <span
            key={b.key}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}
          >
            <span
              className={b.cls}
              style={{ width: 16, height: 16, borderRadius: 3, display: 'inline-block' }}
            />
            <span style={{ color: 'var(--cr-text-3)' }}>{t(`heatmap.legendBands.${b.key}`)}</span>
          </span>
        ))}
      </div>
    </DsCard>
  );
}

export default HeatmapGrid;
