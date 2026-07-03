/**
 * Types for the traction-based boost nudge (mirror of the backend
 * boost-nudges types). Kept in a leaf file so the action, hook, and components
 * share one shape.
 *
 * Cross-module links: backend me/connect/boost-nudges; `kind` mirrors the
 * analytics BoostSubject.
 */

/** The boostable entity kinds a nudge can target. */
export type BoostNudgeKind = 'listing' | 'post' | 'job';

/** One nudge candidate returned by GET /me/connect/boost-nudges. */
export interface BoostNudgeCandidate {
  kind: BoostNudgeKind;
  entityId: string;
  name: string;
  viewsWindow: number;
  windowDays: number;
}

/** The endpoint payload. */
export interface BoostNudgesResponse {
  candidates: BoostNudgeCandidate[];
}
