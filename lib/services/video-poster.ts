/**
 * Client-side video helpers for the feed composer (Phase 3 - Feed).
 *
 * Two jobs, both BEFORE the bytes leave the device:
 *  1. `readVideoDuration` - read a picked video's length from its metadata so
 *     MediaUploadGrid can reject an over-long clip BEFORE uploading up to 50 MB.
 *     The server (uploads `media-probe`) stays authoritative; this is just fast
 *     feedback.
 *  2. `captureVideoPoster` - grab a frame ~0.5s in, encode it through the SAME
 *     image-compression policy the feed uses for post photos (reuses
 *     `compressImage`, so webp with a jpeg fallback), and hand back an image
 *     File. The grid uploads it as a normal post image and attaches the URL as
 *     `posterUrl` on the media item, so the feed paints a still instantly
 *     instead of a black `<video>` box.
 *
 * Both fail SOFT: any codec quirk / browser limit resolves to `undefined` /
 * `null`, never throws. A poster that cannot be captured just means the video
 * posts without one - the video itself is always the source of truth.
 *
 * Links to: `MediaUploadGrid` (caller), `image-compress.ts` (`compressImage`),
 * `upload-policies.ts` (the `connect-posts` duration cap + compression preset).
 */

import { compressImage } from './image-compress';
import type { CompressionPolicy } from '../upload-policies';

/** Where in the clip to grab the poster frame. ~0.5s avoids a black first frame. */
const POSTER_SEEK_SEC = 0.5;

/** True only in a browser with the DOM APIs we need. */
function hasDom(): boolean {
  return typeof document !== 'undefined' && typeof URL !== 'undefined';
}

/**
 * Read a video File's duration (seconds) from its metadata. Resolves
 * `undefined` if the browser cannot read it (corrupt / unsupported / no DOM).
 * Never rejects.
 */
export function readVideoDuration(file: File): Promise<number | undefined> {
  if (!hasDom()) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let done = false;
    const finish = (d: number | undefined) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const d = video.duration;
      finish(typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : undefined);
    };
    video.onerror = () => finish(undefined);
    video.src = url;
  });
}

/**
 * Grab a single frame from `file` (after the `seeked` event so the pixels are
 * really there) and return it as a PNG image File. Resolves `null` on any
 * failure. Internal - callers use `captureVideoPoster`.
 */
function grabFrame(file: File, seekSec: number): Promise<File | null> {
  if (!hasDom()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let done = false;
    const finish = (f: File | null) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(f);
    };
    video.preload = 'metadata';
    video.muted = true;
    // playsInline keeps iOS Safari from going fullscreen when we touch currentTime.
    (video as HTMLVideoElement & { playsInline?: boolean }).playsInline = true;
    video.onloadedmetadata = () => {
      // Seek a touch in, but never past the end of a very short clip.
      const dur = video.duration;
      const target = Number.isFinite(dur) ? Math.min(seekSec, Math.max(0, dur - 0.05)) : seekSec;
      try {
        video.currentTime = target;
      } catch {
        finish(null);
      }
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return finish(null);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) return finish(null);
          finish(new File([blob], 'poster.png', { type: 'image/png' }));
        }, 'image/png');
      } catch {
        finish(null);
      }
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

/**
 * Capture a poster frame from `file` and encode it through the post-image
 * compression policy (`compressImage`: webp with a jpeg fallback). Returns the
 * image File ready to upload, or `null` if capture/encoding fails (the caller
 * then posts the video without a poster). Never throws.
 */
export async function captureVideoPoster(
  file: File,
  compression: CompressionPolicy,
  seekSec: number = POSTER_SEEK_SEC,
): Promise<File | null> {
  const frame = await grabFrame(file, seekSec);
  if (!frame) return null;
  try {
    // Reuse the feed's post-image compression so the poster matches the bar for
    // a normal feed photo (and gets a jpeg fallback on old Safari).
    return await compressImage(frame, compression);
  } catch {
    return null;
  }
}
