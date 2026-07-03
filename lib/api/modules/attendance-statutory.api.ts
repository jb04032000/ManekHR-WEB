'use client';

import http from '../client';
import { ApiEndpoints } from '../endpoints';
import type { AxiosResponse } from 'axios';

export enum StatutoryTemplate {
  MH_FORM_T = 'mh_form_t',
  FORM_25_OT = 'form_25_ot',
  PF_ESI_WAGE = 'pf_esi_wage',
  LOP_AUDIT = 'lop_audit',
  GJ_FORM_D = 'gj_form_d',
}

export interface GenerateStatutoryRequest {
  template: StatutoryTemplate;
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
  memberScope?: string[];
  customDailyRate?: number;
}

const FALLBACK_FILENAMES: Record<StatutoryTemplate, string> = {
  [StatutoryTemplate.MH_FORM_T]: 'mh_form_t.pdf',
  [StatutoryTemplate.FORM_25_OT]: 'form_25_ot.pdf',
  [StatutoryTemplate.PF_ESI_WAGE]: 'pf_esi_wage.xlsx',
  [StatutoryTemplate.LOP_AUDIT]: 'lop_audit.pdf',
  [StatutoryTemplate.GJ_FORM_D]: 'gj_form_d.pdf',
};

/** Parse Content-Disposition header to extract filename. */
function extractFilename(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback;
  // RFC 6266: filename*=UTF-8''foo.pdf OR filename="foo.pdf"
  const starMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (starMatch) return decodeURIComponent(starMatch[1].trim().replace(/"/g, ''));
  const plainMatch = /filename="?([^";]+)"?/i.exec(disposition);
  if (plainMatch) return plainMatch[1].trim();
  return fallback;
}

export const attendanceStatutoryApi = {
  /**
   * POST /api/workspaces/:wsId/attendance/statutory/generate
   * Returns a blob; caller is responsible for triggering the browser download.
   * Does NOT call unwrap() because the response is binary.
   */
  generate: async (
    wsId: string,
    body: GenerateStatutoryRequest,
  ): Promise<{ blob: Blob; filename: string; mimeType: string }> => {
    const res: AxiosResponse<Blob> = await http.post(
      ApiEndpoints.attendance.statutoryGenerate(wsId),
      body,
      { responseType: 'blob' },
    );

    const mimeType =
      (res.headers?.['content-type'] as string | undefined) ??
      'application/octet-stream';
    const filename = extractFilename(
      res.headers?.['content-disposition'] as string | undefined,
      FALLBACK_FILENAMES[body.template],
    );

    return { blob: res.data, filename, mimeType };
  },
};
