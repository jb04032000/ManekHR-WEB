'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  ResourceScope,
  UpsertResourceScopePayload,
  UpdateResourceScopePayload,
  MyResourceScopeResponse,
} from '@/types';

const E = ApiEndpoints.resourceScopes;

async function run<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e: any) {
    const backend = e?.response?.data;
    const msg =
      (typeof backend?.error?.message === 'string' && backend.error.message) ||
      (typeof backend?.message === 'string' && backend.message) ||
      (Array.isArray(backend?.message) && backend.message.join(', ')) ||
      (typeof backend?.error === 'string' && backend.error) ||
      e?.message ||
      'Something went wrong';
    throw new Error(msg);
  }
}

export async function listResourceScopes(wsId: string) {
  const http = await serverHttp();
  return http.get(E.list(wsId)).then(unwrapServer<ResourceScope[]>);
}

export async function getResourceScope(wsId: string, id: string) {
  const http = await serverHttp();
  return http.get(E.get(wsId, id)).then(unwrapServer<ResourceScope>);
}

export async function getMyResourceScope(wsId: string) {
  const http = await serverHttp();
  return http.get(E.me(wsId)).then(unwrapServer<MyResourceScopeResponse>);
}

export async function createResourceScope(
  wsId: string,
  data: UpsertResourceScopePayload,
  token?: string,
) {
  return run(async () => {
    const http = await serverHttp(token);
    return http.post(E.create(wsId), data).then(unwrapServer<ResourceScope>);
  });
}

export async function updateResourceScope(
  wsId: string,
  id: string,
  data: UpdateResourceScopePayload,
  token?: string,
) {
  return run(async () => {
    const http = await serverHttp(token);
    return http.patch(E.update(wsId, id), data).then(unwrapServer<ResourceScope>);
  });
}

export async function deleteResourceScope(
  wsId: string,
  id: string,
  token?: string,
) {
  return run(async () => {
    const http = await serverHttp(token);
    return http
      .delete(E.delete(wsId, id))
      .then(unwrapServer<{ success: boolean }>);
  });
}
