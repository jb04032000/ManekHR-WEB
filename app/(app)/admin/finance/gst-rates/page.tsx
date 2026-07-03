'use client';

/**
 * D15 / R6 - platform-admin GST rate editor. Browse the WHOLE effective-dated rate registry
 * (paginated, searchable) - no longer prefix-only - record a revision without a deploy, and see a
 * who/when audit column per row (revisedByName + createdAt; system-seeded rows show "System").
 * Revising end-dates the current open rate (BE) so the timeline never overlaps and posted invoices
 * keep their original rate. Calls finance.actions listAllGstRates / reviseGstRate -> BE
 * finance/gst-rate-history (revise gated by IsAdminGuard server-side). Admin layout gates access.
 * Built on the shared design system (DsPageHeader / DsTable / DsButton) + i18n x4.
 */

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { InputNumber, DatePicker, message, Space, Alert } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import {
  DsPageHeader,
  DsTable,
  DsButton,
  DsInput,
  DsModal,
  DsForm,
  DsFormItem,
  DsTag,
  useForm,
} from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { listAllGstRates, reviseGstRate, type GstRateRow } from '@/lib/actions/finance.actions';
import { parseApiError } from '@/lib/utils';

const PAGE_SIZE = 50;
const fmtDate = (d?: string | null) => (d ? dayjs(d).format('DD MMM YYYY') : null);

export default function AdminGstRatesPage() {
  const t = useTranslations('finance.adminGstRates');
  const tShared = useTranslations('finance.sales'); // shared listCommon.* error/retry labels
  const [search, setSearch] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<GstRateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty registry
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  // The prefix the Revise modal targets - chosen by clicking "Revise" on a row.
  const [revisePrefix, setRevisePrefix] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = useForm();
  const [msgApi, ctx] = message.useMessage();

  const load = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    try {
      const res = await listAllGstRates({
        q: appliedQ || undefined,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setRows(res.data);
      setTotal(res.total);
    } catch {
      setRows([]);
      setError(true);
    } finally {
      setLoading(false);
    }
    // reloadKey is intentionally a dep so the error-state Retry button re-runs this loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQ, page, reloadKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSearch = () => {
    setPage(1);
    setAppliedQ(search.trim());
  };

  const submit = useCallback(async () => {
    if (!revisePrefix) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await reviseGstRate({
        hsnPrefix: revisePrefix,
        fromDate: (values.fromDate as dayjs.Dayjs).toISOString(),
        cgstRate: values.cgstRate,
        sgstRate: values.sgstRate,
        igstRate: values.igstRate,
        cessRate: values.cessRate ?? 0,
        description: values.description,
        notification: values.notification,
      });
      msgApi.success(t('toast.revised'));
      setRevisePrefix(null);
      form.resetFields();
      await load();
    } catch (e) {
      msgApi.error(parseApiError(e) || t('toast.reviseFailed'));
    } finally {
      setSaving(false);
    }
  }, [form, revisePrefix, load, msgApi, t]);

  const columns = useMemo(
    () => [
      { title: t('col.prefix'), dataIndex: 'hsnPrefix', width: 110 },
      {
        title: t('col.from'),
        dataIndex: 'fromDate',
        width: 130,
        render: (d: string) => fmtDate(d),
      },
      {
        title: t('col.to'),
        dataIndex: 'toDate',
        width: 130,
        render: (d?: string | null) =>
          d ? fmtDate(d) : <DsTag color="green">{t('col.current')}</DsTag>,
      },
      { title: t('col.cgst'), dataIndex: 'cgstRate', width: 80 },
      { title: t('col.sgst'), dataIndex: 'sgstRate', width: 80 },
      { title: t('col.igst'), dataIndex: 'igstRate', width: 80 },
      { title: t('col.cess'), dataIndex: 'cessRate', width: 70, render: (v?: number) => v ?? 0 },
      {
        title: t('col.description'),
        dataIndex: 'description',
        ellipsis: true,
        render: (v?: string) => v ?? t('dash'),
      },
      {
        title: t('col.notification'),
        dataIndex: 'notification',
        ellipsis: true,
        render: (v?: string) => v ?? t('dash'),
      },
      {
        // R6: who/when audit column. System-seeded rows have no reviser.
        title: t('col.revisedBy'),
        dataIndex: 'revisedByName',
        width: 150,
        render: (v?: string) =>
          v ?? <span style={{ color: 'var(--cr-text-3)' }}>{t('systemSeed')}</span>,
      },
      {
        title: t('col.revisedAt'),
        dataIndex: 'createdAt',
        width: 130,
        render: (d?: string) => fmtDate(d) ?? t('dash'),
      },
      {
        title: '',
        key: 'actions',
        width: 110,
        render: (_: unknown, row: GstRateRow) => (
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            icon={<PlusOutlined />}
            onClick={() => setRevisePrefix(row.hsnPrefix)}
          >
            {t('revise')}
          </DsButton>
        ),
      },
    ],
    [t],
  );

  return (
    <div style={{ padding: 24 }}>
      {ctx}
      <DsPageHeader title={t('title')} style={{ marginBottom: 4 }} />
      <p style={{ color: 'var(--cr-text-3)', fontSize: 13, marginBottom: 16, maxWidth: 760 }}>
        {t('subtitle')}
      </p>

      <Space wrap style={{ marginBottom: 16 }}>
        <DsInput
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={runSearch}
          style={{ width: 320 }}
          prefix={<SearchOutlined />}
          allowClear
          onClear={() => {
            setSearch('');
            setPage(1);
            setAppliedQ('');
          }}
        />
        <DsButton dsVariant="primary" onClick={runSearch} loading={loading}>
          {t('search')}
        </DsButton>
      </Space>

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <DsTable
          rowKey="_id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scrollX="max-content"
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
          }}
          locale={{ emptyText: t('empty') }}
        />
      )}

      <DsModal
        title={t('modal.title', { prefix: revisePrefix ?? '' })}
        open={!!revisePrefix}
        onOk={submit}
        confirmLoading={saving}
        onCancel={() => setRevisePrefix(null)}
        okText={t('modal.save')}
        cancelText={t('modal.cancel')}
        destroyOnHidden
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('modal.info')} />
        <DsForm form={form} layout="vertical" requiredMark="optional">
          <DsFormItem
            label={t('modal.effectiveFrom')}
            name="fromDate"
            rules={[{ required: true, message: t('modal.effectiveFromRequired') }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </DsFormItem>
          <Space>
            <DsFormItem label={t('modal.cgst')} name="cgstRate" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} step={0.5} />
            </DsFormItem>
            <DsFormItem label={t('modal.sgst')} name="sgstRate" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} step={0.5} />
            </DsFormItem>
            <DsFormItem label={t('modal.igst')} name="igstRate" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} step={0.5} />
            </DsFormItem>
            <DsFormItem label={t('modal.cess')} name="cessRate">
              <InputNumber min={0} max={100} step={0.5} />
            </DsFormItem>
          </Space>
          <DsFormItem label={t('modal.description')} name="description">
            <DsInput placeholder={t('modal.descriptionPh')} />
          </DsFormItem>
          <DsFormItem label={t('modal.notification')} name="notification">
            <DsInput placeholder={t('modal.notificationPh')} />
          </DsFormItem>
        </DsForm>
      </DsModal>
    </div>
  );
}
