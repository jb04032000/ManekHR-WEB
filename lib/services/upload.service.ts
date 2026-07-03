import http, { unwrap } from '../api/client';
import { AxiosProgressEvent } from 'axios';
import {
  getUploadPolicy,
  preCheckUpload,
  type PlanTier,
  type UploadCategory,
} from '../upload-policies.helpers';
import { useSubscriptionStore } from '../store';
import { compressImage } from './image-compress';

export interface UploadResponse {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadOptions {
  category: UploadCategory;
  onProgress?: (progress: number) => void;
}

class UploadService {
  /**
   * Pull the active plan tier from the persisted subscription store.
   * Read at upload time (not at module load) so a tier change mid-session
   * - e.g. a trial → paid upgrade in the same tab - takes effect on the
   * next upload without a reload. `undefined` (no subscription / not yet
   * hydrated) falls through to the free-tier default policy.
   */
  private getCurrentTier(): PlanTier | undefined {
    const tier = useSubscriptionStore.getState().plan?.tier;
    if (tier === 'free' || tier === 'starter' || tier === 'pro' || tier === 'enterprise') {
      return tier;
    }
    return undefined;
  }

  async uploadSingle(file: File, options: UploadOptions): Promise<UploadResponse> {
    const tier = this.getCurrentTier();
    const policy = getUploadPolicy(options.category, tier);

    // Kick the caller's progress UI to 0 BEFORE compression. Decoding +
    // re-encoding a multi-MB photo takes a beat; emitting 0 now makes any
    // progress-driven UI enter its pending/spinner state immediately so there
    // is no frozen/blank gap before the network phase starts. (MediaUploadGrid
    // already seeds its tile at progress 0; this covers other consumers too.)
    options.onProgress?.(0);

    // Optional client-side compression - image categories define a
    // `CompressionPolicy` (see `lib/upload-policies.ts`) so a member's 10 MB
    // phone photo gets downscaled + re-encoded as WebP before it leaves the
    // device. Runs BEFORE the size pre-check below so the cap is enforced on
    // the COMPRESSED bytes (a 12 MB camera photo can land under a 3 MB banner
    // cap). `compressImage` no-ops on non-image files and never throws - on
    // any failure it returns the original, which the pre-check + server still
    // validate. Resolver returns `compression: undefined` when a category /
    // tier opts out, so the ternary ships the original unchanged.
    const finalFile = policy.compression ? await compressImage(file, policy.compression) : file;

    // FE pre-check - fail fast before posting the bytes. Reads the same
    // category policy the BE enforces. Tier-aware: paid tiers get higher size
    // caps. The BE remains the source of truth; this layer just spares the
    // user a wasted upload + a 400 response when a friendly error suffices.
    // Checked on `finalFile` so the size cap reflects the compressed payload.
    const violation = preCheckUpload(finalFile, options.category, tier);
    if (violation) {
      throw new Error(violation.message);
    }

    const formData = new FormData();
    formData.append('file', finalFile);

    const response = await http.post<UploadResponse>(
      `/uploads/single?category=${options.category}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (options.onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            options.onProgress(progress);
          }
        },
      },
    );

    return unwrap<UploadResponse>(response);
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      await http.delete('/uploads/file', {
        data: { url: fileUrl },
      });
    } catch (error) {
      // Best-effort cleanup: a failed delete must not block the caller (the BE
      // tolerates an already-removed object too). Log enough to notice drift
      // without dumping the raw error object, which can carry the full URL in
      // its axios request config -- key/last segment + message only.
      const key = fileUrl.split('/').pop() || fileUrl.slice(-32);
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Upload deleteFile failed for "${key}": ${message}`);
    }
  }

  async uploadMultiple(files: File[], options: UploadOptions): Promise<string[]> {
    return Promise.all(files.map((f) => this.uploadSingle(f, options).then((r) => r.url)));
  }

  validateFile(
    file: File,
    allowedTypes?: string[],
    maxSizeMb: number = 5,
  ): { valid: boolean; error?: string } {
    const maxSize = maxSizeMb * 1024 * 1024;
    const defaultAllowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const typesToCheck = allowedTypes || defaultAllowedTypes;

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds ${maxSizeMb}MB limit`,
      };
    }

    if (!typesToCheck.includes(file.type)) {
      const typeNames = typesToCheck.map((t) => t.split('/')[1].toUpperCase()).join(', ');
      return {
        valid: false,
        error: `File type not allowed. Only ${typeNames} are supported`,
      };
    }

    return { valid: true };
  }

  getFilePreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  revokePreviewUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}

export const uploadService = new UploadService();
