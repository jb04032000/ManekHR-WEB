'use client';

import Image from 'next/image';

import { useState, useMemo } from 'react';
import { Form, Input, Button, App, Upload } from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  InfoCircleFilled,
  LockOutlined,
  SaveOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';
import { updateWorkspaceBranding } from '@/lib/actions/workspaces.actions';
import { uploadService } from '@/lib/services/upload.service';
import type { BrandingAssets } from '@/types';

interface BrandingSectionProps {
  workspaceId: string;
  branding?: BrandingAssets;
  onSave?: (branding: BrandingAssets) => void;
}

function ImageUploadField({
  label,
  tooltip,
  value,
  onChange,
  hintText,
}: {
  label: string;
  tooltip?: string;
  value?: string;
  onChange: (url: string | undefined) => void;
  hintText: string;
}) {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadService.uploadSingle(file, { category: 'branding' });
      onChange(result.url);
    } catch {
      message.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    name: 'file',
    accept: 'image/*',
    maxCount: 1,
    showUploadList: false,
    beforeUpload: (file: File) => {
      handleUpload(file);
      return false; // Prevent default upload behavior
    },
    onRemove: () => {
      onChange(undefined);
    },
  };

  return (
    <Form.Item
      label={
        <span className="inline-flex items-center gap-1.5">
          <span>{label}</span>
          <span className="text-[11px] font-normal text-subtle">· {hintText}</span>
        </span>
      }
      tooltip={tooltip}
      valuePropName="value"
      getValueFromEvent={() => value}
      style={{ marginBottom: 0 }}
    >
      <Upload {...uploadProps}>
        <div
          className={`flex cursor-pointer items-center gap-3.5 rounded-xl border border-dashed px-3.5 py-3 transition-colors ${
            uploading
              ? 'cursor-not-allowed border-primary bg-primary-light opacity-80'
              : value
                ? 'border-gray-200 bg-white hover:border-primary hover:bg-primary-light'
                : 'border-gray-300 hover:border-primary hover:bg-primary-light'
          }`}
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-[18px] text-faint">
            {uploading ? (
              <svg className="h-5 w-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : value ? (
              <Image
                src={value}
                alt={label}
                width={44}
                height={44}
                className="h-full w-full object-contain"
              />
            ) : (
              <UploadOutlined />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[13px] leading-snug font-medium text-heading">
              {uploading ? 'Uploading…' : value ? 'Replace file' : 'Click to upload'}
            </p>
            {!value && !uploading && (
              <p className="m-0 mt-0.5 text-[11.5px] leading-snug text-subtle">or drag & drop</p>
            )}
          </div>
          {value && !uploading && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange(undefined);
              }}
              aria-label="Remove image"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-red-600 transition-colors hover:bg-red-50"
            >
              <DeleteOutlined style={{ fontSize: 13 }} />
            </button>
          )}
        </div>
      </Upload>
    </Form.Item>
  );
}

