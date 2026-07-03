'use client';
// Shared empty/idle state for finance report pages. i18n via finance.reports.common.*
// (keys: idlePrompt, emptyTitle, emptyBody). Cross-link: rendered by every report page
// under app/.../finance/.../reports/* alongside ReportToolbar + ReportFilterBar.
import { Empty } from 'antd';
import { useTranslations } from 'next-intl';

interface Props {
  mode?: 'no-data' | 'idle';
}

export function ReportEmptyState({ mode = 'no-data' }: Props) {
  const t = useTranslations('finance.reports');
  if (mode === 'idle') {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: 200, color: 'var(--cr-text-4)', fontSize: 14 }}
      >
        {t('common.idlePrompt')}
      </div>
    );
  }
  return (
    <Empty
      description={
        <div>
          <p style={{ fontWeight: 700, color: 'var(--cr-text)', margin: '0 0 4px' }}>
            {t('common.emptyTitle')}
          </p>
          <p style={{ color: 'var(--cr-text-3)', fontSize: 13, margin: 0 }}>
            {t('common.emptyBody')}
          </p>
        </div>
      }
    />
  );
}
