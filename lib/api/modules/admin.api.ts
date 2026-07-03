import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  User, Workspace, Subscription, Plan,
  PaginatedResponse, PaginationParams,
  UpdateUserStatusPayload, CreatePlanPayload, UpdatePlanPayload,
} from '@/types';

const E = ApiEndpoints.admin;

export const adminApi = {
  getStats: () => http.get(E.stats).then(unwrap<Record<string, number>>),
  getUsers: (params?: PaginationParams) => http.get(E.users, { params }).then(unwrap<PaginatedResponse<User>>),
  updateUserStatus: (id: string, data: UpdateUserStatusPayload) =>
    http.patch(E.userStatus(id), data).then(unwrap<User>),
  deleteUser: (id: string) => http.delete(E.deleteUser(id)).then(unwrap<{ message: string }>),
  getWorkspaces: (params?: PaginationParams) =>
    http.get(E.workspaces, { params }).then(unwrap<PaginatedResponse<Workspace>>),
  getSubscriptions: (params?: PaginationParams) =>
    http.get(E.subscriptions, { params }).then(unwrap<PaginatedResponse<Subscription>>),
  getPlans: () => http.get(E.plans).then(unwrap<Plan[]>),
  createPlan: (data: CreatePlanPayload) => http.post(E.createPlan, data).then(unwrap<Plan>),
  updatePlan: (id: string, data: UpdatePlanPayload) =>
    http.patch(E.updatePlan(id), data).then(unwrap<Plan>),
  deletePlan: (id: string) => http.delete(E.deletePlan(id)).then(unwrap<{ message: string }>),
};
