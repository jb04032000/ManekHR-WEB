'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Index redirect for the "Manufacturing & Job-Work" report grouping. The folder
 * holds one route per report (mv-register, job-work-pending, machine-output, ...)
 * and has no page of its own, so visiting it directly - or clicking the breadcrumb
 * "Manufacturing" segment - would 404. Send it to the Reports hub with the
 * Manufacturing tab pre-selected.
 */
export default function ManufacturingReportsIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string }>();
  useEffect(() => {
    if (params?.firmId) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/reports?cat=manufacturing`);
    }
  }, [router, params?.firmId]);
  return null;
}
