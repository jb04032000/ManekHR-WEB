'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  Firm,
  FirmBrandProfile,
  Account,
  Party,
  FinanceItem,
  VoucherSeries,
  AccountantInvite,
  CashRegister,
  GstinLookup,
  FinanceChecklistItem,
  SaleInvoice,
  Quotation,
  SaleOrder,
  Proforma,
  DeliveryChallan,
  RecurringInvoiceTemplate,
  RecurringExpenseTemplate,
  SalesKpiSummary,
  PaymentReceipt,
  CreatePaymentReceiptPayload,
  PartyLedgerRow,
  AgingPartyRow,
  ReceivablesSummary,
  OutstandingInvoice,
} from '@/types';

const E = ApiEndpoints.finance;

// ---- Firm (1:1 with Workspace) ----
// Firm is auto-created with Workspace; no createFirm/deleteFirm exposed.

export async function listFirms(wsId: string) {
  const http = await serverHttp();
  return http.get(E.firms(wsId)).then(unwrapServer<Firm[]>);
}

/**
 * Returns the workspace's single firm (1:1). Prefer this over listFirms[0].
 * Returns null if firm hasn't been created yet (edge case - auto-create
 * should have run on workspace creation).
 */
export async function getCurrentFirm(wsId: string): Promise<Firm | null> {
  try {
    const http = await serverHttp();
    return await http.get(E.currentFirm(wsId)).then(unwrapServer<Firm | null>);
  } catch {
    // 403 (finance module locked) or other failure → return null. The finance
    // dashboard now checks the finance entitlement client-side (useFeatureAccess
    // 'finance') BEFORE interpreting a null firm, so a locked module renders the
    // "not in your plan" upgrade state and only a genuinely-missing firm (entitled
    // but cascade-failed) falls through to the recovery prompt.
    return null;
  }
}

/**
 * Idempotent recovery: creates the workspace's firm if it doesn't exist,
 * otherwise returns the existing one. Used by the workspace settings page
 * when the create-time cascade failed.
 */
export async function ensureFirm(
  wsId: string,
  data?: Partial<Pick<Firm, 'firmName' | 'businessType' | 'gstin' | 'pan' | 'fyStartMonth'>>,
) {
  const http = await serverHttp();
  return http.post(E.ensureFirm(wsId), data ?? {}).then(unwrapServer<Firm>);
}

export async function getFirm(wsId: string, firmId: string) {
  const http = await serverHttp();
  return http.get(E.firm(wsId, firmId)).then(unwrapServer<Firm>);
}

export async function updateFirm(wsId: string, firmId: string, data: Partial<Firm>) {
  const http = await serverHttp();
  return http.patch(E.firm(wsId, firmId), data).then(unwrapServer<Firm>);
}

// D21: set/clear the firm's period-lock date (postings dated on/before it are blocked by
// FyLockService). Send null to unlock. Dedicated /books-lock endpoint (finance.settings.manage)
// - NOT the generic firm PATCH, whose DTO whitelist would strip the field.
export async function setFirmBooksLock(
  wsId: string,
  firmId: string,
  lockedUptoDate: string | null,
) {
  const http = await serverHttp();
  return http.patch(E.firmBooksLock(wsId, firmId), { lockedUptoDate }).then(unwrapServer<Firm>);
}

