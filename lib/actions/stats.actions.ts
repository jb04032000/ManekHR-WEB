'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { DashboardStats, HrOverviewResponse } from '@/types';

export async function getDashboardStats(wsId: string) {
  const http = await serverHttp();
  return http.get(ApiEndpoints.statistics.dashboard(wsId)).then(unwrapServer<DashboardStats>);
}

/**
 * HR OVERVIEW — ManekHR admin-landing people metrics. Hits the RBAC-gated
 * statistics/hr-overview endpoint (SALARY view scope=all). Cross-module: feeds
 * the HrOverview landing component at app/(app)/dashboard/page.tsx. Throws on 403
 * so the caller can show its error state (a worker without scope=all never lands
 * here anyway — it routes to MySelfDashboard).
 */
export async function getHrOverview(wsId: string) {
  const http = await serverHttp();
  return http.get(ApiEndpoints.statistics.hrOverview(wsId)).then(unwrapServer<HrOverviewResponse>);
}
