'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { Role, RoleTemplate, CreateRolePayload, UpdateRolePayload } from '@/types';

const E = ApiEndpoints.roles;

export async function listRoles(wsId: string): Promise<Role[]> {
  try {
    const http = await serverHttp();
    return await http.get(E.list(wsId)).then(unwrapServer<Role[]>);
  } catch {
    // 403 (module locked) and other failures → empty list. Callers handle
    // empty roles already (they show "create a role first" prompt).
    return [];
  }
}

export async function getRoleTemplates(wsId: string) {
  const http = await serverHttp();
  return http.get(E.templates(wsId)).then(unwrapServer<RoleTemplate[]>);
}

export async function createRole(wsId: string, data: CreateRolePayload, token?: string) {
  const http = await serverHttp(token);
  return http.post(E.create(wsId), data).then(unwrapServer<Role>);
}

export async function getRole(wsId: string, roleId: string) {
  const http = await serverHttp();
  return http.get(E.get(wsId, roleId)).then(unwrapServer<Role>);
}

export async function updateRole(wsId: string, roleId: string, data: UpdateRolePayload, token?: string) {
  const http = await serverHttp(token);
  return http.patch(E.update(wsId, roleId), data).then(unwrapServer<Role>);
}

export async function deleteRole(wsId: string, roleId: string, token?: string) {
  const http = await serverHttp(token);
  return http.delete(E.delete(wsId, roleId)).then(unwrapServer<{ message: string }>);
}
