'use client';

/**
 * RateRow - a karigar's quoted rates (design-decisions doc §11.1 - daily-wage /
 * piece-rate / monthly are all first-class). Shows only the rates that are set.
 * Carries an info icon explaining the three rate types in plain language
 * (ENGINEERING-STANDARDS #17 - audience is low-literacy).
 */

import { useTranslations } from 'next-intl';
import { InfoTooltip } from '@/components/ui';
import { formatRupeesFromPaise } from '@/lib/connect/format';

export interface RateCardValue {
  /** all amounts in paise */
  dailyWage?: number;
  pieceRate?: number;
  monthly?: number;
}

interface RateRowProps {
  rateCard?: RateCardValue | null;
}

export default function RateRow({ rateCard }: RateRowProps) {
  const t = useTranslations('connect.rateRow');

  const rates = [
    { key: 'dailyWage', label: t('dailyWage'), unit: t('perDay'), value: rateCard?.dailyWage },
    { key: 'pieceRate', label: t('pieceRate'), unit: t('perPiece'), value: rateCard?.pieceRate },
    { key: 'monthly', label: t('monthly'), unit: t('perMonth'), value: rateCard?.monthly },
  ].filter((r): r is typeof r & { value: number } => typeof r.value === 'number' && r.value > 0);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 'var(--cr-space-sm)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--cr-text-3)',
          }}
        >
          {t('title')}
        </span>
        <InfoTooltip text={t('helpTitle')} body={t('help')} />
      </div>

      {rates.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cr-text-4)' }}>{t('notSet')}</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 'var(--cr-space-sm)',
          }}
        >
          {rates.map((r) => (
            <div
              key={r.key}
              style={{
                padding: 'var(--cr-space-sm) var(--cr-space-md)',
                background: 'var(--cr-surface-2)',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-md)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--cr-text-4)' }}>{r.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cr-text)', marginTop: 2 }}>
                {formatRupeesFromPaise(r.value)}
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--cr-text-4)' }}>
                  {' '}
                  {r.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
