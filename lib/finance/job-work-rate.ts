import type { JobWorkType } from '@/types';

/**
 * GST rate (%) for textile job-work under SAC 9988. Mirrors the backend
 * resolveJobWorkRate so the web preview matches what the server will post.
 * - general_textile: stitching/general textile job-work = 5%
 * - embroidery: embroidery/zari, a general textile process = 5% (own ledger 4023)
 * - dyeing_printing: legacy combined value, residuary = 18% (own ledger 4021)
 * - printing: printing job-work, residuary = 18% (own ledger 4022)
 * - other: residuary job-work = 18%
 * R5: keep in sync with backend job-work-rate.ts + JW_INCOME_BY_TYPE.
 */
export function resolveJobWorkRate(jobWorkType?: string): number {
  switch (jobWorkType) {
    case 'dyeing_printing':
    case 'printing':
    case 'other':
      return 18;
    case 'embroidery':
    case 'general_textile':
    default:
      return 5;
  }
}

export const JOB_WORK_TYPES: JobWorkType[] = [
  'general_textile',
  'embroidery',
  'dyeing_printing',
  'printing',
  'other',
];

export const JOB_WORK_TYPE_LABELS: Record<JobWorkType, string> = {
  general_textile: 'General Textile (5%)',
  embroidery: 'Embroidery (5%)',
  dyeing_printing: 'Dyeing & Printing (18%)',
  printing: 'Printing (18%)',
  other: 'Other Job-Work (18%)',
};
