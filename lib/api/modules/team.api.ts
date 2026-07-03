import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  TeamMember, PaginatedResponse, PaginationParams,
  CreateTeamMemberPayload, UpdateTeamMemberPayload, GrantAccessPayload,
} from '@/types';

const E = ApiEndpoints.team;

export const teamApi = {
  list: (wsId: string, params?: PaginationParams) =>
    http.get(E.list(wsId), { params }).then(unwrap<TeamMember[] | PaginatedResponse<TeamMember>>),
  create: (wsId: string, data: CreateTeamMemberPayload) =>
    http.post(E.create(wsId), data).then(unwrap<TeamMember>),
  get: (wsId: string, memberId: string) =>
    http.get(E.get(wsId, memberId)).then(unwrap<TeamMember>),
  update: (wsId: string, memberId: string, data: UpdateTeamMemberPayload) =>
    http.patch(E.update(wsId, memberId), data).then(unwrap<TeamMember>),
  delete: (wsId: string, memberId: string) =>
    http.delete(E.delete(wsId, memberId)).then(unwrap<{ message: string }>),
  grantAccess: (wsId: string, memberId: string, data: GrantAccessPayload) =>
    http.post(E.grantAccess(wsId, memberId), data).then(unwrap<{ message: string }>),
  acceptInvite: (token: string) =>
    http.post(E.acceptInvite(token)).then(unwrap<{ message: string }>),
};
