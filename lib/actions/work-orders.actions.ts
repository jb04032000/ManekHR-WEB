'use server';

/**
 * Shop Floor - Work Order server actions.
 *
 * What: full CRUD for work orders, their process steps (DAG), and manual
 * step progress entries. Every mutation returns the FULL updated WorkOrder
 * so the client replaces it in state atomically (no partial-merge drift).
 *
 * Links: backend WorkOrdersController (crewroster-backend
 * src/modules/machines/work-orders). Consumed exclusively by
 * app/dashboard/machines/shop-floor + components/machines/shop-floor/*.
 *
 * Watch: backend error codes (WORK_ORDER_STEP_CYCLE, …) survive as
 * Error.message via run() - same pattern as machines.actions.ts.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  WorkOrder,
  CreateWorkOrderPayload,
  UpdateWorkOrderPayload,
  CreateWorkOrderStepPayload,
  UpdateWorkOrderStepPayload,
  CreateWorkOrderStepEntryPayload,
  WorkOrderStatus,
  ShopFloorConfig,
  UpsertShopFloorConfigPayload,
} from '@/types';

const WO = ApiEndpoints.workOrders;

/** BE serializes lean docs with raw `_id` (no `id` virtual - downtime
 *  convention). Normalize order/steps/entries so the client always reads
 *  `.id`; `_id` is kept for parity with other module types. */
function normalizeOrder(raw: WorkOrder): WorkOrder {
  return {
    ...raw,
    id: raw.id ?? raw._id ?? '',
    steps: (raw.steps ?? []).map((s) => ({
      ...s,
      id: s.id ?? s._id ?? '',
      deps: s.deps ?? [],
      machineIds: s.machineIds ?? [],
      entries: (s.entries ?? []).map((e) => ({ ...e, id: e.id ?? e._id ?? '' })),
    })),
  };
}

/** Mirror of machines.actions.ts run() - extracts the backend error message
 *  before the Server-Action serialization boundary strips axios details. */
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

/** BE serializes configs with raw `_id` - normalize to `.id`. */
function normalizeConfig(raw: ShopFloorConfig): ShopFloorConfig {
  return { ...raw, id: raw.id ?? raw._id ?? '' };
}

// ── Shop Floor setup config (floors per location + people links) ───────────
// Machine→floor assignment is NOT here - the Setup wizard PATCHes
// Machine.floorTag via machines.actions updateMachine (single source).

export async function listShopFloorConfigs(wsId: string): Promise<ShopFloorConfig[]> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .get(WO.configList(wsId))
      .then(unwrapServer<ShopFloorConfig[]>)
      .then((list) => list.map(normalizeConfig));
  });
}

export async function upsertShopFloorConfig(
  wsId: string,
  payload: UpsertShopFloorConfigPayload,
): Promise<ShopFloorConfig> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .put(WO.configUpsert(wsId), payload)
      .then(unwrapServer<ShopFloorConfig>)
      .then(normalizeConfig);
  });
}

export async function listWorkOrders(
  wsId: string,
  params?: { status?: WorkOrderStatus },
): Promise<WorkOrder[]> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .get(WO.list(wsId), { params })
      .then(unwrapServer<WorkOrder[]>)
      .then((list) => list.map(normalizeOrder));
  });
}

export async function createWorkOrder(
  wsId: string,
  payload: CreateWorkOrderPayload,
): Promise<WorkOrder> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .post(WO.create(wsId), payload)
      .then(unwrapServer<WorkOrder>)
      .then(normalizeOrder);
  });
}

export async function updateWorkOrder(
  wsId: string,
  orderId: string,
  payload: UpdateWorkOrderPayload,
): Promise<WorkOrder> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .patch(WO.update(wsId, orderId), payload)
      .then(unwrapServer<WorkOrder>)
      .then(normalizeOrder);
  });
}

export async function deleteWorkOrder(wsId: string, orderId: string): Promise<{ deleted: true }> {
  return run(async () => {
    const http = await serverHttp();
    return http.delete(WO.delete(wsId, orderId)).then(unwrapServer<{ deleted: true }>);
  });
}

export async function addWorkOrderStep(
  wsId: string,
  orderId: string,
  payload: CreateWorkOrderStepPayload,
): Promise<WorkOrder> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .post(WO.addStep(wsId, orderId), payload)
      .then(unwrapServer<WorkOrder>)
      .then(normalizeOrder);
  });
}

export async function updateWorkOrderStep(
  wsId: string,
  orderId: string,
  stepId: string,
  payload: UpdateWorkOrderStepPayload,
): Promise<WorkOrder> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .patch(WO.updateStep(wsId, orderId, stepId), payload)
      .then(unwrapServer<WorkOrder>)
      .then(normalizeOrder);
  });
}

export async function deleteWorkOrderStep(
  wsId: string,
  orderId: string,
  stepId: string,
): Promise<WorkOrder> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .delete(WO.deleteStep(wsId, orderId, stepId))
      .then(unwrapServer<WorkOrder>)
      .then(normalizeOrder);
  });
}

export async function addWorkOrderStepEntry(
  wsId: string,
  orderId: string,
  stepId: string,
  payload: CreateWorkOrderStepEntryPayload,
): Promise<WorkOrder> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .post(WO.addEntry(wsId, orderId, stepId), payload)
      .then(unwrapServer<WorkOrder>)
      .then(normalizeOrder);
  });
}

export async function deleteWorkOrderStepEntry(
  wsId: string,
  orderId: string,
  stepId: string,
  entryId: string,
): Promise<WorkOrder> {
  return run(async () => {
    const http = await serverHttp();
    return http
      .delete(WO.deleteEntry(wsId, orderId, stepId, entryId))
      .then(unwrapServer<WorkOrder>)
      .then(normalizeOrder);
  });
}
