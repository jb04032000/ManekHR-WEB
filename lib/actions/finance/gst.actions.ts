'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { gst } from '@/lib/api/endpoints';
import type {
  Gstr1Report,
  Gstr3bMergedReport,
  VerifyDataResult,
  VerifyDataFinding,
  EInvoicePending,
  EwayBillFields,
  FirmIrpConfig,
} from '@/types';

// ── GSTR-1 ───────────────────────────────────────────────────────────────────

export async function getGstr1Report(
  wsId: string,
  firmId: string,
  period: string,
): Promise<Gstr1Report> {
  const http = await serverHttp();
  return http
    .get(`${gst.gstr1.report(wsId, firmId)}?period=${period}`)
    .then(unwrapServer<Gstr1Report>);
}

export async function validateGstr1(
  wsId: string,
  firmId: string,
  period: string,
): Promise<{ findings: VerifyDataFinding[] }> {
  const http = await serverHttp();
  return http
    .get(`${gst.gstr1.validate(wsId, firmId)}?period=${period}`)
    .then(unwrapServer<{ findings: VerifyDataFinding[] }>);
}

// ── GSTR-3B ──────────────────────────────────────────────────────────────────

export async function getGstr3bReport(
  wsId: string,
  firmId: string,
  period: string,
): Promise<Gstr3bMergedReport> {
  const http = await serverHttp();
  return http
    .get(`${gst.gstr3b.report(wsId, firmId)}?period=${period}`)
    .then(unwrapServer<Gstr3bMergedReport>);
}

export async function saveGstr3bAdjustments(
  wsId: string,
  firmId: string,
  period: string,
  adjustments: Record<string, number>,
  narration?: string,
): Promise<void> {
  const http = await serverHttp();
  await http.patch(gst.gstr3b.adjustments(wsId, firmId), {
    period,
    adjustments,
    narration,
  });
}

// ── JSON export (GSTR-1 / GSTR-3B) ─────────────────────────────────────────────

// The backend export endpoints stream the raw GSTN-spec JSON payload with a file
// Content-Disposition (they bypass the response envelope via @Res()). Fetch them
// through serverHttp so the request carries the auth Bearer token, then let the
// page trigger the client-side download. A raw browser window.open() to the
// backend sends no Authorization header and is rejected with 401.

export async function exportGstr1Json(
  wsId: string,
  firmId: string,
  period: string,
): Promise<unknown> {
  const http = await serverHttp();
  return http.get(`${gst.gstr1.export(wsId, firmId)}?period=${period}`).then(unwrapServer<unknown>);
}

export async function exportGstr3bJson(
  wsId: string,
  firmId: string,
  period: string,
): Promise<unknown> {
  const http = await serverHttp();
  return http
    .get(`${gst.gstr3b.export(wsId, firmId)}?period=${period}`)
    .then(unwrapServer<unknown>);
}

// ── GSTR-2B reconciliation ─────────────────────────────────────────────────────

// Upload a GSTN GSTR-2B JSON for a period; backend matches it against posted
// purchase bills and returns the 4-bucket reconciliation. Cross-link: BE
// Gstr2bController POST /reconcile + gstr2b-recon pure core. Stateless (no persist).
export async function reconcileGstr2bData(
  wsId: string,
  firmId: string,
  period: string,
  twoB: Record<string, unknown>,
): Promise<import('@/components/finance/gst/gstr2b/types').Gstr2bReconResult> {
  const http = await serverHttp();
  return http
    .post(gst.gstr2b.reconcile(wsId, firmId), { period, twoB })
    .then(unwrapServer<import('@/components/finance/gst/gstr2b/types').Gstr2bReconResult>);
}

// ── Verify-My-Data ───────────────────────────────────────────────────────────

export async function runVerifyDataScan(
  wsId: string,
  firmId: string,
  period: string,
): Promise<VerifyDataResult> {
  const http = await serverHttp();
  return http
    .post(gst.verifyData.run(wsId, firmId), { period })
    .then(unwrapServer<VerifyDataResult>);
}

export async function getVerifyDataResults(
  wsId: string,
  firmId: string,
  period?: string,
): Promise<VerifyDataResult[]> {
  const http = await serverHttp();
  const url = period
    ? `${gst.verifyData.results(wsId, firmId)}?period=${period}`
    : gst.verifyData.results(wsId, firmId);
  return http.get(url).then(unwrapServer<VerifyDataResult[]>);
}

// ── e-Invoice ────────────────────────────────────────────────────────────────

export async function listPendingEInvoices(
  wsId: string,
  firmId: string,
): Promise<EInvoicePending[]> {
  const http = await serverHttp();
  return http.get(gst.einvoice.pending(wsId, firmId)).then(unwrapServer<EInvoicePending[]>);
}

export async function prepareIrpSession(
  wsId: string,
  firmId: string,
): Promise<{
  sessionReady?: true;
  needsOtp?: true;
  sessionId?: string;
  mobileLast4?: string;
  locked?: true;
  minutesRemaining?: number;
}> {
  const http = await serverHttp();
  return http.post(gst.einvoice.prepareSession(wsId, firmId), {}).then(
    unwrapServer<{
      sessionReady?: true;
      needsOtp?: true;
      sessionId?: string;
      mobileLast4?: string;
      locked?: true;
      minutesRemaining?: number;
    }>,
  );
}

