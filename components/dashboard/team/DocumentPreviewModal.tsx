'use client';

import { Button, Empty } from 'antd';
import { DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui/DsModal';

interface Props {
  open: boolean;
  fileUrl: string | null;
  fileName?: string;
  mimeType?: string;
  title?: string;
  onClose: () => void;
}

function isImageMime(mime?: string, url?: string | null): boolean {
  if (mime?.startsWith('image/')) return true;
  if (!url) return false;
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

function isPdfMime(mime?: string, url?: string | null): boolean {
  if (mime === 'application/pdf') return true;
  if (!url) return false;
  return /\.pdf(\?|$)/i.test(url);
}

export function DocumentPreviewModal({ open, fileUrl, fileName, mimeType, title, onClose }: Props) {
  const t = useTranslations('team');
  const showImage = isImageMime(mimeType, fileUrl);
  const showPdf = !showImage && isPdfMime(mimeType, fileUrl);
  const isBlob = fileUrl?.startsWith('blob:');

  return (
    <DsModal
      open={open}
      onCancel={onClose}
      title={title ?? fileName ?? t('docPreviewTitleDefault')}
      width={840}
      scrollHeight="calc(100vh - 240px)"
      footer={
        <div className="flex justify-end gap-2">
          {fileUrl && !isBlob && (
            <Button
              icon={<DownloadOutlined />}
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('docPreviewOpenDownload')}
            </Button>
          )}
          <Button type="primary" onClick={onClose}>
            {t('docPreviewClose')}
          </Button>
        </div>
      }
    >
      {!fileUrl ? (
        <Empty description={t('docPreviewEmpty')} />
      ) : showImage ? (
        <div className="flex justify-center rounded bg-gray-50 p-2">
          <img
            src={fileUrl}
            alt={fileName ?? t('docPreviewImageAlt')}
            className="max-h-[70vh] max-w-full object-contain"
          />
        </div>
      ) : showPdf ? (
        <iframe
          src={fileUrl}
          title={fileName ?? t('docPreviewPdfTitle')}
          className="h-[70vh] w-full rounded border-0 bg-gray-50"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 py-12">
          <FileTextOutlined style={{ fontSize: 56, color: 'var(--cr-text-5)' }} />
          <p className="m-0 text-sm text-gray-600">{t('docPreviewUnavailable')}</p>
          {!isBlob && fileUrl && (
            <Button
              icon={<DownloadOutlined />}
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('docPreviewDownload')}
            </Button>
          )}
        </div>
      )}
    </DsModal>
  );
}
