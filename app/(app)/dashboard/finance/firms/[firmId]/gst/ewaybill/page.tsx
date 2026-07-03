'use client';

import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, Modal, Spin, Tabs, Tooltip, message } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import { DsTable } from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import EwbExtendModal from '@/components/gst/EwbExtendModal';
import { useWorkspaceStore } from '@/lib/store';
import { cancelEwb, listEwbsByStatus } from '@/lib/actions/finance/gst.actions';
import type { ColumnsType } from 'antd/es/table';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDate(val: string | Date | undefined): string {
  if (!val) return '-';
  return new Date(val).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// i18n note: only the "Expired" label is translated; the d/h count is numeric.
// Cross-link: key finance.gst.ewaybill.validity.expired.
type TFn = ReturnType<typeof useTranslations>;

function validityLeft(validUpto: string | Date, t: TFn): { label: string; color: string } {
  const remainMs = new Date(validUpto).getTime() - Date.now();
  if (remainMs <= 0) return { label: t('ewaybill.validity.expired'), color: 'var(--cr-error)' };

  const totalHours = remainMs / 3_600_000;
  const days = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);

  const label = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  const color =
    totalHours < 8 ? 'var(--cr-error)' : totalHours < 24 ? 'var(--cr-warning)' : 'var(--cr-text-3)';

  return { label, color };
}

// ── component ──────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ firmId: string }>;
}

