'use client';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tooltip, Modal, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';
import { verifyFixedAsset } from '@/lib/actions/finance-fixed-assets.actions';
import { fmt } from '@/lib/utils';
import { useWorkspaceStore } from '@/lib/store';

interface AssetVerifyButtonProps {
  assetId: string;
  firmId: string;
  lastVerifiedAt?: string;
  onVerified: () => void;
}

export default function AssetVerifyButton({
  assetId,
  firmId,
  lastVerifiedAt,
  onVerified,
}: AssetVerifyButtonProps) {
  const t = useTranslations('finance.fixedAssets.actions.verify');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const [loading, setLoading] = useState(false);

  const tooltipText = lastVerifiedAt
    ? t('lastVerified', { date: fmt(lastVerifiedAt) })
    : t('neverVerified');

  const handleVerify = () => {
    Modal.confirm({
      title: t('confirmTitle'),
      content: t('confirmContent'),
      onOk: async () => {
        setLoading(true);
        try {
          await verifyFixedAsset(wsId, firmId, assetId);
          message.success(t('success'));
          onVerified();
        } catch {
          message.error(t('failed'));
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <Tooltip title={tooltipText}>
      <DsButton
        dsVariant="ghost"
        dsSize="sm"
        icon={<CheckCircleOutlined />}
        loading={loading}
        onClick={handleVerify}
      >
        {t('button')}
      </DsButton>
    </Tooltip>
  );
}
