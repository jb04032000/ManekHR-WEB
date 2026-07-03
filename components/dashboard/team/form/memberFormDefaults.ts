export const SHIFT_COLORS = [
  { color: 'var(--cr-info-700)', bg: 'var(--cr-info-50)' },
  { color: 'var(--cr-warning-500)', bg: 'var(--cr-warning-50)' },
  { color: 'var(--cr-indigo-400)', bg: 'var(--cr-indigo-50)' },
  { color: 'var(--cr-success-500)', bg: 'var(--cr-success-50)' },
  { color: 'var(--cr-danger-500)', bg: 'var(--cr-danger-50)' },
  { color: 'var(--cr-primary-hover)', bg: 'var(--cr-indigo-50)' },
];

export const DEFAULT_STATUTORY_FORM_VALUES = {
  taxRegime: 'new' as const,
  employmentType: 'full_time' as const,
  pfApplicable: true,
  pfOptedOut: false,
  esiApplicable: false,
  isNonItrFiler: false,
};

export const DEFAULT_SALARY_CALC_FORM_VALUES = {
  salaryDayBasis: 'fixed_month_days' as const,
  attendancePayMode: 'default' as const,
};

export const DEFAULT_KARIGAR_FORM_VALUES = {
  isKarigar: false,
};

export const KARIGAR_SKILL_OPTIONS = [
  { value: 'zari', label: 'Zari' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'print', label: 'Print' },
  { value: 'dyeing', label: 'Dyeing' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'other', label: 'Other' },
] as const;

export const INDIAN_STATE_AND_UT_OPTIONS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

export const EMP_CODE_REGEX = /^[A-Za-z0-9_-]{1,32}$/;

export function maskPanNumber(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized.length <= 6) return normalized;
  return `${normalized.slice(0, 5)}${'*'.repeat(
    Math.max(normalized.length - 6, 4),
  )}${normalized.slice(-1)}`;
}

/**
 * Client-side mirror of the backend employee code renderer.
 * Longest-token-first substitution order must match team.service.ts.
 * {WS} is the workspace code; when the format omits it, the code is prepended
 * so every preview embeds the workspace (backend parity).
 */
export function renderEmployeeCode(
  format: string,
  prefix: string,
  sequence: number,
  workspaceCode = '',
  now: Date = new Date(),
): string {
  const yyyy = now.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const hasWsToken = /\{WS\}/i.test(format);
  const rendered = format
    .replace(/\{WS\}/gi, workspaceCode)
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{####\}/g, String(sequence).padStart(4, '0'))
    .replace(/\{###\}/g, String(sequence).padStart(3, '0'))
    .replace(/\{##\}/g, String(sequence).padStart(2, '0'))
    .replace(/\{#\}/g, String(sequence));
  return hasWsToken || !workspaceCode ? rendered : `${workspaceCode}-${rendered}`;
}
