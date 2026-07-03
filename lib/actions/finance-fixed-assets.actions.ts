'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  FixedAsset,
  AssetCategory,
  DepreciationRun,
  DepreciationPreviewLine,
  DisposalPreview,
  ItcReversalResult,
} from '@/types';

const E = ApiEndpoints.finance.fixedAssets;

// ===== Asset Categories =====

export async function listAssetCategories(wsId: string, firmId: string) {
  const http = await serverHttp();
  const res = await http.get(E.categories.list(wsId, firmId));
  return unwrapServer<AssetCategory[]>(res);
}

export async function createAssetCategory(
  wsId: string,
  firmId: string,
  payload: Partial<AssetCategory>,
) {
  const http = await serverHttp();
  const res = await http.post(E.categories.create(wsId, firmId), payload);
  return unwrapServer<AssetCategory>(res);
}

export async function updateAssetCategory(
  wsId: string,
  firmId: string,
  id: string,
  payload: Partial<AssetCategory>,
) {
  const http = await serverHttp();
  const res = await http.patch(E.categories.update(wsId, firmId, id), payload);
  return unwrapServer<AssetCategory>(res);
}

export async function deleteAssetCategory(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.delete(E.categories.delete(wsId, firmId, id));
  return unwrapServer<{ ok: boolean }>(res);
}

export async function seedDefaultCategories(wsId: string, firmId: string) {
  const http = await serverHttp();
  const res = await http.post(E.categories.seedDefaults(wsId, firmId), {});
  return unwrapServer<{ seeded: number }>(res);
}

// ===== Fixed Assets =====

export async function listFixedAssets(
  wsId: string,
  firmId: string,
  filters?: {
    page?: number;
    limit?: number;
    categoryId?: string;
    status?: string;
    financialYear?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  },
) {
  const http = await serverHttp();
  const res = await http.get(E.assets.list(wsId, firmId), { params: filters });
  return unwrapServer<{ items: FixedAsset[]; total: number; page: number; limit: number }>(res);
}

export async function createFixedAsset(wsId: string, firmId: string, payload: Partial<FixedAsset>) {
  const http = await serverHttp();
  const res = await http.post(E.assets.create(wsId, firmId), payload);
  return unwrapServer<FixedAsset>(res);
}

export async function getFixedAsset(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.get(E.assets.get(wsId, firmId, id));
  return unwrapServer<FixedAsset>(res);
}

export async function updateFixedAsset(
  wsId: string,
  firmId: string,
  id: string,
  payload: Partial<FixedAsset>,
) {
  const http = await serverHttp();
  const res = await http.patch(E.assets.update(wsId, firmId, id), payload);
  return unwrapServer<FixedAsset>(res);
}

export async function deleteFixedAsset(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.delete(E.assets.delete(wsId, firmId, id));
  return unwrapServer<{ ok: boolean }>(res);
}

export async function verifyFixedAsset(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.post(E.assets.verify(wsId, firmId, id), {});
  return unwrapServer<FixedAsset>(res);
}

export async function prefillFromPurchaseBill(
  wsId: string,
  firmId: string,
  purchaseBillId: string,
  lineNo: number,
) {
  const http = await serverHttp();
  const res = await http.post(E.assets.fromPurchaseBill(wsId, firmId), {
    purchaseBillId,
    lineNo,
  });
  return unwrapServer<Partial<FixedAsset>>(res);
}

// ===== Depreciation =====

export async function runDepreciation(
  wsId: string,
  firmId: string,
  runMonth: string,
  runType: 'monthly' | 'quarterly' | 'manual',
) {
  const http = await serverHttp();
  const res = await http.post(E.depreciation.run(wsId, firmId), { runMonth, runType });
  return unwrapServer<{
    runId: string;
    status: string;
    assetsProcessed: number;
    assetsSkipped: number;
    totalDepreciationPaise: number;
    ledgerEntryIds: string[];
    errorMessages: string[];
  }>(res);
}

export async function previewDepreciation(wsId: string, firmId: string, runMonth: string) {
  const http = await serverHttp();
  const res = await http.post(E.depreciation.preview(wsId, firmId), { runMonth });
  return unwrapServer<DepreciationPreviewLine[]>(res);
}

