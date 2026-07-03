import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { Role, CreateRolePayload, UpdateRolePayload } from '@/types';

const E = ApiEndpoints.roles;

export const rolesApi = {
  list: (wsId: string) => http.get(E.list(wsId)).then(unwrap<Role[]>),
  getTemplates: (wsId: string) => http.get(E.templates(wsId)).then(unwrap<Role[]>),
  create: (wsId: string, data: CreateRolePayload) =>
    http.post(E.create(wsId), data).then(unwrap<Role>),
  get: (wsId: string, roleId: string) =>
    http.get(E.get(wsId, roleId)).then(unwrap<Role>),
  update: (wsId: string, roleId: string, data: UpdateRolePayload) =>
    http.patch(E.update(wsId, roleId), data).then(unwrap<Role>),
  delete: (wsId: string, roleId: string) =>
    http.delete(E.delete(wsId, roleId)).then(unwrap<{ message: string }>),
};
