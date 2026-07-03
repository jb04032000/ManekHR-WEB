// Feedback screen capture + redaction. Snapshots the ERP content root
// (#z360-capture-root in DashboardLayout) to a PNG via html-to-image, then lets
// the caller paint opaque redaction rectangles over sensitive regions before
// turning the result into an upload-ready File. Black-box redaction is
// irreversible (no pixels survive) — preferred over reversible CSS blur for an
// ERP that shows payroll/PII. Canvas round-trip also strips EXIF/GPS. The output
// File declares image/png to match the encoded bytes (the BE sniffs magic bytes).
// Links to: components/ui/FeedbackScreenCapture.tsx (UI).
import { toPng } from 'html-to-image';

export const CAPTURE_ROOT_ID = 'z360-capture-root';

// Redaction rectangle in NATURAL image pixels.
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Capture the content root to a decoded HTMLImageElement, ready to draw.
// Returns null if the root is missing or capture fails (e.g. cross-origin
// taint) so the caller can fall back to manual photo upload.
export async function captureContentRoot(): Promise<HTMLImageElement | null> {
  if (typeof document === 'undefined') return null;
  const node = document.getElementById(CAPTURE_ROOT_ID);
  if (!node) return null;
  try {
    const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 1 });
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode failed'));
      img.src = dataUrl;
    });
    return img;
  } catch {
    return null;
  }
}

// Draw the image + opaque redaction rectangles to a canvas and emit a PNG File.
export async function renderRedactedFile(
  img: HTMLImageElement,
  rects: Rect[],
): Promise<File | null> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#111111';
  for (const r of rects) ctx.fillRect(r.x, r.y, r.w, r.h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob) return null;
  return new File([blob], `feedback-screen-${Date.now()}.png`, { type: 'image/png' });
}
