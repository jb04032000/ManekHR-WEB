'use client';
import React from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Checkbox } from 'antd';
import type { ItcReversalResult } from '@/types';
import { formatCurrencyFull } from '@/lib/utils';

interface ItcReversalAlertProps {
  reversal: ItcReversalResult;
  acknowledged: boolean;
  onAcknowledge: (v: boolean) => void;
}

export default function ItcReversalAlert({
  reversal,
  acknowledged,
  onAcknowledge,
}: ItcReversalAlertProps) {
  const t = useTranslations('finance.fixedAssets.actions.itc');
  if (!reversal.applicable) return null;

  const reversalAmount = formatCurrencyFull(reversal.reversalPaise / 100);

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginTop: 16 }}
      title={t('title')}
      description={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <strong>{t('formula')}</strong> {reversal.formula}
          </div>
          <div>
            <strong>{t('reversalAmount')}</strong>{' '}
            <span style={{ color: 'var(--cr-danger-700)', fontWeight: 600 }}>{reversalAmount}</span>
          </div>
          <div>
            {t('months', {
              used: reversal.monthsUsed,
              remaining: reversal.monthsRemaining,
            })}
          </div>
          <div>
            <a
              href="https://cbic-gst.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12 }}
            >
              {t('faqLink')}
            </a>
          </div>
          <Checkbox checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)}>
            {t('ackCheckbox', { amount: reversalAmount })}
          </Checkbox>
        </div>
      }
    />
  );
}
