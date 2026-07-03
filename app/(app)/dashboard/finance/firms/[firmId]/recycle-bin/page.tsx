'use client';

import { startTransition, use, useEffect, useState } from 'react';
import { Button, Tabs, Modal, message, Tag } from 'antd';
import { UndoOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import {
  listRecycleBin,
  restoreFromRecycleBin,
  permanentDeleteFromRecycleBin,
} from '@/lib/actions/finance.actions';

type RecordItem = { type: string; record: { _id: string; name: string; deletedAt?: string } };

// Recycle-bin type tabs. Labels resolved via finance.misc.recycleBin.tab at render time
// (key '' = All bucket). Cross-link: finance.actions listRecycleBin type filter.
const TYPE_TAB_KEYS: { key: string; i18n: string }[] = [
  { key: '', i18n: 'all' },
  { key: 'party', i18n: 'parties' },
  { key: 'item', i18n: 'items' },
  { key: 'account', i18n: 'accounts' },
  { key: 'voucher_series', i18n: 'voucherSeries' },
];

export default function RecycleBinPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const { firmId } = use(params);
  const t = useTranslations('finance.misc');
  // tShared only sources the shared list error-state labels (finance.sales.listCommon.*).
  const tShared = useTranslations('finance.sales');

  const [items, setItems] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadBin = (type = activeTab) => {
    if (!wsId) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listRecycleBin(wsId, firmId, type || undefined)
      .then((r) => setItems(r ?? []))
      .catch(() => {
        setItems([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBin();
  }, [wsId, firmId, activeTab]);

  async function handleRestore(item: RecordItem) {
    setActionLoading(item.record._id);
    try {
      await restoreFromRecycleBin(wsId, firmId, item.record._id, item.type);
      message.success(t('recycleBin.restored', { name: item.record.name }));
      loadBin();
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('recycleBin.restoreFailed'));
    } finally {
      setActionLoading(null);
    }
  }

  function handlePermanentDelete(item: RecordItem) {
    Modal.confirm({
      title: t('recycleBin.permanentTitle'),
      content: t('recycleBin.permanentContent', { name: item.record.name }),
      okText: t('recycleBin.permanentOk'),
      okType: 'danger',
      onOk: async () => {
        setActionLoading(item.record._id);
        try {
          await permanentDeleteFromRecycleBin(wsId, firmId, item.record._id, item.type);
          message.success(t('recycleBin.permanentDeleted', { name: item.record.name }));
          loadBin();
        } catch (e: unknown) {
          const err = e as { message?: string };
          message.error(err?.message ?? t('recycleBin.deleteFailed'));
        } finally {
          setActionLoading(null);
        }
      },
    });
  }

  const columns = [
    { title: t('common.name'), dataIndex: ['record', 'name'], key: 'name' },
    {
      title: t('common.type'),
      dataIndex: 'type',
      key: 'type',
      render: (ty: string) => <Tag>{ty}</Tag>,
    },
    {
      title: t('recycleBin.colDeleted'),
      dataIndex: ['record', 'deletedAt'],
      key: 'deletedAt',
      render: (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN') : '-'),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: unknown, record: RecordItem) => (
        <Button.Group>
          <Button
            size="small"
            icon={<UndoOutlined />}
            loading={actionLoading === record.record._id}
            onClick={() => handleRestore(record)}
          >
            {t('common.restore')}
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            loading={actionLoading === record.record._id}
            onClick={() => handlePermanentDelete(record)}
          >
            {t('common.delete')}
          </Button>
        </Button.Group>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('recycleBin.title')}
        icon={<RestOutlined />}
        style={{ marginBottom: 16 }}
        titleAside={<InfoTooltip text={t('recycleBin.infoTooltip')} />}
      />
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k)}
        items={TYPE_TAB_KEYS.map((tab) => ({
          key: tab.key,
          label: t(`recycleBin.tab.${tab.i18n}` as Parameters<typeof t>[0]),
        }))}
      />
      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => loadBin()}
        />
      ) : (
        <DsTable
          dataSource={items}
          columns={columns}
          rowKey={(r: RecordItem) => `${r.type}-${r.record._id}`}
          loading={loading}
          size="small"
        />
      )}
    </div>
  );
}
