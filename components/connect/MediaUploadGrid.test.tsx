import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, waitFor, fireEvent } from '@/test-utils/render';

/**
 * Covers MediaUploadGrid's drag-and-drop path: dropping files onto the grid
 * runs them through the upload service and emits the completed URLs, the same as
 * the file picker. The upload service is mocked so no real network/R2 call runs.
 */

const uploadSingle = vi.fn();
// Bare mocks (no inline impl) so the forwarders below can spread args into them;
// the return value is set per-test in `beforeEach` via `mockReturnValue`.
const validateFile = vi.fn();
const deleteFile = vi.fn();
vi.mock('@/lib/services/upload.service', () => ({
  uploadService: {
    validateFile: (...a: unknown[]) => validateFile(...a),
    getFilePreviewUrl: () => 'blob:preview',
    uploadSingle: (...a: unknown[]) => uploadSingle(...a),
    deleteFile: (...a: unknown[]) => deleteFile(...a),
    revokePreviewUrl: vi.fn(),
  },
}));

// Client-side video helpers (duration pre-check + poster capture). Mocked so the
// video tests drive the duration/poster outcomes without a real <video> decode.
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

describe('MediaUploadGrid drag-and-drop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateFile.mockReturnValue({ valid: true });
  });

  it('shows a drop zone with a file input before anything is added', () => {
    const { container } = renderWithIntl(<MediaUploadGrid onChange={() => {}} />);
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
  });

  it('uploads dropped files and emits the completed URLs', async () => {
    uploadSingle.mockResolvedValue({ url: 'https://r2.example/p.jpg' });
    const onChange = vi.fn();
    const { container } = renderWithIntl(<MediaUploadGrid onChange={onChange} />);
    const root = container.firstElementChild as Element;

    dropFiles(root, [new File(['x'], 'p.jpg', { type: 'image/jpeg' })]);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://r2.example/p.jpg']));
    expect(uploadSingle).toHaveBeenCalledTimes(1);
  });
});

describe('MediaUploadGrid product video', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateFile.mockReturnValue({ valid: true });
  });

  const videoFile = () => new File(['x'], 'clip.mp4', { type: 'video/mp4' });

  it('rejects a clip over the 60s product cap before uploading (policy-driven)', async () => {
    readVideoDuration.mockResolvedValue(90); // over the connect-product-video 60s cap
    const onChange = vi.fn();
    const { container, getByText } = renderWithIntl(
      <MediaUploadGrid
        mediaKind="video"
        max={1}
        category="connect-product-video"
        posterCategory="connect-posts"
        onChange={onChange}
      />,
    );
    dropFiles(container.firstElementChild as Element, [videoFile()]);

    // The friendly over-cap message renders and NO upload is attempted.
    await waitFor(() =>
      expect(getByText('Video is too long. Please keep it to 60 seconds or less.')).toBeTruthy(),
    );
    expect(uploadSingle).not.toHaveBeenCalled();
  });

  it('uploads a within-cap clip, captures + uploads a poster, and emits the poster map', async () => {
    readVideoDuration.mockResolvedValue(45); // within the 60s cap
    captureVideoPoster.mockResolvedValue(new File(['p'], 'poster.png', { type: 'image/png' }));
    // First upload = the video clip; second = the captured poster.
    uploadSingle
      .mockResolvedValueOnce({ url: 'https://r2/clip.mp4' })
      .mockResolvedValueOnce({ url: 'https://r2/poster.jpg' });
    const onChange = vi.fn();
    const onPosters = vi.fn();
    const { container } = renderWithIntl(
      <MediaUploadGrid
        mediaKind="video"
        max={1}
        category="connect-product-video"
        posterCategory="connect-posts"
        onChange={onChange}
        onPosters={onPosters}
      />,
    );
    dropFiles(container.firstElementChild as Element, [videoFile()]);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://r2/clip.mp4']));
    // The clip goes to the video bucket; the poster image to connect-posts.
    expect(uploadSingle).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ category: 'connect-product-video' }),
    );
    expect(uploadSingle).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ category: 'connect-posts' }),
    );
    await waitFor(() =>
      expect(onPosters).toHaveBeenCalledWith({ 'https://r2/clip.mp4': 'https://r2/poster.jpg' }),
    );
  });
});

describe('MediaUploadGrid initial images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateFile.mockReturnValue({ valid: true });
  });

  it('renders a tile for each initial URL', () => {
    const { container } = renderWithIntl(
      <MediaUploadGrid
        onChange={() => {}}
        initialUrls={['https://r2/x.jpg', 'https://r2/y.jpg']}
      />,
    );
    expect(container.querySelectorAll('img').length).toBe(2);
  });

  it('removing an initial image emits the rest and never deletes it from storage', async () => {
    const onChange = vi.fn();
    const { container } = renderWithIntl(
      <MediaUploadGrid
        onChange={onChange}
        initialUrls={['https://r2/x.jpg', 'https://r2/y.jpg']}
      />,
    );
    const firstRemove = container.querySelector('button');
    expect(firstRemove).toBeTruthy();
    fireEvent.click(firstRemove!);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://r2/y.jpg']));
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
