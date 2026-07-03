import client, { unwrap } from '../client';
import { financeBankReconciliation as E } from '../endpoints';
import type {
  BankStatement,
  BankStatementRow,
  ReconciliationSession,
  BankStatementPreview,
  BrsReport,
  AutoMatchSummary,
  BankReconciliationCandidate,
} from '@/types';

export const financeBankReconciliationApi = {
  // Upload (multipart - goes directly to backend via Axios, not server action)
  uploadStatement: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    file: File,
    genericMapping?: object,
  ): Promise<BankStatementPreview> => {
    const fd = new FormData();
    fd.append('file', file);
    if (genericMapping) fd.append('genericMapping', JSON.stringify(genericMapping));
    return unwrap<BankStatementPreview>(
      await client.post(E.uploadStatement(wsId, firmId, bankAccountId), fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },

  confirmStatement: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    file: File,
    genericMapping?: object,
  ): Promise<{ statementId: string; sessionId: string; totalRows: number }> => {
    const fd = new FormData();
    fd.append('file', file);
    if (genericMapping) fd.append('genericMapping', JSON.stringify(genericMapping));
    return unwrap(
      await client.post(E.confirmStatement(wsId, firmId, bankAccountId), fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },

  listStatements: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    params?: { skip?: number; limit?: number },
  ): Promise<{ items: BankStatement[]; total: number }> =>
    unwrap(await client.get(E.listStatements(wsId, firmId, bankAccountId), { params })),

  getStatement: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    statementId: string,
  ): Promise<BankStatement> =>
    unwrap(await client.get(E.getStatement(wsId, firmId, bankAccountId, statementId))),

  deleteStatement: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    statementId: string,
  ): Promise<void> => {
    await client.delete(E.deleteStatement(wsId, firmId, bankAccountId, statementId));
  },

  listSessions: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
  ): Promise<ReconciliationSession[]> =>
    unwrap(await client.get(E.listSessions(wsId, firmId, bankAccountId))),

  getSession: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
  ): Promise<ReconciliationSession> =>
    unwrap(await client.get(E.getSession(wsId, firmId, bankAccountId, sessionId))),

  listRows: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    params?: { status?: string; dateFrom?: string; dateTo?: string; skip?: number; limit?: number },
  ): Promise<{ items: BankStatementRow[]; total: number; summary: Record<string, number> }> =>
    unwrap(await client.get(E.listRows(wsId, firmId, bankAccountId, sessionId), { params })),

  autoMatch: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
  ): Promise<AutoMatchSummary> =>
    unwrap(await client.post(E.autoMatch(wsId, firmId, bankAccountId, sessionId))),

  manualMatch: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
    ledgerEntryIds: string[],
  ): Promise<BankStatementRow> =>
    unwrap(
      await client.post(E.manualMatch(wsId, firmId, bankAccountId, sessionId, rowId), {
        ledgerEntryIds,
      }),
    ),

  bulkMatch: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    payload: { bankStatementRowIds: string[]; ledgerEntryIds: string[] },
  ): Promise<{ matched: number }> =>
    unwrap(await client.post(E.bulkMatch(wsId, firmId, bankAccountId, sessionId), payload)),

  unmatch: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
  ): Promise<BankStatementRow> =>
    unwrap(await client.post(E.unmatch(wsId, firmId, bankAccountId, sessionId, rowId))),

  createVoucher: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
    payload: object,
  ): Promise<{ ledgerEntryId: string; rowId: string }> =>
    unwrap(
      await client.post(E.createVoucher(wsId, firmId, bankAccountId, sessionId, rowId), payload),
    ),

  excludeRow: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
    reason?: string,
  ): Promise<BankStatementRow> =>
    unwrap(
      await client.post(E.excludeRow(wsId, firmId, bankAccountId, sessionId, rowId), { reason }),
    ),

  unexcludeRow: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
  ): Promise<BankStatementRow> =>
    unwrap(await client.post(E.unexcludeRow(wsId, firmId, bankAccountId, sessionId, rowId))),

  candidates: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    rowId: string,
  ): Promise<BankReconciliationCandidate[]> =>
    unwrap(await client.get(E.candidates(wsId, firmId, bankAccountId, sessionId, rowId))),

  complete: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
    note?: string,
  ): Promise<ReconciliationSession> =>
    unwrap(await client.post(E.complete(wsId, firmId, bankAccountId, sessionId), { note })),

  report: async (
    wsId: string,
    firmId: string,
    bankAccountId: string,
    sessionId: string,
  ): Promise<BrsReport> =>
    unwrap(await client.get(E.report(wsId, firmId, bankAccountId, sessionId))),
};