export default function EwayBillPage({ params }: PageProps) {
  const [firmId, setFirmId] = useState('');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const gstAccess = useFeatureAccess('gst_compliance');
  // Finance GST polish: copy via finance.gst.ewaybill.*.
  const t = useTranslations('finance.gst');
  // Shared finance list error copy (errorTitle/errorBody/retry) lives under finance.sales.listCommon.
  const tShared = useTranslations('finance.sales');

  // Error/retry pair: a failed tab fetch sets `error`; the Retry button bumps reloadKey to refetch.
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [activeItems, setActiveItems] = useState<any[]>([]);
  const [expiringItems, setExpiringItems] = useState<any[]>([]);
  const [expiredItems, setExpiredItems] = useState<any[]>([]);
  const [cancelledItems, setCancelledItems] = useState<any[]>([]);
  const [loadingTab, setLoadingTab] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  // Extend modal
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendInvoiceId, setExtendInvoiceId] = useState('');
  const [extendEwbNo, setExtendEwbNo] = useState('');
  const [extendValidUpto, setExtendValidUpto] = useState<string | Date>('');

  // Live validity countdown refresh
  const [, forceUpdate] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    params.then((p) => setFirmId(p.firmId));
  }, [params]);

  // 60s timer for live validity countdown
  useEffect(() => {
    timerRef.current = setInterval(() => forceUpdate((n) => n + 1), 60_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadTab = useCallback(
    async (tab: string) => {
      if (!wsId || !firmId || gstAccess.isLocked) return;
      startTransition(() => {
        setLoadingTab(tab);
        setError(false);
      });
      try {
        if (tab === 'active') {
          const { items } = await listEwbsByStatus(wsId, firmId, 'active');
          startTransition(() => {
            setActiveItems(items);
          });
        } else if (tab === 'expiring') {
          const { items } = await listEwbsByStatus(wsId, firmId, 'expiring');
          startTransition(() => {
            setExpiringItems(items);
          });
        } else if (tab === 'expired') {
          const { items } = await listEwbsByStatus(wsId, firmId, 'expired');
          startTransition(() => {
            setExpiredItems(items);
          });
        } else if (tab === 'cancelled') {
          const { items } = await listEwbsByStatus(wsId, firmId, 'cancelled');
          startTransition(() => {
            setCancelledItems(items);
          });
        }
      } catch {
        startTransition(() => {
          setError(true);
        });
        message.error(t('ewaybill.loadError'), 3);
      } finally {
        setLoadingTab('');
      }
    },
    [wsId, firmId],
  );

  useEffect(() => {
    if (wsId && firmId) loadTab('active');
  }, [wsId, firmId, loadTab]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    loadTab(key);
  };

  // Retry refetches whichever tab is currently in view; reloadKey is the standard finance
  // retry counter so a bump re-triggers the load even if the active tab is unchanged.
  useEffect(() => {
    if (reloadKey > 0 && wsId && firmId && !gstAccess.isLocked) loadTab(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const handleCancelEwb = (invoiceId: string, ewbNo: string) => {
    Modal.confirm({
      title: t('ewaybill.cancelModal.title'),
      content: t('ewaybill.cancelModal.content', { ewbNo }),
      okText: t('ewaybill.cancelModal.ok'),
      okButtonProps: { danger: true },
      cancelText: t('ewaybill.cancelModal.keep'),
      centered: true,
      onOk: async () => {
        try {
          await cancelEwb(wsId, firmId, invoiceId, 1, t('ewaybill.toast.cancelReasonDefault'));
          message.success(t('ewaybill.toast.cancelled', { ewbNo }), 3);
          loadTab(activeTab);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : t('ewaybill.toast.cancelFailed');
          if (msg.includes('EWB_CANCEL_WINDOW_EXPIRED')) {
            message.error(t('ewaybill.toast.cancelWindowExpired'), 5);
          } else {
            message.error(msg, 5);
          }
        }
      },
    });
  };

  const openExtend = (row: any) => {
    setExtendInvoiceId(row._id ?? row.id);
    setExtendEwbNo(row.ewayBill?.ewbNo ?? '');
    setExtendValidUpto(row.ewayBill?.validUpto ?? '');
    setExtendOpen(true);
  };

  // ── Column definitions ───────────────────────────────────────────────────────

  const activeColumns: ColumnsType<any> = [
    {
      title: t('ewaybill.col.ewbNo'),
      key: 'ewbNo',
      width: 130,
      render: (_: any, row: any) => (
        <span className="font-mono text-[13px]">{row.ewayBill?.ewbNo ?? '-'}</span>
      ),
    },
    {
      title: t('ewaybill.col.invoiceNo'),
      dataIndex: 'voucherNumber',
      width: 120,
      render: (val: string) => <span style={{ color: 'var(--cr-primary)' }}>{val}</span>,
    },
    {
      title: t('ewaybill.col.party'),
      key: 'party',
      width: 180,
      render: (_: any, row: any) => {
        const name = row.partySnapshot?.name ?? '-';
        return (
          <Tooltip title={name}>
            <span className="block max-w-[160px] truncate">{name}</span>
          </Tooltip>
        );
      },
    },
    {
      title: t('ewaybill.col.vehicleNo'),
      key: 'vehicleNo',
      width: 100,
      render: (_: any, row: any) => (
        <span className="font-mono text-[13px] uppercase">{row.ewayBill?.vehicleNo ?? '-'}</span>
      ),
    },
    {
      title: t('ewaybill.col.validUpto'),
      key: 'validUpto',
      width: 120,
      render: (_: any, row: any) => formatDate(row.ewayBill?.validUpto),
    },
    {
      title: t('ewaybill.col.validityLeft'),
      key: 'validityLeft',
      width: 100,
      render: (_: any, row: any) => {
        if (!row.ewayBill?.validUpto) return '-';
        const { label, color } = validityLeft(row.ewayBill.validUpto, t);
        return <span style={{ color }}>{label}</span>;
      },
    },
    {
      title: t('ewaybill.col.distance'),
      key: 'distance',
      width: 80,
      align: 'right',
      render: (_: any, row: any) => {
        const dist = row.ewayBill?.distance ?? row.ewayBill?.transDistance ?? null;
        return dist != null ? `${dist} km` : '-';
      },
    },
    {
      title: t('ewaybill.col.actions'),
      key: 'actions',
      width: 160,
      render: (_: any, row: any) => (
        <div className="flex gap-2">
          <DsButton dsVariant="ghost" dsSize="sm" onClick={() => openExtend(row)}>
            {t('ewaybill.action.extend')}
          </DsButton>
          <DsButton
            dsVariant="danger"
            dsSize="sm"
            onClick={() => handleCancelEwb(row._id ?? row.id, row.ewayBill?.ewbNo ?? '')}
          >
            {t('ewaybill.action.cancel')}
          </DsButton>
        </div>
      ),
    },
  ];

  const expiringColumns: ColumnsType<any> = [
    ...activeColumns.slice(0, -1), // all except Actions
    {
      title: t('ewaybill.col.actions'),
      key: 'actions',
      width: 160,
      render: (_: any, row: any) => (
        <div className="flex gap-2">
          <DsButton dsVariant="ghost" dsSize="sm" onClick={() => openExtend(row)}>
            {t('ewaybill.action.extend')}
          </DsButton>
          <DsButton
            dsVariant="danger"
            dsSize="sm"
            onClick={() => handleCancelEwb(row._id ?? row.id, row.ewayBill?.ewbNo ?? '')}
          >
            {t('ewaybill.action.cancel')}
          </DsButton>
        </div>
      ),
    },
  ];

  const expiredColumns: ColumnsType<any> = [
    {
      title: t('ewaybill.col.ewbNo'),
      key: 'ewbNo',
      width: 130,
      render: (_: any, row: any) => (
        <span className="font-mono text-[13px]">{row.ewayBill?.ewbNo ?? '-'}</span>
      ),
    },
    { title: t('ewaybill.col.invoiceNo'), dataIndex: 'voucherNumber', width: 120 },
    {
      title: t('ewaybill.col.party'),
      key: 'party',
      width: 180,
      render: (_: any, row: any) => {
        const name = row.partySnapshot?.name ?? '-';
        return (
          <Tooltip title={name}>
            <span className="block max-w-[160px] truncate">{name}</span>
          </Tooltip>
        );
      },
    },
    {
      title: t('ewaybill.col.vehicleNo'),
      key: 'vehicleNo',
      width: 100,
      render: (_: any, row: any) => (
        <span className="font-mono uppercase">{row.ewayBill?.vehicleNo ?? '-'}</span>
      ),
    },
    {
      title: t('ewaybill.col.validUpto'),
      key: 'validUpto',
      width: 120,
      render: (_: any, row: any) => formatDate(row.ewayBill?.validUpto),
    },
    {
      title: t('ewaybill.col.expiredAt'),
      key: 'expiredAt',
      width: 110,
      render: (_: any, row: any) => formatDate(row.ewayBill?.validUpto),
    },
    {
      title: t('ewaybill.col.distance'),
      key: 'distance',
      width: 80,
      align: 'right' as const,
      render: (_: any, row: any) =>
        row.ewayBill?.distance != null ? `${row.ewayBill.distance} km` : '-',
    },
  ];

  const cancelledColumns: ColumnsType<any> = [
    {
      title: t('ewaybill.col.ewbNo'),
      key: 'ewbNo',
      width: 130,
      render: (_: any, row: any) => <span className="font-mono">{row.ewayBill?.ewbNo ?? '-'}</span>,
    },
    { title: t('ewaybill.col.invoiceNo'), dataIndex: 'voucherNumber', width: 120 },
    {
      title: t('ewaybill.col.party'),
      key: 'party',
      width: 180,
      render: (_: any, row: any) => {
        const name = row.partySnapshot?.name ?? '-';
        return (
          <Tooltip title={name}>
            <span className="block max-w-[160px] truncate">{name}</span>
          </Tooltip>
        );
      },
    },
    {
      title: t('ewaybill.col.cancelledAt'),
      key: 'cancelledAt',
      width: 110,
      render: (_: any, row: any) =>
        formatDate(row.ewayBill?.cancelledAt ?? row.ewayBill?.generatedAt),
    },
    {
      title: t('ewaybill.col.cancelReason'),
      key: 'cancelReason',
      width: 140,
      render: (_: any, row: any) => row.ewayBill?.cancelReason ?? '-',
    },
  ];

  const tabItems = [
    {
      key: 'active',
      label: (
        <span>
          {t('ewaybill.tab.active')}{' '}
          <Badge count={activeItems.length} style={{ backgroundColor: 'var(--cr-success)' }} />
        </span>
      ),
      children: (
        <DsTable
          columns={activeColumns}
          dataSource={activeItems}
          rowKey={(r: any, i?: number) => r._id ?? r.id ?? i ?? 0}
          loading={loadingTab === 'active'}
          scrollX="max-content"
          pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} records` }}
        />
      ),
    },
    {
      key: 'expiring',
      label: (
        <span>
          {t('ewaybill.tab.expiring')}{' '}
          <Badge count={expiringItems.length} style={{ backgroundColor: 'var(--cr-warning)' }} />
        </span>
      ),
      children: (
        <DsTable
          columns={expiringColumns}
          dataSource={expiringItems}
          rowKey={(r: any, i?: number) => r._id ?? r.id ?? i ?? 0}
          loading={loadingTab === 'expiring'}
          scrollX="max-content"
          pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} records` }}
          rowClassName={() => 'ewb-expiring-row'}
        />
      ),
    },
    {
      key: 'expired',
      label: (
        <span>
          {t('ewaybill.tab.expired')} <Badge count={expiredItems.length} />
        </span>
      ),
      children: (
        <DsTable
          columns={expiredColumns}
          dataSource={expiredItems}
          rowKey={(r: any, i?: number) => r._id ?? r.id ?? i ?? 0}
          loading={loadingTab === 'expired'}
          scrollX="max-content"
          pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} records` }}
        />
      ),
    },
    {
      key: 'cancelled',
      label: (
        <span>
          {t('ewaybill.tab.cancelled')} <Badge count={cancelledItems.length} />
        </span>
      ),
      children: (
        <DsTable
          columns={cancelledColumns}
          dataSource={cancelledItems}
          rowKey={(r: any, i?: number) => r._id ?? r.id ?? i ?? 0}
          loading={loadingTab === 'cancelled'}
          scrollX="max-content"
          pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} records` }}
        />
      ),
    },
  ];

  if (gstAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (gstAccess.isLocked) {
    return <ModuleLockedPage module="gst_compliance" />;
  }

  return (
    <div
      className="flex flex-col gap-md p-lg"
      style={{ background: 'var(--cr-bg)', minHeight: '100vh' }}
    >
      <DsPageHeader
        title={t('ewaybill.title')}
        icon={<CarOutlined />}
        titleAside={<InfoTooltip text={t('ewaybill.info')} />}
      />

      <div style={{ background: 'var(--cr-surface)', borderRadius: 8, padding: 16 }}>
        {error ? (
          <ListErrorState
            title={tShared('listCommon.errorTitle')}
            body={tShared('listCommon.errorBody')}
            retryLabel={tShared('listCommon.retry')}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        ) : (
          <Tabs type="line" activeKey={activeTab} onChange={handleTabChange} items={tabItems} />
        )}
      </div>

      {/* Extend EWB Modal */}
      <EwbExtendModal
        open={extendOpen}
        invoiceId={extendInvoiceId}
        ewbNo={extendEwbNo}
        validUpto={extendValidUpto}
        wsId={wsId}
        firmId={firmId}
        onSuccess={() => {
          setExtendOpen(false);
          loadTab(activeTab);
        }}
        onClose={() => setExtendOpen(false)}
      />

      <style jsx>{`
        :global(.ewb-expiring-row) {
          background-color: var(--cr-warning-bg) !important;
        }
      `}</style>
    </div>
  );
}
