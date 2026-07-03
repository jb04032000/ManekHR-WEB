'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Tabs,
  Tag,
  Space,
  Button,
  DatePicker,
  Select,
  Typography,
  Spin,
  Empty,
  Modal,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import {
  listCheques,
  depositCheque,
  presentCheque,
  clearCheque,
  voidCheque,
} from '@/lib/actions/finance-cheques.actions';
import { listBankAccounts } from '@/lib/actions/finance-bank-accounts.actions';
import type { FinanceCheque, FinanceBankAccount } from '@/types';
import BounceModal from './BounceModal';
import StopPaymentModal from './StopPaymentModal';
import ChequeForm from './ChequeForm';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

const STATUS_COLORS: Record<string, string> = {
  pending_maturity: 'gold',
  in_transit: 'processing',
  cleared: 'success',
  bounced: 'error',
  stopped: 'default',
  void: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  pending_maturity: 'Pending Maturity',
  in_transit: 'In Transit',
  cleared: 'Cleared',
  bounced: 'Bounced',
  stopped: 'Stopped',
  void: 'Void',
};

interface ChequeRegisterTabsProps {
  wsId: string;
  firmId: string;
}

function ChequeTable({
  wsId,
  firmId,
  chequeType,
}: {
  wsId: string;
  firmId: string;
  chequeType: 'issued' | 'received';
}) {
  const tShared = useTranslations('finance.sales'); // shared listCommon.error* labels for the retry panel
  const [, startTransition] = useTransition();
  const [cheques, setCheques] = useState<FinanceCheque[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [bankFilter, setBankFilter] = useState<string | undefined>(undefined);
  const [bankAccounts, setBankAccounts] = useState<FinanceBankAccount[]>([]);
  const [page, setPage] = useState(1);
  const [bounceModalOpen, setBounceModalOpen] = useState(false);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [selectedCheque, setSelectedCheque] = useState<FinanceCheque | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    if (!wsId || !firmId) return;
    listBankAccounts(wsId, firmId)
      .then((res) => setBankAccounts(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, [wsId, firmId]);

  const load = () => {
    if (!wsId || !firmId) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    const params: Record<string, unknown> = { chequeType, page, limit: 20 };
    if (statusFilter !== 'all') params.status = statusFilter;
    if (bankFilter) params.bankAccountId = bankFilter;
    if (dateRange) {
      params.dateFrom = dateRange[0];
      params.dateTo = dateRange[1];
    }
    listCheques(wsId, firmId, params)
      .then((res) => {
        setCheques(res.items ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setCheques([]);
        setTotal(0);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Intentional data (re)load when the filters / pagination / reloadKey change.
    load();
  }, [wsId, firmId, chequeType, statusFilter, bankFilter, dateRange, page, reloadKey]); // eslint-disable-line

  const handleAction = (action: string, cheque: FinanceCheque) => {
    if (action === 'bounce') {
      setSelectedCheque(cheque);
      setBounceModalOpen(true);
      return;
    }
    if (action === 'stop') {
      setSelectedCheque(cheque);
      setStopModalOpen(true);
      return;
    }

    Modal.confirm({
      title: `Confirm: ${action} cheque #${cheque.chequeNumber}?`,
      onOk: async () => {
        const today = dayjs().format('YYYY-MM-DD');
        try {
          if (action === 'deposit')
            await depositCheque(wsId, firmId, cheque._id, { depositDate: today });
          if (action === 'present')
            await presentCheque(wsId, firmId, cheque._id, { depositDate: today });
          if (action === 'clear')
            await clearCheque(wsId, firmId, cheque._id, { clearingDate: today });
          if (action === 'void') await voidCheque(wsId, firmId, cheque._id);
          message.success(`Cheque ${action} successful`);
          load();
        } catch (e: unknown) {
          message.error(e instanceof Error ? e.message : 'Action failed');
        }
      },
    });
  };

  const renderActions = (cheque: FinanceCheque) => {
    const status = cheque.status;
    const isIssued = chequeType === 'issued';
    const actions: React.ReactNode[] = [];

    if (status === 'pending_maturity') {
      if (!isIssued)
        actions.push(
          <Button
            key="deposit"
            size="small"
            type="link"
            onClick={() => handleAction('deposit', cheque)}
          >
            Deposit
          </Button>,
        );
      if (isIssued)
        actions.push(
          <Button
            key="present"
            size="small"
            type="link"
            onClick={() => handleAction('present', cheque)}
          >
            Present
          </Button>,
        );
      if (isIssued)
        actions.push(
          <Button
            key="stop"
            size="small"
            type="link"
            danger
            onClick={() => handleAction('stop', cheque)}
          >
            Stop
          </Button>,
        );
    }
    if (status === 'in_transit') {
      actions.push(
        <Button key="clear" size="small" type="link" onClick={() => handleAction('clear', cheque)}>
          Clear
        </Button>,
      );
      actions.push(
        <Button
          key="bounce"
          size="small"
          type="link"
          danger
          onClick={() => handleAction('bounce', cheque)}
        >
          Bounce
        </Button>,
      );
      if (isIssued)
        actions.push(
          <Button
            key="stop"
            size="small"
            type="link"
            danger
            onClick={() => handleAction('stop', cheque)}
          >
            Stop
          </Button>,
        );
    }

    return <Space size={0}>{actions}</Space>;
  };

  const daysOutstanding = (cheque: FinanceCheque): number => {
    if (!cheque.chequeDate) return 0;
    return dayjs().diff(dayjs(cheque.chequeDate), 'day');
  };

  const columns: ColumnsType<FinanceCheque> = [
    { title: 'Cheque #', dataIndex: 'chequeNumber', key: 'chequeNumber', width: 100 },
    {
      title: 'Date',
      dataIndex: 'chequeDate',
      key: 'chequeDate',
      width: 120,
      render: (d) => dayjs(d).format('DD MMM YYYY'),
    },
    {
      title: 'Party',
      dataIndex: 'partyName',
      key: 'partyName',
      ellipsis: true,
      render: (v) => v ?? '-',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      width: 130,
      render: (p) => formatPaise(p ?? 0),
    },
    {
      title: 'Bank',
      dataIndex: 'bankAccountName',
      key: 'bankAccountName',
      ellipsis: true,
      render: (v) => v ?? '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (s) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{STATUS_LABELS[s] ?? s}</Tag>,
    },
    {
      title: 'Days Outstanding',
      key: 'days',
      width: 120,
      render: (_, rec) => {
        const d = daysOutstanding(rec);
        return <Text type={d > 30 ? 'danger' : 'secondary'}>{d}d</Text>;
      },
    },
    { title: 'Actions', key: 'actions', width: 180, render: (_, rec) => renderActions(rec) },
  ];

  return (
    <div className="space-y-3">
      {/* Filters */}
      <Space wrap>
        <Select
          value={statusFilter}
          style={{ width: 160 }}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'pending_maturity', label: 'Pending Maturity' },
            { value: 'in_transit', label: 'In Transit' },
            { value: 'cleared', label: 'Cleared' },
            { value: 'bounced', label: 'Bounced' },
            { value: 'stopped', label: 'Stopped' },
          ]}
        />
        <RangePicker
          format="DD MMM YYYY"
          onChange={(dates) => {
            if (dates)
              setDateRange([dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')]);
            else setDateRange(null);
          }}
        />
        <Select
          allowClear
          style={{ width: 180 }}
          placeholder="Filter by bank"
          onChange={setBankFilter}
          options={bankAccounts.map((a) => ({ value: a._id, label: a.name }))}
        />
        <Button type="primary" onClick={() => setAddModalOpen(true)}>
          + New Cheque
        </Button>
      </Space>

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <Spin spinning={loading}>
          {cheques.length === 0 && !loading ? (
            <Empty description={`No ${chequeType} cheques found`} />
          ) : (
            <DsTable<FinanceCheque>
              rowKey="_id"
              dataSource={cheques}
              columns={columns}
              size="small"
              scrollX={900}
              pagination={{
                current: page,
                pageSize: 20,
                total,
                onChange: setPage,
              }}
            />
          )}
        </Spin>
      )}

      <BounceModal
        open={bounceModalOpen}
        cheque={selectedCheque}
        wsId={wsId}
        firmId={firmId}
        onSuccess={() => {
          setBounceModalOpen(false);
          load();
        }}
        onCancel={() => setBounceModalOpen(false)}
      />

      <StopPaymentModal
        open={stopModalOpen}
        cheque={selectedCheque}
        wsId={wsId}
        firmId={firmId}
        onSuccess={() => {
          setStopModalOpen(false);
          load();
        }}
        onCancel={() => setStopModalOpen(false)}
      />

      <Modal
        title="New Cheque"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={null}
        width={580}
        destroyOnHidden
      >
        <ChequeForm
          wsId={wsId}
          firmId={firmId}
          onSuccess={() => {
            setAddModalOpen(false);
            load();
            message.success('Cheque created');
          }}
          onCancel={() => setAddModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

export default function ChequeRegisterTabs({ wsId, firmId }: ChequeRegisterTabsProps) {
  return (
    <Tabs
      defaultActiveKey="received"
      items={[
        {
          key: 'received',
          label: 'Received',
          children: <ChequeTable wsId={wsId} firmId={firmId} chequeType="received" />,
        },
        {
          key: 'issued',
          label: 'Issued',
          children: <ChequeTable wsId={wsId} firmId={firmId} chequeType="issued" />,
        },
      ]}
    />
  );
}
