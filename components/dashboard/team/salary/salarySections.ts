export type SalarySectionKey =
  | 'summary'
  | 'pay'
  | 'structure'
  | 'advances'
  | 'loans'
  | 'commission'
  | 'bonus'
  | 'statutory'
  | 'gratuity'
  | 'fnf';

export interface SalarySectionDef {
  key: SalarySectionKey;
  /** i18n key suffix under team.salaryWorkspace.section.* */
  labelKey: string;
  /** useSalaryFeatures key that must be enabled, or null if always shown. */
  featureKey: string | null;
}

export const SALARY_SECTIONS: SalarySectionDef[] = [
  { key: 'summary', labelKey: 'summary', featureKey: null },
  { key: 'pay', labelKey: 'pay', featureKey: null },
  { key: 'structure', labelKey: 'structure', featureKey: null },
  { key: 'advances', labelKey: 'advances', featureKey: 'advancePayments' },
  { key: 'loans', labelKey: 'loans', featureKey: 'loanManagement' },
  { key: 'commission', labelKey: 'commission', featureKey: 'commissionTracking' },
  { key: 'bonus', labelKey: 'bonus', featureKey: 'bonusTracking' },
  // statutory maps to 'statutoryCompliance' (subscription-gated; covers PF/ESI/PT + TDS surface)
  { key: 'statutory', labelKey: 'statutory', featureKey: 'statutoryCompliance' },
  { key: 'gratuity', labelKey: 'gratuity', featureKey: 'gratuityTracking' },
  // fnf maps to 'fnfSettlement' (subscription-gated only)
  { key: 'fnf', labelKey: 'fnf', featureKey: 'fnfSettlement' },
];

export function visibleSalarySections(
  isEnabled: (featureKey: string) => boolean,
): SalarySectionDef[] {
  return SALARY_SECTIONS.filter((s) => s.featureKey === null || isEnabled(s.featureKey));
}
