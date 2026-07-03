'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { inventory } from '@/lib/api/endpoints';
import type {
  Godown,
  Lot,
  Batch,
  Serial,
  StockTransfer,
  WastageEntry,
  SampleVoucher,
  StockMovement,
  CessRule,
  StockSummaryResponse,
  PerGodownBalance,
} from '@/types';

// ---- Godowns ----

export async function listGodowns(wsId: string, firmId: string): Promise<Godown[]> {
  const http = await serverHttp();
  return http.get(inventory.godowns.list(wsId, firmId)).then(unwrapServer<Godown[]>);
}

export async function createGodown(
  wsId: string,
  firmId: string,
  data: Partial<Godown>,
): Promise<Godown> {
  const http = await serverHttp();
  return http.post(inventory.godowns.create(wsId, firmId), data).then(unwrapServer<Godown>);
}

export async function getGodown(wsId: string, firmId: string, gId: string): Promise<Godown> {
  const http = await serverHttp();
  return http.get(inventory.godowns.detail(wsId, firmId, gId)).then(unwrapServer<Godown>);
}

export async function updateGodown(
  wsId: string,
  firmId: string,
  gId: string,
  data: Partial<Godown>,
): Promise<Godown> {
  const http = await serverHttp();
  return http.patch(inventory.godowns.update(wsId, firmId, gId), data).then(unwrapServer<Godown>);
}

export async function deleteGodown(
  wsId: string,
  firmId: string,
  gId: string,
): Promise<{ message: string }> {
  const http = await serverHttp();
  return http
    .delete(inventory.godowns.remove(wsId, firmId, gId))
    .then(unwrapServer<{ message: string }>);
}

// ---- Stock Summary (CRITICAL: full envelope + per-item lazy fetch) ----

export interface StockSummaryFilters {
  godownId?: string;
  category?: string;
  lowStockOnly?: boolean;
  trackBatchOnly?: boolean;
  q?: string;
}

/**
 * Returns the FULL envelope { kpi, rows } as defined by the backend.
 * Callers (e.g. StockSummaryPage in 09-10) MUST destructure both fields:
 *   const { kpi, rows } = await listStockSummary(wsId, firmId, filters);
 * Do NOT assign the result directly to a row state array.
 */
export async function listStockSummary(
  wsId: string,
  firmId: string,
  filters: StockSummaryFilters = {},
): Promise<StockSummaryResponse> {
  const http = await serverHttp();
  const res = await http.get(inventory.stockSummary.list(wsId, firmId), { params: filters });
  return unwrapServer<StockSummaryResponse>(res);
}

/**
 * Lazy-fetches per-godown breakdown for a single item - used by the expandable
 * row in StockSummaryTable. The list endpoint does NOT return perGodownBalances;
 * the expandable row consumer must call this on expand and cache the result.
 */
export async function getStockSummaryForItem(
  wsId: string,
  firmId: string,
  itemId: string,
): Promise<PerGodownBalance[]> {
  const http = await serverHttp();
  const res = await http.get(inventory.stockSummary.forItem(wsId, firmId, itemId));
  return unwrapServer<PerGodownBalance[]>(res);
}

/**
 * Returns available qty for a specific item + godown combination.
 * Used by AvailabilityBadge to show real-time stock level in line-item forms.
 * Calls the per-item detail endpoint and sums qty for the requested godown.
 */
export async function getStockBalance(
  wsId: string,
  firmId: string,
  itemId: string,
  godownId: string,
): Promise<number> {
  const perGodown = await getStockSummaryForItem(wsId, firmId, itemId);
  const match = perGodown.find((b) => b.godownId === godownId && b.bucketType === 'stock');
  return match?.qty ?? 0;
}

// ---- Stock Movements ----

export async function listStockMovements(
  wsId: string,
  firmId: string,
  params?: Record<string, unknown>,
): Promise<StockMovement[]> {
  const http = await serverHttp();
  return http
    .get(inventory.movements.list(wsId, firmId), { params })
    .then(unwrapServer<StockMovement[]>);
}

