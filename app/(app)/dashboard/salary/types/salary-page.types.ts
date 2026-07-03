export type StatusFilter =
  | 'all'
  | 'pending'
  | 'partial'
  | 'paid'
  | 'missing_method'
  | 'salary_not_set'
  | 'advance'
  | 'not_generated';

export type ViewMode = 'table' | 'shift';

export type {
  SalarySummary,
  ShiftPayrollSummary,
  SalaryRecord,
  SalaryAdjustment,
  CreateSalaryAdjustmentPayload,
  ReverseSalaryAdjustmentPayload,
  RecordSalaryPaymentPayload,
  OutstandingAdvancesResponse,
  LedgerRecord,
  LedgerMonth,
  LedgerTransaction,
  TeamMember,
  TeamListResponse,
  UpdateTeamMemberPayload,
  BankAccount,
  AdvanceComplianceBreach,
  AdvanceComplianceWarning,
} from '@/types';
