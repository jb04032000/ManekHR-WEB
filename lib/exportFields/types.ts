/**
 * Defines a single exportable column/field for a module's export.
 * T is the data row type - e.g. TeamMember, SalaryRecord, AttendanceRecord.
 */
export interface ExportField<T = Record<string, unknown>> {
  /** Unique string identifier. Used as Checkbox value and lookup key. */
  key: string;
  /** Human-readable column header in PDF, Excel, and FieldSelector. */
  label: string;
  /**
   * true  → included in the default export set (no user interaction needed).
   * false → available only when the user opens "Customize fields".
   */
  defaultEnabled: boolean;
  /**
   * Extracts the display value for this field from a single data row.
   * Return number for numeric fields (salary, counts) so Excel stores them
   * as numeric cells. Always return '-' for null/missing values, never
   * return undefined or null.
   */
  getValue: (row: T) => string | number;
  /**
   * Optional PDF-specific value formatter.
   * When present, used instead of getValue() when rendering PDF cells.
   * Use this when getValue() returns a number for Excel compatibility
   * but the PDF needs a formatted string (e.g. "₹25,000" vs 25000).
   */
  pdfValue?: (row: T) => string;
  /**
   * Optional PDF rendering hints - ignored for Excel export.
   * Enables per-column width, alignment, and cell-level color coding.
   */
  pdf?: {
    /** Fixed column width in mm. Omit to let jspdf-autotable auto-size. */
    cellWidth?: number;
    /** Horizontal text alignment within the cell. Defaults to 'left'. */
    halign?: 'left' | 'center' | 'right';
    /**
     * Return fill + text RGB colors for a body cell based on its display
     * value. Return undefined to use the default row/table styling.
     */
    getCellColors?: (value: string | number) =>
      | {
          fill?: [number, number, number];
          text?: [number, number, number];
        }
      | undefined;
  };
}

/** The three export format options in ExportModal. */
export type ExportFormat = 'pdf' | 'excel' | 'both';

export interface ExportBrandingOptions {
  headerLogoUrl?: string;
  watermarkLogoUrl?: string;
  footerText?: string;
  includeHeaderLogo: boolean;
  includeFooter: boolean;
  includeWatermark: boolean;
}

export interface PdfExportSection<T = Record<string, unknown>> {
  title: string;
  data: T[];
}

/**
 * Full config object passed from ExportModal into useExport.exportData(),
 * which forwards it to generatePdf and/or generateExcel.
 */
export interface ExportOptions<T = Record<string, unknown>> {
  /** All resolved data rows to export (already filtered, all pages). */
  data: T[];
  /** Full field config array for the module (not just selected fields). */
  fields: ExportField<T>[];
  /**
   * Keys of fields the user selected. Non-empty subset of fields[].key.
   * Order determines column order in the output.
   */
  selectedFieldKeys: string[];
  /** Which format(s) to generate. */
  format: ExportFormat;
  /**
   * Base filename without extension or date suffix.
   * Generators append _export_YYYY-MM-DD and the extension.
   * Example: "manekhr_team" → "manekhr_team_export_2026-03-27.pdf"
   */
  filename: string;
  /**
   * Module title used as PDF header text and Excel sheet tab name
   * (truncated to 31 chars if needed - Excel sheet name limit).
   */
  title: string;
  /**
   * Human-readable summary of active filters.
   * Shown as a small italic line below the PDF header bar.
   * Pass undefined when no filters are active - PDF skips the row entirely.
   * Example: 'Status: active | Search: "ankit"'
   */
  filterSummary?: string;
  /**
   * Whether to show the export date/time in the PDF header bar.
   * Defaults to true if not provided.
   */
  showExportDate?: boolean;
  /**
   * Paper orientation. Defaults to 'auto' which picks landscape for
   * wide tables (8+ columns) and portrait otherwise.
   */
  orientation?: 'portrait' | 'landscape' | 'auto';
  pdfSections?: PdfExportSection<T>[];
  branding?: ExportBrandingOptions;
}
