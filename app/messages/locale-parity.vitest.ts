import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Locale parity guard. en.json is the SOURCE OF TRUTH: every user-facing string
 * in en.json must exist in all three other locales (gu / gu-en / hi-en) with a
 * NON-EMPTY value. A PR that adds an English string but forgets a locale (or fills
 * it blank) fails here, naming the exact missing key path - so blank / untranslated
 * UI can never ship. This is the contract that matters: English is what gets added
 * first, and the guard makes sure the other three keep up.
 *
 * Why "en is a SUBSET of each locale" and not strict bidirectional identity:
 * the non-en files carry a large block of PRE-EXISTING extra keys that en.json
 * does not have (e.g. an `rbac` namespace, many `common.*` / `team.*` / `payroll.*`
 * entries, and a `_metadata` block in hi-en). Asserting strict identity would fail
 * the suite on that historical divergence, and this task is forbidden from editing
 * locale content. Cleaning up / reconciling those extras is tracked separately;
 * the `EXTRA_KEYS_BASELINE` test below pins the current count so the drift cannot
 * silently GROW while that cleanup is pending.
 *
 * Pure data test (no React): reads the four next-intl message files and compares
 * their recursive dot-path key sets.
 * Links: app/messages/*.json (next-intl messages, loaded in i18n request config).
 */

const LOCALES = ['en', 'gu', 'gu-en', 'hi-en'] as const;
type Locale = (typeof LOCALES)[number];

// vitest runs from the web project root, so messages live under app/messages.
const MESSAGES_DIR = join(process.cwd(), 'app', 'messages');

function load(locale: Locale): Record<string, unknown> {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as Record<
    string,
    unknown
  >;
}

/** Recursively flatten a messages object to { 'a.b.c': leafValue } entries. */
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else {
      out[path] = typeof value === 'string' ? value : String(value);
    }
  }
  return out;
}

/** Keys present in `reference` but absent from `target` (sorted for readability). */
function missingKeys(reference: Set<string>, target: Set<string>): string[] {
  return [...reference].filter((k) => !target.has(k)).sort();
}

/**
 * The CURRENT count of pre-existing keys each non-en locale carries that en.json
 * does not (measured 2026-06-12). The extra-key check below allows this to SHRINK
 * (a future locale-vs-en reconciliation) but fails if it GROWS - so nobody can add
 * a key to a locale without also adding it to the en source of truth. These are
 * NOT new debt from this task; the feed-feedback work added the same keys to all
 * four locales (it adds zero extras).
 */
const EXTRA_KEYS_BASELINE: Record<Exclude<Locale, 'en'>, number> = {
  gu: 10,
  'gu-en': 248,
  'hi-en': 13,
};

describe('app/messages locale parity', () => {
  const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(load(l))])) as Record<
    Locale,
    Record<string, string>
  >;
  const keys = Object.fromEntries(LOCALES.map((l) => [l, new Set(Object.keys(flat[l]))])) as Record<
    Locale,
    Set<string>
  >;

  for (const locale of LOCALES.filter((l): l is Exclude<Locale, 'en'> => l !== 'en')) {
    it(`${locale}.json covers every en.json key`, () => {
      const missing = missingKeys(keys.en, keys[locale]);
      // The message lists the exact key paths so a failing PR knows what to add.
      expect(missing, `${locale}.json is missing: ${missing.join(', ')}`).toEqual([]);
    });

    it(`${locale}.json has no empty values where en.json is non-empty`, () => {
      const blanks = Object.keys(flat.en)
        .filter((k) => flat.en[k].trim() !== '' && (flat[locale][k] ?? '').trim() === '')
        .sort();
      expect(blanks, `${locale}.json has empty values for: ${blanks.join(', ')}`).toEqual([]);
    });

    it(`${locale}.json adds no NEW keys beyond the known baseline`, () => {
      const extra = missingKeys(keys[locale], keys.en);
      expect(
        extra.length,
        `${locale}.json now has ${extra.length} keys en.json lacks (baseline ${EXTRA_KEYS_BASELINE[locale]}). ` +
          `New extras must also be added to en.json. Current extras: ${extra.join(', ')}`,
      ).toBeLessThanOrEqual(EXTRA_KEYS_BASELINE[locale]);
    });
  }

  // Self-check (requirement 3): prove the detector actually catches a dropped key
  // by name, without mutating any real locale file.
  it('the missing-key detector names a dropped key (guard self-check)', () => {
    const reference = new Set([
      'connect.feed.post.menu.muteAuthor',
      'connect.feed.post.menu.hidePost',
    ]);
    const broken = new Set(['connect.feed.post.menu.hidePost']);
    expect(missingKeys(reference, broken)).toEqual(['connect.feed.post.menu.muteAuthor']);
  });
});
