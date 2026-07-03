'use client';

/**
 * BoostResultsDrawer - the per-boost results slide-over, hosted on the Boosts
 * list (BoostsManagerScreen). Replaces the standalone results PAGE: launching a
 * boost or hitting "View report" on a row opens this drawer over the list, so
 * the report sits in context (the list refreshes behind it) instead of a sparse
 * dedicated page.
 *
 * Data comes from the list row (BoostListItem) the host already has, mapped to
 * the card's shape - no extra fetch, so the drawer opens instantly. reach/views
 * both read `impressions` (the list row's only reach figure; the old page split
 * reach vs views but the list rollup exposes one impressions count).
 *
 * Cross-module: BoostResultsCard (the shared card body) + BoostsManagerScreen
 * (the host that owns open state + the list refetch). AntD v6 Drawer: open + size
 * + destroyOnHidden (NOT visible/width/destroyOnClose).
 *
 * MONEY UNIT: spent / left are whole RUPEES.
 */

import { Drawer } from 'antd';
import { useTranslations } from 'next-intl';
import { BoostResultsCard, type BoostResultsCardData } from './BoostResults';
import type { BoostListItem } from './ads.types';

interface BoostResultsDrawerProps {
  /** Whether the drawer is open. */
  open: boolean;
  /** The boost whose report to show, or null while none is selected. */
  boost: BoostListItem | null;
  /** Close the drawer (also fires on the AntD overlay/esc dismiss). */
  onClose: () => void;
  /** Fired after a pause/resume/cancel succeeds so the host refetches the list. */
  onChanged: () => void;
}

/** Map a list row into the card's metric/budget snapshot (no fetch). */
function toCardData(b: BoostListItem): BoostResultsCardData {
  return {
    status: b.status,
    spent: b.budgetSpent,
    left: Math.max(0, b.totalBudget - b.budgetSpent),
    // The list rollup carries one impressions count; the card's reach + views
    // both read it (the old page's separate views field has no list-row analog).
    reach: b.impressions,
    views: b.impressions,
    clicks: b.clicks,
    moderationReason: b.moderationReason,
    // Feed the read-only "X days left" line (spend/budget is hidden from users
    // now -- BOOST-USER-CONTROLS-OFF). The list row carries the campaign end.
    endAt: b.endAt,
  };
}

export default function BoostResultsDrawer({
  open,
  boost,
  onClose,
  onChanged,
}: BoostResultsDrawerProps) {
  const t = useTranslations('connect.ads.results');

  return (
    <Drawer
      title={t('drawerTitle')}
      open={open}
      onClose={onClose}
      size={420}
      destroyOnHidden
      rootClassName="cr-connect-drawer"
    >
      {/* Only mount the card when a boost is selected; destroyOnHidden also
          unmounts it on close so the optimistic status state opens clean. */}
      {boost && (
        <BoostResultsCard
          boostId={boost.id}
          data={toCardData(boost)}
          onChanged={onChanged}
          onClose={onClose}
        />
      )}
    </Drawer>
  );
}
