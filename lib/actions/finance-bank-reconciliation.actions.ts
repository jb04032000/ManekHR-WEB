'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { financeBankReconciliation as E } from '@/lib/api/endpoints';
import type {
  BankStatement,
  BankStatementRow,
  ReconciliationSession,
  BrsReport,
  AutoMatchSummary,
  BankReconciliationCandidate,
} from '@/types';

/** Note: multipart upload (uploadStatement / confirmStatement) uses the client-side
 *  financeBankReconciliationApi - FormData cannot flow through server actions. */

export async function listStatementsAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  params?: { skip?: number; limit?: number },
): Promise<{ items: BankStatement[]; total: number }> {
  const http = await serverHttp();
  return unwrapServer<{ items: BankStatement[]; total: number }>(
    await http.get(E.listStatements(wsId, firmId, bankAccountId), { params }),
  );
}

export async function getStatementAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  statementId: string,
): Promise<BankStatement> {
  const http = await serverHttp();
  return unwrapServer<BankStatement>(
    await http.get(E.getStatement(wsId, firmId, bankAccountId, statementId)),
  );
}

export async function deleteStatementAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  statementId: string,
): Promise<void> {
  const http = await serverHttp();
  await http.delete(E.deleteStatement(wsId, firmId, bankAccountId, statementId));
}

export async function listSessionsAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
): Promise<ReconciliationSession[]> {
  const http = await serverHttp();
  return unwrapServer<ReconciliationSession[]>(
    await http.get(E.listSessions(wsId, firmId, bankAccountId)),
  );
}

export async function getSessionAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
): Promise<ReconciliationSession> {
  const http = await serverHttp();
  return unwrapServer<ReconciliationSession>(
    await http.get(E.getSession(wsId, firmId, bankAccountId, sessionId)),
  );
}

export async function listRowsAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
  params?: { status?: string; dateFrom?: string; dateTo?: string; skip?: number; limit?: number },
): Promise<{ items: BankStatementRow[]; total: number; summary: Record<string, number> }> {
  const http = await serverHttp();
  return unwrapServer<{
    items: BankStatementRow[];
    total: number;
    summary: Record<string, number>;
  }>(await http.get(E.listRows(wsId, firmId, bankAccountId, sessionId), { params }));
}

export async function autoMatchAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
): Promise<AutoMatchSummary> {
  const http = await serverHttp();
  return unwrapServer<AutoMatchSummary>(
    await http.post(E.autoMatch(wsId, firmId, bankAccountId, sessionId), {}),
  );
}

export async function manualMatchAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
  rowId: string,
  ledgerEntryIds: string[],
): Promise<BankStatementRow> {
  const http = await serverHttp();
  return unwrapServer<BankStatementRow>(
    await http.post(E.manualMatch(wsId, firmId, bankAccountId, sessionId, rowId), {
      ledgerEntryIds,
    }),
  );
}

export async function bulkMatchAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
  payload: { bankStatementRowIds: string[]; ledgerEntryIds: string[] },
): Promise<{ matched: number }> {
  const http = await serverHttp();
  return unwrapServer<{ matched: number }>(
    await http.post(E.bulkMatch(wsId, firmId, bankAccountId, sessionId), payload),
  );
}

export async function unmatchRowAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
  rowId: string,
): Promise<BankStatementRow> {
  const http = await serverHttp();
  return unwrapServer<BankStatementRow>(
    await http.post(E.unmatch(wsId, firmId, bankAccountId, sessionId, rowId), {}),
  );
}

export async function createVoucherFromRowAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
  rowId: string,
  payload: object,
): Promise<{ ledgerEntryId: string; rowId: string }> {
  const http = await serverHttp();
  return unwrapServer<{ ledgerEntryId: string; rowId: string }>(
    await http.post(E.createVoucher(wsId, firmId, bankAccountId, sessionId, rowId), payload),
  );
}

export async function excludeRowAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
  rowId: string,
  reason?: string,
): Promise<BankStatementRow> {
  const http = await serverHttp();
  return unwrapServer<BankStatementRow>(
    await http.post(E.excludeRow(wsId, firmId, bankAccountId, sessionId, rowId), { reason }),
  );
}

export async function unexcludeRowAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
  rowId: string,
): Promise<BankStatementRow> {
  const http = await serverHttp();
  return unwrapServer<BankStatementRow>(
    await http.post(E.unexcludeRow(wsId, firmId, bankAccountId, sessionId, rowId), {}),
  );
}

export async function getCandidatesAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
  rowId: string,
): Promise<BankReconciliationCandidate[]> {
  const http = await serverHttp();
  return unwrapServer<BankReconciliationCandidate[]>(
    await http.get(E.candidates(wsId, firmId, bankAccountId, sessionId, rowId)),
  );
}

export async function completeSessionAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
  note?: string,
): Promise<ReconciliationSession> {
  const http = await serverHttp();
  return unwrapServer<ReconciliationSession>(
    await http.post(E.complete(wsId, firmId, bankAccountId, sessionId), { note }),
  );
}

export async function getBrsReportAction(
  wsId: string,
  firmId: string,
  bankAccountId: string,
  sessionId: string,
): Promise<BrsReport> {
  const http = await serverHttp();
  return unwrapServer<BrsReport>(await http.get(E.report(wsId, firmId, bankAccountId, sessionId)));
}
