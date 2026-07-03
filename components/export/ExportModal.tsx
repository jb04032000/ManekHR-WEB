'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Radio, Typography, Divider, Button, Space, Switch, Spin } from 'antd';
import type {
  ExportField,
  ExportFormat,
  ExportBrandingOptions,
  ExportOptions,
} from '@/lib/exportFields/types';
import type { BrandingAssets } from '@/types';
import { DsModal } from '@/components/ui';
import { FieldSelector } from './FieldSelector';
import { useExport } from '@/hooks/useExport';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { getOrFetchPlatformDefaults } from '@/lib/export/brandingCache';

interface ExportModalProps<T = Record<string, unknown>> {
  open: boolean;
  onClose: () => void;
  data: T[];
  fields: ExportField<T>[];
  title: string;
  filename: string;
  filterSummary?: string;
  exportOptions?: Partial<ExportOptions<T>>;
  module?: string;
}

export function ExportModal<T>({
  open,
  onClose,
  data,
  fields,
  title,
  filename,
  filterSummary,
  exportOptions,
}: ExportModalProps<T>) {
  const { exporting, exportData } = useExport();
  const { currentWorkspace } = useWorkspaceStore();
  const { entitlements } = useSubscriptionStore();

  const hasBrandingAccess =
    !!entitlements &&
    (entitlements.moduleAccess
      ?.find((m) => m.module === 'settings')
      ?.subFeatures?.find((sf) => sf.key === 'pdf_branding')?.access ?? 'locked') !== 'locked';

  // Platform defaults
  const [platformDefaults, setPlatformDefaults] = useState<BrandingAssets | undefined>(undefined);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingDefaults(true);
      try {
        const defaults = await getOrFetchPlatformDefaults();
        if (!cancelled) setPlatformDefaults(defaults);
      } catch {
        if (!cancelled) setPlatformDefaults(undefined);
      } finally {
        if (!cancelled) setLoadingDefaults(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Resolve branding source: workspace (if access) → platform defaults
  const brandingSource = useMemo(() => {
    if (hasBrandingAccess && currentWorkspace?.branding) return currentWorkspace.branding;
    return platformDefaults;
  }, [hasBrandingAccess, currentWorkspace?.branding, platformDefaults]);

  const hasHeaderLogo = !!brandingSource?.pdfHeaderLogo;
  const hasWatermark = !!brandingSource?.pdfWatermarkLogo;
  const hasFooter = !!brandingSource?.pdfFooterDetails;
  const hasAnyBranding = hasHeaderLogo || hasWatermark || hasFooter;

  // Branding toggles - init from saved workspace preferences
  const savedPrefs = currentWorkspace?.exportPreferences;
  const [includeHeaderLogo, setIncludeHeaderLogo] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [includeWatermark, setIncludeWatermark] = useState(true);
  const [showExportDate, setShowExportDate] = useState(true);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'auto'>('auto');

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setIncludeHeaderLogo(savedPrefs?.includeHeaderLogo ?? true);
      setIncludeFooter(savedPrefs?.includeFooter ?? true);
      setIncludeWatermark(savedPrefs?.includeWatermark ?? true);
      setShowExportDate(savedPrefs?.showExportDate ?? true);
      setOrientation('auto');
    }
    prevOpenRef.current = open;
  }, [open, savedPrefs]);

  // useMemo so defaultFieldKeys is stable when fields prop is a stable constant
  const defaultFieldKeys = useMemo(
    () => fields.filter((f) => f.defaultEnabled).map((f) => f.key),
    [fields],
  );

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [showCustomize, setShowCustomize] = useState(false);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>(defaultFieldKeys);

  // Reset all state when modal closes
  const handleClose = () => {
    setFormat('pdf');
    setShowCustomize(false);
    setSelectedFieldKeys(defaultFieldKeys);
    onClose();
  };

  const handleExport = async () => {
    if (selectedFieldKeys.length === 0) return;

    // Build branding options for PDF
    let branding: ExportBrandingOptions | undefined;
    if (hasAnyBranding && (format === 'pdf' || format === 'both')) {
      branding = {
        headerLogoUrl: hasHeaderLogo ? brandingSource!.pdfHeaderLogo : undefined,
        watermarkLogoUrl: hasWatermark ? brandingSource!.pdfWatermarkLogo : undefined,
        footerText: hasFooter ? brandingSource!.pdfFooterDetails : undefined,
        includeHeaderLogo: includeHeaderLogo && hasHeaderLogo,
        includeFooter: includeFooter && hasFooter,
        includeWatermark: includeWatermark && hasWatermark,
      };
    }

    const resolvedFilename = (() => {
      if (hasBrandingAccess && currentWorkspace?.name) {
        const workspacePart = currentWorkspace.name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        // Extract module suffix from original filename e.g. "manekhr_team" → "team"
        const modulePart = filename.split('_').pop() ?? filename;
        return `${workspacePart}_${modulePart}`;
      }
      return filename;
    })();

    try {
      await exportData<T>({
        data,
        fields,
        selectedFieldKeys,
        format,
        filename: resolvedFilename,
        title,
        filterSummary,
        branding,
        showExportDate,
        orientation,
        ...exportOptions,
      });
      // Success - close modal
      handleClose();
    } catch {
      // useExport already toasted the error
      // Do NOT close - keep modal open for retry
    }
  };

  const defaultFieldLabels = useMemo(
    () =>
      fields
        .filter((f) => f.defaultEnabled)
        .map((f) => f.label)
        .join(', '),
    [fields],
  );

  const showBrandingSection =
    (format === 'pdf' || format === 'both') && (hasAnyBranding || loadingDefaults);

  return (
    <DsModal
      open={open}
      onCancel={handleClose}
      title={`Export ${title}`}
      width={480}
      scrollable={true}
      footer={
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={handleClose} disabled={exporting}>
            Cancel
          </Button>
          <Button
            type="primary"
            loading={exporting}
            disabled={exporting || selectedFieldKeys.length === 0}
            onClick={handleExport}
          >
            Export
          </Button>
        </div>
      }
    >
      {/* Format selector */}
      <div className="mb-5">
        <Typography.Text strong className="mb-2 block text-sm">
          Format
        </Typography.Text>
        <Radio.Group value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
          <Space orientation="horizontal">
            <Radio value="pdf">PDF</Radio>
            <Radio value="excel">Excel (.xlsx)</Radio>
            <Radio value="both">Both</Radio>
          </Space>
        </Radio.Group>
      </div>

      <Divider className="my-0" />

      {/* Field selector */}
      <div className="mt-4">
        <Typography.Text strong className="mb-2 block text-sm">
          Fields
        </Typography.Text>

        {!showCustomize ? (
          <div>
            <Typography.Text type="secondary" className="text-sm leading-relaxed">
              Default: <span className="text-gray-700">{defaultFieldLabels}</span>
              {'  '}
              <span className="text-xs text-faint">({defaultFieldKeys.length} fields)</span>
            </Typography.Text>
            <div className="mt-2">
              <Typography.Link
                className="text-xs"
                onClick={() => {
                  setSelectedFieldKeys([...defaultFieldKeys]);
                  setShowCustomize(true);
                }}
              >
                Customize fields ▾
              </Typography.Link>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <Typography.Text type="secondary" className="text-xs">
                {selectedFieldKeys.length} of {fields.length} selected
              </Typography.Text>
              <Typography.Link
                className="text-xs"
                onClick={() => {
                  setSelectedFieldKeys([...defaultFieldKeys]);
                  setShowCustomize(false);
                }}
              >
                Reset to defaults
              </Typography.Link>
            </div>
            <FieldSelector
              fields={fields}
              value={selectedFieldKeys}
              onChange={setSelectedFieldKeys}
            />
          </div>
        )}
      </div>

      {/* PDF Branding Options */}
      {showBrandingSection && (
        <>
          <Divider className="my-3" />
          <div className="mt-2">
            <div className="mb-3 flex items-center gap-2">
              <Typography.Text strong className="text-sm">
                PDF Branding
              </Typography.Text>
              {loadingDefaults && <Spin size="small" />}
            </div>

            {!loadingDefaults && hasAnyBranding && (
              <div className="space-y-2.5">
                {hasHeaderLogo && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Include header logo</span>
                    <Switch
                      size="small"
                      checked={includeHeaderLogo}
                      onChange={setIncludeHeaderLogo}
                    />
                  </div>
                )}
                {hasFooter && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Include footer details</span>
                    <Switch size="small" checked={includeFooter} onChange={setIncludeFooter} />
                  </div>
                )}
                {hasWatermark && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Include watermark</span>
                    <Switch
                      size="small"
                      checked={includeWatermark}
                      onChange={setIncludeWatermark}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Show export date & time</span>
                  <Switch size="small" checked={showExportDate} onChange={setShowExportDate} />
                </div>
              </div>
            )}

            {!loadingDefaults &&
              hasBrandingAccess &&
              !currentWorkspace?.branding?.pdfHeaderLogo &&
              !currentWorkspace?.branding?.pdfWatermarkLogo &&
              !currentWorkspace?.branding?.pdfFooterDetails && (
                <Typography.Text type="secondary" className="text-xs">
                  Upload branding assets in Workspace Settings to customize your PDFs
                </Typography.Text>
              )}
          </div>
        </>
      )}
    </DsModal>
  );
}
