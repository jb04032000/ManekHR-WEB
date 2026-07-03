import http, { unwrap } from '../client';
import { inventory } from '../endpoints';
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
export const inventoryGodownsApi = {
  list: (wsId: string, firmId: string) =>
    http.get(inventory.godowns.list(wsId, firmId)).then(unwrap<Godown[]>),
  create: (wsId: string, firmId: string, data: Partial<Godown>) =>
    http.post(inventory.godowns.create(wsId, firmId), data).then(unwrap<Godown>),
  detail: (wsId: string, firmId: string, gId: string) =>
    http.get(inventory.godowns.detail(wsId, firmId, gId)).then(unwrap<Godown>),
  update: (wsId: string, firmId: string, gId: string, data: Partial<Godown>) =>
    http.patch(inventory.godowns.update(wsId, firmId, gId), data).then(unwrap<Godown>),
  remove: (wsId: string, firmId: string, gId: string) =>
    http.delete(inventory.godowns.remove(wsId, firmId, gId)).then(unwrap<{ message: string }>),
};

// ---- Stock Summary ----
// list returns the FULL { kpi, rows } envelope - do NOT extract .rows client-side
export const inventoryStockSummaryApi = {
  list: (
    wsId: string,
    firmId: string,
    params?: Record<string, unknown>,
  ): Promise<StockSummaryResponse> =>
    http
      .get(inventory.stockSummary.list(wsId, firmId), { params })
      .then(unwrap<StockSummaryResponse>),
  forItem: (wsId: string, firmId: string, itemId: string): Promise<PerGodownBalance[]> =>
    http.get(inventory.stockSummary.forItem(wsId, firmId, itemId)).then(unwrap<PerGodownBalance[]>),
};

// ---- Stock Movements ----
export const inventoryMovementsApi = {
  list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
    http.get(inventory.movements.list(wsId, firmId), { params }).then(unwrap<StockMovement[]>),
  detail: (wsId: string, firmId: string, id: string) =>
    http.get(inventory.movements.detail(wsId, firmId, id)).then(unwrap<StockMovement>),
};

// ---- Lots ----
export const inventoryLotsApi = {
  list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
    http.get(inventory.lots.list(wsId, firmId), { params }).then(unwrap<Lot[]>),
  create: (wsId: string, firmId: string, data: Partial<Lot>) =>
    http.post(inventory.lots.create(wsId, firmId), data).then(unwrap<Lot>),
  detail: (wsId: string, firmId: string, id: string) =>
    http.get(inventory.lots.detail(wsId, firmId, id)).then(unwrap<Lot>),
  update: (wsId: string, firmId: string, id: string, data: Partial<Lot>) =>
    http.patch(inventory.lots.update(wsId, firmId, id), data).then(unwrap<Lot>),
  remove: (wsId: string, firmId: string, id: string) =>
    http.delete(inventory.lots.remove(wsId, firmId, id)).then(unwrap<{ message: string }>),
  movements: (wsId: string, firmId: string, id: string) =>
    http.get(inventory.lots.movements(wsId, firmId, id)).then(unwrap<StockMovement[]>),
};

// ---- Batches ----
export const inventoryBatchesApi = {
  list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
    http.get(inventory.batches.list(wsId, firmId), { params }).then(unwrap<Batch[]>),
  create: (wsId: string, firmId: string, data: Partial<Batch>) =>
    http.post(inventory.batches.create(wsId, firmId), data).then(unwrap<Batch>),
  detail: (wsId: string, firmId: string, id: string) =>
    http.get(inventory.batches.detail(wsId, firmId, id)).then(unwrap<Batch>),
  update: (wsId: string, firmId: string, id: string, data: Partial<Batch>) =>
    http.patch(inventory.batches.update(wsId, firmId, id), data).then(unwrap<Batch>),
  remove: (wsId: string, firmId: string, id: string) =>
    http.delete(inventory.batches.remove(wsId, firmId, id)).then(unwrap<{ message: string }>),
};

// ---- Serials ----
export const inventorySerialssApi = {
  list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
    http.get(inventory.serials.list(wsId, firmId), { params }).then(unwrap<Serial[]>),
  detail: (wsId: string, firmId: string, serialNo: string) =>
    http.get(inventory.serials.detail(wsId, firmId, serialNo)).then(unwrap<Serial>),
  update: (wsId: string, firmId: string, serialNo: string, data: Partial<Serial>) =>
    http.patch(inventory.serials.update(wsId, firmId, serialNo), data).then(unwrap<Serial>),
};

