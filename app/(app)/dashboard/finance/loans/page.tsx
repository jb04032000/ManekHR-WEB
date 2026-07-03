'use client';
// Loans list (Finance > Payments & Banking). Polish: i18n via finance.banking.loans + DsPageHeader.
// Links to loans/[id] + loans/new. Run-EMI action posts the current month's EMI via runEmiNow.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, Col, Empty, Row, Spin, Tag, Typography, message } from 'antd';
import { PlusOutlined, BankOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms } from '@/lib/actions/finance.actions';
import { listLoans, runEmiNow } from '@/lib/actions/finance-loans.actions';
import type { Firm, LoanAccount } from '@/types';

const { Text } = Typography;

const LOAN_TYPE_COLORS: Record<string, string> = {
  term_loan: 'blue',
  overdraft: 'orange',
  cash_credit: 'purple',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'success',
  closed: 'default',
  npa: 'error',
};

function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function LoansPage() {
  const router = useRouter();
  const t = useTranslations('finance.banking');
  // tShared only sources the shared list error-state labels (finance.sales.listCommon.*).
  const tShared = useTranslations('finance.sales');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const LOAN_TYPE_LABELS: Record<string, string> = {
    term_loan: t('loans.type.termLoan'),
    overdraft: t('loans.type.overdraft'),
    cash_credit: t('loans.type.cashCredit'),
  };

  const [firms, setFirms] = useState<Firm[]>([]);
  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

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
    listLoans(wsId, firmId)
      .then((res) => setLoans(res.items ?? []))
      .catch(() => {
        setLoans([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [wsId, firmId]); // eslint-disable-line

  const thisMonth = currentYearMonth();

  const handleRunEmi = async (loan: LoanAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    setRunningId(loan._id);
    try {
      const result = await runEmiNow(wsId, firmId, loan._id);
      if (result.skipped) {
        message.info(t('loans.emiSkipped'));
      } else {
        message.success(t('loans.emiPosted'));
      }
      load();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : t('loans.emiFailed'));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <DsPageHeader
        title={t('loans.title')}
        icon={<BankOutlined />}
        titleAside={<InfoTooltip text={t('loans.info')} />}
        right={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push('/dashboard/finance/loans/new')}
          >
            {t('loans.new')}
          </Button>
        }
      />

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={load}
        />
      ) : (
        <Spin spinning={loading}>
          {loans.length === 0 && !loading ? (
            <Empty description={t('loans.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={() => router.push('/dashboard/finance/loans/new')}>
                {t('loans.createFirst')}
              </Button>
            </Empty>
          ) : (
            <Row gutter={[16, 16]}>
              {loans.map((loan) => {
                const canRunEmi =
                  loan.loanType === 'term_loan' &&
                  loan.status === 'active' &&
                  loan.nextEmiMonth != null &&
                  loan.nextEmiMonth <= thisMonth;

                return (
                  <Col key={loan._id} xs={24} sm={12} lg={8}>
                    <Card
                      hoverable
                      size="small"
                      onClick={() => router.push(`/dashboard/finance/loans/${loan._id}`)}
                      title={
                        <div className="flex items-center justify-between">
                          <Text strong ellipsis style={{ maxWidth: 160 }}>
                            {loan.name}
                          </Text>
                          <Tag color={STATUS_COLORS[loan.status] ?? 'default'}>
                            {t(`loans.status.${loan.status}` as 'loans.status.active')}
                          </Tag>
                        </div>
                      }
                      extra={
                        <Tag color={LOAN_TYPE_COLORS[loan.loanType] ?? 'default'}>
                          {LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}
                        </Tag>
                      }
                      actions={[
                        <Button
                          key="view"
                          type="link"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/finance/loans/${loan._id}`);
                          }}
                        >
                          {t('loans.viewDetails')}
                        </Button>,
                        ...(canRunEmi
                          ? [
                              <Button
                                key="emi"
                                type="link"
                                size="small"
                                loading={runningId === loan._id}
                                onClick={(e) => handleRunEmi(loan, e)}
                              >
                                {t('loans.runEmi')}
                              </Button>,
                            ]
                          : []),
                      ]}
                    >
                      <div className="space-y-1">
                        <Text type="secondary">{loan.lenderName}</Text>
                        <div>
                          <Text type="secondary">{t('loans.outstanding')}</Text>
                          <Text strong style={{ fontSize: 16 }}>
                            {formatPaise(loan.principalOutstandingPaise ?? 0)}
                          </Text>
                        </div>

                        {loan.loanType === 'term_loan' ? (
                          <div>
                            <Text type="secondary">{t('loans.nextEmi')}</Text>
                            <Text>
                              {loan.emiAmountPaise ? formatPaise(loan.emiAmountPaise) : '-'}
                              {loan.nextEmiMonth
                                ? t('loans.onMonth', { month: loan.nextEmiMonth })
                                : ''}
                            </Text>
                          </div>
                        ) : (
                          <div>
                            <Text type="secondary">{t('loans.sanctionedShort')}</Text>
                            <Text>{formatPaise(loan.sanctionedAmountPaise)}</Text>
                          </div>
                        )}
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </Spin>
      )}
    </div>
  );
}
