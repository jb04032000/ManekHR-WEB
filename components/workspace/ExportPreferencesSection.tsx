'use client';

import { useState } from 'react';
import { Switch, Button, message } from 'antd';
import {
  ReloadOutlined,
  SaveOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FileOutlined,
  FilePdfOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { updateWorkspaceExportPreferences } from '@/lib/actions/workspaces.actions';
import type { WorkspaceExportPreferences } from '@/types';

interface ExportPreferencesSectionProps {
  workspaceId: string;
  preferences?: WorkspaceExportPreferences;
  onSave?: (prefs: WorkspaceExportPreferences) => void;
}

const defaultPreferences: WorkspaceExportPreferences = {
  includeHeaderLogo: true,
  includeFooter: true,
  includeWatermark: true,
};

export function ExportPreferencesSection({
  workspaceId,
  preferences,
  onSave,
}: ExportPreferencesSectionProps) {
  const [includeHeaderLogo, setIncludeHeaderLogo] = useState(
    preferences?.includeHeaderLogo ?? defaultPreferences.includeHeaderLogo,
  );
  const [includeFooter, setIncludeFooter] = useState(
    preferences?.includeFooter ?? defaultPreferences.includeFooter,
  );
  const [includeWatermark, setIncludeWatermark] = useState(
    preferences?.includeWatermark ?? defaultPreferences.includeWatermark,
  );
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const { workspaces, setWorkspaces } = useWorkspaceStore();
  const { entitlements } = useSubscriptionStore();
  const hasBrandingAccess =
    !!entitlements &&
    (entitlements.moduleAccess
      ?.find((m) => m.module === 'settings')
      ?.subFeatures?.find((sf) => sf.key === 'pdf_branding')?.access ?? 'locked') !== 'locked';

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: WorkspaceExportPreferences = {
        includeHeaderLogo,
        includeFooter,
        includeWatermark,
      };
      const res = await updateWorkspaceExportPreferences(workspaceId, data);
      if (res.ok) {
        message.success('Export preferences saved');
        setIsDirty(false);
        const updatedWorkspaces = workspaces.map((ws) =>
          ws._id === workspaceId ? { ...ws, exportPreferences: data } : ws,
        );
        setWorkspaces(updatedWorkspaces);
        if (onSave) {
          onSave(data);
        }
      } else {
        message.error(res.error || 'Failed to save preferences');
      }
    } catch {
      message.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setIncludeHeaderLogo(defaultPreferences.includeHeaderLogo);
    setIncludeFooter(defaultPreferences.includeFooter);
    setIncludeWatermark(defaultPreferences.includeWatermark);
    setIsDirty(false);
  };

  if (!hasBrandingAccess) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <LockOutlined className="text-faint" />
          <span className="text-sm text-gray-700">PDF branding is available on higher plans.</span>
          <UpgradePrompt module="attendance" subFeature="pdf_branding" compact />
        </div>
        <fieldset disabled className="pointer-events-none opacity-40">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--cr-border)] bg-white p-4 opacity-60">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-lg bg-gray-100" />
                <div className="h-5 w-10 rounded-full bg-gray-200" />
              </div>
              <div>
                <div className="mb-1.5 h-3 w-3/4 rounded bg-gray-100" />
                <div className="h-2.5 w-full rounded bg-gray-100" />
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--cr-border)] bg-white p-4 opacity-60">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-lg bg-gray-100" />
                <div className="h-5 w-10 rounded-full bg-gray-200" />
              </div>
              <div>
                <div className="mb-1.5 h-3 w-3/4 rounded bg-gray-100" />
                <div className="h-2.5 w-full rounded bg-gray-100" />
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--cr-border)] bg-white p-4 opacity-60">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-lg bg-gray-100" />
                <div className="h-5 w-10 rounded-full bg-gray-200" />
              </div>
              <div>
                <div className="mb-1.5 h-3 w-3/4 rounded bg-gray-100" />
                <div className="h-2.5 w-full rounded bg-gray-100" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="primary" disabled>
              Save as Default
            </Button>
            <Button disabled>Reset to Defaults</Button>
          </div>
        </fieldset>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
        <FilePdfOutlined
          style={{ color: 'var(--cr-warning-500)', fontSize: 14, marginTop: 4, flexShrink: 0 }}
        />
        <p className="m-0 text-[12px] leading-relaxed text-amber-800">
          Controls what appears on <strong>exported PDF documents</strong> - such as salary slips,
          attendance sheets, and payroll reports. These are your workspace-wide defaults and can be
          overridden per export when generating a document.
        </p>
      </div>

      <div className="mb-4 divide-y divide-[var(--cr-border-light)] rounded-lg border border-[var(--cr-border)] bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary-light text-sm text-primary">
            <FileImageOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-medium text-heading">Include Header Logo</p>
            <p className="m-0 text-[11px] text-muted">Show logo at top of PDF exports</p>
          </div>
          <Switch
            size="small"
            aria-label="Include Header Logo on PDF exports"
            checked={includeHeaderLogo}
            onChange={(val) => {
              setIncludeHeaderLogo(val);
              setIsDirty(true);
            }}
          />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary-light text-sm text-primary">
            <FileTextOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-medium text-heading">Include Footer</p>
            <p className="m-0 text-[11px] text-muted">Show company details at bottom of PDFs</p>
          </div>
          <Switch
            size="small"
            aria-label="Include Footer on PDF exports"
            checked={includeFooter}
            onChange={(val) => {
              setIncludeFooter(val);
              setIsDirty(true);
            }}
          />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary-light text-sm text-primary">
            <FileOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-medium text-heading">Include Watermark</p>
            <p className="m-0 text-[11px] text-muted">Show transparent watermark on PDF pages</p>
          </div>
          <Switch
            size="small"
            aria-label="Include Watermark on PDF exports"
            checked={includeWatermark}
            onChange={(val) => {
              setIncludeWatermark(val);
              setIsDirty(true);
            }}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        {isDirty && (
          <span className="mr-auto flex items-center gap-1.5 self-center text-[12px] text-amber-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            Unsaved changes
          </span>
        )}
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
          Save as Default
        </Button>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
