import type { ExportField } from './types';
import type { UtilisationExportRow } from '@/types';

/**
 * Phase 25 / D-19: Production Utilisation Dashboard export fields.
 *
 * DEFAULT SET (defaultEnabled: true) - 6 fields:
 *   Machine, Location, Output Total, Uptime %, Downtime (min), Top Reason
 *
 * CUSTOM-ONLY SET (defaultEnabled: false) - 5 fields:
 *   Machine Code, Primary Metric, Scheduled (min), Target %, Period
 *
 * Numeric fields (outputTotal, uptimePct, downtimeMinutes, scheduledMinutes,
 * targetPct) return numbers from getValue() so Excel cells stay numeric. PDF
 * uses pdfValue() for human-readable formatting (e.g. "85.42%", "Rs. counts").
 */
export const UTILISATION_EXPORT_FIELDS: ExportField<UtilisationExportRow>[] = [
  // ── Default fields (6) ──────────────────────────────────────────
  {
    key: 'machineName',
    label: 'Machine',
    defaultEnabled: true,
    getValue: (r) => r.machineName ?? '-',
  },
  {
    key: 'locationName',
    label: 'Location',
    defaultEnabled: true,
    getValue: (r) => r.locationName ?? '-',
  },
  {
    // CR-02 fix: backend now emits one row per (machine, metric) so this
    // value is a single-metric sum (never mixes stitches/pieces/hours).
    // Excel cells stay numeric; the metric label is kept on a separate
    // "Primary Metric" column for spreadsheet-friendly per-column units.
    key: 'outputTotal',
    label: 'Output Total',
    defaultEnabled: true,
    getValue: (r) => r.outputTotal ?? 0,
    pdfValue: (r) =>
      `${Number(r.outputTotal ?? 0).toLocaleString('en-IN')} ${r.outputMetric ?? ''}`.trim(),
  },
  {
    key: 'uptimePct',
    label: 'Uptime %',
    defaultEnabled: true,
    getValue: (r) => r.uptimePct ?? 0,
    pdfValue: (r) => `${Number(r.uptimePct ?? 0).toFixed(2)}%`,
  },
  {
    key: 'downtimeMinutes',
    label: 'Downtime (min)',
    defaultEnabled: true,
    getValue: (r) => r.downtimeMinutes ?? 0,
  },
  {
    key: 'topReasonLabel',
    label: 'Top Reason',
    defaultEnabled: true,
    getValue: (r) => r.topReasonLabel ?? '-',
  },

  // ── Custom-only fields (5) ──────────────────────────────────────
  {
    key: 'machineCode',
    label: 'Machine Code',
    defaultEnabled: false,
    getValue: (r) => r.machineCode ?? '-',
  },
  {
    // CR-02 fix: now defaultEnabled because the export emits one row per
    // (machine, metric) - surfacing the metric label is required to make
    // the per-row Output Total value interpretable.
    key: 'outputMetric',
    label: 'Primary Metric',
    defaultEnabled: true,
    getValue: (r) => r.outputMetric ?? '-',
  },
  {
    key: 'scheduledMinutes',
    label: 'Scheduled (min)',
    defaultEnabled: false,
    getValue: (r) => r.scheduledMinutes ?? 0,
  },
  {
    key: 'targetPct',
    label: 'Target %',
    defaultEnabled: false,
    getValue: (r) => r.targetPct ?? 0,
    pdfValue: (r) => `${r.targetPct ?? 0}%`,
  },
  {
    key: 'period',
    label: 'Period',
    defaultEnabled: false,
    getValue: (r) => (r.periodFrom && r.periodTo ? `${r.periodFrom} → ${r.periodTo}` : '-'),
  },
];
