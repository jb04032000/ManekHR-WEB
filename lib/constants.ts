/**
 * Must match the backend PAGINATION_THRESHOLD env var (default 200).
 *
 * On the initial team list fetch, the web requests exactly this many records.
 *  - pages === 1  → all members fit within the threshold → CLIENT-SIDE mode:
 *                   in-memory search, filter, and sort; DsTable paginates locally.
 *  - pages  >  1  → more members than the threshold → SERVER-SIDE mode:
 *                   pagination, search, and sort delegated to the API.
 */
export const LIST_ALL_LIMIT = 200;

/**
 * Feature key for Finance Vouchers (Expenses, Journal Vouchers, Contras, Cash Registers).
 * Maps to sub-feature 'finance_vouchers' in the 'finance' module of FEATURE_ACCESS_REGISTRY.
 * Used by Sidebar to gate the Vouchers section.
 */
export const FINANCE_VOUCHERS_FEATURE_KEY = 'finance_vouchers';
