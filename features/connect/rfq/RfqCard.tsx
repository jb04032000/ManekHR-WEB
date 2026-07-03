'use client';

/**
 * A single request on the RFQ board / a buyer's list. Rebuilt 2026-06-10 to the
 * Jobs-card bar. Every signal is a REAL field: category, quantity, budget (or
 * "Negotiable" when the buyer set none), location, buyer identity (resolved by
 * useBoardBuyers), posted-when, needed-by, quotes received + the denormalized
 * lowest live quote ("low ₹X"). "Matches your work" = the rfq category is in
 * the viewer's active listing categories (BoardStats.supplyCategories).
 *
 * Cross-module links:
 * - useBoardBuyers builds the `buyer` ref via network getPeople (persons carry
 *   NO verification badge - identity-model invariant).
 * - RfqBoard passes viewerId + supplyCategories + quotedRfqIds per card.
 *
 * INTERACTION & CURSOR CONTRACT (same as JobCard - the owner has been burned):
 * - The root is a relative <div>, NOT an <a>. The ONLY full-card link is the
 *   title <Link> whose ::after overlay stretches over the card. The Send-quote
 *   control sits ABOVE it via `relative z-[2]` and clicks independently.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  type LucideIcon,
  Brush,
  CalendarClock,
  ClipboardList,
  Clock,
  Cog,
  Droplets,
  Layers,
  MapPin,
  Package,
  Printer,
  Scissors,
  Send,
  Shirt,
  Zap,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { categoryLabel } from '../search.types';
// Per-item "Sample" disclosure pill on seeded demo requests (rfq.isDemo). One
// source of truth with the rfq/search demo down-rank (backend demo-rank.ts).
import SampleBadge from '@/components/connect/SampleBadge';
import type { Rfq } from './rfq.types';
import type { RfqBuyerRef } from './useBoardBuyers';

dayjs.extend(relativeTime);

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

const CLOSING_SOON_DAYS = 3;

/** Category -> icon tile (gold for hand-work trades, indigo for the rest). */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  'embroidery-zari': Brush,
  weaving: Layers,
  dyeing: Droplets,
  printing: Printer,
  'job-work': Scissors,
  'raw-material': Package,
  machinery: Cog,
  'finished-goods': Shirt,
};
const GOLD_CATEGORIES = ['embroidery-zari', 'job-work'];

