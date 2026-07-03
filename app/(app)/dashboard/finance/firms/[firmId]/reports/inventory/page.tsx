'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Index redirect for the "Inventory" report grouping. The folder holds one route
 * per report (item-ledger, godown-stock, wastage-register, ...) and has no page of
 * its own, so visiting it directly - or clicking the breadcrumb "Inventory"
 * segment - would 404. Send it to the Reports hub with the Inventory tab
 * pre-selected.
 */
export default function InventoryReportsIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string }>();
  useEffect(() => {
    if (params?.firmId) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/reports?cat=inventory`);
    }
  }, [router, params?.firmId]);
  return null;
}
