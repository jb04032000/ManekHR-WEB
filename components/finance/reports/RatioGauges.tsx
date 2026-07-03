'use client';
// RatioGauges — a responsive row of DsStatCard tiles surfacing the headline
// financial ratios (GP%, NP%, Current Ratio, Debt-Equity, ROE%, Working Capital).
// Presentational: AccountingInsights passes the already-fetched RatioAnalysisReport.
// Percentages are formatted to 1 decimal; Working Capital is paise → fmtPaiseCompact.
// Reuses DsStatCard gradient variants for the PowerBI-style coloured tiles.
import { DsStatCard } from '@/components/ui/DsCard';
import { fmtPaiseCompact } from '@/lib/utils';
import type { RatioAnalysisReport } from '@/types';

interface Props {
  ratios: RatioAnalysisReport;
}

// 1-decimal number formatting; tolerant of null/NaN from a thin BE response.
const num1 = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(1);

export function RatioGauges({ ratios }: Props) {
  const r = ratios;
  const tiles: Array<{
    label: string;
    value: string;
    gradient: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'teal' | 'indigo';
  }> = [
    { label: 'Gross Profit %', value: `${num1(r?.gpPct)}%`, gradient: 'blue' },
    { label: 'Net Profit %', value: `${num1(r?.npPct)}%`, gradient: 'green' },
    { label: 'Current Ratio', value: num1(r?.currentRatio), gradient: 'teal' },
    { label: 'Debt / Equity', value: num1(r?.debtEquity), gradient: 'amber' },
    { label: 'Return on Equity %', value: `${num1(r?.returnOnEquity)}%`, gradient: 'purple' },
    {
      label: 'Working Capital',
      value: fmtPaiseCompact(r?.workingCapitalPaise ?? 0),
      gradient: 'indigo',
    },
  ];

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}
      className="md:grid-cols-3 lg:grid-cols-6"
    >
      {tiles.map((t) => (
        <DsStatCard key={t.label} label={t.label} value={t.value} gradient={t.gradient} />
      ))}
    </div>
  );
}

export default RatioGauges;
