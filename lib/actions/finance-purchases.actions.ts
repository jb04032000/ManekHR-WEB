'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  PurchaseOrder,
  GoodsReceiptNote,
  PurchaseBill,
  PaymentOut,
  CapitalGoodsItcSchedule,
  PayablesAgingBucket,
  OcrExtractionResult,
} from '@/types';

const E = ApiEndpoints.finance;

// ===== Purchase Orders =====
export async function createPurchaseOrder(wsId: string, firmId: string, dto: any) {
  const http = await serverHttp();
  const res = await http.post(E.purchases.orders.create(wsId, firmId), dto);
  return unwrapServer<PurchaseOrder>(res);
}

export async function listPurchaseOrders(wsId: string, firmId: string, query?: any) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.orders.list(wsId, firmId), { params: query });
  return unwrapServer<PurchaseOrder[]>(res);
}

export async function getPurchaseOrder(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.orders.get(wsId, firmId, id));
  return unwrapServer<PurchaseOrder>(res);
}

export async function confirmPurchaseOrder(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.post(E.purchases.orders.confirm(wsId, firmId, id), {});
  return unwrapServer<PurchaseOrder>(res);
}

export async function cancelPurchaseOrder(wsId: string, firmId: string, id: string, reason?: string) {
  const http = await serverHttp();
  const res = await http.post(E.purchases.orders.cancel(wsId, firmId, id), { reason });
  return unwrapServer<PurchaseOrder>(res);
}

// ===== GRN =====
export async function createGrn(wsId: string, firmId: string, dto: any) {
  const http = await serverHttp();
  const res = await http.post(E.purchases.grn.create(wsId, firmId), dto);
  return unwrapServer<GoodsReceiptNote>(res);
}

export async function listGrns(wsId: string, firmId: string, query?: any) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.grn.list(wsId, firmId), { params: query });
  return unwrapServer<GoodsReceiptNote[]>(res);
}

export async function getGrn(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.grn.get(wsId, firmId, id));
  return unwrapServer<GoodsReceiptNote>(res);
}

export async function confirmGrn(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.post(E.purchases.grn.confirm(wsId, firmId, id), {});
  return unwrapServer<GoodsReceiptNote>(res);
}

// ===== Purchase Bills =====
export async function createPurchaseBill(wsId: string, firmId: string, dto: any) {
  const http = await serverHttp();
  const res = await http.post(E.purchases.bills.create(wsId, firmId), dto);
  return unwrapServer<PurchaseBill>(res);
}

export async function listPurchaseBills(wsId: string, firmId: string, query?: any) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.bills.list(wsId, firmId), { params: query });
  return unwrapServer<PurchaseBill[]>(res);
}

export async function getPurchaseBill(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.bills.get(wsId, firmId, id));
  return unwrapServer<PurchaseBill>(res);
}

export async function postPurchaseBill(
  wsId: string,
  firmId: string,
  id: string,
  idempotencyKey: string,
) {
  const http = await serverHttp();
  const res = await http.post(
    E.purchases.bills.post(wsId, firmId, id),
    {},
    { headers: { 'x-idempotency-key': idempotencyKey } },
  );
  return unwrapServer<PurchaseBill>(res);
}

export async function cancelPurchaseBill(wsId: string, firmId: string, id: string, reason?: string) {
  const http = await serverHttp();
  const res = await http.post(E.purchases.bills.cancel(wsId, firmId, id), { reason });
  return unwrapServer<PurchaseBill>(res);
}

// ===== Payment-Out =====
export async function createPaymentOut(wsId: string, firmId: string, dto: any) {
  const http = await serverHttp();
  const res = await http.post(E.purchases.paymentsOut.create(wsId, firmId), dto);
  return unwrapServer<PaymentOut>(res);
}

export async function listPaymentOuts(wsId: string, firmId: string, query?: any) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.paymentsOut.list(wsId, firmId), { params: query });
  return unwrapServer<PaymentOut[]>(res);
}

export async function getPaymentOut(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.paymentsOut.get(wsId, firmId, id));
  return unwrapServer<PaymentOut>(res);
}

export async function postPaymentOut(
  wsId: string,
  firmId: string,
  id: string,
  idempotencyKey: string,
) {
  const http = await serverHttp();
  const res = await http.post(
    E.purchases.paymentsOut.post(wsId, firmId, id),
    {},
    { headers: { 'x-idempotency-key': idempotencyKey } },
  );
  return unwrapServer<PaymentOut>(res);
}

export async function cancelPaymentOut(wsId: string, firmId: string, id: string, reason?: string) {
  const http = await serverHttp();
  const res = await http.post(E.purchases.paymentsOut.cancel(wsId, firmId, id), { reason });
  return unwrapServer<PaymentOut>(res);
}

// ===== Capital Goods ITC =====
export async function listCapitalGoodsItcSchedules(
  wsId: string,
  firmId: string,
  status?: string,
) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.capitalGoodsItc.list(wsId, firmId), {
    params: { status },
  });
  return unwrapServer<CapitalGoodsItcSchedule[]>(res);
}

export async function getCapitalGoodsItcSchedule(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.capitalGoodsItc.get(wsId, firmId, id));
  return unwrapServer<CapitalGoodsItcSchedule>(res);
}

// ===== Payables Aging =====
export async function getPayablesAging(wsId: string, firmId: string, asOfDate?: string) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.payables.aging(wsId, firmId), {
    params: { asOfDate },
  });
  return unwrapServer<PayablesAgingBucket[]>(res);
}

export async function getPayablesSummary(wsId: string, firmId: string) {
  const http = await serverHttp();
  const res = await http.get(E.purchases.payables.summary(wsId, firmId));
  return unwrapServer<{ totalOutstandingPaise: number; counts: Record<string, number> }>(res);
}

// ===== OCR =====
// Note: multipart upload from server actions uses a FormData approach.
// The browser-side equivalent uses uploadVendorBillForOcrClient in finance-purchases.api.ts.
export async function uploadVendorBillForOcr(
  wsId: string,
  formData: FormData,
): Promise<OcrExtractionResult> {
  const http = await serverHttp();
  const res = await http.post(E.ocr.uploadVendorBill(wsId), formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrapServer<OcrExtractionResult>(res);
}
