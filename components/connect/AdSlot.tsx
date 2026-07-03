import Link from 'next/link';
import { env } from '@/lib/env';
import { resolveAd, type AdPlacement } from '@/lib/connect/ads';
import GoogleAdUnit from './GoogleAdUnit';

/**
 * AdSlot - a declared ad placement in a page rail. Resolution order:
 *   1. Google AdSense, when the owner has configured a publisher id + a slot id
 *      for this placement (`env.adSenseClientId` + `env.adSenseSlots`).
 *   2. The house ad registry (`lib/connect/ads.ts`) - a first-party creative.
 *   3. Nothing - an unconfigured slot reserves no space (no empty box).
 *
 * Pages drop `<AdSlot placement="..." />` into a rail; this seam decides what
 * fills it. An external network (AdSense) is a PAID dependency, and consent /
 * frequency / targeting policy belong here, not in the page components.
 */
/**
 * Whether AdSlot will render anything for this placement, decided by the SAME
 * resolution order as the component (AdSense configured -> house ad -> nothing).
 * Lets a host (e.g. MobileAdInline) avoid rendering its "Sponsored" heading +
 * spacing around a slot that will resolve to null, which otherwise reads as an
 * empty orphaned label. Note: an AdSense slot is "will render" once CONFIGURED;
 * a live no-fill collapse is handled by GoogleAdUnit, not here.
 */
export function adSlotWillRender(placement: AdPlacement): boolean {
  const adsenseSlot = env.adSenseClientId ? env.adSenseSlots[placement] : '';
  if (env.adSenseClientId && adsenseSlot) return true;
  return !!resolveAd(placement);
}

export default function AdSlot({ placement }: { placement: AdPlacement }) {
  // 1. Google AdSense (live third-party fill) when configured for this slot.
  const adsenseSlot = env.adSenseClientId ? env.adSenseSlots[placement] : '';
  if (env.adSenseClientId && adsenseSlot) {
    return <GoogleAdUnit client={env.adSenseClientId} slot={adsenseSlot} placement={placement} />;
  }

  // 2. House ad registry (empty today) -> a first-party creative, else nothing.
  const ad = resolveAd(placement);
  if (!ad) return null;

  return (
    <aside
      aria-label={ad.label}
      className="overflow-hidden rounded-lg"
      style={{ border: '1px solid var(--cr-border)', background: 'var(--cr-surface)' }}
    >
      <Link
        href={ad.href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block no-underline"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- external ad creative, no next/image optimisation */}
        <img src={ad.image} alt={ad.title} className="block w-full" loading="lazy" />
        <span
          className="block px-3 py-2 text-[11px] font-semibold tracking-wide uppercase"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {ad.label}
        </span>
      </Link>
    </aside>
  );
}
