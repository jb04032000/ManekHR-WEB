import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { DashboardStats } from '@/types';

export const statsApi = {
  dashboard: (wsId: string) =>
    http.get(ApiEndpoints.statistics.dashboard(wsId)).then(unwrap<DashboardStats>),
};
