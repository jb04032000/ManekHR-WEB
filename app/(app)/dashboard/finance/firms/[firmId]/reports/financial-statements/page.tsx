'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Index redirect for the "Financial Statements" (Statutory) report grouping.
 * The folder holds one route per statement (trial-balance, profit-loss, ...) and
 * has no page of its own, so visiting it directly - or clicking the breadcrumb
 * "Financial Statements" segment - would 404. Send it to the Reports hub with the
 * Statutory tab pre-selected. Client-side redirect to match the sibling stubs
 * (e.g. sales/page.tsx) and avoid server-rendering the intl-bound dashboard layout.
 */
export default function FinancialStatementsIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string }>();
  useEffect(() => {
    if (params?.firmId) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/reports?cat=statutory`);
    }
  }, [router, params?.firmId]);
  return null;
}
