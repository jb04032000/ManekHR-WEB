'use client';
// Finance polish (items): i18n via finance.items.master; DsPageHeader title + Add action +
// InfoTooltip on HSN/SAC and batch tracking. The add-item drawer form labels are localised.
// No data/columns logic changed.
import { startTransition, use, useEffect, useState } from 'react';
import { Button, Drawer, Form, Input, Select, Switch, Tag, message } from 'antd';
import { PlusOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { useWorkspaceStore } from '@/lib/store';
import { listItems, createItem } from '@/lib/actions/finance.actions';
import type { FinanceItem } from '@/types';

const GST_RATES = [0, 5, 12, 18, 28].map((r) => ({ value: r, label: `${r}%` }));
const COMMON_UNITS = [
  'PCS',
  'MTR',
  'KG',
  'NOS',
  'BOX',
  'THAAN',
  'BARDAAN',
  'DOZ',
  'LTR',
  'SQM',
].map((u) => ({ value: u, label: u }));

export default function ItemsPage({ params }: { params: Promise<{ firmId: string }> }) {
  const t = useTranslations('finance.items');
  // tShared only sources the shared list error-state labels (finance.sales.listCommon.*).
  const tShared = useTranslations('finance.sales');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const { firmId } = use(params);

  const [items, setItems] = useState<FinanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [watchItemType, setWatchItemType] = useState<string>('goods');
  const [form] = Form.useForm();

  const loadItems = () => {
    if (!wsId) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listItems(wsId, firmId)
      .then((i) => setItems(i ?? []))
      .catch(() => {
        setItems([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, [wsId, firmId]);

  async function handleSave(values: Record<string, unknown>) {
    setSaving(true);
    try {
      await createItem(wsId, firmId, values as Partial<FinanceItem>);
      message.success(t('master.createSuccess'));
      setDrawerOpen(false);
      form.resetFields();
      loadItems();
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('master.createFailed'));
    } finally {
      setSaving(false);
    }
  }

  // Item type render uses `it` (not `t`) to avoid shadowing the next-intl translator.
  const columns = [
    { title: t('master.colName'), dataIndex: 'name', key: 'name' },
    {
      title: t('master.colCode'),
      dataIndex: 'itemCode',
      key: 'itemCode',
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('master.colType'),
      dataIndex: 'itemType',
      key: 'itemType',
      render: (it: string) => <Tag color={it === 'goods' ? 'blue' : 'green'}>{it}</Tag>,
    },
    {
      title: t('master.colHsnSac'),
      dataIndex: 'hsnSacCode',
      key: 'hsnSacCode',
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('master.colGstRate'),
      dataIndex: 'gstRate',
      key: 'gstRate',
      render: (v: number) => `${v}%`,
    },
    { title: t('master.colUnit'), dataIndex: 'unit', key: 'unit' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('master.title')}
        icon={<AppstoreOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            {t('master.add')}
          </Button>
        }
      />
      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={loadItems}
        />
      ) : (
        <DsTable dataSource={items} columns={columns} rowKey="_id" loading={loading} size="small" />
      )}
      <Drawer
        title={t('master.drawerTitle')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ wrapper: { width: 480 } }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)} style={{ marginRight: 8 }}>
              {t('master.cancel')}
            </Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              {t('master.save')}
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          onValuesChange={(v: Record<string, unknown>) => {
            if (v.itemType) setWatchItemType(v.itemType as string);
          }}
        >
          <Form.Item
            label={t('master.fieldItemType')}
            name="itemType"
            rules={[{ required: true }]}
            initialValue="goods"
          >
            <Select
              options={[
                { value: 'goods', label: t('master.typeGoods') },
                { value: 'services', label: t('master.typeServices') },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('master.fieldName')} name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('master.fieldItemCode')} name="itemCode">
            <Input placeholder={t('master.itemCodePlaceholder')} />
          </Form.Item>
          <Form.Item
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {t('master.fieldHsnSac')}
                <InfoTooltip text={t('master.hsnSacTip')} />
              </span>
            }
            name="hsnSacCode"
          >
            <Input placeholder={t('master.hsnSacPlaceholder')} maxLength={8} />
          </Form.Item>
          <Form.Item label={t('master.fieldGstRate')} name="gstRate" initialValue={18}>
            <Select options={GST_RATES} />
          </Form.Item>
          <Form.Item label={t('master.fieldUnit')} name="unit" rules={[{ required: true }]}>
            <Select
              options={COMMON_UNITS}
              showSearch
              allowClear
              placeholder={t('master.unitPlaceholder')}
            />
          </Form.Item>
          <Form.Item label={t('master.fieldCategory')} name="category">
            <Input />
          </Form.Item>
          {watchItemType === 'goods' && (
            <Form.Item
              label={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('master.fieldTrackBatch')}
                  <InfoTooltip text={t('master.trackBatchTip')} />
                </span>
              }
              name="trackBatch"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Drawer>
    </div>
  );
}
