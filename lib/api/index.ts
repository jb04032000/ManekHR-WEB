/**
 * API Layer - Public barrel export
 *
 * All existing `import { xxxApi } from '@/lib/api'` statements continue
 * to work without any changes across the codebase.
 */

// Re-export every module API
export {
  anomaliesApi,
  authApi,
  usersApi,
  workspacesApi,
  teamApi,
  attendanceApi,
  salaryApi,
  shiftsApi,
  billsApi,
  rolesApi,
  statsApi,
  subscriptionsApi,
  notificationsApi,
  adminApi,
  attendanceStatutoryApi,
  StatutoryTemplate,
} from './modules';
export type { GenerateStatutoryRequest } from './modules';

// Re-export infrastructure for advanced usage
export { ApiConfig } from './config';
export { ApiEndpoints } from './endpoints';
export { default as http, unwrap } from './client';
