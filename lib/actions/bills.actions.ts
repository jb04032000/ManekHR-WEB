'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { Bill, CreateBillPayload, UpdateBillPayload, RecordBillPaymentPayload, BillQueryParams } from '@/types';

const E = ApiEndpoints.bills;

export async function listBills(wsId: string, params?: BillQueryParams) {
  const http = await serverHttp();
  return http.get(E.list(wsId), { params }).then(unwrapServer<Bill[]>);
}

export async function createBill(wsId: string, data: CreateBillPayload, token?: string) {
  const http = await serverHttp(token);
  return http.post(E.create(wsId), data).then(unwrapServer<Bill>);
}

export async function getBill(wsId: string, billId: string) {
  const http = await serverHttp();
  return http.get(E.get(wsId, billId)).then(unwrapServer<Bill>);
}

export async function updateBill(wsId: string, billId: string, data: UpdateBillPayload, token?: string) {
  const http = await serverHttp(token);
  return http.patch(E.update(wsId, billId), data).then(unwrapServer<Bill>);
}

export async function deleteBill(wsId: string, billId: string, token?: string) {
  const http = await serverHttp(token);
  return http.delete(E.delete(wsId, billId)).then(unwrapServer<{ message: string }>);
}

export async function recordBillPayment(wsId: string, billId: string, data: RecordBillPaymentPayload, token?: string) {
  const http = await serverHttp(token);
  return http.post(E.recordPayment(wsId, billId), data).then(unwrapServer<Bill>);
}
