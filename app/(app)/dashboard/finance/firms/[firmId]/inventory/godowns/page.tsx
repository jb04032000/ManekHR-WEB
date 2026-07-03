'use client';
// Finance polish (inventory): i18n via finance.inventory.godowns; DsPageHeader title + Add
// action; InfoTooltip explains the godown concept. No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HomeOutlined } from '@ant-design/icons';
import { Tag, Popconfirm, message, Modal, Alert, Spin } from 'antd';
import { DsTable } from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { useWorkspaceStore } from '@/lib/store';
import { listGodowns, deleteGodown } from '@/lib/actions/inventory.actions';
import type { Godown } from '@/types';
import { GodownDrawer } from '@/components/finance/inventory/GodownDrawer';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function GodownsPage() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const router = useRouter();
  const t = useTranslations('finance.inventory');
  const tShared = useTranslations('finance.sales'); // shared list-page labels (error state)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');

  const [rows, setRows] = useState<Godown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Godown | null>(null);

  const reload = () => {
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listGodowns(wsId, firmId)
      .then(setRows)
      .catch(() => {
        setRows([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (wsId && firmId && !inventoryAccess.isLocked) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, firmId, inventoryAccess.isLocked, reloadKey]);

  const handleDelete = async (godown: Godown) => {
    try {
      await deleteGodown(wsId, firmId, godown._id);
      message.success(t('godowns.deleteSuccess', { name: godown.name }));
      reload();
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string }; status?: number };
        message?: string;
      };
      const msg = e?.response?.data?.message || e?.message || t('godowns.deleteFailed');
      // If conflict - show modal with detailed message instead of toast
      if (msg.includes('Cannot delete') || e?.response?.status === 409) {
        Modal.error({
          title: t('godowns.cannotDeleteTitle'),
          content: <Alert type="error" title={msg} showIcon />,
          okText: t('godowns.close'),
        });
      } else {
        message.error(msg);
      }
    }
  };

  const columns = [
    {
      title: t('godowns.colCode'),
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: t('godowns.colName'),
      dataIndex: 'name',
      key: 'name',
      render: (v: string, row: Godown) => (
        <a
          onClick={() =>
            router.push(`/dashboard/finance/firms/${firmId}/inventory/godowns/${row._id}`)
          }
        >
          {v}{' '}
          {row.isDefault && (
            <Tag color="blue" style={{ marginLeft: 4 }}>
              {t('godowns.defaultTag')}
            </Tag>
          )}
        </a>
      ),
    },
    { title: t('godowns.colAddress'), dataIndex: 'address', key: 'address', ellipsis: true },
    {
      title: t('godowns.colContact'),
      key: 'contact',
      render: (_: unknown, r: Godown) =>
        r.contactPerson ? `${r.contactPerson}${r.contactPhone ? ` (${r.contactPhone})` : ''}` : '-',
    },
    {
      title: t('listCommon.status'),
      key: 'status',
      width: 100,
      render: (_: unknown, r: Godown) => (
        <Tag color={r.isActive ? 'green' : 'default'}>
          {r.isActive ? t('godowns.active') : t('godowns.inactive')}
        </Tag>
      ),
    },
    {
      title: t('listCommon.actions'),
      key: 'actions',
      width: 200,
      render: (_: unknown, r: Godown) => (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <a
            onClick={() => {
              setEditing(r);
              setDrawerOpen(true);
            }}
          >
            {t('listCommon.edit')}
          </a>
          {!r.isDefault && (
            <Popconfirm
              title={t('godowns.deleteConfirmTitle', { name: r.name })}
              description={t('godowns.deleteConfirmDesc')}
              okText={t('godowns.deleteOk')}
              cancelText={t('listCommon.cancel')}
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(r)}
            >
              <a style={{ color: 'var(--cr-error)' }}>{t('listCommon.delete')}</a>
            </Popconfirm>
          )}
        </span>
      ),
    },
  ];

  if (inventoryAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (inventoryAccess.isLocked) {
    return <ModuleLockedPage module="inventory" />;
  }

  return (
    <div className="p-6">
      <DsPageHeader
        title={t('godowns.title')}
        icon={<HomeOutlined />}
        titleAside={<InfoTooltip text={t('godowns.tip')} />}
        style={{ marginBottom: 16 }}
        right={
          <DsButton
            dsVariant="primary"
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            {t('godowns.add')}
          </DsButton>
        }
      />

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : !loading && rows.length === 0 ? (
        <EmptyStateLayout
          icon={<HomeOutlined />}
          title={t('godowns.emptyTitle')}
          description={t('godowns.emptyBody')}
        />
      ) : !loading && rows.length === 1 && rows[0].isDefault ? (
        <>
          <Alert
            type="info"
            title={t('godowns.defaultHint')}
            showIcon
            style={{ marginBottom: 16 }}
          />
          <DsTable
            columns={columns}
            dataSource={rows}
            rowKey="_id"
            loading={loading}
            pagination={{ defaultPageSize: 15 }}
          />
        </>
      ) : (
        <DsTable
          columns={columns}
          dataSource={rows}
          rowKey="_id"
          loading={loading}
          pagination={{ defaultPageSize: 15, showSizeChanger: true }}
        />
      )}

      <GodownDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={reload}
        workspaceId={wsId}
        firmId={firmId}
        initial={editing}
      />
    </div>
  );
}
