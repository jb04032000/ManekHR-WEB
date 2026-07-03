// Pure, framework-free helpers for the install-prompt UX. Kept separate from the
// React component so the decision logic (when to show, which platform) is unit
// tested without a DOM. Used by components/pwa/InstallPrompt.tsx and covered by
// components/pwa/pwa-utils.vitest.ts.

/** localStorage key holding the epoch-ms when the user last dismissed the prompt. */
export const INSTALL_DISMISSED_KEY = 'z360_pwa_install_dismissed';

/** Re-show the install prompt this long after a dismissal (30 days). */
export const INSTALL_REPROMPT_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Whether to show the install prompt, given the last-dismissed timestamp and the
 * current time. Never shown once installed (standalone). After a dismissal it
 * stays hidden for 30 days, so we nudge without nagging.
 */
export function shouldShowInstallPrompt(opts: {
  isStandalone: boolean;
  dismissedAt: number | null;
  now: number;
}): boolean {
  if (opts.isStandalone) return false;
  if (opts.dismissedAt == null || !Number.isFinite(opts.dismissedAt)) return true;
  return opts.now - opts.dismissedAt >= INSTALL_REPROMPT_MS;
}

/** Parse the stored dismissal timestamp; returns null when unset / garbage. */
export function parseDismissedAt(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * True for iOS Safari, which never fires `beforeinstallprompt` - those users
 * install via the Share -> Add to Home Screen menu, so we show a hint instead of
 * a button. Other iOS browsers (Chrome/Firefox/Edge on iOS) use WebKit too but
 * cannot install at all, so we exclude them.
 */
export function isIosSafari(ua: string): boolean {
  const isIos = /iphone|ipad|ipod/i.test(ua);
  if (!isIos) return false;
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  return isSafari;
}

/**
 * iPadOS 13+ reports a desktop "Macintosh" Safari UA, so the isIosSafari check
 * above misses it. Touch points on a Macintosh UA give an iPad away (real Macs
 * report <= 1). Restricted to WebKit Safari, where Add to Home Screen exists -
 * desktop Chrome/Firefox on a Mac are excluded.
 */
export function isIPadOS(ua: string, maxTouchPoints: number): boolean {
  if (!/macintosh/i.test(ua)) return false;
  if (maxTouchPoints <= 1) return false;
  return /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edgios|opios|android/i.test(ua);
}

/**
 * Whether to show the iOS "Share -> Add to Home Screen" hint instead of an
 * Install button: true only on iPhone/iPad Safari, the one place a web app
 * installs that way (Apple fires no beforeinstallprompt and shows no Install
 * button). Covers the iPhone / old-iPad UA and the iPadOS-as-Mac UA. Everything
 * else (desktop, Android) is false and gets the real one-tap Install button.
 */
export function isIosInstallTarget(ua: string, maxTouchPoints = 0): boolean {
  return isIosSafari(ua) || isIPadOS(ua, maxTouchPoints);
}

/** True when the app is already running installed (standalone display mode). */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mqlMatches = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  // iOS Safari exposes navigator.standalone instead of the display-mode query.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(mqlMatches || iosStandalone);
}
