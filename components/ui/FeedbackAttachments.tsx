'use client';

// Feedback photo attachments — up to 3 images to the private erp-feedback-media
// bucket. Mirrors MediaUploadGrid's tile/progress/remove, trimmed to images +
// cap 3. Emits completed r2-private:// refs to the parent via onChange from a
// useEffect (StrictMode-safe — never emit inside a setState updater). Also
// accepts externally-added Files (screen capture) via the imperative handle.
// Links to: FeedbackPanel.tsx, FeedbackScreenCapture.tsx, upload.service.ts.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { uploadService } from '@/lib/services/upload.service';
import { preCheckUpload } from '@/lib/upload-policies.helpers';

const CATEGORY = 'erp-feedback-media' as const;
const MAX = 3;

interface Tile {
  id: string;
  previewUrl: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  url?: string;
}

export interface FeedbackAttachmentsHandle {
  addFile: (file: File) => void;
  count: () => number;
}

export interface FeedbackAttachmentsProps {
  onChange: (refs: string[]) => void;
  onLimit?: () => void;
}

export const FeedbackAttachments = forwardRef<FeedbackAttachmentsHandle, FeedbackAttachmentsProps>(
  function FeedbackAttachments({ onChange, onLimit }, ref) {
    const t = useTranslations('feedback.attachments');
    const [tiles, setTiles] = useState<Tile[]>([]);
    const tilesRef = useRef<Tile[]>(tiles);
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    });

    const patchTile = useCallback((id: string, patch: Partial<Tile>) => {
      setTiles((prev) => prev.map((tile) => (tile.id === id ? { ...tile, ...patch } : tile)));
    }, []);

    // Emit completed refs whenever tiles change (effect, not updater).
    useEffect(() => {
      tilesRef.current = tiles;
      const done = tiles.filter((tl) => tl.status === 'done' && tl.url);
      onChangeRef.current(done.map((tl) => tl.url as string));
    }, [tiles]);

    const startUpload = useCallback(
      (file: File) => {
        const violation = preCheckUpload(file, CATEGORY);
        if (violation) return; // friendly pre-check; BE re-validates
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        const previewUrl = uploadService.getFilePreviewUrl(file);
        setTiles((prev) => [...prev, { id, previewUrl, status: 'uploading', progress: 0 }]);
        void uploadService
          .uploadSingle(file, {
            category: CATEGORY,
            onProgress: (p) => patchTile(id, { progress: p }),
          })
          .then((res) => patchTile(id, { status: 'done', progress: 100, url: res.url }))
          .catch(() => patchTile(id, { status: 'error' }));
      },
      [patchTile],
    );

    const addFiles = useCallback(
      (files: FileList | File[] | null) => {
        if (!files) return;
        const room = MAX - tilesRef.current.length;
        if (room <= 0) {
          onLimit?.();
          return;
        }
        const list = Array.from(files);
        list.slice(0, room).forEach(startUpload);
        if (list.length > room) onLimit?.();
      },
      [onLimit, startUpload],
    );

    useImperativeHandle(
      ref,
      () => ({
        addFile: (file: File) => addFiles([file]),
        count: () => tilesRef.current.length,
      }),
      [addFiles],
    );

    const removeTile = useCallback((id: string) => {
      const target = tilesRef.current.find((tl) => tl.id === id);
      if (target) {
        if (target.url) void uploadService.deleteFile(target.url);
        uploadService.revokePreviewUrl(target.previewUrl);
      }
      setTiles((prev) => prev.filter((tl) => tl.id !== id));
    }, []);

    const inputRef = useRef<HTMLInputElement>(null);
    const atLimit = tiles.length >= MAX;

    return (
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tiles.map((tile) => (
            <div
              key={tile.id}
              style={{
                position: 'relative',
                width: 56,
                height: 56,
                borderRadius: 'var(--cr-radius-md)',
                overflow: 'hidden',
                background: 'var(--cr-surface-2)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img
                src={tile.previewUrl}
                alt=""
                decoding="async"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: tile.status === 'uploading' ? 0.5 : 1,
                }}
              />
              {tile.status === 'uploading' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    background: 'rgba(14,24,68,0.45)',
                  }}
                >
                  {tile.progress}%
                </div>
              )}
              {tile.status === 'error' && (
                <div
                  role="alert"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 10,
                    textAlign: 'center',
                    color: 'var(--cr-error)',
                    background: 'var(--cr-error-bg)',
                  }}
                >
                  {t('uploadFailed')}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeTile(tile.id)}
                aria-label={t('remove')}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 20,
                  height: 20,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
        />
        {!atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              marginTop: 8,
              fontSize: 13,
              cursor: 'pointer',
              border: '1px solid var(--cr-border-light)',
              background: 'transparent',
              borderRadius: 'var(--cr-radius-md)',
              padding: '6px 12px',
            }}
          >
            {t('add')}
          </button>
        )}
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--cr-text-3)' }}>
          {t('hint', { max: MAX, maxMb: 5 })}
        </div>
      </div>
    );
  },
);

export default FeedbackAttachments;