export default function RfqCard({
  rfq,
  buyer,
  viewerId,
  supplyCategories,
  alreadyQuoted = false,
  showOwnerStats = false,
  originHref,
}: {
  rfq: Rfq;
  /** Resolved buyer identity (useBoardBuyers). Undefined = batch in flight ->
   *  render no buyer row rather than a flash. */
  buyer?: RfqBuyerRef;
  /** The viewer's own user id; on their own request the card swaps Send quote
   *  for a View-quotes action (you do not quote your own request). */
  viewerId?: string;
  /** The viewer's active listing categories (BoardStats.supplyCategories) --
   *  drives the "Matches your work" ribbon + the filled Send-quote style. */
  supplyCategories?: string[];
  /** The viewer already has a live quote on this request. */
  alreadyQuoted?: boolean;
  /** My-requests tab: owner framing (quotes received is the primary signal). */
  showOwnerStats?: boolean;
  /** The board URL this card was opened from (tab + filters). Carried to the
   *  detail page as `?from=` so "Back to board" returns to the exact origin
   *  tab/filters instead of a fixed tab. See RfqBoard (passes it) +
   *  RfqDetailScreen.goBack (consumes it). */
  originHref?: string;
}) {
  const t = useTranslations('connect.rfq');
  const tCat = useTranslations('connect.search.listing.category');

  // The detail link, with the origin board URL appended so Back can restore it.
  const detailHref = originHref
    ? `/connect/rfq/${rfq._id}?from=${encodeURIComponent(originHref)}`
    : `/connect/rfq/${rfq._id}`;

  const isOwn = (!!viewerId && rfq.buyerUserId === viewerId) || showOwnerStats;
  const isMatched = !isOwn && !!supplyCategories?.includes(rfq.category);

  const budget =
    rfq.budgetMin != null && rfq.budgetMax != null
      ? `${rupees(rfq.budgetMin)} - ${rupees(rfq.budgetMax)}`
      : rfq.budgetMin != null
        ? rupees(rfq.budgetMin)
        : rfq.budgetMax != null
          ? rupees(rfq.budgetMax)
          : null;
  const location = [rfq.location?.district, rfq.location?.state].filter(Boolean).join(', ');

  const daysLeft =
    rfq.status === 'open' && rfq.neededBy
      ? dayjs(rfq.neededBy).startOf('day').diff(dayjs().startOf('day'), 'day')
      : null;
  const closingSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= CLOSING_SOON_DAYS;
  const closesLabel =
    daysLeft == null || daysLeft < 0
      ? null
      : daysLeft === 0
        ? t('closesToday')
        : daysLeft === 1
          ? t('closesTomorrow')
          : t('closesInDays', { count: daysLeft });

  const statusTone = closingSoon
    ? { bg: 'var(--cr-warning-bg)', fg: 'var(--cr-warning)', label: t('closingSoon') }
    : rfq.status === 'open'
      ? { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)', label: t('status.open') }
      : rfq.status === 'awarded'
        ? { bg: 'var(--cr-primary-light)', fg: 'var(--cr-primary)', label: t('status.awarded') }
        : { bg: 'var(--cr-surface-3)', fg: 'var(--cr-text-4)', label: t('status.closed') };

  const Icon: LucideIcon = CATEGORY_ICON[rfq.category] ?? ClipboardList;
  const goldTile = GOLD_CATEGORIES.includes(rfq.category);
  const buyerInitial = buyer?.name?.trim()?.charAt(0)?.toUpperCase() || '?';
  const canQuote = !isOwn && rfq.status === 'open';

  return (
    <div
      className="relative transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(16,24,40,0.08)]"
      style={{
        background: 'var(--cr-surface)',
        border: `1px solid ${isMatched ? 'var(--cr-primary-border)' : 'var(--cr-border)'}`,
        borderRadius: 'var(--cr-radius-lg)',
        padding: 14,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center"
          style={{
            borderRadius: 'var(--cr-radius-md)',
            background: goldTile ? 'var(--cr-accent-light)' : 'var(--cr-primary-light)',
            color: goldTile ? 'var(--cr-gold-700)' : 'var(--cr-primary)',
          }}
        >
          <Icon size={22} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            {/* The ONLY full-card link: title with a stretched ::after overlay. */}
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Link
                href={detailHref}
                aria-label={t('cardAria', {
                  title: rfq.title,
                  status: t(`status.${rfq.status}`),
                  count: rfq.quotesCount,
                })}
                className="min-w-0 text-[15px] leading-snug font-semibold no-underline after:absolute after:inset-0 after:content-[''] hover:underline"
                style={{ color: 'var(--cr-text)' }}
              >
                {rfq.title}
              </Link>
              {isMatched && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
                >
                  <Zap size={11} aria-hidden /> {t('matchesWork')}
                </span>
              )}
            </span>

            {/* Top-right: status pill + the quotes-so-far signal. */}
            <div className="flex shrink-0 flex-col items-end gap-1">
              {/* Sample disclosure for a seeded demo request. relative z-[2] keeps
                  it above the stretched title-link overlay. */}
              {rfq.isDemo && (
                <span className="relative z-[2] inline-flex">
                  <SampleBadge size="sm" />
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
                style={{ background: statusTone.bg, color: statusTone.fg }}
              >
                {statusTone.label}
              </span>
            </div>
          </div>

          {/* Category line (small-caps trade label, the mock's EMBROIDERY & ZARI). */}
          <div
            className="mt-1 text-[11px] font-bold tracking-wide uppercase"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {/* categoryLabel humanizes a custom category that has no i18n key. */}
            {categoryLabel(rfq.category, tCat)}
          </div>

          {/* Meta row: quantity, budget (or Negotiable), location. */}
          <div
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {rfq.quantity != null && (
              <span className="font-semibold" style={{ color: 'var(--cr-text-2)' }}>
                {rfq.quantity}
                {/* Localized bare unit noun (connect.rfq.unit.<slug>). */}
                {rfq.unit ? ` ${t(`unit.${rfq.unit}`)}` : ''}
              </span>
            )}
            <span
              className="font-bold"
              style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
            >
              {budget ?? t('negotiable')}
            </span>
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden /> {location}
              </span>
            )}
          </div>

          {/* Footer: buyer + posted + closes (left), quotes + low + action (right). */}
          <div
            className="mt-2.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t pt-2"
            style={{ borderColor: 'var(--cr-divider)' }}
          >
            <div
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]"
              style={{ color: 'var(--cr-text-4)' }}
            >
              {buyer && (
                <span className="inline-flex items-center gap-1.5">
                  {buyer.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small avatar, remote URL
                    <img
                      src={buyer.avatar}
                      alt=""
                      aria-hidden
                      className="h-4 w-4 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold"
                      style={{ background: 'var(--cr-surface-3)', color: 'var(--cr-text-4)' }}
                    >
                      {buyerInitial}
                    </span>
                  )}
                  <span className="truncate font-semibold" style={{ color: 'var(--cr-text-3)' }}>
                    {buyer.name}
                  </span>
                </span>
              )}
              {rfq.createdAt && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} aria-hidden />{' '}
                  {t('postedAgo', { when: dayjs(rfq.createdAt).fromNow() })}
                </span>
              )}
              {closesLabel && (
                <span
                  className="inline-flex items-center gap-1"
                  style={closingSoon ? { color: 'var(--cr-warning)', fontWeight: 600 } : undefined}
                >
                  <CalendarClock size={12} aria-hidden /> {closesLabel}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="text-right text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
                <span
                  className="block text-[13px] font-bold"
                  style={{ color: 'var(--cr-primary)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {t('quotesCount', { count: rfq.quotesCount })}
                </span>
                {rfq.lowestQuotePrice != null && (
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {t('lowestQuote', { price: rupees(rfq.lowestQuotePrice) })}
                  </span>
                )}
              </span>

              {/* Action above the stretched link (relative z-[2]). Send quote is
                  filled when the request matches the viewer's work (the mock's
                  gold CTA), outline otherwise; own requests get View quotes. */}
              {isOwn ? (
                <Link
                  href={detailHref}
                  className="relative z-[2] inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                  style={{
                    borderColor: 'var(--cr-border)',
                    background: 'var(--cr-surface)',
                    color: 'var(--cr-text-2)',
                    outlineColor: 'var(--cr-primary)',
                  }}
                >
                  {t('viewQuotes')}
                </Link>
              ) : canQuote ? (
                <Link
                  href={detailHref}
                  className="relative z-[2] inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                  style={
                    alreadyQuoted
                      ? {
                          border: '1px solid var(--cr-border)',
                          background: 'var(--cr-surface)',
                          color: 'var(--cr-text-2)',
                          outlineColor: 'var(--cr-primary)',
                        }
                      : isMatched
                        ? {
                            // Gold = the brand accent ("premium moment"): the
                            // mock's filled CTA on requests that match your work.
                            background: 'var(--cr-accent)',
                            color: '#fff',
                            outlineColor: 'var(--cr-primary)',
                          }
                        : {
                            border: '1px solid var(--cr-primary)',
                            background: 'var(--cr-surface)',
                            color: 'var(--cr-primary)',
                            outlineColor: 'var(--cr-primary)',
                          }
                  }
                >
                  <Send size={13} aria-hidden />
                  {alreadyQuoted ? t('updateQuote') : t('sendQuote')}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
