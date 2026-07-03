'use client';

/**
 * StorefrontForm - the shared shop field set used by both create (the stores
 * hub modal) and edit (the manage console's Settings tab). The parent owns the
 * action call + result UI. Only `name` is required. Fields are grouped into
 * labelled section cards (Basics / Logo & banner / About / Location) so the form
 * scans cleanly instead of being one long flat column.
 */

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Form, Input, Select } from 'antd';
import DsButton from '@/components/ui/DsButton';
import MediaUploadGrid from '@/components/connect/MediaUploadGrid';
import { LISTING_CATEGORIES } from '../search.types';
import type { Storefront, CreateStorefrontPayload, EntityVisibility } from './entities.types';
import './StorefrontForm.css';

const VISIBILITIES: EntityVisibility[] = ['public', 'connections', 'hidden'];

interface FormValues {
  name: string;
  description?: string;
  categories?: string[];
  district?: string;
  city?: string;
  state?: string;
  visibility?: EntityVisibility;
}

interface Props {
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: CreateStorefrontPayload) => void;
  initial?: Storefront;
  banner?: ReactNode;
  cancelHref?: string;
}

/** A labelled card grouping related fields. */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="cn-storefront-section"
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
        padding: 'var(--cr-space-lg)',
        marginBottom: 'var(--cr-space-md)',
      }}
    >
      <h3
        style={{
          margin: '0 0 var(--cr-space-md)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--cr-text)',
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function StorefrontForm({
  submitLabel,
  submitting,
  onSubmit,
  initial,
  banner,
  cancelHref = '/connect/stores',
}: Props) {
  const t = useTranslations('connect.storefrontAdmin');
  const tSec = useTranslations('connect.storefrontAdmin.section');
  const tCat = useTranslations('connect.search.listing.category');
  const [form] = Form.useForm<FormValues>();
  const selectedCats = (Form.useWatch('categories', form) as string[] | undefined) ?? [];
  const [logo, setLogo] = useState<string[]>(initial?.logo ? [initial.logo] : []);
  const [bannerImg, setBannerImg] = useState<string[]>(initial?.banner ? [initial.banner] : []);

  const initialValues: Partial<FormValues> = initial
    ? {
        name: initial.name,
        description: initial.description,
        categories: initial.categories,
        district: initial.location?.district,
        city: initial.location?.city,
        state: initial.location?.state,
        visibility: initial.visibility,
      }
    : { visibility: 'public' };

  const handleFinish = (v: FormValues) => {
    const payload: CreateStorefrontPayload = { name: v.name.trim() };
    if (v.description?.trim()) payload.description = v.description.trim();
    if (logo[0]) payload.logo = logo[0];
    if (bannerImg[0]) payload.banner = bannerImg[0];
    if (v.categories?.length) payload.categories = v.categories;
    const district = v.district?.trim();
    const city = v.city?.trim();
    const state = v.state?.trim();
    if (district || city || state) payload.location = { district, city, state };
    if (v.visibility) payload.visibility = v.visibility;
    onSubmit(payload);
  };

  return (
    <>
      {banner}
      <Form
        form={form}
        layout="vertical"
        colon={false}
        initialValues={initialValues}
        onFinish={handleFinish}
      >
        <FormSection title={tSec('basics')}>
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
        </FormSection>

        <FormSection title={tSec('branding')}>
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
        </FormSection>

        <FormSection title={tSec('about')}>
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
        </FormSection>

        <FormSection title={t('locationLegend')}>
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
        </FormSection>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DsButton dsVariant="ghost" href={cancelHref}>
            {t('cancel')}
          </DsButton>
          <DsButton dsVariant="primary" htmlType="submit" loading={submitting}>
            {submitLabel}
          </DsButton>
        </div>
      </Form>
    </>
  );
}
