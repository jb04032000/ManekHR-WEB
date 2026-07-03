'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function SalesIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string }>();
  useEffect(() => {
    if (params?.firmId) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/sales/invoices`);
    }
  }, [router, params?.firmId]);
  return null;
}
