/**
 * Referral program kill switch (single source of truth).
 *
 * What: ships DARK (false) so the referral UI - the dedicated page, nav entry,
 *   boost-page reminder, and profile entry - are entirely hidden from users until
 *   legal sign-off + smoke tests pass.
 *
 * Cross-module links: consumed by app/connect/referrals/page.tsx (page guard),
 *   components/connect/ConnectModuleNav.tsx (nav item), features/connect/ads/
 *   BoostsManagerScreen.tsx (reminder card), app/connect/profile/ (profile entry).
 *   The backend `admin.enabled` flag is the REAL gate for earning; this hides the
 *   UI entirely while the feature is dark.
 *
 * Watch: keep in sync with checkout-gate.ts pattern (typed `boolean`, not
 *   literal, so both branches compile without dead-code errors). Flip to `true`
 *   after: legal sign-off, admin enabled=true in a dev env, and smoke tests pass.
 */
export const REFERRAL_ENABLED: boolean = true;
