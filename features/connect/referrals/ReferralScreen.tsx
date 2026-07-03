'use client';

/**
 * ReferralScreen -- the Refer & Earn dedicated page client component.
 *
 * What: renders the full referral hub for a signed-in user: referral link + share
 *   buttons (Copy, WhatsApp, native share), earn line (friend benefit first), 3
 *   stat cards, referred list with status chips, how-it-works steps, and terms
 *   link. Handles the disabled state (admin enabled=false even when REFERRAL_ENABLED
 *   is true) and the fetch-error state gracefully.
 *
 * Cross-module links:
 *   - env.appUrl (lib/env.ts) for building the shareable link
 *   - waMeHref / nativeShareSupported from lib/connect/share.ts
 *   - ReferralSummaryView from features/connect/referrals/referrals.types.ts
 *   - i18n namespace: connect.referrals.* (keys added in Phase 9)
 *
 * Watch: AntD v6 only -- no addonAfter on InputNumber, no destroyOnClose, no
 *   Tabs.TabPane, no visible={}, etc. All buttons need aria-label. Earn line
 *   MUST lead with the friend's benefit, not the referrer's (UX decision).
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Tag, Tooltip, App } from 'antd';
import { Copy, Gift, CheckCheck, MessageCircle, Share2, ExternalLink } from 'lucide-react';
import { env } from '@/lib/env';
import { waMeHref, nativeShareSupported } from '@/lib/connect/share';
import type { ReferralSummaryView, ReferralStatus } from './referrals.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map backend ReferralStatus to a chip label + colour for the referred list.
 *  'rejected' rows are hidden entirely; 'pending' shows as "Joined". */
function statusChip(status: ReferralStatus): { label: string; color: string } | null {
  switch (status) {
    case 'pending':
      return { label: 'Joined', color: 'default' };
    case 'qualified':
      return { label: 'Active', color: 'blue' };
    case 'rewarded':
      return { label: 'Credited', color: 'green' };
    case 'rejected':
      return null; // hidden
    default:
      return null;
  }
}

/** Format a whole-credit number as a short label: "50 credits". */
function credits(n: number): string {
  return `${n} credits`;
}

/** Format an ISO date string as a short locale date. */
function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** One stat card: label + large number + optional sub-label. */
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    // `h-full` makes the card fill its grid cell; CSS Grid already stretches
    // cells to the row's tallest, so all three cards match height even when the
    // optional `sub` line differs in length. Keep in sync with the grid + the
    // `role="listitem"` wrappers below (both also stretch to full height).
    <div
      className="flex h-full flex-col gap-1 rounded-[var(--cr-radius-lg)] p-4"
      style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
    >
      <span className="text-[11px] font-semibold uppercase" style={{ color: 'var(--cr-text-4)' }}>
        {label}
      </span>
      <span
        className="text-[26px] leading-tight font-extrabold tabular-nums"
        style={{ color: 'var(--cr-text)' }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[11px]" style={{ color: 'var(--cr-text-4)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

/** One referred list row. */
function ReferredRow({
  name,
  status,
  date,
}: {
  name: string;
  status: ReferralStatus;
  date: string;
}) {
  const chip = statusChip(status);
  if (!chip) return null; // hide rejected
  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: '1px solid var(--cr-divider)' }}
    >
      {/* Avatar placeholder */}
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
        style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="flex-1 truncate text-[14px] font-medium" style={{ color: 'var(--cr-text)' }}>
        {name}
      </span>
      <Tag color={chip.color} style={{ margin: 0 }}>
        {chip.label}
      </Tag>
      <span className="text-[12px] tabular-nums" style={{ color: 'var(--cr-text-4)' }}>
        {shortDate(date)}
      </span>
    </div>
  );
}

