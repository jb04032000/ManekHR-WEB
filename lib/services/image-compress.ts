/**
 * Browser-native image compression - downscale + re-encode raster images
 * before they leave the device. Wired into `upload.service.ts` `uploadSingle`
 * so every image category that declares a `CompressionPolicy` (see
 * `lib/upload-policies.ts`: connect-posts / connect-portfolio / connect-banners
 * / avatars / connect-inbox-media) shrinks a member's multi-MB camera-roll
 * photo to a web-sized file. Documents / audio / video skip (no raster decode).
 *
 * Why no library: a small Canvas helper matches `browser-image-compression`
 * for our single-image, modest-resolution case, and keeps the
 * upload-policies no-new-dependency rule intact.
 *
 * Privacy note: re-encoding through a canvas STRIPS all EXIF metadata,
 * including GPS coordinates. That is intentional - a phone photo should not
 * leak where it was taken. The one thing we deliberately preserve is visual
 * orientation, baked into the pixels (see `decodeImage`) BEFORE the metadata
 * is dropped, so a sideways photo still comes out upright.
 *
 * Behaviour:
 *  - Decode via `createImageBitmap(..., { imageOrientation: 'from-image' })`
 *    (modern path) with an `<img>` fallback for engines that lack it.
 *  - Scale down so neither edge exceeds the policy box (never upscale, never
 *    distort - uniform scale preserves aspect, which keeps banner 4:1 guards
 *    on the server happy).
 *  - Encode WebP when the browser can actually encode it; otherwise fall back
 *    to JPEG (q0.85). PNG sources additionally try a lossless PNG and keep
 *    whichever of {JPEG, PNG} is smaller.
 *  - The declared `File.type` always equals the real encoded bytes - the
 *    server sniffs magic bytes and rejects a declared/actual MIME mismatch.
 *
 * Skip / safety conditions (never break an upload):
 *  - Not a raster image -> return the original (caller filters docs/audio/video
 *    upstream, but guard here too).
 *  - Decode fails (corrupt / unusual format) -> return the original.
 *  - Re-encoded bytes are not smaller than the source -> return the original.
 *  - ANY thrown error -> warn + return the original (the server still validates
 *    size + type on the original bytes).
 */

import type { CompressionPolicy } from '../upload-policies';

/** A produced blob plus the MIME we must declare for it (kept in lockstep). */
interface Encoded {
  blob: Blob;
  type: string;
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/**
 * Fallback JPEG quality used when WebP encoding is unavailable (old Safari).
 * Slightly higher than the WebP target because JPEG needs more bits for a
 * comparable look. Matches requirement 7 (~0.85).
 */
const JPEG_FALLBACK_QUALITY = 0.85;

/**
 * Compress an image File using a category's `CompressionPolicy`. Returns the
 * same File untouched if the input is not a raster image, decoding fails, the
 * compressed blob ends up larger than the source, or anything throws.
 */
export async function compressImage(file: File, policy: CompressionPolicy): Promise<File> {
  // Only raster images compress. The caller already filters by category, but
  // guard here so the helper is safe to call with anything (audio in the
  // mixed connect-inbox-media category, for example).
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await decodeImage(file);
    if (!bitmap) return file; // corrupt / undecodable -> ship the original

    try {
      const { w: srcW, h: srcH } = dimsOf(bitmap);
      // Never upscale: scale is 1 when the image already fits the target box.
      const scale = Math.min(1, policy.maxWidth / srcW, policy.maxHeight / srcH);
      const targetW = Math.max(1, Math.round(srcW * scale));
      const targetH = Math.max(1, Math.round(srcH * scale));

      const encoded = await encode(bitmap, file, policy, targetW, targetH);
      if (!encoded) return file;

      // Compression must only ever help: if the re-encoded bytes are not
      // smaller, ship the original untouched (tiny icons can grow as WebP).
      if (encoded.blob.size >= file.size) return file;

      const ext = EXT_BY_TYPE[encoded.type] ?? '.img';
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'upload';
      return new File([encoded.blob], `${baseName}${ext}`, {
        type: encoded.type,
        lastModified: file.lastModified,
      });
    } finally {
      closeBitmap(bitmap);
    }
  } catch (err) {
    // Failure safety: compression must NEVER block an upload.
    console.warn('Image compression failed; uploading the original file.', err);
    return file;
  }
}

