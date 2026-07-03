'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { financeReports } from '@/lib/api/endpoints';
import type {
  TrialBalanceReport,
  ProfitLossReport,
  BalanceSheetReport,
  CashFlowReport,
  RatioAnalysisReport,
  EbitdaReport,
  DashboardKpiResponse,
  PartyStatementReport,
  AgingReport,
} from '@/types';

// ── Statutory Financial Reports ──────────────────────────────────────────────

export async function getTrialBalance(
  wsId: string, firmId: string, dateFrom: string, dateTo: string,
): Promise<TrialBalanceReport> {
  const http = await serverHttp();
  return http.get(financeReports.trialBalance(wsId, firmId, dateFrom, dateTo)).then(unwrapServer<TrialBalanceReport>);
}

export async function getProfitLoss(
  wsId: string, firmId: string, dateFrom: string, dateTo: string,
): Promise<ProfitLossReport> {
  const http = await serverHttp();
  return http.get(financeReports.profitLoss(wsId, firmId, dateFrom, dateTo)).then(unwrapServer<ProfitLossReport>);
}

export async function getBalanceSheet(
  wsId: string, firmId: string, asOfDate: string,
): Promise<BalanceSheetReport> {
  const http = await serverHttp();
  return http.get(financeReports.balanceSheet(wsId, firmId, asOfDate)).then(unwrapServer<BalanceSheetReport>);
}

export async function getCashFlow(
  wsId: string, firmId: string, dateFrom: string, dateTo: string,
): Promise<CashFlowReport> {
  const http = await serverHttp();
  return http.get(financeReports.cashFlow(wsId, firmId, dateFrom, dateTo)).then(unwrapServer<CashFlowReport>);
}

export async function getRatioAnalysis(
  wsId: string, firmId: string, dateFrom: string, dateTo: string,
): Promise<RatioAnalysisReport> {
  const http = await serverHttp();
  return http.get(financeReports.ratioAnalysis(wsId, firmId, dateFrom, dateTo)).then(unwrapServer<RatioAnalysisReport>);
}

export async function getEbitda(
  wsId: string, firmId: string, dateFrom: string, dateTo: string,
): Promise<EbitdaReport> {
  const http = await serverHttp();
  return http.get(financeReports.ebitda(wsId, firmId, dateFrom, dateTo)).then(unwrapServer<EbitdaReport>);
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardKpis(
  wsId: string, firmId: string,
): Promise<DashboardKpiResponse> {
  const http = await serverHttp();
  return http.get(financeReports.dashboardKpis(wsId, firmId)).then(unwrapServer<DashboardKpiResponse>);
}

// ── Party Reports ────────────────────────────────────────────────────────────

export async function getPartyStatement(
  wsId: string, firmId: string, partyId: string, dateFrom: string, dateTo: string,
): Promise<PartyStatementReport> {
  const http = await serverHttp();
  return http.get(financeReports.partyStatement(wsId, firmId, partyId, dateFrom, dateTo)).then(unwrapServer<PartyStatementReport>);
}

export async function getReceivablesAging(
  wsId: string, firmId: string, asOfDate?: string,
): Promise<AgingReport> {
  const http = await serverHttp();
  return http.get(financeReports.receivablesAging(wsId, firmId, asOfDate)).then(unwrapServer<AgingReport>);
}

export async function getPayablesAging(
  wsId: string, firmId: string, asOfDate?: string,
): Promise<AgingReport> {
  const http = await serverHttp();
  return http.get(financeReports.payablesAging(wsId, firmId, asOfDate)).then(unwrapServer<AgingReport>);
}
