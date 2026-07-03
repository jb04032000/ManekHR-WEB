'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { manufacturing } from '@/lib/api/endpoints';
import type {
  BomDefinition,
  BomExplodedComponent,
  BomStandardCostResult,
  CreateBomInput,
  ManufacturingVoucher,
  CreateManufacturingVoucherInput,
  IssueMaterialsInput,
  CompleteProductionInput,
  ManufacturingRegisterRow,
} from '@/types';

// ─── BoM ──────────────────────────────────────────────────────────────────────

export async function listBoms(
  wsId: string,
  firmId: string,
  filters?: { itemId?: string; isActive?: boolean; isDefault?: boolean },
): Promise<BomDefinition[]> {
  const http = await serverHttp();
  const url = manufacturing.bom.list(wsId, firmId);
  const query = new URLSearchParams();
  if (filters?.itemId) query.set('itemId', filters.itemId);
  if (filters?.isActive !== undefined) query.set('isActive', String(filters.isActive));
  if (filters?.isDefault !== undefined) query.set('isDefault', String(filters.isDefault));
  const qs = query.toString();
  return http.get(qs ? `${url}?${qs}` : url).then(unwrapServer<BomDefinition[]>);
}

export async function getBom(
  wsId: string,
  firmId: string,
  bomId: string,
): Promise<BomDefinition> {
  const http = await serverHttp();
  return http.get(manufacturing.bom.detail(wsId, firmId, bomId)).then(unwrapServer<BomDefinition>);
}

export async function createBom(
  wsId: string,
  firmId: string,
  input: CreateBomInput,
): Promise<BomDefinition> {
  const http = await serverHttp();
  return http.post(manufacturing.bom.create(wsId, firmId), input).then(unwrapServer<BomDefinition>);
}

export async function updateBom(
  wsId: string,
  firmId: string,
  bomId: string,
  input: Partial<CreateBomInput>,
): Promise<BomDefinition> {
  const http = await serverHttp();
  return http.put(manufacturing.bom.update(wsId, firmId, bomId), input).then(unwrapServer<BomDefinition>);
}

export async function deleteBom(
  wsId: string,
  firmId: string,
  bomId: string,
): Promise<void> {
  const http = await serverHttp();
  await http.delete(manufacturing.bom.remove(wsId, firmId, bomId));
}

export async function explodeBom(
  wsId: string,
  firmId: string,
  bomId: string,
  requestedQty?: number,
): Promise<BomExplodedComponent[]> {
  const http = await serverHttp();
  const url =
    manufacturing.bom.explosion(wsId, firmId, bomId) +
    (requestedQty !== undefined ? `?requestedQty=${requestedQty}` : '');
  return http.get(url).then(unwrapServer<BomExplodedComponent[]>);
}

export async function getBomStandardCost(
  wsId: string,
  firmId: string,
  bomId: string,
  persist = false,
): Promise<BomStandardCostResult> {
  const http = await serverHttp();
  const url =
    manufacturing.bom.stdCost(wsId, firmId, bomId) + (persist ? '?persist=true' : '');
  return http.get(url).then(unwrapServer<BomStandardCostResult>);
}

// ─── Manufacturing Vouchers ───────────────────────────────────────────────────

export async function listManufacturingVouchers(
  wsId: string,
  firmId: string,
  filters?: { status?: string; itemId?: string; from?: string; to?: string },
): Promise<ManufacturingVoucher[]> {
  const http = await serverHttp();
  const url = manufacturing.vouchers.list(wsId, firmId);
  const query = new URLSearchParams();
  if (filters?.status) query.set('status', filters.status);
  if (filters?.itemId) query.set('itemId', filters.itemId);
  if (filters?.from) query.set('from', filters.from);
  if (filters?.to) query.set('to', filters.to);
  const qs = query.toString();
  return http.get(qs ? `${url}?${qs}` : url).then(unwrapServer<ManufacturingVoucher[]>);
}

export async function getManufacturingVoucher(
  wsId: string,
  firmId: string,
  mvId: string,
): Promise<ManufacturingVoucher> {
  const http = await serverHttp();
  return http
    .get(manufacturing.vouchers.detail(wsId, firmId, mvId))
    .then(unwrapServer<ManufacturingVoucher>);
}

export async function createManufacturingVoucher(
  wsId: string,
  firmId: string,
  input: CreateManufacturingVoucherInput,
): Promise<ManufacturingVoucher> {
  const http = await serverHttp();
  return http
    .post(manufacturing.vouchers.create(wsId, firmId), input)
    .then(unwrapServer<ManufacturingVoucher>);
}

export async function updateManufacturingVoucherDraft(
  wsId: string,
  firmId: string,
  mvId: string,
  input: Partial<CreateManufacturingVoucherInput>,
): Promise<ManufacturingVoucher> {
  const http = await serverHttp();
  return http
    .patch(manufacturing.vouchers.update(wsId, firmId, mvId), input)
    .then(unwrapServer<ManufacturingVoucher>);
}

export async function issueManufacturingVoucher(
  wsId: string,
  firmId: string,
  mvId: string,
  input: IssueMaterialsInput,
): Promise<ManufacturingVoucher> {
  const http = await serverHttp();
  return http
    .post(manufacturing.vouchers.issue(wsId, firmId, mvId), input)
    .then(unwrapServer<ManufacturingVoucher>);
}

export async function completeManufacturingVoucher(
  wsId: string,
  firmId: string,
  mvId: string,
  input: CompleteProductionInput,
): Promise<ManufacturingVoucher> {
  const http = await serverHttp();
  return http
    .post(manufacturing.vouchers.complete(wsId, firmId, mvId), input)
    .then(unwrapServer<ManufacturingVoucher>);
}

export async function cancelManufacturingVoucher(
  wsId: string,
  firmId: string,
  mvId: string,
): Promise<ManufacturingVoucher> {
  const http = await serverHttp();
  return http
    .post(manufacturing.vouchers.cancel(wsId, firmId, mvId), {})
    .then(unwrapServer<ManufacturingVoucher>);
}

export async function getManufacturingRegister(
  wsId: string,
  firmId: string,
  filters?: { status?: string; from?: string; to?: string },
): Promise<{
  items: ManufacturingRegisterRow[];
  totals: {
    count: number;
    completedCount: number;
    totalInputPaise: number;
    totalVariancePaise: number;
  };
}> {
  const http = await serverHttp();
  const url = manufacturing.vouchers.register(wsId, firmId);
  const query = new URLSearchParams();
  if (filters?.status) query.set('status', filters.status);
  if (filters?.from) query.set('from', filters.from);
  if (filters?.to) query.set('to', filters.to);
  const qs = query.toString();
  return http
    .get(qs ? `${url}?${qs}` : url)
    .then(
      unwrapServer<{
        items: ManufacturingRegisterRow[];
        totals: {
          count: number;
          completedCount: number;
          totalInputPaise: number;
          totalVariancePaise: number;
        };
      }>,
    );
}