export async function getStockMovement(
  wsId: string,
  firmId: string,
  id: string,
): Promise<StockMovement> {
  const http = await serverHttp();
  return http.get(inventory.movements.detail(wsId, firmId, id)).then(unwrapServer<StockMovement>);
}

// ---- Lots ----

export async function listLots(
  wsId: string,
  firmId: string,
  params?: Record<string, unknown>,
): Promise<Lot[]> {
  const http = await serverHttp();
  return http.get(inventory.lots.list(wsId, firmId), { params }).then(unwrapServer<Lot[]>);
}

export async function createLot(wsId: string, firmId: string, data: Partial<Lot>): Promise<Lot> {
  const http = await serverHttp();
  return http.post(inventory.lots.create(wsId, firmId), data).then(unwrapServer<Lot>);
}

export async function getLot(wsId: string, firmId: string, id: string): Promise<Lot> {
  const http = await serverHttp();
  return http.get(inventory.lots.detail(wsId, firmId, id)).then(unwrapServer<Lot>);
}

export async function updateLot(
  wsId: string,
  firmId: string,
  id: string,
  data: Partial<Lot>,
): Promise<Lot> {
  const http = await serverHttp();
  return http.patch(inventory.lots.update(wsId, firmId, id), data).then(unwrapServer<Lot>);
}

export async function deleteLot(
  wsId: string,
  firmId: string,
  id: string,
): Promise<{ message: string }> {
  const http = await serverHttp();
  return http
    .delete(inventory.lots.remove(wsId, firmId, id))
    .then(unwrapServer<{ message: string }>);
}

export async function getLotMovements(
  wsId: string,
  firmId: string,
  id: string,
): Promise<StockMovement[]> {
  const http = await serverHttp();
  return http.get(inventory.lots.movements(wsId, firmId, id)).then(unwrapServer<StockMovement[]>);
}

// ---- Batches ----

export async function listBatches(
  wsId: string,
  firmId: string,
  params?: Record<string, unknown>,
): Promise<Batch[]> {
  const http = await serverHttp();
  return http.get(inventory.batches.list(wsId, firmId), { params }).then(unwrapServer<Batch[]>);
}

export async function createBatch(
  wsId: string,
  firmId: string,
  data: Partial<Batch>,
): Promise<Batch> {
  const http = await serverHttp();
  return http.post(inventory.batches.create(wsId, firmId), data).then(unwrapServer<Batch>);
}

export async function getBatch(wsId: string, firmId: string, id: string): Promise<Batch> {
  const http = await serverHttp();
  return http.get(inventory.batches.detail(wsId, firmId, id)).then(unwrapServer<Batch>);
}

export async function updateBatch(
  wsId: string,
  firmId: string,
  id: string,
  data: Partial<Batch>,
): Promise<Batch> {
  const http = await serverHttp();
  return http.patch(inventory.batches.update(wsId, firmId, id), data).then(unwrapServer<Batch>);
}

export async function deleteBatch(
  wsId: string,
  firmId: string,
  id: string,
): Promise<{ message: string }> {
  const http = await serverHttp();
  return http
    .delete(inventory.batches.remove(wsId, firmId, id))
    .then(unwrapServer<{ message: string }>);
}

// ---- Serials ----

export async function listSerials(
  wsId: string,
  firmId: string,
  params?: Record<string, unknown>,
): Promise<Serial[]> {
  const http = await serverHttp();
  return http.get(inventory.serials.list(wsId, firmId), { params }).then(unwrapServer<Serial[]>);
}

export async function getSerial(wsId: string, firmId: string, serialNo: string): Promise<Serial> {
  const http = await serverHttp();
  return http.get(inventory.serials.detail(wsId, firmId, serialNo)).then(unwrapServer<Serial>);
}

