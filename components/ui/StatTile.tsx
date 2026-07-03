/**
 * StatTile - canonical KPI tile for admin/dashboard pages.
 *
 * Lifted from `app/dashboard/team/page.tsx` (Team v2, 2026-05-06) when
 * admin localization adopted the same pattern (second adopter).
 *
 * Design contract:
 * - 24px tabular-nums value, 12px label + hint, no card-within-card.
 * - `valueSuffix` renders a subtle smaller decimal/unit next to the big
 *   value (e.g. `93` + `.4%`) - keeps the dominant glyph clean.
 * - `emphasis` paints a 3px gold inset rail on the left edge - reserve for
 *   the single most-important tile per page (canonical premium moment).
 * - `tone="danger"` paints the value red ONLY when the count is non-zero
 *   (active alert), pairing visually with a top-of-page critical banner.
 * - `trend` accepts a tiny chip for delta hints; `tone` picks the palette
 *   (`positive` green / `negative` red / `neutral` gray).
 * - `chart` renders a thin inline visualization between value-row and
 *   footer. 4 variants - `area` (smooth line + gradient), `bars`
 *   (uniform-color bars), `line` (no-fill polyline), `spikes` (per-bucket
 *   status-colored bars on a neutral track). All RSC-friendly inline SVG.
 * - `sparkline` is the legacy prop (alias for `chart: { type: 'area' }`).
 * - `footerLeft` / `footerRight` split the bottom row (`vs target 95%` on
 *   the left, `7-day trend` on the right).
 * - `onClick` makes the tile a clickable button (e.g. click-to-filter on
 *   attendance daily). When set, renders as <button> for keyboard a11y +
 *   shows hover/selected affordance via `selected` flag.
 */
import type { ReactNode } from 'react';

export type StatTileChart =
  | { type: 'area'; data: number[]; color?: string }
  | { type: 'line'; data: number[]; color?: string }
  | { type: 'bars'; data: number[]; color?: string }
  | { type: 'spikes'; data: { value: number; color?: string }[]; trackColor?: string };

export type TrendTone = 'positive' | 'negative' | 'neutral';

export function StatTile({
  label,
  value,
  valueSuffix,
  info,
  hint,
  emphasis = false,
  tone = 'neutral',
  trend,
  sparkline,
  chart,
  footerLeft,
  footerRight,
  onClick,
  selected = false,
  ariaLabel,
}: {
  label: string;
  value: string;
  valueSuffix?: string;
  /** Optional info affordance (e.g. an <InfoTooltip/>) rendered beside the
   *  label. Passed as a node so StatTile itself stays dependency-free /
   *  RSC-friendly - the caller owns the tooltip implementation. */
  info?: ReactNode;
  hint?: string;
  emphasis?: boolean;
  tone?: 'neutral' | 'danger';
  trend?: { value: string; tone?: TrendTone; positive?: boolean };
  sparkline?: { data: number[]; color?: string };
  chart?: StatTileChart;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  ariaLabel?: string;
}) {
  const isZero = value === '0';
  const valueColor =
    tone === 'danger' && !isZero
      ? 'var(--cr-error,var(--cr-danger-700))'
      : isZero
        ? 'var(--cr-text-4)'
        : 'var(--cr-text,var(--cr-text-1))';

  // Trend chip tone resolution (back-compat: positive bool → positive/negative)
  const trendTone: TrendTone =
    trend?.tone ??
    (trend?.positive === true ? 'positive' : trend?.positive === false ? 'negative' : 'neutral');
  const chipPalette: Record<TrendTone, { bg: string; fg: string }> = {
    positive: { bg: 'var(--cr-success-50)', fg: 'var(--cr-success-700)' },
    negative: {
      bg: 'var(--cr-error-50,var(--cr-danger-50))',
      fg: 'var(--cr-error-700,var(--cr-danger-700))',
    },
    neutral: { bg: 'var(--cr-surface-2,var(--cr-bg))', fg: 'var(--cr-text-3)' },
  };

  // Legacy `sparkline` → chart area
  const resolvedChart: StatTileChart | undefined =
    chart ?? (sparkline && sparkline.data.length > 1 ? { type: 'area', ...sparkline } : undefined);

  const hasFooter = footerLeft != null || footerRight != null;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 inline-flex items-center gap-1 text-[11px] leading-none font-semibold tracking-[0.06em] text-muted uppercase">
          {label}
          {info}
        </p>
        {trend && (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] leading-none font-semibold tabular-nums"
            style={{ background: chipPalette[trendTone].bg, color: chipPalette[trendTone].fg }}
          >
            {trend.value}
          </span>
        )}
      </div>
      <p className="m-0 mt-3 font-body leading-none tabular-nums" style={{ color: valueColor }}>
        <span className="text-[32px] font-bold tracking-tight">{value}</span>
        {valueSuffix && (
          <span
            className="ml-0.5 text-[14px] font-medium tracking-tight"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {valueSuffix}
          </span>
        )}
      </p>
      {hint && <p className="m-0 mt-1.5 text-[12px] leading-[1.35] text-subtle">{hint}</p>}
      {resolvedChart && <StatTileChartRender chart={resolvedChart} />}
      {hasFooter && (
        <div className="mt-3 flex items-end justify-between gap-2 text-[11px] leading-tight">
          <span style={{ color: 'var(--cr-text-3)' }} className="min-w-0 truncate">
            {footerLeft}
          </span>
          {footerRight != null && (
            <span style={{ color: 'var(--cr-text-4)' }} className="shrink-0">
              {footerRight}
            </span>
          )}
        </div>
      )}
    </>
  );

  const sharedClass =
    'relative w-full rounded-xl border bg-surface px-4 py-4 text-left transition-colors';
  const sharedStyle = {
    borderColor: selected
      ? 'var(--cr-primary, var(--cr-text-1))'
      : 'var(--cr-border-subtle, rgba(0,0,0,0.06))',
    boxShadow: emphasis ? 'inset 3px 0 0 0 var(--cr-gold-500)' : undefined,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        aria-label={ariaLabel}
        className={`${sharedClass} cursor-pointer hover:bg-[var(--cr-surface-2,var(--cr-bg))] focus-visible:ring-2 focus-visible:ring-[var(--cr-primary,var(--cr-text-1))]/30 focus-visible:outline-none`}
        style={sharedStyle}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={sharedClass} style={sharedStyle}>
      {inner}
    </div>
  );
}

