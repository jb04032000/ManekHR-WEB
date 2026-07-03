'use client';
import { useState } from 'react';
import { App } from 'antd';
import type { ExportOptions } from '@/lib/exportFields/types';
import { generatePdf } from '@/lib/export/exportPdf';
import { generateExcel } from '@/lib/export/exportExcel';
import { generateSectionedPdf } from '@/lib/export/generateSectionedPdf';

export interface UseExportReturn {
  /** True while PDF or Excel generation is in progress. */
  exporting: boolean;
  /**
   * Triggers file generation based on options.format.
   * On error: toasts message.error and re-throws so ExportModal
   * can stay open for retry.
   * On success: resolves normally; caller closes the modal.
   */
  exportData: <T>(options: ExportOptions<T>) => Promise<void>;
}

export function useExport(): UseExportReturn {
  const [exporting, setExporting] = useState(false);
  const { message } = App.useApp();

  const exportData = async <T>(options: ExportOptions<T>): Promise<void> => {
    setExporting(true);
    try {
      if (options.format === 'pdf' || options.format === 'both') {
        if (options.pdfSections?.length) {
          await generateSectionedPdf(options);
        } else {
          await generatePdf(options);
        }
      }
      if (options.format === 'excel' || options.format === 'both') {
        await generateExcel(options);
      }
    } catch (err) {
      console.error('[useExport] Generation failed:', err);
      message.error('Export failed. Please try again.');
      // Re-throw so ExportModal keeps itself open for retry
      throw err;
    } finally {
      setExporting(false);
    }
  };

  return { exporting, exportData };
}
