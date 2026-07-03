'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { adReservedHeightClass, type AdPlacement } from '@/lib/connect/ads';

/**
 * HouseAdFallback - the first-party self-promo shown when AdSense IS configured
 * but returns NO fill for a slot (the <ins> reports data-ad-status="unfilled"),
 * so a rail/grid slot is never left as a blank void. Reuses the existing
 * `connect.ads.house` copy (all four locales) and points at the boost flow
 * (/connect/boosts) so the empty inventory still sells "advertise here". Reserves
 * the SAME min-height as the AdSense unit so the no-fill swap does not shift
 * surrounding content.
 *
 * Links: GoogleAdUnit (renders this on no-fill), lib/connect/ads
 * (adReservedHeightClass), /connect/boosts (the boost manager = advertise flow).
 * Watch: keep the reserved height identical to GoogleAdUnit's so the swap stays
 * shift-free.
 */
export default function HouseAdFallback({ placement }: { placement: AdPlacement }) {
  const t = useTranslations('connect.ads');

  return (
    <aside
      aria-label={t('house.title')}
      className={`overflow-hidden rounded-lg ${adReservedHeightClass(placement)}`}
      style={{ border: '1px solid var(--cr-border)', background: 'var(--cr-surface)' }}
    >
      <Link
        href="/connect/boosts"
        className="flex h-full flex-col justify-center gap-2 p-4 no-underline"
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--cr-text-2)' }}>
          {t('house.title')}
        </span>
        <span className="text-xs leading-snug" style={{ color: 'var(--cr-text-3)' }}>
          {t('house.body')}
        </span>
        <span className="mt-1 text-xs font-semibold" style={{ color: 'var(--cr-primary)' }}>
          {t('house.cta')}
        </span>
      </Link>
    </aside>
  );
}
