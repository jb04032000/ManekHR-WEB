'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Index redirect for the OCR grouping. The folder holds the upload flow and has no
 * page of its own, so visiting it directly - or clicking the breadcrumb "Ocr"
 * segment - would 404. Send it to the document upload page.
 */
export default function OcrIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string }>();
  useEffect(() => {
    if (params?.firmId) {
      router.replace(`/dashboard/finance/firms/${params.firmId}/ocr/upload`);
    }
  }, [router, params?.firmId]);
  return null;
}
