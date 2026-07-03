import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { Bill, CreateBillPayload, UpdateBillPayload, RecordBillPaymentPayload, BillQueryParams } from '@/types';

const E = ApiEndpoints.bills;

export const billsApi = {
  list: (wsId: string, params?: BillQueryParams) =>
    http.get(E.list(wsId), { params }).then(unwrap<Bill[]>),
  create: (wsId: string, data: CreateBillPayload) =>
    http.post(E.create(wsId), data).then(unwrap<Bill>),
  get: (wsId: string, billId: string) =>
    http.get(E.get(wsId, billId)).then(unwrap<Bill>),
  update: (wsId: string, billId: string, data: UpdateBillPayload) =>
    http.patch(E.update(wsId, billId), data).then(unwrap<Bill>),
  delete: (wsId: string, billId: string) =>
    http.delete(E.delete(wsId, billId)).then(unwrap<{ message: string }>),
  recordPayment: (wsId: string, billId: string, data: RecordBillPaymentPayload) =>
    http.post(E.recordPayment(wsId, billId), data).then(unwrap<Bill>),
};