// ── Inline SVG chart renderer ─────────────────────────────────────────────
// All variants are pure SVG - no chart lib import, keeps StatTile RSC-friendly.
function StatTileChartRender({ chart }: { chart: StatTileChart }) {
  if (chart.type === 'spikes') return <SpikeChart {...chart} />;
  if (chart.type === 'bars') return <BarChart {...chart} />;
  if (chart.type === 'line')
    return <LineChart data={chart.data} color={chart.color} fill={false} />;
  return <LineChart data={chart.data} color={chart.color} fill />; // area
}

function LineChart({ data, color, fill }: { data: number[]; color?: string; fill: boolean }) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data
    .map(
      (v, i) => `${(i * stepX).toFixed(2)},${(h - ((v - min) / range) * h * 0.85 - 2).toFixed(2)}`,
    )
    .join(' ');
  const areaPath = `M0,${h} L${points.split(' ').join(' L')} L${w},${h} Z`;
  const stroke = color ?? 'var(--cr-text-3)';
  return (
    <svg
      className="mt-3 block w-full"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fill && <path d={areaPath} fill={stroke} fillOpacity={0.12} />}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function BarChart({ data, color }: { data: number[]; color?: string }) {
  if (data.length === 0) return null;
  const w = 100;
  const h = 32;
  const max = Math.max(...data, 1);
  const gap = 1.2;
  const barW = (w - gap * (data.length - 1)) / data.length;
  const fill = color ?? 'var(--cr-primary-500,var(--cr-text-3))';
  return (
    <svg
      className="mt-3 block w-full"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * (h - 2));
        const x = i * (barW + gap);
        const y = h - barH;
        // Last bar gets darker accent - matches ref (current period highlight)
        const isLast = i === data.length - 1;
        return (
          <rect
            key={i}
            x={x.toFixed(2)}
            y={y.toFixed(2)}
            width={barW.toFixed(2)}
            height={barH.toFixed(2)}
            rx="1.2"
            fill={fill}
            fillOpacity={v === 0 ? 0.18 : isLast ? 1 : 0.55}
          />
        );
      })}
    </svg>
  );
}

function SpikeChart({
  data,
  trackColor,
}: {
  data: { value: number; color?: string }[];
  trackColor?: string;
}) {
  if (data.length === 0) return null;
  const w = 100;
  const h = 32;
  const max = Math.max(...data.map((d) => d.value), 1);
  const gap = 1.2;
  const barW = (w - gap * (data.length - 1)) / data.length;
  const baseline = trackColor ?? 'var(--cr-border-light,var(--cr-neutral-200))';
  const trackY = h * 0.55;
  const trackH = 2.5;
  return (
    <svg
      className="mt-3 block w-full"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {data.map((d, i) => {
        const x = i * (barW + gap);
        if (d.value === 0) {
          return (
            <rect
              key={i}
              x={x.toFixed(2)}
              y={trackY.toFixed(2)}
              width={barW.toFixed(2)}
              height={trackH.toFixed(2)}
              rx="1"
              fill={baseline}
            />
          );
        }
        // Spike grows up from baseline center
        const spikeH = Math.max(6, (d.value / max) * (h - 4));
        const y = (h - spikeH) / 2;
        return (
          <rect
            key={i}
            x={x.toFixed(2)}
            y={y.toFixed(2)}
            width={barW.toFixed(2)}
            height={spikeH.toFixed(2)}
            rx="1.2"
            fill={d.color ?? 'var(--cr-text-3)'}
          />
        );
      })}
    </svg>
  );
}
