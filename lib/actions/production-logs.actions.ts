'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  ProductionLog,
  CreateProductionLogPayload,
  UpdateProductionLogPayload,
  BulkProductionLogPayload,
  BulkProductionLogResult,
  PeekNextCodeResponse,
} from '@/types';

const E = ApiEndpoints.machines.productionLogs;

/**
 * Server actions run across a process boundary - axios-error details
 * (response.data.message) get stripped by Next.js serialization, leaving
 * the client only "Request failed with status code 409". Extract the
 * backend message server-side and rethrow as a plain Error.message so
 * parseApiError / msgApi.error surface the real reason.
 */
async function run<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e: unknown) {
    const err = e as {
      response?: { data?: { error?: { message?: string } | string; message?: string | string[] } };
      message?: string;
    };
    const backend = err?.response?.data;
    const backendError = backend?.error;
    const msg =
      (typeof backendError === 'object' &&
        typeof backendError?.message === 'string' &&
        backendError.message) ||
      (typeof backend?.message === 'string' && backend.message) ||
      (Array.isArray(backend?.message) && backend.message.join(', ')) ||
      (typeof backendError === 'string' && backendError) ||
      err?.message ||
      'Something went wrong';
    throw new Error(msg);
  }
}

export async function createProductionLog(
  wsId: string,
  machineId: string,
  payload: CreateProductionLogPayload,
): Promise<ProductionLog> {
  return run(async () => {
    const http = await serverHttp();
    return http.post(E.create(wsId, machineId), payload).then(unwrapServer<ProductionLog>);
  });
}

export async function bulkCreateProductionLogs(
  wsId: string,
  payload: BulkProductionLogPayload,
): Promise<BulkProductionLogResult> {
  return run(async () => {
    const http = await serverHttp();
    return http.post(E.bulkCreate(wsId), payload).then(unwrapServer<BulkProductionLogResult>);
  });
}

export async function updateProductionLog(
  wsId: string,
  machineId: string,
  logId: string,
  payload: UpdateProductionLogPayload,
): Promise<ProductionLog> {
  return run(async () => {
    const http = await serverHttp();
    return http.patch(E.update(wsId, machineId, logId), payload).then(unwrapServer<ProductionLog>);
  });
}

export async function deleteProductionLog(
  wsId: string,
  machineId: string,
  logId: string,
): Promise<{ deleted: true; logCode: string }> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .delete(E.delete(wsId, machineId, logId))
      .then(unwrapServer<{ deleted: true; logCode: string }>);
  });
}

export async function peekNextProductionLogCode(wsId: string): Promise<PeekNextCodeResponse> {
  const http = await serverHttp();
  return http.get(E.peekCode(wsId)).then(unwrapServer<PeekNextCodeResponse>);
}
