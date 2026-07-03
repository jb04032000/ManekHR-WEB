'use client';
/**
 * Right-aligned totals footer for the voucher editor.
 * Per F-02 UI-SPEC: max-width 360px, Grand Total Syne 20/700, amount-in-words 12px italic --cr-text-3.
 */
import { amountInWords } from '@/lib/finance/amountInWords';
import type { TaxComputeResult } from '@/lib/finance/taxComputeClient';

function fmt(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

interface TotalsRowProps {
  label: string;
  value: string;
  isGrandTotal?: boolean;
}

function TotalsRow({ label, value, isGrandTotal }: TotalsRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
        borderTop: isGrandTotal ? '1px solid var(--cr-border)' : undefined,
        marginTop: isGrandTotal ? 4 : undefined,
      }}
    >
      <span
        style={{
          fontSize: isGrandTotal ? 16 : 14,
          fontWeight: isGrandTotal ? 700 : 400,
          fontFamily: isGrandTotal ? 'var(--font-display)' : 'var(--font-body)',
          color: 'var(--cr-text-2)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: isGrandTotal ? 20 : 14,
          fontWeight: isGrandTotal ? 700 : 400,
          fontFamily: isGrandTotal ? 'var(--font-display)' : 'var(--font-body)',
          fontVariantNumeric: 'tabular-nums',
          color: isGrandTotal ? 'var(--cr-text)' : 'var(--cr-text-2)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface TcsInfo {
  partyName: string;
  cumulativePaise: number;
}

interface TotalsFooterProps {
  result: TaxComputeResult;
  tcsInfo?: TcsInfo;
}

export function TotalsFooter({ result, tcsInfo: _tcsInfo }: TotalsFooterProps) {
  const isInter = result.igstPaise > 0;
  const hasDiscount = result.totalDiscountPaise > 0;
  const hasCess = result.cessPaise > 0;
  const hasTcs = result.tcsPaise > 0;
  const hasRoundOff = result.roundOffPaise !== 0;

  const words = amountInWords(result.grandTotalPaise);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <TotalsRow label="Subtotal" value={fmt(result.subtotalPaise)} />

        {hasDiscount && (
          <TotalsRow label="Total Discount" value={`– ${fmt(result.totalDiscountPaise)}`} />
        )}

        <TotalsRow label="Taxable Value" value={fmt(result.taxableValuePaise)} />

        {!isInter && (
          <>
            <TotalsRow label="CGST" value={fmt(result.cgstPaise)} />
            <TotalsRow label="SGST" value={fmt(result.sgstPaise)} />
          </>
        )}
        {isInter && <TotalsRow label="IGST" value={fmt(result.igstPaise)} />}

        {hasCess && <TotalsRow label="Cess" value={fmt(result.cessPaise)} />}

        {hasTcs && <TotalsRow label="TCS (206C)" value={fmt(result.tcsPaise)} />}

        {hasRoundOff && (
          <TotalsRow
            label="Round-off"
            value={`${result.roundOffPaise > 0 ? '+' : ''}${fmt(Math.abs(result.roundOffPaise))}`}
          />
        )}

        <TotalsRow label="Grand Total" value={fmt(result.grandTotalPaise)} isGrandTotal />

        {words && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12,
              fontStyle: 'italic',
              color: 'var(--cr-text-3)',
              textAlign: 'right',
            }}
          >
            {words}
          </p>
        )}
      </div>
    </div>
  );
}
