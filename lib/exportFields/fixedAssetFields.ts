import type { ExportField } from './types';
import type { FixedAsset } from '@/types';

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN') : '-');

/**
 * All exportable fields for the Fixed Assets register.
 *
 * DEFAULT SET (defaultEnabled: true) - 8 fields:
 *   Asset Code, Name, Category, Purchase Date, Cost,
 *   Accumulated Depreciation, NBV, Status
 *
 * OPTIONAL SET (defaultEnabled: false) - 6 fields:
 *   Serial Number, Party Name, Depreciation Method,
 *   Shift Type, Location ID, Custodian Member ID
 */
export const FIXED_ASSET_EXPORT_FIELDS: ExportField<FixedAsset>[] = [
  // ── Default fields ──────────────────────────────────────────────
  {
    key: 'assetCode',
    label: 'Asset Code',
    defaultEnabled: true,
    getValue: (a) => a.assetCode,
  },
  {
    key: 'name',
    label: 'Name',
    defaultEnabled: true,
    getValue: (a) => a.name,
  },
  {
    key: 'categoryName',
    label: 'Category',
    defaultEnabled: true,
    getValue: (a) => ((a.categorySnapshot as Record<string, unknown>)?.name as string) ?? '-',
  },
  {
    key: 'purchaseDate',
    label: 'Purchase Date',
    defaultEnabled: true,
    getValue: (a) => fmtDate(a.purchaseDate),
  },
  {
    key: 'costPaise',
    label: 'Cost',
    defaultEnabled: true,
    getValue: (a) => a.costPaise / 100,
    pdfValue: (a) => formatPaise(a.costPaise),
  },
  {
    key: 'accumulatedDepreciationPaise',
    label: 'Accumulated Depreciation',
    defaultEnabled: true,
    getValue: (a) => a.accumulatedDepreciationPaise / 100,
    pdfValue: (a) => formatPaise(a.accumulatedDepreciationPaise),
  },
  {
    key: 'nbvPaise',
    label: 'Net Book Value (NBV)',
    defaultEnabled: true,
    getValue: (a) => a.nbvPaise / 100,
    pdfValue: (a) => formatPaise(a.nbvPaise),
  },
  {
    key: 'status',
    label: 'Status',
    defaultEnabled: true,
    getValue: (a) => a.status.charAt(0).toUpperCase() + a.status.slice(1),
  },

  // ── Optional fields ──────────────────────────────────────────────
  {
    key: 'serialNumber',
    label: 'Serial Number',
    defaultEnabled: false,
    getValue: (a) => a.serialNumber ?? '-',
  },
  {
    key: 'partyName',
    label: 'Vendor / Party',
    defaultEnabled: false,
    getValue: (a) => a.partyName ?? '-',
  },
  {
    key: 'depreciationMethod',
    label: 'Depreciation Method',
    defaultEnabled: false,
    getValue: (a) => a.depreciationMethod.toUpperCase(),
  },
  {
    key: 'shiftType',
    label: 'Shift Type',
    defaultEnabled: false,
    getValue: (a) => a.shiftType.charAt(0).toUpperCase() + a.shiftType.slice(1),
  },
  {
    key: 'locationId',
    label: 'Location',
    defaultEnabled: false,
    getValue: (a) => a.locationId ?? '-',
  },
  {
    key: 'custodianMemberId',
    label: 'Custodian',
    defaultEnabled: false,
    getValue: (a) => a.custodianMemberId ?? '-',
  },
];
