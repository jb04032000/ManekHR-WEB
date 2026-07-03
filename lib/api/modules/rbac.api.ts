import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { RegistryResponse, GrantedPath } from '@/types/rbac-registry';

const E = ApiEndpoints.rbac;

/**
 * Shape returned by GET /workspaces/:id/rbac/presets.
 * The `team` array contains all Team-module role presets.
 */
export interface RolePresetResponse {
  team: Array<{
    key: string;
    labelKey: string;
    descriptionKey: string;
    paths: GrantedPath[];
  }>;
}

/**
 * RBAC registry - the static permission catalog the web permission matrix
 * renders against. Backend route is `@AuthenticatedOnly` (any active member
 * may read it). Response is workspace-agnostic in content; the URL is
 * workspace-scoped for API consistency.
 *
 * presets - one-click fills for custom role authoring + per-member overrides
 * matrix. Returns `TEAM_ROLE_PRESETS` (hrAdmin / hrMember / manager / worker).
 */
export const rbacApi = {
  getRegistry: (wsId: string) => http.get(E.registry(wsId)).then(unwrap<RegistryResponse>),
  getRolePresets: (wsId: string) => http.get(E.presets(wsId)).then(unwrap<RolePresetResponse>),
};
