import type { ReactNode } from 'react';

/**
 * Stylized product-UI mockups for the marketing pages. Frames are built from the
 * brand tokens with deliberately generic content — never fake real-looking
 * people, never fabricated engagement metrics (views, sales).
 *
 * All mockups are decorative (aria-hidden). Cross-module links: colours come
 * from the locked --cr-* tokens.
 */

/** Browser/app chrome frame so the mock reads as a real product surface. */
export function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[20px] border border-[var(--cr-neutral-200)] bg-white shadow-[0_30px_60px_-30px_rgba(14,24,68,0.35)]"
    >
      <div className="flex items-center gap-2 border-b border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--cr-neutral-300)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--cr-neutral-300)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--cr-neutral-300)]" />
        <span className="mkt-mono ml-2 truncate text-[0.66rem] tracking-[0.04em] text-[var(--cr-neutral-500)]">
          {label}
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/** ERP companion mock — a compact staff+salary dashboard glimpse (secondary). */
export function ErpMock() {
  return (
    <Frame label="manekhr.in / erp">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-[11px] border border-[var(--cr-neutral-200)] p-2.5">
          <p className="mkt-mono text-[0.56rem] tracking-[0.06em] text-[var(--cr-neutral-500)] uppercase">
            Present
          </p>
          <p className="pt-1 text-[1.1rem] font-bold text-[var(--cr-charcoal)]">
            28<span className="text-[0.7rem] font-medium text-[var(--cr-neutral-500)]">/32</span>
          </p>
        </div>
        <div className="rounded-[11px] border border-[var(--cr-neutral-200)] p-2.5">
          <p className="mkt-mono text-[0.56rem] tracking-[0.06em] text-[var(--cr-neutral-500)] uppercase">
            Output
          </p>
          <span className="mt-2 flex items-end gap-0.5">
            {[9, 13, 8, 15, 11, 16].map((h, index) => (
              <span
                key={index}
                className="w-1.5 rounded-sm bg-[var(--cr-indigo-400)]"
                style={{ height: `${h}px` }}
              />
            ))}
          </span>
        </div>
        <div className="rounded-[11px] border border-[var(--cr-neutral-200)] p-2.5">
          <p className="mkt-mono text-[0.56rem] tracking-[0.06em] text-[var(--cr-neutral-500)] uppercase">
            Staff
          </p>
          <p className="pt-1 text-[1.1rem] font-bold text-[var(--cr-charcoal)]">32</p>
        </div>
      </div>
      <div className="mt-2.5 space-y-1.5">
        {[
          {
            label: 'Payroll · this cycle',
            tone: 'var(--cr-indigo-50)',
            text: 'var(--cr-indigo-700)',
            value: 'Ready',
          },
          {
            label: 'Role access · this month',
            tone: 'var(--cr-gold-100)',
            text: 'var(--cr-gold-700)',
            value: 'Reviewed',
          },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-[10px] border border-[var(--cr-neutral-200)] px-3 py-1.5"
          >
            <span className="text-[0.68rem] text-[var(--cr-neutral-600)]">{row.label}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold"
              style={{ background: row.tone, color: row.text }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
