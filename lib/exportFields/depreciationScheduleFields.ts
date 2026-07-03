import type { ExportField } from './types';

export interface DepreciationScheduleLine {
  runMonth: string;
  amountPaise: number;
  accumulatedAfterPaise: number;
  nbvAfterPaise: number;
  postedAt?: string;
}

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN') : '-');

/**
 * Export fields for the per-asset Depreciation Schedule report.
 * 6 columns: Run Month, Period, Depreciation Amount, Accumulated After, NBV After, Posted At.
 */
export const DEPRECIATION_SCHEDULE_FIELDS: ExportField<DepreciationScheduleLine>[] = [
  {
    key: 'runMonth',
    label: 'Run Month',
    defaultEnabled: true,
    getValue: (r) => r.runMonth,
  },
  {
    key: 'amountPaise',
    label: 'Depreciation (₹)',
    defaultEnabled: true,
    getValue: (r) => r.amountPaise / 100,
    pdfValue: (r) => formatPaise(r.amountPaise),
  },
  {
    key: 'accumulatedAfterPaise',
    label: 'Accumulated After (₹)',
    defaultEnabled: true,
    getValue: (r) => r.accumulatedAfterPaise / 100,
    pdfValue: (r) => formatPaise(r.accumulatedAfterPaise),
  },
  {
    key: 'nbvAfterPaise',
    label: 'NBV After (₹)',
    defaultEnabled: true,
    getValue: (r) => r.nbvAfterPaise / 100,
    pdfValue: (r) => formatPaise(r.nbvAfterPaise),
  },
  {
    key: 'postedAt',
    label: 'Posted At',
    defaultEnabled: true,
    getValue: (r) => fmtDate(r.postedAt),
  },
];
