'use client';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Form, Select, Input, message } from 'antd';
import { DsModal } from '@/components/ui/DsModal';
import DsButton from '@/components/ui/DsButton';
import { transferAsset } from '@/lib/actions/finance-fixed-assets.actions';
import { useWorkspaceStore } from '@/lib/store';
import type { FixedAsset } from '@/types';

interface TransferAssetModalProps {
  asset: FixedAsset;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function TransferAssetModal({
  asset,
  open,
  onClose,
  onComplete,
}: TransferAssetModalProps) {
  const t = useTranslations('finance.fixedAssets.actions.transfer');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    let values: { locationId?: string; custodianMemberId?: string; narration?: string };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    if (!values.locationId && !values.custodianMemberId) {
      message.warning(t('needOne'));
      return;
    }

    setLoading(true);
    try {
      await transferAsset(wsId, asset.firmId, asset._id, values);
      message.success(t('success'));
      form.resetFields();
      onComplete();
    } catch {
      message.error(t('failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DsModal
      open={open}
      title={t('title')}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DsButton dsVariant="ghost" onClick={onClose}>
            {t('cancel')}
          </DsButton>
          <DsButton dsVariant="primary" loading={loading} onClick={handleSubmit}>
            {t('transfer')}
          </DsButton>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item label={t('locationLabel')} name="locationId">
          <Select placeholder={t('locationPlaceholder')} allowClear options={[]} showSearch />
        </Form.Item>
        <Form.Item label={t('custodianLabel')} name="custodianMemberId">
          <Select placeholder={t('custodianPlaceholder')} allowClear options={[]} showSearch />
        </Form.Item>
        <Form.Item label={t('narrationLabel')} name="narration">
          <Input.TextArea rows={3} placeholder={t('narrationPlaceholder')} />
        </Form.Item>
      </Form>
    </DsModal>
  );
}
