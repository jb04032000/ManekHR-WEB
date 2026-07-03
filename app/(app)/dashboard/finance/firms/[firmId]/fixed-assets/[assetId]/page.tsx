'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton, Spin, Typography, Tag, Space, message, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, SwapOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import {
  getFixedAsset,
  deleteFixedAsset,
  updateFixedAsset,
} from '@/lib/actions/finance-fixed-assets.actions';
import DsButton from '@/components/ui/DsButton';
import FixedAssetForm from '@/components/finance/fixed-assets/FixedAssetForm';
import FixedAssetDetailDrawer from '@/components/finance/fixed-assets/FixedAssetDetailDrawer';
import DisposalWorkflowModal from '@/components/finance/fixed-assets/DisposalWorkflowModal';
import TransferAssetModal from '@/components/finance/fixed-assets/TransferAssetModal';
import type { FixedAsset } from '@/types';
import { formatCurrencyFull } from '@/lib/utils';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const STATUS_COLOR: Record<string, string> = {
  active: 'success',
  disposed: 'default',
  scrapped: 'error',
  transferred: 'processing',
};

const formatPaise = (v: number) => formatCurrencyFull(v / 100);

export default function FixedAssetDetailPage() {
  const { firmId, assetId } = useParams<{ firmId: string; assetId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.fixedAssets.detail');
  const tStatus = useTranslations('finance.fixedAssets.status');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

  const [asset, setAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchAsset = () => {
    if (!wsId || !isHydrated || financeAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
    });
    getFixedAsset(wsId, firmId, assetId)
      .then(setAsset)
      .catch(() => setAsset(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAsset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, isHydrated, firmId, assetId, financeAccess.isLocked]);

  if (!isHydrated || loading) return <Skeleton active style={{ padding: 24 }} />;
  if (!asset) return <div style={{ padding: 24 }}>{t('notFound')}</div>;

  const handleDelete = () => {
    Modal.confirm({
      title: t('deleteConfirmTitle', { code: asset.assetCode }),
      okText: t('deleteOk'),
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteFixedAsset(wsId, firmId, assetId);
        message.success(t('deletedToast'));
        router.push(`/dashboard/finance/firms/${firmId}/fixed-assets`);
      },
    });
  };

  const handleUpdate = async (values: Partial<FixedAsset>) => {
    await updateFixedAsset(wsId, firmId, assetId, values);
    message.success(t('updatedToast'));
    setEditMode(false);
    fetchAsset();
  };

  if (financeAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (financeAccess.isLocked) {
    return <ModuleLockedPage module="finance" />;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Typography.Text code>{asset.assetCode}</Typography.Text>
            <Typography.Title level={1} style={{ margin: 0, fontSize: 22 }}>
              {asset.name}
            </Typography.Title>
            <Tag color={STATUS_COLOR[asset.status] ?? 'default'}>{tStatus(asset.status)}</Tag>
            {asset.isFullyDepreciated && <Tag color="gold">{t('fullyDepreciated')}</Tag>}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {t('nbvLabel')}{' '}
            <strong style={{ color: 'var(--cr-primary)' }}>{formatPaise(asset.nbvPaise)}</strong>
          </Typography.Text>
        </div>
        <Space>
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            icon={<EditOutlined />}
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? t('cancelEdit') : t('edit')}
          </DsButton>
          {asset.status === 'active' && (
            <>
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                icon={<MinusCircleOutlined />}
                onClick={() => setDisposeOpen(true)}
              >
                {t('dispose')}
              </DsButton>
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                icon={<SwapOutlined />}
                onClick={() => setTransferOpen(true)}
              >
                {t('transfer')}
              </DsButton>
            </>
          )}
          <DsButton dsVariant="ghost" dsSize="sm" icon={<DeleteOutlined />} onClick={handleDelete}>
            {t('delete')}
          </DsButton>
          <DsButton dsVariant="primary" dsSize="sm" onClick={() => setDrawerOpen(true)}>
            {t('fullDetails')}
          </DsButton>
        </Space>
      </div>

      {editMode ? (
        <FixedAssetForm mode="edit" firmId={firmId} initialValues={asset} onSubmit={handleUpdate} />
      ) : (
        <FixedAssetDetailDrawer
          assetId={assetId}
          firmId={firmId}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onRefresh={fetchAsset}
        />
      )}

      {disposeOpen && (
        <DisposalWorkflowModal
          asset={asset}
          open={disposeOpen}
          onClose={() => setDisposeOpen(false)}
          onComplete={() => {
            setDisposeOpen(false);
            fetchAsset();
          }}
        />
      )}

      {transferOpen && (
        <TransferAssetModal
          asset={asset}
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          onComplete={() => {
            setTransferOpen(false);
            fetchAsset();
          }}
        />
      )}
    </div>
  );
}
