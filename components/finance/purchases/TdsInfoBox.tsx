'use client';
import React from 'react';
import { Alert } from 'antd';
import { useTranslations } from 'next-intl';
import type { Tds194QDetail } from '@/types';

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

interface Props {
  tds194Q?: Tds194QDetail;
  cumulativePaise?: number;
  thresholdPaise?: number;
}

export default function TdsInfoBox({ tds194Q, cumulativePaise, thresholdPaise }: Props) {
  const t = useTranslations('finance.purchases');
  if (!tds194Q) {
    return (
      <Alert
        type="info"
        showIcon
        title={t('editor.tds.notApplicableTitle')}
        description={
          thresholdPaise !== undefined && cumulativePaise !== undefined
            ? t('editor.tds.cumulativeProgress', {
                current: formatPaise(cumulativePaise),
                threshold: formatPaise(thresholdPaise),
              })
            : t('editor.tds.notApplicableDescription')
        }
        style={{ marginBottom: 16 }}
      />
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      style={{
        marginBottom: 16,
        background: 'var(--cr-warning-50)',
        borderColor: 'var(--cr-warning-500)',
      }}
      title={t('editor.tds.appliedTitle', { rate: tds194Q.rate })}
      description={
        <div style={{ lineHeight: 1.8 }}>
          <div>
            <strong>{t('editor.tds.section')}</strong> {tds194Q.section}
          </div>
          <div>
            <strong>{t('editor.tds.tdsRate')}</strong> {tds194Q.rate}%
          </div>
          <div>
            <strong>{t('editor.tds.baseAmount')}</strong> {formatPaise(tds194Q.basePaise)}
          </div>
          <div>
            <strong>{t('editor.tds.tdsDeducted')}</strong> {formatPaise(tds194Q.tdsPaise)}
          </div>
          <div>
            <strong>{t('editor.tds.cumulativeBefore')}</strong>{' '}
            {formatPaise(tds194Q.cumulativeBeforePaise)}
          </div>
        </div>
      }
    />
  );
}
