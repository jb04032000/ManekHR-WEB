import { describe, it, expect } from 'vitest';
import {
  INSTALL_REPROMPT_MS,
  isIosInstallTarget,
  isIosSafari,
  parseDismissedAt,
  shouldShowInstallPrompt,
} from './pwa-utils';
import en from '@/app/messages/en.json';
import gu from '@/app/messages/gu.json';
import guEn from '@/app/messages/gu-en.json';
import hiEn from '@/app/messages/hi-en.json';

/**
 * Install-prompt decision logic (the part that runs with no DOM) + the i18n
 * contract for the pwa.* copy the prompt and offline page render.
 */

describe('shouldShowInstallPrompt', () => {
  const now = 1_700_000_000_000;

  it('never shows once installed (standalone)', () => {
    expect(shouldShowInstallPrompt({ isStandalone: true, dismissedAt: null, now })).toBe(false);
    expect(shouldShowInstallPrompt({ isStandalone: true, dismissedAt: now - 1, now })).toBe(false);
  });

  it('shows when never dismissed', () => {
    expect(shouldShowInstallPrompt({ isStandalone: false, dismissedAt: null, now })).toBe(true);
  });

  it('stays hidden inside the 30-day re-prompt window', () => {
    const dismissedAt = now - (INSTALL_REPROMPT_MS - 1);
    expect(shouldShowInstallPrompt({ isStandalone: false, dismissedAt, now })).toBe(false);
  });

  it('re-shows once the 30-day window elapses', () => {
    const dismissedAt = now - INSTALL_REPROMPT_MS;
    expect(shouldShowInstallPrompt({ isStandalone: false, dismissedAt, now })).toBe(true);
  });

  it('treats a non-finite stored value as "never dismissed"', () => {
    expect(shouldShowInstallPrompt({ isStandalone: false, dismissedAt: NaN, now })).toBe(true);
  });
});

describe('parseDismissedAt', () => {
  it('returns null for unset / empty / garbage', () => {
    expect(parseDismissedAt(null)).toBeNull();
    expect(parseDismissedAt('')).toBeNull();
    expect(parseDismissedAt('not-a-number')).toBeNull();
    expect(parseDismissedAt('0')).toBeNull();
  });

  it('parses a valid epoch-ms string', () => {
    expect(parseDismissedAt('1700000000000')).toBe(1_700_000_000_000);
  });
});

describe('isIosSafari', () => {
  const IPHONE_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const IPHONE_CHROME =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
  const ANDROID_CHROME =
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
  const DESKTOP_CHROME =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

  it('is true only for iOS Safari', () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
  });

  it('is false for other iOS browsers (Chrome on iOS cannot install)', () => {
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
  });

  it('is false on Android and desktop Chrome (they use beforeinstallprompt)', () => {
    expect(isIosSafari(ANDROID_CHROME)).toBe(false);
    expect(isIosSafari(DESKTOP_CHROME)).toBe(false);
  });
});

describe('isIosInstallTarget (covers iPadOS-as-Mac)', () => {
  const IPHONE_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  // iPadOS 13+ reports a desktop Macintosh Safari UA; only the touch points differ.
  const IPADOS_AS_MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  const DESKTOP_WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

  it('is true for iPhone Safari', () => {
    expect(isIosInstallTarget(IPHONE_SAFARI)).toBe(true);
  });

  it('is true for iPadOS Safari (Mac UA + touch points)', () => {
    expect(isIosInstallTarget(IPADOS_AS_MAC, 5)).toBe(true);
  });

  it('is false for a real Mac (same UA, no touch)', () => {
    expect(isIosInstallTarget(IPADOS_AS_MAC, 0)).toBe(false);
  });

  it('is false on desktop Windows', () => {
    expect(isIosInstallTarget(DESKTOP_WINDOWS, 0)).toBe(false);
  });
});

describe('pwa.* i18n copy', () => {
  const locales: ReadonlyArray<[string, Record<string, unknown>]> = [
    ['en', en as Record<string, unknown>],
    ['gu', gu as Record<string, unknown>],
    ['gu-en', guEn as Record<string, unknown>],
    ['hi-en', hiEn as Record<string, unknown>],
  ];

  const keys = [
    'install.title',
    'install.body',
    'install.bodyIos',
    'install.action',
    'install.dismiss',
    'install.gotIt',
    'install.aria',
    'offline.title',
    'offline.body',
    'offline.retry',
  ];

  function get(bundle: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, p) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[p];
      return undefined;
    }, bundle.pwa);
  }

  it.each(locales)('has non-empty pwa.* strings in %s', (_name, bundle) => {
    for (const key of keys) {
      const value = get(bundle, key);
      expect(typeof value, `${_name}: pwa.${key}`).toBe('string');
      expect((value as string).trim().length, `${_name}: pwa.${key}`).toBeGreaterThan(0);
    }
  });
});
