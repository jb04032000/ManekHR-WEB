import type { BankFileRow, BankTemplateId, BankFileMeta } from '@/types';

export type PaymentMode = 'IMPS' | 'NEFT' | 'RTGS' | 'IFT';

export interface BankTemplate {
  id: BankTemplateId;
  name: string;
  fileTypes: Array<'xlsx' | 'csv'>;
  /** Max rows per file; undefined = no limit */
  maxRows?: number;
  nameMaxLen?: number;
  remarksMaxLen?: number;
  defaultMode?: PaymentMode;
  /** Build header row(s). Returns array of rows (each row = array of cells). */
  headerRows: (meta: BankFileMeta) => (string | number)[][];
  /** Map one BankFileRow to an array of cell values. */
  rowMapper: (row: BankFileRow, meta: BankFileMeta) => (string | number)[];
  /** Optional footer rows appended after data rows. */
  footerRows?: (rows: BankFileRow[], meta: BankFileMeta) => (string | number)[][];
  /** Filename without extension. */
  filename: (meta: BankFileMeta) => string;
}
