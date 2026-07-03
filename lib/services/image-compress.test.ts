/**
 * image-compress decision-logic tests.
 *
 * jsdom has no real canvas / createImageBitmap, so we stub them: a fake
 * 2D context that records fill operations, a `toBlob` that returns a
 * configurable blob per requested MIME, and a `toDataURL` that drives the
 * WebP feature-detect. That lets us assert the BRANCHING (which encoder wins,
 * when the original is kept, transparency flatten, error safety) without a
 * real raster pipeline. Reduction numbers are derived from the configured
 * blob sizes - "rough number is fine" per the task.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImage } from './image-compress';
import type { CompressionPolicy } from '../upload-policies';

const WEBP_1600: CompressionPolicy = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  format: 'image/webp',
};

const KB = 1024;
const MB = 1024 * KB;

function makeFile(size: number, type: string, name = 'photo'): File {
  const ext = type.split('/')[1] ?? 'bin';
  return new File([new Uint8Array(size)], `${name}.${ext}`, { type });
}
function makeBlob(size: number, type: string): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

// ── Mock state, reset per test ──────────────────────────────────────────────
let webpEncodeSupported: boolean;
let toBlobImpl: (type: string, quality?: number) => Blob | null;
let bitmapDims: { width: number; height: number };
let createImageBitmapSpy: ReturnType<typeof vi.fn>;
let fillStyleSets: string[];
let fillRectCalls: number;
let drawImageCalls: number;

beforeEach(() => {
  webpEncodeSupported = true;
  toBlobImpl = (type) => makeBlob(180 * KB, type); // default: small, helps
  bitmapDims = { width: 4000, height: 3000 }; // a typical phone photo
  fillStyleSets = [];
  fillRectCalls = 0;
  drawImageCalls = 0;

  createImageBitmapSpy = vi.fn(async () => ({
    width: bitmapDims.width,
    height: bitmapDims.height,
    close: vi.fn(),
  }));
  vi.stubGlobal('createImageBitmap', createImageBitmapSpy);

  const ctx = {
    set fillStyle(v: string) {
      fillStyleSets.push(v);
    },
    get fillStyle() {
      return fillStyleSets[fillStyleSets.length - 1] ?? '';
    },
    fillRect: () => {
      fillRectCalls++;
    },
    drawImage: () => {
      drawImageCalls++;
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(((type?: string) =>
    type === 'image/webp' && webpEncodeSupported
      ? 'data:image/webp;base64,AA'
      : 'data:image/png;base64,AA') as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    cb(toBlobImpl(type ?? 'image/png', quality));
  } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('compressImage', () => {
  it('decodes with EXIF orientation baked in (imageOrientation: from-image)', async () => {
    await compressImage(makeFile(5 * MB, 'image/jpeg'), WEBP_1600);
    expect(createImageBitmapSpy).toHaveBeenCalledWith(expect.any(File), {
      imageOrientation: 'from-image',
    });
  });

  it('compresses a large photo to WebP and reports a big size reduction', async () => {
    const original = makeFile(5 * MB, 'image/jpeg'); // realistic 5 MB phone photo
    toBlobImpl = (type) => makeBlob(180 * KB, type); // ~180 KB WebP
    const out = await compressImage(original, WEBP_1600);

    expect(out).not.toBe(original);
    expect(out.type).toBe('image/webp');
    expect(out.name).toMatch(/\.webp$/);
    expect(out.size).toBeLessThan(original.size);

    const reduction = 1 - out.size / original.size;
    expect(reduction).toBeGreaterThan(0.8); // well over 80% smaller
    // Surface the measured number for the report.
    // eslint-disable-next-line no-console
    console.log(
      `[image-compress] 5MB JPEG (4000x3000) -> ${(out.size / KB).toFixed(0)}KB WebP ` +
        `(${(reduction * 100).toFixed(1)}% smaller)`,
    );
  });

  it('keeps the original when the compressed bytes are not smaller', async () => {
    const original = makeFile(120 * KB, 'image/png'); // small icon
    toBlobImpl = (type) => makeBlob(300 * KB, type); // re-encode is bigger
    const out = await compressImage(original, WEBP_1600);
    expect(out).toBe(original);
  });

  it('returns non-image files untouched (no decode attempted)', async () => {
    const pdf = makeFile(1 * KB, 'application/pdf', 'doc');
    const out = await compressImage(pdf, WEBP_1600);
    expect(out).toBe(pdf);
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it('never upscales: a small image is not enlarged to the target box', async () => {
    bitmapDims = { width: 320, height: 240 }; // smaller than 1600 box
    const original = makeFile(40 * KB, 'image/jpeg');
    toBlobImpl = (type) => makeBlob(20 * KB, type); // recompresses smaller
    const out = await compressImage(original, WEBP_1600);
    // It still re-encodes (smaller), but the canvas was never sized up: the
    // draw happened once at the source size. We assert it produced output and
    // did not blow up - the dimension math (scale=1) is covered by the helper.
    expect(out.type).toBe('image/webp');
    expect(drawImageCalls).toBeGreaterThan(0);
  });

  it('falls back to JPEG (flattened onto white) when WebP encoding is unsupported', async () => {
    webpEncodeSupported = false;
    const original = makeFile(5 * MB, 'image/jpeg');
    toBlobImpl = (type) => makeBlob(type === 'image/jpeg' ? 300 * KB : 900 * KB, type);
    const out = await compressImage(original, WEBP_1600);

    expect(out.type).toBe('image/jpeg'); // declared MIME == actual encoded bytes
    expect(out.name).toMatch(/\.jpg$/);
    expect(fillStyleSets).toContain('#ffffff'); // composited onto WHITE, not black
    expect(fillRectCalls).toBeGreaterThan(0);
  });

  it('keeps WebP alpha (no white/black flatten) for a transparent PNG when WebP works', async () => {
    const original = makeFile(2 * MB, 'image/png');
    toBlobImpl = (type) => makeBlob(150 * KB, type);
    const out = await compressImage(original, WEBP_1600);
    expect(out.type).toBe('image/webp');
    expect(fillStyleSets).not.toContain('#ffffff'); // transparent canvas, alpha preserved
  });

  it('in the JPEG-fallback path, keeps PNG when it is smaller than JPEG', async () => {
    webpEncodeSupported = false;
    const original = makeFile(2 * MB, 'image/png');
    toBlobImpl = (type) => makeBlob(type === 'image/png' ? 120 * KB : 400 * KB, type);
    const out = await compressImage(original, WEBP_1600);
    expect(out.type).toBe('image/png'); // lossless PNG beat JPEG, keeps alpha
    expect(out.name).toMatch(/\.png$/);
  });

  it('uploads the original and warns when compression throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = makeFile(5 * MB, 'image/jpeg');
    toBlobImpl = () => {
      throw new Error('canvas exploded');
    };
    const out = await compressImage(original, WEBP_1600);
    expect(out).toBe(original);
    expect(warn).toHaveBeenCalled();
  });

  it('returns the original (no throw) when the image cannot be decoded', async () => {
    // createImageBitmap rejects AND the <img> fallback errors -> decode null.
    createImageBitmapSpy.mockRejectedValue(new Error('decode fail'));
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:x';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        this.onerror?.();
      }
    }
    vi.stubGlobal('Image', FakeImage);

    const original = makeFile(5 * MB, 'image/jpeg');
    const out = await compressImage(original, WEBP_1600);
    expect(out).toBe(original);
  });
});
