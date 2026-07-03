/**
 * GSTR-2B reconciliation client types. Mirror of the backend Gstr2bService response
 * (gst/gstr2b/gstr2b-recon.ts + gstr2b.service.ts). Cross-link: produced by the
 * reconcileGstr2bData server action, consumed by the gstr2b page + Gstr2bWorksheet.
 * Watch: keep field names in sync with the BE ReconResult / ReconRow / BillRow.
 */

export type Gstr2bReconStatus = 'matched' | 'partial' | 'missing_in_books' | 'missing_in_2b';

export interface Gstr2bTwoBRow {
  gstin: string;
  invNo: string;
  invDate: string;
  taxablePaise: number;
  igstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  itcAvailable: boolean;
  source: 'b2b' | 'b2ba' | 'imp';
}

export interface Gstr2bBillRow {
  billId: string;
  voucherNumber?: string;
  partyName?: string;
  gstin?: string;
  vendorBillNumber?: string;
  vendorBillDate?: string;
  taxablePaise: number;
  igstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
}

export interface Gstr2bReconRow {
  status: Gstr2bReconStatus;
  score: number;
  twoB?: Gstr2bTwoBRow;
  bill?: Gstr2bBillRow;
  deltas?: { taxablePaise: number; taxPaise: number };
}

export interface Gstr2bReconResult {
  rows: Gstr2bReconRow[];
  summary: {
    matched: number;
    partial: number;
    missingInBooks: number;
    missingIn2b: number;
    itcAtRiskPaise: number;
  };
  period: string;
  billsInPeriod: number;
  twoBRows: number;
}
