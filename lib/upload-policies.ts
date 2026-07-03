/* eslint-disable */
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
  | 'avatars'
  | 'branding'
  | 'connect-audio'
  | 'connect-banners'
  | 'connect-company-video'
  | 'connect-inbox-media'
  | 'connect-job-resume'
  | 'connect-job-video'
  | 'connect-job-voice'
  | 'connect-portfolio'
  | 'connect-posts'
  | 'connect-product-video'
  | 'connect-profile-video'
  | 'documents'
  | 'erp-feedback-media'
  | 'passbooks'
  | 'profiles'
  | 'proofs'
  | 'qrcodes';

/**
 * Storage visibility (mirror of the backend `StorageVisibility`). `private`
 * categories land on the private bucket and are served via short-lived signed
 * URLs; the FE never constructs the URL (it always comes back decorated in API
 * responses), so this is informational parity only. Omitted = `public`.
 */
export type StorageVisibility = 'public' | 'private';

/** Image guards (mirror of the backend `ImagePolicy`). */
export interface ImagePolicy {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: { ratio: number; tolerance: number };
}

/** Client-side compression target (mirror of the backend `CompressionPolicy`). */
export interface CompressionPolicy {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'image/webp' | 'image/jpeg';
}

/** Per-category policy (mirror of the backend `UploadPolicy`). */
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
 * Plan-layer policy — same shape as `Partial<UploadPolicy>` plus the
 * `compression: null` sentinel meaning "explicitly disable for this tier".
 */
export type PlanLayerPolicy = Omit<Partial<UploadPolicy>, 'compression'> & {
  compression?: CompressionPolicy | null;
};

export const CATEGORY_POLICIES: Record<UploadCategory, UploadPolicy> = {
  "avatars": {
    "compression": {
      "format": "image/webp",
      "maxHeight": 800,
      "maxWidth": 800,
      "quality": 0.82
    },
    "image": {
      "aspectRatio": {
        "ratio": 1,
        "tolerance": 0.3
      }
    },
    "maxBytes": 1048576,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ]
  },
  "branding": {
    "maxBytes": 5242880,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ]
  },
  "connect-audio": {
    "duration": {
      "max": 180
    },
    "maxBytes": 10485760,
    "mimeTypes": [
      "audio/webm",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav"
    ]
  },
  "connect-banners": {
    "compression": {
      "format": "image/webp",
      "maxHeight": 2400,
      "maxWidth": 2400,
      "quality": 0.82
    },
    "image": {
      "aspectRatio": {
        "ratio": 4,
        "tolerance": 0.6
      }
    },
    "maxBytes": 3145728,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ]
  },
  "connect-company-video": {
    "duration": {
      "max": 60
    },
    "maxBytes": 52428800,
    "mimeTypes": [
      "video/mp4",
      "video/webm",
      "video/quicktime"
    ]
  },
  "connect-inbox-media": {
    "compression": {
      "format": "image/webp",
      "maxHeight": 1920,
      "maxWidth": 1920,
      "quality": 0.82
    },
    "duration": {
      "max": 180
    },
    "maxBytes": 5242880,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "audio/webm",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav"
    ],
    "visibility": "private"
  },
  "connect-job-resume": {
    "maxBytes": 10485760,
    "mimeTypes": [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ],
    "visibility": "private"
  },
  "connect-job-video": {
    "duration": {
      "max": 60
    },
    "maxBytes": 52428800,
    "mimeTypes": [
      "video/mp4",
      "video/webm",
      "video/quicktime"
    ]
  },
  "connect-job-voice": {
    "duration": {
      "max": 180
    },
    "maxBytes": 10485760,
    "mimeTypes": [
      "audio/webm",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav"
    ],
    "visibility": "private"
  },
  "connect-portfolio": {
    "compression": {
      "format": "image/webp",
      "maxHeight": 1600,
      "maxWidth": 1600,
      "quality": 0.82
    },
    "maxBytes": 3145728,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ]
  },
  "connect-posts": {
    "compression": {
      "format": "image/webp",
      "maxHeight": 1600,
      "maxWidth": 1600,
      "quality": 0.82
    },
    "duration": {
      "max": 120
    },
    "maxBytes": 20971520,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
  },
  "connect-product-video": {
    "duration": {
      "max": 60
    },
    "maxBytes": 52428800,
    "mimeTypes": [
      "video/mp4",
      "video/webm",
      "video/quicktime"
    ]
  },
  "connect-profile-video": {
    "duration": {
      "max": 60
    },
    "maxBytes": 52428800,
    "mimeTypes": [
      "video/mp4",
      "video/webm",
      "video/quicktime"
    ]
  },
  "documents": {
    "maxBytes": 10485760,
    "mimeTypes": [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
  },
  "erp-feedback-media": {
    "compression": {
      "format": "image/webp",
      "maxHeight": 1600,
      "maxWidth": 1600,
      "quality": 0.82
    },
    "maxBytes": 5242880,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ],
    "visibility": "private"
  },
  "passbooks": {
    "maxBytes": 5242880,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf"
    ]
  },
  "profiles": {
    "maxBytes": 5242880,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ]
  },
  "proofs": {
    "maxBytes": 5242880,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf"
    ]
  },
  "qrcodes": {
    "maxBytes": 1048576,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ]
  }
};

/**
 * Per-plan-tier overrides. Intentionally empty until the subscription / plan-tier
 * work lands on the backend — populate the backend source, not this file.
 */
export const PLAN_OVERRIDES: Partial<
  Record<PlanTier, Partial<Record<UploadCategory, PlanLayerPolicy>>>
> = {};
