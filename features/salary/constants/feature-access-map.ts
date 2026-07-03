export interface PayrollConfigFeatures {
  attendanceBasedPay: boolean;
  adjustments: boolean;
  advancePayments: boolean;
  splitPayments: boolean;
  commissionTracking: boolean;
  salaryComponents: boolean;
  payslipGeneration: boolean;
  bankDetails: boolean;
  proofAttachments: boolean;
  hourlySalary: boolean;
  bulkPayments: boolean;
  autoGenerate: boolean;
  salaryRevisions: boolean;
  salaryIncrements: boolean;
  /** Workspace-level toggle for the employer loan module. */
  loanManagement: boolean;
  /** Workspace-level toggle for the statutory + festival bonus module. */
  bonusTracking: boolean;
  /** Workspace-level toggle for the daily-wage running ledger (baki/udhaar). */
  dailyWageLedger: boolean;
}

export interface FeatureAccessMapping {
  subscriptionKey?: string;
  configKey?: keyof PayrollConfigFeatures | null;
}

export const SALARY_FEATURE_MAP: Record<string, FeatureAccessMapping> = {
  // Dual-gated (subscription + config)
  advancePayments: { subscriptionKey: 'advance_payments', configKey: 'advancePayments' },
  splitPayments: { subscriptionKey: 'split_payments', configKey: 'splitPayments' },
  adjustmentsView: { subscriptionKey: 'salary_adjustments_view', configKey: 'adjustments' },
  adjustmentsCreate: { subscriptionKey: 'salary_adjustments_create', configKey: 'adjustments' },
  adjustmentsReverse: { subscriptionKey: 'salary_adjustments_reverse', configKey: 'adjustments' },
  bulkPayments: { subscriptionKey: 'bulk_payments', configKey: 'bulkPayments' },
  commissionTracking: { subscriptionKey: 'commission_tracking', configKey: 'commissionTracking' },
  salaryComponents: { subscriptionKey: 'salary_components', configKey: 'salaryComponents' },
  payslipGeneration: { subscriptionKey: 'payslip_generation', configKey: 'payslipGeneration' },
  salaryIncrements: { subscriptionKey: 'salary_increments', configKey: 'salaryIncrements' },

  // Config-gated only (no plan differentiation needed)
  proofAttachments: { configKey: 'proofAttachments' },
  hourlySalary: { configKey: 'hourlySalary' },
  bankDetails: { configKey: 'bankDetails' },
  attendanceBasedPay: { configKey: 'attendanceBasedPay' },
  autoGenerate: { configKey: 'autoGenerate' },
  salaryRevisions: { configKey: 'salaryRevisions' },

  // Subscription-gated only
  editSalary: { subscriptionKey: 'edit_salary' },
  exportData: { subscriptionKey: 'export_pdf' },
  reversePayment: { subscriptionKey: 'reverse_payment' },
  statutoryCompliance: {
    subscriptionKey: 'statutory_compliance',
    configKey: null,
  },
  statutoryTds: {
    subscriptionKey: 'statutory_tds',
    configKey: null,
  },
  complianceExports: {
    subscriptionKey: 'compliance_exports',
    configKey: null,
  },
  form16Generation: {
    subscriptionKey: 'form16_generation',
    configKey: null,
  },
  payslipEmail: {
    subscriptionKey: 'payslip_email',
    configKey: null,
  },
  gratuityTracking: {
    subscriptionKey: 'gratuity_tracking',
    configKey: null,
  },
  lwfTracking: {
    subscriptionKey: 'lwf_tracking',
    configKey: null,
  },
  tdsManagement: {
    subscriptionKey: 'tds_management',
    configKey: null,
  },
  fnfSettlement: {
    subscriptionKey: 'fnf_settlement',
    configKey: null,
  },
  // Dual-gated: subscription key matches the backend @RequireSubscription decorator
  // on the loan endpoints. Workspace must also enable the loan module in PayrollConfig.
  loanManagement: { subscriptionKey: 'loan_management', configKey: 'loanManagement' },
  // Dual-gated: subscription key matches the backend @RequireSubscription decorator.
  bonusTracking: { subscriptionKey: 'bonus_tracking', configKey: 'bonusTracking' },
  // Dual-gated: daily-wage ledger must be enabled in PayrollConfig and on the subscription.
  dailyWageLedger: { subscriptionKey: 'daily_wage_ledger', configKey: 'dailyWageLedger' },
};
