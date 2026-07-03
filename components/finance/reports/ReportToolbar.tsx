'use client';
// Sticky toolbar for finance report pages: back-link + breadcrumb on top, then the
// report title rendered through the shared DsPageHeader (title + InfoTooltip via
// titleAside) with export/favorite controls in its right slot. i18n via
// finance.reports.common.* (back, breadcrumbRoot, exportPdf, exportExcel, runFirst,
// favorite toggles). Cross-link: paired with ReportFilterBar + ReportEmptyState on
// every page under app/.../finance/.../reports/*. Watch: reportName/category come in
// already-translated from each page; keep the prop contract stable for all callers.
import { Button, Breadcrumb, Tooltip } from 'antd';
import { useTranslations } from 'next-intl';
import {
  FilePdfOutlined,
  FileExcelOutlined,
  StarOutlined,
  StarFilled,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { DsPageHeader, InfoTooltip } from '@/components/ui';

interface ReportToolbarProps {
  firmId: string;
  reportName: string;
  category: string;
  categoryPath: string;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  dataLoaded?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  exportLoading?: boolean;
  /** Optional explainer shown next to the title for non-obvious reports. */
  info?: string;
}

export function ReportToolbar({
  firmId,
  reportName,
  category,
  onExportPdf,
  onExportExcel,
  dataLoaded = false,
  isFavorite = false,
  onToggleFavorite,
  exportLoading = false,
  info,
}: ReportToolbarProps) {
  const t = useTranslations('finance.reports');
  const basePath = `/dashboard/finance/firms/${firmId}/reports`;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backgroundColor: 'var(--cr-surface)',
        borderBottom: '1px solid var(--cr-border)',
        padding: '8px 24px',
      }}
    >
      {/* Back + breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <Link href={basePath} style={{ color: 'var(--cr-text-3)', fontSize: 13 }}>
          <ArrowLeftOutlined /> {t('common.breadcrumbRoot')}
        </Link>
        <Breadcrumb
          aria-label={t('common.breadcrumbAria')}
          items={[
            { title: <Link href={basePath}>{t('common.breadcrumbRoot')}</Link> },
            { title: category },
            { title: reportName },
          ]}
          style={{ fontSize: 13 }}
        />
      </div>

      {/* Title (DsPageHeader) + export/favorite controls */}
      <DsPageHeader
        title={reportName}
        style={{ marginBottom: 0 }}
        titleAside={info ? <InfoTooltip text={info} /> : undefined}
        right={
          <>
            <Tooltip title={dataLoaded ? undefined : t('common.runFirst')}>
              <Button
                icon={<FilePdfOutlined />}
                onClick={onExportPdf}
                disabled={!dataLoaded || exportLoading}
                loading={exportLoading}
                aria-label={t('common.exportPdfOf', { report: reportName })}
              >
                {t('common.exportPdf')}
              </Button>
            </Tooltip>
            <Tooltip title={dataLoaded ? undefined : t('common.runFirst')}>
              <Button
                icon={<FileExcelOutlined />}
                onClick={onExportExcel}
                disabled={!dataLoaded || exportLoading}
                aria-label={t('common.exportExcelOf', { report: reportName })}
              >
                {t('common.exportExcel')}
              </Button>
            </Tooltip>
            {onToggleFavorite && (
              <Tooltip title={isFavorite ? t('common.favoriteRemove') : t('common.favoriteAdd')}>
                <Button
                  type="text"
                  icon={
                    isFavorite ? (
                      <StarFilled style={{ color: 'var(--cr-warning)' }} />
                    ) : (
                      <StarOutlined />
                    )
                  }
                  onClick={onToggleFavorite}
                  aria-label={isFavorite ? t('common.favoriteRemove') : t('common.favoriteAdd')}
                />
              </Tooltip>
            )}
          </>
        }
      />
    </div>
  );
}
