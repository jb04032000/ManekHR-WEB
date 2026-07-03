'use client';
// Bank account detail + statement (Finance > Payments & Banking). Polish: i18n via
// finance.banking.bankAccounts + DsPageHeader. Wraps BankStatementTable + BankAccountForm.
import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  Descriptions,
  Tag,
  Space,
  Spin,
  Typography,
  Divider,
  Modal,
  message,
} from 'antd';
import { EditOutlined, StarFilled, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms } from '@/lib/actions/finance.actions';
import {
  getBankAccount,
  deleteBankAccount,
  setDefaultBankAccount,
  updateBankAccount,
  type UpdateBankAccountInput,
} from '@/lib/actions/finance-bank-accounts.actions';
import type { FinanceBankAccount, Firm } from '@/types';
import BankStatementTable from '@/components/finance/bank/BankStatementTable';
import BankAccountForm from '@/components/finance/bank/BankAccountForm';

const { Text } = Typography;

function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export default function BankAccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('finance.banking');
  const id = params.id as string;
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    current: t('bankAccounts.typeLong.current'),
    savings: t('bankAccounts.typeLong.savings'),
    overdraft: t('bankAccounts.typeLong.overdraft'),
    cash_credit: t('bankAccounts.typeLong.cashCredit'),
  };

  const [firms, setFirms] = useState<Firm[]>([]);
  const [account, setAccount] = useState<FinanceBankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const firmId = firms[0]?._id ?? '';

  useEffect(() => {
    if (!wsId) return;
    listFirms(wsId)
      .then((f) => setFirms(f ?? []))
      .catch(() => {});
  }, [wsId]);

  const load = () => {
    if (!wsId || !firmId || !id) return;
    setLoading(true);
    getBankAccount(wsId, firmId, id)
      .then(setAccount)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data (re)load when the workspace / firm / account id changes.
    load();
  }, [wsId, firmId, id]); // eslint-disable-line

  const handleSetDefault = () => {
    if (!firmId) return;
    startTransition(async () => {
      try {
        await setDefaultBankAccount(wsId, firmId, id);
        message.success(t('bankAccounts.setDefaultDone'));
        load();
      } catch {
        message.error(t('bankAccounts.defaultUpdateFailed'));
      }
    });
  };

  const handleDelete = () => {
    Modal.confirm({
      title: t('bankAccounts.deleteConfirmTitleGeneric'),
      content: t('bankAccounts.deleteConfirmBodyDetail'),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteBankAccount(wsId, firmId, id);
          message.success(t('bankAccounts.deleted'));
          router.push('/dashboard/finance/bank-accounts');
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : t('bankAccounts.deleteFailed');
          message.error(msg);
        }
      },
    });
  };

  const handleEditSubmit = async (values: UpdateBankAccountInput) => {
    await updateBankAccount(wsId, firmId, id, values);
    message.success(t('bankAccounts.updated'));
    setEditOpen(false);
    load();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-6">
        <Text type="danger">{t('bankAccounts.notFound')}</Text>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Back + Actions bar */}
      <DsPageHeader
        title={account.name}
        titleAside={
          <Space>
            {account.isDefault && (
              <Tag color="gold" icon={<StarFilled />}>
                {t('bankAccounts.defaultTag')}
              </Tag>
            )}
          </Space>
        }
        right={
          <Space wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push('/dashboard/finance/bank-accounts')}
            >
              {t('common.back')}
            </Button>
            <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
              {t('common.edit')}
            </Button>
            {!account.isDefault && (
              <Button icon={<StarFilled />} onClick={handleSetDefault} loading={isPending}>
                {t('bankAccounts.setDefault')}
              </Button>
            )}
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </Space>
        }
      />

      {/* Account meta card */}
      <Card size="small">
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label={t('bankAccounts.field.bank')}>
            {account.bankName}
          </Descriptions.Item>
          <Descriptions.Item label={t('bankAccounts.field.accountType')}>
            <Tag color="blue">
              {ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('bankAccounts.field.accountNo')}>
            <Text code>{account.accountNumber ?? '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('bankAccounts.field.ifsc')}>
            {account.ifscCode}
          </Descriptions.Item>
          <Descriptions.Item label={t('bankAccounts.field.upiId')}>
            {account.upiId ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('bankAccounts.field.currentBalance')}>
            <Text strong style={{ fontSize: 18, color: 'var(--cr-success)' }}>
              {formatPaise(account.currentBalancePaise ?? 0)}
            </Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Divider>{t('bankAccounts.statement')}</Divider>

      {/* Bank statement */}
      {firmId && <BankStatementTable bankAccountId={id} firmId={firmId} />}

      {/* Edit modal */}
      <Modal
        title={t('bankAccounts.editTitle')}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <BankAccountForm
          initialValues={account}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </div>
  );
}
