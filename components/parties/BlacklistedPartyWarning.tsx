'use client';
/**
 * BlacklistedPartyWarning - Phase 17 / D-04.
 *
 * Non-blocking informational banner shown ABOVE voucher creation forms
 * (sale-invoice, credit-note, purchase-bill, payment-in, payment-out) when
 * the selected party has `intelligence.blacklisted === true`.
 *
 * NOT a hard block - voucher submission proceeds normally; this is
 * informational only (D-04 says "non-blocking warning... no hard block").
 *
 * Two ways to use:
 * 1) Pass a Party object directly (when the parent already has it loaded).
 * 2) Pass wsId + partyId; the component will fetch the intelligence sub-doc
 *    via partyIntelligenceApi.getIntelligence and render the banner if
 *    `blacklisted` is true. This is the pattern used by voucher form pages
 *    that select a party via dropdown.
 */

import { startTransition, useEffect, useState } from 'react';
import { Alert } from 'antd';
import { useTranslations } from 'next-intl';
import { partyIntelligenceApi } from '@/lib/api/modules/parties.api';
import type { Party, PartyIntelligence } from '@/types';

interface Props {
  party?: Party | null;
  wsId?: string;
  partyId?: string;
}

export default function BlacklistedPartyWarning({ party, wsId, partyId }: Props) {
  const t = useTranslations('party-intelligence');
  const [intel, setIntel] = useState<PartyIntelligence | null>(party?.intelligence ?? null);

  useEffect(() => {
    // If a Party is provided directly, use intelligence.blacklisted from it.
    if (party?.intelligence) {
      const intelligence = party.intelligence;
      startTransition(() => {
        setIntel(intelligence);
      });
      return;
    }
    // Otherwise fetch via wsId + partyId.
    if (wsId && partyId) {
      partyIntelligenceApi
        .getIntelligence(wsId, partyId)
        .then((i) => setIntel(i))
        .catch(() => setIntel(null));
    } else {
      startTransition(() => {
        setIntel(null);
      });
    }
  }, [party, wsId, partyId]);

  if (!intel?.blacklisted) return null;

  const reason = intel.blacklistedReason ?? '-';
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      title={t('warnings.blacklistedParty', { reason })}
    />
  );
}
