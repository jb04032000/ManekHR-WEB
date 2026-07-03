import type { SaleInvoice } from '@/types';
import type { TaxComputeResult } from '@/lib/finance/taxComputeClient';
import type { FirmProfile, PartyProfile } from './types';
import { amountInWords } from '@/lib/finance/amountInWords';

// Live preview builder: turns the invoice editor's in-progress form state + the
// client-side tax result into a SaleInvoice-shaped object the existing print themes
// (PrintTemplatePicker) can render, so the preview IS the printed document. Mirrors
// the firm/party mapping in the saved print route
// (app/.../sales/invoices/[id]/print/page.tsx). Display-only: never persisted, so
// _id/audit/timestamps are inert stubs. Keep the *Paise wiring in sync with
// taxComputeClient (source of per-line + total paise the themes read).

// Subset of the RHF form values this builder reads. The editor's watch() result
// (FieldValues = Record<string, any>) is assignable to this.
export interface PreviewFormInput {
  partyId?: string;
  partySnapshot?: Record<string, unknown>;
  voucherNumber?: string;
  voucherDate?: string;
  placeOfSupplyStateCode?: string;
  isReverseCharge?: boolean;
  isBillOfSupply?: boolean;
  sellerGstin?: string;
  paymentTerms?: { dueDays?: number; label?: string };
  additionalCharges?: unknown[];
  notes?: string;
  internalNotes?: string;
  shipping?: unknown;
}

// Subset of the loaded backend Firm object the builder maps to FirmProfile.
export interface PreviewFirmInput {
  _id?: string;
  firmName?: string;
  gstin?: string;
  pan?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
  brandProfile?: FirmProfile['brandProfile'];
  invoiceLayout?: FirmProfile['invoiceLayout'];
  // R3: firm default print locale, so the live preview seeds the same print language
  // the saved print page would (party.preferredLocale wins, this is the fallback).
  defaultPrintLocale?: 'en' | 'gu' | 'hi';
}

const DAY_MS = 86_400_000;

export function buildPreviewInvoice(
  watched: PreviewFormInput,
  taxResult: TaxComputeResult,
  ctx: { firmId: string; wsId: string },
): SaleInvoice {
  const voucherDate = watched.voucherDate ?? new Date().toISOString();
  const dueDays = watched.paymentTerms?.dueDays;
  const dueDate =
    typeof dueDays === 'number'
      ? new Date(new Date(voucherDate).getTime() + dueDays * DAY_MS).toISOString()
      : undefined;

  const invoice: SaleInvoice = {
    _id: 'preview',
    workspaceId: ctx.wsId,
    firmId: ctx.firmId,
    voucherType: 'sale_invoice',
    voucherNumber: watched.voucherNumber, // undefined until posted -> theme shows a draft label
    voucherDate,
    dueDate,
    state: 'draft',
    partyId: watched.partyId ?? '',
    partySnapshot: watched.partySnapshot,
    placeOfSupplyStateCode: watched.placeOfSupplyStateCode,
    isReverseCharge: watched.isReverseCharge,
    isBillOfSupply: watched.isBillOfSupply,
    sellerGstin: watched.sellerGstin,
    paymentTerms: watched.paymentTerms,
    // taxResult.lines carry the per-line *Paise fields the themes read.
    lineItems: taxResult.lines,
    additionalCharges: (watched.additionalCharges ?? []) as SaleInvoice['additionalCharges'],
    notes: watched.notes,
    internalNotes: watched.internalNotes,
    shipping: watched.shipping as SaleInvoice['shipping'],
    linkedDocs: [],
    subtotalPaise: taxResult.subtotalPaise,
    totalDiscountPaise: taxResult.totalDiscountPaise,
    taxableValuePaise: taxResult.taxableValuePaise,
    cgstPaise: taxResult.cgstPaise,
    sgstPaise: taxResult.sgstPaise,
    igstPaise: taxResult.igstPaise,
    cessPaise: taxResult.cessPaise,
    tcsPaise: taxResult.tcsPaise,
    roundOffPaise: taxResult.roundOffPaise,
    grandTotalPaise: taxResult.grandTotalPaise,
    amountInWords: amountInWords(taxResult.grandTotalPaise),
    auditLog: [],
    isDeleted: false,
    createdAt: voucherDate,
    updatedAt: voucherDate,
  };
  return invoice;
}

// Mirror of the print route's Firm -> FirmProfile mapping.
export function buildFirmProfile(firm: PreviewFirmInput | null): FirmProfile {
  const f = firm ?? {};
  return {
    _id: f._id ?? '',
    firmName: f.firmName ?? '',
    gstin: f.gstin,
    pan: f.pan,
    addressLine: [f.address?.line1, f.address?.line2].filter(Boolean).join(', ') || undefined,
    city: f.address?.city,
    state: f.address?.state,
    pincode: f.address?.pincode,
    phone: f.contactPhone,
    email: f.contactEmail,
    brandProfile: f.brandProfile,
    invoiceLayout: f.invoiceLayout,
    defaultPrintLocale: f.defaultPrintLocale,
  };
}

// Mirror of the print route's partySnapshot -> PartyProfile mapping.
export function buildPartyProfile(
  partySnapshot: Record<string, unknown> | undefined,
  partyId: string,
): PartyProfile {
  const ps = partySnapshot ?? {};
  return {
    _id: partyId,
    name: (ps.name as string) ?? '',
    gstin: ps.gstin as string | undefined,
    phone: ps.phone as string | undefined,
    email: ps.email as string | undefined,
    address: ps.address as PartyProfile['address'],
    // R3: party-saved print locale flows from the editor's partySnapshot into the
    // live preview, so the preview language matches what the printed bill will use.
    preferredLocale: ps.preferredLocale as 'en' | 'gu' | 'hi' | undefined,
  };
}
