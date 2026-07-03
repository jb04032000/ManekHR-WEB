'use client';
// Bank accounts list (Finance > Payments & Banking). Polish: i18n via
// finance.banking.bankAccounts + DsPageHeader. Links to bank-accounts/[id]; wraps BankAccountForm.
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Tag,
  Space,
  Spin,
  Empty,
  Typography,
  Modal,
  message,
  Tooltip,
  Statistic,
  Card,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  BankOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms } from '@/lib/actions/finance.actions';
import {
  listBankAccounts,
  deleteBankAccount,
  setDefaultBankAccount,
  createBankAccount,
  updateBankAccount,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
} from '@/lib/actions/finance-bank-accounts.actions';
import type { FinanceBankAccount, Firm } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import BankAccountForm from '@/components/finance/bank/BankAccountForm';

const { Title, Text } = Typography;

function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export default function BankAccountsPage() {
  const router = useRouter();
  const t = useTranslations('finance.banking');
  // tShared only sources the shared list error-state labels (finance.sales.listCommon.*).
  const tShared = useTranslations('finance.sales');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const [firms, setFirms] = useState<Firm[]>([]);
  const [accounts, setAccounts] = useState<FinanceBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceBankAccount | null>(null);

  const firmId = firms[0]?._id ?? '';

  useEffect(() => {
    if (!wsId) return;
    listFirms(wsId)
      .then((f) => setFirms(f ?? []))
      .catch(() => {});
  }, [wsId]);

  const load = () => {
    if (!wsId || !firmId) return;
    setLoading(true);
    setError(false);
    listBankAccounts(wsId, firmId)
      .then((res) => setAccounts(Array.isArray(res) ? res : []))
      .catch(() => {
        setAccounts([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data (re)load when the workspace / firm changes.
    load();
  }, [wsId, firmId]); // eslint-disable-line

  const totalBalance = accounts.reduce((sum, a) => sum + (a.currentBalancePaise ?? 0), 0);

  const handleSetDefault = (id: string) => {
    if (!firmId) return;
    startTransition(async () => {
      try {
        await setDefaultBankAccount(wsId, firmId, id);
        message.success(t('bankAccounts.defaultUpdated'));
        load();
      } catch {
        message.error(t('bankAccounts.defaultUpdateFailed'));
      }
    });
  };

  const handleDelete = (record: FinanceBankAccount) => {
    Modal.confirm({
      title: t('bankAccounts.deleteConfirmTitle', { name: record.name }),
      content: t('bankAccounts.deleteConfirmBody'),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteBankAccount(wsId, firmId, record._id);
          message.success(t('bankAccounts.deleted'));
          load();
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : t('bankAccounts.deleteFailed');
          message.error(msg);
        }
      },
    });
  };

  const handleFormSubmit = async (values: CreateBankAccountInput | UpdateBankAccountInput) => {
    try {
      if (editingAccount) {
        await updateBankAccount(wsId, firmId, editingAccount._id, values as UpdateBankAccountInput);
        message.success(t('bankAccounts.updated'));
      } else {
        await createBankAccount(wsId, firmId, values as CreateBankAccountInput);
        message.success(t('bankAccounts.created'));
      }
      setModalOpen(false);
      setEditingAccount(null);
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('bankAccounts.saveFailed');
      message.error(msg);
      throw e; // propagate so form knows it failed
    }
  };

  const ACCOUNT_TYPE_COLORS: Record<string, string> = {
    current: 'blue',
    savings: 'green',
    overdraft: 'orange',
    cash_credit: 'purple',
  };

  const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    current: t('bankAccounts.typeShort.current'),
    savings: t('bankAccounts.typeShort.savings'),
    overdraft: t('bankAccounts.typeShort.overdraft'),
    cash_credit: t('bankAccounts.typeShort.cashCredit'),
  };

  const columns: ColumnsType<FinanceBankAccount> = [
    {
      title: t('bankAccounts.col.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name, rec) => (
        <Space>
          <Text strong>{name}</Text>
          {rec.isDefault && (
            <Tag color="gold" icon={<StarFilled />}>
              {t('bankAccounts.defaultTag')}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('bankAccounts.col.bank'),
      dataIndex: 'bankName',
      key: 'bankName',
    },
    {
      title: t('bankAccounts.col.type'),
      dataIndex: 'accountType',
      key: 'accountType',
      render: (val) => (
        <Tag color={ACCOUNT_TYPE_COLORS[val] ?? 'default'}>{ACCOUNT_TYPE_LABELS[val] ?? val}</Tag>
      ),
    },
    {
      title: t('bankAccounts.col.accountNo'),
      dataIndex: 'accountNumber',
      key: 'accountNumber',
      render: (v) => <Text code>{v ?? '-'}</Text>,
    },
    {
      title: t('bankAccounts.col.ifsc'),
      dataIndex: 'ifscCode',
      key: 'ifscCode',
    },
    {
      title: t('bankAccounts.col.balance'),
      dataIndex: 'currentBalancePaise',
      key: 'currentBalancePaise',
      align: 'right',
      render: (p) => <Text strong>{formatPaise(p ?? 0)}</Text>,
    },
    {
      title: t('bankAccounts.col.actions'),
      key: 'actions',
      align: 'right',
      render: (_, rec) => (
        <Space>
          <Tooltip title={t('bankAccounts.viewStatement')}>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/dashboard/finance/bank-accounts/${rec._id}`)}
            />
          </Tooltip>
          <Tooltip title={t('common.edit')}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingAccount(rec);
                setModalOpen(true);
              }}
            />
          </Tooltip>
          {!rec.isDefault && (
            <Tooltip title={t('bankAccounts.setDefaultTooltip')}>
              <Button
                size="small"
                icon={<StarOutlined />}
                onClick={() => handleSetDefault(rec._id)}
              />
            </Tooltip>
          )}
          <Tooltip title={t('common.delete')}>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(rec)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!firmId && !loading) {
    return (
      <div className="p-6">
        <Empty description={t('common.noFirmBody')} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <DsPageHeader
        title={t('bankAccounts.title')}
        icon={<BankOutlined />}
        titleAside={<InfoTooltip text={t('bankAccounts.info')} />}
        right={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingAccount(null);
              setModalOpen(true);
            }}
          >
            {t('bankAccounts.new')}
          </Button>
        }
      />

      {/* Summary card */}
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title={t('bankAccounts.totalBalance')}
              value={totalBalance / 100}
              precision={2}
              prefix="₹"
              formatter={(v) => new Intl.NumberFormat('en-IN').format(Number(v))}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title={t('bankAccounts.accountsCount')} value={accounts.length} />
          </Card>
        </Col>
      </Row>

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={load}
        />
      ) : (
        <Spin spinning={loading}>
          {accounts.length === 0 && !loading ? (
            <Empty description={t('bankAccounts.empty')} />
          ) : (
            <DsTable
              rowKey="_id"
              dataSource={accounts}
              columns={columns}
              pagination={false}
              size="small"
            />
          )}
        </Spin>
      )}

      <Modal
        title={editingAccount ? t('bankAccounts.editTitle') : t('bankAccounts.newTitle')}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingAccount(null);
        }}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <BankAccountForm
          initialValues={editingAccount}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditingAccount(null);
          }}
          loading={isPending}
        />
      </Modal>
    </div>
  );
}
