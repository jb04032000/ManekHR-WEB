import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, waitFor, fireEvent } from '@/test-utils/render';

// Covers the photo cap (3) + completed-ref emit for the feedback attachments
// grid. The upload service is mocked so no real network/R2 call runs.
const uploadSingle = vi.fn();
const deleteFile = vi.fn();
vi.mock('@/lib/services/upload.service', () => ({
  uploadService: {
    getFilePreviewUrl: () => 'blob:preview',
    uploadSingle: (...a: unknown[]) => uploadSingle(...a),
    deleteFile: (...a: unknown[]) => deleteFile(...a),
    revokePreviewUrl: vi.fn(),
  },
}));

import FeedbackAttachments from './FeedbackAttachments';

const img = (n: string) => new File(['x'], n, { type: 'image/jpeg' });

describe('FeedbackAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads a picked image and emits its private ref', async () => {
    uploadSingle.mockResolvedValue({ url: 'r2-private://erp-feedback-media/a.webp' });
    const onChange = vi.fn();
    const { container } = renderWithIntl(<FeedbackAttachments onChange={onChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [img('a.jpg')] } });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(['r2-private://erp-feedback-media/a.webp']),
    );
    expect(uploadSingle).toHaveBeenCalledTimes(1);
  });

  it('caps at 3 photos and signals onLimit when more are picked', async () => {
    uploadSingle.mockResolvedValue({ url: 'r2-private://erp-feedback-media/x.webp' });
    const onLimit = vi.fn();
    const { container } = renderWithIntl(
      <FeedbackAttachments onChange={() => {}} onLimit={onLimit} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [img('1.jpg'), img('2.jpg'), img('3.jpg'), img('4.jpg')] },
    });

    await waitFor(() => expect(uploadSingle).toHaveBeenCalledTimes(3));
    expect(onLimit).toHaveBeenCalledTimes(1);
  });
});