export function BrandingSection({ workspaceId, branding, onSave }: BrandingSectionProps) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  // AC-3.2 / AC-4.1: narrow selectors. `setCurrentWorkspace` patches the selected
  // workspace's branding in place so the sidebar/switcher logo updates without a
  // refetch; `workspaces` is read only to locate the matching cached doc to merge.
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const { entitlements } = useSubscriptionStore();
  const { message } = App.useApp();
  const hasBrandingAccess =
    !!entitlements &&
    (entitlements.moduleAccess
      ?.find((m) => m.module === 'settings')
      ?.subFeatures?.find((sf) => sf.key === 'pdf_branding')?.access ?? 'locked') !== 'locked';

  // Local state for image values
  const [logoUrl, setLogoUrl] = useState<string | undefined>(branding?.logo);
  const [pdfHeaderUrl, setPdfHeaderUrl] = useState<string | undefined>(branding?.pdfHeaderLogo);
  const [pdfWatermarkUrl, setPdfWatermarkUrl] = useState<string | undefined>(
    branding?.pdfWatermarkLogo,
  );
  // Owner-uploaded ID-card background (light watermark on every employee card).
  const [idCardBgUrl, setIdCardBgUrl] = useState<string | undefined>(branding?.idCardBackground);
  const [footerText, setFooterText] = useState<string>(branding?.pdfFooterDetails ?? '');

  const isDirty = useMemo(
    () =>
      logoUrl !== branding?.logo ||
      pdfHeaderUrl !== branding?.pdfHeaderLogo ||
      pdfWatermarkUrl !== branding?.pdfWatermarkLogo ||
      idCardBgUrl !== branding?.idCardBackground ||
      footerText !== (branding?.pdfFooterDetails ?? ''),
    [logoUrl, pdfHeaderUrl, pdfWatermarkUrl, idCardBgUrl, footerText, branding],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = {
        logo: logoUrl,
        pdfHeaderLogo: pdfHeaderUrl,
        pdfWatermarkLogo: pdfWatermarkUrl,
        idCardBackground: idCardBgUrl,
        pdfFooterDetails: footerText,
      };

      // Clean up old files that were replaced or removed
      const oldFields = [
        { key: 'logo', oldUrl: branding?.logo, newUrl: logoUrl },
        { key: 'pdfHeaderLogo', oldUrl: branding?.pdfHeaderLogo, newUrl: pdfHeaderUrl },
        { key: 'pdfWatermarkLogo', oldUrl: branding?.pdfWatermarkLogo, newUrl: pdfWatermarkUrl },
        { key: 'idCardBackground', oldUrl: branding?.idCardBackground, newUrl: idCardBgUrl },
      ];

      for (const field of oldFields) {
        if (field.oldUrl && field.oldUrl !== field.newUrl) {
          await uploadService.deleteFile(field.oldUrl);
        }
      }

      const res = await updateWorkspaceBranding(workspaceId, values);
      if (res.ok) {
        message.success('Branding saved successfully');

        if (onSave) {
          onSave(values);
        }

        // AC-3.2 / AC-4.2: patch the affected workspace's branding into the store
        // in place so `currentWorkspace.branding` (sidebar/switcher logo) is fresh
        // immediately, without a full `GET /workspaces` refetch. Prefer the live
        // currentWorkspace doc when it is the one being edited; fall back to the
        // cached list entry otherwise (branding can be edited for the active ws only).
        const base =
          currentWorkspace?._id === workspaceId
            ? currentWorkspace
            : workspaces.find((ws) => ws._id === workspaceId);
        if (base) setCurrentWorkspace({ ...base, branding: values });
      } else {
        message.error(res.error || 'Failed to save branding');
      }
    } catch {
      message.error('Failed to save branding');
    } finally {
      setSaving(false);
    }
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
          <Form form={form} layout="vertical" initialValues={branding}>
            <ImageUploadField
              label="Workspace Logo"
              value={logoUrl}
              onChange={setLogoUrl}
              hintText="PNG, JPG, SVG · Max 2 MB · 200×200 px recommended"
            />

            <ImageUploadField
              label="PDF Header Logo"
              value={pdfHeaderUrl}
              onChange={setPdfHeaderUrl}
              hintText="PNG, JPG · Max 2 MB · 600×120 px recommended"
            />

            <ImageUploadField
              label="PDF Watermark"
              tooltip="Transparent PNG, min 300x300px recommended"
              value={pdfWatermarkUrl}
              onChange={setPdfWatermarkUrl}
              hintText="PNG with transparency · Max 2 MB"
            />

            <Form.Item name="pdfFooterDetails" label="PDF Footer Details">
              <Input.TextArea
                placeholder="Company name, address, phone, website..."
                rows={3}
                maxLength={300}
                showCount
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" disabled>
                Save Branding
              </Button>
            </Form.Item>
          </Form>
        </fieldset>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <InfoCircleFilled
          style={{ color: 'var(--cr-info-500)', fontSize: 14, marginTop: 2, flexShrink: 0 }}
        />
        <p className="m-0 text-[12px] leading-relaxed text-blue-700">
          These branding assets appear on all <strong>exported PDFs</strong> - including salary
          slips, attendance reports, and payroll summaries. Upload your logo and company details to
          make every export look professional and on-brand.
        </p>
      </div>
      <Form form={form} layout="vertical" onFinish={handleSave} initialValues={branding}>
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ImageUploadField
            label="Workspace logo"
            value={logoUrl}
            onChange={(v) => setLogoUrl(v)}
            hintText="200×200, ≤2 MB"
          />

          <ImageUploadField
            label="PDF header logo"
            value={pdfHeaderUrl}
            onChange={(v) => setPdfHeaderUrl(v)}
            hintText="600×120, ≤2 MB"
          />

          <ImageUploadField
            label="PDF watermark"
            tooltip="Diagonal watermark applied to body of every PDF page. Use a transparent PNG."
            value={pdfWatermarkUrl}
            onChange={(v) => setPdfWatermarkUrl(v)}
            hintText="PNG with alpha, ≤2 MB"
          />

          <ImageUploadField
            label="ID card background"
            tooltip="Owner-uploaded background printed as a light watermark on every employee ID card. Use a portrait image; lighter images read best."
            value={idCardBgUrl}
            onChange={(v) => setIdCardBgUrl(v)}
            hintText="PNG/JPG, portrait, ≤2 MB"
          />
        </div>

        <Form.Item
          label="PDF footer text"
          rules={[{ max: 300, message: 'Maximum 300 characters allowed' }]}
          style={{ marginBottom: 16 }}
        >
          <Input.TextArea
            placeholder="Company name, address, phone, website..."
            rows={2}
            maxLength={300}
            showCount
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
          />
        </Form.Item>

        <div className="flex items-center gap-3 pt-1">
          <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
            Save Branding
          </Button>
          {isDirty ? (
            <span className="flex items-center gap-1.5 text-[12px] text-amber-700">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              Unsaved changes
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[12px] text-subtle">
              <CheckCircleFilled
                style={{ fontSize: 11, color: 'var(--cr-success-500, #10b981)' }}
              />
              All saved
            </span>
          )}
        </div>
      </Form>
    </div>
  );
}
