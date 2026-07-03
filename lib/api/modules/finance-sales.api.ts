import http, { unwrap } from '../client';
import { ApiEndpoints, gst } from '../endpoints';
import type {
  SaleInvoice,
  Quotation,
  SaleOrder,
  Proforma,
  DeliveryChallan,
  RecurringInvoiceTemplate,
  SalesKpiSummary,
} from '@/types';

const S = ApiEndpoints.finance.sales;

export const financeSalesApi = {
  // ── Invoices ────────────────────────────────────────────────
  invoices: {
    list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
      http
        .get(S.invoices.list(wsId, firmId), { params })
        .then(unwrap<{ data: SaleInvoice[]; total: number }>),

    // D-26: single server-side aggregation - NOT a list of 1000 invoices reduced on the client
    kpiSummary: (wsId: string, firmId: string, dateFrom?: string, dateTo?: string) =>
      http.get(S.invoices.kpiSummary(wsId, firmId, dateFrom, dateTo)).then(unwrap<SalesKpiSummary>),

    get: (wsId: string, firmId: string, id: string) =>
      http.get(S.invoices.get(wsId, firmId, id)).then(unwrap<SaleInvoice>),

    create: (wsId: string, firmId: string, dto: Partial<SaleInvoice>) =>
      http.post(S.invoices.create(wsId, firmId), dto).then(unwrap<SaleInvoice>),

    update: (wsId: string, firmId: string, id: string, dto: Partial<SaleInvoice>) =>
      http.patch(S.invoices.update(wsId, firmId, id), dto).then(unwrap<SaleInvoice>),

    post: (wsId: string, firmId: string, id: string, idempotencyKey: string) =>
      http
        .post(
          S.invoices.post(wsId, firmId, id),
          {},
          {
            headers: { 'X-Idempotency-Key': idempotencyKey },
          },
        )
        .then(unwrap<SaleInvoice>),

    approve: (wsId: string, firmId: string, id: string) =>
      http.post(S.invoices.approve(wsId, firmId, id), {}).then(unwrap<SaleInvoice>),

    reject: (wsId: string, firmId: string, id: string, reason: string) =>
      http.post(S.invoices.reject(wsId, firmId, id), { reason }).then(unwrap<SaleInvoice>),

    cancel: (wsId: string, firmId: string, id: string, reason?: string) =>
      http.post(S.invoices.cancel(wsId, firmId, id), { reason }).then(unwrap<SaleInvoice>),

    clone: (wsId: string, firmId: string, id: string) =>
      http.post(S.invoices.clone(wsId, firmId, id), {}).then(unwrap<SaleInvoice>),

    send: (wsId: string, firmId: string, id: string, body: Record<string, unknown>) =>
      http
        .post(S.invoices.send(wsId, firmId, id), body)
        .then(unwrap<{ dispatched: string[]; invoiceId: string; errors: Record<string, string> }>),

    einvoice: (wsId: string, firmId: string, id: string) =>
      http
        .post(S.invoices.einvoice(wsId, firmId, id), {})
        .then(unwrap<{ irn: string; ackNo: string; ackDate: string; signedQrCode: string }>),

    ewaybill: (wsId: string, firmId: string, id: string, dto: Record<string, unknown>) =>
      http.post(S.invoices.ewaybill(wsId, firmId, id), dto).then(unwrap<unknown>),

    // 1c: fetch the server-rendered Noto-font PDF (for gu/hi script print).
    localizedPdf: (wsId: string, firmId: string, id: string, locale: string, theme?: string) =>
      http
        .get(S.invoices.pdf(wsId, firmId, id, locale, theme), { responseType: 'blob' })
        .then((r) => r.data as Blob),

    // 2b: look up the master GST rate for an HSN at a given date.
    gstRate: (wsId: string, firmId: string, hsn: string, date?: string) =>
      http.get(S.invoices.gstRate(wsId, firmId, hsn, date)).then(
        unwrap<{
          hsn: string;
          asOf: string;
          found: boolean;
          matchedPrefix?: string;
          description?: string;
          cgstRate?: number;
          sgstRate?: number;
          igstRate?: number;
          cessRate?: number;
          totalRate?: number;
          notification?: string;
        }>,
      ),

    irpQr: (wsId: string, firmId: string, id: string) =>
      http
        .get(gst.einvoice.qr(wsId, firmId, id))
        .then(unwrap<{ qrDataUrl: string; irn: string; ackNo: string }>),

    print: (wsId: string, firmId: string, id: string, template?: string) =>
      http
        .get(S.invoices.print(wsId, firmId, id, template))
        .then(unwrap<{ invoice: SaleInvoice; template: string }>),

    delete: (wsId: string, firmId: string, id: string) =>
      http.delete(S.invoices.delete(wsId, firmId, id)).then(unwrap<{ ok: true }>),

    lateFeeOverride: (wsId: string, firmId: string, id: string, body: Record<string, unknown>) =>
      http.post(S.invoices.lateFeeOverride(wsId, firmId, id), body).then(unwrap<SaleInvoice>),
  },

  // ── Quotations ──────────────────────────────────────────────
  quotations: {
    list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
      http
        .get(S.quotations.list(wsId, firmId), { params })
        .then(unwrap<{ data: Quotation[]; total: number }>),

    get: (wsId: string, firmId: string, id: string) =>
      http.get(S.quotations.get(wsId, firmId, id)).then(unwrap<Quotation>),

    create: (wsId: string, firmId: string, dto: Partial<Quotation>) =>
      http.post(S.quotations.create(wsId, firmId), dto).then(unwrap<Quotation>),

    update: (wsId: string, firmId: string, id: string, dto: Partial<Quotation>) =>
      http.patch(S.quotations.update(wsId, firmId, id), dto).then(unwrap<Quotation>),

    post: (wsId: string, firmId: string, id: string) =>
      http.post(S.quotations.post(wsId, firmId, id), {}).then(unwrap<Quotation>),

    cancel: (wsId: string, firmId: string, id: string, reason?: string) =>
      http.post(S.quotations.cancel(wsId, firmId, id), { reason }).then(unwrap<Quotation>),

    clone: (wsId: string, firmId: string, id: string) =>
      http.post(S.quotations.clone(wsId, firmId, id), {}).then(unwrap<Quotation>),

    send: (wsId: string, firmId: string, id: string, body: Record<string, unknown>) =>
      http
        .post(S.quotations.send(wsId, firmId, id), body)
        .then(unwrap<{ dispatched: string[]; errors: Record<string, string> }>),

    delete: (wsId: string, firmId: string, id: string) =>
      http.delete(S.quotations.delete(wsId, firmId, id)).then(unwrap<{ ok: true }>),
  },

  // ── Sale Orders ─────────────────────────────────────────────
  orders: {
    list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
      http
        .get(S.orders.list(wsId, firmId), { params })
        .then(unwrap<{ data: SaleOrder[]; total: number }>),

    get: (wsId: string, firmId: string, id: string) =>
      http.get(S.orders.get(wsId, firmId, id)).then(unwrap<SaleOrder>),

    create: (wsId: string, firmId: string, dto: Partial<SaleOrder>) =>
      http.post(S.orders.create(wsId, firmId), dto).then(unwrap<SaleOrder>),

    update: (wsId: string, firmId: string, id: string, dto: Partial<SaleOrder>) =>
      http.patch(S.orders.update(wsId, firmId, id), dto).then(unwrap<SaleOrder>),

    post: (wsId: string, firmId: string, id: string) =>
      http.post(S.orders.post(wsId, firmId, id), {}).then(unwrap<SaleOrder>),

    cancel: (wsId: string, firmId: string, id: string, reason?: string) =>
      http.post(S.orders.cancel(wsId, firmId, id), { reason }).then(unwrap<SaleOrder>),

    clone: (wsId: string, firmId: string, id: string) =>
      http.post(S.orders.clone(wsId, firmId, id), {}).then(unwrap<SaleOrder>),

    send: (wsId: string, firmId: string, id: string, body: Record<string, unknown>) =>
      http
        .post(S.orders.send(wsId, firmId, id), body)
        .then(unwrap<{ dispatched: string[]; errors: Record<string, string> }>),

    delete: (wsId: string, firmId: string, id: string) =>
      http.delete(S.orders.delete(wsId, firmId, id)).then(unwrap<{ ok: true }>),
  },

  // ── Proforma ────────────────────────────────────────────────
  proforma: {
    list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
      http
        .get(S.proforma.list(wsId, firmId), { params })
        .then(unwrap<{ data: Proforma[]; total: number }>),

    get: (wsId: string, firmId: string, id: string) =>
      http.get(S.proforma.get(wsId, firmId, id)).then(unwrap<Proforma>),

    create: (wsId: string, firmId: string, dto: Partial<Proforma>) =>
      http.post(S.proforma.create(wsId, firmId), dto).then(unwrap<Proforma>),

    update: (wsId: string, firmId: string, id: string, dto: Partial<Proforma>) =>
      http.patch(S.proforma.update(wsId, firmId, id), dto).then(unwrap<Proforma>),

    post: (wsId: string, firmId: string, id: string) =>
      http.post(S.proforma.post(wsId, firmId, id), {}).then(unwrap<Proforma>),

    cancel: (wsId: string, firmId: string, id: string, reason?: string) =>
      http.post(S.proforma.cancel(wsId, firmId, id), { reason }).then(unwrap<Proforma>),

    clone: (wsId: string, firmId: string, id: string) =>
      http.post(S.proforma.clone(wsId, firmId, id), {}).then(unwrap<Proforma>),

    send: (wsId: string, firmId: string, id: string, body: Record<string, unknown>) =>
      http
        .post(S.proforma.send(wsId, firmId, id), body)
        .then(unwrap<{ dispatched: string[]; errors: Record<string, string> }>),

    delete: (wsId: string, firmId: string, id: string) =>
      http.delete(S.proforma.delete(wsId, firmId, id)).then(unwrap<{ ok: true }>),
  },

  // ── Delivery Challans ───────────────────────────────────────
  deliveryChallans: {
    list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
      http
        .get(S.deliveryChallans.list(wsId, firmId), { params })
        .then(unwrap<{ data: DeliveryChallan[]; total: number }>),

    get: (wsId: string, firmId: string, id: string) =>
      http.get(S.deliveryChallans.get(wsId, firmId, id)).then(unwrap<DeliveryChallan>),

    create: (wsId: string, firmId: string, dto: Partial<DeliveryChallan>) =>
      http.post(S.deliveryChallans.create(wsId, firmId), dto).then(unwrap<DeliveryChallan>),

    update: (wsId: string, firmId: string, id: string, dto: Partial<DeliveryChallan>) =>
      http.patch(S.deliveryChallans.update(wsId, firmId, id), dto).then(unwrap<DeliveryChallan>),

    post: (wsId: string, firmId: string, id: string) =>
      http.post(S.deliveryChallans.post(wsId, firmId, id), {}).then(unwrap<DeliveryChallan>),

    cancel: (wsId: string, firmId: string, id: string, reason?: string) =>
      http
        .post(S.deliveryChallans.cancel(wsId, firmId, id), { reason })
        .then(unwrap<DeliveryChallan>),

    clone: (wsId: string, firmId: string, id: string) =>
      http.post(S.deliveryChallans.clone(wsId, firmId, id), {}).then(unwrap<DeliveryChallan>),

    // Generate an e-Way bill for a posted challan -> BE EwaybillService.generateForChallan.
    ewaybill: (wsId: string, firmId: string, id: string, dto: Record<string, unknown>) =>
      http
        .post(S.deliveryChallans.ewaybill(wsId, firmId, id), dto)
        .then(unwrap<{ ewbNo: string; validUpto: string }>),

    send: (wsId: string, firmId: string, id: string, body: Record<string, unknown>) =>
      http
        .post(S.deliveryChallans.send(wsId, firmId, id), body)
        .then(unwrap<{ dispatched: string[]; errors: Record<string, string> }>),

    delete: (wsId: string, firmId: string, id: string) =>
      http.delete(S.deliveryChallans.delete(wsId, firmId, id)).then(unwrap<{ ok: true }>),
  },

  // ── Recurring Templates ─────────────────────────────────────
  recurring: {
    list: (wsId: string, firmId: string, params?: Record<string, unknown>) =>
      http
        .get(S.recurring.list(wsId, firmId), { params })
        .then(unwrap<{ data: RecurringInvoiceTemplate[]; total: number }>),

    get: (wsId: string, firmId: string, id: string) =>
      http.get(S.recurring.get(wsId, firmId, id)).then(unwrap<RecurringInvoiceTemplate>),

    create: (wsId: string, firmId: string, dto: Partial<RecurringInvoiceTemplate>) =>
      http.post(S.recurring.create(wsId, firmId), dto).then(unwrap<RecurringInvoiceTemplate>),

    update: (wsId: string, firmId: string, id: string, dto: Partial<RecurringInvoiceTemplate>) =>
      http.patch(S.recurring.update(wsId, firmId, id), dto).then(unwrap<RecurringInvoiceTemplate>),

    delete: (wsId: string, firmId: string, id: string) =>
      http.delete(S.recurring.delete(wsId, firmId, id)).then(unwrap<{ ok: true }>),

    pause: (wsId: string, firmId: string, id: string) =>
      http.post(S.recurring.pause(wsId, firmId, id), {}).then(unwrap<RecurringInvoiceTemplate>),

    resume: (wsId: string, firmId: string, id: string) =>
      http.post(S.recurring.resume(wsId, firmId, id), {}).then(unwrap<RecurringInvoiceTemplate>),

    trigger: (wsId: string, firmId: string, id: string) =>
      http.post(S.recurring.trigger(wsId, firmId, id), {}).then(unwrap<{ invoiceId: string }>),
  },

  // ── Convert ─────────────────────────────────────────────────
  convert: (wsId: string, firmId: string, body: Record<string, unknown>) =>
    http
      .post(S.convert(wsId, firmId), body)
      .then(unwrap<SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan>),
};
