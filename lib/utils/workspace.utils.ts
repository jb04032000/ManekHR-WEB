import type { Workspace } from '@/types';

/**
 * Type for the nested workspace list response from the API
 * Can be either { owned: [], member: [] } or a flat array
 */
export type WorkspaceListResponse = {
  owned: Workspace[];
  member: Workspace[];
} | Workspace[];

/**
 * Normalizes the workspace list response to a flat array
 * Handles both nested { owned: [], member: [] } and flat array formats
 * 
 * @param data - The workspace list response from the API
 * @returns Flat array of workspaces (owned + member combined)
 */
export function normalizeWorkspaceList(data: WorkspaceListResponse | undefined | null): Workspace[] {
  if (!data) return [];

  let workspaces: Workspace[] = [];

  // Handle nested structure: { owned: [], member: [] }
  if (typeof data === 'object' && 'owned' in data) {
    const owned = Array.isArray(data.owned) ? data.owned : [];
    const member = Array.isArray(data.member) ? data.member : [];
    workspaces = [...owned, ...member];
  } else if (Array.isArray(data)) {
    // Handle flat array format
    workspaces = data;
  }

  // Deduplicate by _id
  return workspaces.filter((ws, index, self) => 
    index === self.findIndex((w) => w._id === ws._id)
  );
}
