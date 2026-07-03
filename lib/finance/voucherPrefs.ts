'use client';
/**
 * Sticky last-used voucher prefs (payment terms + place of supply) per firm, so a NEW
 * voucher pre-fills the most-likely values and the user types less. Frontend-only
 * (localStorage). Cross-link: VoucherEditor reads these on new-invoice init and writes
 * them on a successful post. The cross-session PER-PARTY learning (last rate per item,
 * etc.) lives separately in the backend FieldPredictionMemory store (Phase 1b).
 * Watch: keep VoucherPrefs fields in sync with what VoucherEditor reads/writes.
 */
export interface VoucherPrefs {
  /** paymentTerms.dueDays of the last posted voucher for this firm. */
  dueDays?: number;
  /** Place-of-supply state code of the last posted voucher for this firm. */
  placeOfSupplyStateCode?: string;
}

const storageKey = (firmId: string) => `manekhr_voucher_prefs_${firmId}`;

/** Pure, tolerant parse of a stored prefs blob (bad/missing/garbage -> {}). Unit-tested. */
export function parseVoucherPrefs(raw: string | null | undefined): VoucherPrefs {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const prefs: VoucherPrefs = {};
    if (typeof o.dueDays === 'number' && Number.isFinite(o.dueDays) && o.dueDays >= 0) {
      prefs.dueDays = o.dueDays;
    }
    if (typeof o.placeOfSupplyStateCode === 'string' && o.placeOfSupplyStateCode) {
      prefs.placeOfSupplyStateCode = o.placeOfSupplyStateCode;
    }
    return prefs;
  } catch {
    return {};
  }
}

export function loadVoucherPrefs(firmId: string): VoucherPrefs {
  if (typeof window === 'undefined' || !firmId) return {};
  try {
    return parseVoucherPrefs(window.localStorage.getItem(storageKey(firmId)));
  } catch {
    return {};
  }
}

export function saveVoucherPrefs(firmId: string, prefs: VoucherPrefs): void {
  if (typeof window === 'undefined' || !firmId) return;
  const clean: VoucherPrefs = {};
  if (typeof prefs.dueDays === 'number' && Number.isFinite(prefs.dueDays) && prefs.dueDays >= 0) {
    clean.dueDays = prefs.dueDays;
  }
  if (prefs.placeOfSupplyStateCode) clean.placeOfSupplyStateCode = prefs.placeOfSupplyStateCode;
  try {
    window.localStorage.setItem(storageKey(firmId), JSON.stringify(clean));
  } catch {
    /* ignore quota / privacy-mode errors - prefs are best-effort */
  }
}
