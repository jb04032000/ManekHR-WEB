import { getDefaultBranding } from '@/lib/actions/workspaces.actions';
import type { BrandingAssets } from '@/types';

let cachedDefaults: BrandingAssets | undefined | null = null;

export async function getOrFetchPlatformDefaults(): Promise<BrandingAssets | undefined> {
  if (cachedDefaults !== null) return cachedDefaults || undefined;
  try {
    cachedDefaults = await getDefaultBranding();
  } catch {
    cachedDefaults = undefined;
  }
  return cachedDefaults || undefined;
}

export function invalidatePlatformDefaultsCache() {
  cachedDefaults = null;
}
