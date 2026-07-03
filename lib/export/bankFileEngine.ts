'use client';

import type { BankFileRow, BankFileApiRow, BankFileMeta, BankBlockReason, BankFlag } from '@/types';
import { getTemplate } from './bankTemplates';
import {
  isValidIfsc,
  isValidAccountNumber,
  autoPickMode,
  sanitizeName,
  IMPS_CAP,
} from '@/lib/exportFields/bankFileValidators';

export function buildBankFileRows(apiRows: BankFileApiRow[]): BankFileRow[] {
  return apiRows.map((raw): BankFileRow => {
    let blockReason: BankBlockReason | undefined;
    if (!raw.accountNumber) blockReason = 'missing_account';
    else if (!raw.ifsc) blockReason = 'missing_ifsc';
    else if (!isValidIfsc(raw.ifsc)) blockReason = 'invalid_ifsc';

    const flags: BankFlag[] = [];
    if (!raw.isActive || raw.isDeleted) flags.push('inactive');
    if (raw.isLocked) flags.push('on_hold');
    if (raw.paidSoFar > 0 && raw.amount > 0) flags.push('partially_paid');
    if (raw.amount <= 0) flags.push('fully_paid');
    if (raw.preferredMethod === 'UPI') flags.push('preferred_upi');
    if (raw.preferredMethod === 'CASH') flags.push('preferred_cash');

    const warnings: string[] = [];
    if (raw.accountNumber && !isValidAccountNumber(raw.accountNumber)) {
      warnings.push('Account number format may be invalid');
    }
    if (raw.amount > IMPS_CAP && raw.paymentMode === 'IMPS') {
      warnings.push('Amount exceeds IMPS cap (₹5L) - mode auto-set to RTGS');
    }

    const canInclude = blockReason === undefined;
    const defaultInclude = canInclude && !flags.includes('fully_paid');

    return {
      ...raw,
      paymentMode: autoPickMode(raw.amount),
      _include: defaultInclude,
      _blockReason: blockReason,
      _flags: flags,
      _warnings: warnings,
    };
  });
}

export async function generateBankFile(rows: BankFileRow[], meta: BankFileMeta): Promise<void> {
  const template = getTemplate(meta.templateId);
  const nameMaxLen = template.nameMaxLen ?? 50;

  const includedRows = rows.filter((r) => r._include);

  if (includedRows.length === 0) return;

  const mappedRows = includedRows.map((row) => {
    const enriched: BankFileRow = {
      ...row,
      txnDate: meta.txnDate,
      beneficiaryName: sanitizeName(row.beneficiaryName, nameMaxLen),
    };
    return template.rowMapper(enriched, meta);
  });

  const headerRows = template.headerRows(meta);
  const footerRows = template.footerRows ? template.footerRows(includedRows, meta) : [];

  const shouldSplitFiles = template.maxRows !== undefined && includedRows.length > template.maxRows;

  const chunkSize = template.maxRows ?? includedRows.length;
  const chunks: (typeof mappedRows)[] = [];
  for (let i = 0; i < mappedRows.length; i += chunkSize) {
    chunks.push(mappedRows.slice(i, i + chunkSize));
  }

  const XLSX = await import('xlsx');

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const suffix = shouldSplitFiles ? `_${ci + 1}` : '';
    const baseFilename = template.filename(meta) + suffix;

    const aoa = [...headerRows, ...chunk, ...footerRows];

    if (meta.format === 'xlsx' || meta.format === 'both') {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const colWidths = aoa[0]?.map((_: unknown, colIdx: number) => {
        const maxLen = Math.max(...aoa.map((row) => String(row[colIdx] ?? '').length));
        return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
      });
      if (colWidths) ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, baseFilename.slice(0, 31));
      XLSX.writeFile(wb, `${baseFilename}.xlsx`);
    }

    if (meta.format === 'csv' || meta.format === 'both') {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFilename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}
