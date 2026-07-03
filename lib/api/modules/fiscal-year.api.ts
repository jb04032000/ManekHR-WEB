/**
 * Phase 16 / FIN-15-02 - Fiscal Year Close client API wrappers.
 *
 * Used by FyCloseStepper (and future surfaces) for read paths that need
 * client-side reactivity (health-checks polling, reopen flow, refresh after
 * close). Server Actions in `lib/actions/fiscal-year.actions.ts` cover SSR.
 */
import http, { unwrap } from '../client';
import { fiscalYear } from '../endpoints';
import type { FiscalYearRow, FyHealthChecksReport, CloseFyInput, ReopenFyInput } from '@/types';

export const fiscalYearApi = {
  list: (wsId: string, firmId: string) =>
    http.get(fiscalYear.list(wsId, firmId)).then(unwrap<FiscalYearRow[]>),

  current: (wsId: string, firmId: string) =>
    http.get(fiscalYear.current(wsId, firmId)).then(unwrap<FiscalYearRow>),

  health: (wsId: string, firmId: string, fyId: string) =>
    http.get(fiscalYear.health(wsId, firmId, fyId)).then(unwrap<FyHealthChecksReport>),

  close: (wsId: string, firmId: string, fyId: string, dto: CloseFyInput) =>
    http.post(fiscalYear.close(wsId, firmId, fyId), dto).then(unwrap<FiscalYearRow>),

  reopen: (wsId: string, firmId: string, fyId: string, dto: ReopenFyInput) =>
    http.post(fiscalYear.reopen(wsId, firmId, fyId), dto).then(unwrap<FiscalYearRow>),
};
