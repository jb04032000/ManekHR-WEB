'use client';
import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Form, Input, Select, InputNumber, Checkbox, message } from 'antd';
import { DsModal } from '@/components/ui/DsModal';
import DsButton from '@/components/ui/DsButton';
import {
  createAssetCategory,
  updateAssetCategory,
} from '@/lib/actions/finance-fixed-assets.actions';
import { useWorkspaceStore } from '@/lib/store';
import type { AssetCategory } from '@/types';

interface AssetCategoryFormModalProps {
  open: boolean;
  category?: AssetCategory | null;
  firmId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AssetCategoryFormModal({
  open,
  category,
  firmId,
  onClose,
  onSaved,
}: AssetCategoryFormModalProps) {
  const t = useTranslations('finance.fixedAssets.categories');
  const tForm = useTranslations('finance.fixedAssets.form');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isEdit = !!category;

  const ACCOUNT_OPTIONS = [
    { value: '1501', label: t('modal.accounts.1501') },
    { value: '1502', label: t('modal.accounts.1502') },
    { value: '1503', label: t('modal.accounts.1503') },
    { value: '1504', label: t('modal.accounts.1504') },
    { value: '1510', label: t('modal.accounts.1510') },
  ];
  const DEPRECIATION_METHOD_OPTIONS = [
    { value: 'slm', label: tForm('method.slm') },
    { value: 'wdv', label: tForm('method.wdv') },
  ];

  useEffect(() => {
    if (open && category) {
      form.setFieldsValue(category);
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({ depreciationMethod: 'slm', residualValuePct: 0.05, isNesd: false });
    }
  }, [open, category, form]);

  const handleSubmit = async () => {
    let values: Partial<AssetCategory>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setLoading(true);
    try {
      if (isEdit && category) {
        await updateAssetCategory(wsId, firmId, category._id, values);
        message.success(t('modal.updatedToast'));
      } else {
        await createAssetCategory(wsId, firmId, values);
        message.success(t('modal.createdToast'));
      }
      onSaved();
    } catch {
      message.error(t('modal.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DsModal
      open={open}
      title={isEdit ? t('modal.editTitle') : t('modal.newTitle')}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DsButton dsVariant="ghost" onClick={onClose}>
            {t('modal.cancel')}
          </DsButton>
          <DsButton dsVariant="primary" loading={loading} onClick={handleSubmit}>
            {isEdit ? t('modal.saveChanges') : t('modal.createCategory')}
          </DsButton>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t('modal.fields.name')}
          name="name"
          rules={[{ required: true, message: t('modal.validation.nameRequired') }]}
        >
          <Input placeholder={t('modal.placeholders.name')} />
        </Form.Item>

        <Form.Item label={t('modal.fields.description')} name="description">
          <Input.TextArea rows={2} placeholder={t('modal.placeholders.description')} />
        </Form.Item>

        <Form.Item
          label={t('modal.fields.accountCode')}
          name="accountCode"
          rules={[{ required: true, message: t('modal.validation.accountRequired') }]}
        >
          <Select options={ACCOUNT_OPTIONS} placeholder={t('modal.placeholders.accountCode')} />
        </Form.Item>

        <Form.Item
          label={t('modal.fields.method')}
          name="depreciationMethod"
          rules={[{ required: true }]}
        >
          <Select options={DEPRECIATION_METHOD_OPTIONS} />
        </Form.Item>

        <Form.Item
          label={t('modal.fields.slmRate')}
          name="slmRate"
          rules={[{ type: 'number', min: 0, max: 1, message: t('modal.validation.rateRange') }]}
        >
          <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.01} precision={4} />
        </Form.Item>

        <Form.Item
          label={t('modal.fields.wdvRate')}
          name="wdvRate"
          rules={[{ type: 'number', min: 0, max: 1, message: t('modal.validation.rateRange') }]}
        >
          <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.01} precision={4} />
        </Form.Item>

        <Form.Item
          label={t('modal.fields.usefulLife')}
          name="usefulLifeYears"
          rules={[
            { required: true },
            { type: 'number', min: 1, max: 100, message: t('modal.validation.usefulLifeRange') },
          ]}
        >
          <InputNumber style={{ width: '100%' }} min={1} max={100} />
        </Form.Item>

        <Form.Item
          label={t('modal.fields.residualValue')}
          name="residualValuePct"
          rules={[{ type: 'number', min: 0, max: 1, message: t('modal.validation.residualRange') }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={1}
            step={0.01}
            precision={4}
            placeholder="0.05"
          />
        </Form.Item>

        <Form.Item label={t('modal.fields.itActBlock')} name="itActBlock">
          <Input placeholder={t('modal.placeholders.itActBlock')} />
        </Form.Item>

        <Form.Item
          label={t('modal.fields.itActRate')}
          name="itActRate"
          rules={[{ type: 'number', min: 0, max: 1 }]}
        >
          <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.01} precision={4} />
        </Form.Item>

        <Form.Item name="isNesd" valuePropName="checked">
          <Checkbox>{t('modal.nesdLabel')}</Checkbox>
        </Form.Item>
      </Form>
    </DsModal>
  );
}
