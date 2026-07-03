'use client';
// Finance polish (manufacturing): i18n via finance.manufacturing.vouchers; DsPageHeader title +
// New action + InfoTooltip explaining the manufacturing voucher. Tab/status labels use the
// translator. The status tab is persisted per-firm (platform bar) via usePersistedState so it
// survives reloads. Used by the manufacturing/vouchers list page. No data/columns logic changed.
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Tabs } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { ManufacturingVoucher, ManufacturingVoucherStatus } from '@/types';

export interface ManufacturingRegisterProps {
  workspaceId: string;
  firmId: string;
  initialData: ManufacturingVoucher[];
  itemMap?: Map<string, string>;
}

type TabKey = 'all' | ManufacturingVoucherStatus;

const STATUS_COLOR: Record<ManufacturingVoucherStatus, string> = {
  draft: 'gold',
  in_progress: 'blue',
  completed: 'green',
  cancelled: 'red',
};

function paiseToRupees(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export default function ManufacturingRegister({
  workspaceId,
  firmId,
  initialData,
  itemMap = new Map(),
}: ManufacturingRegisterProps) {
  const router = useRouter();
  const t = useTranslations('finance.manufacturing.vouchers');
  // Per-firm saved status tab (platform bar): persists across reloads. Cross-link usePersistedState.
  const [activeTab, setActiveTab] = usePersistedState<TabKey>(
    `finance:manufacturing:vouchers:status:${firmId}`,
    'all',
  );

  const filtered =
    activeTab === 'all' ? initialData : initialData.filter((mv) => mv.status === activeTab);

  const STATUS_LABEL: Record<ManufacturingVoucherStatus, string> = {
    draft: t('stateDraft'),
    in_progress: t('stateInProgress'),
    completed: t('stateCompleted'),
    cancelled: t('stateCancelled'),
  };

  const tabItems = [
    { key: 'all', label: t('tabAll', { count: initialData.length }) },
    {
      key: 'draft',
      label: t('tabDraft', { count: initialData.filter((m) => m.status === 'draft').length }),
    },
    {
      key: 'in_progress',
      label: t('tabInProgress', {
        count: initialData.filter((m) => m.status === 'in_progress').length,
      }),
    },
    {
      key: 'completed',
      label: t('tabCompleted', {
        count: initialData.filter((m) => m.status === 'completed').length,
      }),
    },
    {
      key: 'cancelled',
      label: t('tabCancelled', {
        count: initialData.filter((m) => m.status === 'cancelled').length,
      }),
    },
  ];

  return (
    <div>
      <DsPageHeader
        title={t('registerTitle')}
        icon={<ExperimentOutlined />}
        titleAside={<InfoTooltip text={t('tip')} />}
        style={{ marginBottom: 16 }}
        right={
          <DsButton
            dsVariant="primary"
            onClick={() =>
              router.push(`/dashboard/finance/firms/${firmId}/manufacturing/vouchers/new`)
            }
          >
            {t('new')}
          </DsButton>
        }
      />

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
        items={tabItems}
        style={{ marginBottom: 16 }}
      />

      <DsTable
        dataSource={filtered}
        rowKey="_id"
        pagination={{ defaultPageSize: 15, showSizeChanger: true }}
        onRow={(record: ManufacturingVoucher) => ({
          onClick: () =>
            router.push(`/dashboard/finance/firms/${firmId}/manufacturing/vouchers/${record._id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          {
            title: t('colVoucherNo'),
            dataIndex: 'voucherNumber',
            render: (v: string) =>
              v || <span style={{ color: 'var(--cr-neutral-300)' }}>{t('stateDraft')}</span>,
          },
          {
            title: t('colDate'),
            dataIndex: 'voucherDate',
            sorter: (a: ManufacturingVoucher, b: ManufacturingVoucher) =>
              new Date(a.voucherDate).getTime() - new Date(b.voucherDate).getTime(),
            defaultSortOrder: 'descend' as const,
            render: (v: string) => new Date(v).toLocaleDateString('en-IN'),
          },
          {
            title: t('colFinishedItem'),
            dataIndex: 'finishedItemId',
            render: (id: string) => itemMap.get(id) ?? id,
          },
          {
            title: t('colPlannedQty'),
            dataIndex: 'finishedQty',
          },
          {
            title: t('colActualQty'),
            dataIndex: 'actualFinishedQty',
            render: (v: number) => v || '-',
          },
          {
            title: t('colStatus'),
            dataIndex: 'status',
            render: (v: ManufacturingVoucherStatus) => (
              <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>
            ),
          },
          {
            title: t('colInputCost'),
            dataIndex: 'totalInputCostPaise',
            sorter: (a: ManufacturingVoucher, b: ManufacturingVoucher) =>
              a.totalInputCostPaise - b.totalInputCostPaise,
            render: (v: number) => (v ? `₹${paiseToRupees(v)}` : '-'),
          },
          {
            title: t('colVariance'),
            dataIndex: 'variancePaise',
            sorter: (a: ManufacturingVoucher, b: ManufacturingVoucher) =>
              a.variancePaise - b.variancePaise,
            render: (v: number) => {
              if (!v) return '-';
              const display = paiseToRupees(Math.abs(v));
              const color = v > 0 ? 'var(--cr-danger-700)' : 'var(--cr-success-700)';
              const label = v > 0 ? `+₹${display}` : `-₹${display}`;
              return <span style={{ color, fontWeight: 600 }}>{label}</span>;
            },
          },
        ]}
      />
    </div>
  );
}
