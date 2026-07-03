/**
 * Parity guard: the GENERATED web mirror (`lib/upload-policies.ts`) must deep-equal
 * the backend's committed `upload-policies.generated.json`.
 *
 * Together with the backend's staleness test (which keeps that JSON in lockstep
 * with the TS source), this makes silent drift between the two repos impossible:
 *   backend TS  ==(staleness test)==>  backend JSON  ==(this test)==>  web mirror
 *
 * If the mirror is stale, re-run `npm run sync:upload-policies` (after the
 * backend `npm run export:upload-policies`).
 *
 * ISOLATED-CI NOTE: this test reads a file from the SIBLING backend repo
 * (`../crewroster-backend`). When the web repo is checked out alone (no backend
 * sibling on disk), the JSON is absent. Rather than fail a build that genuinely
 * cannot see the source of truth, we SKIP with a loud console warning so the gap
 * is visible in CI logs. In the normal monorepo workspace both repos are present
 * and the assertion runs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CATEGORY_POLICIES, PLAN_OVERRIDES } from './upload-policies';

const BACKEND_JSON = resolve(
  __dirname,
  '..',
  '..',
  'crewroster-backend',
  'upload-policies.generated.json',
);

// Recursively sort object keys so the comparison ignores key-ordering noise and
// only flags real value differences (mirrors the backend export serializer).
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

describe('upload-policies web mirror parity', () => {
  const present = existsSync(BACKEND_JSON);

  it.runIf(present)('deep-equals the backend generated JSON', () => {
    const json = JSON.parse(readFileSync(BACKEND_JSON, 'utf8'));

    // Round-trip the web data through JSON so readonly arrays / undefined-valued
    // optional keys normalize the same way the persisted backend data did.
    const webCats = JSON.parse(JSON.stringify(CATEGORY_POLICIES));
    const webPlans = JSON.parse(JSON.stringify(PLAN_OVERRIDES));

    expect(sortDeep(webCats)).toEqual(sortDeep(json.categoryPolicies));
    expect(sortDeep(webPlans)).toEqual(sortDeep(json.planOverrides));
  });

  it.skipIf(present)('SKIPPED — backend sibling repo not present (isolated checkout)', () => {
    console.warn(
      `[upload-policies.parity] SKIPPED: ${BACKEND_JSON} not found. ` +
        'Web mirror parity is UNVERIFIED in this isolated checkout. ' +
        'Run in the full monorepo workspace (with ../crewroster-backend) to verify.',
    );
  });
});
