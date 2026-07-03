'use client';

/**
 * ERPLinkedPanel - the trust panel that *explains* the ERP-linked moat
 * (design-decisions doc §9.3). The badge alone doesn't explain itself; this
 * panel teaches a new user what "ERP-linked" means. Right rail of Profile /
 * Company Page. Renders nothing when the entity is not ERP-linked.
 */

import { useTranslations } from 'next-intl';
import { formatMonthYear } from '@/lib/connect/format';

interface ERPLinkedPanelProps {
  linked: boolean;
  /** First ERP-activity date - "ERP active since [date]". */
  since?: Date | string | null;
  /** Karigars on roll at the linked workspace. */
  karigarCount?: number;
}

export default function ERPLinkedPanel({ linked, since, karigarCount }: ERPLinkedPanelProps) {
  const t = useTranslations('connect.erpLinked');
  if (!linked) return null;

  const meta: string[] = [];
  if (since) meta.push(t('activeSince', { date: formatMonthYear(since) }));
  if (typeof karigarCount === 'number') {
    meta.push(t('karigarsOnRoll', { count: karigarCount }));
  }

  return (
    <div
      style={{
        padding: 'var(--cr-space-md)',
        background: 'var(--cr-indigo-700)',
        border: '1px solid var(--cr-indigo-700)',
        borderRadius: 'var(--cr-radius-lg)',
        color: 'var(--cr-neutral-0)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--cr-gold-400)',
        }}
      >
        {t('label')}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55 }}>{t('body')}</p>
      {meta.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--cr-indigo-200)' }}>
          {meta.join(' · ')}
        </div>
      )}
    </div>
  );
}
