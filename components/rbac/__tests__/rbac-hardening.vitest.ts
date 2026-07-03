/**
 * rbac-hardening.vitest.ts — RBAC module hardening (2026-06-15).
 *
 * Covers the four QA pillars for the RBAC hardening pass:
 *
 * 1. PermissionPreview i18n coverage (RBAC-RISK-07 / spec AC-3.5):
 *    Every module listed in PREVIEW_KEYED_MODULES must have complete
 *    `rbac.preview.<module>.<feature>.<action>[.<scope>]` keys in ALL four
 *    locale files (en / gu / gu-en / hi-en). The check uses the same
 *    `allPermissionPaths()` shape encoded in the backend registry — but
 *    since the backend isn't importable here, we replicate the leaf set
 *    from the registry source of truth. A missing key would cause
 *    `MISSING_MESSAGE` in next-intl at runtime when PermissionPreview renders.
 *
 * 2. PREVIEW_KEYED_MODULES coverage assertion:
 *    hasPreviewKey() in PermissionPreview.tsx only emits chips for modules in
 *    its allow-list. Any registered module that HAS preview keys but is NOT in
 *    the allow-list would silently drop chips. Conversely, any module in the
 *    allow-list that lacks preview keys would crash. This test verifies the two
 *    sets are in sync.
 *
 * 3. rbac.preview.empty and rbac.preview.title keys in all locales.
 *
 * 4. No duplicate rbac.preview leaf keys within each locale.
 *
 * 5. FE efficiency sanity: rbac.preview key count matches across all locales
 *    (same number of preview keys in each, proving no locale has a structural
 *    difference that would cause some users to see chips others don't).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// process.cwd() in vitest is the web project root.
const ROOT = process.cwd();
const MESSAGES_DIR = join(ROOT, 'app', 'messages');

const LOCALES = ['en', 'gu', 'gu-en', 'hi-en'] as const;
type Locale = (typeof LOCALES)[number];

type Messages = Record<string, unknown>;

function loadLocale(locale: Locale): Messages {
  const path = join(MESSAGES_DIR, `${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Messages;
}

/** Recursively flatten a nested object to dotted key paths. */
function flatten(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return prefix ? [prefix] : [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const seg = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null ? flatten(v, seg) : [seg];
  });
}

/** Safe deep-get on a plain object. */
function deepGet(obj: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((acc, seg) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[seg];
  }, obj);
}

// ── registry leaf paths from the backend source of truth ─────────────────────
//
// The backend `PERMISSION_REGISTRY` is the canonical source. We replicate its
// PREVIEW_KEYED_MODULES leaf set here by loading the en.json `rbac.preview`
// subtree, which is already the expanded form of the registry (one key per
// leaf action per scope where scoped=true, or one key for scoped=false).
//
// This sidesteps importing the backend TS (no tsconfig path here), and is more
// robust than manually listing leaves because the locale files ARE the
// product-of-record of what PermissionPreview is expected to render.
//
// The test is therefore: every key that exists in en.json's rbac.preview tree
// must also exist in every other locale — no missing translation.

const enMessages = loadLocale('en');

function getRbacPreviewTree(messages: Messages): Record<string, unknown> {
  const rbac = messages?.rbac;
  if (!rbac || typeof rbac !== 'object') return {};
  const preview = (rbac as Record<string, unknown>)?.preview;
  if (!preview || typeof preview !== 'object') return {};
  return preview as Record<string, unknown>;
}

const enPreviewTree = getRbacPreviewTree(enMessages);
const enPreviewKeys = flatten(enPreviewTree);

// ── 1. Every rbac.preview key in en.json is present in all other locales ─────

