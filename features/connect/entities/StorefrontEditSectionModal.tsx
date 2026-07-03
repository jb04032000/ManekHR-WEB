'use client';

/**
 * StorefrontEditSectionModal - focused per-section editor for the storefront
 * Settings tab. Mirrors the profile's EditSectionModal: one modal switched by a
 * `section` prop, editing just that section's fields, and Save patches ONLY
 * those fields via `updateStorefront` (the backend PATCH is partial, so editing
 * Location never touches the logo, etc.). The parent owns open/close + a
 * `router.refresh()` on save so the read-only cards + console header re-sync.
 */

import { useState } from 'react';
import { Form, Input, Select, message } from 'antd';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui/DsModal';
import DsButton from '@/components/ui/DsButton';
import MediaUploadGrid from '@/components/connect/MediaUploadGrid';
import { LISTING_CATEGORIES } from '../search.types';
import { updateStorefront } from './storefront.actions';
import type { Storefront, CreateStorefrontPayload, EntityVisibility } from './entities.types';

export type StorefrontSection = 'basics' | 'branding' | 'about' | 'location';

const VISIBILITIES: EntityVisibility[] = ['public', 'connections', 'hidden'];

interface FormValues {
  name?: string;
  visibility?: EntityVisibility;
  description?: string;
  categories?: string[];
  district?: string;
  city?: string;
  state?: string;
}

interface Props {
  open: boolean;
  section: StorefrontSection;
  storefront: Storefront;
  /** Called after a successful save (parent closes + refreshes). */
  onSaved: () => void;
  onClose: () => void;
}

export default function StorefrontEditSectionModal({
  open,
  section,
  storefront,
  onSaved,
  onClose,
}: Props) {
  const t = useTranslations('connect.storefrontAdmin');
  const tSec = useTranslations('connect.storefrontAdmin.section');
  const tCat = useTranslations('connect.search.listing.category');
  const [msgApi, msgCtx] = message.useMessage();
  const [form] = Form.useForm<FormValues>();
  const selectedCats = (Form.useWatch('categories', form) as string[] | undefined) ?? [];
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState<string[]>(storefront.logo ? [storefront.logo] : []);
  const [bannerImg, setBannerImg] = useState<string[]>(
    storefront.banner ? [storefront.banner] : [],
  );

  const title = section === 'location' ? t('locationLegend') : tSec(section);

  const initialValues: Partial<FormValues> = {
    name: storefront.name,
    visibility: storefront.visibility,
    description: storefront.description,
    categories: storefront.categories,
    district: storefront.location?.district,
    city: storefront.location?.city,
    state: storefront.location?.state,
  };

  const handleFinish = async (v: FormValues) => {
    setSaving(true);
    try {
      // Build a partial payload with ONLY this section's fields.
      const payload: Partial<CreateStorefrontPayload> = {};
      if (section === 'basics') {
        payload.name = (v.name ?? '').trim();
        if (v.visibility) payload.visibility = v.visibility;
      } else if (section === 'branding') {
        payload.logo = logo[0] ?? '';
        payload.banner = bannerImg[0] ?? '';
      } else if (section === 'about') {
        payload.description = (v.description ?? '').trim();
        payload.categories = v.categories ?? [];
      } else {
        payload.location = {
          district: (v.district ?? '').trim(),
          city: (v.city ?? '').trim(),
          state: (v.state ?? '').trim(),
        };
      }
      const res = await updateStorefront(storefront._id, payload);
      if (res.ok) {
        msgApi.success(t('updateSuccess'));
        onSaved();
      } else {
        msgApi.error(res.error);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <DsModal
      open={open}
      title={title}
      onCancel={() => (saving ? undefined : onClose())}
      footer={null}
      destroyOnHidden
      width={section === 'branding' ? 560 : 480}
      mask={{ closable: !saving }}
      keyboard={!saving}
    >
      {msgCtx}
      <Form
        form={form}
        layout="vertical"
        colon={false}
        initialValues={initialValues}
        onFinish={handleFinish}
        disabled={saving}
      >
        {section === 'basics' && (
          <>
            <Form.Item
              label={t('nameLabel')}
              name="name"
              rules={[
                { required: true, message: t('nameRequired') },
                { max: 160, message: t('nameTooLong') },
              ]}
            >
              <Input maxLength={160} placeholder={t('namePlaceholder')} />
            </Form.Item>
            <Form.Item label={t('visibilityLabel')} name="visibility">
              <Select
                options={VISIBILITIES.map((v) => ({ label: t(`visibility.${v}`), value: v }))}
              />
            </Form.Item>
          </>
        )}

        {section === 'branding' && (
          <>
            <Form.Item label={t('logoLabel')}>
              <MediaUploadGrid
                mediaKind="image"
                max={1}
                initialUrls={logo}
                onChange={setLogo}
                singleAspect="square"
              />
            </Form.Item>
            <Form.Item label={t('bannerLabel')}>
              <MediaUploadGrid
                mediaKind="image"
                max={1}
                initialUrls={bannerImg}
                onChange={setBannerImg}
                singleAspect="wide"
              />
            </Form.Item>
          </>
        )}

        {section === 'about' && (
          <>
            <Form.Item
              label={t('descriptionLabel')}
              name="description"
              extra={t('descriptionHelp')}
              rules={[{ max: 5000, message: t('descriptionTooLong') }]}
            >
              <Input.TextArea
                rows={4}
                maxLength={5000}
                showCount
                placeholder={t('descriptionPlaceholder')}
              />
            </Form.Item>
            <Form.Item label={t('categoriesLabel')} name="categories" style={{ marginBottom: 6 }}>
              <Select mode="tags" allowClear placeholder={t('categoriesPlaceholder')} />
            </Form.Item>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--cr-text-4)' }}>
                {t('categoriesSuggested')}
              </span>
              {LISTING_CATEGORIES.map((c) => {
                const label = tCat(c);
                if (selectedCats.includes(label)) return null;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => form.setFieldValue('categories', [...selectedCats, label])}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid var(--cr-border)',
                      background: 'var(--cr-surface)',
                      borderRadius: 999,
                      padding: '2px 10px',
                      fontSize: 12,
                      color: 'var(--cr-text-2)',
                    }}
                  >
                    + {label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {section === 'location' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
            <Form.Item style={{ flex: '1 1 150px' }} label={t('districtLabel')} name="district">
              <Input maxLength={120} placeholder={t('districtPlaceholder')} />
            </Form.Item>
            <Form.Item style={{ flex: '1 1 150px' }} label={t('cityLabel')} name="city">
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item style={{ flex: '1 1 150px' }} label={t('stateLabel')} name="state">
              <Input maxLength={120} />
            </Form.Item>
          </div>
        )}

        <div
          className="mt-4 flex justify-end gap-2 border-t pt-4"
          style={{ borderColor: 'var(--cr-border)' }}
        >
          <DsButton dsVariant="ghost" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </DsButton>
          <DsButton dsVariant="primary" htmlType="submit" loading={saving}>
            {t('save')}
          </DsButton>
        </div>
      </Form>
    </DsModal>
  );
}
