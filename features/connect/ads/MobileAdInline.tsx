'use client';

/**
 * MobileAdInline - the in-content ad block phone/tablet users see.
 *
 * The Connect ad rails are desktop-only (hidden below xl, some below lg), so a
 * phone browser never sees the rail's ad inventory. This renders the SAME
 * inventory inline in the main content column, then hides itself at the
 * breakpoint where the desktop rail takes over - so an ad never double-shows.
 *
 * Stacks the first-party promoted listing (PromotedListingAdCard) when a boost
 * was resolved, plus the Google connect.right.top AdSlot. Pass the SAME
 * `promoted` the page already resolved via resolvePromotedRailListing so this
 * shares the page's ad decision (no extra resolve, leak-safe via the public
 * getter).
 *
 * keep in sync with EntityAdRail; desktop rail is hidden below xl/lg, this fills
 * mobile. Cross-module: PromotedListingAdCard (boost) + AdSlot (Google).
 */

import { useTranslations } from 'next-intl';
import AdSlot, { adSlotWillRender } from '@/components/connect/AdSlot';
import type { AdPlacement } from '@/lib/connect/ads';
import PromotedListingAdCard, {
  type PromotedListingResolved,
} from '../marketplace/PromotedListingAdCard';

// The single Google placement this inline block carries (mirrors the rail).
const PLACEMENT: AdPlacement = 'connect.right.top';

export default function MobileAdInline({
  promoted,
  breakpoint = 'xl',
}: {
  /** The boost the page already resolved (resolvePromotedRailListing). Google-only when null. */
  promoted?: PromotedListingResolved | null;
  /** The breakpoint at which the desktop rail takes over. Most rails = xl; ConnectLayout = lg. */
  breakpoint?: 'lg' | 'xl';
}) {
  const t = useTranslations('connect.ads');
  // Static class strings only (Tailwind JIT cannot see interpolated names): the
  // wrapper hides at the breakpoint where the desktop rail appears, so the same
  // ad never shows twice on a wide screen.
  const hideClass = breakpoint === 'lg' ? 'lg:hidden' : 'xl:hidden';

  // Render nothing when there's nothing to show: no boost AND the Google slot
  // resolves to null (no AdSense config + no house ad). Without this the
  // "Sponsored" heading + spacing rendered as an empty orphaned label on mobile
  // (stores / pages / profile / ...). When a slot IS configured, it still shows.
  if (!promoted && !adSlotWillRender(PLACEMENT)) return null;

  return (
    <section aria-label={t('sponsoredLabel')} className={`mt-6 flex flex-col gap-4 ${hideClass}`}>
      {/* Small section heading so the inline block reads as ad inventory, like the rail. */}
      <span
        className="text-[11px] font-bold tracking-wide uppercase"
        style={{ color: 'var(--cr-text-4)' }}
      >
        {t('sponsoredLabel')}
      </span>
      {promoted ? <PromotedListingAdCard {...promoted} /> : null}
      <AdSlot placement={PLACEMENT} />
    </section>
  );
}
