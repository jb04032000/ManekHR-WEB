'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ReturnsIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string }>();
  useEffect(() => {
    if (params?.firmId) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/returns/credit-notes`);
    }
  }, [router, params?.firmId]);
  return null;
}
