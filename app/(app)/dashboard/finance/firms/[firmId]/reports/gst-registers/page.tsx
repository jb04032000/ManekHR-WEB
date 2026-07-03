'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Index redirect for the "GST Registers" report grouping. The folder holds one
 * route per register (gstr1, gstr3b, output-register, ...) and has no page of its
 * own, so visiting it directly - or clicking the breadcrumb "Gst Registers"
 * segment - would 404. Send it to the Reports hub with the GST tab pre-selected.
 */
export default function GstRegistersIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string }>();
  useEffect(() => {
    if (params?.firmId) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/reports?cat=gst`);
    }
  }, [router, params?.firmId]);
  return null;
}
