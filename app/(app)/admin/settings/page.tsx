'use client';
import { useEffect, useState, useCallback, startTransition } from 'react';
import { Card, Switch, Form, Input, Button, Upload, message, Alert, Spin } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { getAdminSettings, updateAdminSettings } from '@/lib/actions';
import { getAdminBranding, updateAdminBranding } from '@/lib/actions/admin.actions';
import { useTranslations } from 'next-intl';
import { uploadService } from '@/lib/services/upload.service';
import { invalidatePlatformDefaultsCache } from '@/lib/export/brandingCache';
import { parseApiError } from '@/lib/utils';
import { DsCardTitle } from '@/components/ui';
import type { BrandingAssets } from '@/types';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [freeTierEnabled, setFreeTierEnabled] = useState(true);
  const [msgApi, ctx] = message.useMessage();
  // Only the new trial-banner controls are translated (admin.trialBanner.*); the
  // rest of this settings page is still hardcoded English. Keeps all 4 locales in
  // parity for the new keys without touching the existing copy.
  const t = useTranslations('admin');

  // Trial-banner promo control (toggle + optional custom headline). Saved as one
  // form via PATCH /admin/settings { trialBanner }. Drives the "45-day free
  // trial" banner on the in-app + public pricing pages.
  const [trialBannerForm] = Form.useForm();
  const [savingTrialBanner, setSavingTrialBanner] = useState(false);
  // Loaded trial-banner values feed the Form via initialValues, NOT setFieldsValue.
  // The Form only mounts after loading flips false (the early <Spin> return guards
  // it), so calling setFieldsValue during load() warned "useForm not connected".
  const [trialBannerInit, setTrialBannerInit] = useState<{
    enabled: boolean;
    headlineOverride: string;
  }>({ enabled: true, headlineOverride: '' });

  // Branding state
  const [brandingForm] = Form.useForm();
  const [branding, setBranding] = useState<BrandingAssets | undefined>(undefined);
  const [savingBranding, setSavingBranding] = useState(false);

  const load = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const [settings, brandingData] = await Promise.all([
        getAdminSettings(),
        getAdminBranding().catch(() => undefined),
      ]);
      startTransition(() => {
        setFreeTierEnabled(settings.freeTierEnabled);
      });
      // Prefill the trial-banner form via state -> initialValues (default on / no
      // override when absent). The Form mounts only after loading=false, by which
      // time this state is committed, so initialValues are populated on first mount.
      setTrialBannerInit({
        enabled: settings.trialBanner?.enabled ?? true,
        headlineOverride: settings.trialBanner?.headlineOverride ?? '',
      });
      if (brandingData) {
        // branding state -> initialValues on the branding Form (same mount-timing
        // reason). No setFieldsValue here: the Form is not mounted during load().
        setBranding(brandingData);
      }
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [msgApi]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFreeTierToggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      await updateAdminSettings({ freeTierEnabled: enabled });
      setFreeTierEnabled(enabled);
      msgApi.success(
        enabled
          ? 'Free tier enabled - new users will receive a free plan on registration.'
          : 'Free tier disabled - new users will have all features locked until a plan is assigned.',
      );
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  // Save the trial-banner promo settings (toggle + optional custom headline).
  // Sends only the trialBanner field so it never disturbs freeTierEnabled.
  const handleSaveTrialBanner = async (values: { enabled: boolean; headlineOverride?: string }) => {
    setSavingTrialBanner(true);
    try {
      await updateAdminSettings({
        trialBanner: {
          enabled: !!values.enabled,
          headlineOverride: (values.headlineOverride ?? '').trim(),
        },
      });
      msgApi.success(t('trialBanner.saved'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSavingTrialBanner(false);
    }
  };

  const handleSaveBranding = async (values: any) => {
    setSavingBranding(true);
    try {
      // Clean up old files that were replaced or removed
      const fields = ['logo', 'pdfHeaderLogo', 'pdfWatermarkLogo'] as const;
      for (const field of fields) {
        const oldUrl = branding?.[field];
        const newUrl = values[field];
        if (oldUrl && oldUrl !== newUrl) {
          await uploadService.deleteFile(oldUrl);
        }
      }

      await updateAdminBranding(values);
      setBranding(values);
      invalidatePlatformDefaultsCache();
      msgApi.success('Platform branding saved');
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSavingBranding(false);
    }
  };

  const handleClearBranding = async () => {
    setSavingBranding(true);
    try {
      // Delete all uploaded files
      const fields = ['logo', 'pdfHeaderLogo', 'pdfWatermarkLogo'] as const;
      for (const field of fields) {
        if (branding?.[field]) {
          await uploadService.deleteFile(branding[field]!);
        }
      }

      const empty = {
        logo: undefined,
        pdfHeaderLogo: undefined,
        pdfWatermarkLogo: undefined,
        pdfFooterDetails: undefined,
      };
      await updateAdminBranding(empty);
      setBranding(undefined);
      brandingForm.resetFields();
      invalidatePlatformDefaultsCache();
      msgApi.success('Platform branding cleared');
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSavingBranding(false);
    }
  };

  const brandingUploadProps = (fieldName: string) => ({
    accept: 'image/*',
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file: File) => {
      try {
        const result = await uploadService.uploadSingle(file, { category: 'branding' as any });
        brandingForm.setFieldValue(fieldName, result.url);
      } catch {
        msgApi.error('Failed to upload file');
      }
      return Upload.LIST_IGNORE;
    },
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      {ctx}
      <Card title={<DsCardTitle>App Settings</DsCardTitle>}>
        <div className="max-w-xl space-y-6">
          <div className="flex items-center justify-between rounded-[12px] border border-border bg-surface p-4">
            <div className="flex-1 pr-4">
              <div className="font-medium text-heading">Free Tier for New Users</div>
              <div className="mt-1 text-xs text-subtle">
                When enabled, new users automatically receive a free plan on registration. When
                disabled, new users have all features locked until you manually assign a plan.
              </div>
            </div>
            <Switch
              checked={freeTierEnabled}
              onChange={handleFreeTierToggle}
              loading={saving}
              checkedChildren="Enabled"
              unCheckedChildren="Disabled"
            />
          </div>

          {!freeTierEnabled && (
            <Alert
              type="warning"
              showIcon
              title="Free Tier Disabled"
              description="New users created via registration or by admin will have no plan assigned. All features will be locked until you manually assign a plan from the Users page."
            />
          )}
        </div>
      </Card>

      {/* Trial-banner promo control. Toggles + optionally overrides the
          "45-day free trial" banner shown on the in-app + public pricing pages.
          Saved on its own via PATCH /admin/settings { trialBanner }. */}
      <Card title={<DsCardTitle>{t('trialBanner.cardTitle')}</DsCardTitle>} className="mt-6">
        <Form
          form={trialBannerForm}
          layout="vertical"
          onFinish={handleSaveTrialBanner}
          className="max-w-xl"
          initialValues={trialBannerInit}
        >
          <Form.Item
            name="enabled"
            label={t('trialBanner.enabledLabel')}
            tooltip={t('trialBanner.enabledHelp')}
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Enabled"
              unCheckedChildren="Disabled"
              aria-label={t('trialBanner.enabledLabel')}
            />
          </Form.Item>

          <Form.Item
            name="headlineOverride"
            label={t('trialBanner.headlineLabel')}
            help={t('trialBanner.headlineHelp')}
          >
            <Input
              placeholder={t('trialBanner.headlinePlaceholder')}
              maxLength={160}
              showCount
              aria-label={t('trialBanner.headlineLabel')}
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={savingTrialBanner}>
            {t('trialBanner.saveButton')}
          </Button>
        </Form>
      </Card>

      <Card title={<DsCardTitle>Platform Default Branding</DsCardTitle>} className="mt-6">
        <p className="mb-4 text-xs text-subtle">
          Default branding for PDF exports. Workspaces without custom branding will use these
          assets. Leave empty to skip branding entirely.
        </p>
        <Form
          form={brandingForm}
          layout="vertical"
          onFinish={handleSaveBranding}
          className="max-w-xl"
          initialValues={branding ?? {}}
        >
          <Form.Item
            name="logo"
            label="Product Logo"
            tooltip="Default logo when workspace has none"
            // Stop Form.Item injecting `value` (the URL string) into <Upload>, which
            // rejects it (Upload uses `fileList`). The URL is set imperatively in
            // beforeUpload and read via getFieldValue for the preview; display-only
            // getValueProps does not touch the stored value, so it still submits.
            getValueProps={() => ({})}
          >
            <Upload {...brandingUploadProps('logo')}>
              <div className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-primary">
                {brandingForm.getFieldValue('logo') ? (
                  <img
                    src={brandingForm.getFieldValue('logo')}
                    alt="Logo"
                    className="h-full w-full rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <UploadOutlined className="text-2xl text-faint" />
                    <span className="mt-1 text-xs text-subtle">Upload</span>
                  </>
                )}
              </div>
            </Upload>
          </Form.Item>

          <Form.Item
            name="pdfHeaderLogo"
            label="PDF Header Logo"
            tooltip="Default header logo for exported PDFs"
            // Same as logo: keep Form.Item from passing `value` to <Upload>.
            getValueProps={() => ({})}
          >
            <Upload {...brandingUploadProps('pdfHeaderLogo')}>
              <div className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-primary">
                {brandingForm.getFieldValue('pdfHeaderLogo') ? (
                  <img
                    src={brandingForm.getFieldValue('pdfHeaderLogo')}
                    alt="PDF Header"
                    className="h-full w-full rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <UploadOutlined className="text-2xl text-faint" />
                    <span className="mt-1 text-xs text-subtle">Upload</span>
                  </>
                )}
              </div>
            </Upload>
          </Form.Item>

          <Form.Item
            name="pdfWatermarkLogo"
            label="PDF Watermark"
            tooltip="Transparent PNG, min 300x300px recommended"
            // Same as logo: keep Form.Item from passing `value` to <Upload>.
            getValueProps={() => ({})}
          >
            <Upload {...brandingUploadProps('pdfWatermarkLogo')}>
              <div className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-primary">
                {brandingForm.getFieldValue('pdfWatermarkLogo') ? (
                  <img
                    src={brandingForm.getFieldValue('pdfWatermarkLogo')}
                    alt="Watermark"
                    className="h-full w-full rounded-lg object-contain opacity-50"
                  />
                ) : (
                  <>
                    <UploadOutlined className="text-2xl text-faint" />
                    <span className="mt-1 text-xs text-subtle">Upload</span>
                  </>
                )}
              </div>
            </Upload>
          </Form.Item>

          <Form.Item
            name="pdfFooterDetails"
            label="PDF Footer Details"
            rules={[{ max: 300, message: 'Maximum 300 characters' }]}
          >
            <Input.TextArea
              placeholder="Company name, website, address..."
              rows={3}
              maxLength={300}
              showCount
            />
          </Form.Item>

          <div className="flex gap-2">
            <Button type="primary" htmlType="submit" loading={savingBranding}>
              Save Branding
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleClearBranding}
              loading={savingBranding}
            >
              Clear All
            </Button>
          </div>
        </Form>
      </Card>
    </>
  );
}
