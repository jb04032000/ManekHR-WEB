export const HISTORY_DATE_RANGE_LABELS: Record<'all' | '3m' | '6m' | '1y', string> = {
  all: 'All Time',
  '3m': 'Last 3 Months',
  '6m': 'Last 6 Months',
  '1y': 'Last 1 Year',
};

export const ADDITION_CATEGORY_OPTIONS = [
  'bonus',
  'commission',
  'overtime',
  'reimbursement',
  'allowance',
  'incentive',
  'other',
] as const;

export const DEDUCTION_CATEGORY_OPTIONS = [
  'penalty',
  'advance_recovery',
  'loan_recovery',
  'fine',
  'absence_recovery',
  'other',
] as const;
