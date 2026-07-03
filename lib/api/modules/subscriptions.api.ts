import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { Plan, Subscription } from '@/types';

const E = ApiEndpoints.subscriptions;

export const subscriptionsApi = {
  getPlans: () => http.get(E.plans).then(unwrap<Plan[]>),
  getMy: () => http.get(E.my).then(unwrap<Subscription>),
};