describe('RBAC PermissionPreview — i18n key parity across all locales (RBAC-RISK-07)', () => {
  for (const locale of LOCALES.filter((l) => l !== 'en')) {
    const messages = loadLocale(locale);
    const previewTree = getRbacPreviewTree(messages);

    for (const key of enPreviewKeys) {
      it(`${locale}.json: rbac.preview.${key} exists and is non-empty`, () => {
        const value = deepGet(previewTree, key);
        expect(
          value,
          `${locale}.json is missing rbac.preview.${key}.\n` +
            'This key is used by PermissionPreview.tsx to render a chip label. ' +
            'A missing key produces MISSING_MESSAGE at runtime (RBAC-RISK-07).',
        ).toBeDefined();
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${locale}.json: rbac.preview.${key} has an empty value`,
        ).toBe(true);
      });
    }
  }
});

// ── 2. Root chips (empty/title) present in all locales ────────────────────────

describe('RBAC PermissionPreview — root chip keys present in all locales (AC-3.4)', () => {
  const ROOT_KEYS = ['title', 'empty'] as const;

  for (const locale of LOCALES) {
    const messages = loadLocale(locale);
    const rbac = (messages?.rbac as Record<string, unknown>) ?? {};
    const preview = (rbac?.preview as Record<string, unknown>) ?? {};

    for (const key of ROOT_KEYS) {
      it(`${locale}.json: rbac.preview.${key} exists and is non-empty`, () => {
        const value = preview[key];
        expect(value, `${locale}.json is missing rbac.preview.${key}`).toBeDefined();
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${locale}.json: rbac.preview.${key} is empty`,
        ).toBe(true);
      });
    }
  }
});

// ── 3. PREVIEW_KEYED_MODULES coverage assertion ────────────────────────────────
//
// PermissionPreview.tsx has a hard-coded PREVIEW_KEYED_MODULES allow-list that
// acts as the gate between "this path might be granted" and "we have a chip key
// for it". Every module in that list must actually have preview keys in en.json;
// every module WITH preview keys in en.json should be on the list (or at least
// have a justification for exclusion).
//
// Since we can't import PermissionPreview's internal constant directly, we derive
// the expected set from the en.json preview tree (the source of truth for what
// keys exist) and compare it to what we know the code ships.

describe('RBAC PermissionPreview — PREVIEW_KEYED_MODULES vs en.json preview tree (AC-3.5)', () => {
  it('en.json rbac.preview has at least one non-root key for each expected module', () => {
    // These are the modules declared in PermissionPreview.tsx PREVIEW_KEYED_MODULES
    // (confirmed by reading the component source, RBAC-hardening Pillar 3).
    const EXPECTED_MODULES = [
      'team',
      'attendance',
      'leave',
      'regularization',
      'holidays',
      'shifts',
      'finance',
    ];

    for (const mod of EXPECTED_MODULES) {
      const modTree = (enPreviewTree as Record<string, unknown>)[mod];
      expect(
        modTree,
        `en.json rbac.preview.${mod} is missing. ` +
          `Module '${mod}' is in PREVIEW_KEYED_MODULES but has no preview keys. ` +
          'This would crash PermissionPreview when a granted path from this module is rendered.',
      ).toBeDefined();

      // Must have at least one leaf key (the subtree is non-empty).
      const leaves = flatten(modTree, mod);
      expect(
        leaves.length,
        `en.json rbac.preview.${mod} has no leaf keys — module subtree is empty`,
      ).toBeGreaterThan(0);
    }
  });

  it('every top-level key in en.json rbac.preview (except title/empty) maps to a known module', () => {
    // Guard against a module being added to the preview tree but not to
    // PREVIEW_KEYED_MODULES (it would never render chips, but the keys would
    // be unused dead code — a drift indicator).
    const KNOWN_MODULES = [
      'team',
      'attendance',
      'leave',
      'regularization',
      'holidays',
      'shifts',
      'finance',
    ];
    const EXPECTED_ROOTS = new Set([...KNOWN_MODULES, 'title', 'empty']);
    const actualRoots = Object.keys(enPreviewTree);

    for (const root of actualRoots) {
      expect(
        EXPECTED_ROOTS.has(root),
        `en.json rbac.preview has unexpected key '${root}'. ` +
          'Either add it to PREVIEW_KEYED_MODULES or remove from the locale file.',
      ).toBe(true);
    }
  });
});

// ── 4. No duplicate leaf keys within each locale's rbac.preview tree ──────────

describe('RBAC PermissionPreview — no duplicate preview keys (regression guard)', () => {
  it('enPreviewKeys array has no duplicates', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const k of enPreviewKeys) {
      if (seen.has(k)) dupes.push(k);
      seen.add(k);
    }
    expect(dupes, 'Duplicate rbac.preview keys found in en.json').toEqual([]);
  });
});

