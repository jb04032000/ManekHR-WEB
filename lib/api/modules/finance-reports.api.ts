import http, { unwrap } from '../client';
import { financeReports } from '../endpoints';
import type {
  TrialBalanceReport,
  ProfitLossReport,
  ProfitLossComparisonMonth,
  BalanceSheetReport,
  CashFlowReport,
  RatioAnalysisReport,
  EbitdaReport,
  DashboardKpiResponse,
  RevenueTrendResponse,
  AccountingDashboardResponse,
  GstOutputRegisterRow,
  ItcReconciliationRow,
  EinvoiceRegisterRow,
  PartyStatementReport,
  AgingReport,
  DaybookRow,
  RegisterRow,
  ItemLedgerRow,
  ItemProfitabilityRow,
  GodownStockRow,
  WastageRegisterRow,
  MvRegisterRow,
  JobWorkPendingRow,
  KarigarProductivityRow,
  MachineOutputRow,
  FixedAssetRegisterRow,
  DepreciationScheduleRow,
  BrokerCommissionRow,
  PartyWisePlRow,
  CapitalGoodsItcRow,
  EwbRegisterRow,
} from '@/types';

const E = financeReports;

// FLAT shape - all methods directly on financeReportsApi (no nesting)
export const financeReportsApi = {
  // ── Statutory Financial Reports ────────────────────────────────────────────

  trialBalance: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http.get(E.trialBalance(wsId, firmId, dateFrom, dateTo)).then(unwrap<TrialBalanceReport>),

  profitLoss: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http.get(E.profitLoss(wsId, firmId, dateFrom, dateTo)).then(unwrap<ProfitLossReport>),

  profitLossComparison: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.profitLossComparison(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<{ months: ProfitLossComparisonMonth[] }>),

  balanceSheet: (wsId: string, firmId: string, asOfDate: string) =>
    http.get(E.balanceSheet(wsId, firmId, asOfDate)).then(unwrap<BalanceSheetReport>),

  cashFlow: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http.get(E.cashFlow(wsId, firmId, dateFrom, dateTo)).then(unwrap<CashFlowReport>),

  ratioAnalysis: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http.get(E.ratioAnalysis(wsId, firmId, dateFrom, dateTo)).then(unwrap<RatioAnalysisReport>),

  ebitda: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http.get(E.ebitda(wsId, firmId, dateFrom, dateTo)).then(unwrap<EbitdaReport>),

  // ── Dashboard ──────────────────────────────────────────────────────────────

  dashboardKpis: (wsId: string, firmId: string) =>
    http.get(E.dashboardKpis(wsId, firmId)).then(unwrap<DashboardKpiResponse>),

  revenueTrend: (
    wsId: string,
    firmId: string,
    mode: 'current_fy' | 'last_12_months' = 'current_fy',
  ) => http.get(E.revenueTrend(wsId, firmId, mode)).then(unwrap<RevenueTrendResponse>),

  // Aggregate accounting dashboard (PowerBI-style). Backs AccountingInsights on the
  // finance dashboard — one call returns KPIs, P&L trend, balance sheet, cash flow,
  // ratios, EBITDA, aging + cash movement. Params optional; BE defaults to current FY.
  accountingDashboard: (
    wsId: string,
    firmId: string,
    params?: { dateFrom?: string; dateTo?: string; asOfDate?: string },
  ) =>
    http.get(E.accountingDashboard(wsId, firmId, params)).then(unwrap<AccountingDashboardResponse>),

  // ── GST Registers ──────────────────────────────────────────────────────────

  gstOutputRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.gstOutputRegister(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<{ rows: GstOutputRegisterRow[]; totals: Record<string, number> }>),

  gstInputRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.gstInputRegister(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<{ rows: GstOutputRegisterRow[]; totals: Record<string, number> }>),

  itcReconciliation: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.itcReconciliation(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<ItcReconciliationRow[]>),

  capitalGoodsItc: (wsId: string, firmId: string) =>
    http
      .get(E.capitalGoodsItc(wsId, firmId))
      .then(unwrap<{ schedule: CapitalGoodsItcRow[]; monthlyReleasePaise: number }>),

  einvoiceRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.einvoiceRegister(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<EinvoiceRegisterRow[]>),

  ewbRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http.get(E.ewbRegister(wsId, firmId, dateFrom, dateTo)).then(unwrap<EwbRegisterRow[]>),

  lateFeeRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.lateFeeRegister(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<{ rows: any[]; totalLateFeePaise: number }>),

  gstr1: (wsId: string, firmId: string, period: string) =>
    http.get(E.gstr1(wsId, firmId, period)).then(unwrap<any>),

  gstr3b: (wsId: string, firmId: string, period: string) =>
    http.get(E.gstr3b(wsId, firmId, period)).then(unwrap<any>),

  // ── Party & Ledger ─────────────────────────────────────────────────────────

  partyStatement: (
    wsId: string,
    firmId: string,
    partyId: string,
    dateFrom: string,
    dateTo: string,
  ) =>
    http
      .get(E.partyStatement(wsId, firmId, partyId, dateFrom, dateTo))
      .then(unwrap<PartyStatementReport>),

  accountLedger: (
    wsId: string,
    firmId: string,
    accountCode: string,
    dateFrom: string,
    dateTo: string,
  ) =>
    http.get(E.accountLedger(wsId, firmId, accountCode, dateFrom, dateTo)).then(
      unwrap<{
        accountName: string;
        openingBalancePaise: number;
        rows: any[];
        closingBalancePaise: number;
      }>,
    ),

  daybook: (wsId: string, firmId: string, dateFrom: string, dateTo: string, page = 1) =>
    http.get(E.daybook(wsId, firmId, dateFrom, dateTo, page)).then(
      unwrap<{
        rows: DaybookRow[];
        total: number;
        totalDebitPaise: number;
        totalCreditPaise: number;
      }>,
    ),

  receivablesAging: (wsId: string, firmId: string, asOfDate?: string) =>
    http.get(E.receivablesAging(wsId, firmId, asOfDate)).then(unwrap<AgingReport>),

  payablesAging: (wsId: string, firmId: string, asOfDate?: string) =>
    http.get(E.payablesAging(wsId, firmId, asOfDate)).then(unwrap<AgingReport>),

  partyPl: (wsId: string, firmId: string, partyId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.partyPl(wsId, firmId, partyId, dateFrom, dateTo))
      .then(unwrap<{ partyId: string; rows: any[] }>),

  partyWisePl: (
    wsId: string,
    firmId: string,
    dateFrom: string,
    dateTo: string,
    partyType?: string,
  ) =>
    http
      .get(E.partyWisePl(wsId, firmId, dateFrom, dateTo, partyType))
      .then(unwrap<{ rows: PartyWisePlRow[] }>),

  brokerCommission: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.brokerCommission(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<{ rows: BrokerCommissionRow[]; totalCommissionPaise: number }>),

  register: (
    wsId: string,
    firmId: string,
    type: string,
    dateFrom: string,
    dateTo: string,
    page = 1,
  ) =>
    http
      .get(E.register(wsId, firmId, type, dateFrom, dateTo, page))
      .then(unwrap<{ rows: RegisterRow[]; total: number }>),

  // ── Inventory Reports ──────────────────────────────────────────────────────

  stockSummary: (wsId: string, firmId: string) =>
    http.get(E.inventoryStockSummary(wsId, firmId)).then(unwrap<any>),

  itemLedger: (wsId: string, firmId: string, itemId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.itemLedger(wsId, firmId, itemId, dateFrom, dateTo))
      .then(unwrap<{ rows: ItemLedgerRow[]; total: number }>),

  itemProfitability: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.itemProfitability(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<{ rows: ItemProfitabilityRow[] }>),

  godownStock: (wsId: string, firmId: string, godownId?: string) =>
    http.get(E.godownStock(wsId, firmId, godownId)).then(unwrap<{ rows: GodownStockRow[] }>),

  wastageRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.wastageRegister(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<{ rows: WastageRegisterRow[]; total: number }>),

  // ── Manufacturing Reports ──────────────────────────────────────────────────

  mvRegister: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.mvRegister(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<{ rows: MvRegisterRow[]; total: number; message?: string }>),

  jobWorkPending: (wsId: string, firmId: string) =>
    http
      .get(E.jobWorkPending(wsId, firmId))
      .then(unwrap<{ rows: JobWorkPendingRow[]; message?: string }>),

  karigarProductivity: (wsId: string, firmId: string, dateFrom: string, dateTo: string) =>
    http
      .get(E.karigarProductivity(wsId, firmId, dateFrom, dateTo))
      .then(unwrap<{ rows: KarigarProductivityRow[]; message?: string }>),

  machineOutput: (
    wsId: string,
    firmId: string,
    dateFrom: string,
    dateTo: string,
    machineId?: string,
  ) =>
    http
      .get(E.machineOutput(wsId, firmId, dateFrom, dateTo, machineId))
      .then(unwrap<{ rows: MachineOutputRow[]; message?: string }>),

  // ── Fixed Assets Reports ───────────────────────────────────────────────────

  fixedAssetRegister: (wsId: string, firmId: string) =>
    http.get(E.fixedAssetRegister(wsId, firmId)).then(unwrap<{ rows: FixedAssetRegisterRow[] }>),

  depreciationSchedule: (wsId: string, firmId: string, assetId?: string) =>
    http
      .get(E.depreciationSchedule(wsId, firmId, assetId))
      .then(unwrap<{ rows: DepreciationScheduleRow[] }>),
};
