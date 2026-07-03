/**
 * Published recovery / grievance destination for DPDP self-serve deletion.
 * Recovery is admin-mediated (no self-cancel): a suspended/scheduled user goes
 * here to recover within the 30-day window.
 *
 * This is the on-site `/grievance` page (the DPDP grievance-officer / DPO surface,
 * plan §8 / §12, Rule 13/14) — a stable destination that gives locked-out users
 * the recovery steps + the actual contact. NO email address is hardcoded here:
 * the page sources the monitored mailbox from `env.grievanceEmail`
 * (NEXT_PUBLIC_GRIEVANCE_EMAIL). The backend default
 * `env.accountDeletion.contactUrl` mirrors this (`{WEB_APP_URL}/grievance`).
 */
export const DELETION_CONTACT_PATH = '/grievance';
