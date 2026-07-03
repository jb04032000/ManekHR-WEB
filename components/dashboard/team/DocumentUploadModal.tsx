'use client';

import { useMemo, useRef, useState } from 'react';
import { Alert, Button, Input, Progress, Typography } from 'antd';
import {
  CloudUploadOutlined,
  FileTextOutlined,
  FileImageOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui/DsModal';
import type { TeamMemberDocumentType } from '@/types';
import { DOC_TYPE_META, type DocTypeMeta } from '@/lib/constants/documentTypes';

const { Text } = Typography;

interface Props {
  open: boolean;
  type: TeamMemberDocumentType | null;
  initialLabel?: string;
  uploading: boolean;
  progress: number;
  onClose: () => void;
  onConfirm: (file: File, label?: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderInstruction(text: string) {
  // Convert **bold** markers to <strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

export function DocumentUploadModal(props: Props) {
  const { type } = props;
  if (!type) return null;
  const meta = DOC_TYPE_META[type];
  if (!meta) return null;
  return <UploadModalBody key={type} {...props} type={type} meta={meta} />;
}

function UploadModalBody({
  open,
  meta,
  initialLabel,
  uploading,
  progress,
  onClose,
  onConfirm,
}: Props & { type: TeamMemberDocumentType; meta: DocTypeMeta }) {
  const t = useTranslations('team');
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState(initialLabel ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptAttr = useMemo(() => meta.acceptedTypes.join(','), [meta]);

  const validate = (f: File): string | null => {
    if (!meta.acceptedTypes.includes(f.type)) {
      return t('docUploadInvalidType', { hint: meta.acceptedTypesHint });
    }
    if (f.size > meta.maxSizeMb * 1024 * 1024) {
      return t('docUploadInvalidSize', { mb: meta.maxSizeMb });
    }
    return null;
  };

  const handleSelect = (f: File) => {
    const err = validate(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    const f = e.dataTransfer.files[0];
    if (f) handleSelect(f);
  };

  const handleConfirm = () => {
    if (!file) return;
    if (meta.requiresLabel && !label.trim()) {
      setError(t('docUploadLabelRequired'));
      return;
    }
    onConfirm(file, meta.requiresLabel ? label.trim() : undefined);
  };

  const isImage = file?.type.startsWith('image/');
  const isPdf = file?.type === 'application/pdf';

  return (
    <DsModal
      open={open}
      onCancel={uploading ? undefined : onClose}
      mask={{ closable: !uploading }}
      closable={!uploading}
      title={t('docUploadTitle', { type: meta.label })}
      width={560}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={uploading}>
            {t('docUploadCancel')}
          </Button>
          <Button
            type="primary"
            loading={uploading}
            disabled={!file || (meta.requiresLabel && !label.trim())}
            onClick={handleConfirm}
          >
            {uploading ? t('docUploadSubmitting') : t('docUploadSubmit')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          title={<span className="text-sm">{renderInstruction(meta.instruction)}</span>}
        />

        {meta.requiresLabel && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              {t('docUploadLabelField')} <span className="text-red-700">*</span>
            </label>
            <Input
              placeholder={t('docUploadLabelPlaceholder')}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={64}
              disabled={uploading}
            />
          </div>
        )}

        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-gray-50">
              {isImage ? (
                <FileImageOutlined style={{ fontSize: 24, color: 'var(--cr-text-4)' }} />
              ) : isPdf ? (
                <FileTextOutlined style={{ fontSize: 24, color: 'var(--cr-danger-700)' }} />
              ) : (
                <FileTextOutlined style={{ fontSize: 24, color: 'var(--cr-text-4)' }} />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <Text className="truncate text-sm font-medium text-gray-800">{file.name}</Text>
              <Text className="text-xs text-gray-700">{formatBytes(file.size)}</Text>
            </div>
            {!uploading && (
              <Button type="text" icon={<CloseCircleOutlined />} onClick={() => setFile(null)} />
            )}
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'} ${uploading ? 'cursor-not-allowed opacity-50' : ''} `}
          >
            <CloudUploadOutlined style={{ fontSize: 36, color: 'var(--cr-text-5)' }} />
            <div>
              <p className="m-0 text-sm text-gray-700">{t('docUploadDropText')}</p>
              <p className="m-0 mt-1 text-xs text-gray-700">
                {t('docUploadAcceptInfo', {
                  hint: meta.acceptedTypesHint,
                  mb: meta.maxSizeMb,
                })}
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={acceptAttr}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSelect(f);
                e.target.value = '';
              }}
              disabled={uploading}
            />
          </div>
        )}

        {error && <Alert type="error" showIcon title={error} />}

        {uploading && progress > 0 && <Progress percent={progress} size="small" status="active" />}
      </div>
    </DsModal>
  );
}
