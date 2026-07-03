'use client';

/**
 * MyQuoteCard - one row on the RFQ hub's "My quotes" tab: the request the quote
 * was sent ON (title, category, request status, quotes-so-far + low price) plus
 * the viewer's own offer (price, lead time, quote status). Reads the enriched
 * MyQuoteView the BE listMyQuotes returns (quote + rfq snapshot in one fetch).
 *
 * Cross-module links:
 * - rfq.types.ts MyQuoteView (mirror of BE RfqService.MyQuoteView).
 * - Links to /connect/rfq/[id] where the seller can update / withdraw.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FileText, IndianRupee, Timer } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { categoryLabel } from '../search.types';
// Per-item "Sample" disclosure pill on a seeded demo quote (view.isDemo; MyQuoteView
// extends Quote so the seller's own quote demo flag rides along).
import SampleBadge from '@/components/connect/SampleBadge';
import type { MyQuoteView, QuoteStatus } from './rfq.types';

dayjs.extend(relativeTime);

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

const QUOTE_TONE: Record<QuoteStatus, { bg: string; fg: string }> = {
  sent: { bg: 'var(--cr-primary-light)', fg: 'var(--cr-primary)' },
  shortlisted: { bg: 'var(--cr-accent-light)', fg: 'var(--cr-gold-700)' },
  accepted: { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)' },
  declined: { bg: 'var(--cr-surface-3)', fg: 'var(--cr-text-4)' },
  withdrawn: { bg: 'var(--cr-surface-3)', fg: 'var(--cr-text-4)' },
};

export default function MyQuoteCard({
  view,
  originHref,
}: {
  view: MyQuoteView;
  /** Board URL this card was opened from (the My-quotes tab). Carried to the
   *  detail page as `?from=` so Back returns to this tab. See RfqBoard +
   *  RfqDetailScreen.goBack. */
  originHref?: string;
}) {
  const t = useTranslations('connect.rfq');
  const tCat = useTranslations('connect.search.listing.category');
  const tone = QUOTE_TONE[view.status];

  const detailHref = originHref
    ? `/connect/rfq/${view.rfqId}?from=${encodeURIComponent(originHref)}`
    : `/connect/rfq/${view.rfqId}`;

  return (
    <div
      className="relative transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(16,24,40,0.08)]"
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 14,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Single full-card link (stretched ::after), same contract as RfqCard. */}
        <Link
          href={detailHref}
          aria-label={t('viewQuoteAria')}
          className="min-w-0 flex-1 text-[14.5px] leading-snug font-semibold no-underline after:absolute after:inset-0 after:content-[''] hover:underline"
          style={{ color: 'var(--cr-text)' }}
        >
          {view.rfq ? view.rfq.title : t('requestRemoved')}
        </Link>
        <span className="relative z-[2] flex shrink-0 items-center gap-1.5">
          {/* Sample disclosure for a seeded demo quote; relative z-[2] keeps it
              above the stretched title-link overlay. */}
          {view.isDemo && <SampleBadge size="sm" />}
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
            style={{ background: tone.bg, color: tone.fg }}
          >
            {t(`quoteStatus.${view.status}`)}
          </span>
        </span>
      </div>

      {view.rfq && (
        <div
          className="mt-1 text-[11px] font-bold tracking-wide uppercase"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {categoryLabel(view.rfq.category, tCat)}
        </div>
      )}

      <div
        className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]"
        style={{ color: 'var(--cr-text-4)' }}
      >
        <span
          className="inline-flex items-center gap-1 text-[13.5px] font-bold"
          style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
        >
          <IndianRupee size={13} aria-hidden />
          {rupees(view.price).replace('₹', '')}
        </span>
        {view.leadTimeDays != null && (
          <span className="inline-flex items-center gap-1">
            <Timer size={12} aria-hidden /> {t('leadTimeValue', { days: view.leadTimeDays })}
          </span>
        )}
        {view.createdAt && <span>{t('postedAgo', { when: dayjs(view.createdAt).fromNow() })}</span>}
        {view.rfq && (
          <span
            className="inline-flex items-center gap-1"
            style={{ color: 'var(--cr-primary)', fontWeight: 600 }}
          >
            <FileText size={12} aria-hidden /> {t('quotesCount', { count: view.rfq.quotesCount })}
            {view.rfq.lowestQuotePrice != null &&
              ` · ${t('lowestQuote', { price: rupees(view.rfq.lowestQuotePrice) })}`}
          </span>
        )}
        {view.rfq && view.rfq.status !== 'open' && <span>{t(`status.${view.rfq.status}`)}</span>}
      </div>
    </div>
  );
}
