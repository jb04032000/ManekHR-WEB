/**
 * upload.service wiring tests - the compression DECISION at the call site
 * (not the pixel pipeline, which `image-compress.test.ts` covers). We mock the
 * compressor + http client + subscription store so we can assert: image
 * categories with a compression policy get compressed before the size check;
 * categories without one don't; and the original is posted when the compressor
 * passes it through (its swallow-and-return-original failure path).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./image-compress', () => ({ compressImage: vi.fn() }));
vi.mock('../api/client', () => ({
  default: { post: vi.fn(), delete: vi.fn() },
  unwrap: vi.fn((r: { data: unknown }) => r.data),
}));
vi.mock('../store', () => ({
  useSubscriptionStore: { getState: () => ({ plan: { tier: 'free' } }) },
}));

import { uploadService } from './upload.service';
import { compressImage } from './image-compress';
import http from '../api/client';

const okResponse = {
  data: { url: 'u', fileName: 'f', fileSize: 1, mimeType: 'image/webp' },
};

function img(size: number, type = 'image/jpeg', name = 'p'): File {
  return new File([new Uint8Array(size)], `${name}.${type.split('/')[1]}`, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  (http.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse);
});

describe('uploadService.uploadSingle compression wiring', () => {
  it('compresses image categories that declare a compression policy, and posts the result', async () => {
    const compressed = img(100 * 1024, 'image/webp');
    (compressImage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(compressed);

    await uploadService.uploadSingle(img(2 * 1024 * 1024), { category: 'erp-feedback-media' });

    expect(compressImage).toHaveBeenCalledTimes(1);
    const fd = (http.post as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as FormData;
    expect((fd.get('file') as File).type).toBe('image/webp');
  });

  it('does NOT compress a category without a compression policy (documents)', async () => {
    const pdf = new File([new Uint8Array(1024)], 'd.pdf', { type: 'application/pdf' });
    await uploadService.uploadSingle(pdf, { category: 'documents' });
    expect(compressImage).not.toHaveBeenCalled();
  });

  it('posts the original when the compressor returns it unchanged (failure passthrough)', async () => {
    const original = img(2 * 1024 * 1024);
    (compressImage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(original);

    await uploadService.uploadSingle(original, { category: 'erp-feedback-media' });

    const fd = (http.post as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as FormData;
    expect(fd.get('file')).toBe(original);
  });

  it('emits an initial progress tick so the UI shows pending during compression', async () => {
    (compressImage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      img(100 * 1024, 'image/webp'),
    );
    const onProgress = vi.fn();
    await uploadService.uploadSingle(img(2 * 1024 * 1024), {
      category: 'erp-feedback-media',
      onProgress,
    });
    expect(onProgress).toHaveBeenCalledWith(0);
  });
});
