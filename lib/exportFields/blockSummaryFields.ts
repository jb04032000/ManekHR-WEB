import type { ExportField } from './types';

export interface BlockSummaryRow {
  block: string;
  itActRate: number;
  openingWdvPaise: number;
  additionsPaise: number;
  disposalsPaise: number;
  depreciationPaise: number;
  closingWdvPaise: number;
  assetCount: number;
}

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtRate = (r: number) => `${(r * 100).toFixed(1)}%`;

/**
 * Export fields for the IT Act Block-wise Depreciation Summary report.
 * 7 columns: Block, Rate, Opening WDV, Additions, Disposals, Depreciation, Closing WDV.
 */
export const BLOCK_SUMMARY_FIELDS: ExportField<BlockSummaryRow>[] = [
  {
    key: 'block',
    label: 'IT Act Block',
    defaultEnabled: true,
    getValue: (r) => r.block,
  },
  {
    key: 'itActRate',
    label: 'WDV Rate',
    defaultEnabled: true,
    getValue: (r) => fmtRate(r.itActRate),
  },
  {
    key: 'openingWdvPaise',
    label: 'Opening WDV (₹)',
    defaultEnabled: true,
    getValue: (r) => r.openingWdvPaise / 100,
    pdfValue: (r) => formatPaise(r.openingWdvPaise),
  },
  {
    key: 'additionsPaise',
    label: 'Additions (₹)',
    defaultEnabled: true,
    getValue: (r) => r.additionsPaise / 100,
    pdfValue: (r) => formatPaise(r.additionsPaise),
  },
  {
    key: 'disposalsPaise',
    label: 'Disposals (₹)',
    defaultEnabled: true,
    getValue: (r) => r.disposalsPaise / 100,
    pdfValue: (r) => formatPaise(r.disposalsPaise),
  },
  {
    key: 'depreciationPaise',
    label: 'Depreciation (₹)',
    defaultEnabled: true,
    getValue: (r) => r.depreciationPaise / 100,
    pdfValue: (r) => formatPaise(r.depreciationPaise),
  },
  {
    key: 'closingWdvPaise',
    label: 'Closing WDV (₹)',
    defaultEnabled: true,
    getValue: (r) => r.closingWdvPaise / 100,
    pdfValue: (r) => formatPaise(r.closingWdvPaise),
  },
];