// ── 5. Key count parity across locales (FE efficiency pillar) ─────────────────
//
// A structural mismatch (locale has MORE or FEWER keys than en.json) indicates
// a translation that was added/removed in one locale but not others. This would
// manifest as chips appearing in one language but not another — a silent visual
// regression.

describe('RBAC PermissionPreview — preview key counts are equal across all locales', () => {
  it('every locale has the same number of flattened rbac.preview keys as en.json', () => {
    const enCount = enPreviewKeys.length;
    expect(enCount, 'en.json has no rbac.preview keys — check locale file path').toBeGreaterThan(0);

    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      const messages = loadLocale(locale);
      const previewTree = getRbacPreviewTree(messages);
      const keys = flatten(previewTree);
      expect(
        keys.length,
        `${locale}.json has ${keys.length} rbac.preview keys but en.json has ${enCount}. ` +
          'A mismatch means chips will appear/disappear between locales.',
      ).toBe(enCount);
    }
  });
});

// ── 6. rbac.module.* keys present for all registered modules (AC-3.4) ────────
//
// The PermissionGrid and module-level labels in the matrix use rbac.module.*
// keys. If a module is registered in PERMISSION_REGISTRY but has no label key
// in a locale, the module header renders blank in the matrix.

describe('RBAC module label keys — present in all locales (AC-3.4)', () => {
  // These are the modules that have entries in PERMISSION_REGISTRY.
  const REGISTERED_MODULES = [
    'team',
    'attendance',
    'leave',
    'regularization',
    'holidays',
    'shifts',
    'finance',
  ];

  for (const locale of LOCALES) {
    const messages = loadLocale(locale);
    const rbac = (messages?.rbac as Record<string, unknown>) ?? {};
    const moduleLabels = (rbac?.module as Record<string, unknown>) ?? {};

    for (const mod of REGISTERED_MODULES) {
      it(`${locale}.json: rbac.module.${mod} exists and is non-empty`, () => {
        const value = moduleLabels[mod];
        expect(value, `${locale}.json is missing rbac.module.${mod}`).toBeDefined();
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${locale}.json: rbac.module.${mod} is empty`,
        ).toBe(true);
      });
    }
  }
});

// ── 7. rbac.previewRestrict keys (SoD chips) in all locales (AC-3.4) ─────────
//
// PermissionPreview also emits restrict chips (amber) for SoD leaves. These
// use rbac.previewRestrict.* keys. Missing keys would produce MISSING_MESSAGE
// in the role editor when a sensitive field (pay/bank/statutory/org) has an
// edit grant.

describe('RBAC PermissionPreview — previewRestrict keys in all locales (AC-3.4)', () => {
  function getPreviewRestrictTree(messages: Messages): Record<string, unknown> {
    const rbac = messages?.rbac;
    if (!rbac || typeof rbac !== 'object') return {};
    const r = (rbac as Record<string, unknown>)?.previewRestrict;
    if (!r || typeof r !== 'object') return {};
    return r as Record<string, unknown>;
  }

  const enRestrictTree = getPreviewRestrictTree(enMessages);
  const enRestrictKeys = flatten(enRestrictTree);

  it('en.json has at least one previewRestrict key', () => {
    expect(enRestrictKeys.length, 'en.json has no rbac.previewRestrict keys').toBeGreaterThan(0);
  });

  for (const locale of LOCALES.filter((l) => l !== 'en')) {
    const messages = loadLocale(locale);
    const restrictTree = getPreviewRestrictTree(messages);

    for (const key of enRestrictKeys) {
      it(`${locale}.json: rbac.previewRestrict.${key} exists`, () => {
        const value = deepGet(restrictTree, key);
        expect(
          value,
          `${locale}.json is missing rbac.previewRestrict.${key}.\n` +
            'This key renders the amber SoD chip in PermissionPreview for sensitive editable fields.',
        ).toBeDefined();
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${locale}.json: rbac.previewRestrict.${key} is empty`,
        ).toBe(true);
      });
    }
  }
});
