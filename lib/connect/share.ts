/**
 * Pure share helpers for the Connect ShareButton. Framework-free + side-effect-
 * free so they unit-test cleanly; the React surface (components/connect/ShareButton.tsx)
 * owns i18n, analytics, and the navigator.share / clipboard side effects.
 *
 * Cross-module: ShareButton.tsx is the only caller. WhatsApp is the dominant
 * share channel in the Surat textile market, so the wa.me deep link is the
 * primary affordance everywhere these are used.
 */

/**
 * Build a `wa.me` deep link that pre-fills the chat composer with `text`. Using
 * the bare `wa.me/?text=` (no phone number) opens WhatsApp's "share to a chat"
 * picker on both mobile and desktop/web, which is what a generic share wants.
 * `text` should already contain the canonical URL (WhatsApp turns it into a
 * link-preview card). The text is URL-encoded here so callers pass plain text.
 */
export function waMeHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * True when the OS-native share sheet (navigator.share) is usable. Guarded for
 * SSR (no `navigator`) so it can be called during render without throwing. The
 * component uses this to decide between the native sheet and the copy-link
 * fallback for its secondary action.
 */
export function nativeShareSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { share?: unknown }).share === 'function'
  );
}
