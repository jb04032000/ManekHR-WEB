'use client';

// Finance branding editor (design spec 2026-06-01 SS2C / SS6.A) - Phase 1 slice 1a.
// First screen that writes `firm.brandProfile`. The voucher print themes
// (lib/finance/print/themes/*) already render these keys; this page is the
// editor. Mirrors components/workspace/BrandingSection.tsx for the image-upload
// UX and app/dashboard/salary/settings for the page chrome.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { App, Button, ColorPicker, Input, Result, Skeleton, Upload } from 'antd';
import {
  BgColorsOutlined,
  BankOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  FileTextOutlined,
  InfoCircleFilled,
  LockOutlined,
  PictureOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { Can } from '@/components/rbac/Can';
import { DsPageHeader } from '@/components/ui';
import { getFirm, updateFirmBranding } from '@/lib/actions/finance.actions';
import { uploadService } from '@/lib/services/upload.service';
import { parseApiError } from '@/lib/utils';
import type { Firm, FirmBrandProfile } from '@/types';

// ---------------------------------------------------------------------------
// Image upload field - mirrors BrandingSection.tsx. Uses next/image for the
// preview (project lints against raw <img>). beforeUpload returns false so AntD
// never auto-POSTs; we push the file through uploadService and store the url.
// ---------------------------------------------------------------------------
function ImageUploadField({
  label,
  hintText,
  uploadingLabel,
  replaceLabel,
  uploadLabel,
  dropHint,
  removeLabel,
  value,
  onChange,
}: {
  label: string;
  hintText: string;
  uploadingLabel: string;
  replaceLabel: string;
  uploadLabel: string;
  dropHint: string;
  removeLabel: string;
  value?: string | null;
  onChange: (url: string | undefined) => void;
}) {
  const { message } = App.useApp();
  const t = useTranslations('finance.branding');
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(
    async (file: File) => {
      const check = uploadService.validateFile(file, ['image/png', 'image/jpeg', 'image/webp'], 2);
      if (!check.valid) {
        message.error(check.error ?? t('uploadError'));
        return;
      }
      setUploading(true);
      try {
        const result = await uploadService.uploadSingle(file, { category: 'branding' });
        onChange(result.url);
      } catch {
        message.error(t('uploadError'));
      } finally {
        setUploading(false);
      }
    },
    [message, onChange, t],
  );

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-[11px] font-normal text-subtle">{hintText}</span>
      </div>
      <Upload
        name="file"
        accept="image/png,image/jpeg,image/webp"
        maxCount={1}
        showUploadList={false}
        beforeUpload={(file) => {
          void handleUpload(file);
          return false;
        }}
      >
        <div
          className={`flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-dashed px-3.5 py-3 transition-colors ${
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
                unoptimized
              />
            ) : (
              <UploadOutlined />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[13px] leading-snug font-medium text-heading">
              {uploading ? uploadingLabel : value ? replaceLabel : uploadLabel}
            </p>
            {!value && !uploading && (
              <p className="m-0 mt-0.5 text-[11.5px] leading-snug text-subtle">{dropHint}</p>
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
              aria-label={removeLabel}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-red-600 transition-colors hover:bg-red-50"
            >
              <DeleteOutlined style={{ fontSize: 13 }} />
            </button>
          )}
        </div>
      </Upload>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small section heading - mirrors the salary settings section chrome.
// ---------------------------------------------------------------------------
function SectionHeading({
  icon,
  label,
  heading,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  heading: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-subtle uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <h2 className="m-0 text-lg font-bold text-heading">{heading}</h2>
      <p className="m-0 text-sm text-subtle">{description}</p>
    </div>
  );
}

const EMPTY_PROFILE: FirmBrandProfile = {};

function BrandingEditor() {
  const t = useTranslations('finance.branding');
  const { message } = App.useApp();
  const params = useParams<{ firmId: string }>();
  const firmId = params?.firmId ?? '';
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firmName, setFirmName] = useState<string>('');
  const [initial, setInitial] = useState<FirmBrandProfile>(EMPTY_PROFILE);
  const [profile, setProfile] = useState<FirmBrandProfile>(EMPTY_PROFILE);

  useEffect(() => {
    if (!wsId || !firmId) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    getFirm(wsId, firmId)
      .then((f: Firm) => {
        if (!active) return;
        const bp = (f?.brandProfile ?? {}) as FirmBrandProfile;
        setFirmName(f?.firmName ?? '');
        setInitial(bp);
        setProfile(bp);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wsId, firmId]);

  const setField = useCallback(
    <K extends keyof FirmBrandProfile>(key: K, val: FirmBrandProfile[K]) => {
      setProfile((current) => ({ ...current, [key]: val }));
    },
    [],
  );

  const isDirty = useMemo(
    () => JSON.stringify(initial) !== JSON.stringify(profile),
    [initial, profile],
  );

  const handleSave = useCallback(async () => {
    if (!wsId || !firmId) return;
    setSaving(true);
    try {
      // Normalise: trim text fields, drop empty strings so the stored profile
      // stays clean (an empty footer should clear, not store '').
      const payload: FirmBrandProfile = {};
      (Object.keys(profile) as (keyof FirmBrandProfile)[]).forEach((key) => {
        const raw = profile[key];
        const trimmed = typeof raw === 'string' ? raw.trim() : raw;
        // Send explicit `null` for cleared fields (empty, undefined, or null) so
        // the key survives JSON.stringify and the backend can $unset it. Sending
        // `undefined` would drop the key from the body, leaving the old value.
        const cleared = trimmed === undefined || trimmed === null || trimmed === '';
        payload[key] = (cleared ? null : trimmed) as FirmBrandProfile[typeof key];
      });
      const updated = await updateFirmBranding(wsId, firmId, payload);
      const next = (updated?.brandProfile ?? payload) as FirmBrandProfile;
      setInitial(next);
      setProfile(next);
      message.success(t('saveSuccess'));
    } catch (error) {
      message.error(parseApiError(error) || t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [wsId, firmId, profile, message, t]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
        <Skeleton active paragraph={{ rows: 2 }} />
        <div className="mt-8 space-y-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} active paragraph={{ rows: 4 }} />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <Result
          status="warning"
          title={t('loadErrorTitle')}
          subTitle={t('loadErrorSubtitle')}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {t('retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <DsPageHeader
        icon={<PictureOutlined />}
        title={t('pageTitle')}
        sub={firmName ? t('pageDescriptionNamed', { firm: firmName }) : t('pageDescription')}
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <InfoCircleFilled
          style={{ color: 'var(--cr-info-500)', fontSize: 14, marginTop: 2, flexShrink: 0 }}
        />
        <p className="m-0 text-[12px] leading-relaxed text-blue-700">{t('introBanner')}</p>
      </div>

      <div className="flex flex-col gap-9">
        {/* Logo + signature */}
        <section className="space-y-4">
          <SectionHeading
            icon={<PictureOutlined />}
            label={t('assets.sectionLabel')}
            heading={t('assets.heading')}
            description={t('assets.description')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImageUploadField
              label={t('assets.logoLabel')}
              hintText={t('assets.logoHint')}
              uploadingLabel={t('upload.uploading')}
              replaceLabel={t('upload.replace')}
              uploadLabel={t('upload.click')}
              dropHint={t('upload.dropHint')}
              removeLabel={t('upload.remove')}
              value={profile.logoUrl}
              onChange={(url) => setField('logoUrl', url)}
            />
            <ImageUploadField
              label={t('assets.signatureLabel')}
              hintText={t('assets.signatureHint')}
              uploadingLabel={t('upload.uploading')}
              replaceLabel={t('upload.replace')}
              uploadLabel={t('upload.click')}
              dropHint={t('upload.dropHint')}
              removeLabel={t('upload.remove')}
              value={profile.signatureUrl}
              onChange={(url) => setField('signatureUrl', url)}
            />
          </div>
        </section>

        {/* Brand colours */}
        <section className="space-y-4">
          <SectionHeading
            icon={<BgColorsOutlined />}
            label={t('colors.sectionLabel')}
            heading={t('colors.heading')}
            description={t('colors.description')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('colors.primaryLabel')}
              </label>
              <div className="flex items-center gap-3">
                <ColorPicker
                  format="hex"
                  disabledAlpha
                  value={profile.primaryColor ?? null}
                  onChange={(_color, css) => setField('primaryColor', css)}
                  showText
                />
                {profile.primaryColor && (
                  <Button
                    type="text"
                    size="small"
                    onClick={() => setField('primaryColor', undefined)}
                  >
                    {t('colors.clear')}
                  </Button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-subtle">{t('colors.primaryHint')}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('colors.accentLabel')}
              </label>
              <div className="flex items-center gap-3">
                <ColorPicker
                  format="hex"
                  disabledAlpha
                  value={profile.accentColor ?? null}
                  onChange={(_color, css) => setField('accentColor', css)}
                  showText
                />
                {profile.accentColor && (
                  <Button
                    type="text"
                    size="small"
                    onClick={() => setField('accentColor', undefined)}
                  >
                    {t('colors.clear')}
                  </Button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-subtle">{t('colors.accentHint')}</p>
            </div>
          </div>
        </section>

        {/* Footer, terms, declaration */}
        <section className="space-y-4">
          <SectionHeading
            icon={<FileTextOutlined />}
            label={t('text.sectionLabel')}
            heading={t('text.heading')}
            description={t('text.description')}
          />
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('text.footerLabel')}
              </label>
              <Input.TextArea
                rows={2}
                maxLength={500}
                showCount
                placeholder={t('text.footerPlaceholder')}
                value={profile.footerText ?? ''}
                onChange={(e) => setField('footerText', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('text.termsLabel')}
              </label>
              <Input.TextArea
                rows={4}
                maxLength={2000}
                showCount
                placeholder={t('text.termsPlaceholder')}
                value={profile.termsAndConditions ?? ''}
                onChange={(e) => setField('termsAndConditions', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('text.declarationLabel')}
              </label>
              <Input.TextArea
                rows={3}
                maxLength={1000}
                showCount
                placeholder={t('text.declarationPlaceholder')}
                value={profile.declaration ?? ''}
                onChange={(e) => setField('declaration', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Bank + UPI */}
        <section className="space-y-4">
          <SectionHeading
            icon={<BankOutlined />}
            label={t('bank.sectionLabel')}
            heading={t('bank.heading')}
            description={t('bank.description')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('bank.upiLabel')}
              </label>
              <Input
                placeholder={t('bank.upiPlaceholder')}
                value={profile.upiId ?? ''}
                onChange={(e) => setField('upiId', e.target.value)}
              />
              <p className="mt-1.5 text-xs text-subtle">{t('bank.upiHint')}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('bank.bankNameLabel')}
              </label>
              <Input
                placeholder={t('bank.bankNamePlaceholder')}
                value={profile.bankName ?? ''}
                onChange={(e) => setField('bankName', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('bank.accountNumberLabel')}
              </label>
              <Input
                placeholder={t('bank.accountNumberPlaceholder')}
                value={profile.bankAccountNumber ?? ''}
                onChange={(e) => setField('bankAccountNumber', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('bank.ifscLabel')}
              </label>
              <Input
                placeholder={t('bank.ifscPlaceholder')}
                value={profile.bankIfsc ?? ''}
                onChange={(e) => setField('bankIfsc', e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </section>

        {/* Save bar */}
        <div className="flex items-center gap-3 border-t border-[var(--cr-border-light)] pt-5">
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!isDirty}
            onClick={handleSave}
          >
            {t('save')}
          </Button>
          {isDirty ? (
            <span className="flex items-center gap-1.5 text-[12px] text-amber-700">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              {t('unsaved')}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[12px] text-subtle">
              <CheckCircleFilled
                style={{ fontSize: 11, color: 'var(--cr-success-500, #10b981)' }}
              />
              {t('allSaved')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// "Managers only" friendly fallback when the caller lacks finance.settings.manage.
function ManagersOnly() {
  const t = useTranslations('finance.branding');
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
      <Result
        icon={<LockOutlined style={{ color: 'var(--cr-text-4)' }} />}
        title={t('noAccessTitle')}
        subTitle={t('noAccessSubtitle')}
      />
    </div>
  );
}

export default function FirmBrandingSettingsPage() {
  return (
    <Can
      path="finance.settings.manage"
      scope="all"
      fallback={<ManagersOnly />}
      showFallbackOnLoading
    >
      <BrandingEditor />
    </Can>
  );
}
