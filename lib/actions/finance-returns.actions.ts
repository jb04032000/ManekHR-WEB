'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { CreditNote, DebitNote, GrnReturn } from '@/types';

const CN = ApiEndpoints.finance.creditNotes;
const DN = ApiEndpoints.finance.debitNotes;
const GR = ApiEndpoints.finance.grnReturns;

// ===== Credit Notes =====

export async function listCreditNotes(
  workspaceId: string,
  firmId: string,
  params?: {
    state?: string;
    partyId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    skip?: number;
    postingStatus?: string; // R10: failed-post quarantine filter, forwarded to the BE list query
  },
): Promise<{ items: CreditNote[]; total: number }> {
  const http = await serverHttp();
  const res = await http.get(CN.list(workspaceId, firmId), { params });
  return unwrapServer<{ items: CreditNote[]; total: number }>(res);
}

export async function getCreditNote(
  workspaceId: string,
  firmId: string,
  id: string,
): Promise<CreditNote> {
  const http = await serverHttp();
  const res = await http.get(CN.detail(workspaceId, firmId, id));
  return unwrapServer<CreditNote>(res);
}

export async function listCreditNotesByInvoice(
  workspaceId: string,
  firmId: string,
  invoiceId: string,
): Promise<CreditNote[]> {
  const http = await serverHttp();
  const res = await http.get(CN.byInvoice(workspaceId, firmId, invoiceId));
  return unwrapServer<CreditNote[]>(res);
}

export async function createCreditNote(
  workspaceId: string,
  firmId: string,
  payload: {
    voucherDate: string;
    sourceInvoiceId: string;
    cnType: 'goods_return' | 'price_correction' | 'post_sale_discount' | 'deficiency' | 'other';
    reasonCode?: string;
    lineItems: Array<{
      itemId?: string;
      itemName?: string;
      hsnSacCode?: string;
      qty?: number;
      unit?: string;
      ratePaise?: number;
      discountPct?: number;
      taxRate?: number;
      reverseStock?: boolean;
    }>;
    narration?: string;
    notes?: string;
    recipientItcReversalStatus?: 'pending' | 'self_declared' | 'ca_certified' | 'not_applicable';
    recipientItcReversalDocUrl?: string;
    // D11: commercial / financial credit note (kasar-vatav) - BE zeroes GST when true.
    isCommercial?: boolean;
  },
): Promise<CreditNote> {
  const http = await serverHttp();
  const res = await http.post(CN.create(workspaceId, firmId), payload);
  return unwrapServer<CreditNote>(res);
}

export async function updateCreditNote(
  workspaceId: string,
  firmId: string,
  id: string,
  payload: Partial<{
    voucherDate: string;
    cnType: string;
    reasonCode: string;
    lineItems: unknown[];
    narration: string;
    notes: string;
    recipientItcReversalStatus: string;
    recipientItcReversalDocUrl: string;
  }>,
): Promise<CreditNote> {
  const http = await serverHttp();
  const res = await http.patch(CN.update(workspaceId, firmId, id), payload);
  return unwrapServer<CreditNote>(res);
}

export async function postCreditNote(
  workspaceId: string,
  firmId: string,
  id: string,
): Promise<CreditNote> {
  const http = await serverHttp();
  const res = await http.post(CN.post(workspaceId, firmId, id), {});
  return unwrapServer<CreditNote>(res);
}

// Credit-note IRN (CRN e-invoice) -> BE EInvoiceService.generateIrnForCreditNote. Posted CN only.
export async function generateCreditNoteIrn(
  workspaceId: string,
  firmId: string,
  id: string,
): Promise<{ irn: string; ackNo: string; ackDate: string; signedQrCode: string }> {
  const http = await serverHttp();
  const res = await http.post(CN.einvoice(workspaceId, firmId, id), {});
  return unwrapServer<{ irn: string; ackNo: string; ackDate: string; signedQrCode: string }>(res);
}

export async function getCreditNoteIrnQr(
  workspaceId: string,
  firmId: string,
  id: string,
): Promise<{ qrDataUrl: string; irn: string; ackNo: string }> {
  const http = await serverHttp();
  const res = await http.get(CN.einvoiceQr(workspaceId, firmId, id));
  return unwrapServer<{ qrDataUrl: string; irn: string; ackNo: string }>(res);
}

// Cancel a credit note's IRN within the 24h window -> BE EInvoiceService.cancelIrnForCreditNote.
// cancelReason: 1=Duplicate, 2=Data Entry Mistake, 3=Order Cancelled, 4=Others.
export async function cancelCreditNoteIrn(
  workspaceId: string,
  firmId: string,
  id: string,
  cancelReason: number,
  cancelRemarks: string,
): Promise<{ cancelled: boolean }> {
  const http = await serverHttp();
  const res = await http.post(CN.einvoiceCancel(workspaceId, firmId, id), {
    cancelReason,
    cancelRemarks,
  });
  return unwrapServer<{ cancelled: boolean }>(res);
}

export async function cancelCreditNote(
  workspaceId: string,
  firmId: string,
  id: string,
  reason: string,
): Promise<CreditNote> {
  const http = await serverHttp();
  const res = await http.post(CN.cancel(workspaceId, firmId, id), { reason });
  return unwrapServer<CreditNote>(res);
}

// ===== Debit Notes =====

