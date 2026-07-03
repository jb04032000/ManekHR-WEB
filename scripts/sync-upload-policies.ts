/**
 * sync-upload-policies.ts — codegen: regenerate `lib/upload-policies.ts` (the web
 * upload-policy mirror) from the backend's committed
 * `../manekhr-backend/upload-policies.generated.json`.
 *
 * WHY: the backend `src/modules/uploads/upload-policies.ts` is the single source
 * of truth for upload limits. The web mirror used to be hand-kept in sync, which
 * silently drifted. Now it is generated: the only hand-edited piece on the web
 * side is `lib/upload-policies.helpers.ts` (the FE-only pre-check helpers), which
 * imports the generated data.
 *
 * FLOW:
 *   edit backend upload-policies.ts
 *     -> cd ../manekhr-backend && npm run export:upload-policies  (writes JSON)
 *     -> npm run sync:upload-policies                                (this script)
 *     -> commit all three artifacts together.
 *
 * A parity test (`lib/upload-policies.parity.vitest.ts`) asserts the generated
 * data deep-equals the backend JSON, so the mirror can never silently drift.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const JSON_PATH = resolve(ROOT, '..', 'manekhr-backend', 'upload-policies.generated.json');
const OUT_PATH = resolve(ROOT, 'lib', 'upload-policies.ts');

interface Artifact {
  categoryPolicies: Record<string, unknown>;
  planOverrides: Record<string, unknown>;
}

/** Indent a JSON.stringify block (2-space) so it nests cleanly under a const. */
function dataBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function build(artifact: Artifact): string {
  // The category union is generated from the JSON keys so the allowed-category
  // list itself stays single-sourced (add a category in the backend, it appears
  // here automatically on the next sync).
  const categories = Object.keys(artifact.categoryPolicies);
  const unionMembers = categories.map((c) => `  | '${c}'`).join('\n');

  return `/* eslint-disable */
/**
 * Upload policies (web mirror) — GENERATED FILE, DO NOT EDIT.
 *
 * This file is generated from the backend single source of truth:
 *   crewroster-backend/src/modules/uploads/upload-policies.ts
 * via the committed artifact:
 *   crewroster-backend/upload-policies.generated.json
 *
 * To change a policy:
 *   1. Edit crewroster-backend/src/modules/uploads/upload-policies.ts.
 *   2. cd crewroster-backend && npm run export:upload-policies   (regen the JSON)
 *   3. cd crewroster-web && npm run sync:upload-policies         (regen THIS file)
 *   4. Commit all three artifacts together.
 *
 * Hand-edits here are overwritten on the next sync and will fail the parity test
 * (lib/upload-policies.parity.vitest.ts). The FE-only pre-check helpers
 * (getUploadPolicy / getAcceptAttr / preCheckUpload) live in the hand-authored
 * lib/upload-policies.helpers.ts, which imports the data below.
 */

/** Allowed upload-category names (generated from the backend category list). */
export type UploadCategory =
${unionMembers};

/**
 * Storage visibility (mirror of the backend \`StorageVisibility\`). \`private\`
 * categories land on the private bucket and are served via short-lived signed
 * URLs; the FE never constructs the URL (it always comes back decorated in API
 * responses), so this is informational parity only. Omitted = \`public\`.
 */
export type StorageVisibility = 'public' | 'private';

/** Image guards (mirror of the backend \`ImagePolicy\`). */
export interface ImagePolicy {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: { ratio: number; tolerance: number };
}

/** Client-side compression target (mirror of the backend \`CompressionPolicy\`). */
export interface CompressionPolicy {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'image/webp' | 'image/jpeg';
}

/** Per-category policy (mirror of the backend \`UploadPolicy\`). */
export interface UploadPolicy {
  maxBytes: number;
  mimeTypes: readonly string[];
  image?: ImagePolicy;
  duration?: { max: number };
  /** Storage visibility — mirror of backend. Omitted = public. */
  visibility?: StorageVisibility;
  compression?: CompressionPolicy;
}

/** Plan tier — mirrors the backend enum. */
export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

/**
 * Plan-layer policy — same shape as \`Partial<UploadPolicy>\` plus the
 * \`compression: null\` sentinel meaning "explicitly disable for this tier".
 */
export type PlanLayerPolicy = Omit<Partial<UploadPolicy>, 'compression'> & {
  compression?: CompressionPolicy | null;
};

export const CATEGORY_POLICIES: Record<UploadCategory, UploadPolicy> = ${dataBlock(
    artifact.categoryPolicies,
  )};

/**
 * Per-plan-tier overrides. Intentionally empty until the subscription / plan-tier
 * work lands on the backend — populate the backend source, not this file.
 */
export const PLAN_OVERRIDES: Partial<
  Record<PlanTier, Partial<Record<UploadCategory, PlanLayerPolicy>>>
> = ${dataBlock(artifact.planOverrides)};
`;
}

function main(): void {
  const artifact = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as Artifact;
  const out = build(artifact);
  writeFileSync(OUT_PATH, out, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`lib/upload-policies.ts regenerated from ${JSON_PATH}`);
}

main();
