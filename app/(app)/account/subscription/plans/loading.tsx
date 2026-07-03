/**
 * Route loading skeleton for /account/subscription/plans. Renders the shared
 * PlansSkeleton (which mirrors the real page section-for-section) so a navigation
 * to this route shows a believable, shift-free placeholder instead of an empty
 * shell. Server-only: no 'use client', no hooks.
 *
 * Links: ./PlansSkeleton.tsx (the skeleton) + ./page.tsx (the real layout, which
 * reuses the SAME skeleton for its in-flight client-fetch state).
 */
import { PlansSkeleton } from './PlansSkeleton';

export default function PlansLoading() {
  return <PlansSkeleton />;
}
