import type { ReactNode } from 'react';

/**
 * Section kicker - monospace, uppercase, led by a short solid gold
 * rule and an optional ordinal. `tone="dark"` is for the dark indigo
 * bands. Colours are sourced from the locked `--cr-*` brand tokens.
 */
export function Eyebrow({
  children,
  no,
  tone = 'light',
}: {
  children: ReactNode;
  no?: string;
  tone?: 'light' | 'dark';
}) {
  const isDark = tone === 'dark';
  const text = isDark ? 'text-white/70' : 'text-[var(--cr-neutral-500)]';
  const rule = isDark ? 'bg-[var(--cr-gold-400)]' : 'bg-[var(--cr-gold-500)]';
  const ordinal = isDark ? 'text-[var(--cr-gold-400)]' : 'text-[var(--cr-gold-700)]';
  return (
    <span
      className={`mkt-mono inline-flex items-center gap-3 text-[0.72rem] font-semibold tracking-[0.16em] uppercase ${text}`}
    >
      <span className={`h-[2px] w-7 shrink-0 rounded-full ${rule}`} aria-hidden="true" />
      {no ? <span className={ordinal}>{no}</span> : null}
      <span>{children}</span>
    </span>
  );
}
