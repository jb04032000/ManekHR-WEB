import type { ExportOptions } from '@/lib/exportFields/types';
import dayjs from 'dayjs';

/**
 * Generates an .xlsx file and triggers a browser download.
 * Uses lazy dynamic import - never evaluated during SSR.
 *
 * Structure:
 *   Row 1:     Header row (field labels)
 *   Rows 2..N: Data rows
 *   Sheet name: options.title (truncated to 31 chars - Excel hard limit)
 *   Column widths: auto-sized, clamped between 10 and 50 chars
 */
export async function generateExcel<T>(options: ExportOptions<T>): Promise<void> {
  // ── Lazy import (SSR-safe) ───────────────────────────────────────
  const XLSX = await import('xlsx');

  const { data, fields, selectedFieldKeys, filename, title } = options;

  const selectedFields = fields.filter((f) => selectedFieldKeys.includes(f.key));

  // ── Build rows ───────────────────────────────────────────────────
  const headerRow: (string | number)[] = selectedFields.map((f) => f.label);
  const dataRows: (string | number)[][] = data.map((row) =>
    selectedFields.map((f) => f.getValue(row)),
  );
  const allRows: (string | number)[][] = [headerRow, ...dataRows];

  // ── Worksheet ────────────────────────────────────────────────────
  const worksheet = XLSX.utils.aoa_to_sheet(allRows);

  // ── Auto-size column widths ──────────────────────────────────────
  const colWidths = selectedFields.map((f, colIdx) => {
    const allValues: string[] = [f.label, ...data.map((row) => String(f.getValue(row)))];
    const maxLen = Math.max(...allValues.map((v) => v.length));
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  worksheet['!cols'] = colWidths;

  // ── Workbook ─────────────────────────────────────────────────────
  const workbook = XLSX.utils.book_new();
  const sheetName = title.length > 31 ? title.slice(0, 31) : title;
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // ── Download ─────────────────────────────────────────────────────
  const dateStr = dayjs().format('YYYY-MM-DD');
  XLSX.writeFile(workbook, `${filename}_export_${dateStr}.xlsx`);
}
