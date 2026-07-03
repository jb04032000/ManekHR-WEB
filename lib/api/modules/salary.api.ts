import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  MonthlyTaskStatusResponse,
  SalaryRecord,
  Payment,
  LedgerRecord,
  UpdateSalaryPayload,
  RecordSalaryPaymentPayload,
  SalaryIncrement,
  SalaryAdjustment,
  CreateSalaryAdjustmentPayload,
  ReverseSalaryAdjustmentPayload,
  SalaryAdjustmentAuditEvent,
  SalaryComponentTemplate,
  CreateComponentTemplatePayload,
  UpdateComponentTemplatePayload,
  SeedComponentTemplatePayload,
  PaginatedSalaryResponse,
  PayrollOverviewResponse,
  ShiftPayrollSummary,
  BulkPaymentItem,
  BulkPaymentResult,
  OutstandingAdvancesResponse,
  PayslipDataResponse,
  OwnPayslipDownload,
  PaymentRegisterResponse,
  TaxDeclaration,
  TdsPreviewResponse,
  TdsChallan,
  TdsLiabilityResponse,
  TdsQuarterlySummary,
  Form24QData,
  CreateChallanPayload,
  UpsertTaxDeclarationPayload,
  EcrExportResponse,
  EsiChallanExportResponse,
  BankFileExportResponse,
  BankFileRowsResponse,
  GratuityLedger,
  GratuitySummary,
  Form16Data,
  PayslipEmailSendResponse,
  BulkPayslipEmailResponse,
  BulkEmailJobStatusResponse,
  FnfSettlement,
  InitiateFnfPayload,
  PieceRatePreviewResponse,
  AdvanceRecoveryPlan,
  AdvanceSchedulePreviewResponse,
  PreviewAdvanceSchedulePayload,
  EditAdvanceRecoveryPlanPayload,
  EarlyPayoffPayload,
  EmployerLoan,
  CreateLoanPayload,
  PreviewLoanSchedulePayload,
  LoanSchedulePreviewResponse,
  LoanDashboardResponse,
  ApproveLoanPayload,
  SkipInstallmentPayload,
  PauseResumeLoanPayload,
  EarlyPayoffLoanPayload,
  TopUpLoanPayload,
  WriteOffLoanPayload,
  // Bonus Module (Phase 3A)
  BonusConfig,
  UpdateBonusConfigPayload,
  PreviewBonusPayload,
  BonusPreviewResult,
  RunBonusPayload,
  RunBonusResult,
  RecordFestivalBonusPayload,
  RecordFestivalBonusResult,
  BonusSummaryResult,
  BonusRun,
  // Commission / Incentive (Phase 3B)
  CommissionEntry,
  ListCommissionEntriesParams,
  RecordCommissionPayload,
  RecordCommissionResult,
  CommissionYtdResult,
  CommissionSchedule,
  CreateCommissionSchedulePayload,
  UpdateCommissionSchedulePayload,
  DisburseSchedulePayload,
  DisburseScheduleResult,
  ListSchedulesParams,
  // Cash Ledger (Phase 3C)
  CashLedgerEntry,
  MemberLedgerResult,
  WorkspaceBalancesResult,
  RecordLedgerEntriesPayload,
  RecordLedgerEntriesResult,
  SettlePayload,
  SettleResult,
  // Phase 26 - Salary Engine + Accounting Integration
  CoaAccountsResponse,
  AdvanceSalaryRequest,
  CreateAdvanceRequestPayload,
  ApproveAdvanceRequestPayload,
  PayAdvanceRequestPayload,
  RejectAdvanceRequestPayload,
  DisbursementRules,
  SalaryLossConfig,
  AttendanceCalcRules,
  AdvanceWindowResponse,
  // Phase 3a - Reporting-person advance review
  VerifyAdvancePayload,
  // Self-service 0% loan request (employee-originated)
  CreateLoanRequestPayload,
  LoanRequest,
  LoanRequestEligibility,
  // Owner-side loan-request queue (Task 5)
  PendingLoanRequest,
  ApproveLoanRequestPayload,
  RejectLoanRequestPayload,
} from '@/types';

const E = ApiEndpoints.salary;

