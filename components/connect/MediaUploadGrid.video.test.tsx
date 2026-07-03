import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, waitFor, fireEvent } from '@/test-utils/render';

/**
 * Covers the feed video path in MediaUploadGrid:
 *  - an over-cap clip is rejected client-side BEFORE any upload (the 50 MB
 *    upload is never started);
 *  - a poster-capture failure still posts the video (poster is best-effort);
 *  - a successful capture attaches the poster URL via onPosters.
 *
 * The DOM video/canvas work lives in `@/lib/services/video-poster` (its own
 * unit), so here we mock that module to drive the three outcomes deterministically
 * and mock the upload service so no network/R2 call runs.
 */

const uploadSingle = vi.fn();
const validateFile = vi.fn();
vi.mock('@/lib/services/upload.service', () => ({
  uploadService: {
    validateFile: (...a: unknown[]) => validateFile(...a),
    getFilePreviewUrl: () => 'blob:preview',
    uploadSingle: (...a: unknown[]) => uploadSingle(...a),
    deleteFile: vi.fn(),
    revokePreviewUrl: vi.fn(),
  },
}));

const readVideoDuration = vi.fn();
const captureVideoPoster = vi.fn();
vi.mock('@/lib/services/video-poster', () => ({
  readVideoDuration: (...a: unknown[]) => readVideoDuration(...a),
  captureVideoPoster: (...a: unknown[]) => captureVideoPoster(...a),
}));

import MediaUploadGrid from './MediaUploadGrid';

function dropFiles(node: Element, files: File[]) {
  fireEvent.drop(node, { dataTransfer: { files, types: ['Files'] } });
}

const videoFile = () => new File(['x'], 'clip.mp4', { type: 'video/mp4' });

describe('MediaUploadGrid video path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateFile.mockReturnValue({ valid: true });
    // The video upload returns the clip URL; the poster upload returns its own.
    uploadSingle.mockImplementation((file: File) =>
      Promise.resolve({
        url: file.type.startsWith('video') ? 'https://r2/clip.mp4' : 'https://r2/poster.webp',
      }),
    );
  });

  it('rejects a clip over the duration cap before uploading', async () => {
    readVideoDuration.mockResolvedValue(150); // > 120s cap
    const onChange = vi.fn();
    const { container, getByRole } = renderWithIntl(
      <MediaUploadGrid mediaKind="video" onChange={onChange} />,
    );
    dropFiles(container.firstElementChild as Element, [videoFile()]);

    // The rejection message appears and NO upload was started.
    await waitFor(() => expect(getByRole('alert')).toBeTruthy());
    expect(uploadSingle).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalledWith(['https://r2/clip.mp4']);
  });

  it('still posts the video when poster capture fails', async () => {
    readVideoDuration.mockResolvedValue(30);
    captureVideoPoster.mockResolvedValue(null); // capture failed
    const onChange = vi.fn();
    const onPosters = vi.fn();
    const { container } = renderWithIntl(
      <MediaUploadGrid mediaKind="video" onChange={onChange} onPosters={onPosters} />,
    );
    dropFiles(container.firstElementChild as Element, [videoFile()]);

    // The video uploads and is emitted; no poster is attached.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://r2/clip.mp4']));
    expect(captureVideoPoster).toHaveBeenCalled();
    // Only the video was uploaded (poster upload never ran).
    expect(uploadSingle).toHaveBeenCalledTimes(1);
  });

  it('attaches the poster URL when capture succeeds', async () => {
    readVideoDuration.mockResolvedValue(30);
    captureVideoPoster.mockResolvedValue(new File(['p'], 'poster.webp', { type: 'image/webp' }));
    const onChange = vi.fn();
    const onPosters = vi.fn();
    const { container } = renderWithIntl(
      <MediaUploadGrid mediaKind="video" onChange={onChange} onPosters={onPosters} />,
    );
    dropFiles(container.firstElementChild as Element, [videoFile()]);

    await waitFor(() =>
      expect(onPosters).toHaveBeenCalledWith({ 'https://r2/clip.mp4': 'https://r2/poster.webp' }),
    );
    expect(uploadSingle).toHaveBeenCalledTimes(2); // video + poster
  });
});
