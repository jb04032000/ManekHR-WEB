import type { ExportField } from './types';
import type { PartyPnlReport } from '@/types';

/**
 * Party P&L exportable fields (FIN-16-04 / D-21).
 *
 * The export receives a single-row dataset (the report itself is one row).
 *
 * DEFAULT (defaultEnabled: true) - 8 fields:
 *   partyName, periodFrom, periodTo, revenueRupees, cogsRupees,
 *   grossProfitRupees, grossMarginPct, invoiceCount
 *
 * CUSTOM-ONLY (defaultEnabled: false) - 3 fields:
 *   creditNoteCount, avgInvoiceValueRupees, partyId
 *
 * Paise → rupees conversion happens at the display boundary (divide by 100).
 */

export type PartyPnlReportField = ExportField<PartyPnlReport>;

const fmtINR = (paise: number | null | undefined): string => {
  if (paise == null || Number.isNaN(paise)) return '-';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

export const PARTY_PNL_EXPORT_FIELDS: PartyPnlReportField[] = [
  // ── Default fields ──────────────────────────────────────────────
  {
    key: 'partyName',
    label: 'Party',
    defaultEnabled: true,
    getValue: (r) => r.partyName ?? '-',
  },
  {
    key: 'periodFrom',
    label: 'Period From',
    defaultEnabled: true,
    getValue: (r) => fmtDate(r.periodFrom),
  },
  {
    key: 'periodTo',
    label: 'Period To',
    defaultEnabled: true,
    getValue: (r) => fmtDate(r.periodTo),
  },
  {
    key: 'revenueRupees',
    label: 'Revenue',
    defaultEnabled: true,
    getValue: (r) => Number(((r.revenuePaise ?? 0) / 100).toFixed(2)),
    pdfValue: (r) => fmtINR(r.revenuePaise),
    pdf: { halign: 'right' },
  },
  {
    key: 'cogsRupees',
    label: 'COGS',
    defaultEnabled: true,
    getValue: (r) => Number(((r.cogsPaise ?? 0) / 100).toFixed(2)),
    pdfValue: (r) => fmtINR(r.cogsPaise),
    pdf: { halign: 'right' },
  },
  {
    key: 'grossProfitRupees',
    label: 'Gross Profit',
    defaultEnabled: true,
    getValue: (r) => Number(((r.grossProfitPaise ?? 0) / 100).toFixed(2)),
    pdfValue: (r) => fmtINR(r.grossProfitPaise),
    pdf: { halign: 'right' },
  },
  {
    key: 'grossMarginPct',
    label: 'Gross Margin %',
    defaultEnabled: true,
    getValue: (r) => (r.grossMarginPct == null ? '-' : Number(r.grossMarginPct.toFixed(2))),
    pdfValue: (r) => (r.grossMarginPct == null ? '-' : `${r.grossMarginPct.toFixed(2)}%`),
    pdf: { halign: 'right' },
  },
  {
    key: 'invoiceCount',
    label: 'Invoices',
    defaultEnabled: true,
    getValue: (r) => r.invoiceCount ?? 0,
    pdf: { halign: 'right' },
  },

  // ── Custom-only fields ──────────────────────────────────────────
  {
    key: 'creditNoteCount',
    label: 'Credit Notes',
    defaultEnabled: false,
    getValue: (r) => r.creditNoteCount ?? 0,
    pdf: { halign: 'right' },
  },
  {
    key: 'avgInvoiceValueRupees',
    label: 'Avg Invoice Value',
    defaultEnabled: false,
    getValue: (r) => Number(((r.avgInvoiceValuePaise ?? 0) / 100).toFixed(2)),
    pdfValue: (r) => fmtINR(r.avgInvoiceValuePaise),
    pdf: { halign: 'right' },
  },
  {
    key: 'partyId',
    label: 'Party ID',
    defaultEnabled: false,
    getValue: (r) => r.partyId ?? '-',
  },
];
