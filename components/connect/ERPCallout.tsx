'use client';

/**
 * ERPCallout - "From your ERP" (design-decisions doc §9.4). Shown to a
 * workspace owner on the Feed left rail / Day-1 home: closes the loop that ERP
 * usage isn't just internal admin - it's marketing, visible to buyers.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatRupeesFromPaise } from '@/lib/connect/format';

interface ERPCalloutProps {
  karigarCount: number;
  /** This month's payroll, in paise. */
  payrollPaise: number;
  /** Link into the ERP dashboard. */
  erpHref?: string;
}

export default function ERPCallout({
  karigarCount,
  payrollPaise,
  erpHref = '/dashboard',
}: ERPCalloutProps) {
  const t = useTranslations('connect.erpCallout');

  return (
    <div
      style={{
        padding: 'var(--cr-space-md)',
        background: 'var(--cr-wash-indigo)',
        border: '1px solid var(--cr-primary-border)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--cr-primary)',
        }}
      >
        {t('label')}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--cr-text)' }}>
        {t('stats', {
          karigars: karigarCount,
          payroll: formatRupeesFromPaise(payrollPaise),
        })}
      </div>
      <p style={{ margin: '6px 0 10px', fontSize: 12, lineHeight: 1.5, color: 'var(--cr-text-4)' }}>
        {t('body')}
      </p>
      <Link
        href={erpHref}
        className="no-underline"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--cr-primary)',
        }}
      >
        {t('openErp')}
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
