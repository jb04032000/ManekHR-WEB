'use client';
/**
 * Sticky right-rail invoice summary for the voucher editor.
 * Shows subtotal -> discount -> taxable -> rate-wise GST breakdown -> round-off ->
 * grand total (+ amount in words), then the primary Save & Post / Save Draft / Preview
 * actions. Reads the live TaxComputeResult so it stays in lock-step with the line grid
 * and the posted snapshot. Replaces the old TotalsFooter + Tax Summary tab.
 * Cross-links: VoucherEditor (owner of taxResult + handlers), Can (RBAC gate on post),
 * precision.ts (charge GST, kept byte-identical to computeTaxClient so the breakdown
 * total always equals the grand-total tax line).
 */
import { Switch } from 'antd';
import { useTranslations } from 'next-intl';
import { amountInWords } from '@/lib/finance/amountInWords';
import { gstHalves, igstPaise as gstIgst } from '@/lib/finance/precision';
import type { TaxComputeResult } from '@/lib/finance/taxComputeClient';
import type { AdditionalCharge, LineItem } from '@/types';

function fmt(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

interface RateRow {
  rate: number;
  taxablePaise: number;
  taxPaise: number;
}

// Group taxable value + GST by rate slab for the rail breakdown. Folds in taxable
// additional charges using the SAME precision helpers as computeTaxClient, so the
// breakdown total always reconciles to result.cgst+sgst+igst.
function buildRateWise(
  lines: LineItem[],
  charges: AdditionalCharge[],
  isIntraState: boolean,
): RateRow[] {
  const map = new Map<number, RateRow>();
  const add = (rate: number, taxablePaise: number, taxPaise: number) => {
    if (!rate) return; // 0% lines carry no GST -> not part of the GST breakdown
    const cur = map.get(rate) ?? { rate, taxablePaise: 0, taxPaise: 0 };
    cur.taxablePaise += taxablePaise;
    cur.taxPaise += taxPaise;
    map.set(rate, cur);
  };

  for (const l of lines) {
    const taxable = l.taxableValuePaise ?? 0;
    const tax = isIntraState ? (l.cgstPaise ?? 0) + (l.sgstPaise ?? 0) : (l.igstPaise ?? 0);
    add(l.taxRate ?? 0, taxable, tax);
  }
  for (const c of charges) {
    if (!c.isTaxable || c.taxRate == null) continue;
    const tax = isIntraState
      ? (() => {
          const h = gstHalves(c.amountPaise, c.taxRate);
          return h.cgstPaise + h.sgstPaise;
        })()
      : gstIgst(c.amountPaise, c.taxRate);
    add(c.taxRate, c.amountPaise, tax);
  }

  return [...map.values()].sort((a, b) => a.rate - b.rate);
}

interface SummaryLineProps {
  label: string;
  value: string;
  negative?: boolean;
  muted?: boolean;
}

function SummaryLine({ label, value, negative, muted }: SummaryLineProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
      }}
    >
      <span style={{ fontSize: 13, color: muted ? 'var(--cr-text-3)' : 'var(--cr-text-2)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
          color: negative ? 'var(--cr-success, #1a7f4b)' : 'var(--cr-text)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface InvoiceSummaryRailProps {
  result: TaxComputeResult;
  charges: AdditionalCharge[];
  isIntraState: boolean;
  /** Per-invoice round-off toggle. Controlled by the editor (feeds taxContext). */
  roundOff: boolean;
  onRoundOffChange: (v: boolean) => void;
}

export function InvoiceSummaryRail({
  result,
  charges,
  isIntraState,
  roundOff,
  onRoundOffChange,
}: InvoiceSummaryRailProps) {
  const t = useTranslations('finance.sales');
  const rows = buildRateWise(result.lines, charges, isIntraState);
  const gstLabel = isIntraState ? 'CGST + SGST' : 'IGST';
  const totalGstPaise = result.cgstPaise + result.sgstPaise + result.igstPaise;
  const words = amountInWords(result.grandTotalPaise);

  return (
    <aside
      style={{
        position: 'sticky',
        top: 72,
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-xl)',
        boxShadow: 'var(--cr-shadow-card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 18px 2px',
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: 'var(--cr-text-3)',
        }}
      >
        {t('editor.rail.summary')}
      </div>

      <div style={{ padding: '6px 18px 14px' }}>
        <SummaryLine label={t('editor.rail.subtotal')} value={fmt(result.subtotalPaise)} />
        {result.totalDiscountPaise > 0 && (
          <SummaryLine
            label={t('editor.rail.discount')}
            value={`- ${fmt(result.totalDiscountPaise)}`}
            negative
          />
        )}
        <div style={{ borderTop: '1px solid var(--cr-border-light, var(--cr-border))' }} />
        <SummaryLine label={t('editor.rail.taxableValue')} value={fmt(result.taxableValuePaise)} />

        {/* Rate-wise GST breakdown (mirrors a GST invoice's tax table) */}
        {rows.length > 0 && (
          <div
            style={{
              margin: '8px 0',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-md, 10px)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '7px 12px',
                background: 'var(--cr-surface-2)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                color: 'var(--cr-text-2)',
              }}
            >
              <span>
                {gstLabel} {t('editor.rail.breakdownSuffix')}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(totalGstPaise)}</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: '2px 10px',
                padding: '6px 12px 8px',
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--cr-text-3)', fontSize: 10.5 }}>
                {t('editor.rail.slab')}
              </span>
              <span style={{ color: 'var(--cr-text-3)', fontSize: 10.5, textAlign: 'right' }}>
                {t('editor.rail.taxableCol')}
              </span>
              <span style={{ color: 'var(--cr-text-3)', fontSize: 10.5, textAlign: 'right' }}>
                {isIntraState ? 'C+S' : 'IGST'}
              </span>
              {rows.map((r) => (
                <RateRowCells key={r.rate} row={r} />
              ))}
            </div>
          </div>
        )}

        {/* R12: i18n the Cess / TCS summary labels (were hardcoded English). */}
        {result.cessPaise > 0 && (
          <SummaryLine label={t('editor.rail.cess')} value={fmt(result.cessPaise)} />
        )}
        {result.tcsPaise > 0 && (
          <SummaryLine label={t('editor.rail.tcs')} value={fmt(result.tcsPaise)} />
        )}

        {/* Per-invoice round-off toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0 2px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch size="small" checked={roundOff} onChange={onRoundOffChange} />
            <span style={{ fontSize: 13, color: 'var(--cr-text-2)' }}>
              {t('editor.rail.roundOff')}
            </span>
          </span>
          <span
            style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--cr-text-3)' }}
          >
            {result.roundOffPaise === 0
              ? '₹0.00'
              : `${result.roundOffPaise > 0 ? '+' : '-'} ${fmt(Math.abs(result.roundOffPaise))}`}
          </span>
        </div>
      </div>

      {/* Grand total band */}
      <div
        style={{
          margin: '0 18px',
          padding: '14px 16px',
          borderRadius: 'var(--cr-radius-md, 10px)',
          background: 'var(--cr-surface-inverse, #0B6E4F)',
          color: 'var(--cr-surface-inverse-on, #fff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, opacity: 0.8 }}>
            {t('editor.rail.grandTotal')}
          </div>
          {words && (
            <div style={{ fontSize: 11, fontStyle: 'italic', opacity: 0.7, marginTop: 2 }}>
              {words}
            </div>
          )}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {fmt(result.grandTotalPaise)}
        </div>
      </div>

      <div style={{ height: 16 }} />
    </aside>
  );
}

function RateRowCells({ row }: { row: RateRow }) {
  return (
    <>
      <span
        style={{
          fontWeight: 700,
          color: 'var(--cr-primary, #0B6E4F)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {row.rate}%
      </span>
      <span
        style={{
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--cr-text-2)',
        }}
      >
        {fmt(row.taxablePaise)}
      </span>
      <span
        style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--cr-text)' }}
      >
        {fmt(row.taxPaise)}
      </span>
    </>
  );
}
