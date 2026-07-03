/**
 * Boost launch + wallet top-up switches (single source of truth).
 *
 * Two INDEPENDENT levers (split 2026-06-18 on owner direction, was the single
 * `BOOST_CHECKOUT_ENABLED`):
 *
 *  - BOOST_LAUNCH_ENABLED: sellers can configure AND launch a boost, spending the
 *    ad-wallet credits they already hold. ON now - the real "Launch boost" button
 *    fires the create-boost actions and the backend reserves the budget from the
 *    wallet. Flip to false to fully gate launching (notice + muted button) again.
 *
 *  - WALLET_TOPUP_ENABLED: self-serve "Add credits" / wallet top-up via the online
 *    payment gateway. OFF until that gateway lands - for now credits are added by
 *    the team/admin (admin boost-credit adjust), NOT bought self-serve here. While
 *    false, every top-up surface (composer's short-balance path, the Boosts-hub
 *    wallet strip + drawer, the standalone wallet page) hides the buy button and
 *    surfaces the "credits are added for you" notice, making NO payment API call.
 *
 * Typed `boolean` (not the literal) so the still-present branches for the OTHER
 * state are not flagged as dead code by the linter.
 *
 * Consumed by: BoostComposer.tsx, WalletTopUpForm.tsx (-> WalletPanel +
 * HubWalletStrip).
 */
export const BOOST_LAUNCH_ENABLED: boolean = true;
export const WALLET_TOPUP_ENABLED: boolean = false;
