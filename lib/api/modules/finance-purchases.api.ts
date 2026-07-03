import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { OcrExtractionResult } from '@/types';

const E = ApiEndpoints.finance;

/**
 * Client-side multipart upload for OCR vendor bill extraction.
 * Used in OcrUploadZone (browser) because multipart/form-data File objects
 * cannot be serialized through Next.js Server Actions.
 */
export async function uploadVendorBillForOcrClient(
  wsId: string,
  file: File,
): Promise<OcrExtractionResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await http.post(E.ocr.uploadVendorBill(wsId), fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<OcrExtractionResult>(res);
}