// ---- Transfers ----
export const inventoryTransfersApi = {
  list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
    http.get(inventory.transfers.list(wsId, firmId), { params }).then(unwrap<StockTransfer[]>),
  create: (wsId: string, firmId: string, data: Partial<StockTransfer>) =>
    http.post(inventory.transfers.create(wsId, firmId), data).then(unwrap<StockTransfer>),
  detail: (wsId: string, firmId: string, id: string) =>
    http.get(inventory.transfers.detail(wsId, firmId, id)).then(unwrap<StockTransfer>),
  update: (wsId: string, firmId: string, id: string, data: Partial<StockTransfer>) =>
    http.patch(inventory.transfers.update(wsId, firmId, id), data).then(unwrap<StockTransfer>),
  post: (wsId: string, firmId: string, id: string) =>
    http.post(inventory.transfers.post(wsId, firmId, id)).then(unwrap<StockTransfer>),
  remove: (wsId: string, firmId: string, id: string) =>
    http.delete(inventory.transfers.remove(wsId, firmId, id)).then(unwrap<{ message: string }>),
};

// ---- Wastage ----
export const inventoryWastageApi = {
  list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
    http.get(inventory.wastage.list(wsId, firmId), { params }).then(unwrap<WastageEntry[]>),
  create: (wsId: string, firmId: string, data: Partial<WastageEntry>) =>
    http.post(inventory.wastage.create(wsId, firmId), data).then(unwrap<WastageEntry>),
  detail: (wsId: string, firmId: string, id: string) =>
    http.get(inventory.wastage.detail(wsId, firmId, id)).then(unwrap<WastageEntry>),
  update: (wsId: string, firmId: string, id: string, data: Partial<WastageEntry>) =>
    http.patch(inventory.wastage.update(wsId, firmId, id), data).then(unwrap<WastageEntry>),
  post: (wsId: string, firmId: string, id: string) =>
    http.post(inventory.wastage.post(wsId, firmId, id)).then(unwrap<WastageEntry>),
  remove: (wsId: string, firmId: string, id: string) =>
    http.delete(inventory.wastage.remove(wsId, firmId, id)).then(unwrap<{ message: string }>),
};

// ---- Samples & Consignment ----
export const inventorySamplesApi = {
  list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
    http.get(inventory.samples.list(wsId, firmId), { params }).then(unwrap<SampleVoucher[]>),
  create: (wsId: string, firmId: string, data: Partial<SampleVoucher>) =>
    http.post(inventory.samples.create(wsId, firmId), data).then(unwrap<SampleVoucher>),
  detail: (wsId: string, firmId: string, id: string) =>
    http.get(inventory.samples.detail(wsId, firmId, id)).then(unwrap<SampleVoucher>),
  update: (wsId: string, firmId: string, id: string, data: Partial<SampleVoucher>) =>
    http.patch(inventory.samples.update(wsId, firmId, id), data).then(unwrap<SampleVoucher>),
  post: (wsId: string, firmId: string, id: string) =>
    http.post(inventory.samples.post(wsId, firmId, id)).then(unwrap<SampleVoucher>),
  accept: (wsId: string, firmId: string, id: string, data: Record<string, unknown>) =>
    http.post(inventory.samples.accept(wsId, firmId, id), data).then(unwrap<SampleVoucher>),
  return: (wsId: string, firmId: string, id: string, data: Record<string, unknown>) =>
    http.post(inventory.samples.return(wsId, firmId, id), data).then(unwrap<SampleVoucher>),
  remove: (wsId: string, firmId: string, id: string) =>
    http.delete(inventory.samples.remove(wsId, firmId, id)).then(unwrap<{ message: string }>),
};

// ---- Cess Rules ----
export const inventoryCessRulesApi = {
  list: () => http.get(inventory.cessRules.list()).then(unwrap<CessRule[]>),
  upsert: (data: Partial<CessRule>) =>
    http.post(inventory.cessRules.upsert(), data).then(unwrap<CessRule>),
  deactivate: (id: string) =>
    http.delete(inventory.cessRules.deactivate(id)).then(unwrap<{ message: string }>),
};
