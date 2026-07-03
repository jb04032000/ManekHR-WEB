'use server';

// Phase 16 / FIN-15-04 - voucher print locale preference helpers.
// Thin wrappers around existing party + firm PATCH endpoints.
import { updateParty, updateFirm } from '@/lib/actions/finance.actions';
import type { Party, Firm, PrintLocale } from '@/types';

/**
 * Set or clear a party's preferredLocale. Pass `null` to clear (party will
 * fall through to firm.defaultPrintLocale → 'en' at print time per D-37).
 */
export async function updatePartyPreferredLocale(
  wsId: string,
  firmId: string,
  partyId: string,
  locale: PrintLocale | null,
): Promise<Party> {
  // Sending `null` instructs the backend to clear the field.
  return updateParty(wsId, firmId, partyId, {
    preferredLocale: (locale ?? undefined) as PrintLocale | undefined,
  });
}

/** Set the firm's workspace-default voucher print locale. */
export async function updateFirmDefaultPrintLocale(
  wsId: string,
  firmId: string,
  locale: PrintLocale,
): Promise<Firm> {
  return updateFirm(wsId, firmId, { defaultPrintLocale: locale } as Partial<Firm>);
}
