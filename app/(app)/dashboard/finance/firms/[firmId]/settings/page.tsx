'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Index redirect for the firm Settings grouping. The folder holds the individual
 * settings pages (business, branding, gstins, layout, numbering) and has no page
 * of its own, so visiting it directly - or clicking the breadcrumb "Settings"
 * segment - would 404. Send it to the Business Profile page, the canonical entry
 * point for firm settings.
 */
export default function FirmSettingsIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string }>();
  useEffect(() => {
    if (params?.firmId) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/settings/business`);
    }
  }, [router, params?.firmId]);
  return null;
}
