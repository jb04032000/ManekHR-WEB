'use client';

/**
 * ResumeUpload - a single resume/CV file picker for the job apply form.
 *
 * Exactly ONE document at a time (selecting another replaces it). Validates
 * client-side against the PRIVATE `connect-job-resume` upload policy (PDF / DOC /
 * DOCX, <=10 MB) via preCheckUpload before uploading through uploadService - the
 * backend re-validates (uploads.service `validateFileWithCategory`), so this is
 * the friendly pre-check only. The committed value is the stored ref (a private
 * `r2-private://` ref the API later signs into a 1h URL) + the original filename.
 *
 * NOTE: resumes used to share the public `documents` bucket; they now have their
 * own PRIVATE bucket so a CV is never world-readable. The href the recruiter
 * clicks is a fresh signed URL decorated by the BE on the application read.
 *
 * Links to: ApplicationComposer (owns resumeUrl/resumeName state) and
 * lib/services/upload.service + lib/upload-policies (the `connect-job-resume` bucket).
 */

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { message as antdMessage } from 'antd';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { uploadService } from '@/lib/services/upload.service';
import { getAcceptAttr, preCheckUpload } from '@/lib/upload-policies.helpers';

const CATEGORY = 'connect-job-resume' as const;

export default function ResumeUpload({
  url,
  name,
  onChange,
  onClear,
}: {
  url: string | null;
  name: string;
  /** Called with the uploaded file URL + its original filename. */
  onChange: (url: string, name: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations('connect.jobs');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the SAME file again still fires onChange.
    e.target.value = '';
    if (!file) return;
    const violation = preCheckUpload(file, CATEGORY);
    if (violation) {
      antdMessage.error(violation.reason === 'size' ? t('resumeTooLarge') : t('resumeWrongType'));
      return;
    }
    setUploading(true);
    try {
      const res = await uploadService.uploadSingle(file, { category: CATEGORY });
      onChange(res.url, file.name);
    } catch {
      antdMessage.error(t('resumeUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--cr-surface-2)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 'var(--cr-space-md)',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={getAcceptAttr(CATEGORY)}
        className="hidden"
        onChange={onFile}
        aria-hidden
        tabIndex={-1}
      />

      {url ? (
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center"
            style={{
              borderRadius: 'var(--cr-radius-md)',
              background: 'var(--cr-primary-light)',
              color: 'var(--cr-primary)',
            }}
          >
            <FileText size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[13px] font-semibold no-underline hover:underline"
              style={{ color: 'var(--cr-primary)' }}
            >
              {name || t('resumeView')}
            </a>
            <div className="text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('resumeUploaded')}
            </div>
          </div>
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            className="shrink-0 cursor-pointer rounded-md px-2.5 py-1 text-[12px] font-semibold"
            style={{
              border: '1px solid var(--cr-border)',
              background: 'var(--cr-surface)',
              color: 'var(--cr-text-2)',
            }}
          >
            {uploading ? t('resumeUploading') : t('resumeReplace')}
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label={t('resumeRemove')}
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md"
            style={{
              border: '1px solid var(--cr-border)',
              background: 'var(--cr-surface)',
              color: 'var(--cr-text-4)',
            }}
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold disabled:opacity-60"
            style={{
              border: '1px solid var(--cr-primary)',
              background: 'var(--cr-surface)',
              color: 'var(--cr-primary)',
            }}
          >
            {uploading ? (
              <Loader2 size={15} aria-hidden className="animate-spin" />
            ) : (
              <Upload size={15} aria-hidden />
            )}
            {uploading ? t('resumeUploading') : t('resumeUpload')}
          </button>
          <span className="text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('resumeHint')}
          </span>
        </div>
      )}
    </div>
  );
}
