import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  FixedAsset,
  AssetCategory,
  DepreciationRun,
  DepreciationPreviewLine,
  DisposalPreview,
} from '@/types';

const E = ApiEndpoints.finance.fixedAssets;

// ===== Asset Categories =====

export async function listAssetCategoriesClient(wsId: string, firmId: string) {
  const res = await http.get(E.categories.list(wsId, firmId));
  return unwrap<AssetCategory[]>(res);
}

export async function getAssetCategoryClient(wsId: string, firmId: string, id: string) {
  const res = await http.get(E.categories.get(wsId, firmId, id));
  return unwrap<AssetCategory>(res);
}

export async function createAssetCategoryClient(
  wsId: string,
  firmId: string,
  payload: Partial<AssetCategory>,
) {
  const res = await http.post(E.categories.create(wsId, firmId), payload);
  return unwrap<AssetCategory>(res);
}

export async function updateAssetCategoryClient(
  wsId: string,
  firmId: string,
  id: string,
  payload: Partial<AssetCategory>,
) {
  const res = await http.patch(E.categories.update(wsId, firmId, id), payload);
  return unwrap<AssetCategory>(res);
}

export async function deleteAssetCategoryClient(wsId: string, firmId: string, id: string) {
  const res = await http.delete(E.categories.delete(wsId, firmId, id));
  return unwrap<{ ok: boolean }>(res);
}

export async function seedDefaultCategoriesClient(wsId: string, firmId: string) {
  const res = await http.post(E.categories.seedDefaults(wsId, firmId), {});
  return unwrap<{ seeded: number }>(res);
}

// ===== Fixed Assets =====

export async function listFixedAssetsClient(
  wsId: string,
  firmId: string,
  params?: {
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
  const res = await http.get(E.assets.list(wsId, firmId), { params });
  return unwrap<{ items: FixedAsset[]; total: number; page: number; limit: number }>(res);
}

export async function getFixedAssetClient(wsId: string, firmId: string, id: string) {
  const res = await http.get(E.assets.get(wsId, firmId, id));
  return unwrap<FixedAsset>(res);
}

export async function createFixedAssetClient(
  wsId: string,
  firmId: string,
  payload: Partial<FixedAsset>,
) {
  const res = await http.post(E.assets.create(wsId, firmId), payload);
  return unwrap<FixedAsset>(res);
}

export async function updateFixedAssetClient(
  wsId: string,
  firmId: string,
  id: string,
  payload: Partial<FixedAsset>,
) {
  const res = await http.patch(E.assets.update(wsId, firmId, id), payload);
  return unwrap<FixedAsset>(res);
}

export async function deleteFixedAssetClient(wsId: string, firmId: string, id: string) {
  const res = await http.delete(E.assets.delete(wsId, firmId, id));
  return unwrap<{ ok: boolean }>(res);
}

export async function verifyFixedAssetClient(wsId: string, firmId: string, id: string) {
  const res = await http.post(E.assets.verify(wsId, firmId, id), {});
  return unwrap<FixedAsset>(res);
}

// ===== Depreciation =====

export async function listDepreciationRunsClient(
  wsId: string,
  firmId: string,
  limit = 50,
) {
  const res = await http.get(E.depreciation.listRuns(wsId, firmId), { params: { limit } });
  return unwrap<DepreciationRun[]>(res);
}

export async function getDepreciationRunClient(wsId: string, firmId: string, id: string) {
  const res = await http.get(E.depreciation.getRun(wsId, firmId, id));
  return unwrap<DepreciationRun>(res);
}

export async function previewDepreciationClient(
  wsId: string,
  firmId: string,
  runMonth: string,
) {
  const res = await http.post(E.depreciation.preview(wsId, firmId), { runMonth });
  return unwrap<DepreciationPreviewLine[]>(res);
}

// ===== Disposal =====

export async function previewDisposalClient(
  wsId: string,
  firmId: string,
  assetId: string,
  disposalDate: string,
  disposalProceedsPaise: number,
) {
  const res = await http.post(E.disposal.preview(wsId, firmId, assetId), {
    disposalDate,
    disposalProceedsPaise,
  });
  return unwrap<DisposalPreview>(res);
}
