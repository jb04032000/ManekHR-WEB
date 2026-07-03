'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Tabs,
} from 'antd';
import { ArrowLeftOutlined, ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms } from '@/lib/actions/finance.actions';
import { getLoan, runEmiNow, closeLoan, deleteLoan } from '@/lib/actions/finance-loans.actions';
import type { Firm, LoanAccount } from '@/types';
import AmortisationScheduleTable from '@/components/finance/loans/AmortisationScheduleTable';
import PrepayModal from '@/components/finance/loans/PrepayModal';

const { Title, Text } = Typography;

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

const LOAN_TYPE_LABELS: Record<string, string> = {
  term_loan: 'Term Loan',
  overdraft: 'Overdraft',
  cash_credit: 'Cash Credit',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'success',
  closed: 'default',
  npa: 'error',
};

export default function LoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const [firms, setFirms] = useState<Firm[]>([]);
  const [loan, setLoan] = useState<LoanAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [prepayOpen, setPrepayOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [runningEmi, setRunningEmi] = useState(false);

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
    getLoan(wsId, firmId, id)
      .then(setLoan)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [wsId, firmId, id]); // eslint-disable-line

  const thisMonth = currentYearMonth();
  const canRunEmi =
    loan?.loanType === 'term_loan' &&
    loan?.status === 'active' &&
    loan?.nextEmiMonth != null &&
    loan.nextEmiMonth <= thisMonth;
  const canClose = loan?.status === 'active' && (loan?.principalOutstandingPaise ?? 1) === 0;

  const handleRunEmi = async () => {
    setRunningEmi(true);
    try {
      const result = await runEmiNow(wsId, firmId, id);
      if (result.skipped) {
        message.info('EMI already posted for this month.');
      } else {
        message.success(`EMI posted (Entry: ${result.ledgerEntryId ?? 'created'})`);
      }
      load();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'EMI posting failed');
    } finally {
      setRunningEmi(false);
    }
  };

  const handleClose = () => {
    Modal.confirm({
      title: 'Close this loan?',
      content: 'Mark this loan as fully repaid. This action cannot be undone.',
      onOk: async () => {
        try {
          await closeLoan(wsId, firmId, id, 'full_repayment');
          message.success('Loan closed');
          load();
        } catch (e: unknown) {
          message.error(e instanceof Error ? e.message : 'Failed to close loan');
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="p-6">
        <Text type="danger">Loan not found.</Text>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/dashboard/finance/loans')}
          >
            Back
          </Button>
          <Title level={1} style={{ margin: 0, fontSize: 22 }}>
            {loan.name}
          </Title>
          <Tag color={STATUS_COLORS[loan.status] ?? 'default'}>{loan.status}</Tag>
          <Tag color="blue">{LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}</Tag>
        </Space>

        <Space wrap>
          {canRunEmi && (
            <Button
              icon={<ThunderboltOutlined />}
              type="primary"
              loading={runningEmi}
              onClick={handleRunEmi}
            >
              Run EMI Now
            </Button>
          )}
          <Button
            icon={<RupeeOutlined />}
            onClick={() => setPrepayOpen(true)}
            disabled={loan.status !== 'active'}
          >
            Prepay
          </Button>
          {canClose && (
            <Button icon={<CheckCircleOutlined />} onClick={handleClose}>
              Close Loan
            </Button>
          )}
        </Space>
      </div>

      {/* Loan summary card */}
      <Card size="small">
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Lender">{loan.lenderName}</Descriptions.Item>
          <Descriptions.Item label="Sanctioned">
            {formatPaise(loan.sanctionedAmountPaise)}
          </Descriptions.Item>
          <Descriptions.Item label="Disbursed">
            {formatPaise(loan.disbursedAmountPaise)}
          </Descriptions.Item>
          <Descriptions.Item label="Interest Rate">
            {loan.interestRateAnnual}% p.a.
          </Descriptions.Item>
          <Descriptions.Item label="Tenure">{loan.tenureMonths} months</Descriptions.Item>
          <Descriptions.Item label="EMI">
            {loan.emiAmountPaise ? formatPaise(loan.emiAmountPaise) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Outstanding">
            <Text strong style={{ fontSize: 16, color: 'var(--cr-danger-500)' }}>
              {formatPaise(loan.principalOutstandingPaise ?? 0)}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Interest Paid">
            <Text>{formatPaise(loan.totalInterestPaidPaise ?? 0)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Next EMI Month">{loan.nextEmiMonth ?? '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Divider />

      {/* Schedule / EMI History tabs */}
      {firmId && (
        <Tabs
          defaultActiveKey="schedule"
          items={[
            {
              key: 'schedule',
              label: 'Amortisation Schedule',
              children: (
                <AmortisationScheduleTable
                  loanId={id}
                  wsId={wsId}
                  firmId={firmId}
                  onRefresh={load}
                />
              ),
            },
            {
              key: 'history',
              label: 'EMI History',
              children: (
                <Text type="secondary">
                  EMI history is visible in the Schedule tab - filter by Status = Paid to see posted
                  entries.
                </Text>
              ),
            },
          ]}
        />
      )}

      <PrepayModal
        open={prepayOpen}
        loan={loan}
        wsId={wsId}
        firmId={firmId}
        onSuccess={() => {
          setPrepayOpen(false);
          load();
        }}
        onCancel={() => setPrepayOpen(false)}
      />
    </div>
  );
}
