/**
 * Phase 16 / FIN-15-01 - Tally Export client API wrappers.
 *
 * Used by the dashboard page (TallyExportForm) directly when a synchronous
 * download flow is required (POST returns binary XML stream). For SSR/Server
 * Action usage, see `lib/actions/tally-export.actions.ts`.
 */
import http, { unwrap } from '../client';
import { tallyExport } from '../endpoints';
import type { TallyValidatorReport, TallyRecentExport, GenerateTallyExportInput } from '@/types';

export const tallyExportApi = {
  /**
   * Generate the XML export. POST returns either a binary stream (status='ready')
   * with `Content-Type: application/xml` OR JSON `{ status: 'queued', jobId }`.
   * The caller is responsible for handling the response shape - see TallyExportForm.
   */
  generate: (wsId: string, input: GenerateTallyExportInput) =>
    http.post(tallyExport.generate(wsId), input, { responseType: 'blob' }),

  validator: (wsId: string, firmId: string, fromDate: string, toDate: string) =>
    http
      .get(tallyExport.validator(wsId, firmId, fromDate, toDate))
      .then(unwrap<TallyValidatorReport>),

  recent: (wsId: string, firmId: string, limit = 10) =>
    http.get(tallyExport.recent(wsId, firmId, limit)).then(unwrap<{ rows: TallyRecentExport[] }>),
};
