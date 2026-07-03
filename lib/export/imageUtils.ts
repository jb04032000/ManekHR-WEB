/**
 * Loads an image URL as a base64 data URL for jsPDF.
 * Returns null on failure (graceful degradation -- PDF renders without that element).
 *
 * Two strategies, tried in order:
 *   1. fetch() -> blob -> data URL. Works for same-origin and CORS-fetchable URLs.
 *   2. <img crossOrigin> -> canvas -> toDataURL. Fallback for when fetch() is
 *      blocked (e.g. a strict CSP connect-src) but the host still serves the
 *      image with CORS headers for <img> (img-src). This is what lets an
 *      employee avatar that renders fine in the app also print on the ID card.
 */
export async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;

  // Strategy 1 — fetch.
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl) return dataUrl;
    }
  } catch {
    /* fall through to the <img> + canvas path */
  }

  // Strategy 2 — <img> + canvas (browser only).
  return loadViaImageElement(url);
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function loadViaImageElement(url: string): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    // crossOrigin is required so the canvas isn't tainted (toDataURL would throw).
    // The host must send Access-Control-Allow-Origin; public R2/CDN buckets do.
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        // Tainted canvas (no CORS headers) — give up gracefully.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
