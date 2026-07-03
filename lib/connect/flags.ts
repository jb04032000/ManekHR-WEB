/**
 * ManekHR Connect - feature flags & rollout.
 *
 * Three rollout layers (see docs/connect/connect-build-plan.md → "Feature flags
 * & rollout"):
 *
 *  1. Module enablement - `env.connectPhase` decides which Connect modules are
 *     live in this deploy. A module is enabled once its phase is reached.
 *  2. Per-user access - `User.connectEnabled` gates the closed beta. An admin
 *     sets it during beta; it becomes self-serve at GA.
 *  3. Cohort / % rollout - handled outside the app: PostHog feature flags +
 *     cohorts decide *who* an admin flips `connectEnabled` on for. The app code
 *     only ever reads `connectEnabled` (layer 2) - there is no PostHog call in
 *     this module by design.
 */

import { env } from '@/lib/env';

/** Every Connect module, ordered by the phase it ships in. */
export const CONNECT_MODULES = [
  'profile',
  'network',
  'search',
  'feed',
  'marketplace',
  'jobs',
  'companies',
  'inbox',
  'notifications',
] as const;

export type ConnectModule = (typeof CONNECT_MODULES)[number];

/**
 * The phase each Connect module ships in - mirrors the master plan's phased
 * build order. A module is enabled once `env.connectPhase >= MODULE_PHASE[m]`.
 */
export const MODULE_PHASE: Record<ConnectModule, number> = {
  profile: 1,
  network: 2,
  search: 2,
  feed: 3,
  marketplace: 4,
  jobs: 5,
  companies: 6,
  inbox: 7,
  // Notifications ship with the feed (phase 3): the feature is complete and its
  // triggers (reactions / comments / follows) exist from the feed onward.
  // Deliberately decoupled from inbox (still 7) so enabling notifications does
  // not also expose the unfinished inbox module.
  notifications: 3,
};

/** Layer 1 - is this module's phase reached by the current deploy? */
export function isConnectModuleEnabled(module: ConnectModule): boolean {
  return env.connectPhase >= MODULE_PHASE[module];
}

/** Every module live in the current deploy, in ship order. */
export function enabledConnectModules(): ConnectModule[] {
  return CONNECT_MODULES.filter(isConnectModuleEnabled);
}

/**
 * Layer 2 - per-user access (the closed-beta gate).
 *
 * `connectEnabled` is set on the `User` (added in Phase 1). Absent / null /
 * false ⇒ the user is not in the Connect beta and sees the "coming soon"
 * placeholder instead of the Connect app.
 */
export interface ConnectAccessUser {
  connectEnabled?: boolean | null;
}

export function isConnectEnabledForUser(user: ConnectAccessUser | null | undefined): boolean {
  return user?.connectEnabled === true;
}
