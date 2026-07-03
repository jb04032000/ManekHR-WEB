'use client';

/**
 * MediaUploadGrid - a multi-file upload grid for the Connect composer
 * (Phase 3 - Feed).
 *
 * Handles the photo / video / document post kinds via `mediaKind`. Files arrive
 * two ways: the file picker (click the Add tile / empty drop zone) or
 * drag-and-drop onto the grid. Each picked file uploads immediately (per-tile
 * progress), so the composer's Publish is instant. `onChange` emits the
 * completed R2 URLs whenever the set settles. Uncontrolled - the composer
 * remounts it (via `key`) to reset.
 *
 * JIT shared component (Phase 3). Rendered in isolation on `/design-system`.
 */

import {
  type CSSProperties,
  type DragEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { ChevronLeft, ChevronRight, FilePlus2, FileText, ImagePlus, Video, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { uploadService, type UploadOptions } from '@/lib/services/upload.service';
import { getUploadPolicy } from '@/lib/upload-policies.helpers';
// Client-side video helpers: duration read (fast reject) + poster-frame capture.
import { readVideoDuration, captureVideoPoster } from '@/lib/services/video-poster';
// Edit-mode previews (stored URLs) get a ~400px variant; live blob: previews
// pass through untouched (no-op until the CDN env is set).
import { imageVariant } from '@/lib/media/imageUrl';

/** The post-media kinds this grid can collect. */
export type MediaKind = 'image' | 'video' | 'document';

interface MediaUploadGridProps {
  /** Called with the completed upload URLs whenever they change. */
  onChange: (urls: string[]) => void;
  /**
   * Video only: called with a {videoUrl -> posterUrl} map whenever the captured
   * posters settle. The feed composer attaches these as `posterUrl` on the
   * submitted media items so the feed renders a still instead of a black box.
   * Optional - image/document call sites never pass it.
   */
  onPosters?: (posterByUrl: Record<string, string>) => void;
  /** Which media type the grid collects. Default `image`. */
  mediaKind?: MediaKind;
  /** Max tiles. Default depends on `mediaKind`. */
  max?: number;
  /** Uploads category - feed media goes to the `connect-posts` bucket. */
  category?: UploadOptions['category'];
  /**
   * Video only: which category the captured POSTER image is uploaded to. The
   * poster is an image, so a VIDEO-ONLY video category (e.g. the marketplace
   * `connect-product-video` bucket, which rejects images + has no compression
   * preset) cannot also hold it. Point this at an image-capable bucket
   * (`connect-posts`) for those callers. Defaults to `category` so the feed path
   * (one `connect-posts` bucket for both clip + poster) is unchanged. The poster
   * is encoded with the POSTER category's compression preset.
   */
  posterCategory?: UploadOptions['category'];
  /**
   * Pre-existing R2 URLs to seed the grid (edit flows). They render as
   * already-uploaded tiles; removing one excludes it from `onChange` but does
   * NOT delete it from storage (only newly-added uploads are deleted on remove).
   */
  initialUrls?: string[];
  /**
   * Opt-in single-image layout for a branding slot. `'square'` (a logo) renders
   * a compact square frame; `'wide'` (a banner) renders a full-width 16:5 frame
   * with an aspect-ratio preview. Default (unset) keeps the multi-tile grid used
   * by the feed composer - so this prop never changes existing call sites.
   */
  singleAspect?: 'square' | 'wide';
  /**
   * Opt-in: badge the first tile as the "Cover" photo. For product listings the
   * first image is the cover buyers see in search, so it earns a label. Default
   * off - the feed composer has no cover concept.
   */
  showCover?: boolean;
  /**
   * Opt-in: let the seller reorder tiles (and so choose which photo is the
   * cover) with accessible move-earlier / move-later buttons. Keyboard- and
   * screen-reader-friendly; deliberately not drag-only, which would exclude
   * those users. Default off.
   */
  reorderable?: boolean;
}

/** Per-kind accept list, size cap, and default tile count. */
const KIND_CONFIG: Record<MediaKind, { accept: string[]; maxMb: number; max: number }> = {
  image: { accept: ['image/jpeg', 'image/png', 'image/webp'], maxMb: 5, max: 8 },
  video: { accept: ['video/mp4', 'video/webm', 'video/quicktime'], maxMb: 50, max: 3 },
  document: { accept: ['application/pdf'], maxMb: 10, max: 5 },
};

/** The small circular reorder button shown on each tile when `reorderable`. */
const moveBtnStyle = (disabled: boolean): CSSProperties => ({
  width: 22,
  height: 22,
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  border: 'none',
  cursor: disabled ? 'default' : 'pointer',
  background: disabled ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.6)',
  color: '#fff',
  opacity: disabled ? 0.5 : 1,
});

interface Tile {
  id: string;
  previewUrl: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  url?: string;
  /** Captured poster URL for a video tile (undefined until/unless capture wins). */
  posterUrl?: string;
  /** Seeded from `initialUrls` (a persisted image); never deleted on remove. */
  initial?: boolean;
}

export default function MediaUploadGrid({
  onChange,
  onPosters,
  mediaKind = 'image',
  max,
  category = 'connect-posts',
  posterCategory,
  initialUrls,
  singleAspect,
  showCover = false,
  reorderable = false,
}: MediaUploadGridProps) {
  const t = useTranslations('connect.feed.media');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tiles, setTiles] = useState<Tile[]>(() =>
    (initialUrls ?? []).map((url) => ({
      id: crypto.randomUUID(),
      previewUrl: url,
      status: 'done' as const,
      progress: 100,
      url,
      initial: true,
    })),
  );
  const [isDragging, setIsDragging] = useState(false);
  // A picked-file rejection message (e.g. a video over the duration cap). Shown
  // below the grid; cleared on the next successful pick.
  const [pickError, setPickError] = useState<string | null>(null);
  // Drag enter/leave fire per child element; a depth counter keeps the
  // highlight stable until the pointer truly leaves the grid.
  const dragDepth = useRef(0);

  const config = KIND_CONFIG[mediaKind];
  const cap = max ?? config.max;

  // Emit the completed URLs from an effect (NOT inside a setTiles updater, which
  // would update the parent during this component's render). `onChange` is read
  // through a ref so an unstable parent callback can't re-trigger the effect.
  const onChangeRef = useRef(onChange);
  const onPostersRef = useRef(onPosters);
  useEffect(() => {
    onChangeRef.current = onChange;
    onPostersRef.current = onPosters;
  });
  // A ref mirror of the tiles so handlers can read the current set for side
  // effects without putting them inside the (double-invoked) state updater.
  const tilesRef = useRef(tiles);
  useEffect(() => {
    tilesRef.current = tiles;
    const done = tiles.filter((tile) => tile.status === 'done' && tile.url);
    onChangeRef.current(done.map((tile) => tile.url!));
    // Emit the {videoUrl -> posterUrl} map for any tiles whose poster captured.
    onPostersRef.current?.(
      Object.fromEntries(
        done.filter((tile) => tile.posterUrl).map((tile) => [tile.url!, tile.posterUrl!]),
      ),
    );
  }, [tiles]);

  const patchTile = useCallback((id: string, patch: Partial<Tile>) => {
    setTiles((prev) => prev.map((tile) => (tile.id === id ? { ...tile, ...patch } : tile)));
  }, []);

  // Create a tile and start its upload. Returns the tile id so the video path
  // can attach a captured poster to it once it resolves.
  const startUpload = useCallback(
    (file: File): string => {
      const id = crypto.randomUUID();
      const previewUrl = uploadService.getFilePreviewUrl(file);
      setTiles((prev) => [...prev, { id, previewUrl, status: 'uploading', progress: 0 }]);
      void uploadService
        .uploadSingle(file, { category, onProgress: (p) => patchTile(id, { progress: p }) })
        .then((res) => patchTile(id, { status: 'done', progress: 100, url: res.url }))
        .catch(() => patchTile(id, { status: 'error' }));
      return id;
    },
    [category, patchTile],
  );

  // Video path: (1) reject an over-cap clip BEFORE uploading up to 50 MB, then
  // (2) start the upload and, in parallel, capture + upload a poster frame.
  // Poster capture must NEVER block or fail the video upload - on any failure we
  // warn and post without a poster (the video is the source of truth).
  const addVideo = useCallback(
    async (file: File) => {
      const maxSec = getUploadPolicy(category).duration?.max;
      if (maxSec != null) {
        const dur = await readVideoDuration(file);
        if (dur != null && dur > maxSec) {
          setPickError(t('videoTooLong', { max: maxSec }));
          return;
        }
      }
      const id = startUpload(file);
      // The poster is an IMAGE, so it is uploaded to `posterCategory` (an
      // image-capable bucket) - which may differ from the VIDEO `category` when
      // the video bucket is video-only (the marketplace product-video case).
      // Defaults to `category`, keeping the feed path (one connect-posts bucket
      // for both) unchanged. Encode it through THAT category's compression preset.
      const resolvedPosterCategory = posterCategory ?? category;
      const compression = getUploadPolicy(resolvedPosterCategory).compression;
      if (!compression) return;
      try {
        const poster = await captureVideoPoster(file, compression);
        if (!poster) {
          console.warn('[MediaUploadGrid] video poster capture produced no frame');
          return;
        }
        const res = await uploadService.uploadSingle(poster, {
          category: resolvedPosterCategory,
        });
        patchTile(id, { posterUrl: res.url });
      } catch (err) {
        console.warn('[MediaUploadGrid] video poster capture/upload failed', err);
      }
    },
    [category, posterCategory, startUpload, patchTile, t],
  );

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      setPickError(null);
      const picked = Array.from(files).slice(0, Math.max(0, cap - tiles.length));
      for (const file of picked) {
        const check = uploadService.validateFile(file, config.accept, config.maxMb);
        if (!check.valid) continue;
        if (mediaKind === 'video') {
          void addVideo(file);
        } else {
          startUpload(file);
        }
      }
    },
    [tiles.length, cap, config, mediaKind, addVideo, startUpload],
  );

  const removeTile = useCallback((id: string) => {
    // Side effects (storage delete + blob revoke) run here, OUTSIDE the state
    // updater, so StrictMode's double-invoked updater never double-deletes.
    // Initial (pre-existing) tiles are persisted listing images: removing one
    // only drops it from the submitted set, it must not delete from storage.
    const target = tilesRef.current.find((tile) => tile.id === id);
    if (target && !target.initial) {
      if (target.url) void uploadService.deleteFile(target.url);
      uploadService.revokePreviewUrl(target.previewUrl);
    }
    setTiles((prev) => prev.filter((tile) => tile.id !== id));
  }, []);

  // Move a tile one slot earlier / later. The emitted URL order follows the tile
  // order, so slot 0 is the cover - reordering is how the seller picks it.
  const moveTile = useCallback((id: string, dir: -1 | 1) => {
    setTiles((prev) => {
      const i = prev.findIndex((tile) => tile.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  // A pointer enhancement over the file picker. The picker label + input stay
  // the keyboard / click path, so this adds no a11y obligation.
  const onDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Calling preventDefault is what marks this a valid drop target.
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  /** The visual inside a tile - varies by media kind. */
  const renderPreview = (tile: Tile) => {
    const dim = tile.status === 'done' ? 1 : 0.5;
    if (mediaKind === 'image') {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- local blob / R2 preview
        <img
          src={imageVariant(tile.previewUrl, { w: 400 })}
          alt=""
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: dim }}
        />
      );
    }
    if (mediaKind === 'video') {
      return (
        <video
          src={tile.previewUrl}
          muted
          preload="metadata"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: dim,
            background: '#000',
          }}
        />
      );
    }
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--cr-surface-2)',
          color: 'var(--cr-text-4)',
          opacity: dim,
        }}
      >
        <FileText size={26} aria-hidden />
      </div>
    );
  };

  const AddIcon = mediaKind === 'video' ? Video : mediaKind === 'document' ? FilePlus2 : ImagePlus;
  const canAddMore = tiles.length < cap;

  // The frame size for the opt-in single-image (logo / banner) layout.
  const singleFrameStyle: CSSProperties =
    singleAspect === 'square'
      ? { width: 132, height: 132 }
      : singleAspect === 'wide'
        ? { width: '100%', maxWidth: 420, aspectRatio: '16 / 5' }
        : {};

  // The inner content of a tile (preview + status overlay + remove), shared by
  // the multi-tile grid and the single-image frame so they stay in sync.
  // `index` / `total` drive the opt-in cover badge + reorder controls.
  const renderTileBody = (tile: Tile, index = 0, total = 1) => (
    <>
      {renderPreview(tile)}
      {showCover && index === 0 && tile.status === 'done' && (
        <span
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            padding: '2px 7px',
            borderRadius: 'var(--cr-radius-full)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: '#fff',
            background: 'rgba(14,24,68,0.78)',
          }}
        >
          {t('cover')}
        </span>
      )}
      {reorderable && total > 1 && tile.status === 'done' && (
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: 4,
            display: 'flex',
            gap: 3,
          }}
        >
          <button
            type="button"
            onClick={() => moveTile(tile.id, -1)}
            disabled={index === 0}
            aria-label={t('moveEarlier')}
            style={moveBtnStyle(index === 0)}
          >
            <ChevronLeft size={13} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => moveTile(tile.id, 1)}
            disabled={index === total - 1}
            aria-label={t('moveLater')}
            style={moveBtnStyle(index === total - 1)}
          >
            <ChevronRight size={13} aria-hidden />
          </button>
        </div>
      )}
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
            fontSize: 11,
            fontWeight: 600,
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
          top: 4,
          right: 4,
          width: 22,
          height: 22,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
        }}
      >
        <X size={13} aria-hidden />
      </button>
    </>
  );

  const fileInput = (
    <input
      id={inputId}
      ref={inputRef}
      type="file"
      accept={config.accept.join(',')}
      multiple={mediaKind !== 'video'}
      onChange={(e) => {
        addFiles(e.target.files);
        e.target.value = '';
      }}
      style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
    />
  );

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        position: 'relative',
        borderRadius: 'var(--cr-radius-lg)',
        outline: isDragging ? '2px dashed var(--cr-primary)' : '2px dashed transparent',
        outlineOffset: 4,
        transition: 'outline-color 0.15s ease',
      }}
    >
      {tiles.length === 0 ? (
        /* Empty state - a full drop zone that also opens the picker on click. */
        <label
          htmlFor={inputId}
          style={{
            display: 'grid',
            placeItems: 'center',
            ...(singleAspect ? singleFrameStyle : { minHeight: 132 }),
            padding: singleAspect === 'square' ? 10 : 20,
            textAlign: 'center',
            borderRadius: 'var(--cr-radius-lg)',
            border: `1.5px dashed ${isDragging ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
            background: isDragging ? 'var(--cr-wash-indigo)' : 'var(--cr-surface-2)',
            color: isDragging ? 'var(--cr-primary)' : 'var(--cr-text-4)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
          }}
        >
          <div>
            <AddIcon size={28} aria-hidden />
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{t('dropHint')}</div>
          </div>
          {fileInput}
        </label>
      ) : singleAspect ? (
        /* Single-image branding slot (logo / banner): one framed preview. */
        <div
          style={{
            position: 'relative',
            ...singleFrameStyle,
            borderRadius: 'var(--cr-radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--cr-border)',
          }}
        >
          {renderTileBody(tiles[0])}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {tiles.map((tile, index) => (
            <div
              key={tile.id}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: 'var(--cr-radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--cr-border)',
              }}
            >
              {renderTileBody(tile, index, tiles.length)}
            </div>
          ))}

          {canAddMore && (
            <label
              htmlFor={inputId}
              style={{
                display: 'grid',
                placeItems: 'center',
                aspectRatio: '1 / 1',
                borderRadius: 'var(--cr-radius-md)',
                border: '1px dashed var(--cr-border)',
                cursor: 'pointer',
                color: 'var(--cr-text-4)',
              }}
            >
              <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600 }}>
                <AddIcon size={20} aria-hidden />
                <div style={{ marginTop: 4 }}>{t('add')}</div>
              </div>
              {fileInput}
            </label>
          )}
        </div>
      )}
      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--cr-text-4)' }}>
        {t('hint', { max: cap, maxMb: config.maxMb })}
      </p>
      {pickError && (
        <p
          role="alert"
          style={{ margin: '4px 0 0', fontSize: 11.5, fontWeight: 600, color: 'var(--cr-error)' }}
        >
          {pickError}
        </p>
      )}
    </div>
  );
}
