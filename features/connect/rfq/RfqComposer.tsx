'use client';

/**
 * RfqComposer - the "Post a request" modal a buyer uses to put an RFQ on the
 * board. Reuses the listing category/unit option sets so an RFQ speaks the same
 * taxonomy as the catalogue. The parent owns the action call + the resulting
 * navigation / refresh.
 *
 * Category is a preset-OR-custom combobox (TagComboField, mirrors the jobs
 * post-a-job + listing-form category fields): the buyer picks one of the known
 * LISTING_CATEGORIES or types their own, suggested from the shared ConnectTag
 * pool (GET /connect/tags/search) so two buyers do not coin "dyeing" vs "dying".
 * The committed value is one canonical string; the BE folds a custom term into
 * the pool via TagService (RfqService.createRfq) so it self-registers + becomes
 * searchable. Keep in sync with features/connect/jobs/JobComposer TagComboField.
 */

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Form, Input, InputNumber, Select, DatePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import DsButton from '@/components/ui/DsButton';
import { LISTING_CATEGORIES } from '../search.types';
import { LISTING_UNITS, type ListingUnit } from '../marketplace/marketplace.types';
import { searchTags } from '../marketplace/tag.actions';
import type { CreateRfqPayload } from './rfq.types';

interface FormValues {
  title: string;
  /** A known slug or a custom term (TagComboField emits one canonical string). */
  category: string;
  description?: string;
  quantity?: number;
  unit?: ListingUnit;
  budgetMin?: number;
  budgetMax?: number;
  neededBy?: Dayjs;
  district?: string;
  city?: string;
  state?: string;
}

/**
 * A single-select combobox that offers the known presets AND lets the buyer
 * type their own category, suggesting matches from the shared ConnectTag pool
 * (GET /connect/tags/search, the same source jobs + listings use). The
 * committed value is one canonical string; the BE folds a custom term to a slug
 * via TagService. Bound to the wrapping Form.Item via value / onChange. AntD
 * tags-mode models a single value as a one-element array (maxCount 1).
 * Copied from JobComposer.TagComboField - keep the two in sync.
 */
function TagComboField({
  value,
  onChange,
  placeholder,
  presets,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder: string;
  presets: { label: string; value: string }[];
}) {
  const [suggested, setSuggested] = useState<{ label: string; value: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = q.trim();
    if (!term) {
      setSuggested([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await searchTags(term);
      if (res.ok) {
        const presetValues = new Set(presets.map((p) => p.value));
        setSuggested(
          res.data
            .filter((s) => !presetValues.has(s.slug))
            .map((s) => ({ label: s.label, value: s.slug })),
        );
      }
    }, 250);
  };

  const selected = value ? [value] : [];
  return (
    <Select
      mode="tags"
      maxCount={1}
      showSearch
      tokenSeparators={[',']}
      value={selected}
      placeholder={placeholder}
      onSearch={handleSearch}
      onChange={(vals: string[]) => onChange?.(vals[vals.length - 1] ?? '')}
      options={[...presets, ...suggested]}
      style={{ width: '100%' }}
    />
  );
}

interface Props {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateRfqPayload) => void;
}

export default function RfqComposer({ open, submitting, onClose, onSubmit }: Props) {
  const t = useTranslations('connect.rfq');
  const tCat = useTranslations('connect.search.listing.category');
  const tUnit = useTranslations('connect.marketplace.detail.units');
  const [form] = Form.useForm<FormValues>();

  const handleFinish = (v: FormValues) => {
    const payload: CreateRfqPayload = { title: v.title.trim(), category: v.category.trim() };
    if (v.description?.trim()) payload.description = v.description.trim();
    if (v.quantity != null) payload.quantity = v.quantity;
    if (v.unit) payload.unit = v.unit;
    if (v.budgetMin != null) payload.budgetMin = v.budgetMin;
    if (v.budgetMax != null) payload.budgetMax = v.budgetMax;
    if (v.neededBy) payload.neededBy = v.neededBy.toISOString();
    const district = v.district?.trim();
    const city = v.city?.trim();
    const state = v.state?.trim();
    if (district || city || state) payload.location = { district, city, state };
    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('composerTitle')}
      footer={null}
      destroyOnHidden
      // Dismiss ONLY via the close icon or Cancel (not an outside/mask click),
      // so a half-filled request is never lost by a stray backdrop tap. v6 uses
      // the `mask.closable` object form (`maskClosable` is deprecated).
      mask={{ closable: false }}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <Form form={form} layout="vertical" colon={false} onFinish={handleFinish} preserve={false}>
        <Form.Item
          label={t('titleLabel')}
          name="title"
          rules={[
            { required: true, message: t('titleRequired') },
            { max: 160, message: t('titleTooLong') },
          ]}
        >
          <Input maxLength={160} placeholder={t('titlePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('categoryLabel')}
          name="category"
          // TagComboField emits the canonical string via onChange, which Form
          // stores directly; "" (cleared) trips the required rule.
          rules={[{ required: true, message: t('categoryRequired') }]}
        >
          <TagComboField
            placeholder={t('categoryPlaceholder')}
            presets={LISTING_CATEGORIES.map((c) => ({ label: tCat(c), value: c }))}
          />
        </Form.Item>

        <Form.Item label={t('descriptionLabel')} name="description" rules={[{ max: 5000 }]}>
          <Input.TextArea
            rows={4}
            maxLength={5000}
            showCount
            placeholder={t('descriptionPlaceholder')}
          />
        </Form.Item>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
          <Form.Item style={{ flex: '1 1 140px' }} label={t('quantityLabel')} name="quantity">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <Form.Item style={{ flex: '1 1 140px' }} label={t('unitLabel')} name="unit">
            <Select
              allowClear
              placeholder={t('unitPlaceholder')}
              options={LISTING_UNITS.map((u) => ({ label: tUnit(u), value: u }))}
            />
          </Form.Item>
        </div>

        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {t('budgetLegend')}
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('budgetMinLabel')} name="budgetMin">
              <InputNumber min={0} style={{ width: '100%' }} prefix="₹" placeholder="0" />
            </Form.Item>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('budgetMaxLabel')} name="budgetMax">
              <InputNumber min={0} style={{ width: '100%' }} prefix="₹" placeholder="0" />
            </Form.Item>
          </div>
        </fieldset>

        <Form.Item label={t('neededByLabel')} name="neededBy">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {t('locationLegend')}
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('districtLabel')} name="district">
              <Input maxLength={120} placeholder={t('districtPlaceholder')} />
            </Form.Item>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('cityLabel')} name="city">
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('stateLabel')} name="state">
              <Input maxLength={120} />
            </Form.Item>
          </div>
        </fieldset>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <DsButton dsVariant="ghost" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </DsButton>
          <DsButton dsVariant="primary" htmlType="submit" loading={submitting}>
            {t('post')}
          </DsButton>
        </div>
      </Form>
    </Modal>
  );
}
