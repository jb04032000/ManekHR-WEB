'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink } from 'lucide-react';
import { DsAvatar } from '@/components/ui';
import DsButton from '@/components/ui/DsButton';

export interface EntityHubStat {
  label: string;
  value: number;
}

type StatusTone = 'success' | 'brand' | 'neutral' | 'warning';

const STATUS_TONE: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)' },
  brand: { bg: 'var(--cr-primary-light)', fg: 'var(--cr-primary)' },
  neutral: { bg: 'var(--cr-surface-3)', fg: 'var(--cr-text-4)' },
  warning: { bg: 'var(--cr-warning-bg)', fg: 'var(--cr-warning)' },
};

export interface EntityHubCardProps {
  name: string;
  logo?: string | null;
  /** Cover image URL. Shown across the cover band when present; falls back to a
   *  soft gradient otherwise. */
  banner?: string | null;
  location?: string;
  /** Trust signal (e.g. the ERP-linked badge row). */
  badge?: ReactNode;
  statusPill?: { label: string; tone: StatusTone };
  stats?: EntityHubStat[];
  /** Public address (the displayed slug path) + its absolute link. */
  publicHref: string;
  publicLabel: string;
  onCopyLink?: () => void;
  copyLinkAria: string;
  primaryHref: string;
  primaryLabel: string;
  /** Optional leading icon for the primary CTA (e.g. a cog for "Manage"). */
  primaryIcon?: ReactNode;
  secondaryHref: string;
  secondaryLabel: string;
  /** Optional leading icon for the secondary action. */
  secondaryIcon?: ReactNode;
  /** Overflow menu (a kebab Dropdown) rendered on the cover band. */
  menu?: ReactNode;
  /** Optional extra control rendered in the cover corner, before the menu (e.g.
   *  the Storefronts hub's primary-star toggle). */
  cornerAction?: ReactNode;
  /** Featured/pinned accent: a quiet primary inset ring + border (e.g. the
   *  owner's primary storefront). Backward-compatible - defaults off. */
  highlighted?: boolean;
}

/**
 * The shared "owned entity" hub card: a soft gradient cover band, an overlapping
 * logo, a status pill + overflow menu, a real stat row, the public-address
 * copy-row, and Manage / View actions. Built generic so the Company Pages hub,
 * Storefronts hub, and Companies directory render the same card rhythm. Every
 * value is passed in by the parent -- no fabricated counts here.
 */
export default function EntityHubCard({
  name,
  logo,
  banner,
  location,
  badge,
  statusPill,
  stats,
  publicHref,
  publicLabel,
  onCopyLink,
  copyLinkAria,
  primaryHref,
  primaryLabel,
  primaryIcon,
  secondaryHref,
  secondaryLabel,
  secondaryIcon,
  menu,
  cornerAction,
  highlighted = false,
}: EntityHubCardProps) {
  const tone = statusPill ? STATUS_TONE[statusPill.tone] : null;

  return (
    <article
      className="flex flex-col overflow-hidden transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(16,24,40,0.08)]"
      style={{
        background: 'var(--cr-surface)',
        // Primary/featured cards carry a quiet inset ring so they read as
        // pinned without shouting over the grid (mirrors the old .cn-store-card--primary).
        border: `1px solid ${highlighted ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
        borderRadius: 'var(--cr-radius-lg)',
        boxShadow: highlighted ? 'inset 0 0 0 1px var(--cr-primary)' : undefined,
      }}
    >
      {/* Cover band: the uploaded banner when present, else a soft gradient.
          Status pill + overflow menu overlay the top-end. */}
      <div
        className="relative h-14 overflow-hidden"
        style={{
          background: banner
            ? 'var(--cr-surface-2)'
            : 'linear-gradient(120deg, var(--cr-indigo-100), var(--cr-accent-light))',
        }}
      >
        {banner && (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded banner; next/image adds no optimisation here
          <img
            src={banner}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute end-2 top-2 flex items-center gap-1.5">
          {statusPill && tone && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {statusPill.label}
            </span>
          )}
          {cornerAction}
          {menu}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pt-0">
        <div className="-mt-6 flex items-end gap-3">
          <span
            className="shrink-0 rounded-[var(--cr-radius-md)]"
            style={{ padding: 3, background: 'var(--cr-surface)' }}
          >
            <DsAvatar name={name} src={logo || undefined} size={48} />
          </span>
        </div>

        <div className="min-w-0">
          <span
            className="block truncate text-[15px] font-semibold"
            style={{ color: 'var(--cr-text)' }}
          >
            {name}
          </span>
          {location && (
            <span
              className="mt-0.5 block truncate text-[12px]"
              style={{ color: 'var(--cr-text-4)' }}
            >
              {location}
            </span>
          )}
        </div>

        {badge}

        {stats && stats.length > 0 && (
          <dl
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col gap-0.5 rounded-[var(--cr-radius-md)] px-2 py-1.5"
                style={{ background: 'var(--cr-surface-2)' }}
              >
                <dd
                  className="m-0 text-[16px] leading-none font-extrabold"
                  style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {s.value}
                </dd>
                <dt className="text-[11px]" style={{ color: 'var(--cr-text-4)' }}>
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        )}

        {/* Public address copy-row. */}
        <div
          className="flex items-center gap-1.5 rounded-[var(--cr-radius-md)] px-2 py-1"
          style={{ background: 'var(--cr-surface-2)' }}
        >
          <ExternalLink size={12} aria-hidden style={{ color: 'var(--cr-text-4)', flex: 'none' }} />
          <Link
            href={publicHref}
            className="min-w-0 flex-1 truncate text-[12px] no-underline"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {publicLabel}
          </Link>
          {onCopyLink && (
            <button
              type="button"
              onClick={onCopyLink}
              aria-label={copyLinkAria}
              className="grid h-6 w-6 shrink-0 place-items-center rounded"
              style={{ color: 'var(--cr-text-4)' }}
            >
              <Copy size={13} aria-hidden />
            </button>
          )}
        </div>

        {/* Footer actions: Manage is the primary CTA (filled, grows to fill the
            row), View public is an outlined secondary so both read as real,
            equal-height buttons with a clear hierarchy. */}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <DsButton
            dsVariant="primary"
            href={primaryHref}
            icon={primaryIcon}
            className="flex-1"
            style={{ minWidth: 120 }}
          >
            {primaryLabel}
          </DsButton>
          <DsButton dsVariant="ghost" href={secondaryHref} icon={secondaryIcon}>
            {secondaryLabel}
          </DsButton>
        </div>
      </div>
    </article>
  );
}
