'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { jobWork, karigarProfile } from '@/lib/api/endpoints';
import type {
  JobWorkInwardChallan,
  JobWorkOutwardChallan,
  JobWorkInvoice,
  JobWorkLot,
  Itc04Report,
  Itc04ExportJson,
  CreateJwInwardPayload,
  CreateJwOutwardPayload,
  CreateJwInvoicePayload,
  UpdateKarigarProfilePayload,
  TeamMember,
} from '@/types';

// ── JWI Challans ──────────────────────────────────────────────────────────────

export async function listJwInwardChallans(
  wsId: string,
  firmId: string,
  params?: {
    partyId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<{ items: JobWorkInwardChallan[]; total: number; page: number; pageSize: number }> {
  const http = await serverHttp();
  const url = jobWork.inwardChallans.list(wsId, firmId);
  const query = new URLSearchParams();
  if (params?.partyId) query.set('partyId', params.partyId);
  if (params?.status) query.set('status', params.status);
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return http
    .get(qs ? `${url}?${qs}` : url)
    .then(
      unwrapServer<{
        items: JobWorkInwardChallan[];
        total: number;
        page: number;
        pageSize: number;
      }>,
    );
}

export async function createJwInwardChallan(
  wsId: string,
  firmId: string,
  payload: CreateJwInwardPayload,
): Promise<JobWorkInwardChallan> {
  const http = await serverHttp();
  return http
    .post(jobWork.inwardChallans.create(wsId, firmId), payload)
    .then(unwrapServer<JobWorkInwardChallan>);
}

export async function getJwInwardChallan(
  wsId: string,
  firmId: string,
  id: string,
): Promise<JobWorkInwardChallan> {
  const http = await serverHttp();
  return http
    .get(jobWork.inwardChallans.detail(wsId, firmId, id))
    .then(unwrapServer<JobWorkInwardChallan>);
}

export async function updateJwInwardChallan(
  wsId: string,
  firmId: string,
  id: string,
  payload: Partial<CreateJwInwardPayload>,
): Promise<JobWorkInwardChallan> {
  const http = await serverHttp();
  return http
    .patch(jobWork.inwardChallans.update(wsId, firmId, id), payload)
    .then(unwrapServer<JobWorkInwardChallan>);
}

export async function postJwInwardChallan(
  wsId: string,
  firmId: string,
  id: string,
): Promise<JobWorkInwardChallan> {
  const http = await serverHttp();
  return http
    .post(jobWork.inwardChallans.post(wsId, firmId, id), {})
    .then(unwrapServer<JobWorkInwardChallan>);
}

export async function cancelJwInwardChallan(
  wsId: string,
  firmId: string,
  id: string,
): Promise<JobWorkInwardChallan> {
  const http = await serverHttp();
  return http
    .post(jobWork.inwardChallans.cancel(wsId, firmId, id), {})
    .then(unwrapServer<JobWorkInwardChallan>);
}

// ── JWO Challans ──────────────────────────────────────────────────────────────

export async function listJwOutwardChallans(
  wsId: string,
  firmId: string,
  params?: {
    partyId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<{ items: JobWorkOutwardChallan[]; total: number; page: number; pageSize: number }> {
  const http = await serverHttp();
  const url = jobWork.outwardChallans.list(wsId, firmId);
  const query = new URLSearchParams();
  if (params?.partyId) query.set('partyId', params.partyId);
  if (params?.status) query.set('status', params.status);
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return http
    .get(qs ? `${url}?${qs}` : url)
    .then(
      unwrapServer<{
        items: JobWorkOutwardChallan[];
        total: number;
        page: number;
        pageSize: number;
      }>,
    );
}

export async function createJwOutwardChallan(
  wsId: string,
  firmId: string,
  payload: CreateJwOutwardPayload,
): Promise<JobWorkOutwardChallan> {
  const http = await serverHttp();
  return http
    .post(jobWork.outwardChallans.create(wsId, firmId), payload)
    .then(unwrapServer<JobWorkOutwardChallan>);
}

export async function getJwOutwardChallan(
  wsId: string,
  firmId: string,
  id: string,
): Promise<JobWorkOutwardChallan> {
  const http = await serverHttp();
  return http
    .get(jobWork.outwardChallans.detail(wsId, firmId, id))
    .then(unwrapServer<JobWorkOutwardChallan>);
}

export async function updateJwOutwardChallan(
  wsId: string,
  firmId: string,
  id: string,
  payload: Partial<CreateJwOutwardPayload>,
): Promise<JobWorkOutwardChallan> {
  const http = await serverHttp();
  return http
    .patch(jobWork.outwardChallans.update(wsId, firmId, id), payload)
    .then(unwrapServer<JobWorkOutwardChallan>);
}

export async function postJwOutwardChallan(
  wsId: string,
  firmId: string,
  id: string,
): Promise<{ jwo: JobWorkOutwardChallan; invoiceId: string; invoiceNumberHint: string }> {
  const http = await serverHttp();
  return http
    .post(jobWork.outwardChallans.post(wsId, firmId, id), {})
    .then(
      unwrapServer<{ jwo: JobWorkOutwardChallan; invoiceId: string; invoiceNumberHint: string }>,
    );
}

export async function cancelJwOutwardChallan(
  wsId: string,
  firmId: string,
  id: string,
): Promise<JobWorkOutwardChallan> {
  const http = await serverHttp();
  return http
    .post(jobWork.outwardChallans.cancel(wsId, firmId, id), {})
    .then(unwrapServer<JobWorkOutwardChallan>);
}

// ── JW Invoices ───────────────────────────────────────────────────────────────

export async function listJwInvoices(
  wsId: string,
  firmId: string,
  params?: {
    partyId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    paymentStatus?: string;
    postingStatus?: string;
    page?: number;
    pageSize?: number;
  }, // R10: postingStatus = failed-post quarantine filter
): Promise<{ items: JobWorkInvoice[]; total: number; page: number; pageSize: number }> {
  const http = await serverHttp();
  const url = jobWork.invoices.list(wsId, firmId);
  const query = new URLSearchParams();
  if (params?.partyId) query.set('partyId', params.partyId);
  if (params?.status) query.set('status', params.status);
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.paymentStatus) query.set('paymentStatus', params.paymentStatus);
  if (params?.postingStatus) query.set('postingStatus', params.postingStatus); // R10: forward quarantine filter to BE
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return http
    .get(qs ? `${url}?${qs}` : url)
    .then(unwrapServer<{ items: JobWorkInvoice[]; total: number; page: number; pageSize: number }>);
}

export async function createJwInvoice(
  wsId: string,
  firmId: string,
  payload: CreateJwInvoicePayload,
): Promise<JobWorkInvoice> {
  const http = await serverHttp();
  return http
    .post(jobWork.invoices.create(wsId, firmId), payload)
    .then(unwrapServer<JobWorkInvoice>);
}

export async function getJwInvoice(
  wsId: string,
  firmId: string,
  id: string,
): Promise<JobWorkInvoice> {
  const http = await serverHttp();
  return http.get(jobWork.invoices.detail(wsId, firmId, id)).then(unwrapServer<JobWorkInvoice>);
}

export async function updateJwInvoice(
  wsId: string,
  firmId: string,
  id: string,
  payload: Partial<CreateJwInvoicePayload>,
): Promise<JobWorkInvoice> {
  const http = await serverHttp();
  return http
    .patch(jobWork.invoices.update(wsId, firmId, id), payload)
    .then(unwrapServer<JobWorkInvoice>);
}

export async function postJwInvoice(
  wsId: string,
  firmId: string,
  id: string,
): Promise<JobWorkInvoice> {
  const http = await serverHttp();
  return http.post(jobWork.invoices.post(wsId, firmId, id), {}).then(unwrapServer<JobWorkInvoice>);
}

export async function cancelJwInvoice(
  wsId: string,
  firmId: string,
  id: string,
): Promise<JobWorkInvoice> {
  const http = await serverHttp();
  return http
    .post(jobWork.invoices.cancel(wsId, firmId, id), {})
    .then(unwrapServer<JobWorkInvoice>);
}

// ── JW Lots (read-only) ───────────────────────────────────────────────────────

export async function listJwLots(
  wsId: string,
  firmId: string,
  params?: { partyId?: string; status?: string },
): Promise<JobWorkLot[]> {
  const http = await serverHttp();
  const url = jobWork.lots.list(wsId, firmId);
  const query = new URLSearchParams();
  if (params?.partyId) query.set('partyId', params.partyId);
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return http.get(qs ? `${url}?${qs}` : url).then(unwrapServer<JobWorkLot[]>);
}

export async function getJwLot(wsId: string, firmId: string, id: string): Promise<JobWorkLot> {
  const http = await serverHttp();
  return http.get(jobWork.lots.detail(wsId, firmId, id)).then(unwrapServer<JobWorkLot>);
}

// ── ITC-04 ────────────────────────────────────────────────────────────────────

export async function getItc04Report(
  wsId: string,
  firmId: string,
  params: { quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; fy: string; partyId?: string },
): Promise<Itc04Report> {
  const http = await serverHttp();
  const url = jobWork.itc04.report(wsId, firmId);
  const query = new URLSearchParams();
  query.set('quarter', params.quarter);
  query.set('fy', params.fy);
  if (params.partyId) query.set('partyId', params.partyId);
  return http.get(`${url}?${query.toString()}`).then(unwrapServer<Itc04Report>);
}

export async function getItc04Export(
  wsId: string,
  firmId: string,
  params: { quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; fy: string },
): Promise<Itc04ExportJson> {
  const http = await serverHttp();
  const url = jobWork.itc04.export(wsId, firmId);
  const query = new URLSearchParams();
  query.set('quarter', params.quarter);
  query.set('fy', params.fy);
  return http.get(`${url}?${query.toString()}`).then(unwrapServer<Itc04ExportJson>);
}

// ── Karigar Profile (Team extension) ─────────────────────────────────────────

export async function updateKarigarProfile(
  wsId: string,
  memberId: string,
  payload: UpdateKarigarProfilePayload,
): Promise<TeamMember> {
  const http = await serverHttp();
  return http.patch(karigarProfile.update(wsId, memberId), payload).then(unwrapServer<TeamMember>);
}