export async function completeIrpSession(
  wsId: string,
  firmId: string,
  sessionId: string,
  otp: string,
): Promise<{
  sessionReady?: true;
  otpFailed?: true;
  attemptsLeft?: number;
  locked?: true;
  minutesRemaining?: number;
}> {
  const http = await serverHttp();
  return http.post(gst.einvoice.completeSession(wsId, firmId), { sessionId, otp }).then(
    unwrapServer<{
      sessionReady?: true;
      otpFailed?: true;
      attemptsLeft?: number;
      locked?: true;
      minutesRemaining?: number;
    }>,
  );
}

export async function generateIrn(
  wsId: string,
  firmId: string,
  invoiceId: string,
): Promise<{ irn: string; ackNo: string; ackDate: string }> {
  const http = await serverHttp();
  return http
    .post(gst.einvoice.generate(wsId, firmId, invoiceId), {})
    .then(unwrapServer<{ irn: string; ackNo: string; ackDate: string }>);
}

export async function cancelIrn(
  wsId: string,
  firmId: string,
  invoiceId: string,
  cancelReason: number,
  cancelRemarks: string,
): Promise<void> {
  const http = await serverHttp();
  await http.post(gst.einvoice.cancel(wsId, firmId, invoiceId), {
    cancelReason,
    cancelRemarks,
  });
}

export async function batchGenerateIrn(
  wsId: string,
  firmId: string,
  invoiceIds: string[],
): Promise<{ processed: number; queued: number }> {
  const http = await serverHttp();
  return http
    .post(gst.einvoice.batchGenerate(wsId, firmId), { invoiceIds })
    .then(unwrapServer<{ processed: number; queued: number }>);
}

// ── e-Way Bill ───────────────────────────────────────────────────────────────

export async function generateEwb(
  wsId: string,
  firmId: string,
  invoiceId: string,
  transport: {
    transMode: string;
    transDistance: number;
    vehicleNo?: string;
    vehicleType?: string;
    overrideExemption?: boolean;
  },
): Promise<EwayBillFields> {
  const http = await serverHttp();
  return http
    .post(gst.ewaybill.generate(wsId, firmId, invoiceId), transport)
    .then(unwrapServer<EwayBillFields>);
}

export async function extendEwb(
  wsId: string,
  firmId: string,
  invoiceId: string,
  extendInput: {
    vehicleNo: string;
    fromPlace: string;
    remainDist: number;
    transMode?: string;
    vehicleType?: string;
    transDocNo?: string;
    transDocDate?: string;
    extnReason: number;
  },
): Promise<EwayBillFields> {
  const http = await serverHttp();
  return http
    .patch(gst.ewaybill.extend(wsId, firmId, invoiceId), extendInput)
    .then(unwrapServer<EwayBillFields>);
}

export async function cancelEwb(
  wsId: string,
  firmId: string,
  invoiceId: string,
  cancelReason: number,
  cancelRemarks: string,
): Promise<void> {
  const http = await serverHttp();
  await http.post(gst.ewaybill.cancel(wsId, firmId, invoiceId), {
    cancelReason,
    cancelRemarks,
  });
}

export async function listExpiringEwbs(
  wsId: string,
  firmId: string,
  hoursAhead = 48,
): Promise<any[]> {
  const http = await serverHttp();
  return http
    .get(`${gst.ewaybill.expiring(wsId, firmId)}?hoursAhead=${hoursAhead}`)
    .then(unwrapServer<any[]>);
}

export async function listEInvoicesByStatus(
  wsId: string,
  firmId: string,
  status: 'pending' | 'generated' | 'cancelled' | 'retry',
  page = 0,
  size = 50,
): Promise<{ items: any[]; total: number }> {
  const http = await serverHttp();
  return http
    .get(gst.einvoice.list(wsId, firmId, status, page, size))
    .then(unwrapServer<{ items: any[]; total: number }>);
}

export async function getEInvoiceQr(
  wsId: string,
  firmId: string,
  invoiceId: string,
): Promise<{ qrDataUrl: string; irn: string; ackNo: string }> {
  const http = await serverHttp();
  return http
    .get(gst.einvoice.qr(wsId, firmId, invoiceId))
    .then(unwrapServer<{ qrDataUrl: string; irn: string; ackNo: string }>);
}

export async function listEwbsByStatus(
  wsId: string,
  firmId: string,
  status: 'active' | 'expiring' | 'expired' | 'cancelled',
  page = 0,
  size = 50,
): Promise<{ items: any[]; total: number }> {
  const http = await serverHttp();
  return http
    .get(gst.ewaybill.list(wsId, firmId, status, page, size))
    .then(unwrapServer<{ items: any[]; total: number }>);
}

// ── Firm GST Config ───────────────────────────────────────────────────────────

export async function updateFirmGstConfig(
  wsId: string,
  firmId: string,
  payload: {
    irpConfig?: {
      mode: 'gsp_surepass' | 'nic_direct';
      gspKey?: string;
      username?: string;
      password?: string;
    };
    ewbConfig?: {
      mode: 'gsp_surepass' | 'nic_direct';
      gspKey?: string;
      username?: string;
      password?: string;
    };
  },
): Promise<void> {
  const http = await serverHttp();
  await http.patch(gst.firmConfig.updateGstConfig(wsId, firmId), payload);
}