export async function updateSerial(
  wsId: string,
  firmId: string,
  serialNo: string,
  data: Partial<Serial>,
): Promise<Serial> {
  const http = await serverHttp();
  return http
    .patch(inventory.serials.update(wsId, firmId, serialNo), data)
    .then(unwrapServer<Serial>);
}

// ---- Stock Transfers ----

export async function listStockTransfers(
  wsId: string,
  firmId: string,
  params?: Record<string, unknown>,
): Promise<StockTransfer[]> {
  const http = await serverHttp();
  return http
    .get(inventory.transfers.list(wsId, firmId), { params })
    .then(unwrapServer<StockTransfer[]>);
}

export async function createStockTransfer(
  wsId: string,
  firmId: string,
  data: Partial<StockTransfer>,
): Promise<StockTransfer> {
  const http = await serverHttp();
  return http
    .post(inventory.transfers.create(wsId, firmId), data)
    .then(unwrapServer<StockTransfer>);
}

export async function getStockTransfer(
  wsId: string,
  firmId: string,
  id: string,
): Promise<StockTransfer> {
  const http = await serverHttp();
  return http.get(inventory.transfers.detail(wsId, firmId, id)).then(unwrapServer<StockTransfer>);
}

export async function updateStockTransfer(
  wsId: string,
  firmId: string,
  id: string,
  data: Partial<StockTransfer>,
): Promise<StockTransfer> {
  const http = await serverHttp();
  return http
    .patch(inventory.transfers.update(wsId, firmId, id), data)
    .then(unwrapServer<StockTransfer>);
}

export async function postStockTransfer(
  wsId: string,
  firmId: string,
  id: string,
): Promise<StockTransfer> {
  const http = await serverHttp();
  return http.post(inventory.transfers.post(wsId, firmId, id)).then(unwrapServer<StockTransfer>);
}

export async function deleteStockTransfer(
  wsId: string,
  firmId: string,
  id: string,
): Promise<{ message: string }> {
  const http = await serverHttp();
  return http
    .delete(inventory.transfers.remove(wsId, firmId, id))
    .then(unwrapServer<{ message: string }>);
}

// ---- Wastage Entries ----

export async function listWastageEntries(
  wsId: string,
  firmId: string,
  params?: Record<string, unknown>,
): Promise<WastageEntry[]> {
  const http = await serverHttp();
  return http
    .get(inventory.wastage.list(wsId, firmId), { params })
    .then(unwrapServer<WastageEntry[]>);
}

export async function createWastageEntry(
  wsId: string,
  firmId: string,
  data: Partial<WastageEntry>,
): Promise<WastageEntry> {
  const http = await serverHttp();
  return http.post(inventory.wastage.create(wsId, firmId), data).then(unwrapServer<WastageEntry>);
}

export async function getWastageEntry(
  wsId: string,
  firmId: string,
  id: string,
): Promise<WastageEntry> {
  const http = await serverHttp();
  return http.get(inventory.wastage.detail(wsId, firmId, id)).then(unwrapServer<WastageEntry>);
}

export async function updateWastageEntry(
  wsId: string,
  firmId: string,
  id: string,
  data: Partial<WastageEntry>,
): Promise<WastageEntry> {
  const http = await serverHttp();
  return http
    .patch(inventory.wastage.update(wsId, firmId, id), data)
    .then(unwrapServer<WastageEntry>);
}

export async function postWastageEntry(
  wsId: string,
  firmId: string,
  id: string,
): Promise<WastageEntry> {
  const http = await serverHttp();
  return http.post(inventory.wastage.post(wsId, firmId, id)).then(unwrapServer<WastageEntry>);
}

export async function deleteWastageEntry(
  wsId: string,
  firmId: string,
  id: string,
): Promise<{ message: string }> {
  const http = await serverHttp();
  return http
    .delete(inventory.wastage.remove(wsId, firmId, id))
    .then(unwrapServer<{ message: string }>);
}

