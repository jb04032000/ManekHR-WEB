'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Index redirect for the "Party & Ledger" report grouping. The folder holds one
 * route per report (party-statement, account-ledger, daybook, ...) and has no
 * page of its own, so visiting it directly - or clicking the breadcrumb "Party
 * Ledger" segment - would 404. Send it to the Reports hub with the Party & Ledger
 * tab pre-selected.
 */
export default function PartyLedgerIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string }>();
  useEffect(() => {
    if (params?.firmId) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/reports?cat=party-ledger`);
    }
  }, [router, params?.firmId]);
  return null;
}
