/**
 * API Configuration
 * Environment-based API settings - mirrors mobile app's config/api.config.ts
 */
import { env } from '@/lib/env';

export const ApiConfig = {
  baseURL: env.backendApiUrl,

  timeout: 15_000,

  retry: {
    maxRetries: 3,
    retryDelay: 1_000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  },

  token: {
    headerKey: 'Authorization',
    prefix: 'Bearer',
    storageKey: 'z360_access_token',
    refreshStorageKey: 'z360_refresh_token',
  },
} as const;
