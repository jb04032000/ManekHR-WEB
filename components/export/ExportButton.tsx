'use client';
import { useState } from 'react';
import { Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ExportField, ExportOptions } from '@/lib/exportFields/types';
import { ExportModal } from './ExportModal';

interface ExportButtonProps<T = Record<string, unknown>> {
  /** Full field config array for this module. */
  fields: ExportField<T>[];
  /**
   * Async function returning all rows to export.
   * Client mode: return filtered array directly.
   * Server mode: call the list API with limit: 9999 and active filters.
   */
  getExportData: () => Promise<T[]>;
  /** Module title shown in modal header and PDF/Excel. */
  title: string;
  /**
   * Base filename without extension or date.
   * Final: filename_export_YYYY-MM-DD.pdf / .xlsx
   */
  filename: string;
  /** Active filter summary forwarded to PDF generator. */
  filterSummary?: string;
  /** Optional advanced export configuration such as grouped PDF sections. */
  exportOptions?: Partial<ExportOptions<T>>;
  /** Disables the Export button (e.g. while the table is loading). */
  disabled?: boolean;
  /**
   * Module key for branding access check (salary, attendance, etc.)
   * Defaults to 'salary' for backwards compatibility.
   */
  module?: string;
  /**
   * DEV ONLY - documentation flag.
   * Signals that getExportData always calls the server.
   * Has no runtime effect inside ExportButton.
   */
  _forceServerModeFetch?: boolean;
}

export function ExportButton<T>({
  fields,
  getExportData,
  title,
  filename,
  filterSummary,
  exportOptions,
  disabled = false,
  module = 'salary',
}: ExportButtonProps<T>) {
  const [fetching, setFetching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [resolvedData, setResolvedData] = useState<T[]>([]);

  const handleClick = async () => {
    setFetching(true);
    try {
      const data = await getExportData();
      setResolvedData(data);
      setModalOpen(true);
    } catch (err) {
      console.error('[ExportButton] Failed to load export data:', err);
      message.error('Failed to load data for export. Please try again.');
      // Modal does NOT open on fetch failure
    } finally {
      setFetching(false);
    }
  };

  return (
    <>
      <Button
        icon={<DownloadOutlined />}
        loading={fetching}
        disabled={disabled || fetching}
        onClick={handleClick}
        style={{ borderColor: 'var(--cr-primary)', color: 'var(--cr-primary)' }}
      >
        Export
      </Button>

      <ExportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={resolvedData}
        fields={fields}
        title={title}
        filename={filename}
        filterSummary={filterSummary}
        exportOptions={exportOptions}
        module={module}
      />
    </>
  );
}