export const salaryApi = {
  getRecords: (wsId: string, month: number, year: number) =>
    http.get(E.list(wsId), { params: { month, year } }).then(unwrap<SalaryRecord[]>),
  getRecordsPaginated: (
    wsId: string,
    params: {
      month: number;
      year: number;
      page?: number;
      limit?: number;
      search?: string;
      shiftId?: string;
      teamMemberId?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) => http.get(E.listPaginated(wsId), { params }).then(unwrap<PaginatedSalaryResponse>),
  getOverview: (wsId: string, params: { month: number; year: number }) =>
    http.get(E.overview(wsId), { params }).then(unwrap<PayrollOverviewResponse>),
  getShiftSummaries: (
    wsId: string,
    params: {
      month: number;
      year: number;
      search?: string;
      teamMemberId?: string;
      status?: string;
    },
  ) => http.get(E.byShiftSummary(wsId), { params }).then(unwrap<ShiftPayrollSummary[]>),
  generate: (wsId: string, month: number, year: number) =>
    http.post(`${E.generate(wsId)}?month=${month}&year=${year}`).then(unwrap<SalaryRecord[]>),
  update: (wsId: string, recordId: string, data: UpdateSalaryPayload) =>
    http.patch(E.update(wsId, recordId), data).then(unwrap<SalaryRecord>),
  getPayrollConfig: <T>(wsId: string) => http.get(E.payrollConfig(wsId)).then(unwrap<T>),
  updatePayrollConfig: <T>(wsId: string, data: unknown) =>
    http.put(E.payrollConfig(wsId), data).then(unwrap<T>),
  listAdjustments: (wsId: string, salaryId: string) =>
    http.get(E.adjustments(wsId, salaryId)).then(unwrap<SalaryAdjustment[]>),
  createAdjustment: (wsId: string, salaryId: string, data: CreateSalaryAdjustmentPayload) =>
    http.post(E.adjustments(wsId, salaryId), data).then(unwrap<SalaryAdjustment>),
  reverseAdjustment: (wsId: string, adjustmentId: string, data: ReverseSalaryAdjustmentPayload) =>
    http.post(E.reverseAdjustment(wsId, adjustmentId), data).then(unwrap<SalaryAdjustment>),
  reversePayment: (wsId: string, paymentId: string, data: { reversalReason: string }) =>
    http.post(E.reversePayment(wsId, paymentId), data).then(unwrap<Payment>),
  getAdjustmentAudit: (wsId: string, adjustmentId: string) =>
    http.get(E.adjustmentAudit(wsId, adjustmentId)).then(unwrap<SalaryAdjustmentAuditEvent[]>),
  recordPayment: (wsId: string, data: RecordSalaryPaymentPayload) =>
    http.post(E.payments(wsId), data).then(unwrap<Payment>),
  recordBulkPayment: (wsId: string, data: { payments: BulkPaymentItem[] }) =>
    http.post(E.bulkPayment(wsId), data).then(unwrap<BulkPaymentResult>),
  getPayments: (wsId: string, salaryId?: string) =>
    http.get(E.payments(wsId), { params: salaryId ? { salaryId } : {} }).then(unwrap<Payment[]>),
  getPaymentRegister: (
    wsId: string,
    params: {
      month: number;
      year: number;
      page?: number;
      limit?: number;
      search?: string;
      status?: 'all' | 'active' | 'reversed';
      teamMemberId?: string;
    },
  ) => http.get(E.paymentRegister(wsId), { params }).then(unwrap<PaymentRegisterResponse>),
  getPayslipData: (wsId: string, salaryIds: string[]) =>
    http.post(E.payslipData(wsId), { salaryIds }).then(unwrap<PayslipDataResponse[]>),
  sendPayslipEmail: (wsId: string, payload: { salaryId: string }) =>
    http.post(E.sendPayslipEmail(wsId), payload).then(unwrap<PayslipEmailSendResponse>),
  lockSalaryRecord: (wsId: string, salaryId: string) =>
    http.patch(E.lock(wsId, salaryId)).then(unwrap<SalaryRecord>),
  unlockSalaryRecord: (wsId: string, salaryId: string) =>
    http.patch(E.unlock(wsId, salaryId)).then(unwrap<SalaryRecord>),
  sendBulkPayslipEmails: (wsId: string, payload: { items: Array<{ salaryId: string }> }) =>
    http.post(E.sendBulkPayslipEmails(wsId), payload).then(unwrap<BulkPayslipEmailResponse>),
  triggerBulkEmailPayslips: (wsId: string, payload: { month: number; year: number }) =>
    http.post(E.bulkEmailPayslips(wsId), payload).then(unwrap<{ jobId: string }>),
  getBulkEmailJobStatus: (wsId: string, jobId: string) =>
    http.get(E.bulkEmailPayslipsStatus(wsId, jobId)).then(unwrap<BulkEmailJobStatusResponse>),
  cancelBulkEmailJob: (wsId: string, jobId: string) =>
    http.post(E.bulkEmailPayslipsCancel(wsId, jobId)).then(unwrap<{ success: boolean }>),
  getOutstandingAdvances: (wsId: string, teamMemberId: string) =>
    http.get(E.advances(wsId, teamMemberId)).then(unwrap<OutstandingAdvancesResponse>),
  getLedger: (wsId: string, memberId: string) =>
    http.get(E.ledger(wsId, memberId)).then(unwrap<LedgerRecord[]>),
  getOwnPayslip: (wsId: string, teamMemberId: string, salaryId: string) =>
    http.get(E.ownPayslip(wsId, teamMemberId, salaryId)).then(unwrap<OwnPayslipDownload>),
  getGratuityLedger: (wsId: string, memberId: string) =>
    http.get(E.gratuityLedger(wsId, memberId)).then(unwrap<GratuityLedger | null>),
  getGratuitySummary: (wsId: string) =>
    http.get(E.gratuitySummary(wsId)).then(unwrap<GratuitySummary>),
  initiateFnf: (wsId: string, memberId: string, payload: InitiateFnfPayload) =>
    http.post(E.fnfInitiate(wsId, memberId), payload).then(unwrap<FnfSettlement>),
  getFnfSettlement: (wsId: string, memberId: string) =>
    http.get(E.fnfSettlement(wsId, memberId)).then(unwrap<FnfSettlement | null>),
  finaliseFnf: (wsId: string, memberId: string) =>
    http.post(E.fnfFinalise(wsId, memberId)).then(unwrap<FnfSettlement>),
  getFnfList: (wsId: string) => http.get(E.fnfList(wsId)).then(unwrap<FnfSettlement[]>),
  getTaxDeclaration: (wsId: string, memberId: string, financialYear: number) =>
    http
      .get(E.taxDeclaration(wsId, memberId), {
        params: { financialYear },
      })
      .then(unwrap<TaxDeclaration | null>),
  upsertTaxDeclaration: (wsId: string, memberId: string, data: UpsertTaxDeclarationPayload) =>
    http.put(E.taxDeclaration(wsId, memberId), data).then(unwrap<TaxDeclaration>),
  getTdsPreview: (wsId: string, memberId: string, month: number, year: number) =>
    http
      .get(E.tdsPreview(wsId, memberId), {
        params: { month, year },
      })
      .then(unwrap<TdsPreviewResponse>),
  createTdsChallan: (wsId: string, payload: CreateChallanPayload) =>
    http.post(E.tdsChallans(wsId), payload).then(unwrap<TdsChallan>),
  updateTdsChallan: (wsId: string, challanId: string, payload: Partial<CreateChallanPayload>) =>
    http.put(E.tdsChallanById(wsId, challanId), payload).then(unwrap<TdsChallan>),
  deleteTdsChallan: (wsId: string, challanId: string) =>
    http.delete(E.tdsChallanById(wsId, challanId)).then(unwrap<{ success: boolean }>),
  getTdsChallans: (wsId: string, financialYear: number) =>
    http
      .get(E.tdsChallans(wsId), {
        params: { financialYear },
      })
      .then(unwrap<TdsChallan[]>),
  getTdsChallansForQuarter: (wsId: string, financialYear: number, quarter: number) =>
    http
      .get(E.tdsChallansQuarter(wsId), {
        params: { financialYear, quarter },
      })
      .then(unwrap<TdsChallan[]>),
  getTdsLiability: (wsId: string, month: number, year: number) =>
    http
      .get(E.tdsLiability(wsId), {
        params: { month, year },
      })
      .then(unwrap<TdsLiabilityResponse>),
  getTdsQuarterlySummary: (wsId: string, financialYear: number, quarter: number) =>
    http
      .get(E.tdsSummary(wsId), {
        params: { financialYear, quarter },
      })
      .then(unwrap<TdsQuarterlySummary>),
  getForm24QData: (wsId: string, financialYear: number, quarter: number) =>
    http
      .get(E.tdsForm24Q(wsId), {
        params: { financialYear, quarter },
      })
      .then(unwrap<Form24QData>),
  getForm16Data: (wsId: string, memberId: string, financialYear: number) =>
    http
      .get(E.form16(wsId, memberId), {
        params: { financialYear },
      })
      .then(unwrap<Form16Data>),
  getEcrExport: (wsId: string, month: number, year: number) =>
    http
      .get(E.complianceEcr(wsId), {
        params: { month, year },
      })
      .then(unwrap<EcrExportResponse>),
  getEsiChallanExport: (wsId: string, month: number, year: number) =>
    http
      .get(E.complianceEsiChallan(wsId), {
        params: { month, year },
      })
      .then(unwrap<EsiChallanExportResponse>),
  getBankFileExport: (wsId: string, month: number, year: number) =>
    http
      .get(E.complianceBankFile(wsId), {
        params: { month, year },
      })
      .then(unwrap<BankFileExportResponse>),
  addIncrement: (
    wsId: string,
    data: {
      teamMemberId: string;
      effectiveMonth: number;
      effectiveYear: number;
      type: 'fixed_amount' | 'percentage';
      value: number;
      note?: string;
    },
  ) => http.post(E.increments(wsId), data).then(unwrap<SalaryIncrement>),
  getIncrements: (wsId: string, teamMemberId: string) =>
    http.get(E.increments(wsId), { params: { teamMemberId } }).then(unwrap<SalaryIncrement[]>),
  deleteIncrement: (wsId: string, id: string) =>
    http.delete(E.incrementDelete(wsId, id)).then(unwrap<{ success: boolean }>),
  listComponentTemplates: (wsId: string) =>
    http.get(E.componentTemplates(wsId)).then(unwrap<SalaryComponentTemplate[]>),
  createComponentTemplate: (wsId: string, data: CreateComponentTemplatePayload) =>
    http.post(E.componentTemplates(wsId), data).then(unwrap<SalaryComponentTemplate>),
  seedComponentTemplate: (wsId: string, data: SeedComponentTemplatePayload) =>
    http.post(E.componentTemplateSeed(wsId), data).then(unwrap<SalaryComponentTemplate>),
  updateComponentTemplate: (
    wsId: string,
    templateId: string,
    data: UpdateComponentTemplatePayload,
  ) =>
    http.put(E.componentTemplateById(wsId, templateId), data).then(unwrap<SalaryComponentTemplate>),
  deleteComponentTemplate: (wsId: string, templateId: string) =>
    http.delete(E.componentTemplateById(wsId, templateId)).then(unwrap<{ success: boolean }>),
  getMonthlyTaskStatus: (wsId: string, month: number, year: number) =>
    http
      .get(E.monthlyTaskStatus(wsId), { params: { month, year } })
      .then(unwrap<MonthlyTaskStatusResponse>),
  getBankFileRows: (wsId: string, month: number, year: number) =>
    http.get(E.bankFile(wsId), { params: { month, year } }).then(unwrap<BankFileRowsResponse>),
  // Phase 23 - Piece rate
  getPieceRatePreview: (
    wsId: string,
    params: { teamMemberId: string; month: number; year: number },
  ) => http.get(E.pieceRatePreview(wsId, params)).then(unwrap<PieceRatePreviewResponse>),
  // Advance recovery plans (EMI)
  previewAdvanceSchedule: (wsId: string, body: PreviewAdvanceSchedulePayload) =>
    http.post(E.advancePlansPreview(wsId), body).then(unwrap<AdvanceSchedulePreviewResponse>),
  getAdvanceRecoveryPlans: (wsId: string, memberId: string) =>
    http.get(E.advancePlans(wsId, memberId)).then(unwrap<AdvanceRecoveryPlan[]>),
  getAdvanceRecoveryPlanDetail: (wsId: string, planId: string) =>
    http.get(E.advancePlanDetail(wsId, planId)).then(unwrap<AdvanceRecoveryPlan>),
  editAdvanceRecoveryPlan: (wsId: string, planId: string, body: EditAdvanceRecoveryPlanPayload) =>
    http.patch(E.advancePlanEdit(wsId, planId), body).then(unwrap<AdvanceRecoveryPlan>),
  earlyPayoffAdvancePlan: (wsId: string, planId: string, body: EarlyPayoffPayload) =>
    http.post(E.advancePlanEarlyPayoff(wsId, planId), body).then(unwrap<AdvanceRecoveryPlan>),
  getMemberLoanOutstanding: (wsId: string, teamMemberId: string) =>
    http.get(E.loanOutstanding(wsId, teamMemberId)).then(unwrap<number>),
  // Employer Loans (Phase 2)
  createLoan: (wsId: string, body: CreateLoanPayload) =>
    http.post(E.loans(wsId), body).then(unwrap<EmployerLoan>),
  previewLoanSchedule: (wsId: string, body: PreviewLoanSchedulePayload) =>
    http.post(E.loansPreview(wsId), body).then(unwrap<LoanSchedulePreviewResponse>),
  listLoans: (wsId: string, teamMemberId: string) =>
    http.get(E.loansByMember(wsId, teamMemberId)).then(unwrap<EmployerLoan[]>),
  getLoanDashboard: (wsId: string, params?: { loanType?: string; status?: string }) =>
    http.get(E.loansDashboard(wsId), { params }).then(unwrap<LoanDashboardResponse>),
  getLoan: (wsId: string, loanId: string) =>
    http.get(E.loanDetail(wsId, loanId)).then(unwrap<EmployerLoan>),
  // Lifecycle (Part B)
  approveLoan: (wsId: string, loanId: string, body: ApproveLoanPayload) =>
    http.post(E.loanApprove(wsId, loanId), body).then(unwrap<EmployerLoan>),
  rejectLoan: (wsId: string, loanId: string, comment?: string) =>
    http
      .post(E.loanApprove(wsId, loanId), { decision: 'reject', comment })
      .then(unwrap<EmployerLoan>),
  skipLoanInstallment: (wsId: string, loanId: string, body: SkipInstallmentPayload) =>
    http.post(E.loanSkipInstallment(wsId, loanId), body).then(unwrap<EmployerLoan>),
  pauseLoan: (wsId: string, loanId: string, body: PauseResumeLoanPayload) =>
    http.patch(E.loanPauseResume(wsId, loanId), body).then(unwrap<EmployerLoan>),
  resumeLoan: (wsId: string, loanId: string, body: PauseResumeLoanPayload) =>
    http.patch(E.loanPauseResume(wsId, loanId), body).then(unwrap<EmployerLoan>),
  earlyPayoffLoan: (wsId: string, loanId: string, body: EarlyPayoffLoanPayload) =>
    http.post(E.loanEarlyPayoff(wsId, loanId), body).then(unwrap<EmployerLoan>),
  topUpLoan: (wsId: string, loanId: string, body: TopUpLoanPayload) =>
    http.post(E.loanTopUp(wsId, loanId), body).then(unwrap<EmployerLoan>),
  writeOffLoan: (wsId: string, loanId: string, body: WriteOffLoanPayload) =>
    http.post(E.loanWriteOff(wsId, loanId), body).then(unwrap<EmployerLoan>),
  // Bonus Module (Phase 3A)
  getBonusConfig: (wsId: string) => http.get(E.bonusConfig(wsId)).then(unwrap<BonusConfig>),
  updateBonusConfig: (wsId: string, body: UpdateBonusConfigPayload) =>
    http.patch(E.bonusConfig(wsId), body).then(unwrap<BonusConfig>),
  previewBonus: (wsId: string, body: PreviewBonusPayload) =>
    http.post(E.bonusPreview(wsId), body).then(unwrap<BonusPreviewResult>),
  runBonus: (wsId: string, body: RunBonusPayload) =>
    http.post(E.bonusRun(wsId), body).then(unwrap<RunBonusResult>),
  recordFestivalBonus: (wsId: string, body: RecordFestivalBonusPayload) =>
    http.post(E.bonusFestival(wsId), body).then(unwrap<RecordFestivalBonusResult>),
  getBonusSummary: (wsId: string, params: { financialYear: number; teamMemberId?: string }) =>
    http.get(E.bonusSummary(wsId), { params }).then(unwrap<BonusSummaryResult>),
  listBonusRuns: (wsId: string, params?: { financialYear?: number; bonusType?: string }) =>
    http.get(E.bonusRuns(wsId), { params }).then(unwrap<BonusRun[]>),
  getBonusRun: (wsId: string, runId: string) =>
    http.get(E.bonusRunById(wsId, runId)).then(unwrap<BonusRun>),
  // Commission / Incentive (Phase 3B)
  recordCommissionEntries: (wsId: string, body: RecordCommissionPayload) =>
    http.post(E.commissionEntries(wsId), body).then(unwrap<RecordCommissionResult>),
  listCommissionEntries: (wsId: string, params?: ListCommissionEntriesParams) =>
    http.get(E.commissionEntries(wsId), { params }).then(unwrap<CommissionEntry[]>),
  getCommissionYtd: (wsId: string, params?: { teamMemberId?: string; fyStartYear?: number }) =>
    http.get(E.commissionYtd(wsId), { params }).then(unwrap<CommissionYtdResult>),
  listCommissionSchedules: (wsId: string, params?: ListSchedulesParams) =>
    http.get(E.commissionSchedules(wsId), { params }).then(unwrap<CommissionSchedule[]>),
  createCommissionSchedule: (wsId: string, body: CreateCommissionSchedulePayload) =>
    http.post(E.commissionSchedules(wsId), body).then(unwrap<CommissionSchedule>),
  getCommissionSchedule: (wsId: string, scheduleId: string) =>
    http.get(E.commissionScheduleById(wsId, scheduleId)).then(unwrap<CommissionSchedule>),
  updateCommissionSchedule: (
    wsId: string,
    scheduleId: string,
    body: UpdateCommissionSchedulePayload,
  ) =>
    http.patch(E.commissionScheduleById(wsId, scheduleId), body).then(unwrap<CommissionSchedule>),
  deleteCommissionSchedule: (wsId: string, scheduleId: string) =>
    http.delete(E.commissionScheduleById(wsId, scheduleId)).then(unwrap<{ deleted: boolean }>),
  disburseCommissionSchedule: (wsId: string, scheduleId: string, body: DisburseSchedulePayload) =>
    http
      .post(E.commissionScheduleDisburse(wsId, scheduleId), body)
      .then(unwrap<DisburseScheduleResult>),
  // Cash Ledger (Phase 3C - Daily-Wage Running Ledger)
  recordLedgerEntries: (wsId: string, body: RecordLedgerEntriesPayload) =>
    http.post(E.cashLedgerEntries(wsId), body).then(unwrap<RecordLedgerEntriesResult>),
  getWorkspaceLedgerBalances: (
    wsId: string,
    params?: { filter?: 'nonzero' | 'all'; limit?: number },
  ) => http.get(E.cashLedgerBalances(wsId), { params }).then(unwrap<WorkspaceBalancesResult>),
  settleLedger: (wsId: string, body: SettlePayload) =>
    http.post(E.cashLedgerSettle(wsId), body).then(unwrap<SettleResult>),
  getMemberCashLedger: (
    wsId: string,
    memberId: string,
    params?: { fromDate?: string; toDate?: string; type?: string; page?: number; limit?: number },
  ) => http.get(E.cashLedgerMember(wsId, memberId), { params }).then(unwrap<MemberLedgerResult>),
  updateLedgerEntry: (
    wsId: string,
    entryId: string,
    body: { amount?: number; date?: string; note?: string },
  ) => http.patch(E.cashLedgerEntryById(wsId, entryId), body).then(unwrap<CashLedgerEntry>),
  softDeleteLedgerEntry: (wsId: string, entryId: string) =>
    http
      .delete(E.cashLedgerEntryById(wsId, entryId))
      .then(unwrap<{ deleted: boolean; correctionEntryId: string }>),
};

export async function getPieceRatePreview(
  wsId: string,
  params: { teamMemberId: string; month: number; year: number },
): Promise<PieceRatePreviewResponse> {
  const response = await http.get(ApiEndpoints.salary.pieceRatePreview(wsId, params));
  return unwrap<PieceRatePreviewResponse>(response);
}

// ─── Phase 26 - Salary Engine + Accounting Integration ───────────────────────
// All functions below are client-side wrappers (use in Client Components / RSC
// fetch via SWR/React Query). Server Actions for write paths live in salary.actions.ts.

/**
 * Fetch cash/bank COA accounts for the Pay drawer picker (D-10).
 * Returns financeConfigured=false when Finance module is not set up - hide picker in that case.
 * Links: salary.actions.ts recordPaymentAction → coaAccountId field; Plan 26-10 Pay drawer.
 */
export async function listCoaAccounts(wsId: string): Promise<CoaAccountsResponse> {
  const response = await http.get(E.coaAccounts(wsId));
  return unwrap<CoaAccountsResponse>(response);
}

/**
 * List advance salary requests for the owner queue (D-02).
 * Supports optional status and teamMemberId filters.
 * Links: Plan 26-09 advance queue page; approveAdvanceRequest / rejectAdvanceRequest below.
 */
export async function listAdvanceRequests(
  wsId: string,
  params?: { status?: string; teamMemberId?: string },
): Promise<AdvanceSalaryRequest[]> {
  const response = await http.get(E.advanceRequests(wsId), { params });
  return unwrap<AdvanceSalaryRequest[]>(response);
}

/**
 * List the current member's own advance requests (D-02).
 * Used on the member-facing advance tab (Plan 26-10).
 * Links: /advance-requests/mine endpoint; CreateAdvanceRequestPayload for the submit action.
 */
export async function listMyAdvanceRequests(wsId: string): Promise<AdvanceSalaryRequest[]> {
  const response = await http.get(E.advanceRequestsMine(wsId));
  return unwrap<AdvanceSalaryRequest[]>(response);
}

/**
 * Submit a new advance salary request (D-02). Member-facing.
 * Backend enforces D-08 IST request-day gate and D-09 duplicate guard (409).
 * Amounts in paise. Links: Plan 26-10 member advance form; salary.actions.ts createAdvanceRequestAction.
 */
export async function createAdvanceRequest(
  wsId: string,
  payload: CreateAdvanceRequestPayload,
): Promise<AdvanceSalaryRequest> {
  const response = await http.post(E.advanceRequests(wsId), payload);
  return unwrap<AdvanceSalaryRequest>(response);
}

/**
 * Self-scoped: is the advance window open today + a human-readable message.
 * Used by AdvanceRequestDrawer to show the open/closed banner before the worker submits.
 * Links: AdvanceRequestDrawer.tsx, advance-request-window.util.ts (BE), Task 6 plan 2026-06-22.
 */
export async function getAdvanceWindow(wsId: string): Promise<AdvanceWindowResponse> {
  const response = await http.get(E.advanceRequestsWindow(wsId));
  return unwrap<AdvanceWindowResponse>(response);
}

/**
 * Approve an advance salary request (D-02). Owner-facing. Two-step flow (Plan 2026-06-22):
 * APPROVE only - sets approvedAmount + reviewNote, status pending -> approved. No disbursement.
 * Recovery plan creation moved to payAdvanceRequest (pay/disburse step).
 * Links: Plan 26-09 owner queue; AdvanceApprovalQueue approve modal; salary.actions.ts approveAdvanceRequestAction.
 */
export async function approveAdvanceRequest(
  wsId: string,
  id: string,
  payload: ApproveAdvanceRequestPayload,
): Promise<AdvanceSalaryRequest> {
  const response = await http.patch(E.approveAdvanceRequest(wsId, id), payload);
  return unwrap<AdvanceSalaryRequest>(response);
}

/**
 * Disburse an approved advance salary request (Plan 2026-06-22 two-step).
 * Captures payment method, split lines, proof, who-disbursed, and starts the recovery plan.
 * Status transitions approved -> paid. Links: AdvanceDisburseDrawer; BE pay route (:id/pay).
 */
export async function payAdvanceRequest(
  wsId: string,
  id: string,
  payload: PayAdvanceRequestPayload,
): Promise<AdvanceSalaryRequest> {
  const response = await http.patch(E.payAdvanceRequest(wsId, id), payload);
  return unwrap<AdvanceSalaryRequest>(response);
}

/**
 * Reject an advance salary request (D-02). Owner-facing.
 * Transitions status pending → rejected with optional reviewNote.
 * Links: Plan 26-09 owner queue; salary.actions.ts rejectAdvanceRequestAction.
 */
export async function rejectAdvanceRequest(
  wsId: string,
  id: string,
  payload: RejectAdvanceRequestPayload,
): Promise<AdvanceSalaryRequest> {
  const response = await http.patch(E.rejectAdvanceRequest(wsId, id), payload);
  return unwrap<AdvanceSalaryRequest>(response);
}

/**
 * Phase 3a (reporting-person review): list advance requests for the caller's direct reports.
 * Requires salary.review_advance@self. Backend filters by TeamMember.reportsTo == caller's id.
 * Links: TeamAdvanceReviewCard.tsx; BE GET /advance-requests/for-my-reports.
 */
export async function listAdvanceRequestsForMyReports(
  wsId: string,
): Promise<AdvanceSalaryRequest[]> {
  const response = await http.get(E.advanceRequestsForMyReports(wsId));
  return unwrap<AdvanceSalaryRequest[]>(response);
}

/**
 * Phase 3a: advisory verify stamp on a direct report's advance request.
 * SoD: cannot verify own request; request must belong to a direct report of the caller.
 * Does NOT change status; owner approval is unaffected.
 * Links: TeamAdvanceReviewCard verify modal; BE PATCH /advance-requests/:id/verify.
 */
export async function verifyAdvanceRequest(
  wsId: string,
  id: string,
  payload: VerifyAdvancePayload,
): Promise<AdvanceSalaryRequest> {
  const response = await http.patch(E.verifyAdvanceRequest(wsId, id), payload);
  return unwrap<AdvanceSalaryRequest>(response);
}

/**
 * Update disbursement rules (D-01): salary date, payout window, advance request day.
 * Owner-only settings. Links: Plan 26-08 payroll settings page; salary.actions.ts updateDisbursementRulesAction.
 */
export async function updateDisbursementRules(
  wsId: string,
  payload: Partial<DisbursementRules>,
): Promise<void> {
  await http.patch(E.disbursementRules(wsId), payload);
}

/**
 * Update salary-loss config (D-03): regularization window and enable/disable flag.
 * Owner-only settings. Links: Plan 26-08 payroll settings page; salary.actions.ts updateSalaryLossConfigAction.
 */
export async function updateSalaryLossConfig(
  wsId: string,
  payload: Partial<SalaryLossConfig>,
): Promise<void> {
  await http.patch(E.salaryLossConfig(wsId), payload);
}

/**
 * Update attendance calculation toggles (D-01): holiday/week-off presence, late-mark half-day.
 * Owner-only settings. Links: Plan 26-08 payroll settings page; salary.actions.ts updateAttendanceRulesAction.
 */
export async function updateAttendanceRules(
  wsId: string,
  payload: Partial<AttendanceCalcRules>,
): Promise<void> {
  await http.patch(E.attendanceRules(wsId), payload);
}

// ─── Self-service 0% loan request (employee-originated) ──────────────────────
// Mirrors the advance-request self functions exactly. The worker self-applies
// for a 0% installment loan; the owner later approves it (materializes a real
// EmployerLoan). All three are self-scoped (salary.request_loan@self) and gated
// on the loan_management subscription. Links: loan-request.controller.ts (BE),
// LoanRequestDrawer / MyLoanRequests (web).

/**
 * Submit a new self-service 0% loan request. Member-facing.
 * Amount in paise. Backend enforces the eligibility caps + per-member single
 * pending guard (LOAN_REQUEST_DUPLICATE 409). NO teamMemberId in the body - the
 * server resolves the caller's own id from the JWT (sending it 400s via
 * forbidNonWhitelisted). Links: LoanRequestDrawer submit.
 */
export async function createLoanRequest(
  wsId: string,
  payload: CreateLoanRequestPayload,
): Promise<LoanRequest> {
  const response = await http.post(E.loanRequests(wsId), payload);
  return unwrap<LoanRequest>(response);
}

/**
 * List the caller's own loan requests (newest-first). Approved rows include the
 * joined `loan` summary {id,status,remainingAmount}. Links: MyLoanRequests list.
 */
export async function getMyLoanRequests(wsId: string): Promise<LoanRequest[]> {
  const response = await http.get(E.loanRequestsMine(wsId));
  return unwrap<LoanRequest[]>(response);
}

/**
 * Self-scoped pre-validation for the apply button: whether the feature/self-apply
 * is enabled, the active caps (maxAmount paise, minTenureMonths), and the stable
 * ineligibility reason codes. Links: LoanRequestDrawer (disables submit + shows
 * the cap and reasons before the worker submits).
 */
export async function getLoanRequestEligibility(wsId: string): Promise<LoanRequestEligibility> {
  const response = await http.get(E.loanRequestsEligibility(wsId));
  return unwrap<LoanRequestEligibility>(response);
}

// ─── Owner-side loan-request approval queue (Task 5) ─────────────────────────
// Owner/HR reviews pending self-service loan requests. Gated on the
// loan_management subscription + salary.edit@all (mirrors the advance-request
// owner slice and the Employer Loan owner routes). approve materializes the real
// 0% EmployerLoan via the existing LoanService.createLoan; reject declines with a
// reason. Links: loan-request.controller.ts (BE), LoanRequestsQueue (web).

/**
 * List all pending loan requests in the workspace (owner queue), newest-first.
 * Each row is member-decorated ({ member: { id, name, employeeCode } }) so the
 * owner sees who applied. Links: LoanRequestsQueue table.
 */
export async function getPendingLoanRequests(wsId: string): Promise<PendingLoanRequest[]> {
  const response = await http.get(E.loanRequestsPending(wsId));
  return unwrap<PendingLoanRequest[]>(response);
}

/**
 * Approve a pending loan request with final terms. On success the backend
 * materializes the interest-free EmployerLoan and returns the stamped request
 * (status 'approved' + createdEmployerLoanId). 409 LOAN_REQUEST_NOT_PENDING if a
 * concurrent actor already actioned it. Amounts in paise. interestType defaults
 * to 'zero' and principal to the requested amount server-side when omitted.
 * Links: LoanRequestApproveDrawer submit.
 */
export async function approveLoanRequest(
  wsId: string,
  requestId: string,
  payload: ApproveLoanRequestPayload,
): Promise<LoanRequest> {
  const response = await http.patch(E.approveLoanRequest(wsId, requestId), payload);
  return unwrap<LoanRequest>(response);
}

/**
 * Reject a pending loan request with a required reason (shown to the employee).
 * 409 LOAN_REQUEST_NOT_PENDING if already actioned. Links: LoanRequestsQueue reject modal.
 */
export async function rejectLoanRequest(
  wsId: string,
  requestId: string,
  payload: RejectLoanRequestPayload,
): Promise<LoanRequest> {
  const response = await http.patch(E.rejectLoanRequest(wsId, requestId), payload);
  return unwrap<LoanRequest>(response);
}
