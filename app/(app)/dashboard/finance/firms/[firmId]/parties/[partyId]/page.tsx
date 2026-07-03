'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Index redirect for a party. The party folder holds the ledger (the party's
 * detail view) and has no page of its own, so visiting it directly - or clicking
 * the breadcrumb "Detail" segment on a party sub-page - would 404. Send it to the
 * party ledger.
 */
export default function PartyDetailIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string; partyId: string }>();
  useEffect(() => {
    if (params?.firmId && params?.partyId) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/parties/${params.partyId}/ledger`);
    }
  }, [router, params?.firmId, params?.partyId]);
  return null;
}
