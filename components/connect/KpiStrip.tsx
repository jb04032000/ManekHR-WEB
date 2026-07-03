/**
 * KpiStrip / KpiCard - the shared Connect KPI header used atop the Jobs, RFQ,
 * and Company Pages hubs. `KpiStrip` is the responsive 2-up / 4-up grid; each
 * `KpiCard` is a tinted icon tile, a big tabular-nums number, and a label.
 *
 * Extracted verbatim from the three hubs (JobBoard / RfqBoard / CompanyPagesHub)
 * per the POLISH-RULES DRY rule. Pass `className` for the strip's outer spacing
 * (e.g. `mb-4`). Callers supply real counts, never fabricated signals.
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

const KPI_TONE: Record<string, { bg: string; fg: string }> = {
  indigo: { bg: 'var(--cr-primary-light)', fg: 'var(--cr-primary)' },
  amber: { bg: 'var(--cr-warning-bg)', fg: 'var(--cr-warning)' },
  gold: { bg: 'var(--cr-accent-light)', fg: 'var(--cr-gold-700)' },
  green: { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)' },
};

export function KpiStrip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}

export function KpiCard({
  icon: Icon,
  tone,
  value,
  displayValue,
  label,
  hint,
}: {
  icon: LucideIcon;
  tone: keyof typeof KPI_TONE;
  /** The raw numeric signal (always real). Used as the rendered figure unless
   *  `displayValue` overrides it for formatting (compact reach, rupee spend). */
  value: number;
  /** Optional pre-formatted string to render in place of `value` (e.g. a
   *  rupee amount or a compact `14.2K`). Still a real number underneath. */
  displayValue?: string;
  label: string;
  /** Optional one-line sub-signal under the label (e.g. "6 match what you
   *  supply" on the RFQ hub). Additive: existing callers are unaffected. */
  hint?: string;
}) {
  const c = KPI_TONE[tone];
  return (
    <div
      className="flex flex-col gap-0.5 p-3.5"
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid h-6 w-6 place-items-center"
          style={{ borderRadius: 'var(--cr-radius-md)', background: c.bg, color: c.fg }}
        >
          <Icon size={15} aria-hidden />
        </span>
        <b
          className="text-[24px] leading-none font-extrabold"
          style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
        >
          {displayValue ?? value}
        </b>
      </div>
      <span className="text-[11.5px] font-semibold" style={{ color: 'var(--cr-text-4)' }}>
        {label}
      </span>
      {hint && (
        <span className="text-[11px]" style={{ color: 'var(--cr-text-5)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}
