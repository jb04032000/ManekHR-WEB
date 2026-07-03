/**
 * Upload-policy helpers (web, FE-only). HAND-AUTHORED — not generated.
 *
 * The policy DATA + TYPES live in the generated `./upload-policies` (mirror of
 * the backend single source of truth; do not hand-edit that file). This module
 * holds the browser-side logic that consumes that data:
 *  - `getUploadPolicy`  — resolve the effective policy for a category + plan tier.
 *  - `getAcceptAttr`    — build the `<input accept="...">` string.
 *  - `preCheckUpload`   — friendly client-side validation before the network call.
 *
 * **BE remains the source of truth.** This layer only makes the happy path nicer;
 * a malicious client bypassing it still gets a 400 from
 * `uploads.service.ts:validateFileWithCategory`. Keeping the helpers here (split
 * from the generated data) means re-running `npm run sync:upload-policies` never
 * clobbers this logic.
 *
 * Types are re-exported so callers can import data-helpers + types from one path.
 */
import {
  CATEGORY_POLICIES,
  PLAN_OVERRIDES,
  type CompressionPolicy,
  type UploadCategory,
  type UploadPolicy,
  type PlanTier,
} from './upload-policies';

export type {
  UploadCategory,
  UploadPolicy,
  PlanTier,
  CompressionPolicy,
  StorageVisibility,
  ImagePolicy,
  PlanLayerPolicy,
} from './upload-policies';
export { CATEGORY_POLICIES, PLAN_OVERRIDES } from './upload-policies';

const KB = 1024;
const MB = 1024 * KB;

/**
 * Resolve the effective upload policy for a category, optionally narrowed by the
 * caller's plan tier. Mirrors the backend resolver: a plan layer can raise the
 * size cap and either raise compression quality (`pro`) or disable compression
 * entirely (`enterprise`). `PLAN_OVERRIDES` is empty today, so this returns the
 * category default until the subscription-tier work lands.
 */
export function getUploadPolicy(category: UploadCategory, plan?: PlanTier): UploadPolicy {
  const base = CATEGORY_POLICIES[category];
  const override = plan ? PLAN_OVERRIDES[plan]?.[category] : undefined;
  if (!override) return base;

  // Compression — explicit null means disable; key omitted means inherit.
  let compression: CompressionPolicy | undefined;
  if ('compression' in override) {
    compression = override.compression ?? undefined;
  } else {
    compression = base.compression;
  }

  return {
    maxBytes: override.maxBytes ?? base.maxBytes,
    mimeTypes: override.mimeTypes ?? base.mimeTypes,
    image: override.image ?? base.image,
    duration: override.duration ?? base.duration,
    ...(compression ? { compression } : {}),
  };
}

/**
 * Build the `accept` attribute string for a native `<input type="file">` from
 * the category policy. e.g. "image/jpeg,image/png,image/webp".
 */
export function getAcceptAttr(category: UploadCategory): string {
  return getUploadPolicy(category).mimeTypes.join(',');
}

export interface PolicyViolation {
  reason: 'size' | 'mime';
  message: string;
}

/**
 * Pre-validate a file against the category policy. Returns null on pass, a
 * structured violation on fail. The form layer turns the violation into an
 * inline error toast / form-item error.
 */
export function preCheckUpload(
  file: File,
  category: UploadCategory,
  plan?: PlanTier,
): PolicyViolation | null {
  const policy = getUploadPolicy(category, plan);

  if (file.size > policy.maxBytes) {
    const cap = Math.round(policy.maxBytes / MB);
    return {
      reason: 'size',
      message: `File too large. Maximum ${cap} MB for this upload.`,
    };
  }

  const matched = policy.mimeTypes.some((p) => {
    if (p.endsWith('/*')) return file.type.startsWith(p.slice(0, -1));
    return p === file.type;
  });
  if (!matched) {
    return {
      reason: 'mime',
      message: `File type ${file.type || 'unknown'} is not allowed.`,
    };
  }

  return null;
}
