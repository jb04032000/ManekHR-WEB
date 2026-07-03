'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import ConnectRightRail from '@/components/connect/ConnectRightRail';
import RailPanel from '@/components/connect/RailPanel';
import PromotedListingAdCard, {
  type PromotedListingResolved,
} from '../marketplace/PromotedListingAdCard';

/**
 * EntityAdRail - the right-rail ad section shared by the company, storefront,
 * and create-listing pages.
 *
 * Stacks, top to bottom: the Google AdSlots + the first-party promoted listing
 * (both via `ConnectRightRail`, which owns the `connect.right.*` AdSlots), plus
 * a floor panel that keeps the rail from ever collapsing to a blank column.
 *
 * The floor panel defaults to a house "advertise on ManekHR" promo (which
 * doubles as a first-party house ad nudging sellers to list/boost). A caller
 * can override it via `floorPanel` for pages where that promo would be wrong -
 * e.g. the create-listing form passes listing tips instead, since "List a
 * product" would just point back at the page you are already on. Real ads
 * (Google or first-party) always stack above the floor panel.
 */
export default function EntityAdRail({
  promoted,
  floorPanel,
}: {
  promoted: PromotedListingResolved | null;
  /** Override for the always-present floor content. Defaults to the house promo. */
  floorPanel?: ReactNode;
}) {
  const t = useTranslations('connect.ads.house');

  const houseFloor = (
    <RailPanel title={t('title')}>
      <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-3)' }}>
        {t('body')}
      </p>
      <Link
        href="/connect/marketplace/new"
        className="mt-2.5 inline-block text-[12.5px] font-semibold no-underline"
        style={{ color: 'var(--cr-primary)' }}
      >
        {t('cta')}
      </Link>
    </RailPanel>
  );

  return (
    <ConnectRightRail>
      {promoted ? <PromotedListingAdCard {...promoted} /> : null}
      {floorPanel ?? houseFloor}
    </ConnectRightRail>
  );
}
