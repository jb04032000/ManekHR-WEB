'use client';
/**
 * Amber info box for TCS auto-application under Section 206C(1H).
 * Per F-02 UI-SPEC: bg var(--cr-warning-50), border 1px var(--cr-warning-500), border-radius --cr-radius-md, padding 12px.
 */
import { InfoCircleOutlined } from '@ant-design/icons';

interface TcsInfoBoxProps {
  amountPaise: number;
  partyName: string;
  cumulativePaise: number;
}

function fmt(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function TcsInfoBox({ amountPaise, partyName, cumulativePaise }: TcsInfoBoxProps) {
  return (
    <div
      style={{
        background: 'var(--cr-warning-50)',
        border: '1px solid var(--cr-warning-500)',
        borderRadius: 'var(--cr-radius-md, 10px)',
        padding: 12,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        margin: '8px 16px',
      }}
    >
      <InfoCircleOutlined style={{ color: 'var(--cr-warning-700)', fontSize: 14, marginTop: 2 }} />
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--cr-warning-700)',
          lineHeight: 1.5,
        }}
      >
        TCS of ₹{fmt(amountPaise)} @ 0.1% auto-applied (Sec 206C(1H)). Cumulative sales to{' '}
        <strong>{partyName}</strong>: ₹{fmt(cumulativePaise)}.
      </p>
    </div>
  );
}
