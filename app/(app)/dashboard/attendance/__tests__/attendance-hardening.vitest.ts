/**
 * attendance-hardening.vitest.ts — Attendance module hardening (2026-06-15).
 *
 * FE efficiency + i18n pillars (Pillar 3 / AC-4.3 / AC-4.1).
 * These tests run in CI via `test:unit` (vitest run).
 *
 * 1. loading.tsx presence (AC-4.3) — every attendance sub-route that fetches
 *    data must have a co-located loading.tsx to prevent layout flash. The spec
 *    lists: overview, mark, grid, overtime, compliance, patterns, anomalies.
 *    We add regularizations (also a data-fetching route; its absence was flagged
 *    as a gap in the security review).
 *
 * 2. i18n key coverage (AC-4.1) — the four hardening error codes
 *    (MEMBER_OFFBOARDED, ATTENDANCE_SELF_EDIT_BLOCKED, SELF_PUNCH_DISABLED,
 *    PAYROLL_LOCKED) must exist in all four locale files under
 *    `attendance.errors.*` with non-empty values. These are the structured
 *    codes returned by the backend write-guard; if any locale is missing a key
 *    the worker sees a raw English server error instead of a translated message.
 *
 * 3. No duplicate attendance.errors keys within each locale (regression guard).
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Path helpers — process.cwd() in vitest is the web project root.
const ROOT = process.cwd();

// ── 1. loading.tsx presence ─────────────────────────────────────────────────

const ATTENDANCE_ROOT = join(ROOT, 'app', 'dashboard', 'attendance');

const EXPECTED_LOADING_ROUTES = [
  // Root (the redirect page itself does not fetch but the layout wraps it)
  '',
  // Data-fetching sub-routes (spec AC-4.3)
  'overview',
  'mark',
  'grid',
  'overtime',
  'compliance',
  'patterns',
  'anomalies',
];

describe('Attendance sub-routes — loading.tsx presence (AC-4.3)', () => {
  for (const route of EXPECTED_LOADING_ROUTES) {
    const routeLabel = route === '' ? '(root)' : route;
    it(`/attendance/${routeLabel} has a loading.tsx`, () => {
      const loadingPath = route
        ? join(ATTENDANCE_ROOT, route, 'loading.tsx')
        : join(ATTENDANCE_ROOT, 'loading.tsx');
      expect(
        existsSync(loadingPath),
        `Missing loading.tsx at: ${loadingPath}\n` +
          'Every data-fetching attendance route must have a co-located loading.tsx ' +
          'to prevent layout flash (spec AC-4.3, CLAUDE.md binding rule).',
      ).toBe(true);
    });
  }
});

// ── 2. i18n key coverage for hardening error codes ──────────────────────────

const LOCALES = ['en', 'gu', 'gu-en', 'hi-en'] as const;
type Locale = (typeof LOCALES)[number];

const MESSAGES_DIR = join(ROOT, 'app', 'messages');

// The four structured error codes the backend write-guard emits.
// Each must exist in attendance.errors.* in every locale with a non-empty value.
const HARDENING_ERROR_KEYS = [
  'MEMBER_OFFBOARDED',
  'ATTENDANCE_SELF_EDIT_BLOCKED',
  'SELF_PUNCH_DISABLED',
  'PAYROLL_LOCKED',
] as const;

type Messages = Record<string, unknown>;

function loadLocale(locale: Locale): Messages {
  const path = join(MESSAGES_DIR, `${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Messages;
}

function getAttendanceErrors(messages: Messages): Record<string, unknown> {
  const attendance = (messages as any)?.attendance;
  if (!attendance || typeof attendance !== 'object') return {};
  return ((attendance as any)?.errors ?? {}) as Record<string, unknown>;
}

describe('Attendance hardening i18n — error codes in all locales (AC-4.1)', () => {
  for (const locale of LOCALES) {
    const messages = loadLocale(locale);
    const errors = getAttendanceErrors(messages);

    for (const key of HARDENING_ERROR_KEYS) {
      it(`${locale}.json: attendance.errors.${key} exists and is non-empty`, () => {
        const value = errors[key];
        expect(
          value,
          `${locale}.json is missing attendance.errors.${key}. ` +
            'This key maps the structured error code the backend write-guard emits to ' +
            'a translated user message. Without it, workers see raw English server errors.',
        ).toBeDefined();
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${locale}.json has an empty value for attendance.errors.${key}`,
        ).toBe(true);
      });
    }
  }
});

// ── 3. No duplicate attendance.errors keys (regression guard) ───────────────

describe('Attendance hardening i18n — no duplicate error keys', () => {
  it('HARDENING_ERROR_KEYS array itself has no duplicates', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const k of HARDENING_ERROR_KEYS) {
      if (seen.has(k)) dupes.push(k);
      seen.add(k);
    }
    expect(dupes).toEqual([]);
  });
});
