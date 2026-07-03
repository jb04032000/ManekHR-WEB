'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  Location,
  CreateLocationPayload,
  UpdateLocationPayload,
} from '@/types';

const E = ApiEndpoints.locations;

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

export async function listLocations(wsId: string) {
  const http = await serverHttp();
  return http.get(E.list(wsId)).then(unwrapServer<Location[]>);
}

export async function getLocation(wsId: string, id: string) {
  const http = await serverHttp();
  return http.get(E.get(wsId, id)).then(unwrapServer<Location>);
}

export async function createLocation(
  wsId: string,
  data: CreateLocationPayload,
  token?: string,
) {
  return run(async () => {
    const http = await serverHttp(token);
    return http.post(E.create(wsId), data).then(unwrapServer<Location>);
  });
}

export async function updateLocation(
  wsId: string,
  id: string,
  data: UpdateLocationPayload,
  token?: string,
) {
  return run(async () => {
    const http = await serverHttp(token);
    return http.patch(E.update(wsId, id), data).then(unwrapServer<Location>);
  });
}

export async function deleteLocation(wsId: string, id: string, token?: string) {
  return run(async () => {
    const http = await serverHttp(token);
    return http
      .delete(E.delete(wsId, id))
      .then(unwrapServer<{ success: boolean }>);
  });
}

export async function peekNextLocationCode(wsId: string) {
  const http = await serverHttp();
  return http.get(E.peekCode(wsId)).then(unwrapServer<{ nextCode: string }>);
}