// D15 platform-admin GST rate editor. Reads a prefix's effective-dated timeline; reviseGstRate
// records a new rate (BE end-dates the current open row, guarantees no overlap). Global, not
// workspace-scoped; the revise endpoint is platform-admin gated (IsAdminGuard) server-side.
export interface GstRateRow {
  _id: string;
  hsnPrefix: string;
  description?: string;
  fromDate: string;
  toDate?: string | null;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate?: number;
  notification?: string;
  // R6: who/when audit on the row (null on the system-seeded 2017-2026 rates).
  revisedBy?: string;
  revisedByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function getGstRateHistory(hsnPrefix: string): Promise<GstRateRow[]> {
  const http = await serverHttp();
  return http.get(E.gstRateHistory(hsnPrefix)).then(unwrapServer<GstRateRow[]>);
}

// R6: browse the whole rate registry (paginated, optional search) for the admin editor.
export async function listAllGstRates(params?: {
  q?: string;
  skip?: number;
  limit?: number;
}): Promise<{ data: GstRateRow[]; total: number }> {
  const http = await serverHttp();
  const res = await http.get(E.gstRateList, { params });
  const body = (res as { data?: unknown }).data as
    | { data?: GstRateRow[]; total?: number }
    | undefined;
  return { data: body?.data ?? [], total: body?.total ?? 0 };
}

export async function reviseGstRate(payload: {
  hsnPrefix: string;
  fromDate: string;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate?: number;
  description?: string;
  notification?: string;
}): Promise<GstRateRow> {
  const http = await serverHttp();
  return http.post(E.gstRateRevise, payload).then(unwrapServer<GstRateRow>);
}

/**
 * Finance branding editor (design spec 2026-06-01 SS2C / SS6.A). Persists the
 * voucher branding keys (logo / signature / colours / footer / T&C /
 * declaration / bank + UPI) onto `firm.brandProfile`. Hits the dedicated
 * branding endpoint gated by `finance.settings.manage` on the backend; partial
 * payloads update only the supplied keys.
 */
export async function updateFirmBranding(wsId: string, firmId: string, data: FirmBrandProfile) {
  const http = await serverHttp();
  return http.patch(E.firmBranding(wsId, firmId), data).then(unwrapServer<Firm>);
}

/**
 * Invoice layout config editor (design spec 2026-06-01 SS2C / 3B). Persists
 * the five show/hide flags onto `firm.invoiceLayout`. Hits the dedicated
 * invoice-layout endpoint gated by `finance.settings.manage` on the backend.
 * Partial payloads update only the supplied flags and never clobber siblings.
 */
export async function updateFirmInvoiceLayout(
  wsId: string,
  firmId: string,
  data: {
    showHsnColumn?: boolean;
    showDiscountColumn?: boolean;
    showBankDetails?: boolean;
    showSignature?: boolean;
    showTermsAndConditions?: boolean;
  },
) {
  const http = await serverHttp();
  return http.patch(E.firmInvoiceLayout(wsId, firmId), data).then(unwrapServer<Firm>);
}

/**
 * 2f multi-GSTIN: replace the firm's additional state GSTIN registrations.
 * The primary `gstin` stays on the firm record. Gated by `finance.settings.manage`.
 */
export async function updateFirmGstins(
  wsId: string,
  firmId: string,
  additionalGstins: { gstin: string; stateCode: string; label?: string }[],
) {
  const http = await serverHttp();
  return http.patch(E.firmGstins(wsId, firmId), { additionalGstins }).then(unwrapServer<Firm>);
}

// ─── 4a recurring expenses ──────────────────────────────────────────────────

export async function listRecurringExpenses(wsId: string, firmId: string) {
  const http = await serverHttp();
  return http.get(E.recurringExpenses(wsId, firmId)).then(unwrapServer<RecurringExpenseTemplate[]>);
}

export async function createRecurringExpense(
  wsId: string,
  firmId: string,
  data: Partial<RecurringExpenseTemplate>,
) {
  const http = await serverHttp();
  return http
    .post(E.recurringExpenses(wsId, firmId), data)
    .then(unwrapServer<RecurringExpenseTemplate>);
}

export async function updateRecurringExpense(
  wsId: string,
  firmId: string,
  id: string,
  data: Partial<RecurringExpenseTemplate>,
) {
  const http = await serverHttp();
  return http
    .patch(E.recurringExpense(wsId, firmId, id), data)
    .then(unwrapServer<RecurringExpenseTemplate>);
}

export async function deleteRecurringExpense(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  return http.delete(E.recurringExpense(wsId, firmId, id)).then(unwrapServer<unknown>);
}

export async function recurringExpenseAction(
  wsId: string,
  firmId: string,
  id: string,
  action: 'pause' | 'resume' | 'trigger',
) {
  const http = await serverHttp();
  return http
    .post(E.recurringExpenseAction(wsId, firmId, id, action), {})
    .then(unwrapServer<unknown>);
}

export async function updateFirmWizardStep(
  wsId: string,
  firmId: string,
  step: 1 | 2 | 3,
  data: Record<string, unknown>,
) {
  const http = await serverHttp();
  return http.post(E.firmWizardStep(wsId, firmId, step), data).then(unwrapServer<Firm>);
}

// ---- Accounts ----
export async function listAccounts(wsId: string, firmId: string) {
  const http = await serverHttp();
  return http.get(E.accounts(wsId, firmId)).then(unwrapServer<Account[]>);
}

export async function createAccount(wsId: string, firmId: string, data: Partial<Account>) {
  const http = await serverHttp();
  return http.post(E.accounts(wsId, firmId), data).then(unwrapServer<Account>);
}

// Edit a ledger's name/group/subGroup. Backend (accounts.controller PATCH) keeps
// code/type/isSystem authoritative and re-validates tenant scope from the session.
export async function updateAccount(
  wsId: string,
  firmId: string,
  accountId: string,
  data: Partial<Account>,
) {
  const http = await serverHttp();
  return http.patch(E.account(wsId, firmId, accountId), data).then(unwrapServer<Account>);
}

// Soft-archive a ledger (backend DELETE = isDeleted:true). System accounts are
// rejected server-side, so the UI also hides the action for them.
export async function archiveAccount(wsId: string, firmId: string, accountId: string) {
  const http = await serverHttp();
  return http.delete(E.account(wsId, firmId, accountId)).then(unwrapServer<unknown>);
}

// Set/replace a ledger's opening balance. Server posts the balancing 'opening_balance'
// ledger entry (contra 3004 Opening Balance Equity) so it flows into reports; amountPaise
// 0 clears it. drOrCr is the side of this account.
export async function setAccountOpeningBalance(
  wsId: string,
  firmId: string,
  accountId: string,
  data: { amountPaise: number; drOrCr: 'debit' | 'credit'; asOfDate: string },
) {
  const http = await serverHttp();
  return http
    .patch(E.accountOpeningBalance(wsId, firmId, accountId), data)
    .then(unwrapServer<Account>);
}

// ---- Parties ----
export async function listParties(wsId: string, firmId: string, params?: Record<string, unknown>) {
  const http = await serverHttp();
  return http
    .get(E.parties(wsId, firmId), { params })
    .then(unwrapServer<{ items: Party[]; total: number }>);
}

export async function createParty(wsId: string, firmId: string, data: Partial<Party>) {
  const http = await serverHttp();
  return http.post(E.parties(wsId, firmId), data).then(unwrapServer<Party>);
}

export async function updateParty(
  wsId: string,
  firmId: string,
  partyId: string,
  data: Partial<Party>,
) {
  const http = await serverHttp();
  return http.patch(E.party(wsId, firmId, partyId), data).then(unwrapServer<Party>);
}

export async function deleteParty(wsId: string, firmId: string, partyId: string) {
  const http = await serverHttp();
  return http.delete(E.party(wsId, firmId, partyId)).then(unwrapServer<void>);
}

// ---- Items ----
export async function listItems(wsId: string, firmId: string) {
  const http = await serverHttp();
  return http.get(E.items(wsId, firmId)).then(unwrapServer<FinanceItem[]>);
}

export async function createItem(wsId: string, firmId: string, data: Partial<FinanceItem>) {
  const http = await serverHttp();
  return http.post(E.items(wsId, firmId), data).then(unwrapServer<FinanceItem>);
}

export async function updateItem(
  wsId: string,
  firmId: string,
  itemId: string,
  data: Partial<FinanceItem>,
) {
  const http = await serverHttp();
  return http.patch(E.item(wsId, firmId, itemId), data).then(unwrapServer<FinanceItem>);
}

// ---- VoucherSeries ----
export async function listVoucherSeries(wsId: string, firmId: string) {
  const http = await serverHttp();
  return http.get(E.voucherSeries(wsId, firmId)).then(unwrapServer<VoucherSeries[]>);
}

export async function createVoucherSeries(
  wsId: string,
  firmId: string,
  data: Partial<VoucherSeries>,
) {
  const http = await serverHttp();
  return http.post(E.voucherSeries(wsId, firmId), data).then(unwrapServer<VoucherSeries>);
}

/**
 * Custom invoice numbering editor (2026-06-01).
 * Updates prefix / padDigits / startNumber for a single VoucherSeries row.
 * Hits the PATCH endpoint gated by finance.settings.manage.
 */
export async function updateVoucherSeries(
  wsId: string,
  firmId: string,
  id: string,
  data: { prefix?: string; padDigits?: number; startNumber?: number },
) {
  const http = await serverHttp();
  return http.patch(E.voucherSeriesItem(wsId, firmId, id), data).then(unwrapServer<VoucherSeries>);
}

// ---- Accountant Invites ----
export async function listAccountantInvites(wsId: string, firmId: string) {
  const http = await serverHttp();
  return http.get(E.accountantInvites(wsId, firmId)).then(unwrapServer<AccountantInvite[]>);
}

export async function createAccountantInvite(
  wsId: string,
  firmId: string,
  data: { email: string; scopeRole?: string },
) {
  const http = await serverHttp();
  return http.post(E.accountantInvites(wsId, firmId), data).then(unwrapServer<AccountantInvite>);
}

export async function revokeAccountantInvite(wsId: string, firmId: string, inviteId: string) {
  const http = await serverHttp();
  return http.delete(E.accountantInvite(wsId, firmId, inviteId)).then(unwrapServer<void>);
}

/**
 * Accept an accountant invite from the email link. Runs server-side via the
 * authenticated client, so the BE binds the acceptance to the signed-in user and
 * checks their email matches the invite (SEC-3).
 *
 * Returns a result rather than throwing so the backend's friendly message
 * (401 not-signed-in, 403 email-mismatch, 404 invalid/expired/used) reaches the
 * client - Next masks thrown server-action errors in production.
 */
export async function acceptAccountantInvite(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const http = await serverHttp();
  try {
    await http.post(E.acceptAccountantInvite(token), {}).then(unwrapServer<void>);
    return { ok: true };
  } catch (e: unknown) {
    // The backend wraps errors as { error: { message } } (see serverHttp
    // interceptor); fall back to the plain message, then a generic one.
    const err = e as {
      response?: { data?: { error?: { message?: string }; message?: string } };
      message?: string;
    };
    return {
      ok: false,
      error:
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        err?.message ??
        'Could not accept this invite. It may have expired or already been used.',
    };
  }
}

// ---- Cash Registers ----
export async function listCashRegisters(wsId: string, firmId: string) {
  const http = await serverHttp();
  return http.get(E.cashRegisters(wsId, firmId)).then(unwrapServer<CashRegister[]>);
}

// ---- GSTIN Lookup ----
export async function gstinLookup(wsId: string, gstin: string, firmId?: string) {
  const http = await serverHttp();
  return http
    .get(E.gstinLookup(wsId), { params: { gstin, firmId } })
    .then(unwrapServer<GstinLookup>);
}

// ---- Recycle Bin ----
export async function listRecycleBin(wsId: string, firmId: string, type?: string) {
  const http = await serverHttp();
  return http
    .get(E.recycleBin(wsId, firmId), { params: type ? { type } : {} })
    .then(
      unwrapServer<{ type: string; record: { _id: string; name: string; deletedAt?: string } }[]>,
    );
}

export async function restoreFromRecycleBin(
  wsId: string,
  firmId: string,
  id: string,
  type: string,
) {
  const http = await serverHttp();
  return http
    .post(E.recycleBinRestore(wsId, firmId, id), {}, { params: { type } })
    .then(unwrapServer<void>);
}

export async function permanentDeleteFromRecycleBin(
  wsId: string,
  firmId: string,
  id: string,
  type: string,
) {
  const http = await serverHttp();
  return http
    .delete(E.recycleBinPermanent(wsId, firmId, id), { params: { type } })
    .then(unwrapServer<void>);
}

// ---- Setup Checklist ----
export async function getSetupChecklist(wsId: string, firmId: string) {
  const http = await serverHttp();
  return http.get(E.setupChecklist(wsId, firmId)).then(unwrapServer<FinanceChecklistItem[]>);
}

// ════════════════════════════════════════════════════════════
// Sales - F-02 Server Actions
// ════════════════════════════════════════════════════════════

const S = ApiEndpoints.finance.sales;

// ── D-26: KPI aggregation (server-side $match + $group - NOT a client reduce) ──
export async function getSalesKpiSummary(
  wsId: string,
  firmId: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const http = await serverHttp();
  return http
    .get(S.invoices.kpiSummary(wsId, firmId, dateFrom, dateTo))
    .then(unwrapServer<SalesKpiSummary>);
}

// ── Sale Invoices ────────────────────────────────────────────
export async function listSaleInvoices(
  wsId: string,
  firmId: string,
  filters: Record<string, unknown> = {},
) {
  const http = await serverHttp();
  return http
    .get(S.invoices.list(wsId, firmId), { params: filters })
    .then(unwrapServer<{ data: SaleInvoice[]; total: number }>);
}

export async function getSaleInvoice(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  return http.get(S.invoices.get(wsId, firmId, id)).then(unwrapServer<SaleInvoice>);
}

export async function createSaleInvoice(wsId: string, firmId: string, dto: Partial<SaleInvoice>) {
  const http = await serverHttp();
  return http.post(S.invoices.create(wsId, firmId), dto).then(unwrapServer<SaleInvoice>);
}

export async function updateSaleInvoice(
  wsId: string,
  firmId: string,
  id: string,
  dto: Partial<SaleInvoice>,
) {
  const http = await serverHttp();
  return http.patch(S.invoices.update(wsId, firmId, id), dto).then(unwrapServer<SaleInvoice>);
}

export async function postSaleInvoice(
  wsId: string,
  firmId: string,
  id: string,
  idempotencyKey: string,
) {
  const http = await serverHttp();
  return http
    .post(
      S.invoices.post(wsId, firmId, id),
      {},
      {
        headers: { 'X-Idempotency-Key': idempotencyKey },
      },
    )
    .then(unwrapServer<SaleInvoice>);
}

export async function approveSaleInvoice(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  return http.post(S.invoices.approve(wsId, firmId, id), {}).then(unwrapServer<SaleInvoice>);
}

export async function rejectSaleInvoice(wsId: string, firmId: string, id: string, reason: string) {
  const http = await serverHttp();
  return http.post(S.invoices.reject(wsId, firmId, id), { reason }).then(unwrapServer<SaleInvoice>);
}

export async function cancelSaleInvoice(wsId: string, firmId: string, id: string, reason?: string) {
  const http = await serverHttp();
  return http.post(S.invoices.cancel(wsId, firmId, id), { reason }).then(unwrapServer<SaleInvoice>);
}

export async function cloneSaleInvoice(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  return http.post(S.invoices.clone(wsId, firmId, id), {}).then(unwrapServer<SaleInvoice>);
}

export async function sendSaleInvoice(
  wsId: string,
  firmId: string,
  id: string,
  body: Record<string, unknown>,
) {
  const http = await serverHttp();
  return http
    .post(S.invoices.send(wsId, firmId, id), body)
    .then(
      unwrapServer<{ dispatched: string[]; invoiceId: string; errors: Record<string, string> }>,
    );
}

export async function voidSaleInvoice(wsId: string, firmId: string, id: string, reason?: string) {
  const http = await serverHttp();
  return http
    .post(S.invoices.cancel(wsId, firmId, id), { reason, action: 'void' })
    .then(unwrapServer<SaleInvoice>);
}

export async function einvoiceSaleInvoice(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  return http
    .post(S.invoices.einvoice(wsId, firmId, id), {})
    .then(unwrapServer<{ irn: string; ackNo: string; ackDate: string; signedQrCode: string }>);
}

export async function ewaybillSaleInvoice(
  wsId: string,
  firmId: string,
  id: string,
  dto: Record<string, unknown>,
) {
  const http = await serverHttp();
  return http.post(S.invoices.ewaybill(wsId, firmId, id), dto).then(unwrapServer<unknown>);
}

export async function lateFeeOverrideSaleInvoice(
  wsId: string,
  firmId: string,
  id: string,
  body: Record<string, unknown>,
) {
  const http = await serverHttp();
  return http
    .post(S.invoices.lateFeeOverride(wsId, firmId, id), body)
    .then(unwrapServer<SaleInvoice>);
}

// ── Quotations ───────────────────────────────────────────────
export async function listSalesVouchers(
  type: 'quotations' | 'orders' | 'proforma' | 'delivery-challans' | 'invoices',
  wsId: string,
  firmId: string,
  filters: Record<string, unknown> = {},
) {
  const http = await serverHttp();
  const url = `workspaces/${wsId}/finance/firms/${firmId}/sales/${type}`;
  return http.get(url, { params: filters }).then(
    unwrapServer<{
      data: (SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan)[];
      total: number;
    }>,
  );
}

export async function getSalesVoucher(
  type: 'quotations' | 'orders' | 'proforma' | 'delivery-challans' | 'invoices',
  wsId: string,
  firmId: string,
  id: string,
) {
  const http = await serverHttp();
  const url = `workspaces/${wsId}/finance/firms/${firmId}/sales/${type}/${id}`;
  return http
    .get(url)
    .then(unwrapServer<SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan>);
}

export async function createSalesVoucher(
  type: 'quotations' | 'orders' | 'proforma' | 'delivery-challans' | 'invoices',
  wsId: string,
  firmId: string,
  dto: Record<string, unknown>,
) {
  const http = await serverHttp();
  const url = `workspaces/${wsId}/finance/firms/${firmId}/sales/${type}`;
  return http
    .post(url, dto)
    .then(unwrapServer<SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan>);
}

export async function updateSalesVoucher(
  type: 'quotations' | 'orders' | 'proforma' | 'delivery-challans' | 'invoices',
  wsId: string,
  firmId: string,
  id: string,
  dto: Record<string, unknown>,
) {
  const http = await serverHttp();
  const url = `workspaces/${wsId}/finance/firms/${firmId}/sales/${type}/${id}`;
  return http
    .patch(url, dto)
    .then(unwrapServer<SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan>);
}

export async function postSalesVoucher(
  wsId: string,
  firmId: string,
  type: string,
  id: string,
  idempotencyKey?: string,
) {
  const http = await serverHttp();
  const url = `workspaces/${wsId}/finance/firms/${firmId}/sales/${type}/${id}/post`;
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
  return http
    .post(url, {}, { headers })
    .then(unwrapServer<SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan>);
}

export async function cancelSalesVoucher(
  wsId: string,
  firmId: string,
  type: string,
  id: string,
  reason?: string,
) {
  const http = await serverHttp();
  const url = `workspaces/${wsId}/finance/firms/${firmId}/sales/${type}/${id}/cancel`;
  return http
    .post(url, { reason })
    .then(unwrapServer<SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan>);
}

export async function cloneSalesVoucher(wsId: string, firmId: string, type: string, id: string) {
  const http = await serverHttp();
  const url = `workspaces/${wsId}/finance/firms/${firmId}/sales/${type}/${id}/clone`;
  return http
    .post(url, {})
    .then(unwrapServer<SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan>);
}

export async function sendSalesVoucher(
  wsId: string,
  firmId: string,
  type: string,
  id: string,
  body: Record<string, unknown>,
) {
  const http = await serverHttp();
  const url = `workspaces/${wsId}/finance/firms/${firmId}/sales/${type}/${id}/send`;
  return http
    .post(url, body)
    .then(unwrapServer<{ dispatched: string[]; errors: Record<string, string> }>);
}

export async function voidSalesVoucher(
  wsId: string,
  firmId: string,
  type: string,
  id: string,
  reason?: string,
) {
  const http = await serverHttp();
  const url = `workspaces/${wsId}/finance/firms/${firmId}/sales/${type}/${id}/cancel`;
  return http
    .post(url, { reason, action: 'void' })
    .then(unwrapServer<SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan>);
}

// ── Recurring Templates ──────────────────────────────────────
export async function listRecurringTemplates(
  wsId: string,
  firmId: string,
  params: Record<string, unknown> = {},
) {
  const http = await serverHttp();
  return http
    .get(S.recurring.list(wsId, firmId), { params })
    .then(unwrapServer<{ data: RecurringInvoiceTemplate[]; total: number }>);
}

export async function getRecurringTemplate(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  return http.get(S.recurring.get(wsId, firmId, id)).then(unwrapServer<RecurringInvoiceTemplate>);
}

export async function createRecurringTemplate(
  wsId: string,
  firmId: string,
  dto: Partial<RecurringInvoiceTemplate>,
) {
  const http = await serverHttp();
  return http
    .post(S.recurring.create(wsId, firmId), dto)
    .then(unwrapServer<RecurringInvoiceTemplate>);
}

export async function updateRecurringTemplate(
  wsId: string,
  firmId: string,
  id: string,
  dto: Partial<RecurringInvoiceTemplate>,
) {
  const http = await serverHttp();
  return http
    .patch(S.recurring.update(wsId, firmId, id), dto)
    .then(unwrapServer<RecurringInvoiceTemplate>);
}

export async function pauseRecurringTemplate(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  return http
    .post(S.recurring.pause(wsId, firmId, id), {})
    .then(unwrapServer<RecurringInvoiceTemplate>);
}

export async function resumeRecurringTemplate(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  return http
    .post(S.recurring.resume(wsId, firmId, id), {})
    .then(unwrapServer<RecurringInvoiceTemplate>);
}

export async function triggerRecurringTemplate(wsId: string, firmId: string, id: string) {
  const http = await serverHttp();
  return http
    .post(S.recurring.trigger(wsId, firmId, id), {})
    .then(unwrapServer<{ invoiceId: string }>);
}

// ── Convert ──────────────────────────────────────────────────
export async function convertVouchers(wsId: string, firmId: string, body: Record<string, unknown>) {
  const http = await serverHttp();
  return http
    .post(S.convert(wsId, firmId), body)
    .then(unwrapServer<SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan>);
}

// ─── F-03: Payments-In + Party Ledger ────────────────────────────────────────

const P = ApiEndpoints.finance.payments;

export async function listPaymentReceipts(
  wsId: string,
  firmId: string,
  params?: {
    partyId?: string;
    state?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  },
): Promise<PaymentReceipt[]> {
  const http = await serverHttp();
  return http.get(P.receipts.list(wsId, firmId), { params }).then(unwrapServer<PaymentReceipt[]>);
}

export async function createPaymentReceipt(
  wsId: string,
  firmId: string,
  payload: CreatePaymentReceiptPayload,
): Promise<PaymentReceipt> {
  const http = await serverHttp();
  return http.post(P.receipts.create(wsId, firmId), payload).then(unwrapServer<PaymentReceipt>);
}

export async function getPaymentReceipt(
  wsId: string,
  firmId: string,
  id: string,
): Promise<PaymentReceipt> {
  const http = await serverHttp();
  return http.get(P.receipts.get(wsId, firmId, id)).then(unwrapServer<PaymentReceipt>);
}

export async function postPaymentReceipt(
  wsId: string,
  firmId: string,
  id: string,
  idempotencyKey?: string,
): Promise<PaymentReceipt> {
  const http = await serverHttp();
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;
  return http
    .post(P.receipts.post(wsId, firmId, id), {}, { headers })
    .then(unwrapServer<PaymentReceipt>);
}

export async function cancelPaymentReceipt(
  wsId: string,
  firmId: string,
  id: string,
  reason?: string,
): Promise<PaymentReceipt> {
  const http = await serverHttp();
  return http
    .post(P.receipts.cancel(wsId, firmId, id), { reason })
    .then(unwrapServer<PaymentReceipt>);
}

export async function getPartyLedger(
  wsId: string,
  firmId: string,
  partyId: string,
  params?: { fromDate?: string; toDate?: string },
): Promise<PartyLedgerRow[]> {
  const http = await serverHttp();
  return http
    .get(P.partyLedger(wsId, firmId, partyId), { params })
    .then(unwrapServer<PartyLedgerRow[]>);
}

export async function getOutstandingInvoices(
  wsId: string,
  firmId: string,
  partyId: string,
): Promise<OutstandingInvoice[]> {
  const http = await serverHttp();
  return http
    .get(P.outstandingInvoices(wsId, firmId, partyId))
    .then(unwrapServer<OutstandingInvoice[]>);
}

export async function getAgingBuckets(wsId: string, firmId: string): Promise<AgingPartyRow[]> {
  const http = await serverHttp();
  return http.get(P.agingBuckets(wsId, firmId)).then(unwrapServer<AgingPartyRow[]>);
}

export async function getReceivablesSummary(
  wsId: string,
  firmId: string,
): Promise<ReceivablesSummary> {
  const http = await serverHttp();
  return http.get(P.receivablesSummary(wsId, firmId)).then(unwrapServer<ReceivablesSummary>);
}