export async function listDebitNotes(
  workspaceId: string,
  firmId: string,
  params?: {
    state?: string;
    partyId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    skip?: number;
    postingStatus?: string; // R10: failed-post quarantine filter, forwarded to the BE list query
  },
): Promise<{ items: DebitNote[]; total: number }> {
  const http = await serverHttp();
  const res = await http.get(DN.list(workspaceId, firmId), { params });
  return unwrapServer<{ items: DebitNote[]; total: number }>(res);
}

export async function getDebitNote(
  workspaceId: string,
  firmId: string,
  id: string,
): Promise<DebitNote> {
  const http = await serverHttp();
  const res = await http.get(DN.detail(workspaceId, firmId, id));
  return unwrapServer<DebitNote>(res);
}

export async function listDebitNotesByBill(
  workspaceId: string,
  firmId: string,
  billId: string,
): Promise<DebitNote[]> {
  const http = await serverHttp();
  const res = await http.get(DN.byBill(workspaceId, firmId, billId));
  return unwrapServer<DebitNote[]>(res);
}

export async function createDebitNote(
  workspaceId: string,
  firmId: string,
  payload: {
    voucherDate: string;
    sourceBillId: string;
    sourceGrnReturnId?: string;
    vendorBillRef?: string;
    dnType: 'goods_return' | 'price_correction' | 'excess_billing' | 'quality_rejection' | 'other';
    vendorAccepted?: boolean;
    lineItems: Array<{
      itemId?: string;
      itemName?: string;
      hsnSacCode?: string;
      qty?: number;
      unit?: string;
      ratePaise?: number;
      taxRate?: number;
    }>;
    narration?: string;
  },
): Promise<DebitNote> {
  const http = await serverHttp();
  const res = await http.post(DN.create(workspaceId, firmId), payload);
  return unwrapServer<DebitNote>(res);
}

export async function updateDebitNote(
  workspaceId: string,
  firmId: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<DebitNote> {
  const http = await serverHttp();
  const res = await http.patch(DN.update(workspaceId, firmId, id), payload);
  return unwrapServer<DebitNote>(res);
}

export async function postDebitNote(
  workspaceId: string,
  firmId: string,
  id: string,
): Promise<DebitNote> {
  const http = await serverHttp();
  const res = await http.post(DN.post(workspaceId, firmId, id), {});
  return unwrapServer<DebitNote>(res);
}

export async function cancelDebitNote(
  workspaceId: string,
  firmId: string,
  id: string,
  reason: string,
): Promise<DebitNote> {
  const http = await serverHttp();
  const res = await http.post(DN.cancel(workspaceId, firmId, id), { reason });
  return unwrapServer<DebitNote>(res);
}

// ===== GRN Returns =====

export async function listGrnReturns(
  workspaceId: string,
  firmId: string,
  params?: {
    state?: string;
    partyId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    skip?: number;
  },
): Promise<{ items: GrnReturn[]; total: number }> {
  const http = await serverHttp();
  const res = await http.get(GR.list(workspaceId, firmId), { params });
  return unwrapServer<{ items: GrnReturn[]; total: number }>(res);
}

export async function getGrnReturn(
  workspaceId: string,
  firmId: string,
  id: string,
): Promise<GrnReturn> {
  const http = await serverHttp();
  const res = await http.get(GR.detail(workspaceId, firmId, id));
  return unwrapServer<GrnReturn>(res);
}

export async function createGrnReturn(
  workspaceId: string,
  firmId: string,
  payload: {
    voucherDate: string;
    sourceGrnId?: string;
    sourceBillId?: string;
    partyId?: string;
    vendorRmaNumber?: string;
    transport?: { carrier?: string; lrNumber?: string; dispatchDate?: string };
    lineItems: Array<{
      itemId?: string;
      itemName?: string;
      qtyReturned?: number;
      unit?: string;
      ratePaise?: number;
      reason?: string;
      batchNumber?: string;
      notes?: string;
    }>;
    notes?: string;
  },
): Promise<GrnReturn> {
  const http = await serverHttp();
  const res = await http.post(GR.create(workspaceId, firmId), payload);
  return unwrapServer<GrnReturn>(res);
}

export async function updateGrnReturn(
  workspaceId: string,
  firmId: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<GrnReturn> {
  const http = await serverHttp();
  const res = await http.patch(GR.update(workspaceId, firmId, id), payload);
  return unwrapServer<GrnReturn>(res);
}

export async function dispatchGrnReturn(
  workspaceId: string,
  firmId: string,
  id: string,
): Promise<GrnReturn> {
  const http = await serverHttp();
  const res = await http.post(GR.dispatch(workspaceId, firmId, id), {});
  return unwrapServer<GrnReturn>(res);
}

export async function confirmGrnReturn(
  workspaceId: string,
  firmId: string,
  id: string,
): Promise<{ grnReturn: GrnReturn; promptCreateDebitNote: boolean }> {
  const http = await serverHttp();
  const res = await http.post(GR.confirm(workspaceId, firmId, id), {});
  return unwrapServer<{ grnReturn: GrnReturn; promptCreateDebitNote: boolean }>(res);
}

export async function cancelGrnReturn(
  workspaceId: string,
  firmId: string,
  id: string,
  reason: string,
): Promise<GrnReturn> {
  const http = await serverHttp();
  const res = await http.post(GR.cancel(workspaceId, firmId, id), { reason });
  return unwrapServer<GrnReturn>(res);
}
