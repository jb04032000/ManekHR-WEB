import http, { unwrap } from '../client';

// D19 onboarding import. Client posts already-column-mapped rows (the wizard maps the user's
// Excel/CSV columns to party fields); the BE ImportService validates + commits. Links:
// crewroster-backend ImportController .../finance/firms/:firmId/import/parties/{validate,commit}.

export type ImportRowStatus = 'valid' | 'error' | 'duplicate';

export interface PartyRowResult {
  index: number;
  status: ImportRowStatus;
  error?: string;
  party?: Record<string, string | undefined>;
}

export interface PartyImportDryRun {
  summary: { total: number; valid: number; errors: number; duplicates: number };
  rows: PartyRowResult[];
}

export interface OpeningBalanceRowResult {
  index: number;
  status: ImportRowStatus;
  error?: string;
  ob?: {
    accountId: string;
    accountCode: string;
    accountName: string;
    amountPaise: number;
    drOrCr: string;
    asOfDate: string;
  };
}

export interface OpeningBalanceImportDryRun {
  summary: { total: number; valid: number; errors: number; duplicates: number };
  rows: OpeningBalanceRowResult[];
}

export interface ItemRowResult {
  index: number;
  status: ImportRowStatus;
  error?: string;
  item?: {
    name: string;
    itemType: string;
    unit: string;
    hsnSacCode?: string;
    gstRate?: number;
    category?: string;
  };
}

export interface ItemImportDryRun {
  summary: { total: number; valid: number; errors: number; duplicates: number };
  rows: ItemRowResult[];
}

export interface PendingInvoiceRowResult {
  index: number;
  status: ImportRowStatus;
  error?: string;
  bill?: {
    partyId: string;
    partyName: string;
    voucherNumber: string;
    voucherDate: string;
    dueDate?: string;
    amountPaise: number;
  };
}

export interface PendingInvoiceImportDryRun {
  summary: { total: number; valid: number; errors: number; duplicates: number };
  rows: PendingInvoiceRowResult[];
}

export interface ImportCommitResult {
  created: number;
  skipped: number;
}

const base = (wsId: string, firmId: string) => `workspaces/${wsId}/finance/firms/${firmId}/import`;

export const financeImportApi = {
  // Dry-run: returns a per-row report. No writes.
  validateParties: (wsId: string, firmId: string, rows: Record<string, string>[]) =>
    http.post(`${base(wsId, firmId)}/parties/validate`, { rows }).then(unwrap<PartyImportDryRun>),

  // Commit: BE re-validates, creates only the valid rows.
  commitParties: (wsId: string, firmId: string, rows: Record<string, string>[]) =>
    http.post(`${base(wsId, firmId)}/parties/commit`, { rows }).then(unwrap<ImportCommitResult>),

  validateOpeningBalances: (wsId: string, firmId: string, rows: Record<string, string>[]) =>
    http
      .post(`${base(wsId, firmId)}/opening-balances/validate`, { rows })
      .then(unwrap<OpeningBalanceImportDryRun>),

  // Commit posts ledger entries through the lock-aware OB service.
  commitOpeningBalances: (wsId: string, firmId: string, rows: Record<string, string>[]) =>
    http
      .post(`${base(wsId, firmId)}/opening-balances/commit`, { rows })
      .then(unwrap<ImportCommitResult>),

  validateItems: (wsId: string, firmId: string, rows: Record<string, string>[]) =>
    http.post(`${base(wsId, firmId)}/items/validate`, { rows }).then(unwrap<ItemImportDryRun>),

  commitItems: (wsId: string, firmId: string, rows: Record<string, string>[]) =>
    http.post(`${base(wsId, firmId)}/items/commit`, { rows }).then(unwrap<ImportCommitResult>),

  validatePendingInvoices: (wsId: string, firmId: string, rows: Record<string, string>[]) =>
    http
      .post(`${base(wsId, firmId)}/pending-invoices/validate`, { rows })
      .then(unwrap<PendingInvoiceImportDryRun>),

  // Commit posts each bill Dr Debtors / Cr 3004 through the central posting service.
  commitPendingInvoices: (wsId: string, firmId: string, rows: Record<string, string>[]) =>
    http
      .post(`${base(wsId, firmId)}/pending-invoices/commit`, { rows })
      .then(unwrap<ImportCommitResult>),
};