// ---- Sample Vouchers ----

export async function listSampleVouchers(
  wsId: string,
  firmId: string,
  params?: Record<string, unknown>,
): Promise<SampleVoucher[]> {
  const http = await serverHttp();
  return http
    .get(inventory.samples.list(wsId, firmId), { params })
    .then(unwrapServer<SampleVoucher[]>);
}

export async function createSampleVoucher(
  wsId: string,
  firmId: string,
  data: Partial<SampleVoucher>,
): Promise<SampleVoucher> {
  const http = await serverHttp();
  return http.post(inventory.samples.create(wsId, firmId), data).then(unwrapServer<SampleVoucher>);
}

export async function getSampleVoucher(
  wsId: string,
  firmId: string,
  id: string,
): Promise<SampleVoucher> {
  const http = await serverHttp();
  return http.get(inventory.samples.detail(wsId, firmId, id)).then(unwrapServer<SampleVoucher>);
}

export async function updateSampleVoucher(
  wsId: string,
  firmId: string,
  id: string,
  data: Partial<SampleVoucher>,
): Promise<SampleVoucher> {
  const http = await serverHttp();
  return http
    .patch(inventory.samples.update(wsId, firmId, id), data)
    .then(unwrapServer<SampleVoucher>);
}

export async function postSampleVoucher(
  wsId: string,
  firmId: string,
  id: string,
): Promise<SampleVoucher> {
  const http = await serverHttp();
  return http.post(inventory.samples.post(wsId, firmId, id)).then(unwrapServer<SampleVoucher>);
}

export async function acceptSampleVoucher(
  wsId: string,
  firmId: string,
  id: string,
  data: Record<string, unknown>,
): Promise<SampleVoucher> {
  const http = await serverHttp();
  return http
    .post(inventory.samples.accept(wsId, firmId, id), data)
    .then(unwrapServer<SampleVoucher>);
}

export async function returnSampleVoucher(
  wsId: string,
  firmId: string,
  id: string,
  data: Record<string, unknown>,
): Promise<SampleVoucher> {
  const http = await serverHttp();
  return http
    .post(inventory.samples.return(wsId, firmId, id), data)
    .then(unwrapServer<SampleVoucher>);
}

export async function deleteSampleVoucher(
  wsId: string,
  firmId: string,
  id: string,
): Promise<{ message: string }> {
  const http = await serverHttp();
  return http
    .delete(inventory.samples.remove(wsId, firmId, id))
    .then(unwrapServer<{ message: string }>);
}

// ---- Cess Rules ----

export async function listCessRules(): Promise<CessRule[]> {
  const http = await serverHttp();
  return http.get(inventory.cessRules.list()).then(unwrapServer<CessRule[]>);
}

export async function upsertCessRule(data: Partial<CessRule>): Promise<CessRule> {
  const http = await serverHttp();
  return http.post(inventory.cessRules.upsert(), data).then(unwrapServer<CessRule>);
}

export async function deactivateCessRule(id: string): Promise<{ message: string }> {
  const http = await serverHttp();
  return http.delete(inventory.cessRules.deactivate(id)).then(unwrapServer<{ message: string }>);
}

// ---- Item Label PDF ----

/**
 * Fetches the item label as a PDF Blob from the backend.
 * The response is returned as arraybuffer and converted to a Blob for
 * client-side download or preview. Caller must handle the Blob appropriately.
 */
export async function getItemLabelPdf(
  wsId: string,
  firmId: string,
  itemId: string,
  opts?: { copies?: number; format?: string; labelSize?: string; lotId?: string },
): Promise<Blob> {
  const http = await serverHttp();
  const res = await http.get(inventory.itemLabel(wsId, firmId, itemId), {
    params: opts,
    responseType: 'arraybuffer',
  });
  return new Blob([res.data as ArrayBuffer], { type: 'application/pdf' });
}
