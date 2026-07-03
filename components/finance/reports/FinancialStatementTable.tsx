'use client';
import type { PlSection, BalanceSheetEntry } from '@/types';
import { fmtPaise } from '@/lib/utils';

interface FinancialStatementRowProps {
  section: PlSection;
}

export function FinancialStatementRow({ section }: FinancialStatementRowProps) {
  const indent = section.level * 20;
  const isTotal = section.type === 'total';
  const isHeader = section.type === 'section_header';
  const amtColor = section.amountPaise < 0 ? 'var(--cr-error)' : 'var(--cr-text)';

  if (isHeader) {
    return (
      <tr style={{ backgroundColor: 'var(--cr-surface-2)' }}>
        <td
          colSpan={2}
          style={{
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--cr-text)',
          }}
        >
          {section.label}
        </td>
      </tr>
    );
  }

  return (
    <tr
      style={{
        borderTop: isTotal ? '1px solid var(--cr-border)' : undefined,
        borderBottom: isTotal ? '2px solid var(--cr-text)' : undefined,
      }}
    >
      <td
        style={{
          paddingLeft: 16 + indent,
          paddingTop: 6,
          paddingBottom: 6,
          paddingRight: 8,
          fontWeight: isTotal ? 700 : 400,
          color: 'var(--cr-text)',
        }}
      >
        {section.label}
      </td>
      <td
        style={{
          textAlign: 'right',
          paddingRight: 16,
          fontWeight: isTotal ? 700 : 400,
          fontVariantNumeric: 'tabular-nums',
          color: amtColor,
        }}
      >
        {section.amountPaise !== 0 ? fmtPaise(Math.abs(section.amountPaise)) : ''}
      </td>
    </tr>
  );
}

interface PLTableProps {
  sections: PlSection[];
  title?: string;
}

export function ProfitLossTable({ sections, title }: PLTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      {title && (
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            margin: '0 0 8px',
          }}
        >
          {title}
        </h3>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <colgroup>
          <col style={{ width: '70%' }} />
          <col style={{ width: '30%' }} />
        </colgroup>
        <tbody>
          {sections.map((s, i) => (
            <FinancialStatementRow key={i} section={s} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Helper to convert BalanceSheetEntry to PlSection for rendering
export function bsEntryToPlSection(e: BalanceSheetEntry): PlSection {
  return {
    label: e.name,
    type: e.type,
    level: e.level,
    amountPaise: e.amountPaise,
  };
}
