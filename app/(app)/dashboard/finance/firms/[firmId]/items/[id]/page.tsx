'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Index redirect for an item. The item folder holds its sub-pages (labels) and
 * has no page of its own, so visiting it directly - or clicking the breadcrumb
 * "Detail" segment on an item sub-page - would 404. Send it to the item label
 * page (the only item sub-view today).
 */
export default function ItemDetailIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string; id: string }>();
  useEffect(() => {
    if (params?.firmId && params?.id) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/items/${params.id}/labels`);
    }
  }, [router, params?.firmId, params?.id]);
  return null;
}
