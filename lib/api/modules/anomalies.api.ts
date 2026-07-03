import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { Anomaly, AnomalyRule, AnomalyRuleType, AnomalyListResponse, AnomalyCountResponse } from '@/types';

const E = ApiEndpoints.anomalies;

export interface ListAnomaliesParams {
  unacknowledgedOnly?: boolean;
  page?: number;
  limit?: number;
}

export const anomaliesApi = {
  list: (wsId: string, params: ListAnomaliesParams = {}) =>
    http.get(E.list(wsId), { params }).then(unwrap<AnomalyListResponse>),

  acknowledge: (wsId: string, id: string) =>
    http.patch(E.acknowledge(wsId, id)).then(unwrap<Anomaly>),

  count: (wsId: string) =>
    http.get(E.count(wsId)).then(unwrap<AnomalyCountResponse>),

  listRules: (wsId: string) =>
    http.get(E.listRules(wsId)).then(unwrap<AnomalyRule[]>),

  toggleRule: (wsId: string, ruleType: AnomalyRuleType, enabled: boolean) =>
    http.patch(E.toggleRule(wsId, ruleType), { enabled }).then(unwrap<AnomalyRule>),
};