/** How it works -- 3 numbered steps. */
function HowItWorks({ t }: { t: ReturnType<typeof useTranslations<'connect.referrals'>> }) {
  const steps = [
    { n: 1, title: t('howItWorks.step1.title'), body: t('howItWorks.step1.body') },
    { n: 2, title: t('howItWorks.step2.title'), body: t('howItWorks.step2.body') },
    { n: 3, title: t('howItWorks.step3.title'), body: t('howItWorks.step3.body') },
  ];
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="rounded-[var(--cr-radius-lg)] p-5"
      style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
    >
      <h2
        id="how-it-works-heading"
        className="m-0 mb-4 text-[15px] font-bold"
        style={{ color: 'var(--cr-text)' }}
      >
        {t('howItWorks.title')}
      </h2>
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {steps.map(({ n, title, body }) => (
          <li key={n} className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
              style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
            >
              {n}
            </span>
            <div className="flex flex-col gap-0.5 pt-1">
              <span className="text-[14px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                {title}
              </span>
              <span className="text-[13px] leading-relaxed" style={{ color: 'var(--cr-text-3)' }}>
                {body}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ReferralScreenProps {
  /** Server-fetched summary; null when the fetch failed. */
  summary: ReferralSummaryView | null;
}

export default function ReferralScreen({ summary }: ReferralScreenProps) {
  const t = useTranslations('connect.referrals');
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);

  // Build the full shareable URL (auth page with the ?ref= query).
  const referralLink = summary ? `${env.appUrl}/auth?ref=${summary.code}` : '';

  // Copy to clipboard handler with "Copied" feedback.
  const handleCopy = useCallback(async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      message.success(t('hero.copied'));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      message.error(t('hero.copyFailed'));
    }
  }, [referralLink, message, t]);

  // WhatsApp share text: leads with friend benefit, includes the link.
  const waText = summary
    ? t('hero.shareText', {
        referee: summary.refereeCredits,
        referrer: summary.referrerCredits,
        link: referralLink,
      })
    : '';

  // Native share (mobile OS sheet).
  const handleNativeShare = useCallback(async () => {
    if (!nativeShareSupported() || !referralLink) return;
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
        title: t('hero.nativeShareTitle'),
        text: waText,
        url: referralLink,
      });
    } catch {
      // User cancelled or API unavailable -- silent.
    }
  }, [referralLink, waText, t]);

  // ---------------------------------------------------------------------------
  // Fetch-error state
  // ---------------------------------------------------------------------------
  if (!summary) {
    return (
      <div className="mx-auto w-full" style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}>
        <Alert type="error" title={t('error.title')} description={t('error.body')} showIcon />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Admin-disabled state (program exists but admin has it off)
  // ---------------------------------------------------------------------------
  if (!summary.enabled) {
    return (
      <div className="mx-auto w-full" style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}>
        <div
          className="flex flex-col items-center gap-4 rounded-[var(--cr-radius-lg)] p-10 text-center"
          style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
        >
          <span aria-hidden className="text-4xl" style={{ filter: 'grayscale(1)', opacity: 0.4 }}>
            🎁
          </span>
          <h1 className="m-0 text-[18px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {t('disabled.title')}
          </h1>
          <p
            className="m-0 max-w-[440px] text-[14px] leading-relaxed"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {t('disabled.body')}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Visible referrals in the recent list (exclude 'rejected')
  const visibleRecent = summary.recent.filter((r) => r.status !== 'rejected');

  // ---------------------------------------------------------------------------
  // Live state
  // ---------------------------------------------------------------------------
  return (
    <div
      className="mx-auto flex w-full flex-col gap-5"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
    >
      {/* ---- Hero card: link + share actions + earn line ---- */}
      <section
        aria-labelledby="referral-hero-heading"
        className="rounded-[var(--cr-radius-lg)] p-5"
        style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
      >
        <div className="mb-1 flex items-center gap-2">
          <Gift size={18} aria-hidden style={{ color: 'var(--cr-primary)' }} />
          <h1
            id="referral-hero-heading"
            className="m-0 text-[17px] font-bold"
            style={{ color: 'var(--cr-text)' }}
          >
            {t('hero.title')}
          </h1>
        </div>

        {/* Earn line -- friend benefit first */}
        <p className="m-0 mb-4 text-[14px] leading-relaxed" style={{ color: 'var(--cr-text-3)' }}>
          {t('hero.earnLine', {
            referee: credits(summary.refereeCredits),
            referrer: credits(summary.referrerCredits),
          })}
        </p>

        {/* Referral link read-only input + copy button */}
        <div className="flex items-center gap-2">
          <div
            className="min-w-0 flex-1 truncate rounded-[var(--cr-radius-md)] px-3 py-2 font-mono text-[13px]"
            style={{
              background: 'var(--cr-surface-2)',
              border: '1px solid var(--cr-border)',
              color: 'var(--cr-text)',
              userSelect: 'all',
            }}
            aria-label={t('hero.linkAriaLabel')}
            role="textbox"
            aria-readonly="true"
          >
            {referralLink}
          </div>
          <Tooltip title={copied ? t('hero.copied') : t('hero.copyTooltip')}>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? t('hero.copied') : t('hero.copyButton')}
              aria-live="polite"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-4 text-[13px] font-bold"
              style={{
                background: copied ? 'var(--cr-success, #22c55e)' : 'var(--cr-primary)',
                color: 'var(--cr-surface)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {copied ? <CheckCheck size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
              {copied ? t('hero.copied') : t('hero.copyButton')}
            </button>
          </Tooltip>
        </div>

        {/* Share buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* WhatsApp share */}
          <a
            href={waMeHref(waText)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('hero.whatsappAriaLabel')}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-4 text-[13px] font-semibold no-underline"
            style={{
              background: '#25D366',
              color: '#fff',
              border: 'none',
            }}
          >
            <MessageCircle size={15} aria-hidden />
            {t('hero.whatsappButton')}
          </a>

          {/* Native share (only when OS supports it) */}
          {nativeShareSupported() && (
            <button
              type="button"
              onClick={handleNativeShare}
              aria-label={t('hero.nativeShareAriaLabel')}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-4 text-[13px] font-semibold"
              style={{
                background: 'var(--cr-surface-2)',
                color: 'var(--cr-text)',
                border: '1px solid var(--cr-border)',
                cursor: 'pointer',
              }}
            >
              <Share2 size={15} aria-hidden />
              {t('hero.nativeShareButton')}
            </button>
          )}
        </div>
      </section>

      {/* ---- 3 stat cards ---- */}
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="list"
        aria-label={t('stats.aria')}
      >
        {/* `h-full` on each listitem wrapper: the grid stretches these cells to
            the tallest row item, and h-full passes that height down so the
            StatCard's own `h-full` resolves -> all three cards match height. */}
        <div role="listitem" className="h-full">
          <StatCard
            label={t('stats.referred')}
            value={summary.referredCount}
            sub={t('stats.referredSub')}
          />
        </div>
        <div role="listitem" className="h-full">
          <StatCard
            label={t('stats.earned')}
            value={credits(summary.creditsEarned)}
            sub={summary.creditsEarned > 0 ? t('stats.earnedSub') : undefined}
          />
        </div>
        <div role="listitem" className="h-full">
          <StatCard
            label={t('stats.pending')}
            value={credits(summary.creditsPending)}
            sub={t('stats.pendingSub')}
          />
        </div>
      </div>

      {/* ---- Referred list ---- */}
      <section
        aria-labelledby="referred-list-heading"
        className="rounded-[var(--cr-radius-lg)] p-5"
        style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
      >
        <h2
          id="referred-list-heading"
          className="m-0 mb-1 text-[15px] font-bold"
          style={{ color: 'var(--cr-text)' }}
        >
          {t('list.title')}
        </h2>
        <p className="m-0 mb-2 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('list.subtitle')}
        </p>

        {visibleRecent.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span aria-hidden className="text-3xl" style={{ opacity: 0.35 }}>
              👋
            </span>
            <p className="m-0 text-[14px]" style={{ color: 'var(--cr-text-3)' }}>
              {t('list.empty')}
            </p>
            {/* Share CTA in empty state */}
            <a
              href={waMeHref(waText)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('list.emptyCta')}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--cr-radius-md)] px-4 text-[13px] font-semibold no-underline"
              style={{
                background: 'var(--cr-primary)',
                color: 'var(--cr-surface)',
              }}
            >
              <MessageCircle size={14} aria-hidden />
              {t('list.emptyCta')}
            </a>
          </div>
        ) : (
          <ul className="m-0 list-none p-0" role="list" aria-label={t('list.aria')}>
            {visibleRecent.map((entry, idx) => (
              <li key={`${entry.name}-${idx}`}>
                <ReferredRow name={entry.name} status={entry.status} date={entry.date} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- How it works ---- */}
      <HowItWorks t={t} />

      {/* ---- Terms link + inline disclosure ----
           Points at the existing public Connect terms route (/terms/connect) -- the
           same target used by the footer, signup consent, and PolicyGate. The inline
           `terms.note` fine-print states the essentials (free in-app credits, boost-only,
           not cash/withdrawable, program can change) for a minimal disclosure now; a
           dedicated referral T&C page is a later phase. */}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="m-0 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('terms.prefix')}{' '}
          <a
            href="/terms/connect"
            aria-label={t('terms.linkAriaLabel')}
            className="underline"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {t('terms.link')}
            <ExternalLink size={11} aria-hidden style={{ display: 'inline', marginLeft: 2 }} />
          </a>
        </p>
        <p
          className="m-0 max-w-[560px] text-[11px] leading-relaxed"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {t('terms.note')}
        </p>
      </div>
    </div>
  );
}
