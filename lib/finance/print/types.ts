import type { SaleInvoice, Quotation, SaleOrder, Proforma, DeliveryChallan } from '@/types';

export type ThemeId =
  | 'a4-theme1'
  | 'a4-theme2'
  | 'a4-theme3-vyapar'
  | 'thermal-2inch'
  | 'thermal-3inch'
  | 'job-work-challan';

export type PrintableVoucher = SaleInvoice | Quotation | SaleOrder | Proforma | DeliveryChallan;

export type WatermarkText =
  | 'DRAFT'
  | 'DUPLICATE'
  | 'VOID'
  | 'PAID'
  | 'OVERDUE'
  | 'CONFIDENTIAL'
  | 'PRO-FORMA'
  | null;

export interface FirmProfile {
  _id: string;
  firmName: string;
  gstin?: string;
  pan?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  brandProfile?: {
    logoUrl?: string;
    signatureUrl?: string;
    primaryColor?: string; // hex e.g. 'var(--cr-primary)'
    accentColor?: string;
    footerText?: string;
    termsAndConditions?: string;
    declaration?: string;
    upiId?: string;
    bankAccountNumber?: string;
    bankIfsc?: string;
    bankName?: string;
  };
  /**
   * Per-firm invoice layout config (design spec 2026-06-01 SS2C / 3B).
   * All flags default to true (show). The themes use `firm.invoiceLayout?.<flag> !== false`
   * so undefined (missing) and true both render; only an explicit false hides.
   */
  invoiceLayout?: {
    showHsnColumn?: boolean;
    showDiscountColumn?: boolean;
    showBankDetails?: boolean;
    showSignature?: boolean;
    showTermsAndConditions?: boolean;
  };
  /** D24: firm-level default print locale; the print picker seeds from it (after party.preferredLocale). */
  defaultPrintLocale?: 'en' | 'gu' | 'hi';
}

export interface PartyProfile {
  _id: string;
  name: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  /** D24: party's preferred print locale; the print picker seeds the language from this first. */
  preferredLocale?: 'en' | 'gu' | 'hi';
}

export interface PrintOptions {
  theme: ThemeId;
  copies: ('Original' | 'Duplicate' | 'Triplicate')[];
  watermark: WatermarkText;
  qrBase64?: string; // pre-fetched UPI QR base64 PNG
  irpQrBase64?: string; // IRP-signed e-Invoice QR base64 PNG (CGST Rule 48)
}
