'use client';
import React, { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Tag, message, Modal } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import AssetCategoryFormModal from './AssetCategoryFormModal';
import {
  listAssetCategories,
  deleteAssetCategory,
} from '@/lib/actions/finance-fixed-assets.actions';
import { useWorkspaceStore } from '@/lib/store';
import type { AssetCategory } from '@/types';

interface AssetCategoryListProps {
  firmId: string;
}

export default function AssetCategoryList({ firmId }: AssetCategoryListProps) {
  const t = useTranslations('finance.fixedAssets.categories');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AssetCategory | null>(null);

  const fetchCategories = () => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
    });
    listAssetCategories(wsId, firmId)
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, isHydrated, firmId]);

  const handleDelete = (cat: AssetCategory) => {
    Modal.confirm({
      title: t('deleteConfirmTitle', { name: cat.name }),
      content: t('deleteConfirmContent'),
      okText: t('deleteOk'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteAssetCategory(wsId, firmId, cat._id);
          message.success(t('deletedToast'));
          fetchCategories();
        } catch {
          message.error(t('deleteFailed'));
        }
      },
    });
  };

  const columns = [
    {
      title: t('columns.name'),
      dataIndex: 'name',
      key: 'name',
      render: (v: string, r: AssetCategory) => (
        <span>
          {v}{' '}
          {r.isSystem && (
            <Tag color="blue" style={{ fontSize: 11 }}>
              {t('systemTag')}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: t('columns.method'),
      dataIndex: 'depreciationMethod',
      key: 'depreciationMethod',
      render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
    },
    {
      title: t('columns.slmRate'),
      dataIndex: 'slmRate',
      key: 'slmRate',
      align: 'right' as const,
      render: (v?: number) => (v != null ? `${(v * 100).toFixed(2)}%` : '-'),
    },
    {
      title: t('columns.wdvRate'),
      dataIndex: 'wdvRate',
      key: 'wdvRate',
      align: 'right' as const,
      render: (v?: number) => (v != null ? `${(v * 100).toFixed(2)}%` : '-'),
    },
    {
      title: t('columns.usefulLife'),
      dataIndex: 'usefulLifeYears',
      key: 'usefulLifeYears',
      align: 'right' as const,
      render: (v: number) => t('usefulLifeYrs', { years: v }),
    },
    {
      title: t('columns.itActBlock'),
      dataIndex: 'itActBlock',
      key: 'itActBlock',
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('columns.nesd'),
      dataIndex: 'isNesd',
      key: 'isNesd',
      render: (v: boolean) =>
        v ? <Tag color="orange">{t('nesdTag')}</Tag> : <span style={{ color: '#ccc' }}>-</span>,
    },
    {
      title: t('columns.actions'),
      key: 'actions',
      render: (_: unknown, r: AssetCategory) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            onClick={() => {
              setEditing(r);
              setModalOpen(true);
            }}
          >
            {t('edit')}
          </DsButton>
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            disabled={r.isSystem}
            onClick={() => handleDelete(r)}
          >
            {t('delete')}
          </DsButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <DsButton
          dsVariant="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          {t('addButton')}
        </DsButton>
      </div>
      <DsTable
        dataSource={categories}
        columns={columns}
        rowKey="_id"
        loading={loading}
        size="small"
        scrollX={900}
      />
      <AssetCategoryFormModal
        open={modalOpen}
        category={editing}
        firmId={firmId}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setModalOpen(false);
          setEditing(null);
          fetchCategories();
        }}
      />
    </>
  );
}
