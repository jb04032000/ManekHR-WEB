export const PAYROLL_PRESETS = {
  basic: {
    label: 'Basic',
    description: 'Simple salary tracking and payments',
    subtitle: 'Best for: Small shops, daily wage workers',
    features: {
      salaryRevisions: false,
      salaryIncrements: false,
    },
  },
  standard: {
    label: 'Standard',
    description: 'Adds advance payments, split payments, and bulk pay',
    subtitle: 'Best for: Growing businesses with 10-50 employees',
    features: {
      salaryRevisions: true,
      salaryIncrements: true,
    },
  },
  professional: {
    label: 'Professional',
    description: 'Full salary structure with components and payslips',
    subtitle: 'Best for: Established companies needing compliance',
    features: {
      salaryRevisions: true,
      salaryIncrements: true,
    },
  },
  enterprise: {
    label: 'Enterprise',
    description: 'Everything enabled with enterprise defaults',
    subtitle: 'Best for: Large organizations with 200+ employees',
    features: {
      salaryRevisions: true,
      salaryIncrements: true,
    },
  },
} as const;

export type PayrollPreset = keyof typeof PAYROLL_PRESETS;

export const FEATURE_META: Record<
  string,
  { label: string; description: string; category: 'core' | 'payments' | 'advanced' }
> = {
  attendanceBasedPay: {
    label: 'Attendance-Based Pay',
    description:
      'Enable attendance-driven salary calculation rules and employee attendance overrides',
    category: 'core',
  },
  adjustments: {
    label: 'Salary Adjustments',
    description: 'Add bonuses and deductions to monthly pay',
    category: 'core',
  },
  hourlySalary: {
    label: 'Hourly Rate Support',
    description: 'Set salary as hourly rate instead of monthly',
    category: 'core',
  },
  bankDetails: {
    label: 'Bank & UPI Details',
    description: 'Collect employee payment method info',
    category: 'payments',
  },
  proofAttachments: {
    label: 'Payment Proofs',
    description: 'Attach screenshots or receipts to payments',
    category: 'payments',
  },
  advancePayments: {
    label: 'Advance Payments',
    description: 'Pay salary ahead into the next month',
    category: 'payments',
  },
  splitPayments: {
    label: 'Split Payments',
    description: 'Split a single payment across multiple methods',
    category: 'payments',
  },
  commissionTracking: {
    label: 'Commission Tracking',
    description: 'Track commission amounts on payments',
    category: 'payments',
  },
  bulkPayments: {
    label: 'Bulk Payments',
    description: 'Pay multiple employees in one action',
    category: 'payments',
  },
  loanManagement: {
    label: 'Employee Loans',
    description: 'Give staff loans with interest, EMI recovery, and perquisite tax',
    category: 'payments',
  },
  bonusTracking: {
    label: 'Bonus',
    description: 'Statutory and festival bonus runs, with clawback on early exit',
    category: 'payments',
  },
  dailyWageLedger: {
    label: 'Daily-Wage Ledger',
    description: 'Running baki and udhaar account for daily-wage workers',
    category: 'payments',
  },
  salaryComponents: {
    label: 'Salary Components',
    description: 'Break down salary into Basic, HRA, DA, etc.',
    category: 'advanced',
  },
  payslipGeneration: {
    label: 'Payslip Generation',
    description: 'Generate PDF payslips for employees',
    category: 'advanced',
  },
  autoGenerate: {
    label: 'Auto-Generate Records',
    description: 'Automatically create salary records each month',
    category: 'advanced',
  },
  salaryRevisions: {
    label: 'Salary Revisions',
    description: 'Allow salary revision tracking and history',
    category: 'advanced',
  },
  salaryIncrements: {
    label: 'Salary Increments',
    description: 'Track and schedule salary increments with effective dates',
    category: 'advanced',
  },
};

export const FEATURE_GROUPS = {
  core: {
    title: 'Core Features',
    features: ['attendanceBasedPay', 'adjustments', 'hourlySalary'] as const,
  },
  payments: {
    title: 'Payment Features',
    features: [
      'bankDetails',
      'proofAttachments',
      'advancePayments',
      'splitPayments',
      'commissionTracking',
      'bulkPayments',
      'loanManagement',
      'bonusTracking',
      'dailyWageLedger',
    ] as const,
  },
  advanced: {
    title: 'Advanced Features',
    features: [
      'salaryComponents',
      'payslipGeneration',
      'autoGenerate',
      'salaryRevisions',
      'salaryIncrements',
    ] as const,
  },
};

export const BUILT_IN_TEMPLATE_CARDS = [
  {
    key: 'simple',
    name: 'Simple',
    description:
      "Single Basic component - 100% of CTC. For businesses that don't need salary breakdowns.",
  },
  {
    key: 'standard_india',
    name: 'Standard India',
    description:
      'Basic (40%) + HRA (50% of Basic) + DA (15%) + Special Allowance. Common Indian payroll structure.',
  },
  {
    key: 'ctc_with_pf',
    name: 'CTC with Employer PF',
    description: 'Standard structure plus Employer PF (12% of Basic) as an above-CTC component.',
  },
];
