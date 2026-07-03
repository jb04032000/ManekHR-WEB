import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  Workspace,
  WorkspaceMember,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  InviteMemberPayload,
  ChangeMemberRolePayload,
  DefaulterAlertsConfig,
} from '@/types';

const E = ApiEndpoints.workspaces;

export const workspacesApi = {
  list: () => http.get(E.list).then(unwrap<Workspace[]>),
  create: (data: CreateWorkspacePayload) => http.post(E.create, data).then(unwrap<Workspace>),
  get: (id: string) => http.get(E.get(id)).then(unwrap<Workspace>),
  update: (id: string, data: UpdateWorkspacePayload) =>
    http.patch(E.update(id), data).then(unwrap<Workspace>),
  delete: (id: string) => http.delete(E.delete(id)).then(unwrap<{ message: string }>),
  getMembers: (id: string) => http.get(E.members(id)).then(unwrap<WorkspaceMember[]>),
  invite: (id: string, data: InviteMemberPayload) =>
    http.post(E.invite(id), data).then(unwrap<{ message: string }>),
  join: (token: string) => http.post(E.join(token)).then(unwrap<Workspace>),
  changeMemberRole: (id: string, memberId: string, data: ChangeMemberRolePayload) =>
    http.patch(E.memberRole(id, memberId), data).then(unwrap<WorkspaceMember>),
  updateDefaulterAlerts: (id: string, data: DefaulterAlertsConfig) =>
    http.patch(E.defaulterAlerts(id), data).then(unwrap<Workspace>),
};
