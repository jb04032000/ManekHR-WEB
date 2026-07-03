'use client';

/**
 * A single quote, shown in the buyer's compare list (with the action slot) and
 * the seller's own-quote view. Renders the structured offer the composer now
 * collects: total + per-unit breakdown, what's-included chips, lead time,
 * validity window (from updatedAt + validityDays, display-only), the message,
 * and work-sample thumbnails. Unknown include strings render humanized;
 * presets map to connect.rfq.includes.* labels (keep in sync with
 * QUOTE_INCLUDE_PRESETS in rfq.types.ts).
 */

import { useTranslations } from 'next-intl';
import { Image, Tag } from 'antd';
import dayjs from 'dayjs';
// Per-item "Sample" disclosure pill on a seeded demo quote (quote.isDemo).
import SampleBadge from '@/components/connect/SampleBadge';
import { QUOTE_INCLUDE_PRESETS, type Quote } from './rfq.types';

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

const STATUS_COLOR: Record<Quote['status'], string> = {
  sent: 'blue',
  shortlisted: 'gold',
  accepted: 'green',
  declined: 'red',
  withdrawn: 'default',
};

/** Humanize a custom include string (dashes/underscores to spaces, capitalize). */
function humanize(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export default function QuoteCard({
  quote,
  sellerName,
  actions,
}: {
  quote: Quote;
  sellerName?: string;
  actions?: React.ReactNode;
}) {
  const t = useTranslations('connect.rfq');

  const includeLabel = (slug: string) =>
    (QUOTE_INCLUDE_PRESETS as readonly string[]).includes(slug)
      ? t(`includes.${slug}` as Parameters<typeof t>[0])
      : humanize(slug);

  // Display-only validity: updatedAt + validityDays. Hidden once in the past.
  const validUntil =
    quote.validityDays != null && quote.updatedAt
      ? dayjs(quote.updatedAt).add(quote.validityDays, 'day')
      : null;
  const validityLabel =
    validUntil && validUntil.isAfter(dayjs())
      ? t('validity.until', { date: validUntil.format('D MMM') })
      : null;

  return (
    <div
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 16,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div
            className="text-[17px] font-bold"
            style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
          >
            {rupees(quote.price)}
          </div>
          {/* Per-unit breakdown behind the total, when the seller quoted a rate. */}
          {quote.rate != null && quote.rateQuantity != null && (
            <div
              className="mt-0.5 text-[12px]"
              style={{ color: 'var(--cr-text-4)', fontVariantNumeric: 'tabular-nums' }}
            >
              {t('rateBreakdown', {
                rate: rupees(quote.rate),
                quantity: quote.rateQuantity,
              })}
            </div>
          )}
          {sellerName && (
            <div className="mt-0.5 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
              {sellerName}
            </div>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {quote.isDemo && <SampleBadge size="sm" />}
          <Tag color={STATUS_COLOR[quote.status]}>{t(`quoteStatus.${quote.status}`)}</Tag>
        </span>
      </div>

      <div
        className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]"
        style={{ color: 'var(--cr-text-4)' }}
      >
        {quote.leadTimeDays != null && (
          <span>{t('leadTimeValue', { days: quote.leadTimeDays })}</span>
        )}
        {validityLabel && <span>{validityLabel}</span>}
      </div>

      {/* What's included chips. */}
      {(quote.includes?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quote.includes!.map((slug) => (
            <span
              key={slug}
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
            >
              {includeLabel(slug)}
            </span>
          ))}
        </div>
      )}

      {quote.message && (
        <p className="mt-2 mb-0 text-[13px]" style={{ color: 'var(--cr-text-2)' }}>
          {quote.message}
        </p>
      )}

      {/* Work-sample thumbnails (click to zoom; AntD Image preview group). */}
      {(quote.sampleUrls?.length ?? 0) > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Image.PreviewGroup>
            {quote.sampleUrls!.map((url) => (
              <Image
                key={url}
                src={url}
                alt={t('samples.alt')}
                width={64}
                height={64}
                style={{ objectFit: 'cover', borderRadius: 'var(--cr-radius-md)' }}
              />
            ))}
          </Image.PreviewGroup>
        </div>
      )}

      {actions && <div className="mt-3 flex justify-end gap-2">{actions}</div>}
    </div>
  );
}