/**
 * Encode the scaled bitmap. Prefers the policy target (WebP) when the browser
 * can actually encode it; otherwise falls back to JPEG. WebP keeps alpha, so
 * it draws on a transparent canvas; the JPEG fallback has no alpha channel and
 * so composites onto WHITE first (never the canvas default, which flattens to
 * black). PNG sources additionally try a lossless PNG and keep whichever of
 * {JPEG, PNG} is smaller (flat graphics / logos often beat JPEG and keep
 * their transparency). Returns null when no encoder produced a blob.
 */
async function encode(
  bitmap: ImageBitmap | HTMLImageElement,
  file: File,
  policy: CompressionPolicy,
  w: number,
  h: number,
): Promise<Encoded | null> {
  const wantWebp = policy.format === 'image/webp';

  if (wantWebp && supportsWebpEncode()) {
    const canvas = drawScaled(bitmap, w, h, null); // transparent -> WebP keeps alpha
    if (canvas) {
      const blob = await toBlob(canvas, 'image/webp', policy.quality);
      // Guard against engines that silently substitute another type despite
      // the feature-detect saying yes - only accept a real WebP here.
      if (blob && blob.type === 'image/webp') return { blob, type: 'image/webp' };
    }
  }

  // JPEG fallback (or an explicit `format: 'image/jpeg'` policy). Flatten
  // transparency onto white so alpha pixels don't render as black.
  const jpegQuality = policy.format === 'image/jpeg' ? policy.quality : JPEG_FALLBACK_QUALITY;
  let best: Encoded | null = null;
  const jpegCanvas = drawScaled(bitmap, w, h, '#ffffff');
  if (jpegCanvas) {
    const jpegBlob = await toBlob(jpegCanvas, 'image/jpeg', jpegQuality);
    if (jpegBlob) best = { blob: jpegBlob, type: 'image/jpeg' };
  }

  // PNG source: a lossless PNG at the smaller size may beat JPEG AND keeps
  // transparency. Keep whichever is smaller.
  if (file.type === 'image/png') {
    const pngCanvas = drawScaled(bitmap, w, h, null);
    if (pngCanvas) {
      const pngBlob = await toBlob(pngCanvas, 'image/png');
      if (pngBlob && (!best || pngBlob.size < best.blob.size)) {
        best = { blob: pngBlob, type: 'image/png' };
      }
    }
  }

  return best;
}

/**
 * Draw the bitmap into an offscreen canvas at the target size. When
 * `background` is set, fill it first - used by the JPEG path to flatten alpha
 * onto a solid colour. Returns null when a 2D context isn't available.
 */
function drawScaled(
  bitmap: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
  background: string | null,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

/**
 * Feature-detect canvas WebP ENCODE support. Old Safari can decode WebP but
 * not encode it via `toBlob`/`toDataURL` - when asked for an unsupported type
 * those quietly hand back a PNG. Not memoized on purpose: the cost is one 1x1
 * canvas and per-call keeps the check honest across environments.
 */
function supportsWebpEncode(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    return false;
  }
}

/**
 * `createImageBitmap` is the modern path: it bakes EXIF orientation into the
 * pixels (`imageOrientation: 'from-image'`) so a sideways phone photo comes
 * out upright, and decodes off the main thread on most engines. Falls back to
 * `<img>` + `onload` for engines without it. Returns null on any decode
 * failure - the caller treats that as "skip compression, ship the original".
 */
async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    }
  } catch {
    // fall through to <img>
  }
  // Fallback for engines without createImageBitmap (very old Safari). Modern
  // browsers default `image-orientation: from-image`, so drawing the <img> to
  // a canvas ALSO honours EXIF orientation - the equivalent of the option
  // above. (On the rare engine that does neither, orientation is best-effort.)
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Source dimensions, preferring the intrinsic size for the `<img>` fallback. */
function dimsOf(bitmap: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if (typeof HTMLImageElement !== 'undefined' && bitmap instanceof HTMLImageElement) {
    return { w: bitmap.naturalWidth || bitmap.width, h: bitmap.naturalHeight || bitmap.height };
  }
  return { w: bitmap.width, h: bitmap.height };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

function closeBitmap(bitmap: ImageBitmap | HTMLImageElement): void {
  if (typeof ImageBitmap !== 'undefined' && bitmap instanceof ImageBitmap) bitmap.close();
}