export async function listDepreciationRuns(wsId: string, firmId: string, limit = 50) {
  const http = await serverHttp();
  const res = await http.get(E.depreciation.listRuns(wsId, firmId), { params: { limit } });
  return unwrapServer<DepreciationRun[]>(res);
}

export async function getDepreciationRun(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.get(E.depreciation.getRun(wsId, firmId, id));
  return unwrapServer<DepreciationRun>(res);
}

// ===== Disposal =====

export async function previewDisposal(
  wsId: string,
  firmId: string,
  assetId: string,
  disposalDate: string,
  disposalProceedsPaise: number,
) {
  const http = await serverHttp();
  const res = await http.post(E.disposal.preview(wsId, firmId, assetId), {
    disposalDate,
    disposalProceedsPaise,
  });
  return unwrapServer<DisposalPreview>(res);
}

export async function disposeAsset(
  wsId: string,
  firmId: string,
  assetId: string,
  payload: {
    disposalDate: string;
    disposalProceedsPaise: number;
    cashOrBankAccountCode?: string;
    disposalType: 'sale' | 'scrap' | 'writeoff';
    narration?: string;
    acknowledgeItcReversal?: boolean;
  },
) {
  const http = await serverHttp();
  const res = await http.post(E.disposal.dispose(wsId, firmId, assetId), payload);
  return unwrapServer<{
    asset: FixedAsset;
    disposalEntry: unknown;
    itcReversal: ItcReversalResult;
  }>(res);
}

export async function transferAsset(
  wsId: string,
  firmId: string,
  assetId: string,
  payload: {
    locationId?: string;
    custodianMemberId?: string;
    narration?: string;
  },
) {
  const http = await serverHttp();
  const res = await http.post(E.disposal.transfer(wsId, firmId, assetId), payload);
  return unwrapServer<FixedAsset>(res);
}

// ===== Links =====

export async function linkMachine(
  wsId: string,
  firmId: string,
  assetId: string,
  machineId: string,
) {
  const http = await serverHttp();
  const res = await http.post(E.links.linkMachine(wsId, firmId, assetId), { machineId });
  return unwrapServer<{ asset: FixedAsset; machine: unknown }>(res);
}

export async function unlinkMachine(wsId: string, firmId: string, assetId: string) {
  const http = await serverHttp();
  const res = await http.delete(E.links.unlinkMachine(wsId, firmId, assetId));
  return unwrapServer<{ ok: boolean }>(res);
}

export async function getLinkedItcSchedule(wsId: string, firmId: string, assetId: string) {
  const http = await serverHttp();
  const res = await http.get(E.links.itcSchedule(wsId, firmId, assetId));
  return unwrapServer<unknown>(res);
}

export async function getLinkedMachine(wsId: string, firmId: string, assetId: string) {
  const http = await serverHttp();
  const res = await http.get(E.links.machine(wsId, firmId, assetId));
  return unwrapServer<unknown>(res);
}

// ===== Reports - F-05-06 =====

export async function assetRegisterReport(
  wsId: string,
  firmId: string,
  filters: { financialYear?: string; categoryId?: string; status?: string; asOfDate?: string },
) {
  const http = await serverHttp();
  const res = await http.get(E.reports.assetRegister(wsId, firmId), { params: filters });
  return unwrapServer<any>(res);
}

export async function depreciationScheduleReport(
  wsId: string,
  firmId: string,
  assetId: string,
  filters: { fromMonth?: string; toMonth?: string },
) {
  const http = await serverHttp();
  const res = await http.get(E.reports.depreciationSchedule(wsId, firmId, assetId), {
    params: filters,
  });
  return unwrapServer<any>(res);
}

export async function blockSummaryReport(wsId: string, firmId: string, financialYear: string) {
  const http = await serverHttp();
  const res = await http.get(E.reports.blockSummary(wsId, firmId), { params: { financialYear } });
  return unwrapServer<any>(res);
}

export async function additionsDisposalsReport(
  wsId: string,
  firmId: string,
  fromDate: string,
  toDate: string,
) {
  const http = await serverHttp();
  const res = await http.get(E.reports.additionsDisposals(wsId, firmId), {
    params: { fromDate, toDate },
  });
  return unwrapServer<any>(res);
}
